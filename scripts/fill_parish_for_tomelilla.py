import sqlite3

# Fyll i församling (parish) för alla platser där det saknas, baserat på namn och mönster
conn = sqlite3.connect('places.db')
c = conn.cursor()

# Exempel: Sätt parish till 'Tomelilla' för alla platser med 'Tomelilla' i name eller municipality
c.execute("UPDATE places SET parish = 'Tomelilla' WHERE (name LIKE '%Tomelilla%' OR municipality LIKE '%Tomelilla%') AND (parish IS NULL OR parish = '')")
conn.commit()

# Visa resultat
c.execute("SELECT id, name, municipality, parish FROM places WHERE name LIKE '%Tomelilla%' OR municipality LIKE '%Tomelilla%'")
for row in c.fetchall():
    print(row)
conn.close()
print('Klar!')
