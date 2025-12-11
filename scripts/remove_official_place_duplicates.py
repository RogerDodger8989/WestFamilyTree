# Script för att rensa dubbletter ur official_places.db
# Dubblett = samma ortnamn, sockenstadnamn, kommunnamn, lansnamn
# Behåller den med lägst id

import sqlite3

def remove_duplicates(db_path='official_places.db'):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # Hitta dubbletter (alla utom minsta id)
    c.execute('''
        DELETE FROM official_places
        WHERE id NOT IN (
            SELECT MIN(id) FROM official_places
            GROUP BY ortnamn, sockenstadnamn, kommunnamn, lansnamn
        )
    ''')
    conn.commit()
    print('Dubbletter borttagna!')
    conn.close()

if __name__ == '__main__':
    remove_duplicates()
