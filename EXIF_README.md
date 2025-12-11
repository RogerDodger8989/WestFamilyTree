# EXIF Editor - Användningsguide

## Översikt

EXIF-editorn är integrerad i Media-fliken och låter dig läsa, redigera och synka metadata från dina bilder.

## Funktioner

### 📸 EXIF-läsning
- **Face Tags** - Läs personer som taggats i bilden (XMP:PersonInImage)
- **Keywords** - Läs taggar/nyckelord från EXIF
- **Kameradata** - Kamera, lins, bländare, slutartid, ISO, brännvidd
- **GPS** - Koordinater och höjd
- **Metadata** - Datum, beskrivning, artist, copyright

### 🔄 Auto-synkning
Klicka på **Synka** för att automatiskt länka face tags till personer i din familjeträd:
- Matchning baserad på namn (exakt eller delvis)
- Varnar för personer som inte kunde matchas
- Dubbletter filtreras bort automatiskt

### ✏️ Redigering
- **Lägg till keywords** - Tagga bilder med nyckelord
- **Lägg till face tags** - Tagga personer i bilder
- **Radera metadata** - Ta bort all EXIF (för privacy)
- **Kopiera metadata** - Från en bild till andra

### 📦 Batch-operationer
När du markerat flera bilder kan du:
- Läsa EXIF från alla
- Lägga till samma keywords på alla
- Ta bort metadata från alla

## Hur du använder det

### 1. Öppna en bild i Media-fliken
Klicka på en bild för att visa detaljer i högerpanelen.

### 2. Expandera EXIF-sektionen
Klicka på **"Visa"** bredvid "EXIF & Metadata"

### 3. Läs EXIF från fil
Klicka på **"Läs från fil"** för att hämta metadata från originalfilen.

### 4. Synka face tags (om det finns)
Om bilden har face tags, klicka **"Synka"** för att automatiskt länka till personer.

### 5. Redigera och spara
- Lägg till nya keywords
- Länka face tags manuellt
- Spara ändringar tillbaka till filen

## API Endpoints

Backend erbjuder följande endpoints på `http://localhost:5005`:

### `POST /exif/read`
Läs EXIF från en bild.
```json
{
  "image_path": "/path/to/image.jpg"
}
```

### `POST /exif/write_keywords`
Skriv keywords till en bild.
```json
{
  "image_path": "/path/to/image.jpg",
  "keywords": ["keyword1", "keyword2"],
  "backup": true
}
```

### `POST /exif/write_face_tags`
Skriv face tags till en bild.
```json
{
  "image_path": "/path/to/image.jpg",
  "face_tags": [
    {
      "name": "Anders Nilsson",
      "x": 40,
      "y": 30,
      "width": 20,
      "height": 20
    }
  ],
  "backup": true
}
```

### `POST /exif/remove_metadata`
Ta bort all metadata.
```json
{
  "image_path": "/path/to/image.jpg",
  "backup": true
}
```

### `POST /exif/copy_metadata`
Kopiera metadata mellan bilder.
```json
{
  "source_path": "/path/to/source.jpg",
  "target_path": "/path/to/target.jpg"
}
```

### `POST /exif/batch`
Batch-processa flera bilder.
```json
{
  "image_paths": ["/path/1.jpg", "/path/2.jpg"],
  "operation": "read",
  "keywords": ["..."],
  "face_tags": [...]
}
```

## Backup

**Viktigt:** Alla ändringar skapar automatiskt en backup i `backups/exif/` innan originalet modifieras.

Backupfilnamn: `YYYYMMDD_HHMMSS_originalfilnamn.jpg`

## Tekniska detaljer

### Format som stöds
- JPEG (primärt)
- TIFF (begränsat stöd)

### EXIF-standarder
- **EXIF** - Kamera & fotoinställningar
- **IPTC** - Keywords & metadata
- **XMP** - Face tags & utökad metadata
- **GPS** - Geolocation

### Dependencies
- `piexif` - EXIF-hantering
- `Pillow` - Bildbehandling
- `Flask` - API server

## Felsökning

### "Kunde inte läsa EXIF-data"
- Kontrollera att filen är en giltig JPEG/TIFF
- Vissa bilder kanske inte har EXIF (t.ex. skärmdumpar)

### "Inga personer kunde matchas"
- Face tag-namnet måste likna namnet i databasen
- Försök länka manuellt istället

### "Backup-mappen finns inte"
- Skapas automatiskt vid första användning
- Kolla att du har skrivbehörighet

## Framtida förbättringar

- [ ] Stöd för fler bildformat (PNG, RAW)
- [ ] Bättre XMP-parsing (Microsoft Photo regions)
- [ ] Batch-redigering i UI
- [ ] Import av face regions med koordinater
- [ ] Export till GEDCOM (metadata i beskrivningar)

## Support

Vid problem, kontrollera:
1. Python API-servern körs (`python api_server.py`)
2. `piexif` är installerat (`pip install piexif`)
3. Filen finns och är läsbar
4. Console för felmeddelanden
