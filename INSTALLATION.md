# WestFamilyTree - Installation Guide

Dette guide leder deg gjennom hele installasjonen av WestFamilyTree, inkludert alle kritiske avhengigheter.

## 📋 Systemkrav

### Minimumkrav
- **Node.js 14+** (rekommenderes 16+)
- **npm 6+** eller **yarn**
- **Python 3.7+**
- **SQLite3** (vanligvis forhåndsinstallert)
- **exiftool** (kritisk for MWG-Regions support)

### OS Support
- ✅ **Windows 10/11**
- ✅ **macOS 10.15+**
- ✅ **Linux** (Ubuntu 20.04+, Debian 10+, Fedora 32+)

---

## 🪟 Windows Installation

### 1. Installér Node.js
```powershell
# Åpne PowerShell som Administrator

# Bruk Chocolatey (anbefalt):
choco install nodejs

# Eller last ned manuelt fra: https://nodejs.org/
# Velg LTS-versjonen (18.x eller 20.x)
```

**Verifisering:**
```powershell
node --version
npm --version
```

### 2. Installér Python 3
```powershell
# Via Chocolatey:
choco install python

# Eller manuelt fra: https://www.python.org/downloads/
# Huk av "Add python.exe to PATH" under installasjonen
```

**Verifisering:**
```powershell
python --version
pip --version
```

### 3. **KRITISK:** Installér exiftool
exiftool er **obligatorisk** for fulle MWG-Regions (face tag) funksjonalitet.

```powershell
# Via Chocolatey (anbefalt):
choco install exiftool

# Eller last ned fra:
# https://exiftool.org/
# 1. Last ned "Windows Executable"
# 2. Plasser i C:\Windows\System32\ eller en folder i PATH
```

**Verifisering:**
```powershell
exiftool -ver
# Skal skrive: (eksempel) 12.60
```

### 4. Klone Repository
```powershell
cd C:\Users\<YourUsername>\Desktop
git clone https://github.com/yourusername/WestFamilyTree.git
cd WestFamilyTree
```

**Hvis git ikke er installert:**
```powershell
choco install git
```

### 5. Installér Node-avhengigheter
```powershell
npm install
# Dette tager 2-5 minutter
```

### 6. Verifiser Installation
```powershell
# Test MWG-Regions (hvis du har en testbilde):
python test_mwg_regions.py C:/Users/<YourUsername>/Pictures/test.jpg

# Eller bare verifiser exiftool:
exiftool -ver
```

---

## 🍎 macOS Installation

### 1. Installér Homebrew (hvis ikke allerede gjort)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Installér Node.js
```bash
brew install node
```

**Verifisering:**
```bash
node --version
npm --version
```

### 3. Installér Python 3
```bash
brew install python@3.11
# Eller: brew install python (for nyeste versjon)
```

**Verifisering:**
```bash
python3 --version
pip3 --version
```

### 4. **KRITISK:** Installér exiftool
```bash
brew install exiftool
```

**Verifisering:**
```bash
exiftool -ver
```

### 5. Klone Repository
```bash
cd ~/Desktop
git clone https://github.com/yourusername/WestFamilyTree.git
cd WestFamilyTree
```

### 6. Installér Node-avhengigheter
```bash
npm install
```

### 7. Verifiser Installation
```bash
python3 test_mwg_regions.py ~/Pictures/test.jpg
exiftool -ver
```

---

## 🐧 Linux Installation (Ubuntu/Debian)

### 1. Installér Node.js
```bash
# Legge NodeSource repository til apt:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Installere Node.js:
sudo apt-get install -y nodejs

# Verifiser:
node --version
npm --version
```

**For Fedora/RHEL:**
```bash
sudo dnf install nodejs
```

### 2. Installér Python 3
```bash
# Ubuntu/Debian:
sudo apt-get update
sudo apt-get install -y python3 python3-pip

# Fedora:
sudo dnf install python3 python3-pip
```

**Verifisering:**
```bash
python3 --version
pip3 --version
```

### 3. **KRITISK:** Installér exiftool
```bash
# Ubuntu/Debian:
sudo apt-get install -y exiftool

# Fedora/RHEL:
sudo dnf install -y exiftool
```

**Verifisering:**
```bash
exiftool -ver
```

