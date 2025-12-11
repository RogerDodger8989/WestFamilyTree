import sqlite3

conn = sqlite3.connect('genealogy.db')
c = conn.cursor()

# Ta bort alla gamla personer
c.execute('DELETE FROM individuals')
conn.commit()

# Lägg in testpersoner
people = [
    ('Anna Andersson', '1900-01-01'),
    ('Bertil Bengtsson', '1890-05-12'),
    ('Clara Svensson', '1872-09-30'),
]
for name, birth_date in people:
    c.execute("INSERT INTO individuals (name, birth_date, full_data) VALUES (?, ?, ?)", (name, birth_date, '{"name": "%s", "birth_date": "%s"}' % (name, birth_date)))

conn.commit()
conn.close()
print('Databasen är nu återställd med testpersoner!')
