# WestFamilyTree

En professionell, blixtsnabb och offline-först desktopapplikation för släktforskning. Byggd med modern webbteknik (Electron + React) men designad för att hantera tunga, lokala databaser (SQLite) med fokus på integritet, källkritik och svensk släktforskning (ArkivDigital & Riksarkivet).

## 🌟 Huvudfunktioner

### 👥 Person- & Relationshantering
- **Detaljerat Personregister:** Hantera namn (födelsenamn, tidigare namn, smeknamn), kön, levnadsdatum och unika REF-nummer med inbyggd dubblettkontroll.
- **Stensäker Tvåvägssynkronisering:** Om person A läggs till som förälder till person B, blir person B omedelbart och automatiskt barn till person A i databasen. Hanterar föräldrar, barn, partners och syskon.
- **Smart Relationsmotor (Relation Engine):** Inbyggt varningssystem som flaggar "misstänkta" relationer (t.ex. förälder som är för ung/gammal, barn födda efter förälderns död, eller orimliga åldersskillnader mellan syskon/partners). Inställningsbara tröskelvärden.
- **Interaktivt Släktträd:** Visuell navigering genom generationerna.

### 📖 Händelser & Biografi
- **Livshändelser (Events):** Kronologisk hantering av händelser (Födelse, Dop, Vigsel, Yrke, Död, etc). 
- **Kopplade Vittnen:** Koppla faddrar, präster, bouppteckningsmän och andra medverkande direkt till specifika händelser.
- **Automatisk Biografi:** Generera en läsbar, löpande text om personens liv baserat på registrerade händelser, yrken och relationer med ett klick.
- **Platsdatabas:** Hierarkisk platshantering (Gård, By, Socken, Kommun, Län, Land).

### 📚 Avancerad Källkatalog (Svensk standard)
- **Skräddarsydd för Sverige:** Fält och snabblänkar direkt anpassade för **ArkivDigital (AID)**, **Riksarkivet (BildID)** och **NAD**.
- **Blixtsnabb Inmatning:** Kopiera en källreferens i webbläsaren och klistra in den direkt på en händelse i appen med automatisk tolkning.
- **Trovärdighetsgradering:** Värdera källans pålitlighet (0-5 stjärnor).
- **GEDCOM-Korrekt:** Stöd för fristående transkriberingar (`DATA.TEXT`) separat från egna noteringar (`NOTE`).
- **Deduplicering:** Automatiskt återanvändande av Master-källor för att hålla databasen ren.

### 🖼️ MediaManager & EXIF-hantering (MWG-Regions)
- **Lokal Bildhantering:** Rekursiv skanning av din lokala bildmapp. Dra-och-släpp bilder eller klistra in direkt från urklipp.
- **Inbyggd Bildvisare:** Zooma, panorera och rotera originaldokument direkt i appen.
- **Ansiktsigenkänning & Taggning:** Markera ansikten i foton och koppla dem till personer i databasen.
- **Cross-Compatible Metadata:** Skriver metadata (Keywords, Face Tags, Datum) direkt in i filernas EXIF/IPTC/XMP-data via en lokal Python-server (`exiftool`/`piexif`). Taggar du ett ansikte i WestFamilyTree, syns det i **Lightroom** och **DigiKam** (MWG-Regions standard).
- **Papperskorg:** Säkert borttagande av media med 30 dagars ångerrätt (`.trash`-system).

### 🔍 OCR & Textigenkänning
- **Tesseract OCR:** Markera ett stycke i en gammal kyrkbok (bild) och låt appen automatiskt läsa av och transkribera texten till redigerbar text (optimerad för svenska och engelska).
- **TrOCR Redo:** Backend-stöd inbyggt för HuggingFace TrOCR för avancerad tolkning av handskriven text.