### 4. Klone Repository
```bash
cd ~/Desktop
git clone https://github.com/yourusername/WestFamilyTree.git
cd WestFamilyTree
```

### 5. Installér Node-avhengigheter
```bash
npm install
```

### 6. **Bonus:** (Valgfritt) Python venv
For å isolere Python-avhengigheter:
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# eller: venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 7. Verifiser Installation
```bash
python3 test_mwg_regions.py ~/Pictures/test.jpg
exiftool -ver
```

---

## 🚀 Kjøring av WestFamilyTree

### Start Single Window (Development)
Åpne **3 terminaler** i WestFamilyTree-mappen:

**Terminal 1 - Frontend Dev Server:**
```bash
npm run dev
# Server kjøres på http://localhost:5173
```

**Terminal 2 - Python API Server:**
```bash
python api_server_cors.py
# Server kjøres på http://localhost:5000
```

**Terminal 3 - Electron App:**
```bash
npm run electron
# Åpner Electron-vinduet
```

### Start All (Automated)
```bash
# Hvis script er satt opp:
npm run start:all
```

### Production Build
```bash
npm run build
npm run electron:build
```

---

## ✅ Verifisering av Installation

### Sjekkliste

- [ ] **Node.js versjon**: `node --version` → 14+
- [ ] **npm versjon**: `npm --version` → 6+
- [ ] **Python versjon**: `python --version` (Windows) eller `python3 --version` (Mac/Linux) → 3.7+
- [ ] **git klone**: `git clone` fungerer
- [ ] **npm install**: Ingen feil
- [ ] **exiftool**: `exiftool -ver` → Versjonsnummer

### Test MWG-Regions Funksjonalitet
```bash
# Fra WestFamilyTree-mappen:
python test_mwg_regions.py C:/path/to/test.jpg

# Forventet output:
# ✅ exiftool: PASS
# ✅ read: PASS
# ✅ write: PASS
# ✅ roundtrip: PASS
# ✅ keywords: PASS
# ✅ verify: PASS
# Totalt: 6/6 test(s) passerade
```

---

## 🔧 Felsøking

### Problem: "exiftool not found"
```bash
# Verifiser installasjon:
exiftool -ver

# Hvis ikke funnet, installer på nytt:
# Windows: choco install exiftool
# macOS: brew install exiftool
# Linux: sudo apt-get install exiftool
```

### Problem: "npm install" feiler
```bash
# Prøv cache-reset:
npm cache clean --force
npm install

# Eller bruk yarn:
yarn install
```

### Problem: "Python not found"
```bash
# Verifiser PATH:
which python  # macOS/Linux
where python  # Windows

# Eller bruk python3:
python3 --version
python3 api_server_cors.py
```

### Problem: Port 5000 eller 5173 i bruk
```bash
# Finn prosess på port:
# Windows: netstat -ano | findstr :5000
# macOS/Linux: lsof -i :5000

# Eller endre port i config/kode
```

### Problem: Database er låst
```bash
# Slett gamle lock-filer:
rm *.db-shm
rm *.db-wal

# Restart serveren
```

---

## 📚 Neste Steg

1. **Les README.md** for oversikt over features
2. **Se MWG_REGIONS_QUICKSTART.md** for EXIF-funksjonalitet
3. **Test bildeeditor** ved å legge til en kilde med bilde
4. **Importér GEDCOM** for å begynne med familiedata
5. **Legg til personer** og koble familiemedlemmer

---

## 📖 Dokumentasjon

- [README.md](README.md) - Oversikt over prosjektet
- [MWG_REGIONS_QUICKSTART.md](MWG_REGIONS_QUICKSTART.md) - Rask start for metadata
- [MWG_REGIONS_TECHNICAL_GUIDE.md](MWG_REGIONS_TECHNICAL_GUIDE.md) - Teknisk dokumentasjon
- [EXIF_README.md](EXIF_README.md) - EXIF-håndtering
- [GEDCOM_README.md](GEDCOM_README.md) - GEDCOM import/export

---

## 🆘 Kontakt

Hvis du støter på problemer:
1. Sjekk denne guiden igjen (felsøking-seksjonen)
2. Sjekk terminal-output for error-meldinger
3. Kjør `test_mwg_regions.py` for diagnostikk
4. Opprett et GitHub issue med error-meldinger

---

**Lykke til med WestFamilyTree!** 🌳
