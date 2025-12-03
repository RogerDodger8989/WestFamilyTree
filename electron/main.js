const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const openImage = require('./open-image');
const IMAGE_ROOT = path.normalize(path.resolve('C:/WestFamilyTree/bilder'));

// IPC för att öppna bild i systemets visare
ipcMain.on('open-image', (event, filePath) => {
  const fullPath = forceImageRoot(filePath);
  openImage(fullPath);
});

// Logga miljö och versioner för felsökning av teckenkodning
console.log('==================== [ENV/LOCALE DEBUG] ====================');
console.log('process.env.LANG:', process.env.LANG);
console.log('process.env.LC_ALL:', process.env.LC_ALL);
console.log('process.env.CHARSET:', process.env.CHARSET);
console.log('process.env.LANGUAGE:', process.env.LANGUAGE);
console.log('process.platform:', process.platform);
console.log('process.versions:', process.versions);
console.log('============================================================');

// Hjälpfunktion: Kombinera rot-mappen med den relativa sökvägen från appen.
function forceImageRoot(filePath) {
  // Bombsäker root-strip även i backend
  let relPath = filePath;
  // Dekoda till UTF-8 om det är en Buffer eller felaktigt kodad sträng
  if (Buffer.isBuffer(relPath)) {
    relPath = relPath.toString('utf8');
  }
  // Extra: försök alltid tolka som utf8
  try {
    relPath = Buffer.from(relPath, 'utf8').toString('utf8');
  } catch (e) {
    // Ignorera om redan utf8
  }
  relPath = relPath.replace(/\\/g, '/');
  if (relPath.includes(':') || relPath.startsWith('C:/')) {
    // Ta bort allt före och med första /kallor eller /diverse
    relPath = relPath.replace(/.*\/(kallor|diverse)\//, '$1/');
    if (!relPath.startsWith('kallor/') && !relPath.startsWith('diverse/')) {
      const idxK = relPath.indexOf('kallor/');
      const idxD = relPath.indexOf('diverse/');
      if (idxK !== -1) relPath = relPath.slice(idxK);
      else if (idxD !== -1) relPath = relPath.slice(idxD);
    }
  }
  // Hård blockering: måste börja med kallor/ eller diverse/
  if (!relPath.startsWith('kallor/') && !relPath.startsWith('diverse/')) {
    console.error('[forceImageRoot] FEL: relPath börjar inte med kallor/ eller diverse/:', relPath);
    throw new Error('relPath måste börja med kallor/ eller diverse/. relPath: ' + relPath);
  }
  console.log('[forceImageRoot] FINAL relPath:', relPath);
  // Säkerställer att vi inte försöker gå "uppåt" i mappstrukturen (../)
  const safeRelativePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(IMAGE_ROOT, safeRelativePath);
  // Returnera alltid med / (slash) för visning/logg
  return fullPath;
}

// IPC handler for saving a file
ipcMain.handle('save-file', async (event, filePath, data) => {
    // FULL LOGGNING AV TECKENKODNING
    if (typeof filePath === 'string') {
      console.log('[save-file] filePath (string):', filePath);
      console.log('[save-file] filePath charCodes:', Array.from(filePath).map(c => c.charCodeAt(0)));
    } else {
      console.log('[save-file] filePath (NOT string!):', filePath);
    }
  const fs = require('fs').promises;
  let forcedPath = forceImageRoot(filePath);
  const forcedPathDisplay = forcedPath.replace(/\\/g, '/');
  try {
    console.log('==================== [save-file] ====================');
    console.log('[save-file] EVENT:', event ? Object.keys(event) : 'null');
    console.log('[save-file] IN filePath:', filePath);
    console.log('[save-file] OUT forcedPath:', forcedPathDisplay);
    console.log('[save-file] typeof data:', typeof data);
    if (data && data.constructor) console.log('[save-file] data.constructor:', data.constructor.name);
    if (data && data.buffer) console.log('[save-file] data.buffer.constructor:', data.buffer.constructor.name);
    if (data && typeof data.length !== 'undefined') {
      console.log('[save-file] data.length:', data.length);
      if (data.length > 0) {
        console.log('[save-file] data[0..10]:', Array.from(data).slice(0, 10));
        console.log('[save-file] data[-10:]:', Array.from(data).slice(-10));
      }
    } else {
      console.log('[save-file] data har ingen length!');
    }
    if (!data || !data.length) {
      console.error('[save-file] FEL: Ingen data mottagen!');
      return { error: 'Ingen data mottagen', filePath: forcedPathDisplay };
    }
    console.log('[save-file] FULL STACKTRACE:');
    console.trace();
    // Tvinga UTF-8 på alla strängar (om de mot förmodan är felkodade)
    let dir = path.dirname(forcedPath);
    let fileOut = forcedPath;
    // Om någon är Buffer, konvertera till utf8-sträng
    if (Buffer.isBuffer(dir)) dir = dir.toString('utf8');
    if (Buffer.isBuffer(fileOut)) fileOut = fileOut.toString('utf8');
    // Logga exakt vad som skickas till fs
    console.log('[save-file] mkdir dir:', JSON.stringify(dir));
    await fs.mkdir(dir, { recursive: true });
    console.log('[save-file] writeFile fileOut:', JSON.stringify(fileOut));
    await fs.writeFile(fileOut, Buffer.from(data));
    console.log('[save-file] Sparad:', forcedPathDisplay);
    console.log('======================================================');
    return { success: true, savedPath: forcedPathDisplay };
  } catch (err) {
    console.error('[save-file] FEL:', err, 'Path:', forcedPathDisplay);
    console.error('[save-file] FULL STACKTRACE:');
    console.trace();
    return { error: err.message, details: err, filePath: forcedPathDisplay };
  }
});

// IPC handler for reading a file
ipcMain.handle('read-file', async (event, filePath) => {
  const fs = require('fs').promises;
  const path = require('path');
  const forcedPath = forceImageRoot(filePath);
  try {
    console.log('[read-file] IN:', filePath);
    console.log('[read-file] OUT:', forcedPath);
    const data = await fs.readFile(forcedPath);
    return data;
  } catch (err) {
    console.error('[read-file] FEL:', err, 'Path:', forcedPath);
    return { error: err.message };
  }
});

const openFolder = require('./open-folder');
// IPC för att öppna mapp från renderer
ipcMain.on('open-folder', (event, folderPath) => {
  openFolder(folderPath);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Kolla om vi är i utvecklingsläge (om en miljövariabel är satt)
  // Detta är ett robust sätt att skilja på utveckling och produktion.
  // Du kan starta med "npm run dev" och "npm run electron" som vanligt.
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // I utvecklingsläge, ladda från Vite-servern.
    win.loadURL('http://localhost:5100'); // Porten är korrekt enligt din terminal!
    win.webContents.openDevTools();
  } else {
    // I produktionsläge, ladda den byggda filen.
    win.loadFile(path.join(__dirname, '../WestFamilyTree/dist/index.html'));
  }
}

// --- Kod för kontextmeny ---
// Lyssnar efter meddelandet från React för att visa menyn
ipcMain.on('show-person-context-menu', (event, personId) => {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);

  const template = [
    {
      label: 'Redigera person...',
      click: () => win.webContents.send('context-menu-command', 'edit-person', personId)
    },
    {
      label: 'Visa i släktträd',
      enabled: false // Inaktiverad tills funktionen finns
    },
    { type: 'separator' },
    {
      label: 'Kopiera REF-nummer',
      click: () => win.webContents.send('context-menu-command', 'copy-ref', personId)
    },
    {
      label: 'Kopiera fullständigt namn',
      click: () => win.webContents.send('context-menu-command', 'copy-name', personId)
    },
    { type: 'separator' },
    {
      label: 'Radera person...',
      click: () => win.webContents.send('context-menu-command', 'delete-person', personId)
    },
    { type: 'separator' },
    { label: 'Klipp ut', role: 'cut' },
    { label: 'Kopiera', role: 'copy' },
    { label: 'Klistra in', role: 'paste' },
  ];

  const menu = Menu.buildFromTemplate(template);
  // Visa menyn i det fönster där högerklicket skedde
  menu.popup({ window: win });
});


