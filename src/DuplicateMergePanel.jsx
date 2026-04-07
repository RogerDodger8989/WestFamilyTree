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
        <div className="border border-subtle p-2 rounded mb-3 bg-surface-2">
            <div className="font-bold mb-2 text-primary">Händelse-sammanslagning</div>
            <div style={{ maxHeight: 220, overflow: 'auto' }}>
                {pairs.map((pr, idx) => (
                    <div key={idx} className="p-2 border-b border-subtle last:border-b-0">
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <div className="text-[13px] font-bold text-primary">{(pr.a ? (pr.a.type || 'Händelse') : (pr.b ? pr.b.type : 'Händelse'))}</div>
                                <div className="text-xs text-muted">{pr.a ? `${pr.a.date || ''} ${pr.a.place || ''}` : ''}</div>
                            </div>
                            <div style={{ width: 340, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <label className="flex items-center gap-1.5 text-secondary"><input type="radio" name={`evt_${idx}`} checked={choices[pr.a?.id] === 'keep-target'} onChange={() => setChoices(c => ({ ...c, [pr.a?.id || pr.b?.id]: 'keep-target' }))} /> Behåll mål</label>
                                <label className="flex items-center gap-1.5 text-secondary"><input type="radio" name={`evt_${idx}`} checked={choices[pr.a?.id] === 'keep-source'} onChange={() => setChoices(c => ({ ...c, [pr.a?.id || pr.b?.id]: 'keep-source' }))} /> Behåll källa</label>
                                <label className="flex items-center gap-1.5 text-secondary"><input type="radio" name={`evt_${idx}`} checked={choices[pr.a?.id] === 'merge'} onChange={() => setChoices(c => ({ ...c, [pr.a?.id || pr.b?.id]: 'merge' }))} /> Slå ihop</label>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setChoices({})} className="px-3 py-1 border border-subtle bg-surface-2 text-primary rounded hover:bg-surface-2">Återställ</button>
                <button onClick={() => {}} className="px-3 py-1 bg-accent text-on-accent rounded hover:opacity-90">Spara event-val</button>
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
        <div className="border border-subtle p-2 rounded mb-3 bg-surface-2">
            <div className="font-bold mb-2 text-primary">Fältnivåval</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 8, alignItems: 'center' }}>
                <div></div>
                <div className="font-bold text-center text-primary">{a.firstName} {a.lastName}</div>
                <div className="font-bold text-center text-primary">{b.firstName} {b.lastName}</div>
                {fields.map(f => (
                    <React.Fragment key={f.key}>
                        <div className="p-1.5 text-secondary">{f.label}</div>
                        <div style={{ textAlign: 'center' }}><label className="text-secondary"><input type="radio" name={f.key} checked={choices[f.key] === 'a'} onChange={() => setChoices(c => ({ ...c, [f.key]: 'a' }))} /> <div className="text-xs text-secondary">{a[f.key] || '-'}</div></label></div>
                        <div style={{ textAlign: 'center' }}><label className="text-secondary"><input type="radio" name={f.key} checked={choices[f.key] === 'b'} onChange={() => setChoices(c => ({ ...c, [f.key]: 'b' }))} /> <div className="text-xs text-secondary">{b[f.key] || '-'}</div></label></div>
                    </React.Fragment>
                ))}
                <div className="p-1.5 text-secondary">Födelsedatum</div>
                <div style={{ textAlign: 'center' }}><label className="text-secondary"><input type="radio" name="birth" checked={choices.birth === 'a'} onChange={() => setChoices(c => ({ ...c, birth: 'a' }))} /> <div className="text-xs text-secondary">{getBirth(a) || '-'}</div></label></div>
                <div style={{ textAlign: 'center' }}><label className="text-secondary"><input type="radio" name="birth" checked={choices.birth === 'b'} onChange={() => setChoices(c => ({ ...c, birth: 'b' }))} /> <div className="text-xs text-secondary">{getBirth(b) || '-'}</div></label></div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setChoices({})} className="px-3 py-1 border border-subtle bg-surface-2 text-primary rounded hover:bg-surface-2">Återställ</button>
                <button onClick={() => {}} className="px-3 py-1 bg-accent text-on-accent rounded hover:opacity-90">Spara val till mål</button>
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
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/40">
            <div className="bg-surface rounded shadow-lg border border-subtle" style={{ width: 'min(900px, 94%)', maxHeight: '80vh', overflow: 'auto' }}>
                <div className="p-4 border-b border-subtle bg-surface-2 flex justify-between items-center">
                    <div>
                        <div className="text-lg font-semibold text-primary">Sammanfognings-sammanfattning</div>
                        <div className="text-sm text-secondary">Granska ändringar innan du bekräftar.</div>
                    </div>
                    <div>
                        <button onClick={() => setShowSummary(false)} className="text-secondary hover:text-primary text-2xl px-2 py-1" aria-label="Stäng">×</button>
                    </div>
                </div>
                <div className="p-4">
                    <div className="mb-3 text-primary"><b>Mål:</b> {target.firstName} {target.lastName} ({target.id})</div>
                    <div className="mb-3 text-primary"><b>Källa:</b> {source.firstName} {source.lastName} ({source.id})</div>
                    <div className="mb-3">
                        <div className="font-medium text-primary">Fältändringar (justera i förhandsgranskning)</div>
                        <div className="p-3 border border-subtle rounded bg-surface-2 mt-2">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <div className="text-xs text-secondary">Förnamn</div>
                                    <input value={mergedPreview.firstName || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, firstName: e.target.value }))} className="w-full border border-subtle rounded px-2 py-1 text-sm bg-surface-2 text-primary focus:border-strong focus:outline-none" />
                                </div>
                                <div>
                                    <div className="text-xs text-secondary">Efternamn</div>
                                    <input value={mergedPreview.lastName || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, lastName: e.target.value }))} className="w-full border border-subtle rounded px-2 py-1 text-sm bg-surface-2 text-primary focus:border-strong focus:outline-none" />
                                </div>
                                <div>
                                    <div className="text-xs text-secondary">Kön</div>
                                    <select value={mergedPreview.gender || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, gender: e.target.value }))} className="w-full border border-subtle rounded px-2 py-1 text-sm bg-surface-2 text-primary focus:border-strong focus:outline-none">
                                        <option value="">(okänt)</option>
                                        <option value="M">M</option>
                                        <option value="K">K</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="text-xs text-secondary">Anteckningar</div>
                                    <input value={mergedPreview.notes || ''} onChange={(e) => setMergedPreview(prev => ({ ...prev, notes: e.target.value }))} className="w-full border border-subtle rounded px-2 py-1 text-sm bg-surface-2 text-primary" />
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-secondary">Födelsedatum (YYYY eller YYYY-MM-DD)</div>
                                    <input value={(mergedPreview.events || []).find(ev => ev.type && ev.type.toString().toLowerCase().includes('födel'))?.date || ''} onChange={(e) => {
                                        const v = e.target.value;
                                        setMergedPreview(prev => {
                                            const copy = { ...prev, events: Array.isArray(prev.events) ? prev.events.map(x => ({ ...x })) : [] };
                                            const idx = copy.events.findIndex(ev => ev.type && ev.type.toString().toLowerCase().includes('födel'));
                                            if (idx >= 0) { copy.events[idx].date = v; } else { if (v) copy.events.push({ id: `ev_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type: 'Födelse', date: v }); }
                                            return copy;
                                        });
                                    }} className={`w-full border rounded px-2 py-1 text-sm bg-surface-2 text-primary focus:border-strong focus:outline-none ${/\d{4}(-\d{2}(-\d{2})?)?/.test((mergedPreview.events || []).find(ev => ev.type && ev.type.toString().toLowerCase().includes('födel'))?.date || '') ? 'border-subtle' : 'border-strong bg-warning-soft text-danger'}`} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mb-3">
                        <div className="font-medium text-primary">Händelser</div>
                        <div className="text-sm text-primary">Antal par att överväga: {pairs.length}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowSummary(false)} className="px-3 py-1 border border-subtle bg-surface-2 text-primary rounded hover:bg-surface-2">Avbryt</button>
                            <button onClick={confirmAndApply} className="px-3 py-1 bg-danger text-on-accent rounded hover:opacity-90">Bekräfta och slå ihop</button>
                        </div>
                        <div className="mt-2 text-xs text-secondary">Obs: efter genomförd sammanfogning kan du ångra via toastens ångra-knapp.</div>
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
            <div className="bg-surface rounded shadow-lg border border-subtle" style={{ width: '94%', maxWidth: 1100, maxHeight: '84vh', overflow: 'auto' }}>
                <div className="flex items-center justify-between p-4 border-b border-subtle bg-surface-2">
                    <div>
                        <div className="text-lg font-semibold text-primary">Föreslagna dubbletter</div>
                        <div className="text-sm text-secondary">Grupperade efter normaliserat namn och födelseear</div>
                    </div>
                    <div>
                        <button onClick={onClose} className="text-secondary hover:text-primary text-2xl px-2 py-1" aria-label="Stäng">×</button>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div className="w-[360px] border-r border-subtle p-3">
                        <div style={{ marginBottom: 8 }} className="text-sm font-medium text-primary">Förslag ({suggestions.length})</div>
                        <div style={{ maxHeight: '64vh', overflow: 'auto' }}>
                            {suggestions.map((item, idx) => {
                                const pair = item.pair;
                                return (
                                    <div key={`${pair[0].id}-${pair[1].id}`} className={`p-2 border-b border-subtle cursor-pointer ${selectedPair && selectedPair[0].id === pair[0].id && selectedPair[1].id === pair[1].id ? 'bg-surface-2' : ''}`} onClick={() => { setSelectedPair(pair); setTargetIsA(true); }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className="font-bold text-primary">{pair[0].firstName} {pair[0].lastName}</div>
                                            <div className="text-xs text-secondary">{Math.round((item.score||0) * 100)}%</div>
                                        </div>
                                        <div className="text-secondary">{pair[1].firstName} {pair[1].lastName}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div style={{ flex: 1, padding: 12 }}>
                        {!selectedPair && <div className="text-sm text-primary">Välj ett par till vänster för att se en förhandsgranskning av sammanslagning.</div>}
                        {selectedPair && (
                            <div>
                                <div className="mb-3">
                                    <div className="text-sm font-medium text-primary">Valt par</div>
                                    <div className="flex gap-3 mt-2">
                                        <label className="flex items-center gap-2 text-secondary"><input type="radio" checked={targetIsA} onChange={() => setTargetIsA(true)} /> {selectedPair[0].firstName} {selectedPair[0].lastName}</label>
                                        <label className="flex items-center gap-2 text-secondary"><input type="radio" checked={!targetIsA} onChange={() => setTargetIsA(false)} /> {selectedPair[1].firstName} {selectedPair[1].lastName}</label>
                                    </div>
                                </div>
                                <FieldLevelDiff selectedPair={selectedPair} targetIsA={targetIsA} choices={fieldChoices} setChoices={setFieldChoices} />
                                <EventDiff selectedPair={selectedPair} targetIsA={targetIsA} choices={eventChoices} setChoices={setEventChoices} />
                                <div className="mb-3">
                                    <div className="text-sm font-medium text-primary">Preview</div>
                                    {!preview && <div className="text-sm text-secondary">Ingen förhandsgranskning tillgänglig.</div>}
                                    {preview && (
                                        <div style={{ marginTop: 8 }}>
                                            <div className="text-sm text-primary">Total events i källor: {preview.totalEvents}</div>
                                            <div className="text-sm text-primary">Behållna relationer: {preview.keptList.length}</div>
                                            <div className="text-sm text-primary">Arkiverade relationer: {preview.archivedList.length}</div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setSelectedPair(null)} className="px-3 py-1 border border-subtle rounded bg-surface-2 text-primary hover:bg-surface-2">Avmarkera</button>
                                    <button onClick={doMerge} className="px-3 py-1 bg-danger text-on-accent rounded hover:opacity-90">Sammanfoga</button>
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

