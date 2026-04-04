console.log('WestFamilyTree Electron main.js loaded:', __filename);
console.log('Node version:', process.version);
console.log('Electron version:', process.versions.electron);
console.log('IPC-handlers for last-opened-file är aktiva!');
// Inställnings-store för senaste fil
const { loadSettings, saveSettings } = require('./settingsStore');

const { ipcMain, app, BrowserWindow, Menu, protocol } = require('electron');

// IPC: Hämta senaste öppnade fil
ipcMain.handle('get-last-opened-file', async () => {
  const settings = loadSettings();
  return settings.lastOpenedFile || null;
});

// IPC: Sätt senaste öppnade fil (kan användas vid save as)
ipcMain.handle('set-last-opened-file', async (event, filePath) => {
  const settings = loadSettings();
  settings.lastOpenedFile = filePath;
  saveSettings(settings);
  return true;
});
// IPC handler för att spara audit-loggar till separat fil
ipcMain.handle('save-audit-log', async (event, dbPath, auditArray) => {
  const fs = require('fs').promises;
  const path = require('path');
  try {
    if (!dbPath) return { error: 'Ingen databas-sökväg angiven' };
    const auditFilePath = dbPath.replace(/\.db$/, '_audit.json');
    const MAX_AUDIT_ENTRIES = 10000;
    const trimmedAudit = auditArray.length > MAX_AUDIT_ENTRIES 
      ? auditArray.slice(-MAX_AUDIT_ENTRIES) 
      : auditArray;
    await fs.writeFile(auditFilePath, JSON.stringify(trimmedAudit, null, 2), 'utf8');
    return { success: true, count: trimmedAudit.length, removed: auditArray.length - trimmedAudit.length };
  } catch (err) {
    console.error('[save-audit-log] Fel:', err);
    return { error: err.message };
  }
});

// IPC handler för att läsa audit-loggar från separat fil
ipcMain.handle('load-audit-log', async (event, dbPath) => {
  const fs = require('fs').promises;
  const path = require('path');
  try {
    if (!dbPath) return { error: 'Ingen databas-sökväg angiven' };
    const auditFilePath = dbPath.replace(/\.db$/, '_audit.json');
    try {
      const data = await fs.readFile(auditFilePath, 'utf8');
      const auditArray = JSON.parse(data);
      return { success: true, audit: Array.isArray(auditArray) ? auditArray : [] };
    } catch (readErr) {
      if (readErr.code === 'ENOENT') {
        // Filen finns inte än - returnera tom array
        return { success: true, audit: [] };
      }
      throw readErr;
    }
  } catch (err) {
    console.error('[load-audit-log] Fel:', err);
    return { error: err.message, audit: [] };
  }
});

// IPC handler för att spara merges till separat fil
ipcMain.handle('save-merges-log', async (event, dbPath, mergesArray) => {
  const fs = require('fs').promises;
  const path = require('path');
  try {
    if (!dbPath) return { error: 'Ingen databas-sökväg angiven' };
    const mergesFilePath = dbPath.replace(/\.db$/, '_merges.json');
    const MAX_MERGE_ENTRIES = 1000;
    const trimmedMerges = mergesArray.length > MAX_MERGE_ENTRIES 
      ? mergesArray.slice(-MAX_MERGE_ENTRIES) 
      : mergesArray;
    await fs.writeFile(mergesFilePath, JSON.stringify(trimmedMerges, null, 2), 'utf8');
    return { success: true, count: trimmedMerges.length, removed: mergesArray.length - trimmedMerges.length };
  } catch (err) {
    console.error('[save-merges-log] Fel:', err);
    return { error: err.message };
  }
});

// IPC handler för att läsa merges från separat fil
ipcMain.handle('load-merges-log', async (event, dbPath) => {
  const fs = require('fs').promises;
  const path = require('path');
  try {
    if (!dbPath) return { error: 'Ingen databas-sökväg angiven' };
    const mergesFilePath = dbPath.replace(/\.db$/, '_merges.json');
    try {
      const data = await fs.readFile(mergesFilePath, 'utf8');
      const mergesArray = JSON.parse(data);
      return { success: true, merges: Array.isArray(mergesArray) ? mergesArray : [] };
    } catch (readErr) {
      if (readErr.code === 'ENOENT') {
        // Filen finns inte än - returnera tom array
        return { success: true, merges: [] };
      }
      throw readErr;
    }
  } catch (err) {
    console.error('[load-merges-log] Fel:', err);
    return { error: err.message, merges: [] };
  }
});

// IPC handler för att få filstorlek
ipcMain.handle('get-log-file-size', async (event, dbPath, logType) => {
  const fs = require('fs').promises;
  const path = require('path');
  try {
    if (!dbPath) return { error: 'Ingen databas-sökväg angiven' };
    const filePath = dbPath.replace(/\.db$/, `_${logType}.json`);
    try {
      const stats = await fs.stat(filePath);
      return { 
        success: true, 
        size: stats.size, 
        sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        exists: true
      };
    } catch (readErr) {
      if (readErr.code === 'ENOENT') {
        return { success: true, size: 0, sizeMB: '0.00', exists: false };
      }
      throw readErr;
    }
  } catch (err) {
    console.error('[get-log-file-size] Fel:', err);
    return { error: err.message };
  }
});

// IPC handler for saving the entire database (people, sources, places, meta)
ipcMain.handle('save-database', async (event, fileHandle, data) => {
  // DEBUG: Logga vad som sparas (allra först)
  const dbPath = fileHandle && fileHandle.path ? fileHandle.path : fileHandle;
  console.log('[save-database] SPARAR TILL SQLITE:', {
    dbPath,
    antalPersoner: Array.isArray(data?.people) ? data.people.length : 'ej array',
    personer: (Array.isArray(data?.people) && data.people.length > 0) ? data.people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, sex: p.sex, gender: p.gender, refNumber: p.refNumber })) : data?.people,
    relationsCount: Array.isArray(data?.relations) ? data.relations.length : 0,
    relations: Array.isArray(data?.relations) ? data.relations.map(r => ({ id: r.id, fromPersonId: r.fromPersonId, toPersonId: r.toPersonId, type: r.type })) : [],
    meta: data?.meta
  });
  if (!dbPath) return { error: 'Ingen fil angiven' };
  try {
    const { saveDatabaseData } = await import('../electron/databaseHandler.js');
    const result = await saveDatabaseData(dbPath, data);

    // Spara audit och merges till separata filer
    const metaToSave = { ...(data.meta || {}) };
    const auditArray = metaToSave.audit;
    const mergesArray = metaToSave.merges;
    
    // Spara audit och merges till separata filer
    if (auditArray && Array.isArray(auditArray)) {
      try {
        // Vi är redan i main process, anropa direkt
        const fs = require('fs').promises;
        if (!dbPath || typeof dbPath !== 'string') {
          console.error('[save-database] ❌ dbPath är inte en giltig sträng:', dbPath);
          throw new Error('dbPath måste vara en sträng');
        }
        const auditFilePath = dbPath.replace(/\.db$/, '_audit.json');
        const MAX_AUDIT_ENTRIES = 10000;
        const trimmedAudit = auditArray.length > MAX_AUDIT_ENTRIES 
          ? auditArray.slice(-MAX_AUDIT_ENTRIES) 
          : auditArray;
        await fs.writeFile(auditFilePath, JSON.stringify(trimmedAudit, null, 2), 'utf8');
        console.log('[save-database] ✅ Audit sparad till separat fil:', trimmedAudit.length, 'poster');
      } catch (err) {
        console.error('[save-database] ❌ Kunde inte spara audit till fil:', err);
      }
    }
    if (mergesArray && Array.isArray(mergesArray)) {
      try {
        const fs = require('fs').promises;
        if (!dbPath || typeof dbPath !== 'string') {
          console.error('[save-database] ❌ dbPath är inte en giltig sträng för merges:', dbPath);
          throw new Error('dbPath måste vara en sträng');
        }
        const mergesFilePath = dbPath.replace(/\.db$/, '_merges.json');
        const MAX_MERGE_ENTRIES = 1000;
        const trimmedMerges = mergesArray.length > MAX_MERGE_ENTRIES 
          ? mergesArray.slice(-MAX_MERGE_ENTRIES) 
          : mergesArray;
        await fs.writeFile(mergesFilePath, JSON.stringify(trimmedMerges, null, 2), 'utf8');
        console.log('[save-database] ✅ Merges sparad till separat fil:', trimmedMerges.length, 'poster');
      } catch (err) {
        console.error('[save-database] ❌ Kunde inte spara merges till fil:', err);
      }
    }
    
    return { success: true, dbPath };
  } catch (err) {
    return { error: err.message, dbPath };
  }
});
// Hjälpfunktion för att skanna media-mappen (MÅSTE vara definierad före open-database)
async function scanMediaFolder() {
  const path = require('path');
  const fs = require('fs');
  const IMAGE_ROOT = path.join(__dirname, '..', 'media');
  const TRASH_ROOT = path.join(IMAGE_ROOT, '.trash');
  
  try {
    const mediaItems = [];
    
    // Hjälpfunktion för att rekursivt skanna en mapp
    const scanDirectory = async (dir, relativePath = '') => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          
          if (entry.isDirectory()) {
            // Rekursivt skanna undermappar
            await scanDirectory(fullPath, relPath);
          } else if (entry.isFile()) {
            // Kontrollera om det är en bildfil
            const ext = path.extname(entry.name).toLowerCase();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
            
            if (imageExtensions.includes(ext)) {
              const stats = await fs.promises.stat(fullPath);
              const fileName = entry.name;
              
              // Bestäm libraryId baserat på mapp
              let libraryId = 'temp';
              if (relPath.startsWith('persons/')) {
                libraryId = 'persons';
              } else if (relPath.startsWith('sources/')) {
                libraryId = 'sources';
              } else if (relPath.startsWith('places/')) {
                libraryId = 'places';
              } else if (relPath.startsWith('custom/')) {
                // För custom-mappar, extrahera mappnamnet
                const customMatch = relPath.match(/^custom\/([^\/]+)\//);
                if (customMatch) {
                  libraryId = `custom_${customMatch[1]}`;
                }
              }
              
              // Skapa stabilt ID baserat på filnamn och sökväg (hash av relPath)
              const crypto = require('crypto');
              const pathHash = crypto.createHash('md5').update(relPath).digest('hex').slice(0, 12);
              const stableId = `img_${pathHash}`;
              
              // Skapa media-item
              const mediaItem = {
                id: stableId,
                url: `media://${encodeURIComponent(relPath)}`,
                name: fileName,
                date: stats.mtime.toISOString().split('T')[0], // Använd ändringsdatum som standard
                description: '',
                tags: [],
                connections: {
                  people: [],
                  places: [],
                  sources: []
                },
                faces: [],
                libraryId: libraryId,
                filePath: relPath,
                fileSize: stats.size,
                note: ''
              };
              
              mediaItems.push(mediaItem);
            }
          }
        }
      } catch (err) {
        console.error(`[scanMediaFolder] Error scanning ${dir}:`, err);
      }
    };
    
    // Skanna media-mappen rekursivt
    if (fs.existsSync(IMAGE_ROOT)) {
      await scanDirectory(IMAGE_ROOT);
    }
    
    console.log(`[scanMediaFolder] Hittade ${mediaItems.length} bilder i media-mappen`);
    return { success: true, media: mediaItems };
  } catch (error) {
    console.error('[scanMediaFolder] Error:', error);
    return { success: false, error: error.message, media: [] };
  }
}

