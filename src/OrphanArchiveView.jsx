import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useApp } from './AppContext';

export default function OrphanArchiveView({ people = [], allSources = [], onOpenPerson = () => {}, onViewInFamilyTree = () => {} }) {
  const { getPersonRelations, restorePerson, deletePersonPermanently, showStatus } = useApp();
  const [filterName, setFilterName] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [showOnlyOrphans, setShowOnlyOrphans] = useState(false);
  const [showOnlyArchived, setShowOnlyArchived] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmState, setConfirmState] = useState(null); // { type: 'delete'|'restore'|'mass-delete'|'mass-restore', ids: [] }

  // Derived candidate list
  const candidates = useMemo(() => {
    return (people || []).filter(p => {
      if (showOnlyArchived && !p._archived) return false;
      if (!showOnlyArchived && p._archived) return false;
      if (filterName) {
        const q = filterName.toLowerCase();
        const full = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      if (filterYear) {
        const hasYear = (p.events || []).some(e => (e.date || '').includes(filterYear));
        if (!hasYear) return false;
      }
      if (showOnlyOrphans) {
        const rels = (getPersonRelations && getPersonRelations(p.id)) || [];
        const hasRelations = rels.some(r => !r._archived);
        const hasEvents = (p.events || []).length > 0;
        if (hasRelations || hasEvents) return false;
      }
      return true;
    }).sort((a,b) => ((b._archived ? 1:0) - (a._archived ? 1:0)) || (a.lastName||'').localeCompare(b.lastName||''));
  }, [people, filterName, filterYear, showOnlyOrphans, showOnlyArchived, getPersonRelations]);

  useEffect(() => {
    // clear selection when candidate list changes
    setSelectedIds(prev => {
      const next = new Set(Array.from(prev).filter(id => candidates.find(c => c.id === id)));
      return next;
    });
  }, [candidates]);

  const toggleSelect = (id) => setSelectedIds(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const selectAll = () => setSelectedIds(new Set(candidates.map(c => c.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const doRestore = useCallback((ids) => {
    ids.forEach(id => {
      try { restorePerson(id); } catch (e) { /* ignore per-person errors */ }
    });
    showStatus(`Återställde ${ids.length} personer.`);
    clearSelection();
  }, [restorePerson, showStatus]);

  const doDelete = useCallback((ids) => {
    ids.forEach(id => {
      try { deletePersonPermanently(id); } catch (e) { /* ignore */ }
    });
    showStatus(`Raderade ${ids.length} personer.`);
    clearSelection();
  }, [deletePersonPermanently, showStatus]);

  // keyboard handlers: Delete to prompt delete for selected, Enter to open first selected
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Delete' && selectedIds.size > 0) {
        setConfirmState({ type: 'mass-delete', ids: Array.from(selectedIds) });
      }
      if (e.key === 'Enter' && selectedIds.size === 1) {
        const id = Array.from(selectedIds)[0];
        onOpenPerson(id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, onOpenPerson]);

  return (
    <div className="flex h-full">
      {/* Sidebar filters */}
      <aside className="w-80 border-r border-subtle bg-surface p-3 overflow-y-auto">
        <h2 className="font-bold text-lg mb-3 text-primary">Orphan-arkivet</h2>
        <div className="mb-3">
          <label className="text-xs text-muted">Sök namn</label>
          <input aria-label="Sök namn" className="w-full p-2 border border-subtle bg-background text-primary rounded mt-1" value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Förnamn eller efternamn" />
        </div>
        <div className="mb-3">
          <label className="text-xs text-muted">Filtrera år</label>
          <input aria-label="Filtrera år" className="w-full p-2 border border-subtle bg-background text-primary rounded mt-1" value={filterYear} onChange={e => setFilterYear(e.target.value)} placeholder="t.ex. 1880" />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-primary flex items-center gap-2" title="Visa bara personer utan relationer eller händelser">
            <input aria-label="Endast utan relationer/händelser" type="checkbox" checked={showOnlyOrphans} onChange={e => setShowOnlyOrphans(e.target.checked)} className="w-4 h-4" />
            <span className="text-xs">Endast utan relationer/händelser</span>
          </label>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <label className="text-sm text-primary flex items-center gap-2" title="Visa endast personer som är markerade som arkiverade">
            <input aria-label="Visa endast arkiverade" type="checkbox" checked={showOnlyArchived} onChange={e => setShowOnlyArchived(e.target.checked)} className="w-4 h-4" />
            <span className="ml-2 text-xs">Visa endast arkiverade</span>
          </label>
        </div>
        <div className="text-xs text-muted mb-2">Visar {candidates.length} personer</div>
        <div className="flex gap-2">
          <button className="px-2 py-1 bg-surface-2 rounded text-xs text-primary hover:bg-surface" onClick={selectAll} title="Markera alla">Markera alla</button>
          <button className="px-2 py-1 bg-surface-2 rounded text-xs text-primary hover:bg-surface" onClick={clearSelection} title="Rensa markering">Rensa</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 bg-green-600 text-white rounded text-sm" title="Återställ valda" onClick={() => setConfirmState({ type: 'mass-restore', ids: Array.from(selectedIds) })} disabled={selectedIds.size === 0}>Återställ valda</button>
            <button className="px-3 py-1 bg-red-700 text-white rounded text-sm" title="Radera valda permanent" onClick={() => setConfirmState({ type: 'mass-delete', ids: Array.from(selectedIds) })} disabled={selectedIds.size === 0}>Radera valda</button>
          </div>
          <div className="text-xs text-secondary">Valda: {selectedIds.size}</div>
        </div>

        {candidates.length === 0 ? (
          <div className="text-muted">Inga matchande personer.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {candidates.map(p => {
              const relCount = (getPersonRelations && getPersonRelations(p.id) || []).filter(r => !r._archived).length;
              const isSelected = selectedIds.has(p.id);
              return (
                <div key={p.id} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpenPerson(p.id); if (e.key === 'Delete') setConfirmState({ type: 'delete', ids: [p.id] }); }} className={`p-3 bg-background border border-subtle rounded flex items-start justify-between hover:bg-surface transition-colors ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className="flex items-start gap-3">
                    <input aria-label={`Välj ${p.firstName} ${p.lastName}`} type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)} className="mt-1 w-4 h-4" />
                    <div>
                      <div className="font-semibold text-primary">{p.firstName} {p.lastName} <span className="text-xs text-muted">({p.id})</span></div>
                      {p.archiveReason && <div className="text-xs text-secondary">Orsak: {p.archiveReason}</div>}
                      <div className="text-xs text-secondary">Händelser: {(p.events || []).length} · Relationer: {relCount}</div>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-green-600 text-white rounded text-sm" title={`Återställ ${p.firstName} ${p.lastName}`} onClick={() => setConfirmState({ type: 'restore', ids: [p.id] })}>Återställ</button>
                      <button className="px-3 py-1 bg-red-700 text-white rounded text-sm" title={`Radera ${p.firstName} ${p.lastName} permanent`} onClick={() => setConfirmState({ type: 'delete', ids: [p.id] })}>Radera</button>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 border border-subtle bg-surface text-primary rounded text-sm hover:bg-surface-2" title="Redigera personen" onClick={() => onOpenPerson(p.id)}>Redigera</button>
                      <button className="px-3 py-1 border border-subtle bg-surface text-primary rounded text-sm hover:bg-surface-2" title="Visa personen i släktträdet" onClick={() => onViewInFamilyTree(p.id)}>Visa i träd</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirmation modal */}
        {confirmState && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-30" onClick={() => setConfirmState(null)}></div>
            <div className="bg-surface rounded shadow-lg p-6 z-10 w-96 border border-subtle" role="dialog" aria-modal="true">
              <div className="font-semibold mb-2">Bekräfta åtgärd</div>
              <div className="text-sm text-secondary mb-4">
                {confirmState.type === 'delete' && `Radera personen permanent? Detta kan ångras med ångra-knappen.`}
                {confirmState.type === 'mass-delete' && `Radera ${confirmState.ids.length} personer permanent? Detta kan ångras med ångra-knappen.`}
                {confirmState.type === 'restore' && `Återställ personen till datasetet?`}
                {confirmState.type === 'mass-restore' && `Återställ ${confirmState.ids.length} personer till datasetet?`}
              </div>
              <div className="flex justify-end gap-2">
                <button className="px-3 py-1 border border-subtle bg-surface-2 text-primary rounded hover:bg-surface" onClick={() => setConfirmState(null)}>Avbryt</button>
                <button className="px-3 py-1 bg-accent rounded text-on-accent hover:bg-accent" onClick={() => { setConfirmState(null); if (confirmState.type === 'restore') doRestore(confirmState.ids); if (confirmState.type === 'mass-restore') doRestore(confirmState.ids); if (confirmState.type === 'delete') doDelete(confirmState.ids); if (confirmState.type === 'mass-delete') doDelete(confirmState.ids); }}>Bekräfta</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
