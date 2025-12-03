// Apply mapped GEDCOM data into the app's dbData.
// Supports strategies: 'createAll' and 'matchByXref'.

function genId(prefix = 'p') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function ensureMeta(db) {
  if (!db.meta) db.meta = {};
  if (!db.meta.gedcomXrefMap) db.meta.gedcomXrefMap = {};
}

function resolveXrefToId(db, xref) {
  if (!xref) return null;
  const norm = normalizeXref(xref) || xref;
  if (db && db.meta && db.meta.gedcomXrefMap) {
    return db.meta.gedcomXrefMap[norm] || db.meta.gedcomXrefMap[xref] || null;
  }
  return null;
}

function normalizeXref(x) {
  if (!x && x !== 0) return null;
  try {
    return ('' + x).trim().replace(/^@|@$/g, '');
  } catch (e) {
    return x;
  }
}

// Normalize incoming title/archive fields that sometimes are objects
function normalizeTitleField(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    const s = v.trim();
    // If it's a JSON-like string, try parsing and treat as object
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const parsed = JSON.parse(s);
        // fallthrough to object handler below
        v = parsed;
      } catch (e) {
        return v;
      }
    } else {
      return v;
    }
  }
  if (typeof v === 'object') {
    // Common GEDCOM shapes may include formal_name, name, title, text
    if (v.formal_name) return String(v.formal_name);
    if (v.name) return String(v.name);
    if (v.title) return String(v.title);
    if (v.text) return String(v.text);
    // Some parsers include xref pointers under xref_id or pointer
    if (v.xref_id || v.xref || v.pointer) return String(v.xref_id || v.xref || v.pointer);
    // Try to find any string property
    for (const k of Object.keys(v)) {
      if (typeof v[k] === 'string' && v[k].trim() !== '') return v[k];
    }
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  return String(v);
}

// Normalize images field into array of strings (filenames or paths)
function normalizeImagesField(imgs) {
  if (!imgs) return [];
  const arr = Array.isArray(imgs) ? imgs.slice() : [imgs];
  const out = [];
  for (const im of arr) {
    if (!im && im !== 0) continue;
    if (typeof im === 'string') {
      out.push(im);
      continue;
    }
    if (typeof im === 'object') {
      // Common object shapes from GEDCOM/parse may include FILE, file, path, filename, '0' etc.
      const candidates = ['FILE','file','path','filename','fil','uri','url','value','fichier'];
      let found = null;
      for (const c of candidates) {
        if (im[c] && typeof im[c] === 'string') { found = im[c]; break; }
      }
      // If object contains nested string properties, pick the first
      if (!found) {
        for (const k of Object.keys(im)) {
          if (typeof im[k] === 'string' && im[k].trim() !== '') { found = im[k]; break; }
        }
      }
      if (found) {
        out.push(found);
        continue;
      }
      // As a last resort, stringify the object to preserve data for debugging
      try { out.push(JSON.stringify(im)); } catch (e) { out.push(String(im)); }
      continue;
    }
    // Fallback: coerce to string
    out.push(String(im));
  }
  return out;
}

// Heuristics: derive readable fields from raw GEDCOM source node
function deriveFieldsFromRaw(raw) {
  if (!raw) return {};
  const out = {};
  try {
    // Prefer child value text (ABBR/TITL/TEXT)
    if (Array.isArray(raw.children) && raw.children.length) {
      for (const child of raw.children) {
        if (!child) continue;
        const type = (child.type || '').toString().toUpperCase();
        const val = (child.value || (child.data && (child.data.formal_name || child.data.name)) || '').toString().trim();
        if (type === 'TITL' || type === 'ABBR' || type === 'TEXT' || type === 'AUTH' || type === 'PUBL') {
          if (val) {
            out.title = val;
            break;
          }
        }
      }
      // fallback to first child's value
      if (!out.title) {
        for (const child of raw.children) {
          const val = (child && (child.value || (child.data && (child.data.formal_name || child.data.name)))) || '';
          if (val && String(val).trim()) { out.title = String(val).trim(); break; }
        }
      }
    }

    // If title contains '(ArkivDigital)' or 'ArkivDigital' -> archive
    if (out.title && /arkivdigital/i.test(out.title)) {
      out.archive = 'Arkiv Digital';
    }

    // Try to extract a year or year-range from title or raw.data
    const textForDate = [out.title, raw.value, (raw.data && (raw.data.date || raw.data.year))].filter(Boolean).join(' ');
    const yearMatch = textForDate.match(/(\d{4}(?:-\d{4})?)/);
    if (yearMatch) out.date = yearMatch[1];

    // Try to find Bild/page numbers in title
    if (!out.page && out.title) {
      const bildMatch = out.title.match(/Bild\D*(\d{1,5})/i);
      if (bildMatch) {
        out.page = bildMatch[1];
      } else {
        // Avoid mistaking NAD identifiers like 'SE/MSA/01036' for page numbers.
        const nadMatch = out.title.match(/\b[A-Z]{2}\/[^\s\/]{2,}\/\d{2,}\b/);
        if (nadMatch) {
          out.nad = nadMatch[0];
        }
        // look for lone page numbers like 's81' or 'sid 81' (prefer explicit markers)
        const sMatch = out.title.match(/(?:\b(?:s\.?|sid)\b)\s*(\d{1,5})/i);
        if (sMatch) {
          out.page = sMatch[1];
        } else {
          // If no explicit 's'/'sid', accept '/123' only when we didn't detect a NAD pattern
          if (!nadMatch) {
            const slashMatch = out.title.match(/\/\s*(\d{1,5})/);
            if (slashMatch) out.page = slashMatch[1];
          }
        }
      }
    }

    // Try to detect volume patterns like 'C:7' or 'AI:227'
    try {
      // Match common volume/book patterns like 'CI:9', 'C:7', 'AIIa:211' etc.
      // Also capture an immediately following year-range in parentheses if present.
      const volMatch = textForDate.match(/([A-Za-z0-9ÅÄÖåäö\.]{1,10}\s*[:]\s*\d{1,4})\s*(?:\((\d{4}(?:-\d{4})?)\))?/);
      if (volMatch) {
        out.volume = volMatch[1].replace(/\s+/g, '');
        if (volMatch[2] && !out.date) out.date = volMatch[2];
      }
    } catch (e) { /* ignore */ }

    // If raw.data.xref_id exists, normalize
    if (raw.data && (raw.data.xref_id || raw.data.xref)) {
      out.xref = normalizeXref(raw.data.xref_id || raw.data.xref);
    }
  } catch (e) { /* ignore heuristic failures */ }
  // Try to detect AID patterns like v264558.b1060.s99 or v12345 or variants
  try {
    const search = [raw.value, raw.data && JSON.stringify(raw.data), out.title].filter(Boolean).join(' ');
    // Använd den nya, mer avancerade parsern
    const aidRes = parseSourceString(search);
    if (aidRes) {
      out.aid = aidRes.aid || '';
      if (aidRes.imagePage) out.imagePage = aidRes.imagePage;
      if (aidRes.page) out.page = out.page || aidRes.page;
      out.archive = out.archive || 'Arkiv Digital';
    }
  } catch (e) { /* ignore */ }
  // Om ett AID finns, sätt trovärdighet till 4 (Förstahandsuppgift)
  if (out.aid) {
    out.trust = 4;
  }
  return out;
}

// Parse ArkivDigital AID strings from text. Matches v{digits}[.b{digits}][.s{digits}] variants
function parseAid(text) {
  if (!text) return null;
  try {
    const s = String(text);
    // Allow URLs like .../aid/show/v264558.b1060.s99 and plain tokens
    const m = s.match(/v(\d{4,})(?:[.\-_:]?b(\d+))?(?:[.\-_:]?s(\d+))?/i);
    if (!m) return null;
    const v = m[1];
    const b = m[2] || null;
    const p = m[3] || null;
    const aid = 'v' + v + (b ? `.b${b}` : '') + (p ? `.s${p}` : '');
    const out = { aid, imagePage: b ? String(Number(b)) : '', page: p ? String(Number(p)) : '' };
    return out;
  } catch (e) { return null; }
}