// IPC handler for open-database-dialog (for opening .db/.sqlite files)
ipcMain.handle('open-database-dialog', async (event) => {
  const { dialog } = require('electron');
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Öppna databas...',
    properties: ['openFile'],
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite'] }
    ]
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
// IPC handler for opening a SQLite .db file and reading all people
ipcMain.handle('open-database', async (event, filePath) => {
  // Spara senaste öppnade fil
  if (filePath) {
    const settings = loadSettings();
    settings.lastOpenedFile = filePath;
    saveSettings(settings);
    }
    let dbPath = filePath;
    if (!dbPath) return { error: 'Ingen fil angiven' };
    try {
      const { loadDatabaseData } = await import('../electron/databaseHandler.js');
      const loaded = await loadDatabaseData(dbPath);
      const { people, sources, places, relations, mediaFromDb, meta } = loaded;
      
      // VIKTIGT: Mappa gender till sex för att matcha appens struktur
      const peopleWithSex = people.map(p => {
        // Om personen har gender men inte sex, kopiera gender till sex
        if (p.gender && !p.sex) {
          p.sex = p.gender;
        }
        // Om personen har sex men inte gender, kopiera sex till gender (för bakåtkompatibilitet)
        if (p.sex && !p.gender) {
          p.gender = p.sex;
        }
        return p;
      });
      console.log('[open-database] Laddade personer:', peopleWithSex.map(p => ({ 
        id: p.id, 
        firstName: p.firstName, 
        lastName: p.lastName, 
        sex: p.sex, 
        gender: p.gender,
        refNumber: p.refNumber,
        mediaCount: Array.isArray(p.media) ? p.media.length : 0,
        relations: p.relations ? Object.keys(p.relations).length : 0
      })));
      
      // Ladda audit och merges från separata filer
      const fs = require('fs').promises;
      const auditFilePath = filePath.replace(/\.db$/, '_audit.json');
      const mergesFilePath = filePath.replace(/\.db$/, '_merges.json');
      
      let audit = [];
      let merges = [];
      let auditFileExists = false;
      let mergesFileExists = false;
      
      try {
        const auditData = await fs.readFile(auditFilePath, 'utf8');
        audit = JSON.parse(auditData);
        if (!Array.isArray(audit)) audit = [];
        auditFileExists = true;
        console.log('[open-database] ✅ Laddade audit från separat fil:', audit.length, 'poster');
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('[open-database] Kunde inte läsa audit-fil:', err);
        }
      }
      
      try {
        const mergesData = await fs.readFile(mergesFilePath, 'utf8');
        merges = JSON.parse(mergesData);
        if (!Array.isArray(merges)) merges = [];
        mergesFileExists = true;
        console.log('[open-database] ✅ Laddade merges från separat fil:', merges.length, 'poster');
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('[open-database] Kunde inte läsa merges-fil:', err);
        }
      }
      
      // Migration: Om audit/merges finns i meta men inte i filer, migrera dem
      const metaAudit = meta.audit || [];
      const metaMerges = meta.merges || [];
      
      if (!auditFileExists && metaAudit.length > 0) {
        // Migrera audit från meta till fil
        console.log('[open-database] 🔄 Migrerar audit från meta-tabellen till separat fil:', metaAudit.length, 'poster');
        audit = metaAudit;
        try {
          await fs.writeFile(auditFilePath, JSON.stringify(audit, null, 2), 'utf8');
          console.log('[open-database] ✅ Migrerade audit till separat fil');
        } catch (err) {
          console.error('[open-database] Kunde inte migrera audit till fil:', err);
        }
      } else if (auditFileExists && metaAudit.length > 0) {
        // Om både fil och meta finns, använd filen (den är nyare) men logga varning
        console.log('[open-database] ⚠️ Audit finns både i fil och meta-tabellen. Använder filen.');
      }
      
      if (!mergesFileExists && metaMerges.length > 0) {
        // Migrera merges från meta till fil
        console.log('[open-database] 🔄 Migrerar merges från meta-tabellen till separat fil:', metaMerges.length, 'poster');
        merges = metaMerges;
        try {
          await fs.writeFile(mergesFilePath, JSON.stringify(merges, null, 2), 'utf8');
          console.log('[open-database] ✅ Migrerade merges till separat fil');
        } catch (err) {
          console.error('[open-database] Kunde inte migrera merges till fil:', err);
        }
      } else if (mergesFileExists && metaMerges.length > 0) {
        // Om både fil och meta finns, använd filen (den är nyare) men logga varning
        console.log('[open-database] ⚠️ Merges finns både i fil och meta-tabellen. Använder filen.');
      }
      
      // Lägg till audit och merges i meta-objektet (för kompatibilitet)
      meta.audit = audit;
      meta.merges = merges;
      
      // Skanna media-mappen och merga med media från databasen
      let media = [];
      try {
        const mediaResult = await scanMediaFolder();
        if (mediaResult && mediaResult.success) {
          const mediaFromFiles = mediaResult.media || [];
          
          // Skapa en map av media från databasen (keyed by filePath eller url)
          const dbMediaMap = new Map();
          mediaFromDb.forEach(m => {
            const key = m.filePath || m.url || m.id;
            dbMediaMap.set(key, m);
          });
          
          // Merga: använd metadata från databasen om den finns, annars från filsystemet
          media = mediaFromFiles.map(fileMedia => {
            const key = fileMedia.filePath || fileMedia.url || fileMedia.id;
            const dbMedia = dbMediaMap.get(key);
            
            if (dbMedia) {
              // Merga: använd metadata från databasen, men behåll filsystemets URL/filePath
              return {
                ...dbMedia,
                url: fileMedia.url, // Använd filsystemets URL (kan ha ändrats)
                filePath: fileMedia.filePath, // Använd filsystemets filePath
                fileSize: fileMedia.fileSize // Uppdatera filstorlek från filsystemet
              };
            } else {
              // Ny bild från filsystemet som inte finns i databasen
              return fileMedia;
            }
          });
          
          // Lägg till media från databasen som inte finns i filsystemet (kan ha flyttats/borttagits)
          mediaFromDb.forEach(dbMedia => {
            const key = dbMedia.filePath || dbMedia.url || dbMedia.id;
            const existsInFiles = mediaFromFiles.some(fm => 
              (fm.filePath || fm.url || fm.id) === key
            );
            if (!existsInFiles) {
              // Media finns i databasen men inte i filsystemet - behåll den ändå
              media.push(dbMedia);
            }
          });
          
          console.log(`[open-database] Mergade ${media.length} bilder (${mediaFromDb.length} från databas, ${mediaFromFiles.length} från filsystem)`);
        } else {
          // Om skanning misslyckades, använd bara media från databasen
          media = mediaFromDb;
          console.log(`[open-database] Använder ${media.length} bilder från databasen (filskanning misslyckades)`);
        }
      } catch (mediaErr) {
        console.error('[open-database] Error scanning media folder:', mediaErr);
        // Fallback: använd bara media från databasen
        media = mediaFromDb;
      }
      
      const result = { people: peopleWithSex, sources, places, relations, meta, media, dbPath };
      console.log('[open-database] Returnerar data:', {
        antalPersoner: result.people.length,
        personer: result.people.map(p => ({ 
          id: p.id, 
          firstName: p.firstName, 
          lastName: p.lastName, 
          sex: p.sex, 
          gender: p.gender,
          refNumber: p.refNumber
        }))
      });
      return result;
    } catch (err) {
      console.error('[open-database] FEL:', err);
      // Säkerställ att media alltid returneras, även vid fel
      let media = [];
      try {
        const mediaResult = await scanMediaFolder();
        if (mediaResult && mediaResult.success) {
          media = mediaResult.media || [];
        }
      } catch (mediaErr) {
        console.error('[open-database] Error scanning media folder (fallback):', mediaErr);
      }
      return { error: err.message, dbPath, people: [], sources: [], places: [], meta: {}, media };
    }
  });

