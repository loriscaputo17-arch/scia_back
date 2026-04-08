"""
SCIADB Import Script v3
Importa in ordine: ElementModel (con gerarchia) → Element → Spare → Tools

Novità v3:
- parent_element_model_id calcolato automaticamente dalla gerarchia LCN
  Regola: ogni livello aggiunge 2 digit al LCN → il parent è LCN[:-2]
  Esempio: LCN=241110101 → parent=2411101 → parent=24111 → parent=24000

ISTRUZIONI:
1. Svuota prima i dati del run precedente (se necessario):
   DELETE FROM Tools WHERE ship_id = X;
   DELETE FROM Spare WHERE ship_id = X;
   DELETE FROM Element WHERE ship_id = X;
   DELETE FROM ElementModel WHERE ship_model_id = X;

2. Configura CONFIG qui sotto
3. python3 import_sciadb_v3.py
"""

import pandas as pd
import pymysql
import sys
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
DB_HOST="scia-project-questit.ccp0mjdczkug.eu-central-1.rds.amazonaws.com"
DB_NAME="sciadb"
DB_PASSWORD="MiTEwe64w6hAkIXiYo8aLavogIKO5i"
DB_PORT=3306
DB_USER="sciauser"

EXCEL_FILE    = "pbs.xlsx"
SHIP_ID       = 31   # ← imposta il tuo ship_id
SHIP_MODEL_ID = 4   # ← imposta il tuo ship_model_id

ELEMENT_MODEL_TYPES = {"EI", "SYS", "GRP", "LRU", "ASSY"}
ELEMENT_TYPES       = {"UI"}
SPARE_TYPES         = {"LRU"}
TOOL_TYPES          = {"TOOL", "TOOL SET"}

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def safe(val, default=None):
    if val is None:
        return default
    try:
        if pd.isna(val):
            return default
    except Exception:
        pass
    return val

def safe_str(val, max_len=None):
    v = safe(val)
    if v is None:
        return None
    s = str(v).strip()
    if max_len:
        s = s[:max_len]
    return s if s else None

def safe_int(val):
    v = safe(val)
    if v is None:
        return None
    try:
        return int(float(v))
    except Exception:
        return None

def safe_float(val):
    v = safe(val)
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None

def safe_date(val):
    v = safe(val)
    if v is None:
        return None
    if isinstance(v, (datetime, pd.Timestamp)):
        return v.strftime("%Y-%m-%d")
    try:
        return pd.to_datetime(str(v)).strftime("%Y-%m-%d")
    except Exception:
        return safe_str(v, 50)

def dims_str(row):
    l = safe_str(col(row, "dim_l"))
    p = safe_str(col(row, "dim_p"))
    h = safe_str(col(row, "dim_h"))
    if l or p or h:
        return f"{l or '?'}x{p or '?'}x{h or '?'}"
    return None

def baricentro(row):
    bari = safe_str(col(row, "baricentro"))
    xg = yg = zg = None
    if bari:
        parts = str(bari).replace(",", ".").split()
        if len(parts) >= 1: xg = safe_float(parts[0])
        if len(parts) >= 2: yg = safe_float(parts[1])
        if len(parts) >= 3: zg = safe_float(parts[2])
    return xg, yg, zg

def find_parent_id(lcn_val, lcn_to_em_id):
    """
    Risale la gerarchia togliendo 2 caratteri alla volta dal fondo del LCN
    finché trova un parent registrato in lcn_to_em_id.
    
    Esempi:
      241110101 → 2411101 → 24111 → 24000 → 0
      2351201   → 23512   → 23500 → 0
      19910     → 0 (livello 1, nessun parent)
    """
    if not lcn_val:
        return 0
    candidate = lcn_val
    while len(candidate) > 2:
        candidate = candidate[:-2]
        if candidate in lcn_to_em_id:
            return lcn_to_em_id[candidate]
    return 0  # radice

# ─────────────────────────────────────────────
# CARICAMENTO EXCEL
# ─────────────────────────────────────────────
print(f"[{datetime.now().strftime('%H:%M:%S')}] Caricamento Excel...")
df_raw = pd.read_excel(EXCEL_FILE, sheet_name="Sheet1", header=0)
df = df_raw.iloc[1:].reset_index(drop=True)
print(f"[{datetime.now().strftime('%H:%M:%S')}] Righe totali: {len(df)}")