// Aggressive sanitization: coerce any remaining non-string fields on sources
function sanitizeAllSources(db) {
  try {
    if (!db || !Array.isArray(db.sources)) return;
    for (const s of db.sources) {
      try {
        if (s.title !== undefined) s.title = normalizeTitleField(s.title);
        else if (s.sourceTitle) s.title = normalizeTitleField(s.sourceTitle);
      } catch (e) { s.title = s.title ? String(s.title) : ''; }
      try {
        if (s.archiveTop === undefined || s.archiveTop === null) s.archiveTop = s.archiveTop || 'Arkiv Digital';
        else s.archiveTop = normalizeTitleField(s.archiveTop);
      } catch (e) { s.archiveTop = String(s.archiveTop || 'Arkiv Digital'); }
      try { s.archive = normalizeTitleField(s.archive || ''); } catch (e) { s.archive = String(s.archive || ''); }
      try { s.images = normalizeImagesField(s.images || []); } catch (e) { s.images = Array.isArray(s.images) ? s.images.map(x => String(x)) : [String(s.images || '')]; }
      try { s.images = (s.images || []).map(i => (typeof i === 'string' ? i : JSON.stringify(i))); } catch (e) { /* ignore */ }
      try { s.note = s.note ? String(s.note) : ''; } catch (e) { s.note = ''; }
      try { s.page = s.page ? String(s.page) : ''; } catch (e) { s.page = ''; }
      try { s.date = s.date ? String(s.date) : ''; } catch (e) { s.date = ''; }
      try { s.aid = s.aid ? String(s.aid) : ''; } catch (e) { s.aid = ''; }
      try { s.imagePage = s.imagePage ? String(s.imagePage) : ''; } catch (e) { s.imagePage = ''; }
      try { s.trust = (typeof s.trust === 'number') ? s.trust : (s.trust ? Number(s.trust) : 0); if (!isFinite(s.trust)) s.trust = 0; if (s.trust < 0) s.trust = 0; if (s.trust > 4) s.trust = 4; } catch (e) { s.trust = 0; }
      // Normalize any citation entries stored on the source
      try {
        if (!s.citations) s.citations = [];
        if (Array.isArray(s.citations)) {
          s.citations = s.citations.map(cit => {
            try {
                return {
                id: cit && cit.id ? String(cit.id) : genId('c'),
                sourceXref: cit && (cit.sourceXref || cit.xref) ? String(cit.sourceXref || cit.xref) : (s.gedcomXref || ''),
                page: cit && cit.page ? String(cit.page) : '',
                date: cit && cit.date ? String(cit.date) : '',
                trust: (cit && (typeof cit.trust === 'number' ? cit.trust : (cit.quay ? Number(cit.quay) : 0))) || 0,
                note: cit && cit.note ? String(cit.note) : '',
                images: normalizeImagesField(cit && cit.images ? cit.images : []),
                raw: cit && cit.raw ? cit.raw : (cit || null)
              };
            } catch (e) {
              return { id: genId('c'), page: '', date: '', trust: 0, note: '', images: [], raw: cit || null };
            }
          });
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* swallow errors to avoid breaking imports */ }
}

// Find an existing source in db that matches incoming citation, or create one.
// Returns { src, created: bool, merged: bool }
function findOrMergeSource(db, incoming = {}) {
  // Defensive normalization of common fields to avoid object-toString issues
  try {
    if (incoming.title) incoming.title = normalizeTitleField(incoming.title);
    if (incoming.sourceTitle) incoming.sourceTitle = normalizeTitleField(incoming.sourceTitle);
    if (incoming.archive) incoming.archive = normalizeTitleField(incoming.archive);
    if (incoming.images) incoming.images = normalizeImagesField(incoming.images);
  } catch (e) { /* ignore normalization errors */ }
  if (!db) return { src: null, created: false, merged: false };
  db.sources = db.sources || [];
  const norm = (s) => (s || '').toString().trim();
  const incomingX = incoming.sourceXref || incoming.xref || null;
  const normX = normalizeXref(incomingX) || incomingX;

  // 1) If a mapping exists for this xref, prefer that source
  if (normX && db.meta && db.meta.gedcomXrefMap && db.meta.gedcomXrefMap[normX]) {
    const existingId = db.meta.gedcomXrefMap[normX];
    const existing = (db.sources || []).find(s => s.id === existingId);
    if (existing) {
      // merge incoming into existing
      const merged = mergeSourceFields(existing, incoming, db);
      return { src: existing, created: false, merged: merged };
    }
  }

  // 2) Try exact match on title + page + date
  const incomingTitle = norm(incoming.title || incoming.sourceTitle || '');
  const incomingPage = norm(incoming.page || '');
  const incomingDate = norm(incoming.date || '');
  let found = null;
  if (incomingTitle) {
    found = (db.sources || []).find(ss => {
      const t = norm(ss.title || '');
      const p = norm(ss.page || '');
      const d = norm(ss.date || '');
      return t.toLowerCase() === incomingTitle.toLowerCase() && p === incomingPage && d === incomingDate;
    });
  }

  if (found) {
    const merged = mergeSourceFields(found, incoming, db);
    // register xref mapping if present
    try {
      if (incomingX) {
        db.meta = db.meta || {};
        db.meta.gedcomXrefMap = db.meta.gedcomXrefMap || {};
        db.meta.gedcomXrefMap[incomingX] = found.id;
        const nX = normalizeXref(incomingX) || incomingX;
        db.meta.gedcomXrefMap[nX] = found.id;
      }
    } catch (e) { /* ignore */ }
    return { src: found, created: false, merged };
  }

  // 3) Create new source
  const clampTrust = (v) => {
    let n = 0;
    try { n = Number(v) || 0; } catch (e) { n = 0; }
    if (!isFinite(n)) n = 0;
    if (n < 0) n = 0;
    if (n > 4) n = 4; // normalize to 0..4 (5 states: 0..4)
    return n;
  };

  const newSrc = {
    id: genId('s'),
    title: incoming.title || incoming.sourceTitle || '',
    gedcomXref: incomingX || null,
    archiveTop: incoming.archiveTop || (incomingX ? 'Övrigt' : undefined),
    archive: incoming.archive || incoming.title || '',
    page: incoming.page || '',
    date: incoming.date || '',
    trust: clampTrust(typeof incoming.trust === 'number' ? incoming.trust : (incoming.quay ? Number(incoming.quay) : 0)),
    aid: incoming.aid || '',
    note: incoming.note || '',
    images: Array.isArray(incoming.images) ? incoming.images.slice() : (incoming.images ? [incoming.images] : []),
    raw: incoming.raw || null
  };
  db.sources = [...(db.sources || []), newSrc];
  try {
    if (incomingX) {
      db.meta = db.meta || {};
      db.meta.gedcomXrefMap = db.meta.gedcomXrefMap || {};
      db.meta.gedcomXrefMap[incomingX] = newSrc.id;
      const nX = normalizeXref(incomingX) || incomingX;
      db.meta.gedcomXrefMap[nX] = newSrc.id;
    }
  } catch (e) { /* ignore */ }

  return { src: newSrc, created: true, merged: false };
}

function mergeSourceFields(existing, incoming, db) {
  let changed = false;
  // If incoming specifies a top-level archive group (e.g. from GEDCOM), set it
  // so the UI can render the source under that top (Övrigt) even if the
  // existing source was previously grouped under Arkiv Digital.
  if (incoming.archiveTop && existing.archiveTop !== incoming.archiveTop) {
    existing.archiveTop = incoming.archiveTop;
    changed = true;
  }
  // Title: prefer existing unless missing
  if ((!existing.title || existing.title.toString().trim() === '') && incoming.title) {
    existing.title = incoming.title;
    changed = true;
  }
  // Note: append incoming.note (incoming assumed HTML) to existing.note
  const incNote = incoming.note || '';
  if (incNote) {
    const exNote = existing.note || '';
    if (exNote && exNote !== '') {
      // avoid duplicating exact text
      if (!exNote.includes(incNote)) {
        existing.note = exNote + '<p></p>' + incNote;
        changed = true;
      }
    } else {
      existing.note = incNote;
      changed = true;
    }
  }
  // Images: union
  const incImages = Array.isArray(incoming.images) ? incoming.images : (incoming.images ? [incoming.images] : []);
  if (incImages && incImages.length) {
    existing.images = Array.isArray(existing.images) ? existing.images : (existing.images ? [existing.images] : []);
    const before = existing.images.slice();
    for (const im of incImages) {
      if (!existing.images.includes(im)) existing.images.push(im);
    }
    if (existing.images.length !== before.length) changed = true;
  }
  // Trust: keep max
  const clampTrust = (v) => {
    let n = 0;
    try { n = Number(v) || 0; } catch (e) { n = 0; }
    if (!isFinite(n)) n = 0;
    if (n < 0) n = 0;
    if (n > 4) n = 4;
    return n;
  };
  const incTrustRaw = typeof incoming.trust === 'number' ? incoming.trust : (incoming.quay ? Number(incoming.quay) : 0);
  const incTrust = clampTrust(incTrustRaw);
  if ((existing.trust || 0) < incTrust) {
    existing.trust = incTrust;
    changed = true;
  }
  // AID: set if incoming provides and existing missing
  try {
    if ((!existing.aid || existing.aid.toString().trim() === '') && incoming.aid) {
      existing.aid = String(incoming.aid);
      changed = true;
    }
  } catch (e) { /* ignore */ }
  // Date/page: fill if missing
  if ((!existing.date || existing.date === '') && incoming.date) {
    existing.date = incoming.date;
    changed = true;
  }
  if ((!existing.page || existing.page === '') && incoming.page) {
    existing.page = incoming.page;
    changed = true;
  }

  // Register any incoming xref mapping
  try {
    const incomingX = incoming.sourceXref || incoming.xref || null;
    if (incomingX) {
      db.meta = db.meta || {};
      db.meta.gedcomXrefMap = db.meta.gedcomXrefMap || {};
      db.meta.gedcomXrefMap[incomingX] = existing.id;
      const nX = normalizeXref(incomingX) || incomingX;
      db.meta.gedcomXrefMap[nX] = existing.id;
    }
  } catch (e) { /* ignore */ }

  // If we made changes, write a small debug backup of the merge
  if (changed && typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
    try {
      const debug = { note: 'gedcom-merge', existingId: existing.id, incoming: incoming, mergedInto: existing };
      window.electronAPI.saveAuditBackup(`gedcom-merge-${Date.now()}.json`, JSON.stringify(debug, null, 2), 'gedcom-debug')
        .then(r => console.debug('[findOrMergeSource] saved merge debug', r))
        .catch(err => console.warn('[findOrMergeSource] failed to save merge debug', err));
    } catch (err) { console.warn('Could not persist gedcom merge debug:', err); }
  }

  return changed;
}

// Create person object compatible with existing app shape
function buildPerson(mappedPerson, nextRef) {
  return {
    id: genId('p'),
    refNumber: nextRef,
    firstName: mappedPerson.firstName || '',
    lastName: mappedPerson.lastName || '',
    gender: mappedPerson.gender || '',
    events: (mappedPerson.events || []).map((ev, i) => ({ id: genId('e'), type: ev.type, date: ev.date || '', place: ev.place || '' })),
    notes: mappedPerson.notes || '',
    links: {},
    relations: { parents: [], children: [], spouseId: null },
    _importedFromGedcom: true,
    gedcomXref: mappedPerson.xref || null
  };
}

import { parseSourceString } from '../parsing.js';

function applyCreateAll(dbData, mapped) {
  const db = clone(dbData);
  ensureMeta(db);
  const diagProblems = [];
  const existingPeople = db.people || [];
  let maxRef = existingPeople.reduce((m, p) => (p.refNumber > m ? p.refNumber : m), 0);
  const created = { people: [], families: [], sources: [] };

  // Create people
  // Dedupe mapped people by xref (if present) to avoid creating duplicates
  const seenXrefs = new Set();
  const uniquePeople = [];
  for (const mp of (mapped.people || [])) {
    // allow fallback to raw node shapes that store the xref under data.xref_id
    const rawXref = (mp && mp.raw && mp.raw.data && (mp.raw.data.xref_id || mp.raw.data.xref)) || null;
    const origX = mp.xref || rawXref || null;
    const x = normalizeXref(origX) || origX;
    if (x && seenXrefs.has(x)) continue;
    if (x) seenXrefs.add(x);
    uniquePeople.push(mp);
  }
  for (const mp of uniquePeople) {
    // If an XREF already exists in db.meta.gedcomXrefMap, update that person instead of creating a duplicate
    // fallback to any raw-stored xref if mapper missed it
    const rawXref = (mp && mp.raw && mp.raw.data && (mp.raw.data.xref_id || mp.raw.data.xref)) || null;
    const origX = mp.xref || rawXref || null;
    const normX = normalizeXref(origX) || origX;
    const existingId = (normX && db.meta.gedcomXrefMap[normX]) || (origX && db.meta.gedcomXrefMap[origX]) || null;
    if (existingId) {
      db.people = (db.people || []).map(p => {
        if (p.id !== existingId) return p;
        const updates = {};
        if (!p.firstName && mp.firstName) updates.firstName = mp.firstName;
        if (!p.lastName && mp.lastName) updates.lastName = mp.lastName;
        if (!p.gender && mp.gender) updates.gender = mp.gender;
        if ((!p.notes || p.notes === '') && mp.notes) updates.notes = mp.notes;
        if (mp.events && mp.events.length) {
          updates.events = [...(p.events || []), ...mp.events.map(ev => ({ id: genId('e'), type: ev.type, date: ev.date || '', place: ev.place || '' }))].slice(-50);
        }
        const newP = { ...p, ...updates };
        if (Object.keys(updates).length) created.people.push({ id: newP.id, refNumber: newP.refNumber, name: `${newP.firstName} ${newP.lastName}` });
        return newP;
      });
      continue;
    }

    maxRef += 1;
    const person = buildPerson(mp, maxRef);
    db.people = [...(db.people || []), person];
    if (mp.xref) {
      const orig = mp.xref;
      const norm = normalizeXref(orig) || orig;
      try { db.meta.gedcomXrefMap[norm] = person.id; } catch (e) {}
      try { db.meta.gedcomXrefMap[orig] = person.id; } catch (e) {}
    }
    created.people.push({ id: person.id, refNumber: person.refNumber, name: `${person.firstName} ${person.lastName}` });
  }

  // DEBUG: expose mapped and current gedcomXrefMap before creating families
  try {
    const debugObj = {
      note: 'applyCreateAll - before creating families',
      mappedFamilies: (mapped.families || []).slice(0, 500),
      mappedPeople: (mapped.people || []).slice(0, 500),
      gedcomXrefMap: { ...db.meta.gedcomXrefMap },
      unmatchedRefs: []
    };
    console.log('GEDCOM APPLY DEBUG (createAll):', debugObj);
    if (typeof window !== 'undefined') {
      try { window.__lastGedcomApplyDebug = debugObj; } catch (e) { /* noop */ }
      // Try to persist via preload helper if available
      if (window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
        try {
          window.electronAPI.saveAuditBackup(`gedcom-debug-createAll-${Date.now()}.json`, JSON.stringify(debugObj, null, 2), 'gedcom-debug')
            .then(res => console.debug('[applyCreateAll] saveAuditBackup result:', res))
            .catch(err => console.warn('[applyCreateAll] saveAuditBackup failed:', err));
        } catch (err) { console.warn('Could not save gedcom debug file:', err); }
      } else {
        console.debug('[applyCreateAll] window.electronAPI.saveAuditBackup not available');
      }
    }
  } catch (err) { console.warn('Failed to prepare GEDCOM debug object:', err); }

  // Create families/relations (simple linking by xref)
  const unmatched = [];
  // ensure relations array exists so UI can pick up canonical relations
  if (!db.relations) db.relations = [];
  for (const fam of (mapped.families || [])) {
    // family member references are xrefs (normalized by mapper)
    const husbandId = fam.husband ? (db.meta.gedcomXrefMap[normalizeXref(fam.husband)] || db.meta.gedcomXrefMap[fam.husband]) : null;
    const wifeId = fam.wife ? (db.meta.gedcomXrefMap[normalizeXref(fam.wife)] || db.meta.gedcomXrefMap[fam.wife]) : null;
    const childIds = (fam.children || []).map(x => (db.meta.gedcomXrefMap[normalizeXref(x)] || db.meta.gedcomXrefMap[x])).filter(Boolean);
    // collect any missing refs for diagnostics
    const missing = [];
    if (fam.husband && !husbandId) missing.push({ role: 'husband', xref: fam.husband });
    if (fam.wife && !wifeId) missing.push({ role: 'wife', xref: fam.wife });
    const missingChildren = (fam.children || []).filter((c, i) => !(db.meta.gedcomXrefMap[normalizeXref(c)] || db.meta.gedcomXrefMap[c]));
    for (const mc of missingChildren) missing.push({ role: 'child', xref: mc });
    if (missing.length) unmatched.push({ family: { xref: fam.xref || null, raw: fam.raw && (fam.raw.data || {}) }, missing, resolved: { husbandId, wifeId, childIds } });
    // link spouses
    if (husbandId && wifeId) {
      db.people = db.people.map(p => {
        if (p.id === husbandId) return { ...p, relations: { ...p.relations, spouseId: wifeId } };
        if (p.id === wifeId) return { ...p, relations: { ...p.relations, spouseId: husbandId } };
        return p;
      });
      // create canonical spouse relation if not present
      const existsSpouse = (db.relations || []).some(r => !r._archived && (r.type || '').toString().toLowerCase() === 'spouse' && (
        (r.fromPersonId === husbandId && r.toPersonId === wifeId) || (r.fromPersonId === wifeId && r.toPersonId === husbandId)
      ));
      if (!existsSpouse) {
        try {
          const rel = {
            id: `rel_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            type: 'spouse',
            fromPersonId: husbandId,
            toPersonId: wifeId,
            sourceIds: [],
            note: 'Imported from GEDCOM',
            createdBy: 'gedcom',
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            modifiedBy: 'gedcom',
            _archived: false
          };
          db.relations = [...(db.relations || []), rel];
        } catch (e) { /* ignore */ }
      }
    }
    // link children
    for (const cid of childIds) {
      db.people = db.people.map(p => {
        if (p.id === cid) {
          const rel = p.relations || { parents: [], children: [], spouseId: null };
          const newParents = Array.from(new Set([...(rel.parents || []), ...(husbandId ? [husbandId] : []), ...(wifeId ? [wifeId] : [])]));
          return { ...p, relations: { ...rel, parents: newParents } };
        }
        return p;
      });
      // create canonical parent relations for each parent that exists
      const parentCandidates = [husbandId, wifeId].filter(Boolean);
      for (const pid of parentCandidates) {
        const existsParent = (db.relations || []).some(r => !r._archived && (r.type || '').toString().toLowerCase() === 'parent' && r.fromPersonId === pid && r.toPersonId === cid);
        if (!existsParent) {
          try {
            const rel = {
              id: `rel_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
              type: 'parent',
              fromPersonId: pid,
              toPersonId: cid,
              sourceIds: [],
              note: 'Imported from GEDCOM',
              createdBy: 'gedcom',
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
              modifiedBy: 'gedcom',
              _archived: false
            };
            db.relations = [...(db.relations || []), rel];
          } catch (e) { /* ignore */ }
        }
      }
    }
    created.families.push({ xref: fam.xref || null, husbandId, wifeId, childIds });
  }

  // If we found unmatched references, persist a focused debug file to help diagnosis
  if (unmatched.length) {
    try {
      const unmatchedObj = { note: 'applyCreateAll - unmatched refs', unmatched };
      console.warn('GEDCOM APPLY UNMATCHED (createAll):', unmatchedObj);
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
        try {
          window.electronAPI.saveAuditBackup(`gedcom-unmatched-createAll-${Date.now()}.json`, JSON.stringify(unmatchedObj, null, 2), 'gedcom-debug')
            .then(res => console.debug('[applyCreateAll] saveAuditBackup(unmatched) result:', res))
            .catch(err => console.warn('[applyCreateAll] saveAuditBackup(unmatched) failed:', err));
        } catch (err) {
          console.warn('Could not save gedcom unmatched debug file:', err);
        }
      } else {
        console.debug('[applyCreateAll] saveAuditBackup(unmatched) not available');
      }
    } catch (err) { /* ignore */ }
  }

  // DEBUG: expose db.relations after matching/creating families so we can verify canonical relation objects
  try {
    const debugAfter = {
      note: 'applyMatchByXref - after processing families',
      relationsCount: (db.relations || []).length,
      relationsSample: (db.relations || []).slice(0, 200),
      peopleSample: (db.people || []).slice(0, 50).map(p => ({ id: p.id, relations: p.relations || {} })),
      gedcomXrefMap: { ...db.meta.gedcomXrefMap }
    };
    console.log('GEDCOM APPLY DEBUG (matchByXref) AFTER FAMILIES:', debugAfter);
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
      try {
        window.electronAPI.saveAuditBackup(`gedcom-debug-matchByXref-after-families-${Date.now()}.json`, JSON.stringify(debugAfter, null, 2), 'gedcom-debug')
          .then(res => console.debug('[applyMatchByXref] saveAuditBackup(after) result:', res))
          .catch(err => console.warn('[applyMatchByXref] saveAuditBackup(after) failed:', err));
      } catch (err) { console.warn('Could not save gedcom debug after file:', err); }
    }
  } catch (err) { /* ignore */ }

  // DEBUG: expose db.relations after matching/creating families so we can verify canonical relation objects
  try {
    const debugAfter = {
      note: 'applyMatchByXref - after processing families',
      relationsCount: (db.relations || []).length,
      relationsSample: (db.relations || []).slice(0, 200),
      peopleSample: (db.people || []).slice(0, 50).map(p => ({ id: p.id, relations: p.relations || {} })),
      gedcomXrefMap: { ...db.meta.gedcomXrefMap }
    };
    // NOTE: moved into applyMatchByXref after families loop so it runs for match strategy
  } catch (err) { /* ignore */ }

  // DEBUG: expose db.relations after creating families so we can verify canonical relation objects
  try {
    const debugAfter = {
      note: 'applyCreateAll - after creating families',
      relationsCount: (db.relations || []).length,
      relationsSample: (db.relations || []).slice(0, 200),
      peopleSample: (db.people || []).slice(0, 50).map(p => ({ id: p.id, relations: p.relations || {} })),
      gedcomXrefMap: { ...db.meta.gedcomXrefMap }
    };
    console.log('GEDCOM APPLY DEBUG (createAll) AFTER FAMILIES:', debugAfter);
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
      try {
        window.electronAPI.saveAuditBackup(`gedcom-debug-createAll-after-families-${Date.now()}.json`, JSON.stringify(debugAfter, null, 2), 'gedcom-debug')
          .then(res => console.debug('[applyCreateAll] saveAuditBackup(after) result:', res))
          .catch(err => console.warn('[applyCreateAll] saveAuditBackup(after) failed:', err));
      } catch (err) { console.warn('Could not save gedcom debug after file:', err); }
    }
  } catch (err) { /* ignore */ }

  // Sources: naive append
    for (const s of (mapped.sources || [])) {
    try {
      const title = (s && s.title) ? ('' + s.title).trim() : '';
      const incoming = { xref: s.xref || null, title, archive: s.archive || '', images: s.media || [], raw: s.raw || null };
      // Diagnostics: detect non-string/archive/images that might render as [object Object]
      try {
        const bad = {};
        if (s && s.title && typeof s.title !== 'string') bad.title = s.title;
        if (s && s.archive && typeof s.archive !== 'string') bad.archive = s.archive;
        if (s && s.media && (!Array.isArray(s.media) || s.media.some(mi => typeof mi !== 'string'))) bad.media = s.media;
        if (Object.keys(bad).length) {
          diagProblems.push({ where: 'createAll.mapped.sources', bad, sample: s, incoming });
        }
      } catch (e) { /* ignore diag errors */ }
      const res = findOrMergeSource(db, incoming);
      if (res && res.created) created.sources.push(res.src);
    } catch (err) {
      console.warn('Failed to create/merge mapped source:', err, s);
    }
  }

  // Helper: convert plain note text with newlines into simple HTML for WYSIWYG
  function noteToHtml(txt) {
    if (!txt) return '';
    const s = ('' + txt).replace(/\r\n?/g, '\n');
    // Split into paragraphs on double newlines
    const paras = s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paras.length === 0) return '';
    const htmlParas = paras.map(p => p.replace(/\n/g, '<br>'));
    return '<p>' + htmlParas.join('</p><p>') + '</p>';
  }

  // Create per-citation source entries under top 'Övrigt'
  for (const c of (mapped.citations || [])) {
    try {
      const sourceTitle = (mapped.sources || []).find(ms => ms.xref === c.sourceXref)?.title || '';
      const title = sourceTitle || '';
      const page = c.page || '';
      const date = c.date || '';
      const trust = c.quay ? Number(c.quay) : 0;
      const noteHtml = noteToHtml(c.note || '');
      const images = Array.isArray(c.images) ? c.images : (c.images ? [c.images] : []);
      // Try to get structured fields from the source title so we can set archive/parish
      const parsed = parseSourceString(title || '');
      const incoming = { sourceXref: c.sourceXref || null, title, page: page || parsed.page || '', date: date || parsed.date || '', trust, note: noteHtml, images, raw: c.raw, archiveTop: 'Övrigt', archive: parsed.archive || '' , volume: parsed.volume || '', imagePage: parsed.imagePage || '', aid: parsed.aid || '' };
      try {
        const bad = {};
        if (title && typeof title !== 'string') bad.title = title;
        if (incoming.archive && typeof incoming.archive !== 'string') bad.archive = incoming.archive;
        if (incoming.images && (!Array.isArray(incoming.images) || incoming.images.some(i => typeof i !== 'string'))) bad.images = incoming.images;
        if (Object.keys(bad).length) diagProblems.push({ where: 'createAll.mapped.citations', bad, sample: c, incoming });
      } catch (e) {}
      const res = findOrMergeSource(db, incoming);
      if (res && res.created) {
        created.sources.push(res.src);
      }
    } catch (err) {
      console.warn('Failed to create/merge citation source:', err, c);
    }
  }

  // Persist diagnostic file if we found problematic entries
  try {
    if (diagProblems.length && typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
      window.electronAPI.saveAuditBackup(`gedcom-diag-createAll-${Date.now()}.json`, JSON.stringify({ note: 'gedcom-diag-createAll', problems: diagProblems }, null, 2), 'gedcom-debug')
        .then(r => console.debug('[applyCreateAll] saved diag file', r))
        .catch(err => console.warn('[applyCreateAll] failed to save diag file', err));
    }
  } catch (e) { /* ignore */ }

  // Attach sourceIds to events and relations (createAll path)
  try {
    const resolve = (x) => resolveXrefToId(db, x);
    for (const mp of (mapped.people || [])) {
      const personX = mp.xref || (mp.raw && mp.raw.data && (mp.raw.data.xref_id || mp.raw.data.xref)) || null;
      const pid = resolve(personX);
      if (!pid) continue;
      const dbPerson = (db.people || []).find(p => p.id === pid);
      if (!dbPerson || !Array.isArray(mp.events) || !Array.isArray(dbPerson.events)) continue;
      for (let i = 0; i < (mp.events || []).length; i++) {
        const mev = mp.events[i];
        if (!mev || !Array.isArray(mev.sourceXrefs) || mev.sourceXrefs.length === 0) continue;
        const sIds = mev.sourceXrefs.map(x => resolve(x)).filter(Boolean);
        if (sIds.length) {
          dbPerson.events[i] = { ...(dbPerson.events[i] || {}), sources: Array.from(new Set([...(dbPerson.events[i] && dbPerson.events[i].sources || []), ...sIds])) };
        }
      }
    }

    for (const fam of (mapped.families || [])) {
      const hId = fam.husband ? resolve(fam.husband) : null;
      const wId = fam.wife ? resolve(fam.wife) : null;
      const childIds = (fam.children || []).map(c => resolve(c)).filter(Boolean);
      const marrX = fam.marrSourceXrefs || [];
      const marrS = (Array.isArray(marrX) ? marrX.map(x => resolve(x)).filter(Boolean) : []);
      if (marrS.length && hId && wId) {
        for (const r of (db.relations || [])) {
          if (r._archived) continue;
          const t = (r.type || '').toString().toLowerCase();
          if (t === 'spouse' && ((r.fromPersonId === hId && r.toPersonId === wId) || (r.fromPersonId === wId && r.toPersonId === hId))) {
            r.sourceIds = Array.from(new Set([...(r.sourceIds || []), ...marrS]));
          }
        }
      }
      if ((fam.marrSourceXrefs || []).length) {
        const pS = (fam.marrSourceXrefs || []).map(x => resolve(x)).filter(Boolean);
        if (pS.length) {
          for (const cid of childIds) {
            for (const pid of [hId, wId].filter(Boolean)) {
              for (const r of (db.relations || [])) {
                if (r._archived) continue;
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent' && r.fromPersonId === pid && r.toPersonId === cid) {
                  r.sourceIds = Array.from(new Set([...(r.sourceIds || []), ...pS]));
                }
              }
            }
          }
        }
      }
    }
  } catch (err) { console.warn('Failed to attach sources to entities (createAll):', err); }

  // Final sanitization to ensure UI-safe values
  try { sanitizeAllSources(db); } catch (e) { /* ignore */ }
  return { db, created };
}

