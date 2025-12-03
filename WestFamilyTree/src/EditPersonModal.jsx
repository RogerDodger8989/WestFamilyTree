import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import TagInput from './TagInput.jsx';
import Editor from './MaybeEditor.jsx';
import EventEditor from './EventEditor.jsx';
import SourceManager from './SourceManager.jsx';
import RelationshipPath from './RelationshipPath.jsx';
import NoteEditorModal from './NoteEditorModal.jsx';
import ImageGallery from './ImageGallery.jsx';
import { useApp } from './AppContext';
import SmartDateField from './SmartDateField.jsx';
import MaybeEditor from './MaybeEditor.jsx';
import PlacePicker from './PlacePicker.jsx';

// --- HJÄLPFUNKTIONER FÖR GEDCOM-ÖVERSÄTTNING ---
const EVENT_LABELS = {
  'BIRT': 'Födelse',
  'CHR': 'Dop',
  'CONF': 'Konfirmation',
  'DEAT': 'Död',
  'BURI': 'Begravning',
  'MARR': 'Vigsel',
  'DIV': 'Skilsmässa',
  'RESI': 'Bosatt',
  'OCCU': 'Yrke',
  'EDUC': 'Utbildning',
  'PROB': 'Bouppteckning',
  'EMIG': 'Emigration',
  'IMMI': 'Immigration',
  'EVEN': 'Annan händelse',
  'NOTE': 'Notering',
  'ANUL': 'Annulering',
  'CENS': 'Folkräkning',
  'CREM': 'Kremering',
  'NATU': 'Naturalisation',
  'RETI': 'Pension',
  'BAPM': 'Barndop',
  'BLES': 'Välsignelse',
  'ADOP': 'Adoption',
  'BAPL': 'Dop (LDS)',
  'BASM': 'Bat Mitzvah',
  'ORDN': 'Ordination',
  'GRAD': 'Examen',
  'WILL': 'Testamente',
  'EVEN_CUSTOM': 'Egen händelse'
};

const getEventLabel = (type) => EVENT_LABELS[type] || type;

// --- BILDHANTERING ---
function ImagePreview({ source, onOpenSourceModal }) {
  const imgPreview = useImagePreview(source);
  if (!source) return null;
  if (!imgPreview) return null;
  return (
    <div className="flex flex-col items-center mr-2">
      <img src={imgPreview} alt="miniatyr" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '2px solid #bbb', marginBottom: 4 }} />
      <div className="text-[10px] text-gray-500 text-center break-all max-w-[90px]">
        {source.imagePath || 'bild.png'}
      </div>
      <div className="text-[10px] text-gray-400">{imgPreview.length ? Math.round((imgPreview.length * 3 / 4) / 1024) : ''} kB</div>
      <button
        className="mt-1 text-xs text-red-500 hover:text-red-700 underline"
        onClick={e => { e.stopPropagation(); if(window.confirm('Ta bort bild?')) onOpenSourceModal({ ...source, imageBase64: null, imagePath: null, imageNote: '' }); }}
      >Radera bild</button>
      <Editor
        value={source.imageNote || ''}
        onChange={(e) => { e.stopPropagation && e.stopPropagation(); onOpenSourceModal({ ...source, imageNote: e.target.value }); }}
        containerProps={{
          style: {
            width: '80px',
            minHeight: '36px',
            maxHeight: '80px',
            overflow: 'auto'
          },
          onMouseDown: (e) => e.stopPropagation()
        }}
        spellCheck={true}
        lang="sv"
      />
    </div>
  );
}