COL = {
    "livello_wbs":    2,    "eswbs":          3,
    "liv4":           4,    "liv5":           5,
    "liv6":           6,    "liv7":           7,
    "liv8":           8,    "liv9":           9,
    "lcn":            10,   "alc":            11,
    "ci_hdci":        12,   "denominazione":  13,
    "liv_config":     14,   "modello":        15,
    "marca":          "16.", "pn_fornitore":  17,
    "cod_fornitore":  18,   "pn_costruttore": 19,
    "cod_costruttore":20,   "qty_assy":       22,
    "qty_ship":       23,   "lcn_type":       24,
    "nsn":            25,   "prezzo":         26,
    "data_prezzo":    27,   "mtbf":           29,
    "mttr":           30,   "mcbf":           31,
    "criticita":      33,   "riparabilita":   34,
    "sostituibilita": 35,   "serial_number":  42,
    "peso":           43,   "dim_l":          44,
    "dim_p":          45,   "dim_h":          46,
    "volume":         47,   "alimentazione":  48,
    "calore_aria":    49,   "locale":         51,
    "posizione":      52,   "calore_acqua":   53,
    "giri":           54,   "potenza":        55,
    "antiurto":       56,   "baricentro":     57,
    "portata":        58,   "pressione":      59,
    "num_disegno":    60,   "pos_disegno":    61,
    "rev_disegno":    62,   "data_produzione":63,
    "data_installaz": 64,   "note":           66,
}

def col(row, key):
    return row[COL[key]]

# ─────────────────────────────────────────────
# CONNESSIONE DB
# ─────────────────────────────────────────────
print(f"[{datetime.now().strftime('%H:%M:%S')}] Connessione al database...")
try:
    conn = pymysql.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, charset="utf8mb4",
        autocommit=False
    )
    cursor = conn.cursor()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Connessione OK")
except Exception as e:
    print(f"ERRORE connessione: {e}")
    sys.exit(1)

stats = {
    "em_ok": 0, "em_skip": 0,
    "el_ok": 0, "el_skip": 0,
    "sp_ok": 0, "sp_skip": 0,
    "to_ok": 0, "to_skip": 0,
    "errors": []
}

lcn_to_em_id = {}  # LCN string → ElementModel.id (popolato man mano)
serial_seen  = {}  # per deduplicare serial number

# ─────────────────────────────────────────────
# PASS 1: ElementModel con gerarchia corretta
# L'Excel è già ordinato dall'alto verso il basso (parent prima dei figli)
# quindi possiamo calcolare parent_id in streaming
# ─────────────────────────────────────────────
print(f"\n[{datetime.now().strftime('%H:%M:%S')}] === PASS 1: ElementModel (con gerarchia) ===")

EM_SQL = """
    INSERT INTO ElementModel (
        parent_element_model_id, ship_model_id,
        ESWBS_code, LCN_name, LCN, ALC,
        `CI/HDCI/CSCI`, LCNtype_ID,
        Installed_quantity_on_End_Item, Installed_Quantity_on_Ship,
        Level1, Level3, Level4, Level5, Level6, Level7, Level8, Level9,
        Heat_transfer_to_air, Heat_transfer_to_water,
        Power_supply, RatedPower, Weight, Dimensions_LxWxH,
        XG_Center_of_gravity, YG_Center_of_gravity, ZG_Center_of_gravity,
        Revolution_speed, Operating_pressure, Mass_flow,
        Drawing_number, Drawing_number_revision_index,
        Position_on_arrangement_drawing, Ship_Area_Room_Code,
        Production_testing_date, Installation_date,
        Criticality_Code_CC, Repairability_Code_CR, Replaceability_Code_CS
    ) VALUES (
        %s,%s, %s,%s,%s,%s, %s,%s, %s,%s,
        %s,%s,%s,%s,%s,%s,%s,%s,
        %s,%s, %s,%s,%s,%s, %s,%s,%s,
        %s,%s,%s, %s,%s, %s,%s, %s,%s, %s,%s,%s
    )
"""

