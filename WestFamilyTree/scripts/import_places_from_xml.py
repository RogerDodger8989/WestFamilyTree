def ensure_table_exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS official_places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ortnamn TEXT,
            sockenstadnamn TEXT,
            sockenstadkod TEXT,
            kommunkod TEXT,
            kommunnamn TEXT,
            lanskod TEXT,
            lansnamn TEXT,
            detaljtyp TEXT,
            sprak TEXT,
            kvartsruta TEXT,
            nkoordinat INTEGER,
            ekoordinat INTEGER,
            lopnummer REAL,
            fid INTEGER,
            latitude REAL,
            longitude REAL
        )
    ''')
    conn.commit()
    conn.close()
def clear_official_places(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('DELETE FROM official_places')
    conn.commit()
    conn.close()

def build_hierarchy(places):
    # För varje plats, härled kommun/län via ParentId
    kommuner = []
    forsamlingar = []
    for place in places.values():
        parent = places.get(place['ParentId'])
        kommunnamn = ''
        kommunkod = ''
        lansnamn = ''
        lanskod = ''
        # Gå uppåt i hierarkin och hitta första plats där PlaceKind innehåller 'kommun' (case-insensitive)
        current = parent
        while current:
            pk = current.get('PlaceKind', '').lower()
            if 'kommun' in pk:
                if not kommunnamn:
                    kommunnamn = current.get('ShortName', '')
                if not kommunkod:
                    kommunkod = current.get('RSVCode', '')
            # Sätt lanskod om PlaceKind är EN eller TVÅ stora bokstäver (riktiga län)
            if (len(current.get('PlaceKind','')) in [1,2]) and current.get('PlaceKind','').isupper():
                lansnamn = current.get('ShortName','').replace(' län', '').replace(' Län', '')
                lanskod = current.get('PlaceKind','')
            current = places.get(current.get('ParentId'))
        # Om platsen själv är ett län, sätt lanskod och namn direkt
        if (len(place.get('PlaceKind','')) in [1,2]) and place.get('PlaceKind','').isupper():
            lanskod = place.get('PlaceKind','')
            lansnamn = place.get('ShortName','').replace(' län', '').replace(' Län', '')
        # Om platsen själv är kommun, sätt kommunnamn/kod direkt
        pk_self = place.get('PlaceKind','').lower()
        if 'kommun' in pk_self:
            kommunnamn = place.get('ShortName','')
            kommunkod = place.get('RSVCode','')
        place['kommunnamn'] = kommunnamn
        place['kommunkod'] = kommunkod
        place['lansnamn'] = lansnamn
        place['lanskod'] = lanskod
        # Sätt sockenstadnamn på plats-objektet om det är en församling/socken
        import re
        rsvcode = place.get('RSVCode', '')
        # Nytt villkor: PlaceKind = församling/socken/parish ELLER RSVCode matchar "K-XXXXX" eller "K-XXXXXX" (5 eller 6 siffror)
        is_forsamling = (
            pk_self in ['församling', 'socken', 'parish']
            or re.match(r'^[A-Z]{1,2}-\d{5,6}$', rsvcode)
        )
        # Debug: logga alla Blekinge-platser med RSVCode som börjar på K-
        if rsvcode.startswith('K-'):
            print(f"DEBUG: Blekinge RSVCode: PlaceId={place.get('PlaceId')} ShortName={place.get('ShortName')} RSVCode={rsvcode} PlaceKind={place.get('PlaceKind')}")
        if is_forsamling:
            place['sockenstadnamn'] = place.get('ShortName','')
            forsamlingar.append(place)
            # Debug: logga Blekinge-församlingar som identifieras
            if place.get('lanskod') == 'K':
                print(f"DEBUG: Blekinge-församling identifierad: PlaceId={place.get('PlaceId')} ShortName={place.get('ShortName')} RSVCode={rsvcode} PlaceKind={place.get('PlaceKind')}")
        else:
            place['sockenstadnamn'] = ''
        if 'kommun' in pk_self:
            kommuner.append(place)
        # DEBUG: Logga Blekinge-platser där sockenstadnamn INTE sätts men PlaceKind/RSVCode ser ut som församling
        if place.get('lanskod') == 'K' and is_forsamling and not place['sockenstadnamn']:
            print(f"DEBUG: Blekinge plats utan sockenstadnamn: PlaceId={place.get('PlaceId')} ShortName={place.get('ShortName')} PlaceKind={place.get('PlaceKind')} RSVCode={place.get('RSVCode')}")
    return places

def print_debug_examples(places):
    kommuner = [p for p in places.values() if p['PlaceKind'].lower() == 'kommun']
    # Identifiera församling/socken även om PlaceKind är tomt, om RSVCode är 5 tecken
    forsamlingar = [p for p in places.values() if p['PlaceKind'].lower() in ['församling', 'socken', 'parish'] or len(p.get('RSVCode', '')) == 5]
    print("\nExempel på kommuner (med härledda fält):")
    for p in kommuner[:10]:
        print(f"  {p['ShortName']} | kommunkod: {p['RSVCode']} | lanskod: {p['lanskod']} | lansnamn: {p['lansnamn']}")
    print("\nExempel på församlingar (med härledda fält):")
    for p in forsamlingar[:10]:
        print(f"  {p['ShortName']} | sockenstadkod: {p['RSVCode']} | kommunkod: {p['kommunkod']} | kommunnamn: {p['kommunnamn']} | lanskod: {p['lanskod']} | lansnamn: {p['lansnamn']}")

import sqlite3
import xml.etree.ElementTree as ET
import os
import glob


DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'official_places.db'))
ALT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'WestFamilyTree', 'official_places.db'))
if os.path.exists(ALT_PATH):
    DB_PATH = ALT_PATH
# Hitta alla .xml-filer i script-mappen (utom Places.xml om den finns)
SCRIPT_DIR = os.path.dirname(__file__)
xml_files = [f for f in glob.glob(os.path.join(SCRIPT_DIR, '*.xml'))]


def parse_places(xml_path):
    import re
    tree = ET.parse(xml_path)
    root = tree.getroot()
    # Mappning från filnamn till Disgen-länsbokstav
    filename = os.path.basename(xml_path).lower()
    county_map = {
        'blekinge.xml': 'K',
        'gävleborgs.xml': 'X',
        'gotlands.xml': 'I',
        'göteborg och bohus.xml': 'O',
        'hallands.xml': 'N',
        'jämtlands.xml': 'Z',
        'jönköpings.xml': 'F',
        'kalmar.xml': 'H',
        'kristianstads.xml': 'L',
        'kopparbergs.xml': 'W',
        'malmöhus.xml': 'M',
        'norrbottens.xml': 'BD',
        'skaraborgs.xml': 'R',
        'stockholms.xml': 'AB',
        'södermanlands.xml': 'D',
        'uppsala.xml': 'C',
        'värmlands.xml': 'S',
        'västerbottens.xml': 'AC',
        'västernorrlands.xml': 'Y',
        'västmanlands.xml': 'U',
        'älvsborgs.xml': 'P',
        'örebro.xml': 'T',
        'östergötlands.xml': 'E',
    }
    county_letter = county_map.get(filename)
    if not county_letter:
        # Fallback: försök hitta länsbokstav i filnamnet
        match = re.search(r'_([A-Z]{1,2})', filename, re.IGNORECASE)
        if match:
            county_letter = match.group(1).upper()
        else:
            match2 = re.search(r'([A-Z]{1,2})[^A-Z]*\.xml$', filename, re.IGNORECASE)
            if match2:
                county_letter = match2.group(1).upper()
            else:
                print(f"VARNING: Kunde inte hitta länsbokstav i filnamn: {filename}")
                county_letter = filename[:2].upper()
    places = {}
    for elem in root.findall('Place'):
        orig_placeid = elem.attrib.get('PlaceId')
        orig_parentid = elem.attrib.get('ParentId')
        orig_rsv = elem.findtext('RSVCode', default='')
        # Prefixa PlaceId och ParentId och RSVCode
        placeid = f"{county_letter}-{orig_placeid}" if orig_placeid else None
        parentid = f"{county_letter}-{orig_parentid}" if orig_parentid else None
        rsvcode = f"{county_letter}-{orig_rsv}" if orig_rsv else ''
        place = {
            'PlaceId': placeid,
            'ParentId': parentid,
            'ShortName': elem.findtext('ShortName', default=''),
            'FullName': elem.findtext('FullName', default=''),
            'RSVCode': rsvcode,
            'PlaceKind': elem.findtext('PlaceKind', default=''),
            'Latitude': elem.findtext('Latitude', default=''),
            'Longitude': elem.findtext('Longitude', default=''),
        }
        places[placeid] = place
    return places

def insert_places(db_path, places):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    for p in places.values():
        # Använd sockenstadnamn från plats-objektet (satt i build_hierarchy)
        sockenstadnamn = p.get('sockenstadnamn', '')
        # Debug: visa sockenstadnamn och RSVCode för alla platser med RSVCode på 5 tecken
        if len(p.get('RSVCode', '')) == 5:
            print(f"DEBUG: RSVCode={p['RSVCode']} sockenstadnamn='{sockenstadnamn}' ShortName='{p['ShortName']}'")
        # Fyll i alla kolumner i rätt ordning, använd None för de som inte används
        c.execute('''
            INSERT INTO official_places (
                ortnamn, sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn, detaljtyp, sprak, kvartsruta, nkoordinat, ekoordinat, lopnummer, fid, latitude, longitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            p['ShortName'],
            sockenstadnamn,
            p['RSVCode'],
            p['kommunkod'],
            p['kommunnamn'],
            p['lanskod'],
            p['lansnamn'],
            p['PlaceKind'],
            None,  # sprak
            None,  # kvartsruta
            None,  # nkoordinat
            None,  # ekoordinat
            None,  # lopnummer
            None,  # fid
            p['Latitude'],
            p['Longitude'],
        ))
    conn.commit()
    conn.close()
    # Extra debug: visa alla platser som borde vara län
    print("\nPlatser som identifieras som län (PlaceKind=2 stora bokstäver eller namn slutar på 'län'):")
    for p in places.values():
        if (len(p['PlaceKind']) == 2 and p['PlaceKind'].isupper()) or 'län' in p['ShortName'].lower():
            print(f"  ShortName: {p['ShortName']}, PlaceKind: {p['PlaceKind']}, RSVCode: {p['RSVCode']}")
    print(f'Importerar {len(places)} platser till official_places.db...')

