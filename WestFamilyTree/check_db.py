import sqlite3
conn = sqlite3.connect('genealogy.db')
c = conn.cursor()
for row in c.execute("SELECT id, name, birth_date FROM individuals"):
    print(row)
conn.close()