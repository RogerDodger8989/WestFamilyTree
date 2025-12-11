import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';

export default function RelationshipMatrix({ allPeople = [], onClose }) {
    const { getPersonRelations } = useApp();
    const [query, setQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState(() => allPeople.slice(0, Math.min(12, allPeople.length)).map(p => p.id));

    const filtered = useMemo(() => {
        const q = (query || '').toLowerCase().trim();
        if (!q) return allPeople;
        return allPeople.filter(p => (`${p.firstName || ''} ${p.lastName || ''}`).toLowerCase().includes(q));
    }, [allPeople, query]);

    const selectedPeople = useMemo(() => selectedIds.map(id => allPeople.find(p => p.id === id)).filter(Boolean), [selectedIds, allPeople]);

    const toggleSelect = (id) => {
        setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
    };

    const relationBetween = (aId, bId) => {
        if (!getPersonRelations) return '';
        const rels = getPersonRelations(aId) || [];
        const matches = rels.filter(r => !r._archived && (r.fromPersonId === bId || r.toPersonId === bId));
        if (!matches || matches.length === 0) return '';
        // summarize types
        const types = Array.from(new Set(matches.map(r => (r.type || '').toString()))).filter(Boolean);
        return types.join(', ');
    };

    return (
        <div className="fixed inset-0 z-60 flex items-start justify-center" style={{ paddingTop: 80 }}>
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg" style={{ width: '90%', maxWidth: 1100, maxHeight: '80vh', overflow: 'auto' }}>
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-lg font-semibold">Relation Matrix</div>
                        <div className="text-sm text-slate-300">Välj en grupp personer för att visa parvisa relationer</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input placeholder="Sök namn..." value={query} onChange={(e) => setQuery(e.target.value)} className="p-2 border rounded" />
                        <button onClick={onClose} className="px-3 py-1 bg-slate-700 text-slate-200 rounded hover:bg-slate-600">Stäng</button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ width: 300, borderRight: '1px solid #e5e7eb', padding: 12 }}>
                        <div style={{ marginBottom: 8 }} className="text-sm font-medium">Personer ({filtered.length})</div>
                        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                            {filtered.map(p => (
                                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
                                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                                    <span>{p.firstName} {p.lastName} <span style={{ color: '#6b7280', fontSize: 12 }}>({p.id.slice(0,8)})</span></span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1, padding: 8, overflow: 'auto' }}>
                        <div style={{ overflow: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th style={{ position: 'sticky', top: 0, background: '#1e293b', borderBottom: '1px solid #475569', padding: 8 }}></th>
                                        {selectedPeople.map(col => (
                                            <th key={col.id} style={{ position: 'sticky', top: 0, background: '#1e293b', borderBottom: '1px solid #475569', padding: 8, textAlign: 'left', color: '#e2e8f0' }}>{col.firstName} {col.lastName}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedPeople.map(row => (
                                        <tr key={row.id}>
                                            <td style={{ padding: 8, borderBottom: '1px solid #334155', fontWeight: 700, color: '#e2e8f0' }}>{row.firstName} {row.lastName}</td>
                                            {selectedPeople.map(col => (
                                                <td key={col.id} style={{ padding: 8, borderBottom: '1px solid #334155', color: '#e2e8f0' }}>
                                                    {row.id === col.id ? '—' : (relationBetween(row.id, col.id) || <span style={{ color: '#9ca3af' }}>Ingen</span>)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div className="p-3 border-t flex justify-end">
                    <button onClick={() => { setSelectedIds(allPeople.map(p => p.id)); }} className="px-3 py-1 border rounded mr-2">Markera alla</button>
                    <button onClick={() => { setSelectedIds([]); }} className="px-3 py-1 border rounded mr-2">Rensa</button>
                    <button onClick={onClose} className="px-3 py-1 bg-blue-600 text-white rounded">Stäng</button>
                </div>
            </div>
        </div>
    );
}
