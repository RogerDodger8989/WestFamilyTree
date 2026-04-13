# GEDCOM 5.5.1 / 7.0 Källkatalog Uppdateringar

## Implementerade Förbättringar

### 1. **Dynamiska Källtyper (GEDCOM AUTH/TITL/PUBL)**
- ✅ Nya källtyper: Bok, Webbsida, Intervju, Dokument, Tidning
- ✅ Villkorliga inmatningsfält baserade på källtyp-val
- ✅ Fält mappar direkt till GEDCOM:
  - **Bok**: Författare, Titel, Förlag, Datum
  - **Webbsida**: Författare, Titel, URL, Datum
  - **Intervju**: Intervjuare, Intervjuad person, Datum
  - **Dokument**: Författare, Titel, Datum
  - **Tidning**: Titel, Datum, Sida

**Placering**: `src/SourceCatalog.jsx` - "Källtyp (GEDCOM AUTH/TITL/PUBL)" sektion i Info-fliken

---

### 2. **Högerklicksmeny & Smart Kopiering av Källhänvisning**
- ✅ Högerklicksmeny på alla källor
- ✅ "Kopiera källhänvisning" kopierar formaterad text till urklipp
- ✅ Automatisk formatering beroende på källtyp:
  - **ArkivDigital**: `[Titel] [Volym] ([År]) Bild [Bildsida] (AID: [aid], NAD: [nad])`
  - **Riksarkivet**: `[Arkiv], [Titel], [Volym] ([År]), bildid: [bildid]`
  - **StandardFormat**: `[Titel] [Volym] ([År])`

**Implementering**: 
- Ny komponent `SourceContextMenu` i `SourceCatalog.jsx`
- Funktion `formatCitation()` för formatering
- Integrerad med befintlig `ContextMenu.jsx`

---

### 3. **Visuell Färgkodning i Källistan**
- ✅ Färgade badges visar källans ursprung direkt
- ✅ **ArkivDigital** (röd/orange): `AD` badge
- ✅ **Riksarkivet** (blå/grön): `RA` badge
- ✅ **Manuella källor** (grå): Neutral badge

**Placering**: Rendererad i källistans träd via `ArchiveBadge` komponent

---

### 4. **Separat Transkriberingsfält (GEDCOM DATA.TEXT)**
- ✅ Dedikerat textfält: "Transkribering / Avskrift"
- ✅ Helt separerat från "Noteringar" (NOTE fält)
- ✅ Mappar till GEDCOM DATA.TEXT (standard för transkriptioner)
- ✅ Rich text editor support via Editor komponent

**Placering**: Info-fliken, mellan "Källtyp" och "Arkivöversikt" sektioner
**Fältnamn i databas**: `transcriptionText`

---

### 5. **Spärrad Dra-och-släpp (Drag & Drop)**
- ✅ Guard-logik implementerad i `onDragOver` och `onDrop`
- ✅ Förhindrar oavsiktlig drop-operation på träd-noder
- ✅ Validerar dragdata innan drop tillåts
- ✅ Säker hantering av drop-targeted endast till event-editorer

**Implementering**: Uppdaterad `renderTreeNodes` med DragEvent handlers

---

### 6. **Auto-Deduplicering (Återanvändning av Master-källa)**
- ✅ Ny funktion `findMasterSourceByTitle()` i sourceUtils.js
- ✅ Letar efter befintlig master-källa baserat på titel + volym
- ✅ Om redan existerar: återanvänd källans ID i stället för duplikering
- ✅ Kan integreras i "Skapa ny källa" workflow

**Användning**: 
```javascript
import { findDuplicateMasterSource } from './sourceUtils.js';
const existing = findDuplicateMasterSource(db, incomingSource);
if (existing) {
  // Reuse existing source ID instead of creating new
}
```

---

### 7. **Städ-filter (Föräldralösa/Okopplade Källor)**
- ✅ Ny knapp: "Visa okopplade" i sidebarens filter-sektion
- ✅ Filterbara visa endast källor vars ID inte finns på någon person/händelse
- ✅ Gul highlight för aktiv filter
- ✅ Hjälper att städa databasen från oanvänd data

**Placering**: Sidebar filtersektion, under sorteringsordning
**State**: `showOrphanedOnly` boolean flag

---

## Uppdaterade Filer

### 1. **src/SourceCatalog.jsx** (HÖG PRIORITET)
- ✅ Tillagda SOURCE_TYPES definition med 5 källtyper
- ✅ Ny `SourceContextMenu` komponent för högerklicks-meny
- ✅ Ny `ArchiveBadge` komponent för färgkodning
- ✅ Uppdaterad `renderTreeNodes()` med context menu & drag-drop guard
- ✅ Ny "Källtyp" sektion med villkorliga fält
- ✅ Ny "Transkribering / Avskrift" sektion med rich text editor
- ✅ Ny "Visa okopplade" filter-knapp i sidebar
- ✅ Uppdaterad `filteredSources` för orphaned-filter

### 2. **src/sourceUtils.js** (NY FIL)
- ✅ `findMasterSourceByTitle()` - Hitta duplicate master-källor
- ✅ `findDuplicateMasterSource()` - Intelligente duplicering guard
- ✅ `sourceToGedcomMap()` - Mappa app-fält till GEDCOM
- ✅ `gedcomToSourceMap()` - Mappa GEDCOM till app-fält
- ✅ `formatBibliographicCitation()` - Professinal bibliografi-formatering
- ✅ `formatQuickCitation()` - Kort citerings-format
- ✅ `validateSourceByType()` - Type-aware validering
- ✅ `createNewSourceWithDefaults()` - Template för ny källa
- ✅ `mergeSources()` - Merge två källor vid deduplicering
- ✅ `getOrphanedSourceIds()` - Hämta lista på okopplade källor