function applyMatchByXref(dbData, mapped) {
  const db = clone(dbData);
  ensureMeta(db);
  const created = { people: [], families: [], sources: [] };
  const updated = { people: [], families: [], sources: [] };

  let maxRef = (db.people || []).reduce((m, p) => (p.refNumber > m ? p.refNumber : m), 0);

  // People: try to match by xref -> existing id in meta
  for (const mp of (mapped.people || [])) {
    const origX = mp.xref || null;
    const normX = normalizeXref(origX) || origX;
    const existingId = (normX && db.meta.gedcomXrefMap[normX]) || (origX && db.meta.gedcomXrefMap[origX]) || null;
    if (existingId) {
      // update missing fields conservatively
      db.people = db.people.map(p => {
        if (p.id !== existingId) return p;
        const updates = {};
        if (!p.firstName && mp.firstName) updates.firstName = mp.firstName;
        if (!p.lastName && mp.lastName) updates.lastName = mp.lastName;
        const mergedEvents = [...(p.events || []), ...((mp.events || []).map(ev => ({ id: genId('e'), type: ev.type, date: ev.date || '', place: ev.place || '' })))]
          .slice(-50);
        updates.events = mergedEvents;
        const newPerson = { ...p, ...updates };
        updated.people.push({ id: p.id, changes: updates });
        return newPerson;
      });
    } else {
      // create new person
      maxRef += 1;
      const person = buildPerson(mp, maxRef);
      db.people = [...(db.people || []), person];
      if (mp.xref) {
        const orig = mp.xref;
        const norm = normalizeXref(orig) || orig;
        try { db.meta.gedcomXrefMap[norm] = person.id; } catch (e) {}
        try { db.meta.gedcomXrefMap[orig] = person.id; } catch (e) {}
      }
      created.people.push({ id: person.id, refNumber: person.refNumber, name: `${person.firstName} ${person.lastName}` });
    }
  }

  // Build a set of person ids that were created during this apply so we can
  // attribute families that reference them as "created" rather than "updated".
  const newlyCreatedPersonIds = new Set((created.people || []).map(p => p.id));

  // DEBUG: expose mapped and current gedcomXrefMap before matching/creating families
  try {
    const debugObj = {
      note: 'applyMatchByXref - before processing families',
      mappedFamilies: (mapped.families || []).slice(0, 500),
      mappedPeople: (mapped.people || []).slice(0, 500),
      gedcomXrefMap: { ...db.meta.gedcomXrefMap },
      unmatchedRefs: []
    };
    console.log('GEDCOM APPLY DEBUG (matchByXref):', debugObj);
    if (typeof window !== 'undefined') {
      try { window.__lastGedcomApplyDebug = debugObj; } catch (e) { /* noop */ }
      if (window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
        try {
          window.electronAPI.saveAuditBackup(`gedcom-debug-matchByXref-${Date.now()}.json`, JSON.stringify(debugObj, null, 2), 'gedcom-debug')
            .then(res => console.debug('[applyMatchByXref] saveAuditBackup result:', res))
            .catch(err => console.warn('[applyMatchByXref] saveAuditBackup failed:', err));
        } catch (err) { console.warn('Could not save gedcom debug file:', err); }
      } else {
        console.debug('[applyMatchByXref] window.electronAPI.saveAuditBackup not available');
      }
    }
  } catch (err) { console.warn('Failed to prepare GEDCOM debug object:', err); }

  // Families: similar matching by xref; create simple links
  const unmatched = [];
  if (!db.relations) db.relations = [];
  for (const fam of (mapped.families || [])) {
    const existingH = fam.husband ? (db.meta.gedcomXrefMap[normalizeXref(fam.husband)] || db.meta.gedcomXrefMap[fam.husband]) : null;
    const existingW = fam.wife ? (db.meta.gedcomXrefMap[normalizeXref(fam.wife)] || db.meta.gedcomXrefMap[fam.wife]) : null;
    const childIds = (fam.children || []).map(x => (db.meta.gedcomXrefMap[normalizeXref(x)] || db.meta.gedcomXrefMap[x])).filter(Boolean);
    const missing = [];
    if (fam.husband && !existingH) missing.push({ role: 'husband', xref: fam.husband });
    if (fam.wife && !existingW) missing.push({ role: 'wife', xref: fam.wife });
    const missingChildren = (fam.children || []).filter((c) => !(db.meta.gedcomXrefMap[normalizeXref(c)] || db.meta.gedcomXrefMap[c]));
    for (const mc of missingChildren) missing.push({ role: 'child', xref: mc });
    if (missing.length) unmatched.push({ family: { xref: fam.xref || null, raw: fam.raw && (fam.raw.data || {}) }, missing, resolved: { husbandId: existingH, wifeId: existingW, childIds } });
    if (existingH || existingW || childIds.length > 0) {
      // link spouses/children if persons exist
      const hId = existingH;
      const wId = existingW;
      if (hId && wId) {
        db.people = db.people.map(p => {
          if (p.id === hId) return { ...p, relations: { ...p.relations, spouseId: wId } };
          if (p.id === wId) return { ...p, relations: { ...p.relations, spouseId: hId } };
          return p;
        });
        // create canonical spouse relation if not present
        const existsSpouse = (db.relations || []).some(r => !r._archived && (r.type || '').toString().toLowerCase() === 'spouse' && (
          (r.fromPersonId === hId && r.toPersonId === wId) || (r.fromPersonId === wId && r.toPersonId === hId)
        ));
        if (!existsSpouse) {
          try {
            const rel = {
              id: `rel_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
              type: 'spouse',
              fromPersonId: hId,
              toPersonId: wId,
              sourceIds: [],
              note: 'Imported from GEDCOM',
              createdBy: 'gedcom',
              createdAt: new Date().toISOString(),
              modifiedAt: new Date().toISOString(),
              modifiedBy: 'gedcom',
              _archived: false
            };
            db.relations = [...(db.relations || []), rel];
          } catch (e) { /* ignore */ }
        }
      }
      for (const cid of childIds) {
        db.people = db.people.map(p => {
          if (p.id === cid) {
            const rel = p.relations || { parents: [], children: [], spouseId: null };
            const newParents = Array.from(new Set([...(rel.parents || []), ...(hId ? [hId] : []), ...(wId ? [wId] : [])]));
            return { ...p, relations: { ...rel, parents: newParents } };
          }
          return p;
        });
        // create canonical parent relations for each parent that exists
        const parentCandidates = [hId, wId].filter(Boolean);
        for (const pid of parentCandidates) {
          const existsParent = (db.relations || []).some(r => !r._archived && (r.type || '').toString().toLowerCase() === 'parent' && r.fromPersonId === pid && r.toPersonId === cid);
          if (!existsParent) {
            try {
              const rel = {
                id: `rel_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                type: 'parent',
                fromPersonId: pid,
                toPersonId: cid,
                sourceIds: [],
                note: 'Imported from GEDCOM',
                createdBy: 'gedcom',
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                modifiedBy: 'gedcom',
                _archived: false
              };
              db.relations = [...(db.relations || []), rel];
            } catch (e) { /* ignore */ }
          }
        }
      }
      // Decide whether this family should be considered created in this import
      const involvesNewPerson = !!(
        (hId && newlyCreatedPersonIds.has(hId)) ||
        (wId && newlyCreatedPersonIds.has(wId)) ||
        (childIds || []).some(cid => newlyCreatedPersonIds.has(cid))
      );
      if (involvesNewPerson) {
        created.families.push({ xref: fam.xref || null, husbandId: existingH || null, wifeId: existingW || null, childIds });
      } else {
        updated.families.push({ xref: fam.xref || null, husbandId: existingH || null, wifeId: existingW || null, childIds });
      }
    } else {
      // No matching persons found — nothing to do in match mode (or create fallback?)
      // For now, create family as new persons if needed (skip to keep conservative)
    }
  }

  if (unmatched.length) {
    try {
      const unmatchedObj = { note: 'applyMatchByXref - unmatched refs', unmatched };
      console.warn('GEDCOM APPLY UNMATCHED (matchByXref):', unmatchedObj);
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
        try {
          window.electronAPI.saveAuditBackup(`gedcom-unmatched-matchByXref-${Date.now()}.json`, JSON.stringify(unmatchedObj, null, 2), 'gedcom-debug')
            .then(res => console.debug('[applyMatchByXref] saveAuditBackup(unmatched) result:', res))
            .catch(err => console.warn('[applyMatchByXref] saveAuditBackup(unmatched) failed:', err));
        } catch (err) {
          console.warn('Could not save gedcom unmatched debug file:', err);
        }
      } else {
        console.debug('[applyMatchByXref] saveAuditBackup(unmatched) not available');
      }
    } catch (err) { /* ignore */ }
  }

  // Sources: append if not present by title
  for (const s of (mapped.sources || [])) {
    // Ensure title is a readable string (mapper may sometimes leave objects)
    const safeTitle = (s && s.title) ? (typeof s.title === 'string' ? s.title : (JSON.stringify(s.title))) : '';
    const exists = (db.sources || []).some(ss => (((ss.title || '') + '').trim().toLowerCase() === (safeTitle + '').trim().toLowerCase()));
    if (!exists) {
      // Use heuristics to populate structured fields (AID, imagePage, page, archive, volume, date)
      const heur = deriveFieldsFromRaw(s.raw || s);
      // attempt to parse aid from title/raw/media
      let aidParsed = '';
      try {
        const search = [
          s.title,
          s.note,
          JSON.stringify(s.raw || {}),
          (s.media && JSON.stringify(s.media)) || ''
        ].filter(Boolean).join(' ');
        const pa = parseSourceString(search); // Använd nya parsern
        if (pa) aidParsed = pa.aid || '';
      } catch (e) { /* ignore */ }
      const newSrc = {
        id: genId('s'),
        title: safeTitle,
        gedcomXref: s.xref || null,
        archive: s.archive || heur && heur.archive || '',
        volume: s.volume || heur && heur.volume || '',
        date: s.date || heur && heur.date || '',
        aid: s.aid || aidParsed || (heur && heur.aid) || '',
        imagePage: s.imagePage || (heur && heur.imagePage) || '',
        page: s.page || (heur && heur.page) || '',
        images: Array.isArray(s.media) ? normalizeImagesField(s.media) : (s.images ? normalizeImagesField(s.images) : []),
        raw: s.raw || s,
        citations: []
      };
      // Om AID finns, sätt trovärdighet till 4
      if (newSrc.aid) {
        newSrc.trust = 4;
      }
      db.sources = [...(db.sources || []), newSrc];
      if (s.xref) db.meta.gedcomXrefMap[s.xref] = newSrc.id;
      created.sources.push(newSrc);
    }
  }

  // Diagnostics for matchByXref path (will be collected when running matchByXref)
  try {
    if (typeof window !== 'undefined') {
      window.__gedcomDiagCreateAll = diagProblems;
    }
  } catch (e) { /* ignore */ }

  // Helper: convert plain note text with newlines into simple HTML for WYSIWYG
  function noteToHtml2(txt) {
    if (!txt) return '';
    const s = ('' + txt).replace(/\r\n?/g, '\n');
    const paras = s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (paras.length === 0) return '';
    const htmlParas = paras.map(p => p.replace(/\n/g, '<br>'));
    return '<p>' + htmlParas.join('</p><p>') + '</p>';
  }

  // Create per-citation entries as `citations` under the corresponding source
  for (const c of (mapped.citations || [])) {
    try {
      const heur = deriveFieldsFromRaw(c.raw || c);
      const sourceTitle = (mapped.sources || []).find(ms => ms.xref === c.sourceXref)?.title || c.title || heur.title || '';
      const page = c.page || heur.page || '';
      const date = c.date || heur.date || '';
      const trust = c.quay ? Number(c.quay) : 0;
      const noteHtml = noteToHtml2(c.note || '') || (heur.note || '');
      const images = normalizeImagesField(Array.isArray(c.images) ? c.images : (c.images ? [c.images] : []));
      const incomingX = c.sourceXref || null;
      // Find existing source by xref mapping, then by title, otherwise create new source
      let target = null;
      try {
        if (incomingX && db.meta && db.meta.gedcomXrefMap && db.meta.gedcomXrefMap[incomingX]) {
          const mappedId = db.meta.gedcomXrefMap[incomingX];
          target = (db.sources || []).find(ss => ss.id === mappedId) || null;
        }
      } catch (e) { /* ignore */ }
      if (!target) {
        const safeTitle = (sourceTitle || '').toString().trim();
        target = (db.sources || []).find(ss => ((ss.title || '') + '').trim().toLowerCase() === safeTitle.toLowerCase());
      }
      if (!target) {
        // attempt to populate useful fields on new source from citation heuristics
        const parsed = deriveFieldsFromRaw(c.raw || c);
        // try to parse aid from raw/text
        let aidParsed = '';
        try {
          const search = [c.title, c.note, JSON.stringify(c.raw || {})].filter(Boolean).join(' ');
          const pa = parseSourceString(search); // Använd nya parsern
          if (pa) aidParsed = pa.aid || '';
        } catch (e) { /* ignore */ }
        const newSrc = { id: genId('s'), title: (sourceTitle || ''), gedcomXref: incomingX || null, archive: parsed.archive || '', volume: parsed.volume || '', date: parsed.date || '', aid: aidParsed || '', imagePage: parsed.imagePage || '', citations: [] };
        db.sources = [...(db.sources || []), newSrc];
        if (incomingX) {
          db.meta = db.meta || {};
          db.meta.gedcomXrefMap = db.meta.gedcomXrefMap || {};
          db.meta.gedcomXrefMap[incomingX] = newSrc.id;
        }
        created.sources.push(newSrc);
        // Om AID finns, sätt trovärdighet till 4
        if (newSrc.aid) {
            newSrc.trust = 4;
        }
        target = newSrc;
      }
      // push citation metadata into target.citations
      target.citations = target.citations || [];
      target.citations.push({ id: genId('c'), sourceXref: c.sourceXref || null, page: page || '', date: date || '', trust, note: noteHtml || '', images, raw: c.raw || c });
    } catch (err) {
      console.warn('Failed to attach citation to source (matchByXref):', err, c);
    }
  }

  // After sources are created, attach sourceIds to person events and relation objects
  try {
    const resolve = (x) => resolveXrefToId(db, x);
    // Attach to person events by index (mapped event order preserved)
    for (const mp of (mapped.people || [])) {
      const personX = mp.xref || (mp.raw && mp.raw.data && (mp.raw.data.xref_id || mp.raw.data.xref)) || null;
      const pid = resolve(personX);
      if (!pid) continue;
      const dbPerson = (db.people || []).find(p => p.id === pid);
      if (!dbPerson || !Array.isArray(mp.events) || !Array.isArray(dbPerson.events)) continue;
      for (let i = 0; i < (mp.events || []).length; i++) {
        const mev = mp.events[i];
        if (!mev || !Array.isArray(mev.sourceXrefs) || mev.sourceXrefs.length === 0) continue;
        const sIds = mev.sourceXrefs.map(x => resolve(x)).filter(Boolean);
        if (sIds.length) {
          dbPerson.events[i] = { ...(dbPerson.events[i] || {}), sources: Array.from(new Set([...(dbPerson.events[i] && dbPerson.events[i].sources || []), ...sIds])) };
        }
      }
    }

    // Attach family-level sources to relation objects (marriage/parent relations)
    for (const fam of (mapped.families || [])) {
      const hId = fam.husband ? resolve(fam.husband) : null;
      const wId = fam.wife ? resolve(fam.wife) : null;
      const childIds = (fam.children || []).map(c => resolve(c)).filter(Boolean);
      // marriage sources
      const marrX = fam.marrSourceXrefs || [];
      const marrS = (Array.isArray(marrX) ? marrX.map(x => resolve(x)).filter(Boolean) : []);
      if (marrS.length && hId && wId) {
        for (const r of (db.relations || [])) {
          if (r._archived) continue;
          const t = (r.type || '').toString().toLowerCase();
          if (t === 'spouse' && ((r.fromPersonId === hId && r.toPersonId === wId) || (r.fromPersonId === wId && r.toPersonId === hId))) {
            r.sourceIds = Array.from(new Set([...(r.sourceIds || []), ...marrS]));
          }
        }
      }
      // child/parent sources (attach same family sources to parent relations)
      if ((fam.marrSourceXrefs || []).length) {
        const pS = (fam.marrSourceXrefs || []).map(x => resolve(x)).filter(Boolean);
        if (pS.length) {
          for (const cid of childIds) {
            for (const pid of [hId, wId].filter(Boolean)) {
              for (const r of (db.relations || [])) {
                if (r._archived) continue;
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent' && r.fromPersonId === pid && r.toPersonId === cid) {
                  r.sourceIds = Array.from(new Set([...(r.sourceIds || []), ...pS]));
                }
              }
            }
          }
        }
      }
    }
  } catch (err) { console.warn('Failed to attach sources to entities:', err); }

  // Final sanitization to ensure UI-safe values
  try { sanitizeAllSources(db); } catch (e) { /* ignore */ }
  return { db, created, updated };
}

