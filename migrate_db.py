import json
import sqlite3

# Läs in JSON-data
with open('data.json', 'r', encoding='utf-8') as f:
    individuals = json.load(f)

# Skapa SQLite-databas och tabell
conn = sqlite3.connect('genealogy.db')
c = conn.cursor()
c.execute('''
CREATE TABLE IF NOT EXISTS individuals (
    id TEXT PRIMARY KEY,
    name TEXT,
    birth_date TEXT,
    father_id TEXT,
    mother_id TEXT,
    full_data TEXT
)
''')
c.execute('CREATE INDEX IF NOT EXISTS idx_name ON individuals(name)')
c.execute('CREATE INDEX IF NOT EXISTS idx_father_id ON individuals(father_id)')
c.execute('CREATE INDEX IF NOT EXISTS idx_mother_id ON individuals(mother_id)')

# Lägg in poster
for person in individuals:
    c.execute('''
        INSERT OR REPLACE INTO individuals (id, name, birth_date, father_id, mother_id, full_data)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        person.get('id'),
        person.get('name'),
        person.get('birth_date'),
        person.get('father_id'),
        person.get('mother_id'),
        json.dumps(person, ensure_ascii=False)
    ))
conn.commit()
conn.close()
print('Migration klar: data.json → genealogy.db')