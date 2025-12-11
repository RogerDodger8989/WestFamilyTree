import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';

function prettyDetails(details, dbData) {
  if (!details) return '';
  if (details.relation) {
    const r = details.relation;
    const from = dbData.people?.find(p => p.id === r.fromPersonId);
    const to = dbData.people?.find(p => p.id === r.toPersonId);
    const rel = { ...r, fromLabel: from ? `${from.firstName} ${from.lastName}` : r.fromPersonId, toLabel: to ? `${to.firstName} ${to.lastName}` : r.toPersonId };
    return rel;
  }
  return details;
}

export default function AuditPanel() {
  const { dbData, setDbData, handleOpenEditModal, handleNavigateToSource, handleNavigateToPlace, handleViewInFamilyTree, showStatus, deletePersonPermanently, restorePerson, archivePerson, recordAudit, handleEditFormChange, setIsDirty } = useApp();
  const audits = (dbData?.meta && Array.isArray(dbData.meta.audit)) ? dbData.meta.audit.slice().reverse() : [];

  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const allTypes = useMemo(() => Array.from(new Set((dbData?.meta?.audit || []).map(a => a.type))).filter(Boolean), [dbData?.meta]);
  const allEntities = useMemo(() => Array.from(new Set((dbData?.meta?.audit || []).map(a => a.entityType))).filter(Boolean), [dbData?.meta]);
  // Build a free-text searchable string for an audit entry covering all visible
  // columns and common detail shapes (person name/ref, source/place fields,
  // relation labels, actor, timestamps, and the details JSON).
  const auditSearchText = (a) => {
    try {
      const parts = [];
      // type label
      parts.push(typeLabel(a.type) || a.type || '');
      // entity label
      parts.push(entityLabel(a.entityType) || a.entityType || '');
      // actor & id
      if (a.actor) parts.push(a.actor);
      if (a.entityId) parts.push(a.entityId);
      // display name (person or labelFor)
      try {
        if (a.entityType === 'person') {
          // prefer live data
          const p = a.entityId ? dbData.people?.find(x => x.id === a.entityId) : null;
          if (p && (p.firstName || p.lastName)) parts.push(`${p.firstName || ''} ${p.lastName || ''}`.trim());
          // details snapshot
          if (a.details) {
            if (typeof a.details.name === 'string') parts.push(a.details.name);
            const snap = a.details.person || a.details.snapshot || a.details.createdPerson || a.details.newPerson || null;
            if (snap && (snap.firstName || snap.lastName)) parts.push(`${snap.firstName || ''} ${snap.lastName || ''}`.trim());
          }
        } else {
          const lbl = labelFor(a);
          if (lbl) parts.push(lbl);
        }
      } catch (e) {}
      // ref number display
      try {
        if (a.entityType === 'person') {
          let refVal = '';
          const p = a.entityId ? dbData.people?.find(p => p.id === a.entityId) : null;
          if (p && (p.refNumber || p.refNumber === 0)) refVal = String(p.refNumber);
          if (!refVal && a.details && (a.details.refNumber || a.details.refNumber === 0)) refVal = String(a.details.refNumber);
          const snap = a.details && (a.details.person || a.details.snapshot || a.details.createdPerson || a.details.newPerson) || null;
          if (!refVal && snap && (snap.refNumber || snap.refNumber === 0)) refVal = String(snap.refNumber);
          if (refVal) parts.push(refVal);
        }
      } catch (e) {}
      // pretty details and details JSON
      try {
        const pretty = prettyDetails(a.details, dbData);
        if (pretty) parts.push(typeof pretty === 'string' ? pretty : JSON.stringify(pretty));
      } catch (e) {}
      if (a.details) parts.push(JSON.stringify(a.details));
      // timestamp
      if (a.timestamp) parts.push(new Date(a.timestamp).toLocaleString());
      return parts.filter(Boolean).join(' ').toLowerCase();
    } catch (err) {
      return (a.type || '') + ' ' + (a.entityType || '') + ' ' + (a.entityId || '') + ' ' + (a.details ? JSON.stringify(a.details) : '');
    }
  };

  const filtered = audits.filter(a => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (entityFilter && a.entityType !== entityFilter) return false;
    if (q) {
      const s = q.toLowerCase().trim();
      if (!s) return true;
      const hay = auditSearchText(a);
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const typeLabel = (t) => {
    switch ((t || '').toString()) {
      case 'create': return 'Skapad';
      case 'edit': return 'Redigerad';
      case 'delete': return 'Raderad';
      case 'archive': return 'Arkiverad';
      case 'restore': return 'Återställd';
      case 'link': return 'Länkad';
      case 'merge': return 'Sammanslagen';
      default: return t || '';
    }
  };

  const entityLabel = (e) => {
    switch ((e || '').toString()) {
      case 'person': return 'Person';
      case 'source': return 'Källa';
      case 'place': return 'Plats';
      case 'relation': return 'Relation';
      case 'merge': return 'Sammanfogning';
      case 'unknown': return 'Okänd';
      default: return e || '';
    }
  };

  const handleUndoAudit = async (entry) => {
    if (!entry || entry.entityType !== 'person' || !entry.entityId) {
      showStatus('Ångra ej stöd för denna post.');
      return;
    }
    const id = entry.entityId;
    try {
      if (entry.type === 'create') {
        // remove the created person
        if (confirm('Ångra skapandet? Detta tar bort personen permanent.')) {
          deletePersonPermanently(id);
        }
      } else if (entry.type === 'archive') {
        restorePerson(id);
      } else if (entry.type === 'restore') {
        archivePerson(id, 'Ångrad via historik');
      } else if (entry.type === 'edit') {
        // revert inline/modal edits by applying the `before` snapshot if available
        const before = entry?.details?.before;
        if (!before || typeof before !== 'object') {
          showStatus('Ingen föregående version att återställa.');
          return;
        }
        if (!confirm('Återställ personens fält till tidigare värden? Detta skapar en återställningspost i historiken.')) return;

        // Apply the before snapshot to the person in dbData
        setDbData(prev => {
          const people = Array.isArray(prev.people) ? prev.people.slice() : [];
          const idx = people.findIndex(p => p.id === id);
          if (idx === -1) return prev; // nothing to do
          const existing = people[idx] || {};
          // Merge shallowly, preferring values from `before`
          const updated = { ...existing, ...before, id };
          people[idx] = updated;
          const next = { ...prev, people };
          try { localStorage.setItem('wft_last_db', JSON.stringify(next)); } catch (e) {}
          return next;
        });

        // mark dirty and record a revert audit entry
        try { setIsDirty && setIsDirty(true); } catch (e) {}
        try {
          recordAudit && recordAudit({
            type: 'revert',
            entityType: 'person',
            entityId: id,
            actor: 'user',
            timestamp: Date.now(),
            details: { revertedFromAuditId: entry.id, before: entry.details.before, after: entry.details.after }
          });
        } catch (e) {
          console.debug('recordAudit (revert) failed', e);
        }
        showStatus('Person återställd till tidigare version.');
      } else {
        showStatus('Ångra ej automatiskt stödd för denna åtgärd.');
      }
    } catch (err) {
      console.debug('handleUndoAudit failed', err);
      showStatus('Ångra misslyckades.');
    }
  };

  const handleDeletePersonFromAudit = (entry) => {
    if (!entry || entry.entityType !== 'person' || !entry.entityId) return showStatus('Ingen person att radera.');
    if (!confirm('Vill du verkligen radera personen permanent? Detta går inte att ångra.')) return;
    try {
      deletePersonPermanently(entry.entityId);
    } catch (err) {
      console.debug('deletePersonFromAudit failed', err);
      showStatus('Radering misslyckades.');
    }
  };

  const openEntity = (entry) => {
    try {
      if (entry.entityType === 'person' && entry.entityId) return handleOpenEditModal(entry.entityId);
      if (entry.entityType === 'relation' && entry.details && entry.details.relation) {
        const rel = entry.details.relation;
        if (rel.fromPersonId) return handleViewInFamilyTree(rel.fromPersonId);
        if (rel.toPersonId) return handleViewInFamilyTree(rel.toPersonId);
      }

      // For sources/places try entityId first; if not present or not found, look into details for common snapshot shapes
      if (entry.entityType === 'source') {
        let sid = entry.entityId;
        if (!sid && entry.details) {
          const d = entry.details;
          sid = d.source?.id || d.createdSource?.id || d.newSource?.id || d.id || null;
        }
        if (sid) {
          // Ensure target exists in current DB if possible
          const exists = !!dbData.sources?.find(s => s.id === sid);
          if (!exists) {
            showStatus('Kunde inte hitta källan i databas — försöker ändå öppna.');
          }
          return handleNavigateToSource(sid);
        }
        showStatus('Ingen källa att öppna för denna audit-post.');
        return;
      }

      if (entry.entityType === 'place') {
        let pid = entry.entityId;
        if (!pid && entry.details) {
          const d = entry.details;
          pid = d.place?.id || d.createdPlace?.id || d.newPlace?.id || d.id || null;
        }
        if (pid) {
          const exists = !!dbData.places?.find(p => p.id === pid);
          if (!exists) {
            showStatus('Kunde inte hitta platsen i databas — försöker ändå öppna.');
          }
          return handleNavigateToPlace(pid);
        }
        showStatus('Ingen plats att öppna för denna audit-post.');
        return;
      }
    } catch (e) {
      // best-effort
      if (process.env.NODE_ENV !== 'production') console.debug('openEntity failed', e);
    }
  };

  const labelFor = (entry) => {
    if (!entry) return '';
    const { entityType, entityId } = entry;
    if (!entityId) return entityType;
    if (entityType === 'person') {
      const p = dbData.people?.find(x => x.id === entityId);
      return p ? `${p.firstName} ${p.lastName}` : `${entityType} (${entityId})`;
    }
    if (entityType === 'source') {
      const s = dbData.sources?.find(x => x.id === entityId);
      return s ? (s.sourceString || `${s.archive || ''} ${s.volume || ''}`.trim()) : `${entityType} (${entityId})`;
    }
    if (entityType === 'place') {
      const pl = dbData.places?.find(x => x.id === entityId);
      return pl ? [pl.specific, pl.village, pl.parish, pl.municipality].filter(Boolean).join(', ') : `${entityType} (${entityId})`;
    }
    return `${entityType} (${entityId})`;
  };

  return (
    <div className="tab-content max-w-6xl mx-auto w-full">
      <div className="bg-slate-800 rounded-xl shadow p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-200">Audit / Historik</h3>
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök..." className="px-2 py-1 border border-slate-600 rounded bg-slate-900 text-slate-200" />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-2 py-1 border border-slate-600 rounded bg-slate-900 text-slate-200">
              <option value="">Alla typer</option>
              {allTypes.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="px-2 py-1 border border-slate-600 rounded bg-slate-900 text-slate-200">
              <option value="">Alla enheter</option>
              {allEntities.map(t => <option key={t} value={t}>{entityLabel(t)}</option>)}
            </select>
            <button type="button" onClick={() => {
              if (typeFilter === 'warning' && entityFilter === 'relation-validation') {
                setTypeFilter(''); setEntityFilter(''); setQ('');
              } else {
                setTypeFilter('warning'); setEntityFilter('relation-validation'); setQ('');
              }
            }} className="px-2 py-1 text-xs border border-slate-600 rounded bg-slate-700 text-slate-200 hover:bg-slate-600">Visa relation-validering</button>
            <button type="button" onClick={async () => {
              // Export: copy to clipboard and attempt to save to disk via Electron if available
              try {
                const audit = dbData?.meta?.audit || [];
                const json = JSON.stringify(audit, null, 2);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(json);
                  showStatus('Audit kopierad till urklipp.');
                }
                if (window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
                  const res = await window.electronAPI.saveAuditBackup('audit_export.json', json, dbData?.meta?.auditBackupDir || null);
                  if (res && res.success) showStatus('Audit sparad till disk.');
                  else showStatus('Export misslyckades att spara till disk.');
                }
              } catch (err) {
                console.debug('export audit error', err);
                showStatus('Export misslyckades.');
              }
            }} className="px-2 py-1 text-xs border border-slate-600 rounded bg-slate-700 text-slate-200 hover:bg-slate-600">Exportera audit</button>
            <button type="button" onClick={async () => {
              // Import: open file dialog and read JSON
              try {
                if (!window.electronAPI || typeof window.electronAPI.openFileDialog !== 'function') {
                  showStatus('Import kräver Electron (inte tillgängligt i denna miljö).');
                  return;
                }
                const pick = await window.electronAPI.openFileDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
                if (!pick || pick.canceled || !Array.isArray(pick.filePaths) || pick.filePaths.length === 0) {
                  showStatus('Import avbröts.');
                  return;
                }
                const fp = pick.filePaths[0];
                const data = await window.electronAPI.readFile(fp);
                let text = null;
                if (typeof data === 'string') text = data;
                else if (data && data.buffer) text = new TextDecoder().decode(new Uint8Array(data.buffer));
                else if (data instanceof Uint8Array) text = new TextDecoder().decode(data);
                else if (data && data.length) text = new TextDecoder().decode(new Uint8Array(data));
                if (!text) {
                  showStatus('Kunde inte läsa filen.');
                  return;
                }
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) {
                  showStatus('Importfilen innehåller inte en giltig audit-array.');
                  return;
                }
                setDbData(prev => ({ ...prev, meta: { ...(prev.meta || {}), audit: parsed } }));
                try { localStorage.setItem('wft_audit_backup', JSON.stringify(parsed)); } catch (e) {}
                showStatus('Audit importerad.');
              } catch (err) {
                console.debug('import audit error', err);
                showStatus('Import misslyckades.');
              }
            }} className="px-2 py-1 text-xs border border-slate-600 rounded bg-slate-700 text-slate-200 hover:bg-slate-600">Importera audit</button>
            <button type="button" onClick={async () => {
              try {
                if (window.electronAPI && typeof window.electronAPI.openAuditBackupFolder === 'function') {
                  const dir = dbData?.meta?.auditBackupDir || null;
                  const res = await window.electronAPI.openAuditBackupFolder(dir);
                  if (res && res.success) {
                    showStatus('Öppnade backup-mapp.');
                  } else {
                    showStatus('Kunde inte öppna backup-mapp.');
                    console.debug('openAuditBackupFolder failed', res);
                  }
                } else {
                  showStatus('Backup-mapp kan inte öppnas i denna miljö.');
                }
              } catch (err) {
                console.debug('openAuditBackupFolder error', err);
                showStatus('Fel vid öppning av backup-mapp.');
              }
            }} className="px-2 py-1 text-xs border border-slate-600 rounded bg-slate-700 text-slate-200 hover:bg-slate-600">Öppna backup-mapp</button>
          </div>
        </div>

        <div className="text-sm text-slate-400 mb-4">Visar {filtered.length} av {(audits||[]).length} poster</div>

        <div className="overflow-y-auto max-h-[60vh] border border-slate-700 rounded bg-slate-800">
          <table className="w-full text-left text-slate-200">
            <thead className="bg-slate-900 sticky top-0">
                <tr>
                  <th className="p-2 text-xs text-slate-300">Tid</th>
                  <th className="p-2 text-xs text-slate-300">Typ</th>
                  <th className="p-2 text-xs text-slate-300">Namn</th>
                  <th className="p-2 text-xs text-slate-300">Ref</th>
                  <th className="p-2 text-xs text-slate-300">Åtgärd</th>
                </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isExpanded = expanded.has(a.id);
                const pretty = prettyDetails(a.details, dbData);
                return (
                  <React.Fragment key={a.id}>
                    <tr className="border-b border-slate-700 hover:bg-slate-700">
                      <td className="p-2 align-top text-xs text-slate-400">{new Date(a.timestamp).toLocaleString()}</td>
                      <td className="p-2 align-top text-sm font-medium text-slate-300">{typeLabel(a.type)}</td>
                      <td className="p-2 align-top text-sm">
                        {a.entityType === 'person' ? (
                          (() => {
                            const id = a.entityId;
                            // 1) Live data from dbData.people
                            if (id) {
                              const p = dbData.people?.find(x => x.id === id) || null;
                              if (p && (p.firstName || p.lastName)) {
                                const name = `${p.firstName || ''} ${p.lastName || ''}`.trim();
                                return (<button onClick={() => openEntity(a)} className="text-left px-0 py-0 text-sm text-blue-600 hover:underline">{name}</button>);
                              }
                            }
                            // 2) Fallback to details.name (string)
                            if (a.details && typeof a.details.name === 'string' && a.details.name.trim()) {
                              // show as plain text (no open action if no entityId)
                              return (<span className="text-sm text-slate-200">{a.details.name}</span>);
                            }
                            // 3) Fallback to common snapshot fields in details
                            if (a.details && typeof a.details === 'object') {
                              const det = a.details;
                              const snap = det.person || det.snapshot || det.createdPerson || det.newPerson || null;
                              if (snap && (snap.firstName || snap.lastName)) {
                                const name = `${snap.firstName || ''} ${snap.lastName || ''}`.trim();
                                return (<span className="text-sm text-slate-200">{name}</span>);
                              }
                            }
                            // 4) Final fallback
                            return (<span className="text-sm text-slate-400">(okänd)</span>);
                          })()
                        ) : (
                          (() => {
                            const lbl = labelFor(a);
                            if (a.entityId) {
                              return (<button onClick={() => openEntity(a)} className="text-left px-0 py-0 text-sm text-blue-600 hover:underline">{lbl}</button>);
                            }
                            return (<span className="text-sm text-slate-200">{lbl}</span>);
                          })()
                        )}
                        {/* Show svMessage prominently for relation-validation entries */}
                        {a.details && a.details.svMessage && (
                          <div className="mt-1 text-sm text-red-700 font-medium">{a.details.svMessage}</div>
                        )}
                      </td>
                      <td className="p-2 align-top text-sm">{
                        (() => {
                          if (a.entityType !== 'person') return '';
                          let refVal = '';
                          let src = null; // 'live' | 'details' | 'snapshot'
                          if (a.entityId) {
                            const p = dbData.people?.find(p => p.id === a.entityId) || null;
                            if (p && (p.refNumber || p.refNumber === 0)) {
                              refVal = p.refNumber;
                              src = 'live';
                            }
                          }
                          if (!src && a.details && (a.details.refNumber || a.details.refNumber === 0)) {
                            refVal = a.details.refNumber;
                            src = 'details';
                          }
                          if (!src && a.details && typeof a.details === 'object') {
                            const det = a.details;
                            const snap = det.person || det.snapshot || det.createdPerson || det.newPerson || null;
                            if (snap && (snap.refNumber || snap.refNumber === 0)) {
                              refVal = snap.refNumber;
                              src = 'snapshot';
                            }
                          }
                          if (!src) return '';
                          if (src === 'live') {
                            return (<button onClick={() => openEntity(a)} className="text-left px-0 py-0 text-sm text-blue-600 hover:underline">{refVal}</button>);
                          }
                          // details or snapshot: show muted italic indicator
                          return (<span className="text-sm text-slate-500 italic">{refVal}</span>);
                        })()
                      }</td>
                      <td className="p-2 align-top">
                        <div className="flex gap-2">
                          {a.entityType === 'person' ? (
                            <>
                              <button onClick={() => handleUndoAudit(a)} className="px-2 py-1 text-xs bg-amber-700 text-amber-100 border border-amber-600 rounded hover:bg-amber-600">Ångra</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => openEntity(a)} className="px-2 py-1 text-xs bg-blue-700 text-blue-100 border border-blue-600 rounded hover:bg-blue-600">Öppna</button>
                            </>
                          )}
                          <button onClick={() => toggle(a.id)} className="px-2 py-1 text-xs border border-slate-600 bg-slate-700 text-slate-200 rounded hover:bg-slate-600">{isExpanded ? 'Dölj' : 'Visa'}</button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-900">
                        <td colSpan={5} className="p-3">
                          <div className="text-xs font-medium mb-2 text-slate-300">Detaljer</div>
                          <pre className="text-xs overflow-auto p-2 bg-slate-950 border border-slate-700 rounded text-slate-200" style={{ maxHeight: 280 }}>{typeof pretty === 'string' ? pretty : JSON.stringify(pretty, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-sm text-slate-500">Inga poster matchar filtren.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
