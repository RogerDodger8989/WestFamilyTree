# WestFamilyTree

WestFamilyTree är ett modernt släktforskningsverktyg byggt med React och Electron. Programmet fokuserar på enkel hantering av personer, relationer, källor och import av GEDCOM-filer.

## Huvudfunktioner

- **Personregister**: Lägg till, redigera och visa personer med namn, födelse/död, relationer och noteringar.
- **Relationer**: Koppla personer som föräldrar, barn, makar m.m. och visualisera släktträd.
- **Källkatalog**: Hantera källor (arkiv, böcker, bilder) och koppla dem till personer och händelser.
- **GEDCOM-import**: Importera släktdata från GEDCOM-filer med korrekt fältmappning (GIVN, SURN, BIRT, DEAT, osv).
- **Dublettkontroll**: Grundläggande logik för att undvika dubbletter vid import och sammanslagning.
- **Sök & filtrering**: Sök bland personer och källor, filtrera på olika attribut.
- **Bildhantering**: 
  - Koppla och visa bilder till källor och personer
  - **🎯 MWG-Regions support**: Ansiktstaggar med koordinater (Lightroom/DigiKam kompatibelt)
  - Rotera, beskära, justera ljus/kontrast
  - Automatisk region-omberäkning vid beskärning
- **EXIF/XMP-metadata**: 
  - Läs och skriv EXIF-data med face tags
  - Fullt stöd för MWG-Regions standarden
  - 100% interoperabilitet med Lightroom och DigiKam
  - Automatic backup före ändringar
- **Undo/Redo**: Ångra och gör om ändringar i databasen.
- **Export/Backup**: Exportera databasen eller skapa säkerhetskopior.

## Teknik

### Frontend
- **React 18+** (UI och state management)
- **Electron** (desktopintegration, filsystem)
- **Tailwind CSS** (design och styling)
- **Node.js** (build tools, server)
- **Canvas API** (bildbehandling: rotation, crop, filters)

### Backend
- **Python 3.7+**
  - `exif_manager.py`: EXIF/XMP metadata, MWG-Regions parsing (Lightroom/DigiKam compatible)
  - `database_manager.py`: SQLite genealogy database
  - `place_database_manager.py`: Place hierarchies
  - `official_place_database.py`: Swedish official places registry
  - `gedcom_handler.js`: GEDCOM import/export
  - `api_server_cors.py`: Flask API server

### Kritiska Beroenden
- **exiftool** (för MWG-Regions support) – **måste installeras separat** (se Installation)
- **piexif** (fallback EXIF-hantering)
- **Flask** + **Flask-CORS** (API server)
- **SQLite** (databas)

## EXIF & MWG-Regions (Metadata)

WestFamilyTree använder **MWG-Regions** standarden för ansiktstaggar, vilket ger full kompatibilitet med Lightroom och DigiKam.

### Features
- ✅ Läs/skriv MWG-Regions (mwg-rs:Name, mwg-rs:Area med koordinater)
- ✅ Automatisk koordinat-konvertering: 0-100% (frontend) ↔ 0-1 (XMP standard)
- ✅ Keywords/tags med XMP:Subject och IPTC:Keywords
- ✅ Automatic backup före ändringar
- ✅ Crop med automatisk region-räkning
- ✅ Lightroom/DigiKam interoperabilitet

### Hur det fungerar
1. **I appen**: Du taggar ett ansikte, taggen sparas i 0-100% format
2. **Backend**: Konverteras till 0-1, skrivs via exiftool till MWG-Regions
3. **I Lightroom/DigiKam**: Du öppnar samma bild → taggen syns redan där!
4. **Bidirektionellt**: Redigera i Lightroom, öppna i appen igen → uppdaterad

Se [MWG_REGIONS_QUICKSTART.md](MWG_REGIONS_QUICKSTART.md) för snabb start.
Se [MWG_REGIONS_TECHNICAL_GUIDE.md](MWG_REGIONS_TECHNICAL_GUIDE.md) för detaljer.

