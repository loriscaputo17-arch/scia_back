"""
SCIA — correzione nomi ricambi SUBCOOLER (STIRLING)
===================================================
Il foglio SPARE PARTS del subcooler ha ~101 righe SFASATE: nella colonna
'Descrizione' c'e' il numero di posizione (1., 2., ...) e il NOME VERO e' nella
colonna 'PN fornitore', il PN vero nella colonna 'CAGE fornitore'. L'import
originale ha quindi salvato il numero come Part_name.

Questo script NON fa matching riga-per-riga (impossibile: i numeri si ripetono).
Fa uno SCAMBIO D'INSIEME, sicuro perche' questi sono ricambi di CATALOGO senza
link a manutenzioni:
  - estrae dalla sorgente i ricambi delle righe sfasate, col nome/pn corretti;
  - cancella dal DB i ricambi del subcooler col nome numerico;
  - reinserisce i ricambi corretti sullo stesso element_model.

SICUREZZE:
  - procede solo se i ricambi col nome numerico NON hanno link in Maintenance_ListSpare;
  - procede solo se (n. numerici nel DB) == (n. righe sfasate nella sorgente);
  - DRY_RUN=True stampa tutto e fa rollback: nessuna scrittura.

USO: configura DB (env) e SUBCOOLER_FILE. DRY_RUN=True -> verifica. Poi False.
"""
import os, sys
import openpyxl
try:
    import pymysql
except ImportError:
    pymysql = None

DB = dict(host=os.getenv("DB_HOST",""), port=int(os.getenv("DB_PORT","3306")),
          user=os.getenv("DB_USER",""), password=os.getenv("DB_PASSWORD",""),
          database=os.getenv("DB_NAME","sciadb"), charset="utf8mb4")
SHIP_ID = int(os.getenv("SHIP_ID","31"))
SUBCOOLER_FILE = "scia_files/55711 01 09_0A_0B_0C - SUBCOOLERS - STIRLING CRYOGENICS.xlsx"
SUBCOOLER_LCN_NAME_LIKE = "%SUB-COOLER%"     # come compaiono gli element_model del subcooler
DRY_RUN = False

def norm(v): return "" if v is None else str(v).strip()
def is_pos(s):
    s = norm(s).rstrip(".").replace(" ", "")
    return s.isdigit() and s != ""
def g(r, i): return norm(r[i]) if len(r) > i else ""

def extract_shifted(path):
    """Ritorna i ricambi delle righe SFASATE: (nome=c1, pn=c2)."""
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    rows = [list(r) for r in wb["SPARE PARTS"].iter_rows(values_only=True)]
    wb.close()
    out = []
    for r in rows[2:]:
        if not any(norm(c) for c in r): continue
        if not is_pos(g(r, 0)): continue          # solo righe sfasate
        name = g(r, 1); pn = g(r, 2)
        if not name or name.lower() == "non disponibile": continue
        out.append((name[:255], (pn or None)))
    return out

def main():
    if pymysql is None or not DB["host"]:
        print("Config DB mancante (DB_HOST/pymysql)."); return
    if not os.path.exists(SUBCOOLER_FILE):
        print(f"File non trovato: {SUBCOOLER_FILE}"); return

    corrected = extract_shifted(SUBCOOLER_FILE)
    print(f"Righe sfasate (ricambi corretti) dalla sorgente: {len(corrected)}")

    conn = pymysql.connect(**DB, autocommit=False); cur = conn.cursor()

    # ricambi del subcooler col nome NUMERICO
    cur.execute(f"""
        SELECT s.ID, s.element_model_id
        FROM Spare s JOIN ElementModel em ON em.id = s.element_model_id
        WHERE s.ship_id = %s AND em.LCN_name LIKE %s
          AND s.Part_name REGEXP '^[0-9]+\\\\.?$'
        ORDER BY s.ID
    """, (SHIP_ID, SUBCOOLER_LCN_NAME_LIKE))
    rows = cur.fetchall()
    numeric_ids = [r[0] for r in rows]
    print(f"Ricambi col nome numerico nel DB: {len(numeric_ids)}")

    if not numeric_ids:
        print("Niente da correggere."); conn.close(); return

    # element_model di destinazione (il piu' comune tra quelli numerici)
    from collections import Counter
    target_em = Counter(r[1] for r in rows).most_common(1)[0][0]
    print(f"element_model_id di destinazione per il reinserimento: {target_em}")

    # SICUREZZA 1: nessun link a manutenzioni
    fmt = ",".join(["%s"] * len(numeric_ids))
    cur.execute(f"SELECT COUNT(*) FROM Maintenance_ListSpare WHERE Spare_ID IN ({fmt})", numeric_ids)
    n_links = cur.fetchone()[0]
    print(f"Link a manutenzioni su questi ricambi: {n_links}")
    if n_links > 0:
        print("STOP: alcuni ricambi numerici hanno link a manutenzioni. Non procedo (serve verifica)."); conn.close(); return

    # SICUREZZA 2: i conteggi devono combaciare (scambio d'insieme pulito)
    if len(numeric_ids) != len(corrected):
        print(f"STOP: conteggi diversi (DB numerici {len(numeric_ids)} != sorgente sfasate {len(corrected)}). "
              f"Non faccio lo scambio per non perdere/aggiungere righe. Verifichiamo insieme."); conn.close(); return

    print("\nAnteprima nuovi nomi (primi 12):")
    for name, pn in corrected[:12]:
        print(f"   {name}   [PN {pn}]")

    if not DRY_RUN:
        cur.execute(f"DELETE FROM Spare WHERE ID IN ({fmt})", numeric_ids)
        cur.executemany(
            "INSERT INTO Spare (element_model_id, ship_id, Part_name, Serial_number) VALUES (%s,%s,%s,%s)",
            [(target_em, SHIP_ID, name[:255], (pn or "N/D")[:255]) for name, pn in corrected])
        conn.commit()
        print(f"\nFATTO: cancellati {len(numeric_ids)}, inseriti {len(corrected)} con nomi corretti. COMMIT.")
    else:
        conn.rollback()
        print(f"\nDRY_RUN: cancellerei {len(numeric_ids)} e inserirei {len(corrected)}. Nessuna scrittura (rollback).")
    conn.close()

if __name__ == "__main__":
    main()