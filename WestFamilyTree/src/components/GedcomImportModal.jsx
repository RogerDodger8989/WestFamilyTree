import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { applyMappedToDb, exportMappedToGedcomSources } from '../gedcom/apply';
import GedcomReviewPanel from '../GedcomReviewPanel';

export default function GedcomImportModal({ open, onClose }) {
  const [filePath, setFilePath] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appliedResult, setAppliedResult] = useState(null);
  const [showRawResult, setShowRawResult] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const appCtx = useApp();
  const { dbData, setDbData, recordAudit, showStatus } = appCtx;

  if (!open) return null;

  async function pickFile() {
    setError(null);
    setPreview(null);
    setAppliedResult(null);
    try {
      if (!window.electronAPI || typeof window.electronAPI.openFileDialog !== 'function' || typeof window.electronAPI.gedcomRead !== 'function') {
        setError('GEDCOM-import kräver Electron. Starta appen i Electron (Vite + npm run electron).');
        return;
      }
      const res = await window.electronAPI.openFileDialog({ properties: ['openFile'], filters: [{ name: 'GEDCOM', extensions: ['ged'] }] });
      if (!res || res.canceled) return;
      const fp = res.filePaths && res.filePaths[0];
      if (!fp) return;
      setFilePath(fp);
      await loadPreview(fp);
    } catch (e) {
      console.error('pickFile error', e);
      setError(e.message || String(e));
    }
  }

  async function loadPreview(fp) {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.gedcomRead(fp);
      if (result && result.error) {
        setError(result.error);
      } else {
        setPreview(result);
        try {
          // Expose parsed payload to renderer devtools for debugging
          if (typeof window !== 'undefined') {
            window.__lastGedcomParsed = result.parsed || result;
            console.debug('[GedcomImportModal] stored parsed payload to window.__lastGedcomParsed');
          }
        } catch (ex) {
          // ignore
        }
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!preview || !preview.parsed) return;
    setLoading(true);
    setError(null);
    try {
      // Prefer doing mapping in the renderer (more consistent ESM environment).
      // If a parsed payload is available from preview, map it locally.
      let mapped = null;
      try {
        const mapperModule = await import('../gedcom/mapper');
        const mapperExport = mapperModule && (mapperModule.default || mapperModule);
        if (typeof mapperExport === 'function') mapped = mapperExport(preview.parsed);
        else if (mapperExport && typeof mapperExport.mapParsedGedcom === 'function') mapped = mapperExport.mapParsedGedcom(preview.parsed);
        if (mapped) {
          console.debug('[GedcomImportModal] renderer mapped counts:', { people: (mapped && mapped.people) ? mapped.people.length : 0, families: (mapped && mapped.families) ? mapped.families.length : 0, sources: (mapped && mapped.sources) ? mapped.sources.length : 0 });
        }
      } catch (mapErr) {
        console.warn('Renderer mapping failed, falling back to main mapping:', mapErr);
        // fallback to asking main process to map
        if (!window.electronAPI || typeof window.electronAPI.gedcomApply !== 'function') {
          setError('Rendering mapping failed and main mapping unavailable: ' + (mapErr && mapErr.message ? mapErr.message : String(mapErr)));
          setLoading(false);
          return;
        }
        const res = await window.electronAPI.gedcomApply(preview.parsed, { strategy: 'mapOnly' });
        if (res && res.error) {
          setError(res.error);
          setLoading(false);
          return;
        }
        mapped = res && res.mapped;
      }

      if (!mapped) {
        setError('No mapped data available from main process');
        setLoading(false);
        return;
      }
      // --- TEMP DIAGNOSTICS: count mapped sources that contain AID and save audit backup ---
      try {
        const aidRegex = /v\d{4,}(?:\\.b\d+)?(?:\\.s\d+)?/i;
        const mappedSources = Array.isArray(mapped.sources) ? mapped.sources : [];
        const mappedCitations = Array.isArray(mapped.citations) ? mapped.citations : [];
        const hasAidIn = (o) => {
          try { return aidRegex.test(JSON.stringify(o || '')); } catch (e) { return false; }
        };
        const mappedSourcesWithAid = mappedSources.filter(s => hasAidIn(s) || (s && s.aid && aidRegex.test(String(s.aid))));
        const mappedCitationsWithAid = mappedCitations.filter(c => hasAidIn(c) || (c && c.aid && aidRegex.test(String(c.aid))));
        console.debug('[GedcomImportModal][diag] mapped.sources total:', mappedSources.length, 'with AID:', mappedSourcesWithAid.length);
        console.debug('[GedcomImportModal][diag] mapped.citations total:', mappedCitations.length, 'with AID:', mappedCitationsWithAid.length);
        try {
          if (window && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
            await window.electronAPI.saveAuditBackup(`gedcom-mapped-before-apply-${Date.now()}.json`, JSON.stringify({ mappedSummary: { sources: mappedSources.length, sourcesWithAid: mappedSourcesWithAid.length, citations: mappedCitations.length, citationsWithAid: mappedCitationsWithAid.length }, examples: { sources: mappedSourcesWithAid.slice(0,20), citations: mappedCitationsWithAid.slice(0,20) } }, null, 2), 'gedcom-debug');
            await window.electronAPI.saveAuditBackup(`db-before-apply-${Date.now()}.json`, JSON.stringify(dbData || {}, null, 2), 'gedcom-debug');
            console.debug('[GedcomImportModal][diag] saved pre-apply audit backups');
          }
        } catch (e) { console.warn('[GedcomImportModal][diag] failed to save pre-apply backup', e); }
      } catch (e) { console.warn('[GedcomImportModal][diag] diagnostic error', e); }

      // apply in renderer with chosen strategy (match by XREF)
      console.debug('[GedcomImportModal] applying mapped data (counts):', {
        people: (mapped && mapped.people) ? mapped.people.length : 0,
        families: (mapped && mapped.families) ? mapped.families.length : 0,
        sources: (mapped && mapped.sources) ? mapped.sources.length : 0
      });
      const applyRes = applyMappedToDb({ dbData, mapped, strategy: 'matchByXref' });
      // commit new db and metadata
      setDbData(applyRes.db);
      try { if (recordAudit) {
        (applyRes.created.people || []).forEach(p => recordAudit({ type: 'create', entityType: 'person', entityId: p.id, details: { refNumber: p.refNumber, name: p.name } }));
      } } catch (e) {}
      try { if (showStatus) showStatus('Import applicerad: ' + ((applyRes.created.people || []).length) + ' nya personer.'); } catch (e) {}
      setAppliedResult(applyRes);
      // Expose apply result for debugging in DevTools
      try {
        if (typeof window !== 'undefined') {
          window.__lastGedcomApplyDebug = applyRes;
          console.debug('[GedcomImportModal] exported applyRes to window.__lastGedcomApplyDebug');
        }
      } catch (e) { console.warn('Failed to set window.__lastGedcomApplyDebug', e); }
      // --- TEMP DIAGNOSTICS AFTER APPLY ---
      try {
        const aidRegex = /v\d{4,}(?:\\.b\d+)?(?:\\.s\d+)?/i;
        const createdSources = (applyRes.created && Array.isArray(applyRes.created.sources)) ? applyRes.created.sources : [];
        const updatedSources = (applyRes.updated && Array.isArray(applyRes.updated.sources)) ? applyRes.updated.sources : [];
        const createdWithAid = createdSources.filter(s => s && ((s.aid && aidRegex.test(String(s.aid))) || aidRegex.test(JSON.stringify(s || ''))));
        const updatedWithAid = updatedSources.filter(s => s && ((s.aid && aidRegex.test(String(s.aid))) || aidRegex.test(JSON.stringify(s || ''))));
        const totalDbAid = (applyRes.db && Array.isArray(applyRes.db.sources)) ? applyRes.db.sources.filter(s => s && ((s.aid && aidRegex.test(String(s.aid))) || aidRegex.test(JSON.stringify(s || '')))).length : 0;
        console.debug('[GedcomImportModal][diag] created sources with AID:', createdWithAid.length, 'updated with AID:', updatedWithAid.length, 'total db.sources with AID:', totalDbAid);
        try {
          if (window && window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
            await window.electronAPI.saveAuditBackup(`gedcom-import-diagnostic-${Date.now()}.json`, JSON.stringify({ createdWithAid: createdWithAid.map(s => ({ id: s.id, title: s.title, aid: s.aid })).slice(0,200), updatedWithAid: updatedWithAid.map(s => ({ id: s.id, title: s.title, aid: s.aid })).slice(0,200), totalDbAid }, null, 2), 'gedcom-debug');
            console.debug('[GedcomImportModal][diag] saved post-apply diagnostic');
          }
        } catch (e) { console.warn('[GedcomImportModal][diag] failed to save post-apply diagnostic', e); }
      } catch (e) { console.warn('[GedcomImportModal][diag] post-apply diag error', e); }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gedcom-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="gedcom-modal" style={{ width: 760, maxWidth: '95%', background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: 16 }}>
        <h3>Importera GEDCOM</h3>
        <div style={{ marginBottom: 8 }}>
          <button onClick={pickFile}>Välj GEDCOM-fil...</button>
          <button onClick={() => { setFilePath(null); setPreview(null); setError(null); setAppliedResult(null); }} style={{ marginLeft: 8 }}>Rensa</button>
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>Vald fil:</strong> {filePath || 'Ingen fil vald'}
        </div>
        {loading && <div>Bearbetar...</div>}
        {error && <div style={{ color: 'crimson' }}><strong>Fel:</strong> {error}</div>}
        {preview && preview.summary && (
          <div style={{ marginTop: 8 }}>
            <div><strong>Sammanfattning:</strong></div>
            <div>- Individer: {preview.summary.individuals}</div>
            <div>- Familjer: {preview.summary.families}</div>
            <div>- Källor: {preview.summary.sources}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={handleImport}>Importera (Match by XREF)</button>
              <button onClick={async () => {
                // Export mapped preview into gedcom_sources (separat lager) so user can review
                setLoading(true); setError(null);
                try {
                  // Map in renderer or via main as earlier
                  let mapped = null;
                  try {
                    const mapperModule = await import('../gedcom/mapper');
                    const mapperExport = mapperModule && (mapperModule.default || mapperModule);
                    if (typeof mapperExport === 'function') mapped = mapperExport(preview.parsed);
                    else if (mapperExport && typeof mapperExport.mapParsedGedcom === 'function') mapped = mapperExport.mapParsedGedcom(preview.parsed);
                  } catch (e) { /* ignore - fallback handled below */ }
                  if (!mapped) {
                    const res = await window.electronAPI.gedcomApply(preview.parsed, { strategy: 'mapOnly' });
                    mapped = res && res.mapped;
                  }
                  if (!mapped) { setError('Kunde inte mappa GEDCOM i renderer eller main'); setLoading(false); return; }
                  const exportRes = await exportMappedToGedcomSources(dbData, mapped);
                  if (exportRes && exportRes.db) {
                    setDbData(exportRes.db);
                    setShowReviewPanel(true);
                    if (showStatus) showStatus('GEDCOM exporterat till separat lager för granskning');
                  } else {
                    setError('Export till gedcom_sources misslyckades');
                  }
                } catch (e) { setError(e && e.message ? e.message : String(e)); }
                setLoading(false);
              }} style={{ marginLeft: 8 }}>Importera till GEDCOM‑lager (granska)</button>
              <button onClick={async () => {
                // create all strategy - create persons/families/sources regardless of existing XREFs
                setLoading(true);
                setError(null);
                try {
                  const res = await window.electronAPI.gedcomApply(preview.parsed, { strategy: 'mapOnly' });
                  if (res && res.error) {
                    setError(res.error);
                    setLoading(false);
                    return;
                  }
                  let mapped = res && res.mapped;
                  if (!mapped && res && res.parsed) {
                    const mapperModule = await import('../gedcom/mapper');
                      const mapperExport = mapperModule && (mapperModule.default || mapperModule);
                      if (typeof mapperExport === 'function') mapped = mapperExport(res.parsed);
                      else if (mapperExport && typeof mapperExport.mapParsedGedcom === 'function') mapped = mapperExport.mapParsedGedcom(res.parsed);
                  }
                  if (!mapped) {
                    setError('No mapped data available from main process');
                    setLoading(false);
                    return;
                  }
                  const applyRes = applyMappedToDb({ dbData, mapped, strategy: 'createAll' });
                  setDbData(applyRes.db);
                  try { if (recordAudit) {
                    (applyRes.created.people || []).forEach(p => recordAudit({ type: 'create', entityType: 'person', entityId: p.id, details: { refNumber: p.refNumber, name: p.name } }));
                  } } catch (e) {}
                  try { if (showStatus) showStatus('Import applicerad (skapat): ' + ((applyRes.created.people || []).length) + ' nya personer.'); } catch (e) {}
                  setAppliedResult(applyRes);
                } catch (e) {
                  setError(e.message || String(e));
                } finally {
                  setLoading(false);
                }
              }}>Importera (Skapa alla)</button>
            </div>
          </div>
        )}
        {showReviewPanel && (
          <div style={{ marginTop: 12 }}>
            <GedcomReviewPanel onClose={() => setShowReviewPanel(false)} />
          </div>
        )}
        {appliedResult && (
          <div style={{ marginTop: 12, background: '#0f172a', padding: 8, color: '#e2e8f0' }}>
            <strong>Importresultat:</strong>
            <div style={{ marginTop: 8 }}>
              {/* concise summary */}
              {(() => {
                const created = appliedResult.created || {};
                const people = created.people || [];
                const createdFamilies = created.families || [];
                const updatedFamilies = (appliedResult.updated && appliedResult.updated.families) ? appliedResult.updated.families : [];
                const sources = created.sources || [];
                return (
                  <div>
                    <div>- Nya personer: {people.length}</div>
                    <div>- Nya familjer: {createdFamilies.length} (skapade), {updatedFamilies.length} (uppdaterade)</div>
                    <div>- Nya källor: {sources.length}</div>
                    {people.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div><em>Första personer:</em></div>
                        {people.slice(0, 5).map((p, i) => (
                          <div key={i}>- {p.name || p.fullName || p.refNumber || p.id}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => setShowRawResult(v => !v)}>{showRawResult ? 'Dölj rådata' : 'Visa rådata'}</button>
            </div>
            {showRawResult && (
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, maxHeight: 360, overflow: 'auto' }}>{JSON.stringify(appliedResult, null, 2)}</pre>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onClose} style={{ marginLeft: 8 }}>Stäng</button>
        </div>
      </div>
    </div>
  );
}
