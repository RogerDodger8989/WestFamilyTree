# Relation Engine — konfiguration och varningar

Denna korta fil beskriver hur förslagsmotorn för relationer (`sourceRelationEngine`) kan konfigureras och vilka "suspicious"-nycklar som kan returneras.

Var lagras konfiguration?

- Nyckel i `localStorage`: `relationEngineConfig`
- Fil med logik: `src/sourceRelationEngine.js`
- UI för att ändra trösklar: `Relationsinställningar` (inbäddad i den globala inställningsdialogen i `src/App.jsx`).

Format och nycklar i `relationEngineConfig`

Ett JSON-objekt med följande fält (exempelvärden visas):

- `PARENT_MIN_YEARS`: Minsta åldersskillnad för att föreslå förälder (t.ex. 14)
- `PARENT_MAX_YEARS`: Maximal åldersskillnad för att föreslå förälder (t.ex. 60)
- `PARENT_LOOSE_MIN`: Lös tröskel för nära fall där vi bör vara försiktiga (t.ex. 11)
- `LARGE_AGE_GAP`: Gräns för att flagga en "stor åldersskillnad" (t.ex. 40)
- `SIBLING_LARGE_GAP`: Gräns för att flagga stor åldersskillnad mellan syskon (t.ex. 20)
- `SPOUSAL_LARGE_GAP`: Gräns för att flagga stor åldersskillnad mellan makar (t.ex. 20)
- `POSTHUMOUS_TOLERANCE`: Tolerans i månader för postuma födslar (t.ex. 9)

Observera: motorens kod tillhandahåller alltid rimliga standardvärden om `localStorage` inte är satt.

Vad innehåller ett förslag?

Ett förslag (`proposal`) är ett objekt med minst följande fält:

- `fromPersonId`, `toPersonId` — person-id:n
- `type` — `parent`, `child` eller `spouse`
- `confidence` — ett tal 0..1 som anger förslagsstyrka
- `reasons` — korta maskinnamn för varför förslaget gjordes (t.ex. `age_difference`, `shared_vigsel`, `placeSim:0.89`)
- `suspicious` — en array med maskinnycklar för varningar (se nedan)
- `suspiciousMessages` — en array med svenska, användarvänliga varningstexter (samma längd och index som `suspicious`)

`suspicious`-nycklar (exempel och tolkning)

- `date_contradiction` — tydlig datumkontradiktion (t.ex. barn fött före förälder)
- `large_age_gap` — mycket stor åldersskillnad mellan förälder/barn
- `large_age_gap_sibling` — mycket stor åldersskillnad mellan föreslagna syskon
- `spousal_large_gap` — stor åldersskillnad mellan makar
- `parent_too_young` / `mother_too_young` — förälder (eller mor) för ung enligt tröskel
- `parent_too_old` / `mother_too_old` — förälder (eller mor) för gammal enligt tröskel
- `born_after_mother_death` — barnets födelse är efter moderns död (posthumous)
- `child_after_father_death` — barnets födelse är efter faderns död

Var finns hjälptexter?

Längre förklarande texter (på svenska) finns i `src/suspiciousHelp.js` som används av UI:t för att visa tooltips.

Hur ändrar jag trösklar?

- Öppna appens inställningar och leta efter `Relationsinställningar`.
- Alternativt, kör i konsolen `localStorage.setItem('relationEngineConfig', JSON.stringify({...}))` och ladda om appen.

Tänk på

- Motorn är konservativ: mål är att undvika falska positiva kopplingar. Om du ändrar trösklarna, justera dem försiktigt.
- UI:t föredrar `suspiciousMessages` (svenska) men behåller `suspicious`-nycklarna för maskinell bearbetning.

Se även

- `src/sourceRelationEngine.js` — huvudlogiken
- `src/suspiciousHelp.js` — hjälptexter för varningsnycklar
- `src/RelationSettings.jsx` — komponent för att ändra trösklar
- `src/SourceCatalog.jsx` — UI som visar förslag och varningar
