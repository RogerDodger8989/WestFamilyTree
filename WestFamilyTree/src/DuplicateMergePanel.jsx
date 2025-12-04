import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from './AppContext';
import { simulateMerge } from './mergeUtils';
import { matchEvents, datePrecision } from './eventMatchUtils';

function EventDiff({ selectedPair, targetIsA, choices, setChoices }) {
    const a = selectedPair[0];
    const b = selectedPair[1];
    const evsA = Array.isArray(a.events) ? a.events : [];
    const evsB = Array.isArray(b.events) ? b.events : [];
    const pairs = matchEvents(evsA, evsB, { threshold: 0.35 });

    return (
        <div style={{ border: '1px solid #475569', padding: 8, borderRadius: 6, marginBottom: 12, backgroundColor: '#1e293b' }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>Händelse-sammanslagning</div>
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
                {pairs.map((pr, idx) => (
                    <div key={idx} style={{ padding: 8, borderBottom: '1px solid #334155' }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{(pr.a ? (pr.a.type || 'Händelse') : (pr.b ? pr.b.type : 'Händelse'))}</div>
                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{pr.a ? `${pr.a.date || ''} ${pr.a.place || ''}` : ''}</div>
                            </div>
                            <div style={{ width: 340, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}><input type="radio" name={`evt_${idx}`} checked={choices[pr.a?.id] === 'keep-target'} onChange={() => setChoices(c => ({ ...c, [pr.a?.id || pr.b?.id]: 'keep-target' }))} /> Behåll mål</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}><input type="radio" name={`evt_${idx}`} checked={choices[pr.a?.id] === 'keep-source'} onChange={() => setChoices(c => ({ ...c, [pr.a?.id || pr.b?.id]: 'keep-source' }))} /> Behåll källa</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}><input type="radio" name={`evt_${idx}`} checked={choices[pr.a?.id] === 'merge'} onChange={() => setChoices(c => ({ ...c, [pr.a?.id || pr.b?.id]: 'merge' }))} /> Slå ihop</label>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setChoices({})} className="px-3 py-1 border border-slate-600 bg-slate-700 text-slate-200 rounded hover:bg-slate-600">Återställ</button>
                <button onClick={() => {}} className="px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-600">Spara event-val</button>
            </div>
        </div>
    );
}

function FieldLevelDiff({ selectedPair, targetIsA, choices, setChoices }) {
    const a = selectedPair[0];
    const b = selectedPair[1];
    const fields = [
        { key: 'firstName', label: 'Förnamn' },
        { key: 'lastName', label: 'Efternamn' },
        { key: 'gender', label: 'Kön' },
        { key: 'notes', label: 'Anteckningar' }
    ];

    const getBirth = (p) => {
        const ev = (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('födel')) || (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('birth'));
        return ev ? (ev.date || '') : '';
    };

    return (
        <div style={{ border: '1px solid #475569', padding: 8, borderRadius: 6, marginBottom: 12, backgroundColor: '#1e293b' }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>Fältnivåval</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 8, alignItems: 'center' }}>
                <div></div>
                <div style={{ fontWeight: 700, textAlign: 'center', color: '#e2e8f0' }}>{a.firstName} {a.lastName}</div>
                <div style={{ fontWeight: 700, textAlign: 'center', color: '#e2e8f0' }}>{b.firstName} {b.lastName}</div>
                {fields.map(f => (
                    <React.Fragment key={f.key}>
                        <div style={{ padding: 6, color: '#cbd5e1' }}>{f.label}</div>
                        <div style={{ textAlign: 'center' }}><label style={{ color: '#cbd5e1' }}><input type="radio" name={f.key} checked={choices[f.key] === 'a'} onChange={() => setChoices(c => ({ ...c, [f.key]: 'a' }))} /> <div style={{ fontSize: 12, color: '#cbd5e1' }}>{a[f.key] || '—'}</div></label></div>
                        <div style={{ textAlign: 'center' }}><label style={{ color: '#cbd5e1' }}><input type="radio" name={f.key} checked={choices[f.key] === 'b'} onChange={() => setChoices(c => ({ ...c, [f.key]: 'b' }))} /> <div style={{ fontSize: 12, color: '#cbd5e1' }}>{b[f.key] || '—'}</div></label></div>
                    </React.Fragment>
                ))}
                <div style={{ padding: 6, color: '#cbd5e1' }}>Födelsedatum</div>
                <div style={{ textAlign: 'center' }}><label><input type="radio" name="birth" checked={choices.birth === 'a'} onChange={() => setChoices(c => ({ ...c, birth: 'a' }))} /> <div style={{ fontSize: 12, color: '#cbd5e1' }}>{getBirth(a) || '—'}</div></label></div>
                <div style={{ textAlign: 'center' }}><label><input type="radio" name="birth" checked={choices.birth === 'b'} onChange={() => setChoices(c => ({ ...c, birth: 'b' }))} /> <div style={{ fontSize: 12, color: '#cbd5e1' }}>{getBirth(b) || '—'}</div></label></div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setChoices({})} className="px-3 py-1 border border-slate-600 bg-slate-700 text-slate-200 rounded hover:bg-slate-600">Återställ</button>
                <button onClick={() => {}} className="px-3 py-1 bg-blue-700 text-white rounded hover:bg-blue-600">Spara val till mål</button>
            </div>
        </div>
    );
}

function MergeSummary({ selectedPair, targetIsA, fieldChoices, eventChoices, dbData, setDbData, mergePersons, onClose, setShowSummary, showStatus, undoMerge, showUndoToast }) {
    if (!selectedPair) return null;
    const a = selectedPair[0];
    const b = selectedPair[1];
    const target = targetIsA ? a : b;
    const source = targetIsA ? b : a;
    const targetId = target.id;
    const sourceIds = [source.id];

    const evsA = Array.isArray(a.events) ? a.events : [];
    const evsB = Array.isArray(b.events) ? b.events : [];
    const pairs = matchEvents(evsA, evsB, { threshold: 0.35 });

    const [editedMergedEvents, setEditedMergedEvents] = useState({});
    const [mergedPreview, setMergedPreview] = useState(() => ({ ...target, events: Array.isArray(target.events) ? target.events.map(e => ({ ...e })) : [] }));

    const dateIsValid = (d) => { if (!d) return true; return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(d.toString().trim()); };
    const validateMergedEvent = (m) => { if (!m) return true; return dateIsValid(m.date); };

    const confirmAndApply = () => {
        const invalid = Object.values(editedMergedEvents || {}).some(m => !validateMergedEvent(m));
        if (invalid) { try { showStatus('Korrigera ogiltiga datum innan bekräftelse.'); } catch (e) {} ; return; }

        const people2 = (dbData.people || []).map(p => ({ ...p, events: Array.isArray(p.events) ? p.events.map(e => ({ ...e })) : [] }));
        const tgt2Index = people2.findIndex(p => p.id === targetId);
        const src2Index = people2.findIndex(p => p.id === source.id);
        if (tgt2Index === -1 || src2Index === -1) return;
        const tgt2 = people2[tgt2Index];
        const src2 = people2[src2Index];

        for (const f of ['firstName','lastName','gender','notes']) tgt2[f] = mergedPreview[f];

        for (const pr of pairs) {
            const key = pr.a ? pr.a.id : (pr.b ? pr.b.id : null);
            const choice = eventChoices[key];
            if (!choice) continue;
            if (choice === 'keep-target') { if (pr.b) src2.events = (src2.events || []).filter(e => e.id !== pr.b.id); }
            else if (choice === 'keep-source') { if (pr.a) tgt2.events = (tgt2.events || []).filter(e => e.id !== pr.a.id); }
            else if (choice === 'merge') {
                const ea = pr.a || {};
                const eb = pr.b || {};
                const baseId = ea.id || eb.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
                const edited = editedMergedEvents[baseId] || {};
                const merged = { id: edited.id || baseId, type: edited.type || ea.type || eb.type || 'Händelse', date: edited.date || ea.date || eb.date || '', place: edited.place || ea.place || eb.place, note: edited.note || '' };
                if (ea.id) tgt2.events = (tgt2.events || []).filter(e => e.id !== ea.id);
                if (eb.id) src2.events = (src2.events || []).filter(e => e.id !== eb.id);
                tgt2.events = tgt2.events || [];
                let mid = merged.id; while (tgt2.events.find(e => e.id === mid)) mid = `${mid}_${Math.random().toString(36).slice(2,4)}`; merged.id = mid;
                tgt2.events.push(merged);
            }
        }

        setDbData(prev => ({ ...prev, people: people2 }));
        try {
            if (process.env.NODE_ENV !== 'production') console.debug('[DuplicateMergePanel] about to call mergePersons', { targetId, sourceIds });
            const mergeId = mergePersons({ targetId, sourceIds, createdBy: 'ui' });
            if (mergeId) {
                try { if (showStatus) showStatus('Sammanfogning genomförd.'); } catch (e) {}
                try { if (showUndoToast && undoMerge) showUndoToast('Sammanfogning genomförd. Ångra?', () => undoMerge(mergeId)); } catch (e) {}
                setShowSummary(false);
                onClose();
            }
        } catch (e) { if (process.env.NODE_ENV !== 'production') console.debug('final merge failed', e); }
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
            <div className="bg-slate-800 rounded shadow-lg border border-slate-700" style={{ width: 'min(900px, 94%)', maxHeight: '80vh', overflow: 'auto' }}>
                <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
                    <div>
                        <div className="text-lg font-semibold text-slate-200">Sammanfognings-sammanfattning</div>
                        <div className="text-sm text-slate-400">Granska ändringar innan du bekräftar.</div>
                    </div>
                    <div>
                        <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-200 text-2xl px-2 py-1" aria-label="Stäng">×</button>
                    </div>
                </div>
                <div className="p-4">
                    <div className="mb-3 text-slate-200"><b>Mål:</b> {target.firstName} {target.lastName} ({target.id})</div>
                    <div className="mb-3 text-slate-200"><b>Källa:</b> {source.firstName} {source.lastName} ({source.id})</div>
                    <div className="mb-3">
                        <div className="font-medium text-slate-200">Fältändringar (justera i förhandsgranskning)</div>
                        <div className="p-3 border border-slate-700 rounded bg-slate-900 mt-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="text-xs text-slate-400">Förnamn</div>
                                    <input value={mergedPreview.firstName || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, firstName: e.target.value }))} className="w-full border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400">Efternamn</div>
                                    <input value={mergedPreview.lastName || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, lastName: e.target.value }))} className="w-full border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" />
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400">Kön</div>
                                    <select value={mergedPreview.gender || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, gender: e.target.value }))} className="w-full border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none">
                                        <option value="">(okänt)</option>
                                        <option value="M">M</option>
                                        <option value="K">K</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-400">Anteckningar</div>
                                    <input value={mergedPreview.notes || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, notes: e.target.value }))} className="w-full border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200" />
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-slate-400">Födelsedatum (YYYY eller YYYY-MM-DD)</div>
                                    <input value={(mergedPreview.events || []).find(ev => ev.type && ev.type.toString().toLowerCase().includes('födel'))?.date || ''} onChange={(e) => {
                                        const v = e.target.value;
                                        setMergedPreview(prev => {
                                            const copy = { ...prev, events: Array.isArray(prev.events) ? prev.events.map(x => ({ ...x })) : [] };
                                            const idx = copy.events.findIndex(ev => ev.type && ev.type.toString().toLowerCase().includes('födel'));
                                            if (idx >= 0) { copy.events[idx].date = v; } else { if (v) copy.events.push({ id: `ev_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'Födelse', date: v }); }
                                            return copy;
                                        });
                                    }} className={`w-full border rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none ${/\d{4}(-\d{2}(-\d{2})?)?/.test((mergedPreview.events || []).find(ev => ev.type && ev.type.toString().toLowerCase().includes('födel'))?.date || '') ? 'border-slate-600' : 'border-red-600 bg-red-900 bg-opacity-20'}`} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mb-3">
                        <div className="font-medium text-slate-200">Händelser</div>
                        <div className="text-sm text-slate-300">Antal par att överväga: {pairs.length}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowSummary(false)} className="px-3 py-1 border border-slate-600 bg-slate-700 text-slate-200 rounded hover:bg-slate-600">Avbryt</button>
                            <button onClick={confirmAndApply} className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600">Bekräfta och slå ihop</button>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">Obs: efter genomförd sammanfogning kan du ångra via toastens ångra-knapp.</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function DuplicateMergePanel({ allPeople = [], onClose, initialPair = null }) {
    const { dbData, mergePersons, setDbData, showStatus, undoMerge, showUndoToast } = useApp();
    const [selectedPair, setSelectedPair] = useState(null);
    const [targetIsA, setTargetIsA] = useState(true);
    const [fieldChoices, setFieldChoices] = useState({});
    const [eventChoices, setEventChoices] = useState({});
    const [showSummary, setShowSummary] = useState(false);

    const suggestions = useMemo(() => {
        const byName = new Map();
        for (const p of allPeople) {
            const key = `${(p.firstName||'').toString().toLowerCase().replace(/[^a-z0-9åäö]/g,'')} ${(p.lastName||'').toString().toLowerCase().replace(/[^a-z0-9åäö]/g,'')}`.trim();
            if (!byName.has(key)) byName.set(key, []);
            byName.get(key).push(p);
        }
        const pairs = [];
        for (const g of Array.from(byName.values()).filter(g => g.length > 1)) {
            for (let i = 0; i < g.length; i++) for (let j = i+1; j < g.length; j++) pairs.push([g[i], g[j]]);
        }
        return pairs.map(p => ({ pair: p, score: 0.9 })).slice(0,120);
    }, [allPeople]);

    const preview = useMemo(() => {
        if (!selectedPair) return null;
        const a = selectedPair[0];
        const b = selectedPair[1];
        const targetId = targetIsA ? a.id : b.id;
        const sourceIds = targetIsA ? [b.id] : [a.id];
        try { return simulateMerge(dbData, targetId, sourceIds) || null; } catch (e) { return null; }
    }, [selectedPair, targetIsA, dbData]);

    useEffect(() => { if (initialPair && Array.isArray(initialPair) && initialPair.length === 2) { setSelectedPair(initialPair); setTargetIsA(true); } }, [initialPair]);

    const doMerge = () => { if (!selectedPair) return; setShowSummary(true); };

    const content = (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center" style={{ paddingTop: 64 }}>
            <div className="bg-slate-800 rounded shadow-lg border border-slate-700" style={{ width: '94%', maxWidth: 1100, maxHeight: '84vh', overflow: 'auto' }}>
                <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
                    <div>
                        <div className="text-lg font-semibold text-slate-200">Föreslagna dubbletter</div>
                        <div className="text-sm text-slate-400">Grupperade efter normaliserat namn och födelseear</div>
                    </div>
                    <div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-2xl px-2 py-1" aria-label="Stäng">×</button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 360, borderRight: '1px solid #475569', padding: 12 }}>
                        <div style={{ marginBottom: 8 }} className="text-sm font-medium text-slate-200">Förslag ({suggestions.length})</div>
                        <div style={{ maxHeight: '64vh', overflow: 'auto' }}>
                            {suggestions.map((item, idx) => {
                                const pair = item.pair;
                                return (
                                    <div key={`${pair[0].id}-${pair[1].id}`} style={{ padding: 8, borderBottom: '1px solid #334155', cursor: 'pointer', background: selectedPair && selectedPair[0].id === pair[0].id && selectedPair[1].id === pair[1].id ? '#334155' : 'transparent' }} onClick={() => { setSelectedPair(pair); setTargetIsA(true); }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontWeight: 700, color: '#e2e8f0' }}>{pair[0].firstName} {pair[0].lastName}</div>
                                            <div style={{ fontSize: 12, color: '#cbd5e1' }}>{Math.round((item.score||0) * 100)}%</div>
                                        </div>
                                        <div style={{ color: '#cbd5e1' }}>{pair[1].firstName} {pair[1].lastName}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div style={{ flex: 1, padding: 12 }}>
                        {!selectedPair && <div className="text-sm text-slate-300">Välj ett par till vänster för att se en förhandsgranskning av sammanslagning.</div>}
                        {selectedPair && (
                            <div>
                                <div className="mb-3">
                                    <div className="text-sm font-medium text-slate-200">Valt par</div>
                                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1' }}><input type="radio" checked={targetIsA} onChange={() => setTargetIsA(true)} /> {selectedPair[0].firstName} {selectedPair[0].lastName}</label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1' }}><input type="radio" checked={!targetIsA} onChange={() => setTargetIsA(false)} /> {selectedPair[1].firstName} {selectedPair[1].lastName}</label>
                                    </div>
                                </div>
                                <FieldLevelDiff selectedPair={selectedPair} targetIsA={targetIsA} choices={fieldChoices} setChoices={setFieldChoices} />
                                <EventDiff selectedPair={selectedPair} targetIsA={targetIsA} choices={eventChoices} setChoices={setEventChoices} />
                                <div className="mb-3">
                                    <div className="text-sm font-medium text-slate-200">Preview</div>
                                    {!preview && <div className="text-sm text-slate-400">Ingen förhandsgranskning tillgänglig.</div>}
                                    {preview && (
                                        <div style={{ marginTop: 8 }}>
                                            <div className="text-sm text-slate-200">Total events i källor: {preview.totalEvents}</div>
                                            <div className="text-sm text-slate-200">Behållna relationer: {preview.keptList.length}</div>
                                            <div className="text-sm text-slate-200">Arkiverade relationer: {preview.archivedList.length}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setSelectedPair(null)} className="px-3 py-1 border border-slate-600 rounded bg-slate-700 text-slate-200 hover:bg-slate-600">Avmarkera</button>
                                    <button onClick={doMerge} className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600">Sammanfoga</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {showSummary && (
                <MergeSummary
                    selectedPair={selectedPair}
                    targetIsA={targetIsA}
                    fieldChoices={fieldChoices}
                    eventChoices={eventChoices}
                    dbData={dbData}
                    setDbData={setDbData}
                    mergePersons={mergePersons}
                    onClose={onClose}
                    setShowSummary={setShowSummary}
                    showStatus={showStatus}
                    undoMerge={undoMerge}
                    showUndoToast={showUndoToast}
                />
            )}
        </div>
    );

    try { return createPortal(content, document.body); } catch (e) { return content; }
}
