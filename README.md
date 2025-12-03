# WestFamilyTree

WestFamilyTree är ett modernt släktforskningsverktyg byggt med React och Electron. Programmet fokuserar på enkel hantering av personer, relationer, källor och import av GEDCOM-filer.

## Huvudfunktioner

- **Personregister**: Lägg till, redigera och visa personer med namn, födelse/död, relationer och noteringar.
- **Relationer**: Koppla personer som föräldrar, barn, makar m.m. och visualisera släktträd.
- **Källkatalog**: Hantera källor (arkiv, böcker, bilder) och koppla dem till personer och händelser.
- **GEDCOM-import**: Importera släktdata från GEDCOM-filer med korrekt fältmappning (GIVN, SURN, BIRT, DEAT, osv).
- **Dublettkontroll**: Grundläggande logik för att undvika dubbletter vid import och sammanslagning.
- **Sök & filtrering**: Sök bland personer och källor, filtrera på olika attribut.
- **Bildhantering**: Koppla och visa bilder till källor och personer.
- **Undo/Redo**: Ångra och gör om ändringar i databasen.
- **Export/Backup**: Exportera databasen eller skapa säkerhetskopior.

## Teknik
- **React** (frontend)
- **Electron** (desktopintegration, filsystem)
- **Tailwind CSS** (design)
- **Node.js** (backend för Electron)

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
1. Klona repot och installera beroenden:
   ```
   npm install
   ```
2. Starta utvecklingsmiljön:
   ```
   npm run dev
   ```
3. Starta Electron:
   ```
   npm run electron
   ```

## Kontakt
För frågor eller förslag, kontakta projektägaren via GitHub.