const path = require('path');
const fs = require('fs');

// Rensa gamla .sqlite-filer i media-mappen vid appstart (behåll bara de 5 senaste)
const mediaDir = path.join(__dirname, '..', 'media');
try {
  const files = fs.readdirSync(mediaDir)
    .filter(f => f.endsWith('.sqlite'))
    .map(f => ({
      name: f,
      path: path.join(mediaDir, f),
      mtime: fs.statSync(path.join(mediaDir, f)).mtime.getTime(),
      size: fs.statSync(path.join(mediaDir, f)).size
    }));
  // Sortera efter senaste ändring
  files.sort((a, b) => b.mtime - a.mtime);
  // Behåll de 5 senaste, ta bort resten
  const toDelete = files.slice(5);
  for (const file of toDelete) {
    fs.unlinkSync(file.path);
    console.log('[cleanup] Tog bort gammal databasfil:', file.path);
  }
  // Ta bort tomma filer bland de 5 senaste
  for (const file of files.slice(0, 5)) {
    if (file.size === 0) {
      fs.unlinkSync(file.path);
      console.log('[cleanup] Tog bort tom databasfil:', file.path);
    }
  }
} catch (err) {
  console.error('[cleanup] Fel vid rensning av media-mapp:', err);
}
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: `Om ${app.name}` },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: `Göm ${app.name}` },
        { role: 'hideOthers', label: 'Göm övriga' },
        { role: 'unhide', label: 'Visa alla' },
        { type: 'separator' },
        { role: 'quit', label: `Avsluta ${app.name}` }
      ]
    }] : []),
    {
      label: 'Arkiv',
      submenu: [
        {
          label: 'Ny databas',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'new-database');
          }
        },
        {
          label: 'Öppna',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'open-database');
          }
        },
        // Ta bort JSON-relaterade undermenyer, endast SQLite
        { type: 'separator' },
        {
          label: 'Spara',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'save-database');
          }
        },
        {
          label: 'Spara som',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'save-as-database');
          }
        },
        { type: 'separator' },
        {
          label: 'Exportera',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'export-data');
          }
        },
        {
          label: 'Importera',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'import-data');
          }
        },
        { type: 'separator' },
        {
          label: 'Stäng databas',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'close-database');
          }
        },
        { type: 'separator' },
        {
          label: 'Inställningar',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.send('menu-action', 'settings');
          }
        },
        { type: 'separator' },
        {
          label: 'Skriv ut',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) win.webContents.print();
          }
        }
      ]
    },
    {
      label: 'Redigera',
      submenu: [
        { role: 'undo', label: 'Ångra' },
        { role: 'redo', label: 'Gör om' },
        { type: 'separator' },
        { role: 'cut', label: 'Klipp ut' },
        { role: 'copy', label: 'Kopiera' },
        { role: 'paste', label: 'Klistra in' }
      ]
    },
    {
      label: 'Visa',
      submenu: [
        { role: 'reload', label: 'Ladda om' },
        { role: 'toggleDevTools', label: 'Utvecklarverktyg' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Helskärm' }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
const openImage = require('./open-image');
// Media-mapp i programmets katalog
const IMAGE_ROOT = path.join(__dirname, '..', 'media');

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
  let relPath = filePath;
  
  // Dekoda till UTF-8 om det är en Buffer eller felaktigt kodad sträng
  if (Buffer.isBuffer(relPath)) {
    relPath = relPath.toString('utf8');
  }
  
  // VIKTIGT: Dekoda URL-encoding FÖRST (innan vi gör något annat)
  // Detta hanterar %2F (/) och andra URL-kodade tecken
  try {
    relPath = decodeURIComponent(relPath);
    console.log('[forceImageRoot] After decodeURIComponent:', relPath);
  } catch (e) {
    // Om decodeURIComponent misslyckas, försök manuellt
    console.log('[forceImageRoot] decodeURIComponent failed, using manual replacement');
    relPath = relPath.replace(/%2F/g, '/').replace(/%20/g, ' ').replace(/%5C/g, '\\');
  }
  
  // Normalisera till forward slashes
  relPath = relPath.replace(/\\/g, '/');
  
  // Om det är en absolut Windows-sökväg, extrahera bara filnamnet
  if (relPath.includes(':')) {
    // Ta bara filnamnet, inte hela sökvägen
    relPath = path.basename(relPath);
  }
  
  // Om sökvägen redan börjar med IMAGE_ROOT, ta bara den relativa delen
  if (relPath.includes('media/')) {
    const idx = relPath.indexOf('media/');
    relPath = relPath.slice(idx + 6); // Efter 'media/'
  }
  
  // BEHÅLL mappstrukturen om den finns (t.ex. persons/filename.png)
  // Om det innehåller slashes OCH är en relativ sökväg (inte absolut), behåll strukturen
  // Om det är en absolut sökväg med ':', ta bara filnamnet
  // Annars behåll relPath som den är (inklusive mappstruktur)
  
  console.log('[forceImageRoot] Input:', filePath);
  console.log('[forceImageRoot] Processed relPath:', relPath);
  console.log('[forceImageRoot] IMAGE_ROOT:', IMAGE_ROOT);
  
  // Säkerställ att vi inte försöker gå "uppåt" i mappstrukturen (../)
  // Men BEHÅLL mappstrukturen (t.ex. persons/filename.png)
  let safeRelativePath = relPath;
  
  // Om det är en absolut sökväg (innehåller ':'), ta bara filnamnet
  if (relPath.includes(':')) {
    console.log('[forceImageRoot] Absolut sökväg, tar bara filnamnet');
    safeRelativePath = path.basename(relPath);
  } else {
    // För relativ sökväg, normalisera men behåll strukturen
    console.log('[forceImageRoot] Relativ sökväg, behåller mappstruktur:', relPath);
    safeRelativePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
    // Ta bort eventuella leading slashes
    safeRelativePath = safeRelativePath.replace(/^[/\\]+/, '');
    console.log('[forceImageRoot] Efter normalisering:', safeRelativePath);
  }
  
  const fullPath = path.join(IMAGE_ROOT, safeRelativePath);
  
  console.log('[forceImageRoot] Final fullPath:', fullPath);
  console.log('[forceImageRoot] File exists:', fs.existsSync(fullPath));
  
  // Kolla om filen finns
  // ...existing code...
  if (!fs.existsSync(fullPath)) {
    console.error('[forceImageRoot] WARNING: File does not exist at:', fullPath);
  }
  
  return fullPath;
  // --- Endast Arkiv-meny ---
  const archiveMenu = [
    {
      label: 'Arkiv',
      submenu: [
        { label: 'Ny databas', click: () => win.webContents.send('menu-action', 'new-database') },
        { label: 'Öppna...', click: () => win.webContents.send('menu-action', 'open-database') },
        { label: 'Senaste fil...', click: () => win.webContents.send('menu-action', 'recent-files') },
        { type: 'separator' },
        { label: 'Spara', click: () => win.webContents.send('menu-action', 'save-database') },
        { label: 'Spara som...', click: () => win.webContents.send('menu-action', 'save-as-database') },
        { type: 'separator' },
        { label: 'Exportera...', click: () => win.webContents.send('menu-action', 'export-data') },
        { label: 'Importera...', click: () => win.webContents.send('menu-action', 'import-data') },
        { type: 'separator' },
        { label: 'Stäng databas', click: () => win.webContents.send('menu-action', 'close-database') },
        { type: 'separator' },
        { label: 'Inställningar...', click: () => win.webContents.send('menu-action', 'settings') },
        { label: 'Skriv ut...', click: () => win.webContents.send('menu-action', 'print') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(archiveMenu));
}

// IPC handler for saving a file
// IPC handler for creating a new SQLite database (with Save As dialog)
ipcMain.handle('create-new-database', async (event) => {
  const { dialog } = require('electron');
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win, {
    title: 'Skapa ny databas',
    defaultPath: 'min_slakt.db',
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite'] }
    ]
  });
  if (result.canceled || !result.filePath) return null;
  const dbPath = result.filePath;
  const data = { people: [], sources: [], places: [], relations: [], media: [], meta: {} };
  try {
    const { saveDatabaseData } = await import('../electron/databaseHandler.js');
    await saveDatabaseData(dbPath, data);
  } catch (err) {
    console.error('Kunde inte skapa databas:', err);
    return null;
  }
  // Returnera ett objekt med rätt initialstruktur
  return {
    people: [],
    relations: [],
    dbPath
  };
});
ipcMain.handle('save-file', async (event, filePath, data) => {
    // FULL LOGGNING AV TECKENKODNING
    if (typeof filePath === 'string') {
      console.log('[save-file] filePath (string):', filePath);
      console.log('[save-file] filePath charCodes:', Array.from(filePath).map(c => c.charCodeAt(0)));
    } else {
      console.log('[save-file] filePath (NOT string!):', filePath);
    }
    // ...existing code...
    let dbPath = forceImageRoot(filePath);
    console.log('[save-file] dbPath:', dbPath);
    try {
      const fs = require('fs');
      const existsBefore = fs.existsSync(dbPath);
      const sizeBefore = existsBefore ? fs.statSync(dbPath).size : 0;
      console.log(`[save-file] Filen finns före: ${existsBefore}, storlek före: ${sizeBefore} bytes`);
      if (!dbPath.endsWith('.db') && !dbPath.endsWith('.sqlite')) {
        console.error('[save-file] Fel: Filen måste ha ändelsen .db eller .sqlite');
        return { error: 'Filen måste ha ändelsen .db eller .sqlite', filePath: dbPath };
      }
      const peopleCount = data && Array.isArray(data.people) ? data.people.length : 0;
      
      const { saveDatabaseData } = await import('../electron/databaseHandler.js');
      await saveDatabaseData(dbPath, data);

      const existsAfter = fs.existsSync(dbPath);
      const sizeAfter = existsAfter ? fs.statSync(dbPath).size : 0;
      console.log(`[save-file] Filen finns efter: ${existsAfter}, storlek efter: ${sizeAfter} bytes`);
      console.log('[save-file] ✅ Sparning via databaseHandler slutförd');
      return { success: true, savedPath: dbPath, sizeBefore, sizeAfter };
    } catch (err) {
      console.error('[save-file] ERROR:', err);
      return { error: err.message, details: err, filePath: dbPath };
    }
});

// Hjälpfunktion för att rekursivt söka efter en fil i en mapp och dess undermappar
async function findFileInDirectory(dirPath, fileName) {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    // Först kolla om filen finns direkt i denna mapp
    for (const entry of entries) {
      if (entry.isFile() && entry.name === fileName) {
        const fullPath = path.join(dirPath, entry.name);
        console.log('[findFileInDirectory] ✅ Hittade fil direkt:', fullPath);
        return fullPath;
      }
    }
    
    // Om filen inte hittades, sök rekursivt i undermappar
    console.log('[findFileInDirectory] Söker i undermappar av:', dirPath);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDirPath = path.join(dirPath, entry.name);
        console.log('[findFileInDirectory] Söker i undermapp:', subDirPath);
        const found = await findFileInDirectory(subDirPath, fileName);
        if (found) {
          console.log('[findFileInDirectory] ✅ Hittade fil i undermapp:', found);
          return found;
        }
      }
    }
    
    console.log('[findFileInDirectory] Filen hittades inte i:', dirPath);
    return null;
  } catch (err) {
    console.error('[findFileInDirectory] Fel vid sökning i:', dirPath, err.message);
    return null;
  }
}

