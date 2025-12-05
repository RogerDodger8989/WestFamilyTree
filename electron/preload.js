const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (filePath, data) => ipcRenderer.invoke('save-file', filePath, data),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  readDir: (dirPath) => ipcRenderer.invoke('read-dir', dirPath),
  openFolder: (folderPath) => ipcRenderer.send('open-folder', folderPath),
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),
  
  // ✅ TILLAGD: Bryggan för din nya GEDCOM-import
  importGedcom: (data) => ipcRenderer.invoke('import-gedcom', data),

  // GEDCOM helpers
  gedcomRead: (filePath) => ipcRenderer.invoke('gedcom:read', filePath),
  gedcomApply: (parsed, options) => ipcRenderer.invoke('gedcom:apply', parsed, options),
  gedcomWrite: (dbData, options) => ipcRenderer.invoke('gedcom:write', dbData, options),
  // Save an audit backup file into the app user-data folder (audit-backups)
  saveAuditBackup: (fileName, data, dir) => ipcRenderer.invoke('save-audit-backup', fileName, data, dir),
  // Open the audit backup folder (or provided folder)
  openAuditBackupFolder: (dir) => ipcRenderer.invoke('open-audit-backup-folder', dir),
  // Read latest audit debug JSON (gedcom-debug*.json) from the audit-backups folder
  readLatestAuditDebug: () => ipcRenderer.invoke('read-latest-audit-debug'),
  
  // EXIF operations
  readExif: (filePath) => ipcRenderer.invoke('read-exif', filePath),
  writeExifKeywords: (filePath, keywords, backup) => ipcRenderer.invoke('write-exif-keywords', filePath, keywords, backup),
  writeExifFaceTags: (filePath, faceTags, backup) => ipcRenderer.invoke('write-exif-face-tags', filePath, faceTags, backup),
  
  // Media operations
  copyFileToMedia: (sourcePath, fileName) => ipcRenderer.invoke('copy-file-to-media', sourcePath, fileName),
  saveFileBufferToMedia: (fileBuffer, fileName) => ipcRenderer.invoke('save-file-buffer-to-media', fileBuffer, fileName),
  importImages: () => ipcRenderer.invoke('import-images'),
});

// --- Kod för kontextmeny ---
contextBridge.exposeInMainWorld('electron', {
  // Funktion för att be huvudprocessen visa en kontextmeny för en person
  // Skickar från React -> Electron
  showPersonContextMenu: (personId) => ipcRenderer.send('show-person-context-menu', personId),

  // Funktion som låter React lyssna på kommandon från menyn
  // Tar emot från Electron -> React
  onContextMenuCommand: (callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on('context-menu-command', listener);
    return () => ipcRenderer.removeListener('context-menu-command', listener);
  }
});