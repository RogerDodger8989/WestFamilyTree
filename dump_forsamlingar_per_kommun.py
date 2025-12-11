import sqlite3

# Dumpa alla församlingar med kommunkod och kommunnamn
conn = sqlite3.connect('official_places.db')
c = conn.cursor()
c.execute('''
    SELECT sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn
    FROM official_places
    WHERE sockenstadnamn IS NOT NULL AND sockenstadnamn != ''
    ORDER BY kommunnamn, sockenstadnamn
''')
rows = c.fetchall()
print(f"{'sockenstadnamn':30} {'sockenstadkod':12} {'kommunkod':10} {'kommunnamn':20} {'lanskod':4} {'lansnamn'}")
for row in rows:
    print(f"{row[0]:30} {row[1]:12} {row[2]:10} {row[3]:20} {row[4]:4} {row[5]}")
print(f"\nAntal församlingar: {len(rows)}")
conn.close()
