// Simple persistent store for Electron using JSON file
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STORE_PATH = path.join(app.getPath('userData'), 'westfamilytree-settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch (e) { console.error('Kunde inte läsa inställningar:', e); }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) { console.error('Kunde inte spara inställningar:', e); }
}

module.exports = { loadSettings, saveSettings, STORE_PATH };
