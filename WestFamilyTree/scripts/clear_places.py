import sqlite3

# Rensar alla poster i tabellen 'places' (slask/egna platser)
import os
def clear_places(db_path=None):
    if db_path is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, '..', 'places.db')
        db_path = os.path.abspath(db_path)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('DELETE FROM places')
    conn.commit()
    conn.close()
    print('Alla platser i places.db har raderats.')

if __name__ == '__main__':
    clear_places()