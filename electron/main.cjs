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
	const mediaMedKopplingar = (data?.media || []).filter(m => m.connections && (m.connections.people?.length > 0 || m.connections.places?.length > 0 || m.connections.sources?.length > 0));
	console.log('SPARAR TILL SQLITE:', {
		dbPath,
		antalPersoner: Array.isArray(data?.people) ? data.people.length : 'ej array',
		antalMedia: Array.isArray(data?.media) ? data.media.length : 'ej array',
		mediaMedKopplingar: mediaMedKopplingar.length,
		kopplingar: mediaMedKopplingar.map(m => ({ 
			id: m.id, 
			name: m.name, 
			connections: m.connections 
		}))
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
		await new Promise((resolve, reject) => {
			db.run(`CREATE TABLE IF NOT EXISTS media (
				id TEXT PRIMARY KEY,
				url TEXT,
				name TEXT,
				date TEXT,
				description TEXT,
				tags TEXT,
				connections TEXT,
				faces TEXT,
				libraryId TEXT,
				filePath TEXT,
				fileSize INTEGER,
				note TEXT
			)`, err => err ? reject(err) : resolve());
		});
		// Clear tables before insert (simple overwrite)
		await new Promise((resolve, reject) => db.run('DELETE FROM people', err => err ? reject(err) : resolve()));
		await new Promise((resolve, reject) => db.run('DELETE FROM sources', err => err ? reject(err) : resolve()));
		await new Promise((resolve, reject) => db.run('DELETE FROM places', err => err ? reject(err) : resolve()));
		await new Promise((resolve, reject) => db.run('DELETE FROM meta', err => err ? reject(err) : resolve()));
		await new Promise((resolve, reject) => db.run('DELETE FROM media', err => err ? reject(err) : resolve()));
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
		// Insert or replace media (uppdatera befintliga, lägg till nya)
		for (const m of data.media || []) {
			const connectionsJson = JSON.stringify(m.connections || {});
			// Debug: logga ALLA media, inte bara de med kopplingar
			console.log('[save-database] Sparar media:', {
				id: m.id,
				name: m.name,
				connections: m.connections,
				connectionsType: typeof m.connections,
				connectionsJson: connectionsJson,
				hasPeople: m.connections?.people?.length > 0,
				peopleCount: m.connections?.people?.length || 0,
				people: m.connections?.people
			});
			
			await new Promise((resolve, reject) => {
				db.run(`INSERT OR REPLACE INTO media (id, url, name, date, description, tags, connections, faces, libraryId, filePath, fileSize, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						m.id || '',
						m.url || '',
						m.name || '',
						m.date || '',
						m.description || '',
						JSON.stringify(m.tags || []),
						connectionsJson,
						JSON.stringify(m.faces || m.regions || []),
						m.libraryId || '',
						m.filePath || '',
						m.fileSize || 0,
						m.note || ''
					],
					(err) => {
						if (err) {
							console.error('[save-database] ERROR saving media:', m.id, err);
							reject(err);
						} else {
							console.log('[save-database] ✅ Media sparad:', m.id, m.name);
							resolve();
						}
					}
				);
			});
		}
		db.close();
		return { success: true, dbPath };
	} catch (err) {
		return { error: err.message, dbPath };
	}
	});

	// IPC handler for opening a SQLite .db file and reading all data
	ipcMain.handle('open-database', async (event, filePath) => {
		// Spara senaste öppnade fil
		if (filePath) {
			const { loadSettings, saveSettings } = require('./settingsStore.cjs');
			const settings = loadSettings();
			settings.lastOpenedFile = filePath;
			saveSettings(settings);
		}
		
		const sqlite3 = require('sqlite3').verbose();
		let dbPath = filePath;
		if (!dbPath) return { error: 'Ingen fil angiven' };
		
		try {
			const db = new sqlite3.Database(dbPath);
			
			// Helper to read a table and parse JSON columns
			function readTable(table, jsonCols = []) {
				return new Promise((resolve, reject) => {
					db.all(`SELECT * FROM ${table}`, (err, rows) => {
						if (err) return resolve([]); // tom array om tabellen saknas
						resolve(rows.map(row => {
							const parsed = { ...row };
							for (const col of jsonCols) {
								if (parsed[col]) {
									try { parsed[col] = JSON.parse(parsed[col]); } catch (e) { parsed[col] = null; }
								}
							}
							return parsed;
						}));
					});
				});
			}
			
			const people = await readTable('people', ['events', 'links', 'relations']);
			const sources = await readTable('sources');
			const places = await readTable('places');
			
			// Meta-data: försök läsa tabellen 'meta', annars tomt objekt
			const metaRows = await readTable('meta');
			let meta = {};
			if (metaRows.length > 0) {
				// Om meta-tabellen har en 'key' och 'value' kolumn, bygg objekt
				if ('key' in metaRows[0] && 'value' in metaRows[0]) {
					meta = {};
					for (const row of metaRows) {
						meta[row.key] = row.value;
					}
				} else {
					meta = metaRows[0];
				}
			}
			
			// Läs media från databasen
			const mediaRows = await readTable('media', ['tags', 'connections', 'faces']);
			let mediaFromDb = [];
			if (mediaRows.length > 0) {
				mediaFromDb = mediaRows.map(row => {
					// Parse JSON strings if needed
					let tags = row.tags;
					if (typeof tags === 'string') {
						try { tags = JSON.parse(tags); } catch (e) { tags = []; }
					}
					let connections = row.connections;
					const connectionsOriginal = connections;
					if (typeof connections === 'string') {
						try { 
							connections = JSON.parse(connections);
						} catch (e) { 
							console.error('[open-database] ❌ Error parsing connections for', row.id, ':', e, 'Raw:', connectionsOriginal);
							connections = { people: [], places: [], sources: [] }; 
						}
					}
					
					// Debug: logga ALLA media när de läses från databasen
					console.log('[open-database] Läser media från databas:', {
						id: row.id,
						name: row.name,
						connectionsOriginal: connectionsOriginal,
						connectionsOriginalType: typeof connectionsOriginal,
						connections: connections,
						connectionsType: typeof connections,
						hasPeople: connections?.people?.length > 0,
						peopleCount: connections?.people?.length || 0,
						people: connections?.people,
						peopleType: typeof connections?.people,
						peopleIsArray: Array.isArray(connections?.people)
					});
					
					let faces = row.faces;
					if (typeof faces === 'string') {
						try { faces = JSON.parse(faces); } catch (e) { faces = []; }
					}
					
					const result = {
						id: row.id,
						url: row.url,
						name: row.name,
						date: row.date,
						description: row.description || '',
						tags: tags || [],
						connections: connections || { people: [], places: [], sources: [] },
						faces: faces || [],
						regions: faces || [], // Alias för kompatibilitet
						libraryId: row.libraryId || 'temp',
						filePath: row.filePath || '',
						fileSize: row.fileSize || 0,
						note: row.note || ''
					};
					
					console.log('[open-database] ✅ Media objekt skapat:', {
						id: result.id,
						name: result.name,
						connections: result.connections,
						peopleCount: result.connections?.people?.length || 0
					});
					
					return result;
				});
			}
			
			db.close();
			
			// Skanna media-mappen och merga med media från databasen
			let media = [];
			try {
				const mediaResult = await scanMediaFolder();
				if (mediaResult && mediaResult.success) {
					const mediaFromFiles = mediaResult.media || [];
					
					// Skapa maps av media från databasen (keyed by ID, filePath, och url)
					const dbMediaMapById = new Map();
					const dbMediaMapByPath = new Map();
					const dbMediaMapByUrl = new Map();
					
					mediaFromDb.forEach(m => {
						// Indexera på ID (viktigast - mest unikt)
						if (m.id) dbMediaMapById.set(m.id, m);
						// Indexera på filePath
						if (m.filePath) dbMediaMapByPath.set(m.filePath, m);
						// Indexera på url (utan media:// prefix)
						if (m.url) {
							const urlKey = m.url.replace('media://', '').replace(/%2F/g, '/');
							dbMediaMapByUrl.set(urlKey, m);
						}
						
						// Debug: logga media med kopplingar från databasen
						if (m.connections && (m.connections.people?.length > 0 || m.connections.places?.length > 0 || m.connections.sources?.length > 0)) {
							console.log('[open-database] Media från databas med kopplingar:', {
								id: m.id,
								name: m.name,
								filePath: m.filePath,
								url: m.url,
								connections: m.connections,
								peopleCount: m.connections?.people?.length || 0
							});
						}
					});
					
					// Merga: använd metadata från databasen om den finns, annars från filsystemet
					const usedDbMediaIds = new Set(); // För att undvika dubletter
					media = mediaFromFiles.map(fileMedia => {
						let dbMedia = null;
						
						// Försök matcha på ID först (mest säkert)
						if (fileMedia.id && dbMediaMapById.has(fileMedia.id)) {
							dbMedia = dbMediaMapById.get(fileMedia.id);
							console.log('[open-database] ✅ Matchade på ID:', {
								id: fileMedia.id,
								name: fileMedia.name,
								dbConnections: dbMedia.connections,
								dbPeopleCount: dbMedia.connections?.people?.length || 0
							});
						}
						// Annars försök matcha på filePath
						else if (fileMedia.filePath && dbMediaMapByPath.has(fileMedia.filePath)) {
							dbMedia = dbMediaMapByPath.get(fileMedia.filePath);
							console.log('[open-database] ✅ Matchade på filePath:', {
								id: fileMedia.id,
								filePath: fileMedia.filePath,
								dbId: dbMedia.id,
								dbConnections: dbMedia.connections,
								dbPeopleCount: dbMedia.connections?.people?.length || 0
							});
						}
						// Annars försök matcha på url
						else if (fileMedia.url) {
							const urlKey = fileMedia.url.replace('media://', '').replace(/%2F/g, '/');
							if (dbMediaMapByUrl.has(urlKey)) {
								dbMedia = dbMediaMapByUrl.get(urlKey);
								console.log('[open-database] ✅ Matchade på url:', {
									id: fileMedia.id,
									url: fileMedia.url,
									dbId: dbMedia.id,
									dbConnections: dbMedia.connections,
									dbPeopleCount: dbMedia.connections?.people?.length || 0
								});
							}
						}
						
						if (!dbMedia) {
							console.log('[open-database] ❌ Ingen matchning hittades för:', {
								id: fileMedia.id,
								name: fileMedia.name,
								filePath: fileMedia.filePath,
								url: fileMedia.url
							});
						}
						
						if (dbMedia) {
							// Markera att denna dbMedia används (för att undvika dubletter)
							usedDbMediaIds.add(dbMedia.id);
							
							// Merga: använd metadata från databasen, men behåll filsystemets URL/filePath
							// VIKTIGT: Behåll ALL connections-data från databasen!
							const merged = {
								...dbMedia, // Sätt ALLT från databasen först (inklusive connections)
								url: fileMedia.url, // Använd filsystemets URL (kan ha ändrats)
								filePath: fileMedia.filePath, // Använd filsystemets filePath
								fileSize: fileMedia.fileSize // Uppdatera filstorlek från filsystemet
								// INTE: connections - använd dbMedia.connections som redan är i ...dbMedia
							};
							
							console.log('[open-database] ✅ Merged media:', {
								id: merged.id,
								name: merged.name,
								connections: merged.connections,
								connectionsType: typeof merged.connections,
								peopleCount: merged.connections?.people?.length || 0,
								people: merged.connections?.people,
								dbMediaConnections: dbMedia.connections,
								dbMediaPeopleCount: dbMedia.connections?.people?.length || 0
							});
							
							return merged;
						} else {
							// Ny bild från filsystemet som inte finns i databasen
							console.log('[open-database] ⚠️ Använder filsystem-media (ingen matchning i databas):', {
								id: fileMedia.id,
								name: fileMedia.name,
								connections: fileMedia.connections,
								peopleCount: fileMedia.connections?.people?.length || 0
							});
							return fileMedia;
						}
					});
					
					// Lägg till media från databasen som inte finns i filsystemet (kan ha flyttats/borttagits)
					// MEN bara om de inte redan är använda (undvika dubletter)
					mediaFromDb.forEach(dbMedia => {
						if (!usedDbMediaIds.has(dbMedia.id)) {
							console.log('[open-database] ➕ Lägger till media från databas (finns inte i filsystem):', {
								id: dbMedia.id,
								name: dbMedia.name,
								filePath: dbMedia.filePath,
								connections: dbMedia.connections,
								peopleCount: dbMedia.connections?.people?.length || 0
							});
							// Media finns i databasen men inte i filsystemet - behåll den ändå
							media.push(dbMedia);
						} else {
							console.log('[open-database] ⏭️ Hoppar över media från databas (redan merged):', {
								id: dbMedia.id,
								name: dbMedia.name
							});
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
			
			return { people, sources, places, meta, media, dbPath };
		} catch (err) {
			return { error: err.message, dbPath };
		}
	});
	
	// Hjälpfunktion för att skanna media-mappen
	async function scanMediaFolder() {
		const path = require('path');
		const fs = require('fs');
		const IMAGE_ROOT = path.join(__dirname, '..', 'media');
		
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

	// Media-mapp i programmets katalog
	const path = require('path');
	const fs = require('fs');
	const IMAGE_ROOT = path.join(__dirname, '..', 'media');
	const TRASH_ROOT = path.join(IMAGE_ROOT, '.trash');
	
	// Skapa media-mappen och papperskorgen vid start om de inte finns
	(async () => {
		try {
			await fs.promises.mkdir(IMAGE_ROOT, { recursive: true });
			await fs.promises.mkdir(TRASH_ROOT, { recursive: true });
			console.log('[main.cjs] Media-mapp verifierad/skapad:', IMAGE_ROOT);
			console.log('[main.cjs] Papperskorg verifierad/skapad:', TRASH_ROOT);
			
			// Töm papperskorgen automatiskt (radera filer äldre än 30 dagar)
			const trashEntries = await fs.promises.readdir(TRASH_ROOT, { withFileTypes: true }).catch(() => []);
			const now = Date.now();
			const maxAge = 30 * 24 * 60 * 60 * 1000;
			let cleanedCount = 0;
			
			for (const entry of trashEntries) {
				if (entry.isFile()) {
					const timestamp = parseInt(entry.name.split('_')[0]);
					if (!isNaN(timestamp) && (now - timestamp) >= maxAge) {
						try {
							await fs.promises.unlink(path.join(TRASH_ROOT, entry.name));
							cleanedCount++;
						} catch (err) {
							console.error('[main.cjs] Error cleaning trash:', entry.name, err);
						}
					}
				}
			}
			
			if (cleanedCount > 0) {
				console.log(`[main.cjs] ✅ Tömt papperskorg vid start: ${cleanedCount} filer raderade`);
			}
		} catch (err) {
			console.error('[main.cjs] Kunde inte skapa media-mapp:', err);
		}
	})();
	
	// Skanna media-mappen och returnera alla bilder
	ipcMain.handle('scan-media-folder', async (event) => {
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
					console.error(`[scan-media-folder] Error scanning ${dir}:`, err);
				}
			};
			
			// Skanna media-mappen rekursivt
			await scanDirectory(IMAGE_ROOT);
			
			console.log(`[scan-media-folder] Hittade ${mediaItems.length} bilder i media-mappen`);
			return { success: true, media: mediaItems };
		} catch (error) {
			console.error('[scan-media-folder] Error:', error);
			return { success: false, error: error.message, media: [] };
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
			
			// Skapa mappen rekursivt - använd path.normalize för att säkerställa korrekt sökväg
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

	// Move file within media folder (för att flytta bilder mellan mappar)
	ipcMain.handle('move-file-in-media', async (event, oldPath, newPath) => {
		try {
			// Normalisera sökvägar
			const normalizedOldPath = oldPath.replace(/\\/g, '/');
			const normalizedNewPath = newPath.replace(/\\/g, '/');
			
			const sourcePath = path.join(IMAGE_ROOT, normalizedOldPath);
			const destPath = path.join(IMAGE_ROOT, normalizedNewPath);
			
			console.log('[move-file-in-media] Moving:', sourcePath, '->', destPath);
			
			// Kontrollera att källfilen finns
			try {
				await fs.promises.access(sourcePath);
			} catch (err) {
				return { success: false, error: `Source file not found: ${sourcePath}` };
			}
			
			// Skapa destinationsmappen om den inte finns
			const destDir = path.dirname(destPath);
			await fs.promises.mkdir(destDir, { recursive: true });
			
			// Flytta filen
			await fs.promises.rename(sourcePath, destPath);
			
			console.log('[move-file-in-media] Success! File moved to:', destPath);
			return { success: true, newPath: normalizedNewPath };
		} catch (error) {
		console.error('[move-file-in-media] Error:', error);
		return { success: false, error: error.message };
	}
});

// Flytta fil till papperskorgen
ipcMain.handle('move-file-to-trash', async (event, filePath) => {
	try {
		const normalizedPath = path.normalize(filePath);
		const sourcePath = path.isAbsolute(normalizedPath) 
			? normalizedPath 
			: path.join(IMAGE_ROOT, normalizedPath);
		
		// Kontrollera att filen finns
		if (!fs.existsSync(sourcePath)) {
			console.error('[move-file-to-trash] Fil finns inte:', sourcePath);
			return { success: false, error: 'Fil finns inte' };
		}
		
		// Skapa papperskorg-mapp om den inte finns
		await fs.promises.mkdir(TRASH_ROOT, { recursive: true });
		
		// Skapa unikt filnamn i papperskorgen (lägg till timestamp)
		const fileName = path.basename(sourcePath);
		const timestamp = Date.now();
		const trashFileName = `${timestamp}_${fileName}`;
		const trashPath = path.join(TRASH_ROOT, trashFileName);
		
		// Flytta filen
		await fs.promises.rename(sourcePath, trashPath);
		
		console.log('[move-file-to-trash] ✅ Fil flyttad till papperskorg:', {
			source: sourcePath,
			destination: trashPath
		});
		
		return { success: true, trashPath: `.trash/${trashFileName}` };
	} catch (error) {
		console.error('[move-file-to-trash] Error:', error);
		return { success: false, error: error.message };
	}
});

// Hämta filer i papperskorgen
ipcMain.handle('get-trash-files', async (event) => {
	try {
		if (!fs.existsSync(TRASH_ROOT)) {
			return { success: true, files: [] };
		}
		
		const entries = await fs.promises.readdir(TRASH_ROOT, { withFileTypes: true });
		const files = [];
		
		for (const entry of entries) {
			if (entry.isFile()) {
				const fullPath = path.join(TRASH_ROOT, entry.name);
				const stats = await fs.promises.stat(fullPath);
				const timestamp = parseInt(entry.name.split('_')[0]);
				const originalName = entry.name.substring(entry.name.indexOf('_') + 1);
				const daysOld = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
				
				files.push({
					name: entry.name,
					originalName: originalName,
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
		const trashPath = path.join(TRASH_ROOT, trashFileName);
		
		if (!fs.existsSync(trashPath)) {
			return { success: false, error: 'Fil finns inte i papperskorgen' };
		}
		
		// Bestäm destination baserat på originalPath eller filnamn
		let destPath;
		if (originalPath && !originalPath.startsWith('.trash/')) {
			destPath = path.isAbsolute(originalPath) 
				? originalPath 
				: path.join(IMAGE_ROOT, originalPath);
		} else {
			// Extrahera originalnamn från trash-filnamn
			const originalName = trashFileName.substring(trashFileName.indexOf('_') + 1);
			destPath = path.join(IMAGE_ROOT, originalName);
		}
		
		// Skapa mappar om de inte finns
		await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
		
		// Flytta tillbaka filen
		await fs.promises.rename(trashPath, destPath);
		
		console.log('[restore-file-from-trash] ✅ Fil återställd:', {
			trash: trashPath,
			destination: destPath
		});
		
		return { success: true, filePath: path.relative(IMAGE_ROOT, destPath) };
	} catch (error) {
		console.error('[restore-file-from-trash] Error:', error);
		return { success: false, error: error.message };
	}
});

// Permanent radera fil från papperskorgen
ipcMain.handle('permanently-delete-from-trash', async (event, trashFileName) => {
	try {
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

	// Copy file to media folder
	ipcMain.handle('copy-file-to-media', async (event, sourcePath, fileName) => {
		try {
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

	// Make sure the Electron app startup code is present at the end:
	if (typeof app !== 'undefined' && app.whenReady) {
		app.whenReady().then(() => {
			if (typeof createApplicationMenu === 'function') createApplicationMenu();
			if (typeof protocol !== 'undefined' && protocol.registerFileProtocol) {
				protocol.registerFileProtocol('media', (request, callback) => {
					const encodedPath = request.url.replace('media://', '');
					const relativePath = decodeURIComponent(encodedPath);
					const path = require('path');
					const IMAGE_ROOT = path.join(__dirname, '..', 'media');
					// relativePath kan vara antingen filnamn eller sökväg med undermapp (t.ex. "persons/image.jpg")
					const filePath = path.join(IMAGE_ROOT, relativePath);
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
