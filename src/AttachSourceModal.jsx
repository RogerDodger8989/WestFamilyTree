
import React, { useState, useEffect, useRef } from 'react';
import ImageDropPreview from './ImageDropPreview.jsx';
import ImageGallery from './ImageGallery.jsx';
import { parseSourceString } from './parsing.js';
import { useApp } from './AppContext';

function AttachSourceModal({ allSources, allPeople, onAttach, onCreateNew, onClose, onEditSource }) {
    // Hjälpfunktion för att parsa årtal, sidnummer och AID
    const getParsedSourceInfo = (source) => {
        // Om fälten redan finns, använd dem
        let yearRange = source.yearRange;
        let pageNumber = source.pageNumber;
        let aid = source.otherInfo;
        // Om saknas, försök parsa från sourceString
        if (source.sourceString) {
            // Årtal: t.ex. "(1821-1826)" eller "1821-1826"
            const yearMatch = source.sourceString.match(/\((\d{4}-\d{4})\)/) || source.sourceString.match(/(\d{4}-\d{4})/);
            if (yearMatch) yearRange = yearMatch[1];
            // Sidnummer: t.ex. "sid 1" eller "sida 1" eller "Bild 60/sid 1"
            const pageMatch = source.sourceString.match(/sid\s*(\d+)/i) || source.sourceString.match(/sida\s*(\d+)/i);
            if (pageMatch) pageNumber = pageMatch[1];
            // AID: t.ex. "AID: v111127a.b60.s1"
            const aidMatch = source.sourceString.match(/AID:\s*([\w\.]+)/i);
            if (aidMatch) aid = `AID: ${aidMatch[1]}`;
        }
        // Fallback till parsing.js om något saknas
        if (!source.archive || !source.volume || !source.imagePage || !aid) {
            const parsed = parseSourceString(source.sourceString);
            if (!source.archive) source.archive = parsed.archive;
            if (!source.volume) source.volume = parsed.volume;
            if (!source.imagePage) source.imagePage = parsed.imagePage;
            if (!aid) aid = parsed.otherInfo;
        }
        return { yearRange, pageNumber, aid };
    };
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSelectionChange = (sourceId) => {
    setSelectedSourceIds(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  // Filtrera källorna baserat på söktermen
  const filteredSources = allSources.filter(source => {
    const term = searchTerm.toLowerCase();
    if (!term) return true; // Visa alla om sökfältet är tomt
    return (
      source.sourceString?.toLowerCase().includes(term) ||
      source.archive?.toLowerCase().includes(term) ||
      source.volume?.toLowerCase().includes(term)
    );
  });

  // Effekt för att auto-välja om det finns en exakt matchning
  useEffect(() => {
    if (filteredSources.length === 1 && filteredSources[0].sourceString.toLowerCase() === searchTerm.toLowerCase()) {
      setSelectedSourceIds([filteredSources[0].id]);
    } else {
      // Om ingen exakt matchning, rensa urvalet för att undvika förvirring
      if (selectedSourceIds.length > 0 && !filteredSources.find(s => s.id === selectedSourceIds[0])) {
        setSelectedSourceIds([]);
      }
    }
  }, [searchTerm, filteredSources]);

  // Filtrera personer till bara relevanta släktingar
  // Anta att aktuell personId finns i props (t.ex. via en extra prop 'currentPersonId')
  // Om inte, visa tom lista
  const { getPersonRelations } = useApp();
  const relevantPeople = (() => {
    if (!window.sourcingEventInfo || !window.sourcingEventInfo.personId) return [];
    const currentPersonId = window.sourcingEventInfo.personId;
    const currentPerson = allPeople.find(p => p.id === currentPersonId);
    if (!currentPerson) return [];
    const rels = getPersonRelations(currentPersonId) || [];
    const parentIds = rels.filter(r => !r._archived && (r.type || '').toString().toLowerCase() === 'parent').map(r => (r.fromPersonId === currentPersonId ? r.toPersonId : r.fromPersonId)).filter(Boolean);
    const childIds = rels.filter(r => !r._archived && (r.type || '').toString().toLowerCase() === 'child').map(r => (r.fromPersonId === currentPersonId ? r.toPersonId : r.fromPersonId)).filter(Boolean);
    const spouseIds = rels.filter(r => !r._archived && ['spouse','partner'].includes((r.type || '').toString().toLowerCase())).map(r => (r.fromPersonId === currentPersonId ? r.toPersonId : r.fromPersonId)).filter(Boolean);

    // Syskon: personer som delar förälder med currentPerson
    const siblingIds = allPeople.filter(p => {
      if (p.id === currentPersonId) return false;
      const pRels = getPersonRelations(p.id) || [];
      const pParents = pRels.filter(r => !r._archived && (r.type || '').toString().toLowerCase() === 'parent').map(r => (r.fromPersonId === p.id ? r.toPersonId : r.fromPersonId)).filter(Boolean);
      return pParents.some(pid => parentIds.includes(pid));
    }).map(p => p.id);

    const ids = [...parentIds, ...childIds, ...spouseIds, ...siblingIds];
    const uniqueIds = Array.from(new Set(ids));
    return allPeople.filter(p => uniqueIds.includes(p.id));
  })();

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content card bg-slate-800 border border-slate-700 p-6 rounded-xl max-w-3xl text-slate-200">
        <h3 className="text-xl font-bold mb-4 text-slate-200">Koppla Källa till Händelser</h3>
        <input
          type="text"
          placeholder="Sök i källkatalogen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-slate-600 bg-slate-900 text-slate-200 rounded mb-4"
        />
        <div className="flex gap-6">
          <div className="w-1/2">
            <h4 className="font-semibold mb-2 text-slate-200">Välj källa</h4>
            <div className="space-y-2 max-h-72 overflow-y-auto border border-slate-700 bg-slate-800 rounded p-2 mb-4">
              {filteredSources.length === 0 ? (
                <p className="text-slate-400 italic p-4 text-center">Inga källor finns i källkatalogen.</p>
              ) : (
                filteredSources.map(source => {
                  const { yearRange, pageNumber, aid } = getParsedSourceInfo(source);
                  return (
                    <div key={source.id} className={`p-2 rounded flex gap-3 items-center cursor-pointer ${selectedSourceIds.includes(source.id) ? 'bg-blue-900' : 'hover:bg-slate-700'}`}>
                      <ImageGallery source={source} onEditSource={onEditSource} />                      
                      <div onClick={() => handleSelectionChange(source.id)} className="flex-grow">
                        <div className="font-bold text-slate-200 text-sm">
                          {source.archive} {source.volume}
                          {yearRange ? ` (${yearRange})` : ''}
                        </div>
                        <div className="text-xs text-slate-400">
                          {source.imagePage}{pageNumber ? `/sid ${pageNumber}` : ''}
                          {aid ? ` (${aid})` : ''}
                        </div>
                      </div>
                      <button type="button" className="ml-2 px-2 py-1 text-xs bg-slate-700 text-slate-200 rounded hover:bg-slate-600" onClick={(e) => { e.stopPropagation(); if (onEditSource) onEditSource(source.id); }}>
                        Redigera
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <button type="button" onClick={() => onCreateNew(searchTerm)} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Skapa ny källa...</button>
          </div>
          <div className="w-1/2">
            <h4 className="font-semibold mb-2 text-slate-200">Välj händelser</h4>
            <div className="space-y-2 max-h-72 overflow-y-auto border border-slate-700 bg-slate-800 rounded p-2 mb-4">
              {relevantPeople.map(person => (
                <div key={person.id}>
                  <div className="font-bold text-slate-300 text-xs mb-1">REF: {person.refNumber} {person.firstName} {person.lastName}</div>
                  {person.events?.map(event => (
                    <label key={event.id} className="flex items-center gap-2 text-xs mb-1">
                      <input
                        type="checkbox"
                        checked={selectedEventIds.includes(event.id)}
                        onChange={() => setSelectedEventIds(prev => prev.includes(event.id) ? prev.filter(id => id !== event.id) : [...prev, event.id])}
                      />
                      <span>{event.type} {event.date ? `(${event.date})` : ''}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end items-center mt-6 gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-600 rounded hover:bg-slate-700">Avbryt</button>
          <button
            type="button"
            onClick={() => onAttach(selectedSourceIds, selectedEventIds)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={selectedSourceIds.length === 0 || selectedEventIds.length === 0}
          >Koppla valda</button>
        </div>
      </div>
    </div>
  );
}

export default AttachSourceModal;