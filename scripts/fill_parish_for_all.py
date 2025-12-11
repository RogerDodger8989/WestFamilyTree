import sqlite3
import re

conn = sqlite3.connect('places.db')
c = conn.cursor()

# Hämta alla platser där parish saknas
c.execute("SELECT id, name, village, parish FROM places WHERE parish IS NULL OR parish = ''")
rows = c.fetchall()

updated = 0
for row in rows:
    id, name, village, parish = row
    # Försök hitta församling i name eller village
    # Exempel: "Grönegatan 16, Tomelilla, Kristianstads län" => "Tomelilla" som parish
    parish_guess = None
    if village:
        parish_guess = village
    else:
        # Försök hitta ort/by i name
        match = re.search(r',\s*([^,]+),', name)
        if match:
            parish_guess = match.group(1).strip()
    if parish_guess:
        c.execute("UPDATE places SET parish = ? WHERE id = ?", (parish_guess, id))
        updated += 1

conn.commit()
print(f"Uppdaterade {updated} platser med parish!")
conn.close()
