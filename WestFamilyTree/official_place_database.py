
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
            SELECT * FROM official_places
            WHERE LOWER(ortnamn) LIKE ? OR LOWER(kommunnamn) LIKE ? OR LOWER(lansnamn) LIKE ? OR LOWER(sockenstadnamn) LIKE ?
        ''', (q, q, q, q))
        results = [dict(row) for row in c.fetchall()]
        conn.close()
        return results

    def _ensure_table_exists(self):
        conn = sqlite3.connect(self.db_path)
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
                longitude REAL,
                note TEXT
            )
        ''')
        conn.commit()
        # Säkerställ att kolumnen note finns även i befintlig DB
        try:
            info = c.execute('PRAGMA table_info(official_places)').fetchall()
            cols = [row[1] for row in info]
            if 'note' not in cols:
                c.execute('ALTER TABLE official_places ADD COLUMN note TEXT')
                conn.commit()
        except Exception:
            pass
        conn.close()

    def get_all_lan(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT DISTINCT lanskod, lansnamn FROM official_places
            WHERE lansnamn IS NOT NULL AND lansnamn != ''
            ORDER BY lansnamn
        ''')
        result = [{'lanskod': row[0], 'lansnamn': row[1]} for row in c.fetchall()]
        conn.close()
        return result

    def get_kommuner_for_lan(self, lanskod):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT DISTINCT kommunkod, kommunnamn FROM official_places
            WHERE lanskod = ? AND kommunnamn IS NOT NULL AND kommunnamn != ''
            ORDER BY kommunnamn
        ''', (lanskod,))
        result = [{'kommunkod': row[0], 'kommunnamn': row[1]} for row in c.fetchall()]
        conn.close()
        return result

    def get_forsamlingar_for_kommun(self, kommunkod):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT DISTINCT sockenstadkod, sockenstadnamn FROM official_places
            WHERE kommunkod = ? AND sockenstadnamn IS NOT NULL AND sockenstadnamn != ''
            ORDER BY sockenstadnamn
        ''', (kommunkod,))
        result = [{'sockenstadkod': row[0], 'sockenstadnamn': row[1]} for row in c.fetchall()]
        conn.close()
        return result

    def get_orter_for_forsamling(self, sockenstadkod):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT id, ortnamn FROM official_places
            WHERE sockenstadkod = ? AND ortnamn IS NOT NULL AND ortnamn != ''
            ORDER BY ortnamn
        ''', (sockenstadkod,))
        result = [{'id': row[0], 'ortnamn': row[1]} for row in c.fetchall()]
        conn.close()
        return result

    def update_official_place(self, place_id, data):
        allowed = [
            'ortnamn', 'sockenstadnamn', 'sockenstadkod', 'kommunkod', 'kommunnamn',
            'lanskod', 'lansnamn', 'detaljtyp', 'sprak', 'kvartsruta',
            'nkoordinat', 'ekoordinat', 'lopnummer', 'fid', 'latitude', 'longitude'
        ]
        # Tillåt uppdatering av notering
        if 'note' in data:
            allowed.append('note')
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
        c.execute(f"UPDATE official_places SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        c.execute('SELECT * FROM official_places WHERE id = ?', (place_id,))
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
        results = [dict(row) for row in c.fetchall()]
        conn.close()
        return results

