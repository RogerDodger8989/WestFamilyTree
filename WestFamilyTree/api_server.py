

from flask import Flask, request, jsonify
from database_manager import DatabaseManager
from official_place_database import OfficialPlaceDatabase

app = Flask(__name__)
db = DatabaseManager()
official_place_db = OfficialPlaceDatabase()

@app.route('/search')
def search():
    q = request.args.get('q', '')
    return jsonify(db.search_person(q))

@app.route('/person/<id>')
def person(id):
    return jsonify(db.get_person(id))

@app.route('/parents/<id>')
def parents(id):
    father, mother = db.get_parents(id)
    return jsonify({'father': father, 'mother': mother})


# GET /official_places/<id>
@app.route('/official_places/<int:place_id>', methods=['GET'])
def get_official_place(place_id):
    conn = official_place_db.db_path
    import sqlite3
    sqlite_conn = sqlite3.connect(conn)
    sqlite_conn.row_factory = sqlite3.Row
    c = sqlite_conn.cursor()
    c.execute('SELECT * FROM official_places WHERE id = ?', (place_id,))
    row = c.fetchone()
    sqlite_conn.close()
    if row:
        return jsonify(dict(row))
    else:
        return jsonify({'error': 'Place not found'}), 404

if __name__ == '__main__':
    app.run(port=5005)