function applyMappedToDb({ dbData, mapped, strategy = 'createAll' } = {}) {
  if (!dbData) throw new Error('dbData required');
  if (!mapped) throw new Error('mapped data required');
  if (strategy === 'createAll') return applyCreateAll(dbData, mapped);
  if (strategy === 'matchByXref') return applyMatchByXref(dbData, mapped);
  // default
  return applyCreateAll(dbData, mapped);
}

export { applyMappedToDb };

// --- New helpers for non-destructive GEDCOM import (separat lager) ---
// Exports:
// - exportMappedToGedcomSources(dbData, mapped): returns { db, review } where review contains gedcom_sources entries
// - commitGedcomSource(dbData, gedcomSourceId, options): merges/creates the selected source into `db.sources` and optionally copies images

async function exportMappedToGedcomSources(dbData, mapped) {
  const db = clone(dbData);
  db.gedcom_sources = db.gedcom_sources || [];
  const review = [];
  // Convert mapped.sources and mapped.citations into gedcom_sources entries
  const addSource = (s) => {
    const heur = deriveFieldsFromRaw(s.raw || s);
    const rawTitle = s.title || s.sourceTitle || '';
    let title = normalizeTitleField(rawTitle);
    // If title is a generic placeholder like 'SOURCE', prefer heuristic title or raw children
    if (!title || /^source$/i.test(String(title).trim())) {
      if (heur && heur.title) title = heur.title;
      else if (s.raw && s.raw.value) title = String(s.raw.value || '').trim();
    }
    const images = s.media || s.images || [];
    const id = genId('gs');
    const trustVal = (typeof s.trust === 'number') ? s.trust : (s.quay ? Number(s.quay) : 0);
    const entry = { id, gedcomXref: s.xref || s.sourceXref || null, title: normalizeTitleField(title || ''), archive: s.archive || heur.archive || '', page: s.page || heur.page || '', date: s.date || heur.date || '', note: s.note || '', images: normalizeImagesField(images), raw: s.raw || s, aid: '', trust: (isFinite(trustVal) ? Math.max(0, Math.min(4, Number(trustVal))) : 0), imagePage: s.imagePage || '' };
    // Try to detect AID and image/page info from text/raw using parseAid
    try {
      const search = [s.title, s.note, JSON.stringify(s.raw || {})].filter(Boolean).join(' ');
      let aidRes = parseAid(search);
      // If not found in text/raw, try scanning any media/image strings
      if (!aidRes && Array.isArray(entry.images)) {
        for (const img of entry.images) {
          try {
            if (!img) continue;
            const pa = parseAid(String(img));
            if (pa) { aidRes = pa; break; }
          } catch (e) {}
        }
      }
      if (aidRes) {
        entry.aid = entry.aid || aidRes.aid || '';
        entry.imagePage = entry.imagePage || (aidRes.imagePage || '');
        entry.page = entry.page || (aidRes.page || '');
        entry.archive = entry.archive || 'Arkiv Digital';
      } else if (heur && heur.aid) {
        entry.aid = entry.aid || heur.aid;
        entry.imagePage = entry.imagePage || heur.imagePage || '';
      }
    } catch (e) { /* ignore */ }
    db.gedcom_sources.push(entry);
    review.push(entry);
  };
  try {
    if (Array.isArray(mapped.sources)) mapped.sources.forEach(s => addSource(s));
    // citations provide per-citation sources (preserve citation-specific details)
    if (Array.isArray(mapped.citations)) mapped.citations.forEach(c => {
      try {
        const heur = deriveFieldsFromRaw(c.raw || c);
        const sourceTitle = (mapped.sources || []).find(ms => ms.xref === c.sourceXref)?.title || c.title || heur.title || '';
        const images = normalizeImagesField(Array.isArray(c.images) ? c.images : (c.images ? [c.images] : []));
        const trustVal = (typeof c.trust === 'number') ? c.trust : (c.quay ? Number(c.quay) : 0);
        const entry = { id: genId('gs'), gedcomXref: c.sourceXref || null, title: sourceTitle || '', page: c.page || heur.page || '', date: c.date || heur.date || '', note: c.note || (heur.note || ''), images, raw: c, aid: '', trust: (isFinite(trustVal) ? Math.max(0, Math.min(4, Number(trustVal))) : 0), imagePage: '' };
        try {
          const search = [c.title, c.note, JSON.stringify(c.raw || {})].filter(Boolean).join(' ');
          let aidRes = parseAid(search);
          if (!aidRes && Array.isArray(entry.images)) {
            for (const img of entry.images) {
              try {
                if (!img) continue;
                const pa = parseAid(String(img));
                if (pa) { aidRes = pa; break; }
              } catch (e) {}
            }
          }
          if (aidRes) {
            entry.aid = aidRes.aid || '';
            entry.imagePage = aidRes.imagePage || '';
            entry.page = entry.page || (aidRes.page || '');
            entry.title = entry.title || (heur.title || '');
            entry.archive = entry.archive || 'Arkiv Digital';
          } else if (heur && heur.aid) {
            entry.aid = heur.aid;
            entry.imagePage = entry.imagePage || heur.imagePage || '';
          }
        } catch (e) {}
        db.gedcom_sources.push(entry);
        review.push(entry);
      } catch (e) { console.warn('[exportMappedToGedcomSources] citation build failed', e); }
    });
  } catch (e) { console.warn('[exportMappedToGedcomSources] failed to build gedcom_sources:', e); }
  return { db, review };
}

