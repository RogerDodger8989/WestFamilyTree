console.log('[PRELOAD-TEST] preload-test.js STARTAR:', __filename);
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  test: () => 'preload-test works!'
});