function useImagePreview(source, imageFolder) {
  const [imgPreview, setImgPreview] = useState(null); 

  // Fix: Använd useCallback för att stabilisera readFile-funktionen
  const readFile = useCallback(async (filePath) => {
    try {
        const data = await window.electronAPI.readFile(filePath);
        if (data && data instanceof Uint8Array) {
            const binary = Array.from(data).map(b => String.fromCharCode(b)).join('');
            const base64 = btoa(binary);
            setImgPreview('data:image/png;base64,' + base64);
        } else {
            setImgPreview(null);
        }
    } catch (err) {
        setImgPreview(null);
    }
  }, []);

  useEffect(() => {
    if (!source) return;
    
    // 1. Har vi redan base64?
    if (source.imageBase64) {
      setImgPreview(source.imageBase64);
      return;
    }

    // 2. Annars, ladda från disk via Electron
    if (source.imagePath && window.electronAPI && window.electronAPI.readFile) {
      let rootFolder = imageFolder || 'C:/WestFamilyTree/bilder';
      const filePath = `${rootFolder}\\${source.imagePath}`.replace(/\+/g, '\\');
      readFile(filePath);
    } else {
      setImgPreview(null);
    }
  }, [source?.id, source?.imagePath, source?.imageBase64, imageFolder, readFile]);

  return imgPreview;
}

