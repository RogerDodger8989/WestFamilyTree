import React, { useState, useEffect } from 'react';
import Editor from './MaybeEditor.jsx';
import { useApp } from './AppContext';

function getLifeSpanString(person) {
    if (!person) return '';
    const birth = person.events?.find(e => e.type === 'Födelse')?.date || '';
    const death = person.events?.find(e => e.type === 'Död')?.date || '';
    return birth || death ? `(${birth} - ${death})` : '';
}

function PersonCard({ person, label, onSelect, onCreateNew, onRemove, people }) {
    if (!person) {
        return (
            <div className="p-4 border-2 border-dashed rounded-lg text-center">
                <div className="text-sm text-slate-400 mb-2">{label}</div>
                <button onClick={onSelect} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Välj befintlig</button>
                <button onClick={onCreateNew} className="ml-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200">Skapa ny</button>
            </div>
        );
    }

    return (
        <div className="p-4 border rounded-lg bg-slate-900 border-slate-700 shadow-sm relative">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="font-bold">{person.firstName} {person.lastName}</div>
            <div className="text-sm text-slate-300">{getLifeSpanString(person)}</div>
            {onRemove && (
                <button onClick={() => onRemove(person.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold text-lg">&times;</button>
            )}
        </div>
    );
}

export default function RelationsModal({ person, allPeople, onClose, onCreateNewPerson }) {
    const { addRelation, getPersonRelations, unlinkRelation, updateRelation, dbData } = useApp();
    const [parents, setParents] = useState([]);
    const [children, setChildren] = useState([]);
    const [editingRelationId, setEditingRelationId] = useState(null);
    const [editingRelationData, setEditingRelationData] = useState({ startDate: '', endDate: '', certainty: '', note: '', sourceIds: [], reason: '' });

    useEffect(() => {
        const rels = getPersonRelations(person.id) || [];
        const ps = [];
        const cs = [];
        rels.forEach(r => {
            if (!r || r._archived) return;
            const type = (r.type || '').toLowerCase();
            if (type === 'parent') {
                // fromPersonId is parent
                ps.push(r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId);
            } else if (type === 'child') {
                cs.push(r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId);
            }
        });
        setParents(Array.from(new Set(ps)));
        setChildren(Array.from(new Set(cs)));
    }, [person?.id]);
    // Söklogik behövs för att välja personer
    const [isSelecting, setIsSelecting] = useState(null); // 'parent', 'child', 'spouse'
    const [searchTerm, setSearchTerm] = useState('');

    const handleSave = () => {
        // Compute desired relations from parents/children arrays
        const desired = [];
        parents.forEach(pid => desired.push({ type: 'parent', fromPersonId: pid, toPersonId: person.id }));
        children.forEach(cid => desired.push({ type: 'child', fromPersonId: cid, toPersonId: person.id }));

        const existing = getPersonRelations(person.id) || [];

        // Add missing relations
        desired.forEach(d => {
            const found = existing.find(r => !r._archived && (r.type || '').toLowerCase() === d.type && r.fromPersonId === d.fromPersonId && r.toPersonId === d.toPersonId);
            if (!found) {
                addRelation(d);
            }
        });

        // Archive relations that are no longer desired
        existing.forEach(r => {
            if (r._archived) return;
            const match = desired.find(d => (d.type === (r.type || '').toLowerCase() || d.type === r.type) && d.fromPersonId === r.fromPersonId && d.toPersonId === r.toPersonId);
            if (!match) unlinkRelation(r.id);
        });

        onClose();
    };

    const filteredPeople = searchTerm
        ? allPeople.filter(p =>
            p.id !== person.id &&
            (p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
             String(p.refNumber).includes(searchTerm))
          ).slice(0, 10)
        : [];

    const handleSelectPersonForRelation = (personId) => {
        if (isSelecting === 'parent') {
            if (parents.length < 2 && !parents.includes(personId)) {
                setParents(p => [...p, personId]);
            }
        }
        if (isSelecting === 'child') {
            if (!children.includes(personId)) {
                setChildren(c => [...c, personId]);
            }
        }
        setIsSelecting(null);
        setSearchTerm('');
    };

    const findRelationBetween = (otherId, types = ['parent','child']) => {
        const rels = getPersonRelations(person.id) || [];
        return rels.find(r => {
            if (!r || r._archived) return false;
            const t = (r.type || '').toString().toLowerCase();
            if (!types.includes(t)) return false;
            return (r.fromPersonId === otherId && r.toPersonId === person.id) || (r.toPersonId === otherId && r.fromPersonId === person.id);
        }) || null;
    };

    const openEditRelation = (otherId) => {
        const rel = findRelationBetween(otherId);
        if (!rel) return alert('Ingen relationspost hittades för denna koppling.');
        setEditingRelationId(rel.id);
        setEditingRelationData({
            startDate: rel.startDate || '',
            endDate: rel.endDate || '',
            certainty: rel.certainty || '',
            note: rel.note || '',
            sourceIds: Array.isArray(rel.sourceIds) ? rel.sourceIds.slice() : [],
            reason: rel.reason || ''
        });
    };

    const handleSaveEditedRelation = () => {
        if (!editingRelationId) return;
        updateRelation(editingRelationId, {
            startDate: editingRelationData.startDate || '',
            endDate: editingRelationData.endDate || '',
            certainty: editingRelationData.certainty || null,
            note: editingRelationData.note || '',
            sourceIds: editingRelationData.sourceIds || [],
            reason: editingRelationData.reason || ''
        });
        setEditingRelationId(null);
    };

    const handleCancelEditRelation = () => { setEditingRelationId(null); };

    const removeRelation = (personId, type) => {
        if (type === 'parent') {
            setParents(p => p.filter(id => id !== personId));
        }
        if (type === 'child') {
            setChildren(c => c.filter(id => id !== personId));
        }
    };

    const findPerson = (id) => allPeople.find(p => p.id === id);

    if (isSelecting) {
        return (
            <div className="modal" style={{ display: 'block' }}>
                <div className="modal-content card bg-slate-800 border border-slate-700 p-6 rounded-xl max-w-lg">
                    <h3 className="text-lg font-bold mb-4">Välj {isSelecting === 'parent' ? 'förälder' : 'barn'}</h3>
                    <input
                        type="text"
                        placeholder="Sök på namn eller REF..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-2 border rounded mb-2"
                        autoFocus
                    />
                    <ul className="max-h-64 overflow-y-auto">
                        {filteredPeople.map(p => (
                            <li key={p.id} onClick={() => handleSelectPersonForRelation(p.id)} className="p-2 hover:bg-blue-100 cursor-pointer rounded">
                                {p.firstName} {p.lastName} <span className="text-slate-400">{getLifeSpanString(p)}</span>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-4 flex justify-end">
                        <button onClick={() => setIsSelecting(null)} className="px-4 py-2 border border-slate-600 rounded hover:bg-slate-700 text-slate-200">Avbryt</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal" style={{ display: 'block' }}>
            {/* Relation metadata editor overlay */}
            {editingRelationId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl">
                        <h4 className="text-lg font-bold mb-3">Redigera relation</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-slate-300">Roll (från)</label>
                                <input value={editingRelationData.roleFrom || ''} onChange={e => setEditingRelationData(prev => ({ ...prev, roleFrom: e.target.value }))} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300">Roll (till)</label>
                                <input value={editingRelationData.roleTo || ''} onChange={e => setEditingRelationData(prev => ({ ...prev, roleTo: e.target.value }))} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300">Startdatum</label>
                                <input type="date" value={editingRelationData.startDate || ''} onChange={e => setEditingRelationData(prev => ({ ...prev, startDate: e.target.value }))} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300">Slutdatum</label>
                                <input type="date" value={editingRelationData.endDate || ''} onChange={e => setEditingRelationData(prev => ({ ...prev, endDate: e.target.value }))} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300">Säkerhet</label>
                                <select value={editingRelationData.certainty || ''} onChange={e => setEditingRelationData(prev => ({ ...prev, certainty: e.target.value }))} className="w-full p-2 border rounded">
                                    <option value="">Välj...</option>
                                    <option value="low">Låg</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">Hög</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-300">Orsak / Notering</label>
                                <input value={editingRelationData.reason || ''} onChange={e => setEditingRelationData(prev => ({ ...prev, reason: e.target.value }))} className="w-full p-2 border rounded" />
                            </div>
                        </div>
                                                <div className="mt-3">
                                                        <label className="block text-xs text-slate-300">Anteckning</label>
                                                        <Editor
                                                            value={editingRelationData.note || ''}
                                                            onChange={e => setEditingRelationData(prev => ({ ...prev, note: e.target.value }))}
                                                            containerProps={{ style: { minHeight: '60px', maxHeight: '20vh', overflow: 'auto' } }}
                                                            spellCheck={true}
                                                            lang="sv"
                                                        />
                                                </div>
                        <div className="mt-3">
                            <div className="text-sm font-semibold mb-1">Källor</div>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                {(dbData?.sources || []).map(s => (
                                    <label key={s.id} className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={(editingRelationData.sourceIds || []).includes(s.id)} onChange={e => {
                                            const cur = Array.isArray(editingRelationData.sourceIds) ? editingRelationData.sourceIds.slice() : [];
                                            if (e.target.checked) {
                                                cur.push(s.id);
                                            } else {
                                                const idx = cur.indexOf(s.id);
                                                if (idx !== -1) cur.splice(idx, 1);
                                            }
                                            setEditingRelationData(prev => ({ ...prev, sourceIds: cur }));
                                        }} />
                                        <span className="truncate">{s.sourceString || s.title || s.id}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={handleCancelEditRelation} className="px-4 py-2 border rounded">Avbryt</button>
                            <button onClick={handleSaveEditedRelation} className="px-4 py-2 bg-green-600 text-white rounded">Spara relation</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="modal-content card bg-slate-800 border border-slate-700 p-6 rounded-xl max-w-4xl">
                <h3 className="text-2xl font-bold mb-6 text-center">Familjeöversikt för {person.firstName} {person.lastName}</h3>

                {/* Föräldrar */}
                <div className="mb-6">
                    <h4 className="font-semibold text-lg mb-2 text-slate-200">Föräldrar</h4>
                    <div className="grid grid-cols-2 gap-4">
                        {[0,1].map(idx => {
                            const pid = parents[idx];
                            const p = findPerson(pid);
                            return (
                                <div key={idx}>
                                    <PersonCard person={p} label="Förälder till" onSelect={() => setIsSelecting('parent')} onCreateNew={onCreateNewPerson} onRemove={(id) => removeRelation(id, 'parent')} />
                                    {p && (
                                      <div className="mt-2 flex gap-2">
                                        <button onClick={() => openEditRelation(p.id)} className="px-3 py-1 text-sm border rounded">Redigera relation</button>
                                        <button onClick={() => removeRelation(p.id, 'parent')} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded">Ta bort</button>
                                      </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Fokusperson & Partner */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                     <h4 className="font-semibold text-lg mb-2 text-slate-200">Fokusperson & Partner</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-slate-900 border-slate-700 shadow-sm ring-2 ring-blue-500">
                            <div className="text-xs text-blue-600 font-bold">Fokusperson</div>
                            <div className="font-bold text-xl">{person.firstName} {person.lastName}</div>
                            <div className="text-md text-slate-300">{getLifeSpanString(person)}</div>
                        </div>
                         {/* Partner-sektion kan byggas ut här */}
                        <PersonCard person={null} label="Partner" onSelect={() => alert('Partner-funktion kommer snart!')} onCreateNew={onCreateNewPerson} />
                     </div>
                </div>

                {/* Barn */}
                <div>
                    <h4 className="font-semibold text-lg mb-2 text-slate-200">Barn</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {children.map(childId => (
                            <div key={childId}>
                                <PersonCard person={findPerson(childId)} label="Barn till" onRemove={(id) => removeRelation(id, 'child')} />
                                <div className="mt-2 flex gap-2">
                                    <button onClick={() => openEditRelation(childId)} className="px-3 py-1 text-sm border rounded">Redigera relation</button>
                                    <button onClick={() => removeRelation(childId, 'child')} className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded">Ta bort</button>
                                </div>
                            </div>
                        ))}
                        <div className="p-4 border-2 border-dashed rounded-lg text-center flex flex-col justify-center items-center">
                             <button onClick={() => setIsSelecting('child')} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Välj befintligt barn</button>
                             <button onClick={onCreateNewPerson} className="mt-2 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200">Skapa nytt barn</button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-600 rounded hover:bg-slate-700 text-slate-200">Avbryt</button>
                    <button type="button" onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Spara Relationer</button>
                </div>
            </div>
        </div>
    );
}