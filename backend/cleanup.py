from database import engine
from sqlalchemy import text

conn = engine.connect()
keep = 'janmukalersmendoza5@gmail.com'

users = conn.execute(text("SELECT id, email FROM users WHERE email != :e"), {'e': keep}).fetchall()
print(f'Deleting {len(users)} users:')
for u in users:
    print(f'  - {u.email}')

ids = [u.id for u in users]
if ids:
    id_list = ','.join(str(i) for i in ids)
    conn.execute(text(f'DELETE FROM otps WHERE user_id IN ({id_list})'))
    conn.execute(text(f'DELETE FROM reports WHERE case_id IN (SELECT id FROM cases WHERE user_id IN ({id_list}))'))
    conn.execute(text(f'DELETE FROM cases WHERE user_id IN ({id_list})'))
    conn.execute(text(f'DELETE FROM users WHERE id IN ({id_list})'))
    conn.commit()
    print('Done!')
else:
    print('No users to delete.')

conn.close()