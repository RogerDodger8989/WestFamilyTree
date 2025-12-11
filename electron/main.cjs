const sqlite3 = require('sqlite3').verbose();
const { ipcMain, app, BrowserWindow, Menu, protocol, dialog } = require('electron');
// IPC handler for creating a new SQLite database (with Save As dialog)
ipcMain.handle('create-new-database', async (event) => {
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
	const db = new sqlite3.Database(dbPath);
	// Initiera tabeller om de inte finns
	await new Promise((resolve, reject) => {
		db.serialize(() => {
			db.run(`CREATE TABLE IF NOT EXISTS people (
				id TEXT PRIMARY KEY,
				refNumber INTEGER,
				firstName TEXT,
				lastName TEXT,
				gender TEXT,
				events TEXT,
				notes TEXT,
				links TEXT,
				relations TEXT
			)`, (err) => {
				if (err) reject(err);
				else resolve();
			});
			// Skapa även relations-tabellen
			db.run(`CREATE TABLE IF NOT EXISTS relations (
				id TEXT PRIMARY KEY,
				person1Id TEXT,
				person2Id TEXT,
				type TEXT,
				details TEXT
			)`, (err) => {
				if (err) reject(err);
			});
		});
	});
	db.close();
	// Returnera ett objekt med rätt initialstruktur
	return {
		people: [],
		relations: [],
		dbPath
	};
});
console.log('WestFamilyTree Electron main.js loaded:', __filename);
console.log('Node version:', process.version);
console.log('Electron version:', process.versions.electron);
console.log('IPC-handlers for last-opened-file are active!');
try {

// --- Kopierat från main.js ---
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

function createWindow() {
	const path = require('path');
	const preloadPath = path.resolve(__dirname, 'preload-test.js');
	console.log('[Electron] Skapar BrowserWindow med preload:', preloadPath);
	const win = new BrowserWindow({
		width: 1200,
		height: 900,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			enableRemoteModule: false,
			sandbox: false
		}
	});

	// Kolla om vi är i utvecklingsläge (om en miljövariabel är satt)
	// Ladda alltid den byggda filen (dist/index.html) för att preload och Electron-API ska fungera
	console.log('[Electron] Laddar byggd index.html i Electron!');
	win.loadFile(path.join(__dirname, 'test_index.html'));
}
	// Inställnings-store för senaste fil
	const { loadSettings, saveSettings } = require('./settingsStore.cjs');

	const { ipcMain, app, BrowserWindow, Menu, protocol } = require('electron');
	// IPC handler for saving the entire database (people, sources, places, meta)
	ipcMain.handle('save-database', async (event, fileHandle, data) => {
	// DEBUG: Logga vad som sparas (allra först)
	const dbPath = fileHandle && fileHandle.path ? fileHandle.path : fileHandle;
	console.log('SPARAR TILL SQLITE:', {
		dbPath,
		antalPersoner: Array.isArray(data?.people) ? data.people.length : 'ej array',
		personer: (Array.isArray(data?.people) && data.people.length > 0) ? data.people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })) : data?.people
	});
	const sqlite3 = require('sqlite3').verbose();
	if (!dbPath) return { error: 'Ingen fil angiven' };
	try {
		const db = new sqlite3.Database(dbPath);
		// Create tables if missing
		await new Promise((resolve, reject) => {
			db.run(`CREATE TABLE IF NOT EXISTS people (
				id TEXT PRIMARY KEY,
				refNumber INTEGER,
				firstName TEXT,
				lastName TEXT,
				gender TEXT,
				events TEXT,
				notes TEXT,
				links TEXT,
				relations TEXT
			)`, err => err ? reject(err) : resolve());
		});
		await new Promise((resolve, reject) => {
			db.run(`CREATE TABLE IF NOT EXISTS sources (
				id TEXT PRIMARY KEY,
				title TEXT,
				archive TEXT,
				volume TEXT,
				page TEXT,
				date TEXT,
				tags TEXT,
				note TEXT,
				aid TEXT,
				nad TEXT,
				bildid TEXT,
				imagePage TEXT,
				dateAdded TEXT,
				trust INTEGER
			)`, err => err ? reject(err) : resolve());
		});
		await new Promise((resolve, reject) => {
			db.run(`CREATE TABLE IF NOT EXISTS places (
				id TEXT PRIMARY KEY,
				country TEXT,
				region TEXT,
				municipality TEXT,
				parish TEXT,
				village TEXT,
				specific TEXT,
				matched_place_id TEXT
			)`, err => err ? reject(err) : resolve());
		});
		await new Promise((resolve, reject) => {
			db.run(`CREATE TABLE IF NOT EXISTS meta (
				key TEXT PRIMARY KEY,
				value TEXT
			)`, err => err ? reject(err) : resolve());
		});
		// Clear tables before insert (simple overwrite)
		await new Promise((resolve, reject) => db.run('DELETE FROM people', err => err ? reject(err) : resolve()));
		await new Promise((resolve, reject) => db.run('DELETE FROM sources', err => err ? reject(err) : resolve()));
		await new Promise((resolve, reject) => db.run('DELETE FROM places', err => err ? reject(err) : resolve()));
		await new Promise((resolve, reject) => db.run('DELETE FROM meta', err => err ? reject(err) : resolve()));
		// Insert people
		for (const p of data.people || []) {
			await new Promise((resolve, reject) => {
				db.run(`INSERT INTO people (id, refNumber, firstName, lastName, gender, events, notes, links, relations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[p.id, p.refNumber, p.firstName, p.lastName, p.gender || '', JSON.stringify(p.events || []), p.notes || '', JSON.stringify(p.links || {}), JSON.stringify(p.relations || {})],
					err => err ? reject(err) : resolve()
				);
			});
		}
		// Insert sources
		for (const s of data.sources || []) {
			await new Promise((resolve, reject) => {
				db.run(`INSERT INTO sources (id, title, archive, volume, page, date, tags, note, aid, nad, bildid, imagePage, dateAdded, trust) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[s.id, s.title || '', s.archive || '', s.volume || '', s.page || '', s.date || '', s.tags || '', s.note || '', s.aid || '', s.nad || '', s.bildid || '', s.imagePage || '', s.dateAdded || '', s.trust || 0],
					err => err ? reject(err) : resolve()
				);
			});
		}
		// Insert places
		for (const pl of data.places || []) {
			await new Promise((resolve, reject) => {
				db.run(`INSERT INTO places (id, country, region, municipality, parish, village, specific, matched_place_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					[pl.id, pl.country || '', pl.region || '', pl.municipality || '', pl.parish || '', pl.village || '', pl.specific || '', pl.matched_place_id || ''],
					err => err ? reject(err) : resolve()
				);
			});
		}
		// Insert meta
		for (const [key, value] of Object.entries(data.meta || {})) {
			await new Promise((resolve, reject) => {
				db.run(`INSERT INTO meta (key, value) VALUES (?, ?)`,
					[key, typeof value === 'object' ? JSON.stringify(value) : String(value)],
					err => err ? reject(err) : resolve()
				);
			});
		}
		db.close();
		return { success: true, dbPath };
	} catch (err) {
		return { error: err.message, dbPath };
	}
	});
	// ...existing code...
	// Make sure the Electron app startup code is present at the end:
	if (typeof app !== 'undefined' && app.whenReady) {
		app.whenReady().then(() => {
			if (typeof createApplicationMenu === 'function') createApplicationMenu();
			if (typeof protocol !== 'undefined' && protocol.registerFileProtocol) {
				protocol.registerFileProtocol('media', (request, callback) => {
					const encodedName = request.url.replace('media://', '');
					const fileName = decodeURIComponent(encodedName);
					const path = require('path');
					const IMAGE_ROOT = path.join(__dirname, '..', 'media');
					const filePath = path.join(IMAGE_ROOT, fileName);
					callback({ path: filePath });
				});
			}
			if (typeof createWindow === 'function') createWindow();
		});
		app.on('window-all-closed', () => {
			if (process.platform !== 'darwin') app.quit();
		});
	}
} catch (err) {
	// Log any startup errors to a file and to the console
	const fs = require('fs');
	const path = require('path');
	const errorLog = path.join(__dirname, 'electron_startup_error.log');
	fs.writeFileSync(errorLog, String(err.stack || err), 'utf8');
	console.error('[Electron main.cjs] Startup error:', err);
}