// --- HUVUDKOMPONENT ---
function EditPersonModal({ person, onClose, onSave, onChange, allSources, allPeople, allPlaces, onDeleteEvent, onOpenSourceDrawer, onNavigateToSource, onNavigateToPlace, onTogglePlaceDrawer, activeSourcingEventId, focusPair, onViewInFamilyTree, isDrawerMode = false }) {
      // Bokmärken och släktträd
      const { bookmarks = [], handleToggleBookmark, onViewInFamilyTree: goToFamilyTree } = useApp();
      const isBookmarked = bookmarks.includes(person.id);
    // Samla bilder där personen är taggad (regions) eller äger bilden
    const personId = person.id;
    const ownImages = person.images || [];
    // Hitta bilder från andra personer där denna person är taggad
    const taggedImages = useMemo(() => {
      if (!allPeople) return [];
      let result = [];
      for (const p of allPeople) {
        if (!p.images) continue;
        for (const img of p.images) {
          if (Array.isArray(img.regions) && img.regions.some(r => r.personId === personId)) {
            // Undvik dubbletter om det är samma objekt
            if (!ownImages.includes(img)) result.push(img);
          }
        }
      }
      return result;
    }, [allPeople, personId, ownImages]);
    const allImages = [...ownImages, ...taggedImages];
  if (!person) return null;
  const [newEventTypeName, setNewEventTypeName] = useState('Födelse');
  const [editingNoteForEvent, setEditingNoteForEvent] = useState(null);
  const [activePersonTab, setActivePersonTab] = useState('info');
  // Forskning: tasks och anmärkning
  const [researchTasks, setResearchTasks] = useState(person.researchTasks || []);
  const [researchNote, setResearchNote] = useState(person.researchNote || '');
  // Taggar (komma-separerad sträng)
  const [personTags, setPersonTags] = useState(person.tags || '');
  
  // Hämta nödvändiga funktioner från AppContext
  const { getPersonRelations, addRelation, unlinkRelation, updateRelation, dbData, undoMerge, restorePerson, showStatus, recordAudit, handleDeletePerson } = useApp();

  // Förydliga händelser för Editorn
  const { birthEvent, deathEvent } = useMemo(() => {
    const events = person.events || [];
    const getEvent = (type) => events.find(e => e.type === type || e.type === EVENT_LABELS[type]) || {};
    return {
        birthEvent: getEvent('BIRT'),
        deathEvent: getEvent('DEAT'),
    };
  }, [person.events]);

  const isArchived = person._archived;

  // --- FUNKTIONER ---
  const handleSaveChanges = () => onSave(person);
  const handleRestore = () => restorePerson(person.id);

  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...person, [name]: value });
  };
  
  const handleEventChange = (index, updatedEvent) => {
    const updatedEvents = person.events.map((e, i) => i === index ? updatedEvent : e);
    onChange({ ...person, events: updatedEvents });
  };

  const handleLinkSourceToEvent = (eventIndex, sourceId) => {
    const updatedEvents = person.events.map((e, i) => {
        if (i === eventIndex) {
            const sources = e.sources ? [...e.sources, sourceId] : [sourceId];
            return { ...e, sources };
        }
        return e;
    });
    onChange({ ...person, events: updatedEvents });
  };
  
  const handleUnlinkSourceFromEvent = (eventIndex, sourceId) => {
    const updatedEvents = person.events.map((e, i) => {
        if (i === eventIndex) {
            const sources = (e.sources || []).filter(sid => sid !== sourceId);
            return { ...e, sources };
        }
        return e;
    });
    onChange({ ...person, events: updatedEvents });
  };

  const handleAddEvent = () => {
    const eventType = newEventTypeName;
    const newEvent = {
        id: `evt_${Date.now()}`,
        type: eventType,
        date: '',
        place: '',
        note: '',
        sources: []
    };
    const updatedEvents = [...(person.events || []), newEvent];
    onChange({ ...person, events: updatedEvents });
    setNewEventTypeName('Födelse'); // Återställ
  };

  const handleVitalEventChange = (eventTypeLabel, eventTypeGedcom, field, value) => {
    const currentEventIndex = person.events?.findIndex(e => e.type === eventTypeLabel || e.type === eventTypeGedcom);
    
    let updatedEvents = [...(person.events || [])];
    
    if (currentEventIndex !== -1) {
        // Uppdatera befintlig händelse
        const updatedEvent = { ...updatedEvents[currentEventIndex], [field]: value };
        updatedEvents[currentEventIndex] = updatedEvent;
    } else {
        // Skapa ny händelse om den saknas
        if (value) {
            const newEvent = {
                id: `evt_${Date.now()}`,
                type: eventTypeLabel, // Använd etiketten för svenska
                [field]: value,
                sources: []
            };
            updatedEvents.push(newEvent);
        }
    }

    // Filter bort tomma vitala event om både datum och plats tas bort
    updatedEvents = updatedEvents.filter(e => {
      const isVital = e.type === 'Födelse' || e.type === 'Död' || e.type === 'BIRT' || e.type === 'DEAT';
      if (isVital && (!e.date && !e.place)) return false;
      return true;
    });

    onChange({ ...person, events: updatedEvents });
  };
  
  // --- RENDERING ---
  return (
    <div className="h-full flex flex-col" style={{ scrollbarGutter: 'stable' }}>
      {/* NOTE EDITOR MODAL */}
      {editingNoteForEvent && (
        <NoteEditorModal 
          isOpen={!!editingNoteForEvent}
          onClose={() => setEditingNoteForEvent(null)}
          initialHtml={editingNoteForEvent.event.note || ''}
          onSave={(newNote) => {
            handleEventChange(editingNoteForEvent.index, { ...editingNoteForEvent.event, note: newNote });
            setEditingNoteForEvent(null);
          }}
          title={`Redigera notering för ${getEventLabel(editingNoteForEvent.event.type)}`}
        />
      )}

      <div className="flex-grow overflow-y-auto p-6 bg-white">
        {/* TOP HEADER (Oförändrad) */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <RelationshipPath startPerson={person} endPersonId={focusPair?.primary} allPeople={allPeople} />
          </div>
        </div>

        {!isDrawerMode && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold text-gray-800">{person.firstName} {person.lastName}</div>
              {/* Bokmärke */}
              <button
                onClick={() => handleToggleBookmark(person.id)}
                title={isBookmarked ? 'Ta bort bokmärke' : 'Bokmärk person'}
                className={`ml-2 text-xl ${isBookmarked ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                style={{ lineHeight: 1 }}
              >★</button>
              {/* Gå till släktträd */}
              <button
                onClick={() => goToFamilyTree ? goToFamilyTree(person.id) : null}
                title="Gå till släktträd"
                className="ml-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 border border-blue-200"
              >Släktträd</button>
              {isArchived && <div className="text-red-600 font-semibold ml-2">ARKIVERAD</div>}
            </div>
            {isArchived && <button onClick={handleRestore} className="px-3 py-1 bg-red-600 text-white rounded">Återställ</button>}
          </div>
        )}

        {/* PERSONFLIKAR */}
        <div className="flex border-b mb-6 bg-gray-50 rounded-t-lg shadow-sm">
          <button
            className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activePersonTab === 'info' ? 'border-blue-600 text-blue-700 bg-white shadow -mb-px' : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
            onClick={() => setActivePersonTab('info')}
            title="Info"
          >
            <span className="text-lg" role="img" aria-label="Info">ℹ️</span>
            Info
            {activePersonTab === 'info' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
          </button>
          <button
            className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activePersonTab === 'relations' ? 'border-blue-600 text-blue-700 bg-white shadow -mb-px' : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
            onClick={() => setActivePersonTab('relations')}
            title="Relationer"
          >
            <span className="text-lg" role="img" aria-label="Relationer">👪</span>
            Relationer
            {activePersonTab === 'relations' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
          </button>
          <button
            className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activePersonTab === 'images' ? 'border-blue-600 text-blue-700 bg-white shadow -mb-px' : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
            onClick={() => setActivePersonTab('images')}
            title="Bilder"
          >
            <span className="text-lg" role="img" aria-label="Bilder">🖼️</span>
            Bilder
            {allImages.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow" style={{ minWidth: 22, textAlign: 'center' }}>{allImages.length}</span>
            )}
            {activePersonTab === 'images' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
          </button>
          <button
            className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activePersonTab === 'notes' ? 'border-blue-600 text-blue-700 bg-white shadow -mb-px' : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
            onClick={() => setActivePersonTab('notes')}
            title="Noteringar"
          >
            <span className="text-lg" role="img" aria-label="Noteringar">📝</span>
            Noteringar
            {activePersonTab === 'notes' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
          </button>
          {/* Forskning-flik */}
          <button
            className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activePersonTab === 'research' ? 'border-blue-600 text-blue-700 bg-white shadow -mb-px' : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
            onClick={() => setActivePersonTab('research')}
            title="Forskning"
          >
            <span className="text-lg" role="img" aria-label="Forskning">🔬</span>
            Forskning
            {activePersonTab === 'research' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
          </button>
          {/* Taggar-flik */}
          <button
            className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activePersonTab === 'tags' ? 'border-blue-600 text-blue-700 bg-white shadow -mb-px' : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
            onClick={() => setActivePersonTab('tags')}
            title="Taggar"
          >
            <span className="text-lg" role="img" aria-label="Taggar">🏷️</span>
            Taggar
            {activePersonTab === 'tags' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
          </button>
        </div>
            {activePersonTab === 'research' && (
              <section>
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Forskning</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Att göra-lista */}
                  <div>
                    <h5 className="font-bold mb-2">Att göra</h5>
                    <ul className="mb-2">
                      {researchTasks.map((task, idx) => (
                        <li key={idx} className="flex items-center gap-2 mb-1">
                          <span className="inline-block min-w-[110px] text-gray-500 text-xs font-semibold">
                            {(() => {
                              switch (task.prio) {
                                case '1': return '1 - Låg prio';
                                case '2': return '2 - Mellan prio';
                                case '3': return '3 - Hög prio';
                                case '4': return '4 - Mycket hög prio';
                                case '5': return '5 - Extremt hög prio';
                                default: return '0 - Ingen prio';
                              }
                            })()}
                          </span>
                          <span className="flex-1">{task.text}</span>
                          <button className="text-red-500 hover:text-red-700 text-xs" onClick={() => setResearchTasks(researchTasks.filter((_, i) => i !== idx))}>Ta bort</button>
                        </li>
                      ))}
                    </ul>
                    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const text = e.target.tasktext.value.trim(); const prio = e.target.prio.value; if (text) { setResearchTasks([...researchTasks, { text, prio }]); e.target.reset(); } }}>
                      <select name="prio" className="w-36 p-1 border rounded text-xs">
                        <option value="0">0 - Ingen prio</option>
                        <option value="1">1 - Låg prio</option>
                        <option value="2">2 - Mellan prio</option>
                        <option value="3">3 - Hög prio</option>
                        <option value="4">4 - Mycket hög prio</option>
                        <option value="5">5 - Extremt hög prio</option>
                      </select>
                      <input name="tasktext" placeholder="Vad/hur?" className="flex-1 p-1 border rounded text-xs" />
                      <button type="submit" className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Lägg till</button>
                    </form>
                  </div>
                  {/* Anmärkning */}
                  <div>
                    <h5 className="font-bold mb-2">Anmärkning</h5>
                    <MaybeEditor
                      value={researchNote}
                      onChange={e => setResearchNote(e.target.value)}
                      placeholder="Forskningsnotiser, tankar, tips..."
                      className="w-full min-h-[100px]"
                      lang="sv"
                      spellCheck={true}
                    />
                  </div>
                </div>
              </section>
            )}
            {activePersonTab === 'tags' && (
              <section>
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Taggar</h4>
                <TagInput value={personTags} onChange={setPersonTags} placeholder="Lägg till tagg..." />
                <div className="text-xs text-gray-500 mt-2">Skriv och tryck Enter eller , (komma) för att lägga till. Taggar är unika för personen.</div>
              </section>
            )}

        {/* FLIKINNEHÅLL */}
        <div className="space-y-8">
          {activePersonTab === 'info' && (
            <>
              {/* Info-innehåll (allt som tidigare fanns här) */}
              <section>
                <div className="flex flex-col border-b pb-2 mb-4">
                  <div className="flex items-end gap-2 mb-3 w-full">
                    {/* REF - Fast bredd */}
                    <div className="flex-shrink-0">
                      <label className="block text-xs font-bold text-gray-500 uppercase">GEDCOM/REF</label>
                      <input 
                        type="text" 
                        value={person.refNumber || ''} 
                        onChange={handleChange} 
                        name="refNumber" 
                        className="w-24 p-2 border rounded bg-gray-100 text-center" 
                      />
                    </div>
                    {/* FÖRNAMN - Flexibel bredd (Fyller ut) */}
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">Förnamn</label>
                      <input 
                        type="text" 
                        name="firstName" 
                        value={person.firstName || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded" 
                      />
                    </div>
                    {/* EFTERNAMN - Flexibel bredd (Fyller ut) */}
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">Efternamn</label>
                      <input 
                        type="text" 
                        name="lastName" 
                        value={person.lastName || ''} 
                        onChange={handleChange} 
                        className="w-full p-2 border rounded" 
                      />
                    </div>
                    {/* KÖN - Fast bredd (Högerjusterad) */}
                    <div className="flex-shrink-0 ml-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase">Kön</label>
                      <select 
                        name="gender" 
                        value={person.gender || ''} 
                        onChange={handleChange} 
                        className="w-32 p-2 border rounded"
                      >
                        <option value="">Okänt</option>
                        <option value="M">Man</option>
                        <option value="K">Kvinna</option>
                      </select>
                    </div>
                  </div>
                </div>
                {/* VITALA HÄNDELSER */}
                <div className={isArchived ? 'grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 pointer-events-none' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase">Födelsedatum</label>
                    <SmartDateField className="w-full p-2 border rounded bg-white" value={birthEvent.date || person.birthDate || ''} onChange={(val) => handleVitalEventChange('Födelse', 'BIRT', 'date', val)} placeholder="t.ex. 12 apr 1900" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase">Dödsdatum</label>
                    <SmartDateField className="w-full p-2 border rounded bg-white" value={deathEvent.date || person.deathDate || ''} onChange={(val) => handleVitalEventChange('Död', 'DEAT', 'date', val)} placeholder="t.ex. 2010" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase">Födelseort</label>
                    <PlacePicker
                      value={birthEvent.placeId || ''}
                      allPlaces={allPlaces}
                      onChange={(placeId) => {
                        handleVitalEventChange('Födelse', 'BIRT', 'placeId', placeId);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase">Dödsort</label>
                    <PlacePicker
                      value={deathEvent.placeId || ''}
                      allPlaces={allPlaces}
                      onChange={(placeId) => {
                        handleVitalEventChange('Död', 'DEAT', 'placeId', placeId);
                      }}
                    />
                  </div>
                </div>
              </section>
              <section>
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Händelser & Livshistoria</h4>
                <div className="mb-4 p-3 bg-blue-50 rounded border border-blue-100 flex gap-2 items-end">
                  <div className="flex-grow">
                    <label className="text-xs font-bold text-blue-800">Lägg till händelsetyp</label>
                    <select value={newEventTypeName} onChange={(e) => setNewEventTypeName(e.target.value)} className="w-full p-2 border rounded text-sm bg-white">
                      <optgroup label="Vitala">
                        <option value="Födelse" disabled={person.events?.some(e => e.type === 'Födelse' || e.type === 'BIRT')}>Födelse</option>
                        <option value="Dop" disabled={person.events?.some(e => e.type === 'Dop' || e.type === 'CHR')}>Dop</option>
                        <option value="Konfirmation" disabled={person.events?.some(e => e.type === 'Konfirmation' || e.type === 'CONF')}>Konfirmation</option>
                        <option value="Död" disabled={person.events?.some(e => e.type === 'Död' || e.type === 'DEAT')}>Död</option>
                        <option value="Begravning" disabled={person.events?.some(e => e.type === 'Begravning' || e.type === 'BURI')}>Begravning</option>
                      </optgroup>
                      <optgroup label="Familj & Civilstånd">
                        <option value="Vigsel">Vigsel</option>
                        <option value="Skilsmässa">Skilsmässa</option>
                        <option value="Annulering">Annulering</option>
                        <option value="Adoption">Adoption</option>
                      </optgroup>
                      <optgroup label="Migration & Folkbokföring">
                        <option value="Emigration">Emigration</option>
                        <option value="Immigration">Immigration</option>
                        <option value="Folkräkning">Folkräkning</option>
                        <option value="Naturalisation">Naturalisation</option>
                      </optgroup>
                      <optgroup label="Liv & Yrke">
                        <option value="Bosatt">Bosatt</option>
                        <option value="Yrke">Yrke</option>
                        <option value="Utbildning">Utbildning</option>
                        <option value="Examen">Examen</option>
                      </optgroup>
                    </select>
                  </div>
                  <button onClick={handleAddEvent} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700">Lägg till</button>
                </div>
                
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                      <th className="px-4 py-2">Typ</th>
                      <th className="px-4 py-2">Datum</th>
                      <th className="px-4 py-2">Plats</th>
                      <th className="px-4 py-2">Notering</th>
                      {/* Bildkolumn borttagen */}
                      <th className="px-4 py-2 text-center">Källor</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(person.events || [])
                      .map((ev, idx) => ({ ...ev, originalIndex: idx }))
                      .map((event) => (
                        <React.Fragment key={event.id || event.originalIndex}>
                          <tr className={`event-row border-b transition-colors ${activeSourcingEventId === event.id ? 'bg-blue-100' : ''}`}>
                            <EventEditor 
                              event={{...event, type: getEventLabel(event.type)}}
                              index={event.originalIndex} 
                              onEventChange={handleEventChange} 
                              allPeople={allPeople}
                              allPlaces={allPlaces}
                              onNavigateToPlace={(placeId, eventId) => onTogglePlaceDrawer(placeId, { personId: person.id, eventId })}
                              onEditNote={() => setEditingNoteForEvent({ index: event.originalIndex, event })}
                              onNavigateToSource={onNavigateToSource}
                            />
                            <td className="px-4 py-2 text-right"><button onClick={() => onDeleteEvent(person.id, event.originalIndex)} className="text-red-500 hover:text-red-700 font-bold text-lg">×</button></td>
                          </tr>
                          <tr className="bg-gray-50/50">
                            <td colSpan="7" className="px-4 py-1 border-b">
                              <SourceManager
                                event={event}
                                allSources={allSources}
                                onLinkSource={(sourceId) => handleLinkSourceToEvent(event.originalIndex, sourceId)}
                                onUnlinkSource={(sourceId) => handleUnlinkSourceFromEvent(event.originalIndex, sourceId)}
                                onToggleDrawer={() => onOpenSourceDrawer(person.id, event.id)}
                                onNavigateToSource={onNavigateToSource}
                              />
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                  </tbody>
                </table>
              </section>
            </>
            )}
            {activePersonTab === 'relations' && (
              <section>
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Relationer</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Föräldrar */}
                  <div>
                    <h5 className="font-bold mb-2">Föräldrar</h5>
                    {(person.relations?.parents || []).length === 0 && <div className="text-gray-400 italic">Ingen förälder registrerad.</div>}
                    {(person.relations?.parents || []).map((parentRel, idx) => {
                      const parentId = typeof parentRel === 'object' ? parentRel.id : parentRel;
                      const parent = allPeople.find(p => p.id === parentId);
                      const status = typeof parentRel === 'object' ? parentRel.status : 'biologisk';
                      return (
                        <div key={parentId} className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-700">{parent ? `${parent.firstName} ${parent.lastName}` : parentId}</span>
                          <select
                            value={status || 'biologisk'}
                            onChange={e => {
                              const updatedParents = (person.relations.parents || []).map((pr, i) => i === idx ? { ...(typeof pr === 'object' ? pr : { id: pr }), status: e.target.value } : pr);
                              onChange({ ...person, relations: { ...person.relations, parents: updatedParents } });
                            }}
                            className="text-xs px-1 py-0.5 border rounded bg-white shadow"
                            style={{ width: 110 }}
                          >
                            <option value="biologisk">Biologisk</option>
                            <option value="adopterad">Adopterad</option>
                            <option value="styvbarn">Styvbarn</option>
                            <option value="fosterbarn">Fosterbarn</option>
                            <option value="okänd">Okänd</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  {/* Barn */}
                  <div>
                    <h5 className="font-bold mb-2">Barn</h5>
                    {(person.relations?.children || []).length === 0 && <div className="text-gray-400 italic">Inga barn registrerade.</div>}
                    {(person.relations?.children || []).map((childRel, idx) => {
                      const childId = typeof childRel === 'object' ? childRel.id : childRel;
                      const child = allPeople.find(p => p.id === childId);
                      const status = typeof childRel === 'object' ? childRel.status : 'biologisk';
                      return (
                        <div key={childId} className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-gray-700">{child ? `${child.firstName} ${child.lastName}` : childId}</span>
                          <select
                            value={status || 'biologisk'}
                            onChange={e => {
                              const updatedChildren = (person.relations.children || []).map((cr, i) => i === idx ? { ...(typeof cr === 'object' ? cr : { id: cr }), status: e.target.value } : cr);
                              onChange({ ...person, relations: { ...person.relations, children: updatedChildren } });
                            }}
                            className="text-xs px-1 py-0.5 border rounded bg-white shadow"
                            style={{ width: 110 }}
                          >
                            <option value="biologisk">Biologisk</option>
                            <option value="adopterad">Adopterad</option>
                            <option value="styvbarn">Styvbarn</option>
                            <option value="fosterbarn">Fosterbarn</option>
                            <option value="okänd">Okänd</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
          )}
          {activePersonTab === 'images' && (
            <ImageGallery
              source={{ ...person, images: allImages }}
              onEditSource={(updates) => onChange({ ...person, ...updates })}
              people={allPeople}
              onOpenEditModal={(personId) => onViewInFamilyTree ? onViewInFamilyTree(personId) : null}
            />
          )}
          {activePersonTab === 'notes' && (
            <section>
              <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Noteringar & Externa Länkar</h4>
              <Editor
                value={person.notes || ''}
                onChange={(e) => handleChange({ target: { name: 'notes', value: e.target.value } })}
                containerProps={{ style: { minHeight: '120px', maxHeight: '40vh', overflow: 'auto' } }}
                spellCheck={true} lang="sv"
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditPersonModal;