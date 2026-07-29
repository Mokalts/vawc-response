from database import engine
from sqlalchemy import text

conn = engine.connect()
tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")).fetchall()

for t in tables:
    print(f'\n=== {t[0].upper()} ===')
    cols = conn.execute(text("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = :t ORDER BY ordinal_position"), {'t': t[0]}).fetchall()
    for c in cols:
        nullable = '(nullable)' if c[2] == 'YES' else ''
        print(f'  {c[0]} — {c[1]} {nullable}')

conn.close()