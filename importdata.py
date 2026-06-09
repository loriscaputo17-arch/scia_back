#!/usr/bin/env python3
"""
SCIA — scarica da Google Drive tutti gli .xlsx della cartella di progetto
in una cartella locale, pronti per import_scia_v5.py.

NB: gira sul TUO PC/server (non nel sandbox). Richiede un service account Google.

Setup una tantum:
  1) Google Cloud Console -> nuovo progetto -> abilita "Google Drive API"
  2) crea un Service Account -> scarica la chiave JSON
  3) condividi la cartella Drive con l'email del service account (sola lettura)
  4) pip install google-api-python-client google-auth

Uso:
  GOOGLE_APPLICATION_CREDENTIALS=/percorso/chiave.json \
  DRIVE_FOLDER_ID=1byhS3mh0ydIc6kA2lvT38lp8oqNCGN5e \
  OUT_DIR=./scia_files \
  python3 scia_drive_download.py

Poi:
  MASTER_PBS=./scia_files/PBS-Albero*.xlsx EQUIPMENT_DIR=./scia_files \
  DRY_RUN=1 python3 import_scia_v5.py
"""
import io, os, sys

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
except ImportError:
    sys.exit("Manca una libreria. Esegui:\n"
             "  pip install google-api-python-client google-auth")

# ── CONFIG (da variabili d'ambiente) ───────────────────────────────
CRED   = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
FOLDER = os.getenv("DRIVE_FOLDER_ID", "1byhS3mh0ydIc6kA2lvT38lp8oqNCGN5e")
OUTDIR = os.getenv("OUT_DIR", "./scia_files")
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

XLSX_MIME   = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
FOLDER_MIME = "application/vnd.google-apps.folder"


def service():
    if not CRED or not os.path.exists(CRED):
        sys.exit("Imposta GOOGLE_APPLICATION_CREDENTIALS sul file JSON del service account.")
    creds = service_account.Credentials.from_service_account_file(CRED, scopes=SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def list_children(svc, folder_id):
    """Tutti i figli (file e sottocartelle) di una cartella, con paginazione."""
    items, token = [], None
    while True:
        resp = svc.files().list(
            q=f"'{folder_id}' in parents and trashed = false",
            fields="nextPageToken, files(id, name, mimeType)",
            pageSize=200, pageToken=token,
            supportsAllDrives=True, includeItemsFromAllDrives=True,
        ).execute()
        items += resp.get("files", [])
        token = resp.get("nextPageToken")
        if not token:
            return items


def download(svc, file_id, dest_path):
    req = svc.files().get_media(fileId=file_id, supportsAllDrives=True)
    buf = io.FileIO(dest_path, "wb")
    dl = MediaIoBaseDownload(buf, req)
    done = False
    while not done:
        _, done = dl.next_chunk()
    buf.close()


def walk(svc, folder_id, out_dir, depth=0):
    n = 0
    for it in list_children(svc, folder_id):
        if it["mimeType"] == FOLDER_MIME:
            n += walk(svc, it["id"], out_dir, depth + 1)        # ricorsione
        elif it["mimeType"] == XLSX_MIME and not it["name"].startswith("~$"):
            dest = os.path.join(out_dir, it["name"])
            base, ext = os.path.splitext(dest)
            k = 1
            while os.path.exists(dest):                          # evita collisioni nomi
                dest = f"{base}__{k}{ext}"; k += 1
            print(f"  {'  '*depth}↓ {it['name']}")
            download(svc, it["id"], dest)
            n += 1
    return n


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    svc = service()
    print(f"Scarico da cartella {FOLDER} -> {OUTDIR}")
    total = walk(svc, FOLDER, OUTDIR)
    print(f"\nFatto: {total} file .xlsx scaricati in {OUTDIR}")
    print("Ora:  MASTER_PBS=<master> EQUIPMENT_DIR=%s DRY_RUN=1 python3 import_scia_v5.py" % OUTDIR)


if __name__ == "__main__":
    main()