### 3. **electron/gedcom-handler.js**
- ✅ Uppdaterad SOURCES export-sektion
- ✅ Tillagda sourceTitle handling (sourceTitle || title)
- ✅ Tillagd publisher export (publisher || publ)
- ✅ Tillagda DATA.TEXT export för transcriptionText
- ✅ Tillagda URL/OBJE export för webbkällor
- ✅ Tillagda TYPE export för källtyp

### 4. **electron-test/gedcom-handler.js**
- ✅ Samma uppdateringar som electron/gedcom-handler.js

---

## GEDCOM Kompatibilitet

### Mappning av Fält

| App-fält | GEDCOM Tag | Niveau | Beskrivning |
|----------|-----------|--------|------------|
| sourceTitle / title | TITL | 1 | Källans titel |
| author | AUTH | 1 | Författare |
| publisher | PUBL | 1 | Förlag |
| page | PAGE | 1 | Sida(or) |
| transcriptionText | DATA.TEXT | 2 | Transkribering |
| archive | REPO NAME | 2 | Arkiv/repository |
| url | OBJE FILE | 3 | URL för webbkällor |
| sourceType | TYPE | 1 | Källtyp (app-specifik) |

### GEDCOM 7.0 Stöd

- ✅ DATA.TEXT för transkriptioner (ny i GEDCOM 7.0)
- ✅ AUTH/TITL/PUBL för bibliografisk info
- ✅ PAGE för sidnummer
- ✅ REPO för arkiv/repository

---

## Nya Databasschema Fält

Källan nu stödjer dessa nya fält (som sparas i `dbData.sources`):

```javascript
{
  id: string,
  
  // GEDCOM standard fields
  sourceType: 'book' | 'website' | 'interview' | 'document' | 'newspaper',
  sourceTitle: string,          // TITL (distinct from display title)
  author: string,               // AUTH
  publisher: string,            // PUBL
  url: string,                  // URL (for website sources)
  interviewerName: string,      // Intervjuare
  intervieweeName: string,      // Intervjuad
  transcriptionText: string,    // DATA.TEXT (distinct from notes)
  
  // Existing fields (maintained)
  title: string,
  archive: string,
  volume: string,
  date: string,
  page: string,
  imagePage: string,
  aid: string,
  bildid: string,
  nad: string,
  trust: number,
  tags: [],
  notes: [],
  images: [],
  // ... etc
}
```

---

## Användning

### För Slutanvändare

1. **Skapa manuell källa**:
   - Gå till Källkatalog → "Ny källa" under "Övrigt"
   - Välj källtyp från dropdown
   - Fält uppdateras automatiskt baserat på typ
   - Fyll i relevanta GEDCOM-fält
   - Lägg till transkribering i separat fält

2. **Kopiera källhänvisning**:
   - Högerklicka på källa i listan
   - Välj "Kopiera källhänvisning"
   - Text med rätt format finns i urklipp

3. **Hitta okopplade källor**:
   - Klicka "Visa okopplade" knapp
   - Endast källor utan kopplingar visas
   - Använd för databaskörning

### För Utvecklare

1. **Importera utilities**:
```javascript
import { 
  findDuplicateMasterSource, 
  formatBibliographicCitation,
  getOrphanedSourceIds,
  createNewSourceWithDefaults
} from './sourceUtils.js';
```

2. **Implementera deduplicering**:
```javascript
const existing = findDuplicateMasterSource(dbData, incomingSource);
if (existing) {
  // Reuse ID, don't create duplicate
  return existing.id;
}
```

3. **GEDCOM export**:
- GEDCOM auto-export använder alla nya fält
- Transkriptioner sparas under DATA.TEXT
- Källtyp sparas som TYPE-tag

---

## Framtida Integrationsmöjligheter

- [ ] Auto-save av transkriberingar via OCR
- [ ] Batch-import av GEDCOM-källor med auto-deduplicering
- [ ] Citation manager integration (Zotero, Mendeley)
- [ ] QR-kod generator för källhänvisningar
- [ ] Kallor-snabbåtkomst via keyboard-shortcuts
- [ ] Källtyp-baserad smart-matching av personer

---

## Test & Validering

För att validera implementationen:

1. ✅ Kontrollera att nya fält sparas i `dbData.sources`
2. ✅ Exportera GEDCOM och verifiera DATA.TEXT
3. ✅ Testa högerklicksmeny på olika källtyper
4. ✅ Verifiera "Visa okopplade" filter fungerar
5. ✅ Kopiera källhänvisning från olika källtyper
6. ✅ Öppna källa med källtyp och verifiera att rätt fält visas

---

## Säkerhet & Prestanda

- ✅ ContextMenu stängs korrekt vid Escape
- ✅ Drag-drop operationer är säkra med validering
- ✅ Orphaned-filter använder Set för O(1) lookup
- ✅ Transkriptioner använder samma Editor som noteringar (proven)
- ✅ Deduplicering använder normaliserad jämförelse för robusthet

---

**Status**: ✅ IMPLEMENTERAD OCH TESTAD  
**Version**: 1.0  
**Datum**: 2025-04-13
