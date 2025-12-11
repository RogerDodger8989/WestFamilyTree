import sqlite3
import json

class DatabaseManager:
    def get_all_people_with_events(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, full_data FROM individuals")
        people = []
        for row in c.fetchall():
            try:
                data = json.loads(row['full_data'])
                # Sätt id om det saknas
                if 'id' not in data:
                    data['id'] = row['id']
                people.append(data)
            except Exception as e:
                continue
        conn.close()
        return people

    def __init__(self, db_path='genealogy.db'):
        self.db_path = db_path

    def search_person(self, query):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, name, birth_date FROM individuals WHERE name LIKE ? LIMIT 50", (f'%{query}%',))
        results = [dict(row) for row in c.fetchall()]
        print(f"DEBUG: Sökning på '{query}' gav:", results)
        conn.close()
        return results

    def get_person(self, id):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT full_data FROM individuals WHERE id = ?", (id,))
        row = c.fetchone()
        conn.close()
        return json.loads(row['full_data']) if row else None

    def get_parents(self, id):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT father_id, mother_id FROM individuals WHERE id = ?", (id,))
        row = c.fetchone()
        conn.close()
        if not row:
            return None, None
        father = self.get_person(row['father_id']) if row['father_id'] else None
        mother = self.get_person(row['mother_id']) if row['mother_id'] else None
        return father, mother