for idx, row in df.iterrows():
    lcn_type = safe_str(col(row, "lcn_type"))

    # Importa: tipi espliciti + righe senza tipo (sotto-componenti NaN)
    if lcn_type not in ELEMENT_MODEL_TYPES and lcn_type is not None:
        continue  # UI, TOOL, TOOL SET → altri pass

    lcn_val = safe_str(col(row, "lcn"), 50)
    eswbs   = safe_str(col(row, "eswbs"), 50)
    denom   = safe_str(col(row, "denominazione"), 255) or "N/D"
    wbs     = safe_str(col(row, "livello_wbs"), 10)
    xg, yg, zg = baricentro(row)

    # ── CALCOLO PARENT ──────────────────────────────────────────
    parent_id = find_parent_id(lcn_val, lcn_to_em_id)
    # ────────────────────────────────────────────────────────────

    values = (
        parent_id, SHIP_MODEL_ID,
        eswbs, denom, lcn_val, safe_str(col(row, "alc"), 50),
        safe_str(col(row, "ci_hdci"), 50), lcn_type,
        safe_int(col(row, "qty_assy")), safe_int(col(row, "qty_ship")),
        wbs, eswbs,
        safe_str(col(row, "liv4"), 10), safe_str(col(row, "liv5"), 10),
        safe_str(col(row, "liv6"), 10), safe_str(col(row, "liv7"), 10),
        safe_str(col(row, "liv8"), 10), safe_str(col(row, "liv9"), 10),
        safe_float(col(row, "calore_aria")), safe_float(col(row, "calore_acqua")),
        safe_str(col(row, "alimentazione"), 50), safe_float(col(row, "potenza")),
        safe_float(col(row, "peso")), dims_str(row),
        xg, yg, zg,
        safe_int(col(row, "giri")), safe_float(col(row, "pressione")),
        safe_float(col(row, "portata")),
        safe_str(col(row, "num_disegno"), 150), safe_str(col(row, "rev_disegno"), 10),
        safe_str(col(row, "posizione"), 50), safe_str(col(row, "locale"), 50),
        safe_date(col(row, "data_produzione")), safe_date(col(row, "data_installaz")),
        safe_int(col(row, "criticita")), safe_int(col(row, "riparabilita")),
        safe_int(col(row, "sostituibilita")),
    )

    try:
        cursor.execute(EM_SQL, values)
        new_id = cursor.lastrowid
        if lcn_val:
            lcn_to_em_id[lcn_val] = new_id
        stats["em_ok"] += 1
    except Exception as e:
        stats["em_skip"] += 1
        stats["errors"].append(f"Row {idx+2} ElementModel LCN={lcn_val}: {e}")

conn.commit()
print(f"  → Inseriti: {stats['em_ok']} | Saltati: {stats['em_skip']}")

# Verifica gerarchia: stampa un campione
print(f"  → Mappa LCN→ID campione (primi 10):")
for k, v in list(lcn_to_em_id.items())[:10]:
    parent = find_parent_id(k, lcn_to_em_id)
    print(f"     LCN={k} → ID={v} → parent_id={parent}")

# ─────────────────────────────────────────────
# PASS 2: Element
# Crea un Element per OGNI riga importata come ElementModel (UI + tutti gli altri).
# - Se la riga ha serial number nell'Excel → lo usa
# - Altrimenti → AUTO-{LCN}
# ─────────────────────────────────────────────
print(f"\n[{datetime.now().strftime('%H:%M:%S')}] === PASS 2: Element (uno per ogni ElementModel) ===")

EL_SQL = """
    INSERT INTO Element (
        element_model_id, ship_id, name, serial_number,
        installation_date, updated_at
    ) VALUES (%s, %s, %s, %s, %s, %s)
"""

