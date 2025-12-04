import React, { useState } from 'react';
import { useApp } from './AppContext';

export default function MergesPanel({ isOpen, onClose }) {
    const { dbData, undoMerge, showStatus } = useApp();
    const [pendingUndoId, setPendingUndoId] = useState(null);
    const [confirmRef, setConfirmRef] = useState('');

    if (!isOpen) return null;
    const merges = (dbData?.meta?.merges || []).slice().reverse(); // show newest first

    const startUndo = (id) => {
        setPendingUndoId(id);
        setConfirmRef('');
    };

    const cancelUndo = () => {
        setPendingUndoId(null);
        setConfirmRef('');
    };

    const handleConfirmUndo = async (id) => {
        if (!id) return;
        try {
            // verify typed REF matches mergedInto person's refNumber (if available)
            const rec = (dbData?.meta?.merges || []).find(m => m.id === id);
            const mergedIntoId = rec?.mergedIntoId;
            const person = dbData.people.find(p => p.id === mergedIntoId);
            const expectedRef = person ? String(person.refNumber || '') : '';
            if (expectedRef && confirmRef.trim() !== expectedRef) {
                showStatus('Fel REF angivet. Avbryter återställning.');
                return;
            }

            const ok = await undoMerge(id);
            if (ok) {
                showStatus('Merge återställd.');
            } else {
                showStatus('Kunde inte återställa merge. Kontrollera konsolen.');
            }
        } catch (err) {
            console.error('undoMerge failed', err);
            showStatus('Ett fel uppstod vid återställning. Se konsolen.');
        } finally {
            setPendingUndoId(null);
            setConfirmRef('');
            onClose && onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-60 flex items-start justify-center bg-black bg-opacity-40 p-6">
            <div className="bg-slate-800 rounded-lg p-4 w-full max-w-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">Historik: Merges</h3>
                    <button onClick={() => onClose && onClose()} className="text-slate-400 hover:text-slate-300">Stäng</button>
                </div>
                <div className="max-h-72 overflow-y-auto text-sm">
                    {merges.length === 0 && <div className="text-slate-400">Inga merges registrerade.</div>}
                    {merges.map(m => {
                        const mergedIntoPerson = dbData.people.find(p => p.id === m.mergedIntoId) || null;
                        const expectedRef = mergedIntoPerson ? String(mergedIntoPerson.refNumber || '') : '';
                        return (
                            <div key={m.id} className="p-3 border-b last:border-b-0">
                                <div className="flex justify-between items-start gap-3">
                                    <div>
                                        <div className="font-semibold">{m.id}</div>
                                        <div className="text-xs text-slate-300">Mergade in i: {m.mergedIntoId} {mergedIntoPerson ? `(${mergedIntoPerson.firstName} ${mergedIntoPerson.lastName})` : ''} | {m.originalPersonIds.join(', ')}</div>
                                        <div className="text-xs text-slate-500 mt-1">{new Date(m.createdAt).toLocaleString()} av {m.createdBy || 'system'}</div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {!pendingUndoId && (
                                            <>
                                                <button onClick={() => startUndo(m.id)} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">Ångra</button>
                                                <button onClick={() => navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(m))} className="px-3 py-1 border rounded text-sm">Kopiera snapshot</button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {pendingUndoId === m.id && (
                                    <div className="mt-3 bg-yellow-50 p-3 rounded">
                                        <div className="text-sm text-slate-300 mb-2">Skriv REF-nummer för målpersonen för att bekräfta återställning</div>
                                        <div className="flex items-center gap-2">
                                            <input value={confirmRef} onChange={e => setConfirmRef(e.target.value)} className="p-2 border rounded flex-1" placeholder={expectedRef ? `REF för ${mergedIntoPerson ? `${mergedIntoPerson.firstName} ${mergedIntoPerson.lastName}` : m.mergedIntoId}` : 'Ingen REF finns'} />
                                            <button onClick={() => handleConfirmUndo(m.id)} className="px-3 py-1 bg-red-600 text-white rounded">Bekräfta</button>
                                            <button onClick={cancelUndo} className="px-3 py-1 border rounded">Avbryt</button>
                                        </div>
                                        {expectedRef && <div className="text-xs text-slate-500 mt-2">Förväntat REF: <strong>{expectedRef}</strong></div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