### 📝 Forskningsmodul (Workflow)
- **Att-göra (Tasks):** Skapa forskningsuppgifter per person. Sätt prioritet (0-5), status (Pågående, Klar, etc) och deadlines.
- **Obesvarade Frågor:** Lista de "Gåtor" du försöker lösa för varje anfader. Bocka av dem när källan är funnen.
- **Forskningsnoteringar:** En dedikerad "kladdbok" (Rich Text Editor) per person för lösa teorier och analyser.

### 🖨️ Personakt & Rapporter
- **Proffsiga Utskrifter:** Skapa eleganta, bok-liknande personakter i A4-format (PDF/Utskrift) med klassisk serif-typografi.
- **Valbart Innehåll:** Välj exakt vad som ska ingå: Basfakta, livshändelser, familjeöversikt, bildgalleri, biografiska noteringar och en komplett, indexerad källförteckning (fotnoter).

### 🔄 GEDCOM 5.5.1 / 7.0
- **Fullt Stöd:** Importera och Exportera standardiserade `.ged`-filer för att kommunicera med MyHeritage, Ancestry, Genney, Disgen, etc.
- **Säker Import:** Förhandsgranskning och smarta merge-strategier vid import för att undvika dubbletter (Match by XREF / Name+Birth).

## 🛠️ Teknisk Arkitektur

### Frontend
- **React 18 & Vite:** Komponentbaserad, blixtsnabb rendering.
- **Tailwind CSS:** Modern utility-first styling.
- **Lucide Icons:** Stilrena och konsekventa ikoner.
- **Design System:** Applikationen efterliknar ett strikt och rent Windows 11 Desktop-gränssnitt.

### Backend (Electron)
- **Electron Main Process:** Hanterar all filsystemsåtkomst, fönsterhantering och native-dialoger.
- **SQLite3 Databas:** Hela släktträdet (Personer, Källor, Platser, Media, Relationer, Meta) sparas i en enda portabel `.db` eller `.sqlite`-fil.
- **Auto-Save:** Blixtsnabb, debouncad auto-sparning till SQLite i realtid vid varje ändring.
- **Audit & Merges:** Automatiska JSON-loggar för versionshistorik och spårbarhet.

### Python Microservice (EXIF)
För att garantera förstklassig hantering av bilders metadata används en lokal Flask-server integrerad med appen.
- Läser och skriver avancerad EXIF, IPTC och XMP (MWG-Regions).
- `exif_manager.py` utnyttjar Phil Harveys `exiftool` för bit-perfekt skrivning av data, med fallback till `piexif`.

---

## 🚀 Kom igång (Utveckling)

### Förutsättningar
- Node.js (v18+)
- Python 3.8+ (för EXIF-servern)
- ExifTool (rekommenderas starkt för fullt XMP-stöd)

### Installation

1. **Klona repot och installera Node-beroenden:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Installera Python-beroenden (för EXIF-servern):**
   \`\`\`bash
   pip install flask piexif Pillow
   \`\`\`
   *(Installera även exiftool via choco/brew/apt för optimal funktion).*

3. **Starta applikationen i dev-läge:**
   Du behöver starta tre terminaler:
   
   *Terminal 1 (Python EXIF-server):*
   \`\`\`bash
   python api_server.py
   \`\`\`

   *Terminal 2 (Vite Frontend):*
   \`\`\`bash
   npm run dev
   \`\`\`

   *Terminal 3 (Electron Backend):*
   \`\`\`bash
   npm run electron
   \`\`\`

## 📂 Filstruktur & Data

All data är din egen och stannar på din dator.
- **Databasen:** `min_slakt.db` (SQLite)
- **Bilder:** Sökvägen konfigureras i inställningarna (som standard `../media`). Bilderna indexeras i undermappar som `persons/`, `sources/` och `places/`.
- **Papperskorg:** Raderade bilder läggs i `media/.trash/` och behålls i 30 dagar innan permanent radering.

---
*WestFamilyTree – Byggt med passion för bevarandet av vår historia.*