async function commitGedcomSource(dbData, gedcomSourceId, options = { copyImages: true, imageFolderPrefix: 'kallor/' }) {
  // Mutates a cloned db and returns { db, result } where result has created/merged source info
  const db = clone(dbData);
  ensureMeta(db);
  db.gedcom_sources = db.gedcom_sources || [];
  const src = db.gedcom_sources.find(s => s.id === gedcomSourceId);
  if (!src) return { error: 'gedcom_source not found' };
  // Build incoming shape for findOrMergeSource
  // First, attempt to derive missing fields from raw
  const heur = deriveFieldsFromRaw(src.raw || src);
  const incoming = {
    xref: src.gedcomXref || src.xref || heur.xref || null,
    title: src.title || heur.title || '',
    archive: src.archive || heur.archive || '',
    page: src.page || heur.page || '',
    date: src.date || heur.date || '',
    aid: src.aid || heur.aid || '',
    imagePage: src.imagePage || heur.imagePage || '',
    trust: (typeof src.trust === 'number') ? src.trust : (src.quay ? Number(src.quay) : 0),
    note: src.note || '',
    images: src.images || [],
    raw: src.raw || null,
    archiveTop: 'Övrigt'
  };
  // If we still don't have an AID or image/page, try parsing from raw/title/note
  try {
    const search = [src.title, src.note, JSON.stringify(src.raw || {})].filter(Boolean).join(' ');
    const aidRes = parseSourceString(search); // Använd nya parsern
    if (aidRes) {
      incoming.aid = incoming.aid || aidRes.aid || '';
      incoming.imagePage = incoming.imagePage || (aidRes.imagePage || '');
      incoming.page = incoming.page || (aidRes.page || '');
      incoming.archive = incoming.archive || 'Arkiv Digital';
    }
  } catch (e) { /* ignore */ }
  // Om AID finns, sätt trovärdighet till 4
  if (incoming.aid) {
    incoming.trust = 4;
  }
  // If copyImages requested, attempt to read each source image and write into app image folder
  const savedImages = [];
  if (options.copyImages && Array.isArray(incoming.images) && incoming.images.length) {
    for (const im of incoming.images) {
      try {
        if (!window || !window.electronAPI || typeof window.electronAPI.readFile !== 'function' || typeof window.electronAPI.saveFile !== 'function') {
          // cannot copy, keep original
          savedImages.push(im);
          continue;
        }
        // Try to read source image via electronAPI.readFile. The main process's readFile will enforce image root.
        const readRes = await window.electronAPI.readFile(im);
        if (!readRes || readRes.error) {
          // couldn't read; preserve original path
          savedImages.push(im);
          continue;
        }
        // Determine filename
        const fname = ('' + (typeof im === 'string' ? im.split(/[\\/]/).pop() : genId('img'))).replace(/[^a-zA-Z0-9._-]/g, '_');
        const target = (options.imageFolderPrefix || 'kallor/') + fname;
        // write into app image area
        const saveRes = await window.electronAPI.saveFile(target, readRes);
        if (saveRes && saveRes.success && saveRes.savedPath) {
          // store the relative target used for app display
          savedImages.push(target);
        } else if (saveRes && saveRes.savedPath) {
          savedImages.push(target);
        } else {
          savedImages.push(im);
        }
      } catch (e) {
        console.warn('[commitGedcomSource] image copy failed for', im, e);
        savedImages.push(im);
      }
    }
    // replace incoming.images with savedImages
    incoming.images = savedImages;
  }

  // Use findOrMergeSource to merge/create in db.sources
  const res = findOrMergeSource(db, incoming);
  let result = { created: false, merged: false, src: null };
  if (res && res.src) {
    result.src = res.src;
    result.created = !!res.created;
    result.merged = !!res.merged;
    // ensure images updated on the final source
    try {
      if (Array.isArray(incoming.images) && incoming.images.length) {
        res.src.images = Array.isArray(res.src.images) ? Array.from(new Set([...(res.src.images || []), ...incoming.images])) : (incoming.images || []);
      }
    } catch (e) { /* ignore */ }
  }

  // Remove the gedcom_sources entry (mark as committed)
  db.gedcom_sources = db.gedcom_sources.filter(s => s.id !== gedcomSourceId);

  // Final sanitize
  try { sanitizeAllSources(db); } catch (e) {}

  return { db, result };
}

export { exportMappedToGedcomSources, commitGedcomSource, deriveFieldsFromRaw };