// IPC handler for reading a file
// VIKTIGT: Denna handler använder ALLTID relativa sökvägar från media/ mappen
// och söker rekursivt i alla undermappar om filen inte hittas direkt
ipcMain.handle('read-file', async (event, filePath) => {
  const path = require('path');
  const IMAGE_ROOT = path.join(__dirname, '..', 'media');
  
  // VIKTIGT: Konvertera alla sökvägar till relativa sökvägar från media/ mappen
  // BEHÅLL mappstrukturen (t.ex. persons/filename.png)
  let relativePath = filePath;
  
  console.log('[read-file] IN (filePath):', filePath);
  
  // Om filePath är en media:// URL, ta bort prefixet och dekoda URL-encodingen
  if (filePath && filePath.startsWith('media://')) {
    relativePath = filePath.replace('media://', '');
    // Dekoda URL-encoding (hantera %2F, %20, etc.)
    try {
      relativePath = decodeURIComponent(relativePath);
    } catch (e) {
      // Om decodeURIComponent misslyckas, försök manuellt
      relativePath = relativePath.replace(/%2F/g, '/').replace(/%20/g, ' ').replace(/%5C/g, '\\');
    }
    console.log('[read-file] Decoded media:// URL till relativ sökväg:', relativePath);
  }
  
  // Om det är en absolut sökväg (innehåller ':'), extrahera bara filnamnet
  // MEN: Om det redan är en relativ sökväg med mappstruktur (t.ex. persons/filename.png), behåll den!
  if (relativePath.includes(':')) {
    // Detta är en absolut sökväg - ta bara filnamnet
    relativePath = path.basename(relativePath);
    console.log('[read-file] Absolut sökväg konverterad till filnamn:', relativePath);
  }
  
  // Ta bort eventuella leading slashes och normalisera
  relativePath = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
  
  // Ta bort 'media/' om det finns i början (men BEHÅLL resten av mappstrukturen)
  if (relativePath.startsWith('media/')) {
    relativePath = relativePath.slice(6);
  }
  
  console.log('[read-file] Relativ sökväg (efter normalisering):', relativePath);
  
  try {
    // Kontrollera att IMAGE_ROOT finns
    if (!fs.existsSync(IMAGE_ROOT)) {
      console.error('[read-file] ❌ IMAGE_ROOT finns inte:', IMAGE_ROOT);
      return { error: `Media-mappen finns inte: ${IMAGE_ROOT}` };
    }
    
    // Försök först läsa filen på den exakta relativa sökvägen
    const exactPath = path.join(IMAGE_ROOT, relativePath);
    console.log('[read-file] Försöker exakt sökväg:', relativePath, '->', exactPath);
    console.log('[read-file] IMAGE_ROOT:', IMAGE_ROOT);
    
    if (fs.existsSync(exactPath)) {
      console.log('[read-file] ✅ Filen hittades på exakt sökväg:', relativePath);
      try {
        const data = await fs.promises.readFile(exactPath);
        console.log('[read-file] ✅ Filen lästes framgångsrikt från exakt sökväg');
        return data;
      } catch (readErr) {
        console.error('[read-file] Fel vid läsning av exakt sökväg:', readErr.message);
        // Fortsätt till rekursiv sökning
      }
    } else {
      console.log('[read-file] Filen finns inte på exakt sökväg:', exactPath);
      console.log('[read-file] Kontrollerar om mappen finns:', path.dirname(exactPath), '->', fs.existsSync(path.dirname(exactPath)));
    }
    
    // Om filen inte hittas, sök rekursivt i alla undermappar
    // VIKTIGT: Sök alltid rekursivt om exakt sökväg misslyckas
    const fileName = path.basename(relativePath);
    console.log('[read-file] Söker rekursivt i undermappar efter filnamn:', fileName);
    console.log('[read-file] Startar rekursiv sökning från:', IMAGE_ROOT);
    const foundPath = await findFileInDirectory(IMAGE_ROOT, fileName);
    
    if (foundPath && fs.existsSync(foundPath)) {
      console.log('[read-file] ✅ Hittade fil i undermapp:', foundPath);
      try {
        const data = await fs.promises.readFile(foundPath);
        return data;
      } catch (readErr) {
        console.error('[read-file] Fel vid läsning av hittad fil:', readErr.message);
        return { error: `Kunde inte läsa filen: ${readErr.message}` };
      }
    }
    
    // Om filen fortfarande inte hittas, returnera fel (använd relativ sökväg i felmeddelandet)
    console.error('[read-file] ❌ Filen hittades inte:', fileName, 'i', IMAGE_ROOT, 'eller dess undermappar');
    console.error('[read-file] Sökte efter:', relativePath, '->', exactPath);
    return { error: `Filen ${fileName} hittades inte i media-mappen eller dess undermappar` };
  } catch (err) {
    console.error('[read-file] FEL:', err.message, 'Relativ sökväg:', relativePath);
    return { error: err.message };
  }
});

