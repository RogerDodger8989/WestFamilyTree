import sqlite3


class PlaceDatabaseManager:
    def __init__(self, db_path='places.db'):
        self.db_path = db_path

    def delete_place(self, place_id):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('DELETE FROM places WHERE id = ?', (place_id,))
        conn.commit()
        conn.close()

    def create_table(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS places (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                country TEXT,
                region TEXT,
                municipality TEXT,
                parish TEXT,
                village TEXT,
                specific TEXT,
                coordinates TEXT,
                note TEXT,
                matched_place_id INTEGER,
                hidden INTEGER DEFAULT 0
            )
        ''')
        conn.commit()
        conn.close()

    def hide_place(self, place_id):
        """Mark a place as hidden (used in official_places.db when user overrides a place)."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('UPDATE places SET hidden = 1 WHERE id = ?', (place_id,))
        conn.commit()
        conn.close()

    def copy_place_to_user_db(self, place_id, user_db_path):
        """Copy a place from this db to a user db (used when user edits an official place)."""
        place = self.get_place_by_id(place_id)
        if not place:
            return None
        user_db = PlaceDatabaseManager(user_db_path)
        user_db.create_table()
        # Remove id and hidden before insert
        place.pop('id', None)
        place.pop('hidden', None)
        return user_db.add_place(place)

    @staticmethod
    def get_merged_places(official_db_path, user_db_path):
        """Return merged list of places: user places + official places (not hidden)."""
        # Get user places
        user_db = PlaceDatabaseManager(user_db_path)
        user_places = user_db.get_all_places()
        # Get official places (not hidden)
        conn = sqlite3.connect(official_db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM places WHERE hidden = 0')
        official_places = [dict(row) for row in c.fetchall()]
        conn.close()
        # Merge: user places first, then official places not overridden
        user_place_names = set((p['name'], p.get('country'), p.get('region'), p.get('parish')) for p in user_places)
        merged = list(user_places)
        for op in official_places:
            key = (op['name'], op.get('country'), op.get('region'), op.get('parish'))
            if key not in user_place_names:
                merged.append(op)
        return merged
    def update_matched_place_id(self, place_id, matched_place_id):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('UPDATE places SET matched_place_id = ? WHERE id = ?', (matched_place_id, place_id))
        conn.commit()
        conn.close()
    def get_unmatched_places(self, person_event_data=None):
        import sys
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # Visa endast platser där matched_place_id är NULL eller tom sträng (inte 'user' eller annan markerad som användarskapad)
        c.execute("SELECT * FROM places WHERE matched_place_id IS NULL OR matched_place_id = ''")
        results = [dict(row) for row in c.fetchall()]
        conn.close()
        # Om person_event_data ges, lägg till kopplingar
        if person_event_data:
            print("[DEBUG] Alla platser (id, namn):", [(p['id'], p.get('name')) for p in results], file=sys.stderr)
            all_events = []
            for person in person_event_data:
                for event in person.get('events', []):
                    pid = event.get('placeId') or event.get('place_id')
                    all_events.append({
                        'personId': person.get('id'),
                        'personName': f"{person.get('firstName','')} {person.get('lastName','')}",
                        'eventId': event.get('id'),
                        'eventType': event.get('type'),
                        'eventDate': event.get('date',''),
                        'placeId': pid
                    })
            print("[DEBUG] Alla events med placeId:", [ (e['eventId'], e['placeId'], e['personName']) for e in all_events if e['placeId'] ], file=sys.stderr)
            place_id_to_links = {}
            for e in all_events:
                pid = e['placeId']
                if pid:
                    if pid not in place_id_to_links:
                        place_id_to_links[pid] = []
                    place_id_to_links[pid].append(e)
            for place in results:
                place['links'] = place_id_to_links.get(str(place['id']), []) + place_id_to_links.get(int(place['id']), [])
                place['linkCount'] = len(place['links'])
        return results

    def add_place(self, place):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            INSERT INTO places (name, country, region, municipality, parish, village, specific, coordinates, note, matched_place_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            place.get('name', ''),
            place.get('country', ''),
            place.get('region', ''),
            place.get('municipality', ''),
            place.get('parish', ''),
            place.get('village', ''),
            place.get('specific', ''),
            place.get('coordinates', ''),
            place.get('note', ''),
            place.get('matched_place_id', None)
        ))
        new_id = c.lastrowid
        conn.commit()
        conn.close()
        return new_id

    def get_place_by_id(self, place_id):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM places WHERE id = ?', (place_id,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None

    def get_all_places(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('SELECT * FROM places')
        results = [dict(row) for row in c.fetchall()]
        conn.close()
        return results
