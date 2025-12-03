import sqlite3
import os

# Absolut path till rätt databas
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'official_places.db'))


# Visa alla rader för Blekinge (lanskod = 'K') och PlaceKind/församling
lanskod = 'K'


conn = sqlite3.connect(DB_PATH)
c = conn.cursor()


# Enkel version: visa antal och namn/kod för församlingar i Blekinge (lanskod=K, kommunkod K-1080)
kommunkod = 'K-1080'
c.execute('''
    SELECT sockenstadkod, sockenstadnamn FROM official_places
    WHERE kommunkod = ? AND sockenstadnamn IS NOT NULL AND sockenstadnamn != ''
    ORDER BY sockenstadnamn
''', (kommunkod,))
rows = c.fetchall()
print(f"Antal församlingar för kommunkod {kommunkod}: {len(rows)}")
for kod, namn in rows:
    print(f"{kod} | {namn}")
conn.close()