const openFolder = require('./open-folder');
// IPC för att öppna mapp från renderer
ipcMain.on('open-folder', (event, folderPath) => {
  openFolder(folderPath);
});

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('[Electron] Skapar BrowserWindow med preload:', preloadPath);
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Tillåt CORS för @xenova/transformers att ladda modeller
    }
  });

  // Kolla om vi är i utvecklingsläge (om en miljövariabel är satt)
  // Detta är ett robust sätt att skilja på utveckling och produktion.
  // Du kan starta med "npm run dev" och "npm run electron" som vanligt.
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // I utvecklingsläge, ladda från Vite-servern.
    console.log('[Electron] Laddar Vite dev-server i Electron!');
    win.loadURL('http://localhost:5100');
    win.webContents.openDevTools();
  } else {
    // I produktionsläge, ladda den byggda filen.
    console.log('[Electron] Laddar byggd index.html i Electron!');
    win.loadFile(path.join(__dirname, '../dist/index.html'));
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


app.whenReady().then(() => {
  createApplicationMenu();
  
  // Konfigurera session för att tillåta Hugging Face requests (för TrOCR)
  const { session } = require('electron');
  const defaultSession = session.defaultSession;
  
  // Tillåt CORS för Hugging Face
  defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.url.includes('huggingface.co')) {
      details.requestHeaders['Origin'] = 'https://huggingface.co';
      details.requestHeaders['Referer'] = 'https://huggingface.co/';
    }
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Tillåt CORS-responser från Hugging Face
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.includes('huggingface.co')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Access-Control-Allow-Origin': ['*'],
          'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          'Access-Control-Allow-Headers': ['*'],
        },
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
  
  // Registrera custom protocol för media-bilder
  // Registrera custom protocol för media-bilder med rekursiv sökning
  protocol.registerFileProtocol('media', async (request, callback) => {
    try {
      const encodedName = request.url.replace('media://', '');
      let relativePath = decodeURIComponent(encodedName);
      
      // Normalisera sökvägen (ta bort leading slashes, konvertera backslashes)
      relativePath = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/');
      
      // Ta bort 'media/' om det finns i början
      if (relativePath.startsWith('media/')) {
        relativePath = relativePath.slice(6);
      }
      
      console.log('[media protocol] Relativ sökväg:', relativePath);
      
      // Först försök hitta filen på exakt sökväg
      const exactPath = path.join(IMAGE_ROOT, relativePath);
      if (fs.existsSync(exactPath)) {
        console.log('[media protocol] ✅ Filen hittades på exakt sökväg:', relativePath);
        callback({ path: exactPath });
        return;
      }
      
      // Om filen inte hittas, sök rekursivt i alla undermappar
      console.log('[media protocol] Filen hittades inte, söker rekursivt...');
      const fileName = path.basename(relativePath);
      const foundPath = await findFileInDirectory(IMAGE_ROOT, fileName);
      
      if (foundPath && fs.existsSync(foundPath)) {
        console.log('[media protocol] ✅ Hittade fil i undermapp:', foundPath);
        callback({ path: foundPath });
        return;
      }
      
      // Om filen fortfarande inte hittas, returnera fel
      console.error('[media protocol] ❌ Filen hittades inte:', fileName);
      callback({ error: -6 }); // FILE_NOT_FOUND error code
    } catch (err) {
      console.error('[media protocol] FEL:', err.message);
      callback({ error: -6 });
    }
  });
  createWindow();
});

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
ipcMain.handle('read-dir', async (event, dirPath) => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    return files.map(f => ({ name: f.name, isDirectory: f.isDirectory() }));
  } catch (err) {
    return { error: err.message };
  }
});

// All JSON audit-debug hantering borttagen

// IPC handler for saving an audit backup into the app's userData folder.
ipcMain.handle('save-audit-backup', async (event, fileName, data, dir) => {
  try {
    // If caller provided an absolute directory, write there. Otherwise default to app userData/audit-backups
    let backupDir;
    if (dir && typeof dir === 'string' && path.isAbsolute(dir)) {
      backupDir = path.normalize(dir);
    } else {
      const userData = app.getPath('userData');
      backupDir = path.join(userData, 'audit-backups');
    }
    await fs.promises.mkdir(backupDir, { recursive: true });
    // Use the filename provided by the caller when possible (sanitized),
    // otherwise fall back to a timestamped audit file.
    const requestedName = (typeof fileName === 'string' && fileName.trim()) ? fileName.trim() : null;
    const safeName = requestedName ? path.basename(requestedName) : `audit_backup-${Date.now()}.json`;
    const outPath = path.join(backupDir, safeName);
    const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await fs.promises.writeFile(outPath, payload, 'utf8');
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

ipcMain.handle('export-gedcom', async (event, dbData, options = {}) => {
  try {
    const senderWin = event && event.sender ? BrowserWindow.fromWebContents(event.sender) : null;
    const win = senderWin || BrowserWindow.getFocusedWindow();
    if (!win) {
      return { error: 'No focused window' };
    }

    // 1. Generate GEDCOM text
    const writeResult = await gedcomHandler.writeGedcom(dbData, options);
    if (writeResult.error) {
      return writeResult;
    }

    // 2. Show save dialog
    const saveResult = await dialog.showSaveDialog(win, {
      title: 'Exportera som GEDCOM',
      defaultPath: `WestFamilyTree_${new Date().toISOString().split('T')[0]}.ged`,
      filters: [
        { name: 'GEDCOM-filer', extensions: ['ged'] },
        { name: 'Alla filer', extensions: ['*'] }
      ]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    // 3. Write file to disk with UTF-8 encoding
    const filePath = saveResult.filePath;
    await fs.promises.writeFile(filePath, writeResult.gedcomText, 'utf8');

    console.log('[export-gedcom] Successfully exported to:', filePath);
    return {
      success: true,
      filePath,
      version: writeResult.version,
      encoding: writeResult.encoding,
      recordCounts: writeResult.recordCounts
    };
  } catch (err) {
    console.error('[export-gedcom] error:', err);
    return { error: err && err.message ? err.message : String(err) };
  }
});

// ============================================
// TrOCR MODEL DOWNLOAD HANDLER
// ============================================
// Ladda ner TrOCR-modeller via Node.js (ingen CORS-problem)
// OBS: Denna handler måste vara registrerad INNAN app.whenReady()
ipcMain.handle('download-trocr-model', async (event, modelPath) => {
  console.log('[TrOCR] download-trocr-model IPC handler called with:', modelPath);
  try {
    const https = require('https');
    const fs = require('fs').promises;
    const path = require('path');
    const { app } = require('electron');
    
    // Skapa cache-mapp i userData (matchar @xenova/transformers cache-struktur)
    const userDataPath = app.getPath('userData');
    // @xenova/transformers använder denna struktur: models--{org}--{model}
    // Exempel: models--microsoft--trocr-base-handwritten
    const modelCacheName = 'models--' + modelPath.replace(/\//g, '--');
    const cacheDir = path.join(userDataPath, '.cache', 'xenova', 'transformers', modelCacheName);
    console.log('[TrOCR] Cache directory:', cacheDir);
    
    // Kontrollera om modellen redan finns (kolla efter tokenizer.json som indikator)
    const tokenizerFile = path.join(cacheDir, 'tokenizer.json');
    try {
      await fs.access(tokenizerFile);
      console.log('[TrOCR] Model already cached:', cacheDir);
      return { success: true, cached: true, path: cacheDir };
    } catch (e) {
      // Modellen finns inte, ladda ner
    }
    
    // Skapa cache-mapp
    await fs.mkdir(cacheDir, { recursive: true });
    
    // URL för modellen - Hugging Face använder CDN med redirects
    const baseUrl = 'https://huggingface.co/' + modelPath + '/resolve/main/';
    const filesToDownload = [
      { remote: 'onnx/encoder_model.onnx', local: 'onnx/encoder_model.onnx' },
      { remote: 'onnx/decoder_model.onnx', local: 'onnx/decoder_model.onnx' },
      { remote: 'tokenizer.json', local: 'tokenizer.json' },
      { remote: 'config.json', local: 'config.json' },
      { remote: 'preprocessor_config.json', local: 'preprocessor_config.json' } // Kan behövas
    ];
    
    // Ladda ner filer
    for (const file of filesToDownload) {
      const url = baseUrl + file.remote;
      const filePath = path.join(cacheDir, file.local);
      
      // Skapa mappar om de behövs
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      console.log('[TrOCR] Downloading:', url, '->', filePath);
      
      await new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
          // Följ redirects (301, 302, 307, 308)
          if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
            const redirectUrl = response.headers.location;
            console.log('[TrOCR] Following redirect:', redirectUrl);
            https.get(redirectUrl, (redirectResponse) => {
              if (redirectResponse.statusCode === 200) {
                const fileStream = require('fs').createWriteStream(filePath);
                redirectResponse.pipe(fileStream);
                fileStream.on('finish', () => {
                  fileStream.close();
                  console.log('[TrOCR] Downloaded:', file.local);
                  resolve();
                });
                fileStream.on('error', reject);
              } else {
                reject(new Error(`Failed to download ${file.remote} after redirect: ${redirectResponse.statusCode}`));
              }
            }).on('error', reject);
          } else if (response.statusCode === 200) {
            const fileStream = require('fs').createWriteStream(filePath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              console.log('[TrOCR] Downloaded:', file.local);
              resolve();
            });
            fileStream.on('error', reject);
          } else {
            reject(new Error(`Failed to download ${file.remote}: ${response.statusCode}`));
          }
        });
        request.on('error', reject);
      });
    }
    
    console.log('[TrOCR] Model downloaded successfully to:', cacheDir);
    return { success: true, cached: false, path: cacheDir };
  } catch (error) {
    console.error('[TrOCR] Download error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-exif', async (event, filePath) => {
  try {
    const fullPath = forceImageRoot(filePath);
    console.log('[read-exif] Reading EXIF from:', fullPath);
    
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:5005/exif/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: fullPath })
    });
    
    const data = await response.json();
    console.log('[read-exif] Success:', Object.keys(data));
    return data;
  } catch (error) {
    console.error('[read-exif] Error:', error);
    return { error: error.message, face_tags: [], keywords: [], metadata: {}, camera: {}, gps: null };
  }
});