# Flytta main() till modulnivå

def main():
    print(f'Använder databas: {DB_PATH}')
    print('Säkerställer att tabellen official_places finns...')
    ensure_table_exists(DB_PATH)
    print('Rensar official_places...')
    clear_official_places(DB_PATH)
    print('Söker efter alla XML-filer i script-mappen...')
    print(f'Hittade {len(xml_files)} XML-filer:')
    for f in xml_files:
        print('  ', os.path.basename(f))
    all_places = {}
    seen_kommuner = set()
    seen_lan = set()
    seen_placeids = set()
    seen_rsvcodes = set()
    for xml_path in xml_files:
        print(f'Läser in platser från {os.path.basename(xml_path)}...')
        places = parse_places(xml_path)
        print(f"  Antal platser i fil: {len(places)}")
        # Hämta länsbokstav för denna fil
        import re
        filename = os.path.basename(xml_path)
        match = re.search(r'_([A-Z]{1,2})', filename)
        if match:
            county_letter = match.group(1)
        else:
            match2 = re.search(r'([A-Z]{1,2})[^A-Z]*\.xml$', filename)
            if match2:
                county_letter = match2.group(1)
            else:
                county_letter = filename[:2]
        dubbletter = 0
        dubblett_rsv = 0
        for pid, p in places.items():
            # Filtrera kommuner: importera bara kommuner där PlaceId börjar med rätt länsbokstav
            if p['PlaceKind'].lower() == 'kommun':
                kommun_namn = p['ShortName'].strip().lower()
                if kommun_namn in seen_kommuner:
                    continue  # hoppa över dubblett
                seen_kommuner.add(kommun_namn)
            # Filtrera län: importera bara län där PlaceId börjar med rätt länsbokstav
            if (len(p['PlaceKind']) in [1,2]) and p['PlaceKind'].isupper():
                lan_namn = p['ShortName'].strip().lower()
                if lan_namn in seen_lan:
                    continue
                seen_lan.add(lan_namn)
            # Kontrollera dubblett PlaceId
            if pid in seen_placeids:
                print(f"  VARNING: PlaceId {pid} finns redan (dubblett mellan filer)!")
                dubbletter += 1
                continue
            # Kontrollera dubblett RSVCode
            rsv = p.get('RSVCode')
            if rsv and rsv in seen_rsvcodes:
                print(f"  VARNING: RSVCode {rsv} finns redan (dubblett mellan filer)!")
                dubblett_rsv += 1
                continue
            seen_placeids.add(pid)
            if rsv:
                seen_rsvcodes.add(rsv)
            all_places[pid] = p
        if dubbletter:
            print(f"  Totalt {dubbletter} dubbletter på PlaceId i denna fil!")
        if dubblett_rsv:
            print(f"  Totalt {dubblett_rsv} dubbletter på RSVCode i denna fil!")
    print(f'Totalt antal unika platser: {len(all_places)}')
    # Debug: Skriv ut PlaceId och ParentId för alla kommuner och församlingar i Blekinge
    print("\nDEBUG: Blekinge kommuner och församlingar (PlaceId, ParentId, ShortName, PlaceKind):")
    for p in all_places.values():
        if p.get('lanskod') == 'K':
            if p.get('PlaceKind', '').lower() == 'kommun' or (p.get('PlaceKind', '').lower() in ['församling', 'socken', 'parish'] or len(p.get('RSVCode', '')) == 5):
                print(f"  PlaceId: {p.get('PlaceId')}, ParentId: {p.get('ParentId')}, ShortName: {p.get('ShortName')}, PlaceKind: {p.get('PlaceKind')}")
    # Debug: Lista alla PlaceKind för platser med RSVCode på 5 tecken (troligen församlingar/socknar)
    rsv5_placekinds = set()
    rsv5_examples = []
    for p in all_places.values():
        if len(p.get('RSVCode', '')) == 5:
            rsv5_placekinds.add(p.get('PlaceKind', '').strip().lower())
            if len(rsv5_examples) < 20:
                rsv5_examples.append(p)
    print("\nUnika PlaceKind-värden för platser med RSVCode på 5 tecken (troligen församlingar/socknar):")
    for pk in sorted(rsv5_placekinds):
        print(f"  '{pk}'")
    print("\nExempel på platser med RSVCode på 5 tecken:")
    for p in rsv5_examples:
        print(f"  ShortName: {p['ShortName']} | RSVCode: {p['RSVCode']} | PlaceKind: {p['PlaceKind']}")
    print('Bygger hierarki och härleder kommun/län...')
    all_places = build_hierarchy(all_places)
    # Debug: räkna och visa exempel på platser med/utan kommun/län
    kommun_count = sum(1 for p in all_places.values() if p['kommunnamn'])
    lans_count = sum(1 for p in all_places.values() if p['lansnamn'])
    print(f"Platser med kommunnamn: {kommun_count} / {len(all_places)}")
    print(f"Platser med lansnamn: {lans_count} / {len(all_places)}")
    print("Exempel på platser med kommun/län:")
    for p in list(all_places.values())[:10]:
        print(f"  {p['ShortName']} | kommun: {p['kommunnamn']} | län: {p['lansnamn']} | lanskod: {p['lanskod']}")
    # Extra debug: visa exempel på kommuner och församlingar
    print_debug_examples(all_places)
    # Debug: Lista alla unika PlaceKind-värden
    placekind_set = set()
    for p in all_places.values():
        pk = p.get('PlaceKind', '').strip().lower()
        if pk:
            placekind_set.add(pk)
    print("\nUnika PlaceKind-värden i XML:")
    for pk in sorted(placekind_set):
        print(f"  '{pk}'")
    print(f'Importerar {len(all_places)} platser till official_places.db...')
    insert_places(DB_PATH, all_places)
    print('KLART!')

if __name__ == '__main__':
    main()
