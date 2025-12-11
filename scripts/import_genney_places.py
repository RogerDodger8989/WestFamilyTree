import sqlite3
import xml.etree.ElementTree as ET
import os

# Filnamn för ny databas
NEW_DB = 'places_imported.db'
XML_FILE = 'scripts/genney-platser.xml'

# Skapa ny databas
if os.path.exists(NEW_DB):
    os.remove(NEW_DB)
conn = sqlite3.connect(NEW_DB)
c = conn.cursor()
c.execute('''
CREATE TABLE places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    country TEXT,
    region TEXT,
    municipality TEXT,
    parish TEXT,
    village TEXT,
    specific TEXT,
    coordinates TEXT,
    note TEXT,
    matched_place_id TEXT
)
''')

# Läs och parsa XML
root = ET.parse(XML_FILE).getroot()
for place in root.findall('.//place'):
    name = place.findtext('placename') or ''
    country = place.findtext('country') or 'Sverige'
    region = place.findtext('region') or ''
    municipality = place.findtext('municipality') or ''
    parish = place.findtext('parish') or ''
    village = place.findtext('village') or ''
    specific = place.findtext('address') or ''
    coordinates = place.findtext('coordinates') or ''
    note = place.findtext('note') or ''
    matched_place_id = place.findtext('matched_place_id') or ''
    c.execute('''INSERT INTO places (name, country, region, municipality, parish, village, specific, coordinates, note, matched_place_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (name, country, region, municipality, parish, village, specific, coordinates, note, matched_place_id))
conn.commit()
conn.close()
print('Import klar! Databas: places_imported.db')