## Att implementera/utveckla vidare

- **Avancerad merge-logik för dubbletter**: 
  - Identifiera och slå ihop personer/källor på fler sätt (t.ex. fuzzy match på namn, födelsedata, källreferenser).
  - Logga och visa vilka poster som slogs ihop eller hoppades över vid import.
- **Bättre GEDCOM-export**: 
  - Möjlighet att exportera hela databasen till GEDCOM-format.
- **Fler relationstyper**: 
  - Stöd för t.ex. fosterföräldrar, samboskap, vittnen m.m.
- **Källgranskning och betyg**: 
  - Möjlighet att sätta tillförlitlighetsbetyg och kommentarer på källor.
- **Platsregister**: 
  - Hantera och koppla platser (församlingar, gårdar, länder) till personer och händelser.
- **Avancerad sökning**: 
  - Sök på kombinationer av fält, fritext, filter på relationer m.m.
- **Användarhantering**: 
  - Flera användare, rättigheter, delning av träd.
- **Automatisk backup**: 
  - Schemalagda säkerhetskopior och versionshantering.
- **Responsiv design**: 
  - Förbättra stöd för surfplattor och mobiler.

## Kom igång

### Systemkrav
- **Node.js 14+** och **npm**
- **Python 3.7+**
- **exiftool** (för EXIF/metadata support) – se installation nedan

### Installation

Se [INSTALLATION.md](INSTALLATION.md) för fullständig installations-guide.

**Snabb start:**

1. Klona repot och installera beroenden:
   ```bash
   git clone <repo-url>
   cd WestFamilyTree
   npm install
   ```

2. Installera exiftool:
   - **Windows**: `choco install exiftool` eller ladda ner från https://exiftool.org
   - **macOS**: `brew install exiftool`
   - **Linux**: `sudo apt-get install exiftool`

3. Starta alla tjänster:
   ```bash
   # Terminal 1: Frontend dev server
   npm run dev
   
   # Terminal 2: Python API server
   python api_server_cors.py
   
   # Terminal 3: Electron app (när frontend är klar)
   npm run electron
   ```

   **Eller** använd den förbundna startscripten:
   ```bash
   npm run start:all  # startar alla tjänster parallellt
   ```

### Verifiering
Verifiera att MWG-Regions fungerar:
```bash
python test_mwg_regions.py C:/path/to/test.jpg
```

Resultat: Alla 6 tester grön ✅ = system är klart!

## Kontakt

För frågor eller förslag, kontakta projektägaren via GitHub.

---

## 📚 Dokumentation

| Dokument | Innehål |
|----------|---------|
| [INSTALLATION.md](INSTALLATION.md) | **START HÄR**: Steg-för-steg installation för Windows/macOS/Linux |
| [MWG_REGIONS_QUICKSTART.md](MWG_REGIONS_QUICKSTART.md) | Snabb start för EXIF/metadata och ansiktstaggar |
| [MWG_REGIONS_TECHNICAL_GUIDE.md](MWG_REGIONS_TECHNICAL_GUIDE.md) | Teknisk guide för MWG-Regions, koordinatkconvertering, debugging |
| [EXIF_README.md](EXIF_README.md) | EXIF metadata hantering, read/write operationer |
| [GEDCOM_README.md](GEDCOM_README.md) | GEDCOM import/export guide, fältmappning |

---

## 🎯 Snabb Navigation

- **Ny användare?** → [INSTALLATION.md](INSTALLATION.md)
- **Vill tagga ansikten?** → [MWG_REGIONS_QUICKSTART.md](MWG_REGIONS_QUICKSTART.md)
- **Tekniska frågor om metadata?** → [MWG_REGIONS_TECHNICAL_GUIDE.md](MWG_REGIONS_TECHNICAL_GUIDE.md)
- **Problem med exiftool?** → Se "Felsökning" i [INSTALLATION.md](INSTALLATION.md)
- **Vill importera familjedata?** → [GEDCOM_README.md](GEDCOM_README.md)
