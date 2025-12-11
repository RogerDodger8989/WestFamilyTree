import React from 'react';
import { useApp } from './AppContext';

export default function RelationshipDrawer() {
  const { dbData, getPersonRelations, unlinkRelation, isRelationshipDrawerOpen, relationshipCatalogState, setRelationshipCatalogState, handleToggleRelationshipDrawer } = useApp();
  if (!isRelationshipDrawerOpen) return null;

  const selectedPersonId = relationshipCatalogState?.selectedPersonId;
  const person = dbData.people.find(p => p.id === selectedPersonId) || null;
  const relations = selectedPersonId ? (getPersonRelations ? getPersonRelations(selectedPersonId) : []) : [];

  return (
    <div className="fixed left-0 right-0 bottom-0 bg-transparent z-30" style={{ top: 'calc(6rem + 1cm)' }}>
      <div className="fixed left-0 bottom-0 w-1/2 border-r border-slate-700 flex flex-col bg-slate-800 z-40 overflow-y-auto transition-transform duration-200 animate-slide-in-left drawer-inner" role="dialog" aria-modal="true" style={{ top: 'calc(6rem + 1cm)' }}>
        <div className="flex items-start justify-between p-4 border-b border-slate-700 bg-slate-800">
          <h3 className="text-lg font-bold text-slate-200">Relationer</h3>
          <div className="flex flex-col items-end gap-2">
            <button className="text-2xl px-2 py-1 text-slate-400 hover:bg-slate-700 rounded" onClick={() => handleToggleRelationshipDrawer(relationshipCatalogState?.selectedPersonId)} aria-label="Stäng">×</button>
          </div>
        </div>
        <div className="p-4 flex-1 overflow-y-auto bg-slate-800">
          {!person && <div className="text-slate-400">Öppna en person för att visa relationer.</div>}
          {person && (
            <div>
              <div className="text-sm font-semibold mb-2">{person.firstName} {person.lastName}</div>
              <div className="text-xs text-slate-400 mb-3">Händelser</div>
              <ul className="text-sm mb-4">
                {(person.events || []).map(ev => (
                  <li key={ev.id} className="flex justify-between items-center py-1 border-b">
                    <div>{ev.type || 'Händelse'} {ev.date ? `— ${ev.date}` : ''}</div>
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600" onClick={() => alert('Koppla funktion inte implementerad ännu')}>Koppla</button>
                      <button className="text-xs text-red-600" onClick={() => alert('Ta bort funktion inte implementerad ännu')}>Ta bort</button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="text-xs text-slate-400 mb-2">Relationer</div>
              <ul className="text-sm">
                {relations.length === 0 && <li className="text-slate-400">Inga relationer hittades.</li>}
                {relations.map(r => (
                  <li key={r.id} className="flex justify-between items-center py-1 border-b">
                    <div>{r.type}: {r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId}</div>
                    <div className="flex gap-2">
                      <button className="text-xs text-blue-600" onClick={() => alert('Redigera relation: inte implementerat ännu')}>Redigera</button>
                      <button className="text-xs text-red-600" onClick={() => { if (confirm('Arkivera denna relation?')) unlinkRelation(r.id); }}>Ta bort</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
