import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import { commitGedcomSource, deriveFieldsFromRaw } from './gedcom/apply';

export default function GedcomReviewPanel({ onClose }) {
  const { dbData, setDbData, showStatus } = useApp();
  const [busy, setBusy] = useState(false);
  const sources = (dbData && dbData.gedcom_sources) ? dbData.gedcom_sources : [];
  const [edits, setEdits] = useState({});

  useEffect(() => {
    // initialize edits from gedcom_sources
    const map = {};
    for (const s of sources) {
      map[s.id] = { title: s.title || '', page: s.page || '', date: s.date || '', note: s.note || '', images: (s.images || []).slice(), aid: s.aid || '', trust: (typeof s.trust === 'number' ? s.trust : 0) };
    }
    setEdits(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbData && dbData.gedcom_sources]);

  // On open: if many sources lack titles, offer to autofill them (non-destructive)
  useEffect(() => {
    try {
      if (!sources || !sources.length) return;
      const empties = sources.filter(s => !s.title || s.title.toString().trim() === '' || s.title.toString().toLowerCase() === 'source').length;
      if (empties > 0 && empties / sources.length >= 0.5) {
        // ask user if they'd like to autofill titles now
        const ok = window.confirm(`Det ser ut som ${empties}/${sources.length} GEDCOM‑källor saknar läsbara titlar. Vill du automatiskt fylla titlar i granskningen nu? (Icke‑destruktivt)`);
        if (ok) autoFillTitles();
      }
    } catch (e) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to compute a friendly fallback title when normalized title is unhelpful
  function friendlyTitle(s) {
    const t = (s && (s.title || s.sourceTitle || '') || '').toString().trim();
    if (t && t !== '' && t.toLowerCase() !== 'source') return t;
    // If raw contains useful children (e.g. ABBR, TITL), prefer that
    try {
      const raw = s && s.raw;
      if (raw && Array.isArray(raw.children) && raw.children.length) {
        const preferredTypes = ['ABBR', 'TITL', 'TEXT', 'AUTH', 'PUBL'];
        for (const child of raw.children) {
          if (!child) continue;
          const type = (child.type || '').toString().toUpperCase();
          // Prefer specific types first
          if (preferredTypes.includes(type)) {
            if (child.value && String(child.value).trim()) return String(child.value).trim();
            if (child.data && (child.data.formal_name || child.data.name)) return String(child.data.formal_name || child.data.name).trim();
          }
        }
        // If none of the preferred types matched, fallback to first child's value
        for (const child of raw.children) {
          if (child && child.value && String(child.value).trim()) return String(child.value).trim();
          if (child && child.data) {
            const vals = Object.values(child.data).filter(v => typeof v === 'string' && v.trim());
            if (vals.length) return vals[0].trim();
          }
        }
      }
    } catch (e) { /* ignore */ }
    // Fallback to archive
    if (s.archive) return s.archive;
    // Fallback to first image filename
    try {
      const fn = (s.images && s.images[0]) ? String(s.images[0]).split(/[\\/]/).pop() : null;
      if (fn) return fn;
    } catch (e) { /* ignore */ }
    // Fallback to raw snippet
    try {
      if (s.raw) {
        const rawText = typeof s.raw === 'string' ? s.raw : JSON.stringify(s.raw);
        const snip = rawText.slice(0, 120).replace(/\n/g, ' ');
        return snip + (rawText.length > 120 ? '…' : '');
      }
    } catch (e) {}
    return '(ingen titel)';
  }

  const [rawModal, setRawModal] = useState({ open: false, content: null, title: '' });
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditResults, setAuditResults] = useState(null);
  const [auditBusy, setAuditBusy] = useState(false);

  async function openRawForSource(s) {
    try {
      const payload = { id: s.id, raw: s.raw || null, full: s };
      setRawModal({ open: true, content: JSON.stringify(payload, null, 2), title: `Rådata: ${friendlyTitle(s)}` });
    } catch (e) { alert('Kunde inte visa rådata: ' + String(e)); }
  }

  async function findInLatestAudit() {
    // Read latest gedcom-debug from app audit-backups via Electron
    setAuditBusy(true);
    try {
      if (!window.electronAPI || !window.electronAPI.readLatestAuditDebug) {
        alert('Electron API för audit‑debug inte tillgänglig.');
        setAuditBusy(false);
        return;
      }
      const res = await window.electronAPI.readLatestAuditDebug();
      if (res && res.error) {
        alert('Kunde inte läsa audit‑backup: ' + res.error);
        setAuditBusy(false);
        return;
      }
      const parsed = res.parsed || (res.raw ? JSON.parse(res.raw) : null);
      if (!parsed) {
        alert('Ingen giltig gedcom‑debug hittades i senaste filen.');
        setAuditBusy(false);
        return;
      }
      // Search mappedPeople and mappedSources for the term
      const term = (auditSearchTerm || '').toLowerCase();
      const peopleMatches = (parsed.mappedPeople || []).filter(p => (p.firstName || '') + ' ' + (p.lastName || '') ? ( ( (p.firstName||'') + ' ' + (p.lastName||'') ).toLowerCase().includes(term) ) : (JSON.stringify(p)||'').toLowerCase().includes(term)).slice(0,50);
      const sourceMatches = (parsed.mappedSources || []).filter(s => ( (s.title||'') + ' ' + (s.archive||'') ).toLowerCase().includes(term) || JSON.stringify(s).toLowerCase().includes(term)).slice(0,50);
      setAuditResults({ file: res.file, peopleMatches, sourceMatches });
    } catch (err) {
      alert('Fel vid läsning av audit‑backup: ' + (err && err.message ? err.message : String(err)));
    }
    setAuditBusy(false);
  }

  if (!sources.length) return (
    <div style={{ padding: 12 }}>
      <div>Inga GEDCOM‑källor att granska.</div>
      <div style={{ marginTop: 8 }}><button onClick={onClose}>Stäng</button></div>
    </div>
  );

  function updateEdit(id, field, value) {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  }

  async function saveChanges(id) {
    try {
      const e = edits[id];
      if (!e) return;
      const newDb = JSON.parse(JSON.stringify(dbData));
      newDb.gedcom_sources = newDb.gedcom_sources || [];
      const idx = newDb.gedcom_sources.findIndex(s => s.id === id);
      if (idx === -1) return;
      newDb.gedcom_sources[idx] = { ...newDb.gedcom_sources[idx], title: e.title, page: e.page, date: e.date, note: e.note, images: e.images, aid: e.aid || '', trust: (typeof e.trust === 'number' ? e.trust : (e.trust ? Number(e.trust) : 0)) };
      setDbData(newDb);
      if (showStatus) showStatus('Ändringar sparade för källa');
    } catch (err) {
      alert('Kunde inte spara ändringar: ' + (err && err.message ? err.message : String(err)));
    }
  }

  // Extracted autofill helpers so we can call them from buttons or on-open
  async function autoFillTitles() {
    try {
      if (window.electronAPI && window.electronAPI.saveAuditBackup) {
        try {
          await window.electronAPI.saveAuditBackup(`gedcom_sources_backup_${Date.now()}.json`, JSON.stringify(dbData.gedcom_sources || [], null, 2));
        } catch (e) { console.warn('Could not save backup before filling titles:', e); }
      }
      const newDb = JSON.parse(JSON.stringify(dbData || {}));
      newDb.gedcom_sources = (newDb.gedcom_sources || []).map(s => ({ ...s }));
      let changed = 0;
      for (const s of newDb.gedcom_sources) {
        const current = (s.title || '').toString().trim();
        const f = friendlyTitle(s);
        if ((!current || current === '' || current.toLowerCase() === 'source') && f && f !== '(ingen titel)') {
          s.title = f;
          changed += 1;
        }
      }
      setDbData(newDb);
      setEdits(prev => {
        const copy = { ...(prev || {}) };
        for (const s of newDb.gedcom_sources) copy[s.id] = { ...(copy[s.id] || {}), title: s.title || '' };
        return copy;
      });
      alert(`Färdig — uppdaterade titlar för ${changed} källor i granskning.`);
    } catch (err) { alert('Fel vid automatisk ifyllning: ' + (err && err.message ? err.message : String(err))); }
  }

  async function autoFillMetadata() {
    try {
      if (window.electronAPI && window.electronAPI.saveAuditBackup) {
        try {
          await window.electronAPI.saveAuditBackup(`gedcom_sources_meta_backup_${Date.now()}.json`, JSON.stringify(dbData.gedcom_sources || [], null, 2));
        } catch (e) { console.warn('Could not save backup before filling metadata:', e); }
      }
      const newDb = JSON.parse(JSON.stringify(dbData || {}));
      newDb.gedcom_sources = (newDb.gedcom_sources || []).map(s => ({ ...s }));
      let changed = 0;
      for (const s of newDb.gedcom_sources) {
        const heur = deriveFieldsFromRaw(s.raw || s);
        const before = { title: s.title || '', archive: s.archive || '', date: s.date || '', page: s.page || '', aid: s.aid || '', raId: s.raId || '' };
        if ((!s.title || s.title.toString().trim() === '' || s.title.toString().toLowerCase() === 'source') && heur.title) s.title = heur.title;
        if ((!s.archive || s.archive.toString().trim() === '') && heur.archive) s.archive = heur.archive;
        if ((!s.date || s.date.toString().trim() === '') && heur.date) s.date = heur.date;
        if ((!s.page || s.page.toString().trim() === '') && heur.page) s.page = heur.page;
        if ((!s.gedcomXref || s.gedcomXref.toString().trim() === '') && heur.xref) s.gedcomXref = heur.xref;
        try {
          const searchText = [s.title, s.note, JSON.stringify(s.raw || {})].filter(Boolean).join(' ');
          const aidMatch = searchText.match(/v\d+\.b\d+\.s\d+/i);
          if (aidMatch && (!s.aid || s.aid.toString().trim() === '')) s.aid = aidMatch[0];
        } catch (e) {}
        try {
          const searchText2 = [s.title, s.note, JSON.stringify(s.raw || {})].filter(Boolean).join(' ');
          const raMatch = searchText2.match(/[A-Z]\d{7}_\d{5}/i) || searchText2.match(/[A-Z]\d+_\d+/i);
          if (raMatch && (!s.raId || s.raId.toString().trim() === '')) s.raId = raMatch[0];
        } catch (e) {}
        try {
          const t = (s.title || '').toString();
          const volMatch = t.match(/^(.+?)\s+([A-Za-z]{1,3}[:\s]?\d+)/);
          if (volMatch) {
            if (!s.archive || s.archive === '') s.archive = volMatch[1].trim();
          }
        } catch (e) {}
        const after = { title: s.title || '', archive: s.archive || '', date: s.date || '', page: s.page || '', aid: s.aid || '', raId: s.raId || '' };
        if (JSON.stringify(before) !== JSON.stringify(after)) changed += 1;
      }
      setDbData(newDb);
      setEdits(prev => {
        const copy = { ...(prev || {}) };
        for (const s of newDb.gedcom_sources) copy[s.id] = { ...(copy[s.id] || {}), title: s.title || '', page: s.page || '', date: s.date || '', note: s.note || '' };
        return copy;
      });
      alert(`Färdig — uppdaterade metadata för ${changed} källor i granskning.`);
    } catch (err) { alert('Fel vid automatisk metadataifyllning: ' + (err && err.message ? err.message : String(err))); }
  }

  async function handleCommit(id, copyImages = false) {
    setBusy(true);
    try {
      // Ensure any pending edits are saved first
      await saveChanges(id);
      const res = await commitGedcomSource(dbData, id, { copyImages, imageFolderPrefix: 'kallor/' });
      if (res && res.db) {
        setDbData(res.db);
        if (showStatus) showStatus('Källa tillagd/uppdaterad: ' + (res.result && res.result.src ? (res.result.src.title || res.result.src.id) : id));
      } else if (res && res.error) {
        alert('Fel vid commit: ' + res.error);
      }
    } catch (e) { alert('Fel: ' + (e && e.message ? e.message : String(e))); }
    setBusy(false);
  }

  async function commitAll(copyImages = false) {
    if (!sources || !sources.length) return;
    if (!confirm('Commit alla GEDCOM‑källor? Detta kommer skapa/uppdatera källor i huvudregistret.')) return;
    setBusy(true);
    try {
      let currentDb = dbData;
      for (const s of sources.slice()) {
        // save edits first
        if (edits[s.id]) {
          const e = edits[s.id];
          const tmp = JSON.parse(JSON.stringify(currentDb));
          const idx = tmp.gedcom_sources.findIndex(x => x.id === s.id);
          if (idx !== -1) tmp.gedcom_sources[idx] = { ...tmp.gedcom_sources[idx], title: e.title, page: e.page, date: e.date, note: e.note, images: e.images };
          currentDb = tmp;
        }
        const res = await commitGedcomSource(currentDb, s.id, { copyImages, imageFolderPrefix: 'kallor/' });
        if (res && res.db) currentDb = res.db;
      }
      setDbData(currentDb);
      if (showStatus) showStatus('Alla GEDCOM‑källor committade.');
      // refresh local edits state
      const map = {};
      for (const s of (currentDb.gedcom_sources || [])) map[s.id] = { title: s.title || '', page: s.page || '', date: s.date || '', note: s.note || '', images: (s.images || []).slice() };
      setEdits(map);
    } catch (e) {
      alert('Fel vid Commit alla: ' + (e && e.message ? e.message : String(e)));
    }
    setBusy(false);
  }

  return (
    <div style={{ padding: 12 }}>
      <h3>Review GEDCOM‑källor</h3>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div>
          <button disabled={busy} onClick={() => commitAll(false)}>Commit alla (utan bilder)</button>
          <button disabled={busy} onClick={() => commitAll(true)} style={{ marginLeft: 8 }}>Commit alla (kopiera bilder)</button>
        </div>
        <div>
          <button onClick={async () => {
            if (!confirm('Fyll automatiskt titlar för alla GEDCOM‑källor i granskningen? Detta ändrar endast granskninglagret (gedcom_sources) i minnet).')) return;
            try {
              // Backup current gedcom_sources to audit file
              if (window.electronAPI && window.electronAPI.saveAuditBackup) {
                try {
                  await window.electronAPI.saveAuditBackup(`gedcom_sources_backup_${Date.now()}.json`, JSON.stringify(dbData.gedcom_sources || [], null, 2));
                } catch (e) { console.warn('Could not save backup before filling titles:', e); }
              }
              const newDb = JSON.parse(JSON.stringify(dbData || {}));
              newDb.gedcom_sources = (newDb.gedcom_sources || []).map(s => ({ ...s }));
              let changed = 0;
              for (const s of newDb.gedcom_sources) {
                const current = (s.title || '').toString().trim();
                const f = friendlyTitle(s);
                if ((!current || current === '' || current.toLowerCase() === 'source') && f && f !== '(ingen titel)') {
                  s.title = f;
                  changed += 1;
                }
              }
              setDbData(newDb);
              setEdits(prev => {
                const copy = { ...(prev || {}) };
                for (const s of newDb.gedcom_sources) copy[s.id] = { ...(copy[s.id] || {}), title: s.title || '' };
                return copy;
              });
              if (window && window.__lastGedcomApplyDebug) console.debug('filled titles, sample', window.__lastGedcomApplyDebug);
              alert(`Färdig — uppdaterade titlar för ${changed} källor i granskning.`);
            } catch (err) { alert('Fel vid automatisk ifyllning: ' + (err && err.message ? err.message : String(err))); }
          }}>Fyll titlar automatiskt</button>
        </div>
        <div>
          <button onClick={async () => {
            if (!confirm('Fyll automatiskt metadata (title, archive, date, page, aid, raId) för alla GEDCOM‑källor i granskningen? Detta ändrar endast granskninglagret (gedcom_sources) i minnet).')) return;
            try {
              // Backup current gedcom_sources to audit file
              if (window.electronAPI && window.electronAPI.saveAuditBackup) {
                try {
                  await window.electronAPI.saveAuditBackup(`gedcom_sources_meta_backup_${Date.now()}.json`, JSON.stringify(dbData.gedcom_sources || [], null, 2));
                } catch (e) { console.warn('Could not save backup before filling metadata:', e); }
              }
              const newDb = JSON.parse(JSON.stringify(dbData || {}));
              newDb.gedcom_sources = (newDb.gedcom_sources || []).map(s => ({ ...s }));
              let changed = 0;
              for (const s of newDb.gedcom_sources) {
                const heur = deriveFieldsFromRaw(s.raw || s);
                const before = { title: s.title || '', archive: s.archive || '', date: s.date || '', page: s.page || '', aid: s.aid || '', raId: s.raId || '' };
                // Title
                if ((!s.title || s.title.toString().trim() === '' || s.title.toString().toLowerCase() === 'source') && heur.title) s.title = heur.title;
                // Archive
                if ((!s.archive || s.archive.toString().trim() === '') && heur.archive) s.archive = heur.archive;
                // Date
                if ((!s.date || s.date.toString().trim() === '') && heur.date) s.date = heur.date;
                // Page
                if ((!s.page || s.page.toString().trim() === '') && heur.page) s.page = heur.page;
                // xref
                if ((!s.gedcomXref || s.gedcomXref.toString().trim() === '') && heur.xref) s.gedcomXref = heur.xref;
                // Attempt to extract AID (Arkiv Digital) from children/title/raw strings
                try {
                  const searchText = [s.title, s.note, JSON.stringify(s.raw || {})].filter(Boolean).join(' ');
                  const aidMatch = searchText.match(/v\d+\.b\d+\.s\d+/i);
                  if (aidMatch && (!s.aid || s.aid.toString().trim() === '')) s.aid = aidMatch[0];
                } catch (e) {}
                // Attempt to extract RA id like C0000001_00001
                try {
                  const searchText2 = [s.title, s.note, JSON.stringify(s.raw || {})].filter(Boolean).join(' ');
                  const raMatch = searchText2.match(/[A-Z]\d{7}_\d{5}/i) || searchText2.match(/[A-Z]\d+_\d+/i);
                  if (raMatch && (!s.raId || s.raId.toString().trim() === '')) s.raId = raMatch[0];
                } catch (e) {}
                // Heuristic: if title contains 'CI' or similar volume marker, try to set archive/volume
                try {
                  const t = (s.title || '').toString();
                  const volMatch = t.match(/^(.+?)\s+([A-Za-z]{1,3}[:\s]?\d+)/);
                  if (volMatch) {
                    if (!s.archive || s.archive === '') s.archive = volMatch[1].trim();
                  }
                } catch (e) {}
                const after = { title: s.title || '', archive: s.archive || '', date: s.date || '', page: s.page || '', aid: s.aid || '', raId: s.raId || '' };
                if (JSON.stringify(before) !== JSON.stringify(after)) changed += 1;
              }
              setDbData(newDb);
              // update edits map to reflect changed titles/pages/dates
              setEdits(prev => {
                const copy = { ...(prev || {}) };
                for (const s of newDb.gedcom_sources) copy[s.id] = { ...(copy[s.id] || {}), title: s.title || '', page: s.page || '', date: s.date || '', note: s.note || '' };
                return copy;
              });
              alert(`Färdig — uppdaterade metadata för ${changed} källor i granskning.`);
            } catch (err) { alert('Fel vid automatisk metadataifyllning: ' + (err && err.message ? err.message : String(err))); }
          }}>Fyll metadata automatiskt</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Sök i senaste audit (namn eller källa)" value={auditSearchTerm} onChange={e => setAuditSearchTerm(e.target.value)} style={{ padding: '4px 8px' }} />
          <button disabled={auditBusy} onClick={findInLatestAudit}>Hämta senaste audit‑debug</button>
          <button onClick={() => { if (window.electronAPI && window.electronAPI.openAuditBackupFolder) window.electronAPI.openAuditBackupFolder(); } }>Öppna audit‑mapp</button>
        </div>
      </div>
      <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid #ddd', padding: 8 }}>
        {sources.map(s => (
          <div key={s.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div><strong>Title</strong></div>
                <input value={(edits[s.id] && edits[s.id].title) || ''} onChange={e => updateEdit(s.id, 'title', e.target.value)} style={{ width: '100%' }} />
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{friendlyTitle(s)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#666' }}><strong>Page</strong></div>
                    <input value={(edits[s.id] && edits[s.id].page) || ''} onChange={e => updateEdit(s.id, 'page', e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#666' }}><strong>Date</strong></div>
                    <input value={(edits[s.id] && edits[s.id].date) || ''} onChange={e => updateEdit(s.id, 'date', e.target.value)} style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#666' }}><strong>Note</strong></div>
                  <textarea value={(edits[s.id] && edits[s.id].note) || ''} onChange={e => updateEdit(s.id, 'note', e.target.value)} style={{ width: '100%', minHeight: 80 }} />
                </div>
              </div>
              <div style={{ width: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button disabled={busy} onClick={() => saveChanges(s.id)}>Spara ändring</button>
                  <button disabled={busy} onClick={() => handleCommit(s.id, false)}>Commit (utan bilder)</button>
                  <button onClick={() => openRawForSource(s)}>Visa rådata</button>
                </div>
                {s.images && s.images.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {s.images.slice(0,6).map((im, i) => (
                      <div key={i} style={{ width: 120, height: 90, border: '1px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b' }}>
                        <div style={{ fontSize: 11, padding: 6, textAlign: 'center' }}>{String(im).split(/[\\/]/).pop()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={onClose}>Stäng</button>
      </div>
      {rawModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '80%', maxHeight: '80%', overflow: 'auto', background: '#1e293b', color: '#e2e8f0', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>{rawModal.title}</h4>
              <button onClick={() => setRawModal({ open: false, content: null, title: '' })}>Stäng</button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{rawModal.content}</pre>
          </div>
        </div>
      )}
      {auditResults && (
        <div style={{ marginTop: 8 }}>
          <h4>Audit‑resultat från {auditResults.file}</h4>
          <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #ddd', padding: 8 }}>
            <div><strong>Människor (upp till 50):</strong></div>
            {auditResults.peopleMatches.length === 0 && <div className="text-sm text-slate-400">Inga personer matchade.</div>}
            {auditResults.peopleMatches.map((p, i) => (
              <div key={i} style={{ padding: 6, borderBottom: '1px solid #eee' }}>{(p.firstName||'') + ' ' + (p.lastName||'')} · xref: {p.xref || p.pointer || ''}</div>
            ))}
            <div style={{ marginTop: 8 }}><strong>Källor (upp till 50):</strong></div>
            {auditResults.sourceMatches.length === 0 && <div className="text-sm text-slate-400">Inga källor matchade.</div>}
            {auditResults.sourceMatches.map((ss, i) => (
              <div key={i} style={{ padding: 6, borderBottom: '1px solid #eee' }}>{(ss.title||ss.archive||'(utan titel)')} · id: {ss.id || ss.xref || ''}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
