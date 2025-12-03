import json
import sqlite3
import os


# KOMMUNER: kod -> namn (alla svenska kommuner 2024)
KOMMUNER = {
    '0114': 'Upplands Väsby', '0115': 'Vallentuna', '0117': 'Österåker', '0120': 'Värmdö', '0123': 'Järfälla', '0125': 'Ekerö', '0126': 'Huddinge', '0127': 'Botkyrka', '0128': 'Salem', '0136': 'Haninge', '0138': 'Tyresö', '0139': 'Upplands-Bro', '0140': 'Nykvarn', '0160': 'Täby', '0162': 'Danderyd', '0163': 'Sollentuna', '0180': 'Stockholm', '0181': 'Södertälje', '0182': 'Nacka', '0183': 'Sundbyberg', '0184': 'Solna', '0186': 'Lidingö', '0187': 'Vaxholm', '0188': 'Norrtälje', '0191': 'Sigtuna', '0192': 'Nynäshamn',
    '0305': 'Håbo', '0319': 'Älvkarleby', '0330': 'Knivsta', '0331': 'Heby', '0360': 'Tierp', '0380': 'Uppsala', '0381': 'Enköping', '0382': 'Östhammar',
    '0401': 'Vingåker', '0402': 'Gnesta', '0428': 'Nyköping', '0461': 'Oxelösund', '0480': 'Flen', '0481': 'Katrineholm', '0482': 'Eskilstuna', '0483': 'Strängnäs', '0484': 'Trosa',
    '0509': 'Ödeshög', '0512': 'Ydre', '0513': 'Kinda', '0560': 'Boxholm', '0561': 'Åtvidaberg', '0562': 'Finspång', '0563': 'Valdemarsvik', '0580': 'Linköping', '0581': 'Norrköping', '0582': 'Söderköping', '0583': 'Motala', '0584': 'Vadstena', '0586': 'Mjölby',
    '0604': 'Aneby', '0617': 'Gnosjö', '0642': 'Mullsjö', '0643': 'Habo', '0662': 'Gislaved', '0665': 'Värnamo', '0680': 'Jönköping', '0682': 'Nässjö', '0683': 'Värnamo', '0684': 'Eksjö', '0685': 'Tranås',
    '0760': 'Uppvidinge', '0761': 'Lessebo', '0763': 'Tingsryd', '0764': 'Alvesta', '0765': 'Älmhult', '0767': 'Markaryd', '0780': 'Växjö', '0781': 'Ljungby',
    '0821': 'Högsby', '0834': 'Torsås', '0840': 'Mörbylånga', '0860': 'Kalmar', '0861': 'Nybro', '0862': 'Oskarshamn', '0880': 'Västervik', '0881': 'Vimmerby', '0882': 'Hultsfred', '0883': 'Mönsterås', '0884': 'Emmaboda', '0885': 'Borgholm',
    '0980': 'Gotland',
    '1060': 'Olofström', '1080': 'Karlskrona', '1081': 'Ronneby', '1082': 'Karlshamn', '1083': 'Sölvesborg',
    '1214': 'Svalöv', '1230': 'Staffanstorp', '1231': 'Burlöv', '1233': 'Vellinge', '1256': 'Östra Göinge', '1257': 'Örkelljunga', '1260': 'Bjuv', '1261': 'Åstorp', '1262': 'Båstad', '1263': 'Lomma', '1264': 'Svedala', '1265': 'Skurup', '1266': 'Sjöbo', '1267': 'Hörby', '1268': 'Höör', '1270': 'Tomelilla', '1272': 'Bromölla', '1273': 'Osby', '1275': 'Perstorp', '1276': 'Klippan', '1277': 'Hässleholm', '1278': 'Åstorp', '1280': 'Malmö', '1281': 'Lund', '1282': 'Landskrona', '1283': 'Helsingborg', '1284': 'Höganäs', '1285': 'Eslöv', '1286': 'Ystad', '1287': 'Trelleborg', '1290': 'Kristianstad', '1291': 'Simrishamn',
    '1315': 'Hylte', '1380': 'Halmstad', '1381': 'Laholm', '1382': 'Falkenberg', '1383': 'Varberg', '1384': 'Kungsbacka',
    '1401': 'Mark', '1402': 'Svenljunga', '1407': 'Tranemo', '1415': 'Bollebygd', '1419': 'Herrljunga', '1421': 'Vårgårda', '1427': 'Essunga', '1430': 'Grästorp', '1435': 'Vänersborg', '1438': 'Trollhättan', '1439': 'Alingsås', '1440': 'Kungsbacka', '1441': 'Lerum', '1442': 'Partille', '1443': 'Ale', '1444': 'Kungälv', '1445': 'Stenungsund', '1446': 'Tjörn', '1447': 'Orust', '1452': 'Sotenäs', '1460': 'Munkedal', '1461': 'Tanum', '1462': 'Dals-Ed', '1463': 'Färgelanda', '1465': 'Åmål', '1466': 'Mellerud', '1470': 'Lilla Edet', '1471': 'Ale', '1472': 'Lerum', '1473': 'Partille', '1480': 'Göteborg', '1481': 'Mölndal', '1482': 'Kungälv', '1484': 'Stenungsund', '1485': 'Tjörn', '1486': 'Orust', '1487': 'Sotenäs', '1488': 'Munkedal', '1489': 'Tanum', '1490': 'Dals-Ed', '1491': 'Färgelanda', '1492': 'Åmål', '1493': 'Mellerud',
    '1715': 'Lekeberg', '1730': 'Laxå', '1737': 'Hallsberg', '1760': 'Degerfors', '1761': 'Hällefors', '1762': 'Ljusnarsberg', '1780': 'Örebro', '1781': 'Kumla', '1782': 'Askersund',
    '1814': 'Karlsborg', '1860': 'Gullspång', '1861': 'Mariestad', '1862': 'Töreboda', '1880': 'Skövde', '1881': 'Falköping', '1882': 'Tidaholm', '1883': 'Hjo',
    '1904': 'Aneby', '1907': 'Gnosjö', '1960': 'Mullsjö', '1961': 'Habo', '1980': 'Jönköping', '1981': 'Nässjö', '1982': 'Värnamo', '1983': 'Eksjö', '1984': 'Tranås',
    '2021': 'Berg', '2023': 'Härjedalen', '2026': 'Bräcke', '2029': 'Krokom', '2031': 'Strömsund', '2034': 'Åre', '2039': 'Östersund',
    '2101': 'Ånge', '2104': 'Timrå', '2121': 'Härnösand', '2132': 'Sollefteå', '2161': 'Kramfors', '2180': 'Sundsvall', '2260': 'Örnsköldsvik',
    '2303': 'Nordmaling', '2305': 'Bjurholm', '2309': 'Vindeln', '2313': 'Robertsfors', '2321': 'Norsjö', '2326': 'Malå', '2361': 'Storuman', '2380': 'Umeå', '2401': 'Vännäs', '2403': 'Vilhelmina', '2404': 'Åsele', '2409': 'Dorotea', '2417': 'Sorsele', '2421': 'Lycksele', '2460': 'Skellefteå', '2480': 'Arvidsjaur', '2481': 'Arjeplog', '2482': 'Jokkmokk', '2505': 'Överkalix', '2510': 'Kalix', '2513': 'Övertorneå', '2514': 'Pajala', '2518': 'Gällivare', '2521': 'Älvsbyn', '2523': 'Luleå', '2560': 'Piteå', '2580': 'Boden', '2581': 'Haparanda', '2582': 'Kiruna',
}

