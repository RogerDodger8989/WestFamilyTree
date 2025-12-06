"""
OAI-PMH Proxy för att undvika CORS-problem
Kör: python oai_proxy.py
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import xml.etree.ElementTree as ET
import logging

app = Flask(__name__)
CORS(app)

# Logger
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Riksarkivets OAI-PMH API - flera möjliga URLs
OAI_URLS = [
    'https://oai-pmh.riksarkivet.se/OAI',  # Korrekt URL enligt din ursprungliga kod
    'https://api.riksarkivet.se/oai-pmh',
]

# Mock-data för testing
MOCK_SETS = [
    {'setSpec': 'SE/LLA/13385', 'setName': 'Svenstorp (M), Malmöhus län'},
    {'setSpec': 'SE/LLA/13262', 'setName': 'Löderups kyrkoarkiv'},
    {'setSpec': 'SE/LLA/12345', 'setName': 'Stockholm kyrkoarkiv'},
]

MOCK_RECORDS = [
    # Löderups kyrkoarkiv - Födelseböcker
    {
        'identifier': 'Löderups kyrkoarkiv, Födelsebok, SE/LLA/13262/A I/1 (1750-1770)',
        'datestamp': '2023-01-15',
        'setSpec': 'SE/LLA/13262',
        'pages': [f'C0061051_{str(i).zfill(5)}' for i in range(1, 251)]  # 250 sidor
    },
    {
        'identifier': 'Löderups kyrkoarkiv, Födelsebok, SE/LLA/13262/A I/2 (1770-1790)',
        'datestamp': '2023-01-15',
        'setSpec': 'SE/LLA/13262',
        'pages': [f'C0061052_{str(i).zfill(5)}' for i in range(1, 301)]  # 300 sidor
    },
    {
        'identifier': 'Löderups kyrkoarkiv, Födelsebok, SE/LLA/13262/A I/3 (1790-1810)',
        'datestamp': '2023-01-15',
        'setSpec': 'SE/LLA/13262',
        'pages': [f'C0061053_{str(i).zfill(5)}' for i in range(1, 256)]  # 255 sidor
    },
    {
        'identifier': 'Löderups kyrkoarkiv, Födelsebok, SE/LLA/13262/A I/4 (1810-1830)',
        'datestamp': '2023-01-15',
        'setSpec': 'SE/LLA/13262',
        'pages': [f'C0061054_{str(i).zfill(5)}' for i in range(1, 276)]  # 275 sidor
    },
    # Löderups kyrkoarkiv - Husförhörslängder
    {
        'identifier': 'Löderups kyrkoarkiv, Husförhörslängder, SE/LLA/13262/A I/6 (1821-1826)',
        'datestamp': '2023-01-16',
        'setSpec': 'SE/LLA/13262',
        'pages': [f'C0061051_{str(i).zfill(5)}' for i in range(1, 101)]  # 100 sidor
    },
    {
        'identifier': 'Löderups kyrkoarkiv, Husförhörslängder, SE/LLA/13262/A I/7 (1827-1840)',
        'datestamp': '2023-01-16',
        'setSpec': 'SE/LLA/13262',
        'pages': [f'C0061052_{str(i).zfill(5)}' for i in range(1, 126)]  # 125 sidor
    },
    # Svenstorp - Vigselböcker
    {
        'identifier': 'Svenstorp (M), Vigselbok, SE/LLA/13385/B I/2 (1850-1890)',
        'datestamp': '2023-01-17',
        'setSpec': 'SE/LLA/13385',
        'pages': [f'C0050234_{str(i).zfill(5)}' for i in range(1, 176)]  # 175 sidor
    },
]

def parse_oai_xml(xml_content):
    """Parsa OAI-PMH XML till JSON"""
    try:
        root = ET.fromstring(xml_content)
        result = {}
        
        # Försök flera namespace varianter
        namespaces = [
            'http://www.openarchives.org/OAI/2.0/',
            '',
        ]
        
        for ns_uri in namespaces:
            ns = {'oai': ns_uri} if ns_uri else {}
            
            # Hämta sets
            if ns_uri:
                list_sets = root.find(f'.//{{{ns_uri}}}ListSets')
            else:
                list_sets = root.find('.//ListSets')
            
            if list_sets is not None:
                sets = []
                for set_elem in list_sets:
                    # Strips namespace från tag
                    tag = set_elem.tag.split('}')[-1] if '}' in set_elem.tag else set_elem.tag
                    if tag == 'set':
                        set_spec = None
                        set_name = None
                        for child in set_elem:
                            child_tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                            if child_tag == 'setSpec':
                                set_spec = child.text
                            elif child_tag == 'setName':
                                set_name = child.text
                        
                        if set_spec and set_name:
                            sets.append({
                                'setSpec': set_spec,
                                'setName': set_name
                            })
                
                if sets:
                    result['sets'] = sets
                    logger.info(f"Found {len(sets)} sets")
                    return result
        
        # Hämta identifiers om ListSets inte hittades
        for ns_uri in namespaces:
            if ns_uri:
                list_ids = root.find(f'.//{{{ns_uri}}}ListIdentifiers')
            else:
                list_ids = root.find('.//ListIdentifiers')
            
            if list_ids is not None:
                records = []
                for header in list_ids:
                    tag = header.tag.split('}')[-1] if '}' in header.tag else header.tag
                    if tag == 'header':
                        identifier = None
                        datestamp = None
                        set_spec = None
                        for child in header:
                            child_tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                            if child_tag == 'identifier':
                                identifier = child.text
                            elif child_tag == 'datestamp':
                                datestamp = child.text
                            elif child_tag == 'setSpec':
                                set_spec = child.text
                        
                        if identifier:
                            records.append({
                                'identifier': identifier,
                                'datestamp': datestamp or '',
                                'setSpec': set_spec or ''
                            })
                
                if records:
                    result['records'] = records
                    logger.info(f"Found {len(records)} records")
                    return result
        
        logger.warning("No sets or records found in XML")
        result['sets'] = []
        result['records'] = []
        return result
        
    except Exception as e:
        logger.error(f"Parse error: {str(e)}")
        return {'error': f"Parse error: {str(e)}"}

@app.route('/oai-pmh', methods=['GET', 'OPTIONS'])
def oai_proxy():
    """Proxya OAI-PMH requests"""
    if request.method == 'OPTIONS':
        return '', 204
    
    params = request.args.to_dict()
    verb = params.get('verb', '')
    logger.info(f"OAI Request: {params}")
    
    try:
        # Försök alla API-URLs
        last_error = None
        for oai_url in OAI_URLS:
            try:
                logger.info(f"Trying {oai_url}")
                response = requests.get(oai_url, params=params, timeout=10)
                response.raise_for_status()
                logger.info(f"Success with {oai_url} - status: {response.status_code}")
                
                # Parsa XML till JSON
                parsed = parse_oai_xml(response.text)
                return jsonify(parsed)
            except Exception as e:
                logger.warning(f"Failed with {oai_url}: {str(e)}")
                last_error = e
                continue
        
        # Om ingen URL fungerade, använd mock-data för testing
        logger.warning(f"All URLs failed, using mock data. Last error: {last_error}")
        if verb == 'ListSets':
            return jsonify({'sets': MOCK_SETS})
        elif verb == 'ListIdentifiers':
            return jsonify({'records': MOCK_RECORDS})
        else:
            return jsonify({'error': f"All APIs failed: {str(last_error)}"}), 500
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/oai-pmh/list-sets', methods=['GET', 'OPTIONS'])
def list_sets():
    """Hämta tillgängliga sets"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        for oai_url in OAI_URLS:
            try:
                response = requests.get(oai_url, params={'verb': 'ListSets'}, timeout=10)
                response.raise_for_status()
                parsed = parse_oai_xml(response.text)
                return jsonify(parsed)
            except Exception as e:
                logger.warning(f"Failed with {oai_url}: {str(e)}")
                continue
        
        # Fallback to mock data
        logger.warning("Using mock sets")
        return jsonify({'sets': MOCK_SETS})
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 OAI-PMH Proxy startad på http://localhost:5006")
    print("📝 Debugging aktiverat - se loggar nedan")
    print("📚 Mock-data är aktiverat som fallback")
    app.run(port=5006, debug=True)


