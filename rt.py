import pymysql
import re

DB_HOST = "scia-project-questit.ccp0mjdczkug.eu-central-1.rds.amazonaws.com"
DB_NAME = "sciadb"
DB_PASSWORD = "MiTEwe64w6hAkIXiYo8aLavogIKO5i"
DB_PORT = 3306
DB_USER = "sciauser"

def name_to_days(name):
    n = name.strip().lower()
    
    # Mappatura diretta
    direct = {
        "daily": 1,
        "weekly": 7,
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "semiannual": 180,
        "on condition": None,
        "on fault - troubleshooting": None,
    }
    for k, v in direct.items():
        if k in n:
            return v

    # "every X hours" → None (ore non convertibili in giorni)
    if "hour" in n or "cycle" in n:
        return None

    # "first X weeks/months" → calcola normalmente
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(day|week|month|year)', n)
    if m:
        qty = float(m.group(1).replace(',', '.'))
        unit = m.group(2)
        mult = {"day": 1, "week": 7, "month": 30, "year": 365}
        return int(qty * mult[unit])

    return None

conn = pymysql.connect(
    host=DB_HOST, port=DB_PORT,
    user=DB_USER, password=DB_PASSWORD,
    database=DB_NAME, charset="utf8mb4",
    autocommit=False
)
cursor = conn.cursor()

cursor.execute("SELECT id, name, to_days, delay_threshold, due_threshold, early_threshold FROM RecurrencyType")
rows = cursor.fetchall()

updated = 0
for row in rows:
    rid, name, to_days, delay, due, early = row

    # Calcola to_days se mancante
    if not to_days:
        to_days = name_to_days(name)

    if not to_days:
        print(f"  SKIP id={rid} '{name}' → to_days non calcolabile")
        continue

    new_due   = due   if due   else max(1, round(to_days * 0.05))
    new_delay = delay if delay else max(1, round(to_days * 0.10))
    new_early = early if early else max(1, round(to_days * 0.10))

    cursor.execute("""
        UPDATE RecurrencyType 
        SET to_days = %s, due_threshold = %s, delay_threshold = %s, early_threshold = %s
        WHERE id = %s
    """, (to_days, new_due, new_delay, new_early, rid))
    
    print(f"  OK id={rid} '{name}' → to_days={to_days}, due={new_due}, delay={new_delay}, early={new_early}")
    updated += 1

conn.commit()
cursor.close()
conn.close()
print(f"\nAggiornati: {updated} record")