
import sqlite3


class OfficialPlaceDatabase:
    def __init__(self, db_path='official_places.db'):
        self.db_path = db_path
        self._ensure_table_exists()

    def search_places(self, query):
        # Enkel sökning: returnera alla platser där ortnamn, kommunnamn eller lansnamn matchar query (case-insensitive)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        q = f"%{query.strip().lower()}%"
        c.execute('''
            SELECT * FROM places
            WHERE LOWER(name) LIKE ? OR LOWER(municipality) LIKE ? OR LOWER(country) LIKE ? OR LOWER(parish) LIKE ?
        ''', (q, q, q, q))
        results = []
        for row in c.fetchall():
            place = dict(row)
            # Sätt typ baserat på fält
            if place.get('village'):
                place['type'] = 'Village'
            elif place.get('municipality'):
                place['type'] = 'Municipality'
            elif place.get('parish'):
                place['type'] = 'Parish'
            elif place.get('region'):
                place['type'] = 'County'
            elif place.get('country'):
                place['type'] = 'Country'
            else:
                place['type'] = 'Unknown'
            results.append(place)
        conn.close()
        return results

    def _ensure_table_exists(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS places (
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
        conn.commit()
        # Säkerställ att kolumnen note finns även i befintlig DB
        try:
            info = c.execute('PRAGMA table_info(places)').fetchall()
            cols = [row[1] for row in info]
            if 'note' not in cols:
                c.execute('ALTER TABLE places ADD COLUMN note TEXT')
                conn.commit()
        except Exception:
            pass
        conn.close()

    def get_all_lan(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT DISTINCT country, region FROM places
            WHERE country IS NOT NULL AND country != ''
            ORDER BY country
        ''')
        result = [{'country': row[0], 'region': row[1]} for row in c.fetchall()]
        conn.close()
        return result

    def get_kommuner_for_lan(self, lanskod):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT DISTINCT municipality FROM places
            WHERE country = ? AND municipality IS NOT NULL AND municipality != ''
            ORDER BY municipality
        ''', (lanskod,))
        result = [{'municipality': row[0]} for row in c.fetchall()]
        conn.close()
        return result

    def get_forsamlingar_for_kommun(self, kommunkod):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT DISTINCT parish FROM places
            WHERE municipality = ? AND parish IS NOT NULL AND parish != ''
            ORDER BY parish
        ''', (kommunkod,))
        result = [{'parish': row[0]} for row in c.fetchall()]
        conn.close()
        return result

    def get_orter_for_forsamling(self, sockenstadkod):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT id, name FROM places
            WHERE parish = ? AND name IS NOT NULL AND name != ''
            ORDER BY name
        ''', (sockenstadkod,))
        result = [{'id': row[0], 'name': row[1]} for row in c.fetchall()]
        conn.close()
        return result

    def update_official_place(self, place_id, data):
        allowed = [
            'name', 'country', 'region', 'municipality', 'parish', 'village', 'specific', 'coordinates', 'note', 'matched_place_id'
        ]
        fields = []
        values = []
        for key in allowed:
            if key in data:
                fields.append(f"{key} = ?")
                values.append(data[key])
        if not fields:
            raise Exception('No valid fields to update')
        values.append(place_id)
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute(f"UPDATE places SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        c.execute('SELECT * FROM places WHERE id = ?', (place_id,))
        row = c.fetchone()
        conn.close()
        if row:
            return dict(zip([col[0] for col in c.description], row))
        else:
            raise Exception('Place not found after update')

    def get_all_places(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # Anpassa SELECT till alla kolumner i official_places
        c.execute('SELECT * FROM official_places')
        results = []
        for row in c.fetchall():
            d = dict(row)
            # Sätt defaultvärden och unika id:n för frontendens trädlogik
            d['region'] = d.get('lansnamn') or 'Okänt län'
            d['municipality'] = d.get('kommunnamn') or 'Okänd kommun'
            d['parish'] = d.get('sockenstadnamn') or 'Okänd församling'
            d['village'] = d.get('ortnamn') or 'Okänd ort'
            # Unika id:n för varje nivå (använd kod eller namn eller id)
            d['region_id'] = d.get('lanskod') or d['region'] or str(d.get('id'))
            d['municipality_id'] = d.get('kommunkod') or d['municipality'] or str(d.get('id'))
            d['parish_id'] = d.get('sockenstadkod') or d['parish'] or str(d.get('id'))
            d['village_id'] = d.get('id')
            results.append(d)
        conn.close()
        return results

