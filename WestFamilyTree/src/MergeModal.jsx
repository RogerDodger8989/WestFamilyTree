import React, { useState, useMemo } from 'react';
import { useApp } from './AppContext';
import { simulateMerge } from './mergeUtils';

export default function MergeModal({ isOpen, onClose }) {
    const { dbData, mergePersons, getPersonRelations } = useApp();
    const people = dbData.people || [];
    const [targetId, setTargetId] = useState('');
    const [selectedSources, setSelectedSources] = useState([]);
    const [keptOpen, setKeptOpen] = useState(true);
    const [archivedOpen, setArchivedOpen] = useState(true);
    const [keptShowAll, setKeptShowAll] = useState(false);
    const [archivedShowAll, setArchivedShowAll] = useState(false);

    const candidates = useMemo(() => people.filter(p => !p._archived).slice(0, 200), [people]);

    const toggleSource = (id) => {
        setSelectedSources(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const [confirmRef, setConfirmRef] = useState('');

    const preview = (() => {
        if (!targetId || selectedSources.length === 0) return null;
        return simulateMerge(dbData, targetId, selectedSources);
    })();

    const handleConfirm = () => {
        if (!targetId || selectedSources.length === 0) return alert('Välj ett mål och minst en källa att slå ihop.');
        // If target has REF, require confirmation to match
        const targetPerson = people.find(p => p.id === targetId) || {};
        const expectedRef = targetPerson.refNumber ? String(targetPerson.refNumber) : '';
        if (expectedRef && confirmRef.trim() !== expectedRef) {
            return alert('Fel REF angivet. Skriv målpersonens REF för att bekräfta.');
        }
        const mergeId = mergePersons({ targetId, sourceIds: selectedSources, createdBy: dbData?.meta?.currentUser || 'local' });
        onClose && onClose(mergeId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-3xl border border-slate-700">
                <h3 className="text-xl font-bold mb-3">Sammanslå personer</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <div className="text-sm text-slate-300 mb-2">Målperson</div>
                        <select className="w-full p-2 border rounded" value={targetId} onChange={e => setTargetId(e.target.value)}>
                            <option value="">-- Välj målperson --</option>
                            {candidates.map(p => (
                                <option key={p.id} value={p.id}>{p.firstName} {p.lastName} {p._isPlaceholder ? '(placeholder)' : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <div className="text-sm text-slate-300 mb-2">Källor att slå ihop (välj flera)</div>
                        <div className="max-h-48 overflow-y-auto border rounded p-2">
                            {candidates.filter(p => p.id !== targetId).map(p => (
                                <label key={p.id} className="flex items-center gap-2 text-sm p-1">
                                    <input type="checkbox" checked={selectedSources.includes(p.id)} onChange={() => toggleSource(p.id)} />
                                    <span>{p.firstName} {p.lastName}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="text-sm font-semibold">Förhandsvisning</div>
                    {!preview && <div className="text-xs text-slate-500">Välj mål och källor för att se vad som flyttas.</div>}
                    {preview && (
                        <div className="mt-2 text-sm">
                            <div>Totalt händelser att flytta: <strong>{preview.totalEvents}</strong></div>
                            <div className="mt-1">Relationer: <strong>{(preview.keptList || []).length}</strong> behålls, <strong>{(preview.archivedList || []).length}</strong> arkiveras</div>

                            <div className="mt-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold">Behållna relationer</div>
                                    <div className="text-xs text-slate-400">{(preview.keptList || []).length}</div>
                                </div>
                                <div className="mt-1">
                                    <button onClick={() => setKeptOpen(s => !s)} className="text-xs text-blue-600 mb-2">{keptOpen ? 'Dölj' : 'Visa'}</button>
                                    {keptOpen && (
                                        <>
                                            {(preview.keptList || []).length === 0 && <div className="text-xs text-slate-500">Inga relationer kommer att behållas.</div>}
                                            {(preview.keptList || []).length > 0 && (
                                                <>
                                                    <ul className="mt-1 list-disc pl-5 text-xs">
                                                        {((keptShowAll ? preview.keptList : preview.keptList.slice(0, 8)) || []).map(r => (
                                                            <li key={r.id}>{r.type || 'relation'}: {r.from} → {r.to} <span className="text-slate-500">({r.id})</span></li>
                                                        ))}
                                                    </ul>
                                                    {preview.keptList.length > 8 && (
                                                        <div className="mt-1">
                                                            <button onClick={() => setKeptShowAll(s => !s)} className="text-xs text-blue-600">{keptShowAll ? 'Visa färre' : `Visa fler (${preview.keptList.length - 8} fler)`}</button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold">Relationer som arkiveras</div>
                                    <div className="text-xs text-slate-400">{(preview.archivedList || []).length}</div>
                                </div>
                                <div className="mt-1">
                                    <button onClick={() => setArchivedOpen(s => !s)} className="text-xs text-blue-600 mb-2">{archivedOpen ? 'Dölj' : 'Visa'}</button>
                                    {archivedOpen && (
                                        <>
                                            {(preview.archivedList || []).length === 0 && <div className="text-xs text-slate-500">Inga relationer kommer att arkiveras.</div>}
                                            {(preview.archivedList || []).length > 0 && (
                                                <>
                                                    <ul className="mt-1 list-disc pl-5 text-xs">
                                                        {((archivedShowAll ? preview.archivedList : preview.archivedList.slice(0, 8)) || []).map(r => (
                                                            <li key={r.id}>{r.type || 'relation'}: {r.from} → {r.to} — <em>{r.reason}</em> <span className="text-slate-500">({r.id})</span></li>
                                                        ))}
                                                    </ul>
                                                    {preview.archivedList.length > 8 && (
                                                        <div className="mt-1">
                                                            <button onClick={() => setArchivedShowAll(s => !s)} className="text-xs text-blue-600">{archivedShowAll ? 'Visa färre' : `Visa fler (${preview.archivedList.length - 8} fler)`}</button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4">
                    {preview && (() => {
                        const targetPerson = people.find(p => p.id === targetId) || {};
                        const expectedRef = targetPerson.refNumber ? String(targetPerson.refNumber) : '';
                        return (
                            <div className="mb-3">
                                {expectedRef && (
                                    <div className="text-xs text-slate-400 mb-2">
                                        För säkerhets skull, skriv målpersonens REF (<strong>{expectedRef}</strong>) för att bekräfta sammanslagningen.
                                    </div>
                                )}
                                {expectedRef && (
                                    <input value={confirmRef} onChange={e => setConfirmRef(e.target.value)} placeholder={expectedRef} className="p-2 border rounded w-full text-sm mb-2" />
                                )}
                            </div>
                        );
                    })()}

                <div className="mt-2 flex justify-end gap-2">
                    <button onClick={() => onClose && onClose(null)} className="px-4 py-2 border rounded">Avbryt</button>
                    <button onClick={handleConfirm} disabled={!(targetId && selectedSources.length > 0 && (!((people.find(p => p.id === targetId) || {}).refNumber) || String((people.find(p => p.id === targetId) || {}).refNumber) === confirmRef.trim()))} className={`px-4 py-2 rounded ${!(targetId && selectedSources.length > 0 && (!((people.find(p => p.id === targetId) || {}).refNumber) || String((people.find(p => p.id === targetId) || {}).refNumber) === confirmRef.trim())) ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                        Slå ihop
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
}
