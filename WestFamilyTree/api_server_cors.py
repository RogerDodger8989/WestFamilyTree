
from flask import Flask, request, jsonify

import re
import os
from flask_cors import CORS
from database_manager import DatabaseManager
from place_database_manager import PlaceDatabaseManager
from official_place_database import OfficialPlaceDatabase

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Standard: genealogy.db för personer, places.db för platser

db = DatabaseManager()
place_db = PlaceDatabaseManager()
place_db.create_table()
# Sätt absolut path till official_places.db i samma mapp som denna fil

# Pekar alltid på databas i WestFamilyTree/official_places.db
OFFICIAL_PLACES_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'official_places.db'))
ALT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'WestFamilyTree', 'official_places.db'))
if os.path.exists(ALT_PATH):
    OFFICIAL_PLACES_PATH = ALT_PATH

# Hämta alla kommuner (oberoende av län)
@app.route('/official_places/kommuner')
def get_all_kommuner():
    import sqlite3
    conn = sqlite3.connect(official_place_db.db_path)
    c = conn.cursor()
    c.execute('''
        SELECT DISTINCT kommunkod, kommunnamn FROM official_places
        WHERE kommunnamn IS NOT NULL AND kommunnamn != ''
        ORDER BY kommunnamn
    ''')
    result = [{'kommunkod': row[0], 'kommunnamn': row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify(result)

# Hämta alla församlingar (oberoende av kommun)
@app.route('/official_places/forsamlingar')
def get_all_forsamlingar():
    import sqlite3
    conn = sqlite3.connect(official_place_db.db_path)
    c = conn.cursor()
    c.execute('''
        SELECT DISTINCT sockenstadkod, sockenstadnamn FROM official_places
        WHERE sockenstadnamn IS NOT NULL AND sockenstadnamn != ''
        ORDER BY sockenstadnamn
    ''')
    result = [{'sockenstadkod': row[0], 'sockenstadnamn': row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify(result)

# Hämta alla orter (oberoende av församling)
@app.route('/official_places/orter')
def get_all_orter():
    import sqlite3
    conn = sqlite3.connect(official_place_db.db_path)
    c = conn.cursor()
    c.execute('''
        SELECT DISTINCT id, ortnamn FROM official_places
        WHERE ortnamn IS NOT NULL AND ortnamn != ''
        ORDER BY ortnamn
    ''')
    result = [{'id': row[0], 'ortnamn': row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify(result)
print(f"[DEBUG] Backend använder official_places.db på: {OFFICIAL_PLACES_PATH}")
official_place_db = OfficialPlaceDatabase(db_path=OFFICIAL_PLACES_PATH)

# --- Hierarkiska plats-API:er ---
# Hämta alla län
@app.route('/official_places/lan')
def get_all_lan():
    return jsonify(official_place_db.get_all_lan())

# Hämta alla kommuner för ett län
@app.route('/official_places/kommuner/<lanskod>')
def get_kommuner_for_lan(lanskod):
    return jsonify(official_place_db.get_kommuner_for_lan(lanskod))

# Hämta alla församlingar för en kommun
@app.route('/official_places/forsamlingar/<kommunkod>')
def get_forsamlingar_for_kommun(kommunkod):
    return jsonify(official_place_db.get_forsamlingar_for_kommun(kommunkod))

# Hämta alla orter för en församling (med kod)
@app.route('/official_places/orter/<sockenstadkod>')
def get_orter_for_forsamling(sockenstadkod):
    return jsonify(official_place_db.get_orter_for_forsamling(sockenstadkod))

# --- ROUTES ---


# GET /official_places/<id>
@app.route('/official_places/<int:place_id>', methods=['GET'])
def get_official_place(place_id):
    import sqlite3
    sqlite_conn = sqlite3.connect(official_place_db.db_path)
    sqlite_conn.row_factory = sqlite3.Row
    c = sqlite_conn.cursor()
    c.execute('SELECT * FROM official_places WHERE id = ?', (place_id,))
    row = c.fetchone()
    sqlite_conn.close()
    if row:
        return jsonify(dict(row))
    else:
        return jsonify({'error': 'Place not found'}), 404

@app.route('/official_places/<int:place_id>', methods=['PATCH'])
def update_official_place(place_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Missing data'}), 400
    try:
        updated = official_place_db.update_official_place(place_id, data)
        return jsonify(updated)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/official_places/<int:place_id>', methods=['DELETE'])
def delete_official_place(place_id):
    try:
        import sqlite3
        conn = sqlite3.connect(OFFICIAL_PLACES_PATH)
        c = conn.cursor()
        c.execute('DELETE FROM official_places WHERE id = ?', (place_id,))
        conn.commit()
        conn.close()
        return jsonify({'status': 'deleted', 'id': place_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Sök i officiell platsdatabas (autocomplete)
@app.route('/official_places/search')
def search_official_places():
    q = request.args.get('q', '')
    return jsonify(official_place_db.search_places(q))

# Hämta ALLA officiella platser (för register-träd)
@app.route('/official_places/all')
def get_all_official_places():
    return jsonify(official_place_db.get_all_places())

# Flytta ut full_tree till toppnivå
@app.route('/official_places/full_tree')
def get_full_tree():
    # Hämta alla platser som lista
    all_places = official_place_db.get_all_places() if hasattr(official_place_db, 'get_all_places') else []
    # Bygg ett enkelt träd: Sverige > län > kommun > socken/stad > ort
    tree = {}
    for place in all_places:
        lanskod = place.get('lanskod')
        lansnamn = place.get('lansnamn')
        kommunkod = place.get('kommunkod')
        kommunnamn = place.get('kommunnamn')
        sockenstadkod = place.get('sockenstadkod')
        sockenstadnamn = place.get('sockenstadnamn')
        ortnamn = place.get('ortnamn')
        # Filtrera bort poster med tomma/okända koder/namn
        if not lanskod or not lansnamn or lansnamn.lower().startswith('okänd'): continue
        if not kommunkod or not kommunnamn or kommunnamn.lower().startswith('okänd'): continue
        if not sockenstadkod or not sockenstadnamn or sockenstadnamn.lower().startswith('okänd'): continue
        if not ortnamn or ortnamn.lower().startswith('okänd'): continue
        # Bygg träd
        if lanskod not in tree:
            tree[lanskod] = {
                'lanskod': lanskod,
                'lansnamn': lansnamn,
                'children': {}
            }
        if kommunkod not in tree[lanskod]['children']:
            tree[lanskod]['children'][kommunkod] = {
                'kommunkod': kommunkod,
                'kommunnamn': kommunnamn,
                'children': {}
            }
        if sockenstadkod not in tree[lanskod]['children'][kommunkod]['children']:
            tree[lanskod]['children'][kommunkod]['children'][sockenstadkod] = {
                'sockenstadkod': sockenstadkod,
                'sockenstadnamn': sockenstadnamn,
                'children': []
            }
        # Undvik dubbletter av orter
        if not any(o['ortnamn'] == ortnamn for o in tree[lanskod]['children'][kommunkod]['children'][sockenstadkod]['children']):
            tree[lanskod]['children'][kommunkod]['children'][sockenstadkod]['children'].append({
                'id': place.get('id'),
                'ortnamn': ortnamn,
                'raw': place
            })
    # Konvertera till arraystruktur för frontend
    tree_array = [
        {
            'lanskod': lanskod,
            'lansnamn': node['lansnamn'],
            'children': [
                {
                    'kommunkod': kcode,
                    'kommunnamn': kdata['kommunnamn'],
                    'children': [
                        {
                            'sockenstadkod': skode,
                            'sockenstadnamn': sdata['sockenstadnamn'],
                            # 'kommunkod': kcode,  # kommunkod tas bort från församling
                            'children': sdata['children']
                        } for skode, sdata in kdata['children'].items()
                    ]
                } for kcode, kdata in node['children'].items()
            ]
        } for lanskod, node in tree.items()
    ]
    return jsonify({
        'list': all_places,
        'tree': tree_array
    })
    return jsonify(official_place_db.get_all_places())

# Skapa ny officiell plats
@app.route('/official_places', methods=['POST'])
def create_official_place():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    ptype = (data.get('type') or '').strip()
    if not name or not ptype:
        return jsonify({'error': 'Missing name or type'}), 400
    # Tillåt extra fält för hierarki
    lanskod = data.get('lanskod')
    lansnamn = data.get('lansnamn')
    kommunkod = data.get('kommunkod')
    kommunnamn = data.get('kommunnamn')
    sockenstadkod = data.get('sockenstadkod')
    sockenstadnamn = data.get('sockenstadnamn')
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    import sqlite3
    conn = sqlite3.connect(OFFICIAL_PLACES_PATH)
    c = conn.cursor()
    # Mappa typ till kolumnsättning
    # Village/Building/Cemetary: sätt ortnamn + överliggande kommun/län
    # Parish: sätt sockenstadnamn/kod + överliggande kommun/län
    # Municipality: sätt kommunnamn/kod + län
    # County: sätt lansnamn/kod
    cols = ['ortnamn','sockenstadnamn','sockenstadkod','kommunkod','kommunnamn','lanskod','lansnamn','detaljtyp','latitude','longitude','note']
    values = [None, None, None, None, None, None, None, ptype, latitude, longitude, data.get('note')]
    t = ptype.lower()
    if t in ['village','building','cemetary']:
        values[0] = name
    elif t == 'parish':
        values[1] = sockenstadnamn or name
        values[2] = sockenstadkod
    elif t == 'municipality':
        values[4] = kommunnamn or name
        values[3] = kommunkod
    elif t == 'county':
        values[6] = lansnamn or name
        values[5] = lanskod
    # Always set upper levels if provided
    if lanskod: values[5] = lanskod
    if lansnamn: values[6] = lansnamn
    if kommunkod: values[3] = kommunkod
    if kommunnamn: values[4] = kommunnamn
    if sockenstadkod: values[2] = sockenstadkod
    if sockenstadnamn: values[1] = sockenstadnamn

    c.execute(f'''
        INSERT INTO official_places ({','.join(cols)})
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ''', values)
    new_id = c.lastrowid
    conn.commit()
    # Returnera skapad rad
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute('SELECT * FROM official_places WHERE id = ?', (new_id,))
    row = cur.fetchone()
    conn.close()
    return jsonify(dict(row)), 201

@app.route('/places/unmatched')
def get_unmatched_places():
    # Hämta alla personer (med events) från genealogy.db
    try:
        all_people = db.get_all_people_with_events() if hasattr(db, 'get_all_people_with_events') else []
    except Exception as e:
        print(f"[BACKEND] Kunde inte hämta personer/events: {e}")
        all_people = []
    return jsonify(place_db.get_unmatched_places(person_event_data=all_people))

@app.route('/place/<int:place_id>/match', methods=['PATCH'])
def update_matched_place(place_id):
    data = request.get_json()
    matched_place_id = data.get('matched_place_id')
    if matched_place_id is None:
        return jsonify({'error': 'Missing matched_place_id'}), 400
    place_db.update_matched_place_id(place_id, matched_place_id)
    return jsonify({'status': 'ok'})


# --- Platssträngsparser enligt svensk/amerikansk logik ---
def parse_place_string(plac_string):
    if not plac_string or not isinstance(plac_string, str):
        return {}
    parts = [p.strip() for p in plac_string.split(',') if p.strip()]
    if not parts:
        return {}
    country = parts[-1].lower()
    sweden_keywords = ['sverige', 'sweden', 'swe']
    usa_keywords = ['usa', 'united states', 'amerika', 'america']
    sweden_lan_suffix = 'län'
    us_state_regex = re.compile(r'^[A-Z]{2}$')
    result = {}
    # Landstyp
    if country in sweden_keywords:
        result['type'] = 'sweden'
    elif country in usa_keywords:
        result['type'] = 'usa'
    elif country.endswith(sweden_lan_suffix):
        result['type'] = 'sweden'
    elif us_state_regex.match(parts[-1]):
        result['type'] = 'usa'
    # Fältmappning
    if result.get('type') == 'sweden':
        # Gård/Torp, By, Socken, Län, Land
        result['country'] = parts[-1] if len(parts) > 0 else ''
        result['region'] = parts[-2] if len(parts) > 1 else ''
        result['parish'] = parts[-3] if len(parts) > 2 else ''
        result['village'] = parts[-4] if len(parts) > 3 else ''
        result['specific'] = parts[-5] if len(parts) > 4 else ''
    elif result.get('type') == 'usa':
        # Stad, County, Stat, Land
        result['country'] = parts[-1] if len(parts) > 0 else ''
        result['region'] = parts[-2] if len(parts) > 1 else ''
        result['municipality'] = parts[-3] if len(parts) > 2 else ''
        result['village'] = parts[-4] if len(parts) > 3 else ''
        result['specific'] = parts[-5] if len(parts) > 4 else ''
    return result

@app.route('/place', methods=['POST'])
def add_place():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Missing name'}), 400
    # Om någon nivå saknas, försök parsa från name/plac
    parsed = parse_place_string(data.get('name', ''))
    # Fyll i nivåer om de saknas
    for key in ['country', 'region', 'municipality', 'parish', 'village', 'specific']:
        if not data.get(key):
            if key in parsed:
                data[key] = parsed[key]

    import difflib
    import sys
    def is_full_match(official, incoming):
        for key in ['country', 'region', 'municipality', 'parish', 'village', 'specific']:
            v1 = (official.get(key) or '').strip().lower()
            v2 = (incoming.get(key) or '').strip().lower()
            if v2 and v1 != v2:
                return False
        return True

    def fuzzy_match(official, incoming):
        # Matcha på ortnamn + region/län, case-insensitive, tillåt små stavfel
        ort1 = (official.get('ortnamn') or '').strip().lower()
        ort2 = (incoming.get('village') or incoming.get('parish') or incoming.get('name') or '').strip().lower()
        lan1 = (official.get('lansnamn') or '').strip().lower()
        lan2 = (incoming.get('region') or '').strip().lower()
        # Exakt eller nära match på ortnamn
        ort_match = ort1 and ort2 and (ort1 == ort2 or difflib.SequenceMatcher(None, ort1, ort2).ratio() > 0.85)
        lan_match = not lan1 or not lan2 or lan1 == lan2
        return ort_match and lan_match

    match_id = None
    match_reason = ""
    try:
        candidates = official_place_db.search_places(data.get('name', ''))
        if candidates:
            for cand in candidates:
                if is_full_match(cand, data):
                    match_id = cand.get('id')
                    match_reason = "EXACT"
                    break
            if not match_id:
                # Fuzzy fallback
                for cand in candidates:
                    if fuzzy_match(cand, data):
                        match_id = cand.get('id')
                        match_reason = "FUZZY"
                        break
    except Exception as e:
        print(f"[BACKEND] OFFICIAL PLACE MATCH ERROR: {e}", file=sys.stderr)
        candidates = []
        match_id = None
    if match_id:
        data['matched_place_id'] = match_id
        print(f"[BACKEND] Plats '{data.get('name')}' MATCHAD ({match_reason}) med officiell plats {match_id}", file=sys.stderr)
    else:
        if 'matched_place_id' not in data or data['matched_place_id'] in [None, '', 'null']:
            data['matched_place_id'] = None
        print(f"[BACKEND] Plats '{data.get('name')}' OMATCHAD (ingen officiell plats eller fel, matched_place_id={data.get('matched_place_id')})", file=sys.stderr)
    new_id = place_db.add_place(data)
    # Hämta platsen med id (inklusive matched_place_id)
    new_place = place_db.get_place_by_id(new_id)
    # Säkerställ att matched_place_id alltid finns i svaret (även om None)
    if 'matched_place_id' not in new_place:
        new_place['matched_place_id'] = None
    return jsonify(new_place)

@app.route('/places')
def get_places():
    return jsonify(place_db.get_all_places())

@app.route('/search')
def search():
    q = request.args.get('q', '')
    return jsonify(db.search_person(q))

@app.route('/person/<id>')
def person(id):
    return jsonify(db.get_person(id))

@app.route('/parents/<id>')
def parents(id):
    father, mother = db.get_parents(id)
    return jsonify({'father': father, 'mother': mother})

@app.route('/place/<int:place_id>', methods=['DELETE'])
def delete_place(place_id):
    try:
        place_db.delete_place(place_id)
        return jsonify({'status': 'deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Import platser från XML (Genney-format)
@app.route('/official_places/import_xml', methods=['POST'])
def import_xml_places():
    try:
        data = request.get_json()
        places = data.get('places', [])
        
        if not places:
            return jsonify({'error': 'Inga platser att importera'}), 400
        
        # Skapa en dictionary för att bygga hierarki
        place_map = {}
        for place in places:
            place_map[place['id']] = place
        
        # Bygg hierarki och härled län/kommun
        for place in places:
            parent_id = place.get('parentid')
            parent = place_map.get(parent_id) if parent_id else None
            
            # Härled län och kommun från parent-hierarkin
            lanskod = ''
            lansnamn = ''
            kommunkod = ''
            kommunnamn = ''
            
            current = parent
            while current:
                place_type = current.get('type', '').lower()
                
                # Hitta län
                if place_type in ['county', 'landscape'] and not lanskod:
                    lansnamn = current.get('name', '')
                    # Försök hitta länskod (t.ex. "AB", "K", etc.)
                    abbrev = current.get('abbreviation', '')
                    if abbrev:
                        lanskod = abbrev
                
                # Hitta kommun
                if place_type == 'municipality' and not kommunkod:
                    kommunnamn = current.get('name', '')
                    kommunkod = current.get('id', '')
                
                # Gå till nästa parent
                parent_id = current.get('parentid')
                current = place_map.get(parent_id) if parent_id else None
            
            # Spara i official_places
            import sqlite3
            conn = sqlite3.connect(OFFICIAL_PLACES_PATH)
            c = conn.cursor()
            
            place_type = place.get('type', '').lower()
            
            # Bestäm vilka fält som ska sparas beroende på typ
            if place_type == 'parish':
                c.execute('''
                    INSERT OR REPLACE INTO official_places 
                    (ortnamn, sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn, detaljtyp, latitude, longitude)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    None,
                    place.get('name', ''),
                    place.get('id', ''),
                    kommunkod,
                    kommunnamn,
                    lanskod,
                    lansnamn,
                    place.get('type', ''),
                    place.get('latitude'),
                    place.get('longitude')
                ))
            elif place_type == 'municipality':
                c.execute('''
                    INSERT OR REPLACE INTO official_places 
                    (ortnamn, sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn, detaljtyp, latitude, longitude)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    None,
                    None,
                    None,
                    place.get('id', ''),
                    place.get('name', ''),
                    lanskod,
                    lansnamn,
                    place.get('type', ''),
                    place.get('latitude'),
                    place.get('longitude')
                ))
            elif place_type in ['village', 'building', 'cemetary']:
                c.execute('''
                    INSERT OR REPLACE INTO official_places 
                    (ortnamn, sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn, detaljtyp, latitude, longitude)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    place.get('name', ''),
                    None,
                    None,
                    kommunkod,
                    kommunnamn,
                    lanskod,
                    lansnamn,
                    place.get('type', ''),
                    place.get('latitude'),
                    place.get('longitude')
                ))
            
            conn.commit()
            conn.close()
        
        return jsonify({'status': 'success', 'imported': len(places)})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5005)