# LÄN: kod -> namn (alla svenska län 2024)
LÄN = {
    '01': 'Stockholms län', '03': 'Uppsala län', '04': 'Södermanlands län', '05': 'Östergötlands län', '06': 'Jönköpings län', '07': 'Kronobergs län', '08': 'Kalmar län', '09': 'Gotlands län', '10': 'Blekinge län', '12': 'Skåne län', '13': 'Hallands län', '14': 'Västra Götalands län', '17': 'Örebro län', '18': 'Västmanlands län', '19': 'Dalarnas län', '20': 'Gävleborgs län', '21': 'Västernorrlands län', '22': 'Jämtlands län', '23': 'Västerbottens län', '24': 'Norrbottens län'
}

EXCLUDE_TYPES = set([
    'VATTDRTX','SJÖ','HAV','KÄLLA','BERG','SKOG','Ö','DAL','MARK','VÄG','BRO','JÄRNVÄG','HAMN','KVARTSRUTA','SAMISK','KULTUR','FORS'
])

def normalize(val):
    if not isinstance(val, str):
        return ''
    return val.strip().lower()

def main():
    geojson_path = 'map.geojson'
    db_path = 'official_places.db'
    
    # Läs in geojson
    with open(geojson_path, encoding='utf-8') as f:
        data = json.load(f)
    
    features = data['features']
    print(f"Läser {len(features)} features...")

    # Skapa databas och tabell
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS official_places (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ortnamn TEXT,
            sockenstadnamn TEXT,
            sockenstadkod TEXT,
            kommunkod TEXT,
            kommunnamn TEXT,
            lanskod TEXT,
            lansnamn TEXT,
            detaljtyp TEXT,
            sprak TEXT,
            kvartsruta TEXT,
            nkoordinat INTEGER,
            ekoordinat INTEGER,
            lopnummer REAL,
            fid INTEGER,
            latitude REAL,
            longitude REAL
        )
    ''')
    conn.commit()

    seen = set()
    count = 0
    for feat in features:
        prop = feat['properties']
        typ = prop.get('detaljtyp','').upper()
        if typ in EXCLUDE_TYPES:
            continue
        # Unik-nyckel: ortnamn+sockenstadnamn+kommunkod+lanskod
        key = (
            normalize(prop.get('ortnamn','')),
            normalize(prop.get('sockenstadnamn','')),
            normalize(prop.get('kommunkod','')),
            normalize(prop.get('lanskod','')),
        )
        if key in seen:
            continue
        seen.add(key)
        # Koordinater
        coords = feat['geometry']['coordinates']
        lon, lat = coords[0], coords[1]
        # Kommun/län namn
        kommunkod = prop.get('kommunkod','')
        kommunnamn = KOMMUNER.get(kommunkod, '')
        lanskod = prop.get('lanskod','')
        lansnamn = LÄN.get(lanskod, '')
        # Spara ALLA fält + lookup
        c.execute('''
            INSERT INTO official_places (
                ortnamn, sockenstadnamn, sockenstadkod, kommunkod, kommunnamn, lanskod, lansnamn, detaljtyp, sprak, kvartsruta, nkoordinat, ekoordinat, lopnummer, fid, latitude, longitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            prop.get('ortnamn'),
            prop.get('sockenstadnamn'),
            prop.get('sockenstadkod'),
            kommunkod,
            kommunnamn,
            lanskod,
            lansnamn,
            prop.get('detaljtyp'),
            prop.get('sprak'),
            prop.get('kvartsruta'),
            prop.get('nkoordinat'),
            prop.get('ekoordinat'),
            prop.get('lopnummer'),
            prop.get('fid'),
            lat,
            lon
        ))
        count += 1
        if count % 10000 == 0:
            print(f"Importerade {count} platser...")
    conn.commit()
    print(f"KLART! {count} unika platser importerade till {db_path}.")
    conn.close()

if __name__ == '__main__':
    main()
