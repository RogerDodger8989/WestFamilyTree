import sqlite3
import xml.etree.ElementTree as ET
import os

DB_FILE = 'places_new.db'
XML_FILE = 'genney-platser.xml'

if os.path.exists(DB_FILE):
    os.remove(DB_FILE)
conn = sqlite3.connect(DB_FILE)
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

root = ET.parse(XML_FILE).getroot()
places = root.findall('.//place')
print(f"[DEBUG] Antal <place>-element i XML: {len(places)}")
imported = 0
for place in places:
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
    imported += 1
conn.commit()
conn.close()
print(f'[DEBUG] Import klar! {imported} platser importerade till {DB_FILE}')
