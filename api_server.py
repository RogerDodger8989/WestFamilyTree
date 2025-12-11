

from flask import Flask, request, jsonify
from database_manager import DatabaseManager
from official_place_database import OfficialPlaceDatabase
from exif_manager import ExifManager

app = Flask(__name__)
db = DatabaseManager()
official_place_db = OfficialPlaceDatabase()
exif_manager = ExifManager()

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


# ============================================
# EXIF ENDPOINTS
# ============================================

@app.route('/exif/read', methods=['POST'])
def read_exif():
    """
    Läs EXIF-data från en bild
    Body: { "image_path": "/path/to/image.jpg" }
    """
    data = request.get_json()
    image_path = data.get('image_path')
    
    if not image_path:
        return jsonify({'error': 'image_path required'}), 400
    
    exif_data = exif_manager.read_exif(image_path)
    return jsonify(exif_data)


@app.route('/exif/write_keywords', methods=['POST'])
def write_keywords():
    """
    Skriv keywords till en bild
    Body: { 
        "image_path": "/path/to/image.jpg",
        "keywords": ["keyword1", "keyword2"],
        "backup": true 
    }
    """
    data = request.get_json()
    image_path = data.get('image_path')
    keywords = data.get('keywords', [])
    backup = data.get('backup', True)
    
    if not image_path:
        return jsonify({'error': 'image_path required'}), 400
    
    success = exif_manager.write_keywords(image_path, keywords, backup)
    return jsonify({'success': success})


@app.route('/exif/write_face_tags', methods=['POST'])
def write_face_tags():
    """
    Skriv face tags till en bild
    Body: { 
        "image_path": "/path/to/image.jpg",
        "face_tags": [
            {"name": "Person Name", "x": 40, "y": 30, "width": 20, "height": 20}
        ],
        "backup": true 
    }
    """
    data = request.get_json()
    image_path = data.get('image_path')
    face_tags = data.get('face_tags', [])
    backup = data.get('backup', True)
    
    if not image_path:
        return jsonify({'error': 'image_path required'}), 400
    
    success = exif_manager.write_face_tags(image_path, face_tags, backup)
    return jsonify({'success': success})


@app.route('/exif/remove_metadata', methods=['POST'])
def remove_metadata():
    """
    Ta bort all metadata från en bild
    Body: { 
        "image_path": "/path/to/image.jpg",
        "backup": true 
    }
    """
    data = request.get_json()
    image_path = data.get('image_path')
    backup = data.get('backup', True)
    
    if not image_path:
        return jsonify({'error': 'image_path required'}), 400
    
    success = exif_manager.remove_all_metadata(image_path, backup)
    return jsonify({'success': success})


@app.route('/exif/copy_metadata', methods=['POST'])
def copy_metadata():
    """
    Kopiera metadata från en bild till en annan
    Body: { 
        "source_path": "/path/to/source.jpg",
        "target_path": "/path/to/target.jpg"
    }
    """
    data = request.get_json()
    source_path = data.get('source_path')
    target_path = data.get('target_path')
    
    if not source_path or not target_path:
        return jsonify({'error': 'source_path and target_path required'}), 400
    
    success = exif_manager.copy_metadata(source_path, target_path)
    return jsonify({'success': success})


@app.route('/exif/batch', methods=['POST'])
def batch_exif():
    """
    Batch-process flera bilder
    Body: {
        "image_paths": ["/path/1.jpg", "/path/2.jpg"],
        "operation": "read" | "write_keywords" | "write_face_tags" | "remove_metadata",
        "keywords": [...],  // om operation = write_keywords
        "face_tags": [...], // om operation = write_face_tags
    }
    """
    data = request.get_json()
    image_paths = data.get('image_paths', [])
    operation = data.get('operation')
    
    if not image_paths or not operation:
        return jsonify({'error': 'image_paths and operation required'}), 400
    
    kwargs = {}
    if operation == 'write_keywords':
        kwargs['keywords'] = data.get('keywords', [])
    elif operation == 'write_face_tags':
        kwargs['face_tags'] = data.get('face_tags', [])
    
    results = exif_manager.batch_process(image_paths, operation, **kwargs)
    return jsonify({'results': results})


if __name__ == '__main__':
    print("\n" + "="*60)
    print("EXIF API Server Starting...")
    print("Available EXIF routes:")
    print("  POST /exif/read")
    print("  POST /exif/write_keywords")
    print("  POST /exif/write_face_tags")
    print("  POST /exif/remove_metadata")
    print("  POST /exif/copy_metadata")
    print("  POST /exif/batch")
    print("="*60 + "\n")
    app.run(port=5005, debug=True)