app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handler for open-file-dialog
const { dialog } = require('electron');
ipcMain.handle('open-file-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog({
    properties: options?.properties || ['openFile'],
    filters: options?.filters || []
  });
  return result;
});

// IPC handler for reading directory contents
const fs = require('fs').promises;
ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    return files.map(f => ({ name: f.name, isDirectory: f.isDirectory() }));
  } catch (err) {
    return { error: err.message };
  }
});

// IPC handler: read the latest gedcom-debug JSON file from the audit-backups folder
ipcMain.handle('read-latest-audit-debug', async (event) => {
  try {
    const fsPromises = require('fs').promises;
    const userData = app.getPath('userData');
    const backupDir = path.join(userData, 'audit-backups');
    await fsPromises.mkdir(backupDir, { recursive: true });
    const entries = await fsPromises.readdir(backupDir, { withFileTypes: true });
    const candidates = entries
      .filter(e => e.isFile())
      .map(e => e.name)
      .filter(n => /^gedcom-debug.*\.json$/i.test(n))
      .map(n => ({ name: n }));
    if (!candidates.length) return { error: 'Inga gedcom-debug-filer hittades i audit-backups' };
    // Find newest by mtime
    let newest = null;
    for (const c of candidates) {
      const stat = await fsPromises.stat(path.join(backupDir, c.name));
      if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { name: c.name, mtimeMs: stat.mtimeMs };
    }
    if (!newest) return { error: 'Kunde inte bestämma senaste gedcom-debug' };
    const fullPath = path.join(backupDir, newest.name);
    const data = await fsPromises.readFile(fullPath, 'utf8');
    try {
      const parsed = JSON.parse(data);
      return { success: true, file: newest.name, parsed };
    } catch (e) {
      return { success: true, file: newest.name, raw: data };
    }
  } catch (err) {
    console.error('[read-latest-audit-debug] error', err);
    return { error: err.message };
  }
});

