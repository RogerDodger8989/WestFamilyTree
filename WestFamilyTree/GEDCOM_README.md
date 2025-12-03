# GEDCOM Import / Export — Design och implementering

Det här dokumentet beskriver hur GEDCOM (5.5.1) import och export ska fungera i WestFamilyTree-appen.

Syfte
- Möjliggöra import av släktdata från GEDCOM-filer (.ged) in i appens interna databas (`dbData`).
- Möjliggöra export av data (hela projektet eller valda personer) till GEDCOM-format för utbyte med andra program.

Översikt
- Parsing körs i Electron huvud-process (main) för säkert fil-I/O och korrekt teckenkodnings-hantering.
- Renderer (frontend) visar en förhandsgranskning av vad som ska importeras och låter användaren välja sammanslagningsstrategi.
- Import-mappning konverterar GEDCOM-taggar -> appens `dbData`-struktur (personer, relationer, händelser, platser, källor, media).
- Export bygger en GEDCOM-textfil (HEAD + INDI + FAM + SOUR) och sparar den via Save As.

Huvudkomponenter
1. Electron (main)
   - IPC-kanaler:
     - `gedcom:read` — öppna fil och parse GEDCOM
     - `gedcom:apply` — utför mappning och slå ihop in i `dbData`
     - `gedcom:write` — generera GEDCOM och spara
   - Ansvar: läsa filer, hantera teckenkodning, köra parser, skriva filer.

2. Renderer (React)
   - Komponenter:
     - `GedcomImportModal.jsx` — filväljare + förhandsgranskning + merge-inställningar
     - `GedcomPreview.jsx` — summering och konfliktdetektion
     - Hookar in i `useAppContext` för att applicera importer

3. Parser / Writer
   - Bibliotek: använda en stabil npm-paket för GEDCOM-parsing (t.ex. `parse-gedcom` eller liknande). Vid brist av bra paket implementeras en kompakt parser som följer 5.5.1-linjebaserad struktur.
   - Teckenkodning: använd `iconv-lite` (eller liknande) för ANSEL→UTF-8 om nödvändigt.

Mappningsprinciper (kort)
- Spara GEDCOM XREF (`@I1@`, `@F1@`) i `meta` för att stödja säker uppdatering vid återimport.
- Individ (`INDI`) → `dbData.people`:
  - `NAME` → split till förnamn/efternamn (heuristik)
  - `SEX` → `gender`
  - `BIRT`/`DEAT`/övriga → `events` med typ-översättning (t.ex. `BIRT` -> `Födelse`)
  - `SOUR` -> skapa/koppla `sources`
  - `OBJE` -> media/referenser
- Familj (`FAM`) → relationer (föräldrar, barn, partner)
- Källa (`SOUR`) -> `dbData.sources`
- REF = (`RIN`) är REF i mitt program 
Merge / konfliktstrategier
- Create all: skapa nya poster utan försök till matchning.
- Match by GEDCOM XREF: om xref finns och motsvarande xref i `meta` på en befintlig post -> uppdatera
- Match by Name+Birth: heuristisk matchning baserat på namn + födelseår.
- Prompt per-conflict: visa diff och låt användaren välja (tung UI-jobb, optional)

Media
- GEDCOMs `OBJE` kan peka på filer. Vid import: erbjud alternativ att kopiera infilen till projektets bildmapp eller bara referera sökväg.
- Vid export: antingen referera ursprungliga filer eller paketera bilder i en ZIP tillsammans med GEDCOM.

UI-flöde för import (förslag)
1. Användaren klickar `Importera GEDCOM`.
2. Filväljare (Electron) -> fil valts.
3. Main-process parses filen och skickar tillbaka en strukturerad preview (antal INDI/FAM/SOUR + eventuella varningar).
4. Modal visar preview och merge-inställningar.
5. Användaren klickar `Importera` -> renderer anropar `gedcom:apply` med valt strategi.
6. Main-process returnerar resultat; renderer uppdaterar `dbData` och visar status.

Export-flöde (förslag)
1. Användaren väljer scope (person/urval/hela DB).
2. Konfigurera options (inkludera media etc.).
3. Generera GEDCOM-linjer och öppna Save As -> skriv fil (eller zip).

Utvecklingssteg (prioriterat)
1. Design och välja parser-bibliotek.
2. Implementera `gedcom:read` i Electron main och en enkel preview i renderer.
3. Implementera mappning och `gedcom:apply` med minst en merge-strategi (Create all + Match by XREF).
4. Implementera exportfunktion.
5. Tester och dokumentation.

Files/Components att lägga till
- `electron/gedcom-handler.js` (main helper för read/apply/write)
- `src/components/GedcomImportModal.jsx`
- `src/components/GedcomPreview.jsx`
- Möjliga helper-filer: `src/gedcom/mapper.js`, `src/gedcom/writer.js`.

Tidsuppskattning (grovt)
- Init: 1–2 h
- Grundläggande import + preview: 4–8 h
- Mappning + sammanslagningslogik: 8–16 h
- Export + media: 3–6 h
- Tester + docs: 3–6 h


---

Vill du att jag direkt börjar implementera import-funktionen nu (skapa IPC i Electron + enkel import-modal i React)? Svara `start import` så börjar jag skapa filer för importflödet och lägga till nödvändiga beroenden.