for idx, row in df.iterrows():
    lcn_type = safe_str(col(row, "lcn_type"))

    # Stessa condizione del Pass 1: tutti gli ElementModel (espliciti + NaN sotto-componenti)
    if lcn_type not in ELEMENT_MODEL_TYPES and lcn_type is not None:
        continue  # TOOL, TOOL SET, UI → saltati (UI ha il suo Element già nell'Excel)

    lcn_val = safe_str(col(row, "lcn"), 50)
    denom   = safe_str(col(row, "denominazione"), 255) or "N/D"

    # Serial: usa quello dell'Excel se presente, altrimenti AUTO-{LCN}
    serial = safe_str(col(row, "serial_number"), 200)
    if not serial:
        serial = f"AUTO-{lcn_val or idx}"

    # Deduplicazione
    if serial in serial_seen:
        serial_seen[serial] += 1
        serial = f"{serial}-{lcn_val or serial_seen[serial]}"
    else:
        serial_seen[serial] = 1
    serial = serial[:255]

    # Recupera l'element_model_id appena inserito nel Pass 1
    em_id = lcn_to_em_id.get(lcn_val)

    try:
        cursor.execute(EL_SQL, (
            em_id, SHIP_ID, denom[:255], serial,
            safe_date(col(row, "data_installaz")),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        ))
        stats["el_ok"] += 1
    except Exception as e:
        stats["el_skip"] += 1
        stats["errors"].append(f"Row {idx+2} Element LCN={lcn_val} serial={serial}: {e}")

# Ora aggiungi anche gli Element per le righe UI (tipo esplicito)
# che puntano al loro ElementModel parent tramite ESWBS
for idx, row in df.iterrows():
    lcn_type = safe_str(col(row, "lcn_type"))
    if lcn_type not in ELEMENT_TYPES:
        continue

    lcn_val = safe_str(col(row, "lcn"), 50)
    denom   = safe_str(col(row, "denominazione"), 255) or "N/D"
    serial  = safe_str(col(row, "serial_number"), 200)

    if not serial:
        serial = f"AUTO-{lcn_val or idx}"

    if serial in serial_seen:
        serial_seen[serial] += 1
        serial = f"{serial}-{lcn_val}"
    else:
        serial_seen[serial] = 1
    serial = serial[:255]

    eswbs_5 = safe_str(col(row, "eswbs"), 10)
    em_id = lcn_to_em_id.get(eswbs_5) or lcn_to_em_id.get(lcn_val)

    try:
        cursor.execute(EL_SQL, (
            em_id, SHIP_ID, denom[:255], serial,
            safe_date(col(row, "data_installaz")),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        ))
        stats["el_ok"] += 1
    except Exception as e:
        stats["el_skip"] += 1
        stats["errors"].append(f"Row {idx+2} Element UI LCN={lcn_val} serial={serial}: {e}")

conn.commit()
print(f"  → Inseriti: {stats['el_ok']} | Saltati: {stats['el_skip']}")

# ─────────────────────────────────────────────
# PASS 3: Spare (LRU)
# ─────────────────────────────────────────────
print(f"\n[{datetime.now().strftime('%H:%M:%S')}] === PASS 3: Spare ===")

SP_SQL = """
    INSERT INTO Spare (
        element_model_id, ship_id, Serial_number, Part_name,
        Unitary_price, NSN, Weight, Dimensions_LxWxH, Volume,
        Price_reference_date
    ) VALUES (%s,%s,%s,%s, %s,%s,%s,%s,%s, %s)
"""

for idx, row in df.iterrows():
    lcn_type = safe_str(col(row, "lcn_type"))
    if lcn_type not in SPARE_TYPES:
        continue

    lcn_val = safe_str(col(row, "lcn"), 50)
    denom   = safe_str(col(row, "denominazione"), 255) or "N/D"
    serial  = safe_str(col(row, "serial_number"), 200)

    if not serial:
        serial = f"SPARE-{lcn_val or idx}-{idx}"

    if serial in serial_seen:
        serial_seen[serial] += 1
        serial = f"{serial}-SP{serial_seen[serial]}"
    else:
        serial_seen[serial] = 1
    serial = serial[:255]

    eswbs_5 = safe_str(col(row, "eswbs"), 10)
    em_id = lcn_to_em_id.get(eswbs_5) or lcn_to_em_id.get(lcn_val)

    try:
        cursor.execute(SP_SQL, (
            em_id, SHIP_ID, serial, denom[:255],
            safe_str(col(row, "prezzo"), 100),
            safe_str(col(row, "nsn"), 100),
            safe_str(col(row, "peso"), 100),
            dims_str(row),
            safe_str(col(row, "volume"), 100),
            safe_str(col(row, "data_prezzo"), 100),
        ))
        stats["sp_ok"] += 1
    except Exception as e:
        stats["sp_skip"] += 1
        stats["errors"].append(f"Row {idx+2} Spare LCN={lcn_val}: {e}")