ipcMain.handle('write-exif-keywords', async (event, filePath, keywords, backup = true) => {
  try {
    const fullPath = forceImageRoot(filePath);
    console.log('[write-exif-keywords] Writing to:', fullPath, 'Keywords:', keywords);
    
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:5005/exif/write_keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: fullPath, keywords, backup })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[write-exif-keywords] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-exif-face-tags', async (event, filePath, faceTags, backup = true) => {
  try {
    const fullPath = forceImageRoot(filePath);
    console.log('[write-exif-face-tags] Writing to:', fullPath, 'Face tags:', faceTags.length);
    
    const fetch = require('node-fetch');
    const response = await fetch('http://localhost:5005/exif/write_face_tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: fullPath, face_tags: faceTags, backup })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[write-exif-face-tags] Error:', error);
    return { success: false, error: error.message };
  }
});

// Copy file to media folder
ipcMain.handle('copy-file-to-media', async (event, sourcePath, fileName) => {
  try {
    // ...existing code...
    
    // Om sourcePath är undefined, betyder det att det är en blob från webbläsare
    if (!sourcePath) {
      return { success: false, error: 'No source path provided' };
    }
    
    const destPath = path.join(IMAGE_ROOT, fileName);
    
    console.log('[copy-file-to-media] Copying:', sourcePath, '->', destPath);
    
    // Skapa media-mappen om den inte finns
      await fs.promises.mkdir(IMAGE_ROOT, { recursive: true });
    
    // Kopiera filen
      await fs.promises.copyFile(sourcePath, destPath);
    
    console.log('[copy-file-to-media] Success!');
    return { success: true, filePath: fileName };
  } catch (error) {
    console.error('[copy-file-to-media] Error:', error);
    return { success: false, error: error.message };
  }
});

// Save file buffer to media folder (för drag-and-drop och paste)
ipcMain.handle('save-file-buffer-to-media', async (event, fileBuffer, filePath) => {
  try {
    // Normalisera filePath (hantera både forward och backslashes)
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // filePath kan vara antingen bara filnamn eller sökväg med undermapp (t.ex. "persons/image.jpg")
    const destPath = path.join(IMAGE_ROOT, normalizedPath);
    
    console.log('[save-file-buffer-to-media] Saving buffer to:', destPath, 'Size:', fileBuffer.length);
    console.log('[save-file-buffer-to-media] IMAGE_ROOT:', IMAGE_ROOT);
    console.log('[save-file-buffer-to-media] filePath (normalized):', normalizedPath);
    
    // Skapa mappen (inklusive undermappar) om den inte finns
    const destDir = path.dirname(destPath);
    console.log('[save-file-buffer-to-media] Skapar mapp:', destDir);
    
    // Normalisera mapp-sökvägen
    const normalizedDir = path.normalize(destDir);
    console.log('[save-file-buffer-to-media] Normaliserad mapp-sökväg:', normalizedDir);
    
    // Skapa mappen rekursivt
    await fs.promises.mkdir(normalizedDir, { recursive: true });
    
    // Verifiera att mappen faktiskt skapades
    try {
      const stats = await fs.promises.stat(normalizedDir);
      if (!stats.isDirectory()) {
        throw new Error(`${normalizedDir} är inte en mapp`);
      }
      console.log('[save-file-buffer-to-media] Mapp verifierad:', normalizedDir);
    } catch (accessError) {
      console.error('[save-file-buffer-to-media] Mapp-verifiering misslyckades:', accessError);
      throw new Error(`Kunde inte skapa eller verifiera mapp: ${normalizedDir}. Error: ${accessError.message}`);
    }
    
    // Normalisera destPath också
    const normalizedDestPath = path.normalize(destPath);
    console.log('[save-file-buffer-to-media] Skriver fil till:', normalizedDestPath);
    
    // Skriv buffer till fil
    await fs.promises.writeFile(normalizedDestPath, Buffer.from(fileBuffer));
    
    // Verifiera att filen skapades
    const fileStats = await fs.promises.stat(normalizedDestPath);
    console.log('[save-file-buffer-to-media] Success! Fil sparad till:', normalizedDestPath, 'Storlek:', fileStats.size, 'bytes');
    
    return { success: true, filePath: normalizedPath }; // Returnera normaliserad relativ sökväg
  } catch (error) {
    console.error('[save-file-buffer-to-media] Error:', error);
    console.error('[save-file-buffer-to-media] Error stack:', error.stack);
    return { success: false, error: error.message };
  }
});

// Import images - dialog + copy to media folder
ipcMain.handle('import-images', async (event) => {
  try {
    // ...existing code...
    
    // Visa fil-dialog
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'] }
      ]
    });
    
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    // Skapa media-mappen om den inte finns
    await fs.mkdir(IMAGE_ROOT, { recursive: true });
    
    // Kopiera alla valda filer
    const importedFiles = [];
    for (const sourcePath of result.filePaths) {
      const fileName = path.basename(sourcePath);
      const destPath = path.join(IMAGE_ROOT, fileName);
      
      console.log('[import-images] Copying:', sourcePath, '->', destPath);
      
      try {
        await fs.copyFile(sourcePath, destPath);
        importedFiles.push({
          fileName: fileName,
          filePath: fileName,
          originalPath: sourcePath
        });
      } catch (error) {
        console.error('[import-images] Failed to copy:', fileName, error);
      }
    }
    
    return { success: true, files: importedFiles };
  } catch (error) {
    console.error('[import-images] Error:', error);
    return { success: false, error: error.message };
  }
});

