import sqlite3
import json

def create_db(db_path='genealogy.db'):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # Skapa tabeller
    c.execute('''
        CREATE TABLE IF NOT EXISTS individuals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            birth_date TEXT,
            full_data TEXT,
            father_id INTEGER,
            mother_id INTEGER
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS relationships (
            child_id INTEGER,
            parent_id INTEGER,
            type TEXT
        )
    ''')
    conn.commit()

    # Exempelpersoner
    anna = {
        'name': 'Anna Andersson',
        'birth_date': '1900-01-01',
        'other': 'Testperson',
    }
    bertil = {
        'name': 'Bertil Bengtsson',
        'birth_date': '1890-05-12',
        'other': 'Testperson',
    }
    # Lägg in Bertil först
    c.execute("INSERT INTO individuals (name, birth_date, full_data) VALUES (?, ?, ?)",
              (bertil['name'], bertil['birth_date'], json.dumps(bertil)))
    bertil_id = c.lastrowid
    # Lägg in Anna och koppla till Bertil som far
    c.execute("INSERT INTO individuals (name, birth_date, full_data, father_id) VALUES (?, ?, ?, ?)",
              (anna['name'], anna['birth_date'], json.dumps(anna), bertil_id))
    anna_id = c.lastrowid
    # Lägg till relationship
    c.execute("INSERT INTO relationships (child_id, parent_id, type) VALUES (?, ?, ?)",
              (anna_id, bertil_id, 'father'))
    conn.commit()
    conn.close()
    print(f"Skapade {db_path} med testdata!")

if __name__ == '__main__':
    create_db()