conn.commit()
print(f"  → Inseriti: {stats['sp_ok']} | Saltati: {stats['sp_skip']}")

# ─────────────────────────────────────────────
# PASS 4: Tools (TOOL, TOOL SET)
# ─────────────────────────────────────────────
print(f"\n[{datetime.now().strftime('%H:%M:%S')}] === PASS 4: Tools ===")

TO_SQL = """
    INSERT INTO Tools (
        element_model_id, ship_id, Tool_name,
        Original_description_OEM, Part_Number_OEM,
        NSN, `Unitary price`, Weight, Dimensions_LxWxH,
        Volume, Price_reference_date
    ) VALUES (%s,%s,%s, %s,%s, %s,%s,%s,%s, %s,%s)
"""

for idx, row in df.iterrows():
    lcn_type = safe_str(col(row, "lcn_type"))
    if lcn_type not in TOOL_TYPES:
        continue

    lcn_val = safe_str(col(row, "lcn"), 50)
    denom   = safe_str(col(row, "denominazione"), 255) or "N/D"
    eswbs_5 = safe_str(col(row, "eswbs"), 10)
    em_id   = lcn_to_em_id.get(eswbs_5) or lcn_to_em_id.get(lcn_val)

    try:
        cursor.execute(TO_SQL, (
            em_id, SHIP_ID, denom[:255],
            safe_str(col(row, "denominazione"), 100),
            safe_str(col(row, "pn_fornitore"), 100),
            safe_str(col(row, "nsn"), 100),
            safe_str(col(row, "prezzo"), 100),
            safe_str(col(row, "peso"), 100),
            dims_str(row),
            safe_str(col(row, "volume"), 100),
            safe_str(col(row, "data_prezzo"), 100),
        ))
        stats["to_ok"] += 1
    except Exception as e:
        stats["to_skip"] += 1
        stats["errors"].append(f"Row {idx+2} Tool LCN={lcn_val}: {e}")

conn.commit()
print(f"  → Inseriti: {stats['to_ok']} | Saltati: {stats['to_skip']}")

# ─────────────────────────────────────────────
# RIEPILOGO
# ─────────────────────────────────────────────
cursor.close()
conn.close()

total_ok   = stats['em_ok'] + stats['el_ok'] + stats['sp_ok'] + stats['to_ok']
total_skip = stats['em_skip'] + stats['el_skip'] + stats['sp_skip'] + stats['to_skip']

print(f"\n{'='*55}")
print(f"RIEPILOGO IMPORT v3 — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{'='*55}")
print(f"  ElementModel : {stats['em_ok']:>4} OK / {stats['em_skip']} saltati")
print(f"  Element      : {stats['el_ok']:>4} OK / {stats['el_skip']} saltati")
print(f"  Spare        : {stats['sp_ok']:>4} OK / {stats['sp_skip']} saltati")
print(f"  Tools        : {stats['to_ok']:>4} OK / {stats['to_skip']} saltati")
print(f"  ─────────────────────────────────────")
print(f"  TOTALE       : {total_ok:>4} OK / {total_skip} saltati")
print(f"  Errori       : {len(stats['errors'])}")

with open("import_log_v3.txt", "w", encoding="utf-8") as f:
    f.write(f"Import SCIADB v3 — {datetime.now()}\n")
    f.write(f"ElementModel : {stats['em_ok']} OK / {stats['em_skip']} saltati\n")
    f.write(f"Element      : {stats['el_ok']} OK / {stats['el_skip']} saltati\n")
    f.write(f"Spare        : {stats['sp_ok']} OK / {stats['sp_skip']} saltati\n")
    f.write(f"Tools        : {stats['to_ok']} OK / {stats['to_skip']} saltati\n\n")
    f.write("--- ERRORI ---\n")
    for e in stats["errors"]:
        f.write(e + "\n")

print(f"\nLog salvato in: import_log_v3.txt")
if stats["errors"]:
    print(f"\nPrimi 5 errori:")
    for e in stats["errors"][:5]:
        print(f"  {e}")