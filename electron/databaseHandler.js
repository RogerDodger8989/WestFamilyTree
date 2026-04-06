import sqlite3pkg from 'sqlite3';

const sqlite3 = sqlite3pkg.verbose();

export async function saveDatabaseData(dbPath, data) {
  if (!dbPath) throw new Error('Ingen fil angiven');
  let db;
  try {
    db = new sqlite3.Database(dbPath);

    // 1. Skapa tabeller om de saknas
    const tables = [
      `CREATE TABLE IF NOT EXISTS people (
        id TEXT PRIMARY KEY, refNumber INTEGER, firstName TEXT, lastName TEXT, gender TEXT,
        events TEXT, notes TEXT, links TEXT, relations TEXT, media TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY, title TEXT, archive TEXT, volume TEXT, page TEXT, date TEXT,
        tags TEXT, note TEXT, aid TEXT, nad TEXT, bildid TEXT, imagePage TEXT, dateAdded TEXT, trust INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY, country TEXT, region TEXT, municipality TEXT, parish TEXT,
        village TEXT, specific TEXT, matched_place_id TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY, value TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS media (
        id TEXT PRIMARY KEY, url TEXT, name TEXT, date TEXT, description TEXT, tags TEXT,
        connections TEXT, faces TEXT, libraryId TEXT, filePath TEXT, fileSize INTEGER, note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS relations (
        id TEXT PRIMARY KEY, fromPersonId TEXT, toPersonId TEXT, type TEXT, startDate TEXT,
        endDate TEXT, certainty TEXT, note TEXT, sourceIds TEXT, reason TEXT, createdAt TEXT,
        modifiedAt TEXT, _archived BOOLEAN
      )`
    ];

    for (const query of tables) {
      await new Promise((resolve, reject) => db.run(query, err => err ? reject(err) : resolve()));
    }

    // 1b. Migration: lägg till media-kolumn i äldre people-tabeller
    const peopleColumns = await new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(people)`, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
    const hasMediaColumn = peopleColumns.some(col => col.name === 'media');
    if (!hasMediaColumn) {
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE people ADD COLUMN media TEXT`, err => err ? reject(err) : resolve());
      });
    }

    // 1c. Migration: lägg till saknade kolumner i äldre relations-tabeller
    const relationColumns = await new Promise((resolve, reject) => {
      db.all(`PRAGMA table_info(relations)`, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
    const relationColumnNames = new Set(relationColumns.map(col => col.name));
    const requiredRelationColumns = [
      { name: 'fromPersonId', type: 'TEXT' },
      { name: 'toPersonId', type: 'TEXT' },
      { name: 'startDate', type: 'TEXT' },
      { name: 'endDate', type: 'TEXT' },
      { name: 'certainty', type: 'TEXT' },
      { name: 'note', type: 'TEXT' },
      { name: 'sourceIds', type: 'TEXT' },
      { name: 'reason', type: 'TEXT' },
      { name: 'createdAt', type: 'TEXT' },
      { name: 'modifiedAt', type: 'TEXT' },
      { name: '_archived', type: 'BOOLEAN' }
    ];

    for (const col of requiredRelationColumns) {
      if (relationColumnNames.has(col.name)) continue;
      await new Promise((resolve, reject) => {
        db.run(`ALTER TABLE relations ADD COLUMN ${col.name} ${col.type}`, err => err ? reject(err) : resolve());
      });
    }

    // 2. Transaktion start & Rensa existerande tabeller
    await new Promise((resolve, reject) => db.run('BEGIN TRANSACTION', err => err ? reject(err) : resolve()));

    const clearQueries = ['people', 'sources', 'places', 'meta', 'media', 'relations'];
    for (const table of clearQueries) {
      await new Promise((resolve, reject) => db.run(`DELETE FROM ${table}`, err => err ? reject(err) : resolve()));
    }

    // 3. Sätt in all ny data
    for (const p of data.people || []) {
      await new Promise((resolve, reject) => {
        const genderValue = p.sex || p.gender || '';
        db.run(`INSERT OR REPLACE INTO people (id, refNumber, firstName, lastName, gender, events, notes, links, relations, media) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.id, p.refNumber, p.firstName || '', p.lastName || '', genderValue, JSON.stringify(p.events || []), p.notes || '', JSON.stringify(p.links || {}), JSON.stringify(p.relations || {}), JSON.stringify(p.media || [])],
          err => err ? reject(err) : resolve()
        );
      });
    }

    for (const s of data.sources || []) {
      await new Promise((resolve, reject) => {
        db.run(`INSERT INTO sources (id, title, archive, volume, page, date, tags, note, aid, nad, bildid, imagePage, dateAdded, trust) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.title || '', s.archive || '', s.volume || '', s.page || '', s.date || '', s.tags || '', s.note || '', s.aid || '', s.nad || '', s.bildid || '', s.imagePage || '', s.dateAdded || '', s.trust || 0],
          err => err ? reject(err) : resolve()
        );
      });
    }

    for (const pl of data.places || []) {
      await new Promise((resolve, reject) => {
        db.run(`INSERT INTO places (id, country, region, municipality, parish, village, specific, matched_place_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [pl.id, pl.country || '', pl.region || '', pl.municipality || '', pl.parish || '', pl.village || '', pl.specific || '', pl.matched_place_id || ''],
          err => err ? reject(err) : resolve()
        );
      });
    }

    const metaToSave = { ...(data.meta || {}) };
    delete metaToSave.audit;
    delete metaToSave.merges;
    for (const [key, value] of Object.entries(metaToSave)) {
      await new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`,
          [key, typeof value === 'object' ? JSON.stringify(value) : String(value)],
          err => err ? reject(err) : resolve()
        );
      });
    }

    for (const r of data.relations || []) {
      await new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO relations (id, fromPersonId, toPersonId, type, startDate, endDate, certainty, note, sourceIds, reason, createdAt, modifiedAt, _archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.fromPersonId, r.toPersonId, r.type, r.startDate || '', r.endDate || '', r.certainty || '', r.note || '', JSON.stringify(r.sourceIds || []), r.reason || '', r.createdAt || new Date().toISOString(), r.modifiedAt || new Date().toISOString(), r._archived ? 1 : 0],
          err => err ? reject(err) : resolve()
        );
      });
    }

    for (const m of data.media || []) {
      await new Promise((resolve, reject) => {
        db.run(`INSERT INTO media (id, url, name, date, description, tags, connections, faces, libraryId, filePath, fileSize, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id || '', m.url || '', m.name || '', m.date || '', m.description || '', JSON.stringify(m.tags || []), JSON.stringify(m.connections || {}), JSON.stringify(m.faces || m.regions || []), m.libraryId || '', m.filePath || '', m.fileSize || 0, m.note || ''],
          err => err ? reject(err) : resolve()
        );
      });
    }

    // 4. Commit och stäng
    await new Promise((resolve, reject) => db.run('COMMIT', err => err ? reject(err) : resolve()));
    await new Promise((resolve, reject) => db.close(err => err ? reject(err) : resolve()));

    return { success: true, dbPath };
  } catch (err) {
    if (db) {
      try { await new Promise(resolve => db.run('ROLLBACK', resolve)); } catch(e) {}
      db.close();
    }
    throw err;
  }
}

export async function loadDatabaseData(dbPath) {
  if (!dbPath) throw new Error('Ingen fil angiven');
  const db = new sqlite3.Database(dbPath);

  function readTable(table, jsonCols = []) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${table}`, (err, rows) => {
        if (err) return resolve([]); 
        resolve(rows.map(row => {
          const parsed = { ...row };
          for (const col of jsonCols) {
            if (parsed[col]) { try { parsed[col] = JSON.parse(parsed[col]); } catch (e) { parsed[col] = null; } }
          }
          return parsed;
        }));
      });
    });
  }

  const people = await readTable('people', ['events', 'links', 'relations', 'media']);
  const sources = await readTable('sources');
  const places = await readTable('places');
  const relations = await readTable('relations', ['sourceIds']);
  const mediaRaw = await readTable('media', ['tags', 'connections', 'faces']);
  const metaRows = await readTable('meta');
  
  // Mappa regions som ett alias för faces (bakåtkompatibilitet)
  const mediaFromDb = mediaRaw.map(row => ({ ...row, regions: row.faces || [] }));
  
  let meta = {};
  if (metaRows.length > 0) {
    if ('key' in metaRows[0] && 'value' in metaRows[0]) {
      for (const row of metaRows) {
        try { meta[row.key] = JSON.parse(row.value); } catch { meta[row.key] = row.value; }
      }
    } else { meta = metaRows[0]; }
  }

  db.close();
  
  return { people, sources, places, relations, mediaFromDb, meta, dbPath };
}