// IPC handler for saving an audit backup into the app's userData folder.
ipcMain.handle('save-audit-backup', async (event, fileName, data, dir) => {
  const fsPromises = require('fs').promises;
  try {
    // If caller provided an absolute directory, write there. Otherwise default to app userData/audit-backups
    let backupDir;
    if (dir && typeof dir === 'string' && path.isAbsolute(dir)) {
      backupDir = path.normalize(dir);
    } else {
      const userData = app.getPath('userData');
      backupDir = path.join(userData, 'audit-backups');
    }
    await fsPromises.mkdir(backupDir, { recursive: true });
    // Use the filename provided by the caller when possible (sanitized),
    // otherwise fall back to a timestamped audit file.
    const requestedName = (typeof fileName === 'string' && fileName.trim()) ? fileName.trim() : null;
    const safeName = requestedName ? path.basename(requestedName) : `audit_backup-${Date.now()}.json`;
    const outPath = path.join(backupDir, safeName);
    const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await fsPromises.writeFile(outPath, payload, 'utf8');
    console.log('[save-audit-backup] Saved audit backup to', outPath);
    return { success: true, savedPath: outPath };
  } catch (err) {
    console.error('[save-audit-backup] error:', err);
    return { error: err.message };
  }
});

// IPC handler to open the audit backup folder (or a provided folder)
ipcMain.handle('open-audit-backup-folder', async (event, dir) => {
  try {
    let folderToOpen;
    if (dir && typeof dir === 'string' && path.isAbsolute(dir)) {
      folderToOpen = path.normalize(dir);
    } else {
      const userData = app.getPath('userData');
      folderToOpen = path.join(userData, 'audit-backups');
    }
    // ensure folder exists
    await require('fs').promises.mkdir(folderToOpen, { recursive: true });
    // Use the existing openFolder helper
    const openFolder = require('./open-folder');
    openFolder(folderToOpen);
    console.log('[open-audit-backup-folder] opened', folderToOpen);
    return { success: true, folder: folderToOpen };
  } catch (err) {
    console.error('[open-audit-backup-folder] error', err);
    return { error: err.message };
  }
});

// GEDCOM IPC handlers: read (parse preview), apply (perform mapping into DB), write (export)
const gedcomHandler = require('./gedcom-handler');

ipcMain.handle('gedcom:read', async (event, filePath) => {
  try {
    // filePath should be an absolute path (renderer can use open-file-dialog to pick)
    const result = await gedcomHandler.readGedcom(filePath);
    return result;
  } catch (err) {
    console.error('[gedcom:read] error', err);
    return { error: err.message };
  }
});

ipcMain.handle('gedcom:apply', async (event, parsed, options) => {
  try {
    const result = await gedcomHandler.applyGedcom(parsed, options);
    return result;
  } catch (err) {
    console.error('[gedcom:apply] error', err);
    return { error: err.message };
  }
});

ipcMain.handle('gedcom:write', async (event, dbData, options) => {
  try {
    const result = await gedcomHandler.writeGedcom(dbData, options);
    return result;
  } catch (err) {
    console.error('[gedcom:write] error', err);
    return { error: err.message };
  }
});

// ✅ NY GEDCOM IMPORT HANDLER
ipcMain.handle('import-gedcom', async (event, gedcomData) => {
  try {
    console.log(`[main.js] Mottog ${gedcomData.individuals.length} individer för import.`);
    
    // TODO: HÄR SKA DU ANROPA DIN FUNKTION FÖR ATT SPARA TILL DATABASEN
    // Exempel: await database.saveImportedData(gedcomData);
    
    // Just nu returnerar vi bara success för att React ska bli glad
    return { success: true, message: 'Importen mottogs av huvudprocessen.' };
  } catch (error) {
    console.error('[main.js] Fel vid hantering av GEDCOM-import:', error);
    return { success: false, message: error.message };
  }
});