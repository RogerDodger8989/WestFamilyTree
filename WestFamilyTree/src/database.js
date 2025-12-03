/**
 * Fokuserar på ett specifikt SVG-element genom att beräkna och applicera
 * korrekt transformering (translation och skala).
 *
 * @param {SVGElement} personElement - SVG-elementet för personen som klickades.
 * @param {SVGElement} svgContainer - Hela SVG-containern.
 * @param {object} [options] - Valfria inställningar.
 * @param {number} [options.targetScreenWidth=200] - Önskad bredd på kortet i pixlar.
 * @param {number} [options.targetViewportX=0.63] - Målposition i X-led (procent av bredd).
 * @param {number} [options.targetViewportY=0.38] - Målposition i Y-led (procent av höjd).
 */
function focusOnPerson(personElement, svgContainer, options = {}) {
    // Standardvärden enligt dina acceptanskriterier
    const config = {
        targetScreenWidth: 200,   // px
        targetViewportX: 0.63,    // 63% från vänster
        targetViewportY: 0.38,    // 38% från toppen
        ...options
    };

    // 1. Hämta dimensioner och positioner
    const personBBox = personElement.getBBox(); // Ger oss dimensioner i SVG user units
    const viewportRect = svgContainer.getBoundingClientRect(); // Ger oss dimensioner i pixlar

    // Antag att kortets ursprungliga SVG-bredd är personBBox.width.
    // Om du har en fast bredd för alla kort, använd den istället.
    const cardSvgWidth = personBBox.width;
    if (cardSvgWidth === 0) {
        console.error("Person-elementets SVG-bredd är 0. Kan inte beräkna skala.");
        return;
    }

    // 2. Beräkna önskad skala
    // Detta är nyckeln! Skalan bestäms av förhållandet mellan önskad pixelbredd och SVG-bredden.
    // Detta ger dig ett värde som troligen är nära 0.65.
    const targetScale = config.targetScreenWidth / cardSvgWidth;

    // 3. Hitta personens mittpunkt i SVG-koordinater
    const personCenterX = personBBox.x + personBBox.width / 2;
    const personCenterY = personBBox.y + personBBox.height / 2;

    // 4. Bestäm målets pixelposition på skärmen
    const targetPixelX = viewportRect.width * config.targetViewportX;
    const targetPixelY = viewportRect.height * config.targetViewportY;

    // 5. Beräkna den nya translationen (tx, ty)
    // Formeln ser till att personens mittpunkt hamnar på målpositionen efter skalning.
    const tx = targetPixelX - (personCenterX * targetScale);
    const ty = targetPixelY - (personCenterY * targetScale);

    console.log(`Beräknade värden:
      Skala: ${targetScale.toFixed(3)}
      Translate X: ${tx.toFixed(2)}px
      Translate Y: ${ty.toFixed(2)}px`);

    // 6. Applicera den nya transformeringen
    // Ersätt 'updateView' med din faktiska funktion för att uppdatera vyn.
    // Det kan se ut så här:
    // const treeGroup = document.getElementById('tree-group');
    // treeGroup.setAttribute('transform', `translate(, ) scale()`);

    updateView(tx, ty, targetScale);
}

// Example usage of `focusOnPerson` should be wired from the view code that
// manages the SVG elements (e.g. inside the React component that renders
// the tree). This file exposes `focusOnPerson` as a helper but should not
// assume a global `personNode` DOM variable exists. Attach listeners in
// the component where nodes are created instead.
/**
 * Creates a new, empty database structure.
 * @returns {object} A new database object.
 */
export function createNewDatabase() {
    return { 
        meta: { version: "1.3", created: new Date().toISOString(), merges: [], currentUser: '' }, 
        people: [],
        sources: [],
        relations: [] // relation objects: { id, type, fromPersonId, toPersonId, roleFrom, roleTo, startDate, endDate, certainty, sourceIds, note, createdBy, createdAt, modifiedAt, _archived }
    };
}

/**
 * Opens a JSON file using the File System Access API and returns its content.
 * @returns {Promise<{data: object, fileHandle: FileSystemFileHandle}|null>} An object with the parsed data and the file handle, or null if aborted.
 */
