"""
OAI-PMH Proxy for CORS avoidance
Run: python oai_proxy.py
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import sys

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

app = Flask(__name__)
CORS(app)

OAI_BASE_URL = 'https://oai-pmh.riksarkivet.se/OAI'

@app.route('/oai-pmh', methods=['GET'])
@app.route('/oai-pmh/<dataset_id>', methods=['GET'])
def oai_proxy(dataset_id=None):
    """Proxya OAI-PMH requests"""
    params = request.args.to_dict()
    
    # Bygg URL med dataset-ID om det finns
    url = f"{OAI_BASE_URL}/{dataset_id}" if dataset_id else OAI_BASE_URL
    
    try:
        print(f"📡 Proxy request: {url} med params: {params}")
        response = requests.get(url, params=params, timeout=30)
        print(f"✅ Response status: {response.status_code}")
        
        # Hämta råa bytes och konvertera manuellt för att hantera BOM
        raw_content = response.content
        
        # Dekoda och ta bort BOM om det finns
        if raw_content.startswith(b'\xef\xbb\xbf'):
            print("🔧 BOM found at byte level, removing...")
            raw_content = raw_content[3:]
        
        content = raw_content.decode('utf-8')
        
        print(f"📄 Content length: {len(content)}, First 100 chars: {content[:100]}...")
        
        # Returnera med explicit charset
        return content, response.status_code, {
            'Content-Type': 'application/xml; charset=utf-8'
        }
    except Exception as e:
        print(f"❌ Proxy error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/oai-pmh/list-sets', methods=['GET'])
def list_sets():
    """Hämta tillgängliga sets"""
    try:
        response = requests.get(OAI_BASE_URL, params={'verb': 'ListSets'}, timeout=30)
        return response.text, response.status_code, {'Content-Type': 'application/xml'}
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("[INFO] OAI-PMH Proxy running at http://localhost:5006")
    app.run(port=5006, debug=False)