// Flytta fil till papperskorgen
ipcMain.handle('move-file-to-trash', async (event, filePath) => {
	try {
		const path = require('path');
		const fs = require('fs');
		const IMAGE_ROOT = path.join(__dirname, '..', 'media');
		const TRASH_ROOT = path.join(IMAGE_ROOT, '.trash');
		
		const normalizedPath = path.normalize(filePath);
		
		// Försök hitta filen - testa olika sökvägar
		let sourcePath = null;
		let relativePath = null;
		
		// Testa om filePath redan är absolut
		if (path.isAbsolute(normalizedPath)) {
			sourcePath = normalizedPath;
			relativePath = path.relative(IMAGE_ROOT, sourcePath).replace(/\\/g, '/');
		} else {
			// Testa olika möjliga sökvägar
			const possiblePaths = [
				path.join(IMAGE_ROOT, normalizedPath), // Direkt
				path.join(IMAGE_ROOT, 'persons', normalizedPath), // persons/
				path.join(IMAGE_ROOT, 'sources', normalizedPath), // sources/
				path.join(IMAGE_ROOT, 'places', normalizedPath), // places/
			];
			
			for (const testPath of possiblePaths) {
				if (fs.existsSync(testPath)) {
					sourcePath = testPath;
					relativePath = path.relative(IMAGE_ROOT, testPath).replace(/\\/g, '/');
					console.log('[move-file-to-trash] Hittade fil på:', relativePath);
					break;
				}
			}
		}
		
		if (!sourcePath || !fs.existsSync(sourcePath)) {
			console.error('[move-file-to-trash] Fil finns inte:', {
				filePath,
				normalizedPath,
				testedPaths: possiblePaths
			});
			return { success: false, error: 'Fil finns inte' };
		}
		
		// Skapa papperskorg-mapp om den inte finns
		await fs.promises.mkdir(TRASH_ROOT, { recursive: true });
		
		// Skapa unikt filnamn i papperskorgen (lägg till timestamp och originalPath)
		const fileName = path.basename(sourcePath);
		const timestamp = Date.now();
		// Spara originalPath i filnamnet: timestamp_originalPath_filename
		const pathHash = relativePath.replace(/\//g, '_').replace(/\\/g, '_');
		const trashFileName = `${timestamp}_${pathHash}_${fileName}`;
		const trashPath = path.join(TRASH_ROOT, trashFileName);
		
		// Flytta filen
		await fs.promises.rename(sourcePath, trashPath);
		
		console.log('[move-file-to-trash] ✅ Fil flyttad till papperskorg:', {
			source: sourcePath,
			relativePath: relativePath,
			destination: trashPath,
			trashFileName: trashFileName
		});
		
		return { success: true, trashPath: `.trash/${trashFileName}`, originalPath: relativePath };
	} catch (error) {
		console.error('[move-file-to-trash] Error:', error);
		return { success: false, error: error.message };
	}
});

// Hämta filer i papperskorgen
ipcMain.handle('get-trash-files', async (event) => {
	try {
		const path = require('path');
		const fs = require('fs');
		const IMAGE_ROOT = path.join(__dirname, '..', 'media');
		const TRASH_ROOT = path.join(IMAGE_ROOT, '.trash');
		
		if (!fs.existsSync(TRASH_ROOT)) {
			return { success: true, files: [] };
		}
		
		const entries = await fs.promises.readdir(TRASH_ROOT, { withFileTypes: true });
		const files = [];
		
		for (const entry of entries) {
			if (entry.isFile()) {
				const fullPath = path.join(TRASH_ROOT, entry.name);
				const stats = await fs.promises.stat(fullPath);
				const parts = entry.name.split('_');
				const timestamp = parseInt(parts[0]);
				
				// Nytt format: timestamp_pathHash_filename
				// Gammalt format: timestamp_filename
				let originalName, originalPath;
				if (parts.length >= 3) {
					// Nytt format - extrahera originalPath och filename
					// Format: timestamp_persons_2772.jpg_2772.jpg
					// pathHash = parts.slice(1, -1) = ['persons', '2772', 'jpg']
					// Vi behöver identifiera kända mappar för att korrekt återställa sökvägen
					const pathHashParts = parts.slice(1, -1);
					const fileName = parts[parts.length - 1];
					
					// Försök identifiera kända mappar i början
					const knownFolders = ['persons', 'sources', 'places', 'temp'];
					let foundFolder = null;
					let folderIndex = -1;
					
					for (const folder of knownFolders) {
						if (pathHashParts[0] === folder) {
							foundFolder = folder;
							folderIndex = 1;
							break;
						}
					}
					
					if (foundFolder && pathHashParts.length > folderIndex) {
						// Vi har hittat en känd mapp
						// Allt efter mappen är filnamnet (kan innehålla _)
						const remainingParts = pathHashParts.slice(folderIndex);
						if (remainingParts.length > 0) {
							// Om det finns fler delar, kan det vara fler mappar eller del av filnamn
							// Om sista delen matchar fileName (utan extension), är det troligen filnamn
							const lastPart = remainingParts[remainingParts.length - 1];
							if (lastPart === fileName || lastPart === fileName.split('.')[0]) {
								// Det är filnamnet, använd bara mappen
								originalPath = `${foundFolder}/${fileName}`;
							} else {
								// Det kan vara fler mappar, konvertera _ till /
								originalPath = `${foundFolder}/${remainingParts.join('/')}/${fileName}`;
							}
						} else {
							// Inget efter mappen, använd bara mappen + filnamn
							originalPath = `${foundFolder}/${fileName}`;
						}
					} else {
						// Ingen känd mapp hittad - försök konvertera första _ till /
						if (pathHashParts.length > 1) {
							originalPath = pathHashParts[0] + '/' + pathHashParts.slice(1).join('_') + '/' + fileName;
						} else {
							originalPath = pathHashParts[0] + '/' + fileName;
						}
					}
					
					originalName = fileName;
				} else {
					// Gammalt format - bara filnamn
					originalName = parts.slice(1).join('_');
					originalPath = null; // Vi vet inte var den låg
				}
				
				const daysOld = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
				
				files.push({
					name: entry.name,
					originalName: originalName,
					originalPath: originalPath, // Spara originalPath om den finns
					path: `.trash/${entry.name}`,
					size: stats.size,
					deletedAt: new Date(timestamp).toISOString(),
					daysOld: daysOld,
					willBeDeleted: daysOld >= 30
				});
			}
		}
		
		// Sortera efter datum (nyast först)
		files.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
		
		return { success: true, files };
	} catch (error) {
		console.error('[get-trash-files] Error:', error);
		return { success: false, error: error.message, files: [] };
	}
});

// Återställ fil från papperskorgen
ipcMain.handle('restore-file-from-trash', async (event, trashFileName, originalPath) => {
	try {
		const path = require('path');
		const fs = require('fs');
		const IMAGE_ROOT = path.join(__dirname, '..', 'media');
		const TRASH_ROOT = path.join(IMAGE_ROOT, '.trash');
		
		const trashPath = path.join(TRASH_ROOT, trashFileName);
		
		console.log('[restore-file-from-trash] Försöker återställa:', {
			trashFileName,
			originalPath,
			trashPath,
			trashExists: fs.existsSync(trashPath)
		});
		
		if (!fs.existsSync(trashPath)) {
			console.error('[restore-file-from-trash] ❌ Fil finns inte i papperskorgen:', trashPath);
			return { success: false, error: 'Fil finns inte i papperskorgen' };
		}
		
		// Extrahera originalPath från trash-filnamn om den inte skickades med
		let finalOriginalPath = originalPath;
		if (!finalOriginalPath) {
			// Försök extrahera från trash-filnamn (nytt format: timestamp_pathHash_filename)
			// Format: timestamp_persons_image.jpg_image.jpg
			// Problemet: vi kan inte skilja mellan _ som är del av filnamnet och _ som ersätter /
			// Lösning: använd kända mappar (persons, sources, places, temp) som referenspunkter
			const parts = trashFileName.split('_');
			if (parts.length >= 3) {
				// Hitta sista delen (filnamnet med extension)
				const fileName = parts[parts.length - 1];
				
				// Allt mellan timestamp och filnamnet är pathHash
				const pathHash = parts.slice(1, -1).join('_');
				
				// Försök identifiera kända mappar i början
				const knownFolders = ['persons', 'sources', 'places', 'temp'];
				let foundFolder = null;
				let folderIndex = -1;
				
				for (const folder of knownFolders) {
					const index = pathHash.indexOf(folder);
					if (index === 0) {
						// Mappen är i början
						foundFolder = folder;
						folderIndex = folder.length;
						break;
					}
				}
				
				if (foundFolder) {
					// Vi har hittat en känd mapp
					const afterFolder = pathHash.substring(folderIndex);
					if (afterFolder.startsWith('_')) {
						// Efter mappen finns mer - detta kan vara fler mappar eller del av filnamn
						// Om det ser ut som en mapp (inte innehåller .), konvertera _ till /
						const remaining = afterFolder.substring(1);
						if (remaining.includes('.')) {
							// Det innehåller en punkt - troligen del av filnamn, använd bara mappen
							finalOriginalPath = `${foundFolder}/${fileName}`;
						} else {
							// Det ser ut som en mappstruktur, konvertera _ till /
							finalOriginalPath = `${foundFolder}/${remaining.replace(/_/g, '/')}/${fileName}`;
						}
					} else {
						// Inget efter mappen, använd bara mappen + filnamn
						finalOriginalPath = `${foundFolder}/${fileName}`;
					}
				} else {
					// Ingen känd mapp hittad - detta kan vara ett filnamn med _ eller en okänd mapp
					// Om pathHash innehåller en punkt, är det troligen del av filnamnet
					if (pathHash.includes('.')) {
						// Det ser ut som ett filnamn, använd root
						finalOriginalPath = fileName;
					} else {
						// Försök konvertera första _ till / om det finns
						const firstUnderscore = pathHash.indexOf('_');
						if (firstUnderscore > 0) {
							finalOriginalPath = pathHash.substring(0, firstUnderscore) + '/' + pathHash.substring(firstUnderscore + 1) + '/' + fileName;
						} else {
							finalOriginalPath = pathHash + '/' + fileName;
						}
					}
				}
				
				console.log('[restore-file-from-trash] Extraherade originalPath från filnamn:', {
					trashFileName,
					pathHash,
					foundFolder,
					finalOriginalPath
				});
			}
		}
		
		// Bestäm destination baserat på originalPath eller filnamn
		let destPath;
		if (finalOriginalPath && !finalOriginalPath.startsWith('.trash/') && !finalOriginalPath.includes('..')) {
			// Normalisera sökvägen - ta bort eventuella dubbla separators
			const normalizedPath = finalOriginalPath.replace(/\/+/g, '/').replace(/\\+/g, '/');
			// Använd originalPath direkt
			destPath = path.join(IMAGE_ROOT, normalizedPath);
			console.log('[restore-file-from-trash] Använder originalPath:', destPath);
		} else {
			// Extrahera originalnamn från trash-filnamn
			const parts = trashFileName.split('_');
			const originalName = parts.length >= 3 ? parts[parts.length - 1] : trashFileName.substring(trashFileName.indexOf('_') + 1);
			
			// Försök gissa mapp - kolla om det finns en persons/ mapp
			const testPath = path.join(IMAGE_ROOT, 'persons', originalName);
			if (fs.existsSync(path.dirname(testPath))) {
				destPath = testPath;
				console.log('[restore-file-from-trash] Gissar persons/ från filnamn:', destPath);
			} else {
				destPath = path.join(IMAGE_ROOT, originalName);
				console.log('[restore-file-from-trash] Använder root från filnamn:', destPath);
			}
		}
		
		// Skapa mappar om de inte finns
		const destDir = path.dirname(destPath);
		await fs.promises.mkdir(destDir, { recursive: true });
		console.log('[restore-file-from-trash] Skapade mapp:', destDir);
		
		// Flytta tillbaka filen
		await fs.promises.rename(trashPath, destPath);
		
		const relativePath = path.relative(IMAGE_ROOT, destPath);
		console.log('[restore-file-from-trash] ✅ Fil återställd:', {
			trash: trashPath,
			destination: destPath,
			relativePath: relativePath
		});
		
		return { success: true, filePath: relativePath.replace(/\\/g, '/') };
	} catch (error) {
		console.error('[restore-file-from-trash] ❌ Error:', error);
		return { success: false, error: error.message };
	}
});

// Permanent radera fil från papperskorgen
ipcMain.handle('permanently-delete-from-trash', async (event, trashFileName) => {
	try {
		const path = require('path');
		const fs = require('fs');
		const IMAGE_ROOT = path.join(__dirname, '..', 'media');
		const TRASH_ROOT = path.join(IMAGE_ROOT, '.trash');
		
		const trashPath = path.join(TRASH_ROOT, trashFileName);
		
		if (!fs.existsSync(trashPath)) {
			return { success: false, error: 'Fil finns inte i papperskorgen' };
		}
		
		await fs.promises.unlink(trashPath);
		
		console.log('[permanently-delete-from-trash] ✅ Fil permanent raderad:', trashPath);
		
		return { success: true };
	} catch (error) {
		console.error('[permanently-delete-from-trash] Error:', error);
		return { success: false, error: error.message };
	}
});

// Töm papperskorgen (radera filer äldre än 30 dagar)
ipcMain.handle('empty-trash', async (event, olderThanDays = 30) => {
	try {
		const path = require('path');
		const fs = require('fs');
		const IMAGE_ROOT = path.join(__dirname, '..', 'media');
		const TRASH_ROOT = path.join(IMAGE_ROOT, '.trash');
		
		if (!fs.existsSync(TRASH_ROOT)) {
			return { success: true, deletedCount: 0 };
		}
		
		const entries = await fs.promises.readdir(TRASH_ROOT, { withFileTypes: true });
		let deletedCount = 0;
		const now = Date.now();
		const maxAge = olderThanDays * 24 * 60 * 60 * 1000;
		
		for (const entry of entries) {
			if (entry.isFile()) {
				const fullPath = path.join(TRASH_ROOT, entry.name);
				const timestamp = parseInt(entry.name.split('_')[0]);
				const age = now - timestamp;
				
				if (age >= maxAge) {
					try {
						await fs.promises.unlink(fullPath);
						deletedCount++;
						console.log('[empty-trash] ✅ Raderad fil:', entry.name);
					} catch (err) {
						console.error('[empty-trash] Error raderar fil:', entry.name, err);
					}
				}
			}
		}
		
		console.log(`[empty-trash] ✅ Tömt papperskorg: ${deletedCount} filer raderade`);
		
		return { success: true, deletedCount };
	} catch (error) {
		console.error('[empty-trash] Error:', error);
		return { success: false, error: error.message, deletedCount: 0 };
	}
});

// Skanna media-mappen och returnera alla bilder
// OBS: Denna handler måste registreras tidigt, innan appen är klar
ipcMain.handle('scan-media-folder', async (event) => {
  console.log('[scan-media-folder] Handler anropad');
  try {
    const result = await scanMediaFolder();
    console.log('[scan-media-folder] Resultat:', { success: result.success, antal: result.media?.length || 0 });
    return result;
  } catch (error) {
    console.error('[scan-media-folder] Error:', error);
    return { success: false, error: error.message, media: [] };
  }
});

// Get media file path (för att visa bilder från media-mappen)
ipcMain.handle('get-media-path', async (event, fileName) => {
  const fullPath = path.join(IMAGE_ROOT, fileName);
  return fullPath;
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

ipcMain.handle('save-as-database', async (event, data) => {
  console.log('[main.js:save-as-database] IPC-anrop mottaget. Data-nycklar:', data ? Object.keys(data) : 'ingen data');
  global.__E2E_LAST_SAVE_AS_RESULT = { status: 'started' };
  const { dialog } = require('electron');
  const win = BrowserWindow.getFocusedWindow();
  console.log('[main.js:save-as-database] Fokuserat fönster (win) existerar?', !!win);

  try {
    global.__E2E_LAST_SAVE_AS_RESULT = { status: 'dialog_opening', winExists: !!win };
    const result = await dialog.showSaveDialog(win, {
      title: 'Spara som...',
      defaultPath: 'min_slakt.db',
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite'] }
      ]
    });
    console.log('[main.js:save-as-database] dialog-resultat:', result);

    if (result.canceled || !result.filePath) {
      console.log('[main.js:save-as-database] Avbruten av användaren eller ingen filePath');
      global.__E2E_LAST_SAVE_AS_RESULT = { status: 'canceled', result };
      return { error: 'Avbruten av användare' };
    }

    const dbPath = result.filePath;
    console.log('[main.js:save-as-database] Skriver till sökväg:', dbPath);
    global.__E2E_LAST_SAVE_AS_RESULT = { status: 'saving', dbPath };
    const { saveDatabaseData } = await import('../electron/databaseHandler.js');
    const saveResult = await saveDatabaseData(dbPath, data || {});
    console.log('[main.js:save-as-database] saveDatabaseData slutförd:', saveResult);

    global.__E2E_LAST_SAVE_AS_RESULT = { status: 'success', dbPath, saveResult };
    // Return an object for frontend fileHandle
    return { name: dbPath.split(/[\\/]/).pop(), path: dbPath, success: true };
  } catch (err) {
    console.error('[main.js:save-as-database] Oväntat fel:', err);
    global.__E2E_LAST_SAVE_AS_RESULT = { status: 'error', error: err.message, stack: err.stack };
    return { error: err.message || 'Okänt fel i huvudprocessen' };
  }
});

ipcMain.handle('get-last-save-as-result', async () => {
  return global.__E2E_LAST_SAVE_AS_RESULT || null;
});