export async function openFile() {
    try {
        const [handle] = await window.showOpenFilePicker({ 
            types: [{ 
                description: 'WestFamilyTree JSON', 
                accept: { 'application/json': ['.json'] } 
            }] 
        });
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Ensure core arrays exist
                if (!data.people) data.people = [];
                if (!data.sources) data.sources = []; // For backwards compatibility
                if (!data.relations) data.relations = [];
                if (!data.meta) data.meta = { version: "1.3", created: new Date().toISOString(), merges: [] };
                if (!data.meta.merges) data.meta.merges = [];

                // --- Startup migration: sanitize and backfill GEDCOM sources ---
                try {
                    // normalize title/archive/images fields to readable strings/arrays
                    const sanitizeTitle = (v) => {
                        if (v === null || v === undefined) return '';
                        if (typeof v === 'string') return v;
                        if (typeof v === 'object') {
                            if (v.formal_name) return String(v.formal_name);
                            if (v.name) return String(v.name);
                            if (v.title) return String(v.title);
                            if (v.text) return String(v.text);
                            for (const k of Object.keys(v)) if (typeof v[k] === 'string' && v[k].trim() !== '') return v[k];
                            try { return JSON.stringify(v); } catch (e) { return String(v); }
                        }
                        return String(v);
                    };
                    const sanitizeImages = (imgs) => {
                        if (!imgs) return [];
                        const arr = Array.isArray(imgs) ? imgs.slice() : [imgs];
                        return arr.map(im => (typeof im === 'string' ? im : (typeof im === 'object' ? (im.FILE || im.file || im.path || JSON.stringify(im)) : String(im))));
                    };

                    for (const s of (data.sources || [])) {
                        try {
                            s.title = sanitizeTitle(s.title || s.sourceTitle || s.title);
                            s.archive = sanitizeTitle(s.archive || '');
                            // if source is marked gedcom or has gedcomXref, backfill archiveTop
                            if ((!s.archiveTop || s.archiveTop === '') && (s.origin === 'gedcom' || s.gedcomXref || (s.raw && s.raw.type === 'SOUR'))) {
                                s.archiveTop = 'Övrigt';
                                s.origin = s.origin || 'gedcom';
                            }
                            s.images = sanitizeImages(s.images || s.media || []);
                            s.note = s.note ? String(s.note) : '';
                            s.page = s.page ? String(s.page) : '';
                            s.date = s.date ? String(s.date) : '';
                        } catch (e) { /* swallow per-source errors */ }
                    }
                } catch (e) {
                    console.warn('Startup migration sanitize/backfill failed:', e);
                }

                // --- Additional migration: expand/clean pointer-style NOTE strings ---
                try {
                    const looksLikePointerJson = (s) => {
                        if (!s || typeof s !== 'string') return false;
                        const t = s.trim();
                        // JSON object with a pointer or xref
                        if (t.startsWith('{') && t.endsWith('}')) {
                            try {
                                const p = JSON.parse(t);
                                if (p && (p.pointer || p.xref)) return true;
                            } catch (e) { }
                        }
                        // Or a plain token like @T5229@
                        if (/^@[^@\s]+@$/.test(t)) return true;
                        return false;
                    };

                    // Save a quick audit backup of the raw DB before we mutate it (if electronAPI available)
                    try {
                        if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
                            try {
                                window.electronAPI.saveAuditBackup(`db-pre-migrate-${Date.now()}.json`, JSON.stringify(data, null, 2), 'audit-backups')
                                    .then(r => console.debug('[startup migration] saved pre-migration audit backup', r))
                                    .catch(err => console.warn('[startup migration] could not save pre-migration backup', err));
                            } catch (err) { console.warn('[startup migration] saveAuditBackup failed', err); }
                        }
                    } catch (err) { /* ignore */ }

                    // For people: replace pointer-json with a readable placeholder keeping the original token
                    if (Array.isArray(data.people)) {
                        for (const p of data.people) {
                            try {
                                if (p && p.notes && looksLikePointerJson(p.notes)) {
                                    // attempt to parse JSON to extract pointer; otherwise keep token
                                    let repl = '';
                                    try {
                                        const parsed = JSON.parse(p.notes);
                                        if (parsed && parsed.pointer) repl = `Källa (referens): ${parsed.pointer}`;
                                        else if (parsed && parsed.xref) repl = `Källa (referens): ${parsed.xref}`;
                                    } catch (e) {
                                        const m = (p.notes || '').match(/(@[^@\s]+@)/);
                                        repl = m ? `Källa (referens): ${m[1]}` : '';
                                    }
                                    p.notes = repl;
                                }
                            } catch (e) { /* per-person errors ignored */ }
                        }
                    }

                    // For sources: sanitize note fields similarly
                    if (Array.isArray(data.sources)) {
                        for (const s of data.sources) {
                            try {
                                if (s && s.note && looksLikePointerJson(s.note)) {
                                    let repl = '';
                                    try {
                                        const parsed = JSON.parse(s.note);
                                        if (parsed && parsed.pointer) repl = `Källa (referens): ${parsed.pointer}`;
                                        else if (parsed && parsed.xref) repl = `Källa (referens): ${parsed.xref}`;
                                    } catch (e) {
                                        const m = (s.note || '').match(/(@[^@\s]+@)/);
                                        repl = m ? `Källa (referens): ${m[1]}` : '';
                                    }
                                    s.note = repl;
                                }
                            } catch (e) { /* ignore per-source */ }
                        }
                    }
                } catch (e) {
                    console.warn('Startup migration pointer-clean failed:', e);
                }

                // --- Optional: expand pointer tokens using an audit gedcom-debug JSON ---
                try {
                    // Detect if any people or sources still contain pointer-like notes
                    const hasPointerNotes = () => {
                        const looks = (s) => {
                            if (!s || typeof s !== 'string') return false;
                            const t = s.trim();
                            if (t.startsWith('{') && t.endsWith('}')) {
                                try { const p = JSON.parse(t); if (p && (p.pointer || p.xref)) return true; } catch (e) {}
                            }
                            if (/^@[^@\s]+@$/.test(t)) return true;
                            return false;
                        };
                        if (Array.isArray(data.people)) {
                            for (const p of data.people) if (p && p.notes && looks(p.notes)) return true;
                        }
                        if (Array.isArray(data.sources)) {
                            for (const s of data.sources) if (s && s.note && looks(s.note)) return true;
                        }
                        return false;
                    };

                    if (hasPointerNotes()) {
                        // Ask user if they want to expand pointers using an audit file (non-blocking choice)
                        try {
                            const ok = window.confirm('Databasen innehåller GEDCOM‑pointer‑anteckningar. Vill du välja en tidigare sparad gedcom-debug JSON för att försöka expandera dem till riktig text? (Rekommenderas)');
                            if (ok) {
                                // Let user pick the gedcom-debug JSON using the browser file picker
                                const [fh] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'GEDCOM debug JSON', accept: { 'application/json': ['.json'] } }] });
                                if (fh) {
                                    const txt = await fh.getFile().then(f => f.text());
                                    let audit = null;
                                    try { audit = JSON.parse(txt); } catch (e) { audit = null; }
                                    if (!audit) {
                                        alert('Vald fil kunde inte parsas som JSON. Avbryter expansion.');
                                    } else {
                                        // Try to obtain parsed nodes from the audit file. The audit may contain mappedPeople with raw nodes.
                                        const mapped = audit.mapped || audit;
                                        const candidateNodes = [];
                                        try {
                                            if (mapped.mappedPeople && Array.isArray(mapped.mappedPeople)) mapped.mappedPeople.forEach(mp => { if (mp && mp.raw) candidateNodes.push(mp.raw); });
                                            if (mapped.mappedFamilies && Array.isArray(mapped.mappedFamilies)) mapped.mappedFamilies.forEach(fm => { if (fm && fm.raw) candidateNodes.push(fm.raw); });
                                            if (mapped.mappedSources && Array.isArray(mapped.mappedSources)) mapped.mappedSources.forEach(ss => { if (ss && ss.raw) candidateNodes.push(ss.raw); });
                                            // Also if audit contains arrays directly
                                            if (Array.isArray(audit.mappedPeople) && audit.mappedPeople.length && !candidateNodes.length) audit.mappedPeople.forEach(mp => { if (mp && mp.raw) candidateNodes.push(mp.raw); });
                                        } catch (e) { /* ignore */ }

                                        // If we found candidate nodes, run the mapper on them to get expanded notes
                                        try {
                                            const mapperModule = await import('./gedcom/mapper.js');
                                            const mapper = mapperModule && (mapperModule.default || mapperModule);
                                            let newMapped = null;
                                            if (typeof mapper === 'function') newMapped = mapper(candidateNodes.length ? candidateNodes : audit.parsed || audit.mapped || audit);
                                            else if (mapper && typeof mapper.mapParsedGedcom === 'function') newMapped = mapper.mapParsedGedcom(candidateNodes.length ? candidateNodes : audit.parsed || audit.mapped || audit);

                                            if (newMapped && Array.isArray(newMapped.people)) {
                                                // Build map xref -> notes
                                                const notesByXref = {};
                                                for (const np of newMapped.people) {
                                                    if (np && np.xref) notesByXref[normalizeXref(np.xref) || np.xref] = np.notes || '';
                                                }

                                                // Apply expansions to data.people
                                                let changed = false;
                                                if (Array.isArray(data.people)) {
                                                    for (const p of data.people) {
                                                        try {
                                                            const x = p.gedcomXref || p.gedcomxref || p.xref || null;
                                                            const norm = x ? normalizeXref(x) || x : null;
                                                            if (norm && notesByXref[norm] && notesByXref[norm] !== '' && (p.notes === null || p.notes === undefined || p.notes.trim().length === 0 || /^\{/.test((p.notes||'').trim()) || /^@[^@\s]+@$/.test((p.notes||'').trim()))) {
                                                                p.notes = notesByXref[norm];
                                                                changed = true;
                                                            }
                                                        } catch (e) { /* ignore per-person */ }
                                                    }
                                                }

                                                // Additional expansion: audit may contain a gedcomXrefMap mapping GEDCOM xrefs
                                                // to app person IDs (like { "I17238": "p_1764262173937_226" }). Use that
                                                // mapping to find persons by their app ID in the DB and apply expanded notes
                                                // even when the person record doesn't carry a gedcomXref field.
                                                try {
                                                    if (audit && audit.gedcomXrefMap && typeof audit.gedcomXrefMap === 'object') {
                                                        for (const [gedcomX, appId] of Object.entries(audit.gedcomXrefMap)) {
                                                            try {
                                                                const normX = normalizeXref(gedcomX) || gedcomX;
                                                                const noteVal = notesByXref[normX] || notesByXref[gedcomX] || '';
                                                                if (!noteVal) continue;
                                                                // Find person by several common id fields
                                                                const person = (Array.isArray(data.people) ? data.people.find(pp => {
                                                                    if (!pp) return false;
                                                                    const candIds = [pp.id, pp._id, pp.entityId, pp.personId, pp.person_id, pp.personIdRaw];
                                                                    return candIds.some(cid => cid && String(cid) === String(appId));
                                                                }) : null);
                                                                if (person) {
                                                                    const current = (person.notes || '').toString();
                                                                    if (!current || /^\{/.test(current.trim()) || /^@[^@\s]+@$/.test(current.trim())) {
                                                                        person.notes = noteVal;
                                                                        changed = true;
                                                                    }
                                                                }
                                                            } catch (e) { /* per-entry ignore */ }
                                                        }
                                                    }
                                                } catch (e) { /* ignore */ }

                                                // Apply expansions to data.sources
                                                if (Array.isArray(data.sources)) {
                                                    for (const s of data.sources) {
                                                        try {
                                                            const x = s.gedcomXref || s.gedcomxref || s.xref || null;
                                                            const norm = x ? normalizeXref(x) || x : null;
                                                            if (norm && notesByXref[norm] && notesByXref[norm] !== '' && (s.note === null || s.note === undefined || s.note.trim().length === 0 || /^\{/.test((s.note||'').trim()) || /^@[^@\s]+@$/.test((s.note||'').trim()))) {
                                                                s.note = notesByXref[norm];
                                                                changed = true;
                                                            }
                                                        } catch (e) { /* ignore per-source */ }
                                                    }
                                                }

                                                if (changed) {
                                                    try {
                                                        if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
                                                            window.electronAPI.saveAuditBackup(`db-post-expand-${Date.now()}.json`, JSON.stringify(data, null, 2), 'audit-backups')
                                                                .then(r => console.debug('[startup migration] saved post-expansion audit backup', r))
                                                                .catch(err => console.warn('[startup migration] could not save post-expansion backup', err));
                                                        }
                                                    } catch (err) { /* ignore */ }
                                                    console.debug('[startup migration] Expanded pointer notes using audit file');
                                                } else {
                                                    console.debug('[startup migration] No expansions applied (no matching xrefs found)');
                                                }
                                            } else {
                                                console.warn('[startup migration] mapper did not produce people when trying to expand notes');
                                            }
                                        } catch (e) {
                                            console.warn('Startup migration expansion failed (mapper):', e);
                                        }
                                    }
                                }
                            }
                        } catch (e) { console.warn('Startup migration expansion aborted or failed:', e); }
                    }
                } catch (e) {
                    console.warn('Startup migration expansion overall failed:', e);
                }

                return { data, fileHandle: handle };
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Error opening file:", err);
            alert("Fel vid öppning av fil: " + err.message);
        }
        return null;
    }
}

/**
 * Saves data to a specific file handle.
 * @param {FileSystemFileHandle} fileHandle The handle to the file to save.
 * @param {object} data The database object to save.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function saveFile(fileHandle, data) {
    try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        return true;
    } catch (err) {
        console.error("Error saving file:", err);
        alert("Fel vid sparande: " + err.message);
        return false;
    }
}

/**
 * Opens a "Save As" dialog and saves the data to a new file.
 * @param {object} data The database object to save.
 * @returns {Promise<FileSystemFileHandle|null>} The new file handle if successful, or null.
 */
export async function saveFileAs(data) {
    const handle = await window.showSaveFilePicker({ types: [{ description: 'WestFamilyTree JSON', accept: { 'application/json': ['.json'] } }], suggestedName: 'min_slakt.json' });
    if (handle && await saveFile(handle, data)) {
        return handle;
    }
    return null;
}