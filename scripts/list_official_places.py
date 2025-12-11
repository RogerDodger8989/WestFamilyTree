
import sqlite3
import os
import argparse

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'official_places.db'))

def list_places_by_lan(lanskod):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Hämta alla platser i länet (lanskod matchar lanskod-kolumnen)
    c.execute('''SELECT id, ortnamn, sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn FROM official_places WHERE lanskod = ? ORDER BY kommunkod, kommunnamn, sockenstadkod, ortnamn''', (lanskod,))
    rows = c.fetchall()
    print(f"Alla platser i län '{lanskod}': (id, ortnamn, sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn)")
    print(f"{'id':<6} {'ortnamn':<25} {'sockenstadnamn':<25} {'sockenstadkod':<10} {'kommunkod':<10} {'kommunnamn':<20} {'lanskod':<8} {'lansnamn':<15}")
    print("-"*120)
    for row in rows:
        print(f"{str(row[0]):<6} {str(row[1]):<25} {str(row[2]):<25} {str(row[3]):<10} {str(row[4]):<10} {str(row[5]):<20} {str(row[6]):<8} {str(row[7]):<15}")
    print(f"\nAntal platser i län '{lanskod}': {len(rows)}")
    conn.close()

def main():
    parser = argparse.ArgumentParser(description='Lista platser i official_places.db')
    parser.add_argument('--lan', type=str, help='Länsbokstav, t.ex. K för Blekinge')
    args = parser.parse_args()
    # Felsök: skriv ut kolumnnamn
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('PRAGMA table_info(official_places)')
    columns = [info[1] for info in c.fetchall()]
    print('Kolumner i official_places:', columns)
    conn.close()
    if args.lan:
        list_places_by_lan(args.lan)
    else:
        print('Ange --lan <länsbokstav>, t.ex. --lan K')

if __name__ == '__main__':
    main()
