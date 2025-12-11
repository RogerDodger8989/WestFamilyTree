import React, { useState, useMemo, useRef, useEffect } from 'react';
import { getImageFromIDB, saveImageToIDB, deleteImageFromIDB } from './idb.js';
import { buildSourceString } from './parsing.js';
import { PLACE_TYPES } from './PlaceCatalog.jsx';
import { normalizeString } from './stringUtils.js';
import { useApp } from './AppContext';
// Enkel CSV-exportfunktion
function exportResidentsToCSV(residents, farmName) {
  if (!residents.length) return;
  const header = ['Förnamn', 'Efternamn', 'Händelsetyp', 'Datum', 'Beskrivning'];
  const rows = residents.map(({ person, event }) => [
    person.firstName,
    person.lastName,
    event.type,
    event.date || '',
    event.description ? event.description.replace(/\n/g, ' ') : ''
  ]);
  const csv = [header, ...rows].map(row => row.map(field => '"' + (field || '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${farmName || 'boendelista'}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// En enkel tidslinjevy för "Gårdsarkivet"
export default function FarmArchiveView({ places, people, allSources = [], onSavePlace = () => {}, onOpenPerson = () => {}, onViewInFamilyTree = () => {}, onNavigateToSource = () => {}, onOpenSourceDrawer = () => {}, onNavigateToPlace = () => {}, onOpenPlaceDrawer = () => {}, onOpenSourceInDrawer = () => {} }) {
    // Hjälpfunktion för att hämta källor för en event
    function getSourcesForEvent(event) {
      if (!event.sources || !Array.isArray(event.sources)) return [];
      return event.sources.map(srcId => allSources.find(s => s.id === srcId)).filter(Boolean);
    }
  // Filtrera ut platser av typ "Gård/Torp"
  const farmTypes = ['farm_manor', 'cottage'];
  const farms = useMemo(() =>
    (places || []).filter(p => farmTypes.includes(p.placeType)),
    [places]
  );

  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const selectedFarm = farms.find(f => f.id === selectedFarmId);
  const [farmImage, setFarmImage] = useState(null);
  const [editableNote, setEditableNote] = useState('');
  const [actionPromptPerson, setActionPromptPerson] = useState(null); // person object to prompt action for

  // Reuse labels from PLACE_TYPES when available

  // Filter state
  const [filterSurname, setFilterSurname] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterEventType, setFilterEventType] = useState('');

  // Ref för att scrolla till år på tidslinjen
  const timelineRef = useRef(null);

  // Hitta alla personer som har någon händelse kopplad till denna plats
  const { getPersonRelations } = useApp();

  const residents = useMemo(() => {
    if (!selectedFarm) return [];
    const result = [];
    (people || []).forEach(person => {
      (person.events || []).forEach(event => {
        // Accept multiple type variants (some data uses 'Födelse' vs 'Född', etc.)
        const acceptedTypes = ['Bosatt', 'Inflyttning', 'Utflyttning', 'Född', 'Födelse', 'Död', 'Begravning', 'Begravd'];
        const matchesType = acceptedTypes.includes((event.type || '').toString());
        // Match by placeId or by textual place match against common place fields
        const matchesPlaceId = event.placeId === selectedFarm.id;
        const placeText = (event.place || '') + '';
        const normalizedPlace = normalizeString(placeText);
        const farmTexts = [selectedFarm.specific, selectedFarm.village, selectedFarm.parish, selectedFarm.municipality, selectedFarm.region, selectedFarm.country].filter(Boolean).map(t => normalizeString(t));
        const matchesPlaceText = normalizedPlace && farmTexts.some(ft => ft && (normalizedPlace.includes(ft) || ft.includes(normalizedPlace)));

        if (matchesType && (matchesPlaceId || matchesPlaceText)) {
          result.push({ person, event });
        }
      });
    });
    // Sortera på datum om möjligt
    return result.sort((a, b) => (a.event.date || '').localeCompare(b.event.date || ''));
  }, [selectedFarm, people]);

  // Filtrera boende enligt filter
  const filteredResidents = useMemo(() => {
    return residents.filter(({ person, event }) => {
      if (filterSurname && !(person.lastName || '').toLowerCase().includes(filterSurname.toLowerCase())) return false;
      if (filterYear && !(event.date || '').includes(filterYear)) return false;
      if (filterEventType && event.type !== filterEventType) return false;
      return true;
    });
  }, [residents, filterSurname, filterYear, filterEventType]);

  // Relationship lookup among displayed residents
  const displayedPersonMap = useMemo(() => {
    const map = {};
    filteredResidents.forEach(({ person }) => { map[person.id] = person; });
    return map;
  }, [filteredResidents]);

  const relationshipsByPerson = useMemo(() => {
    const rel = {};
    const ids = Object.keys(displayedPersonMap);
    // Build parents map for each id using relation objects
    const parentsMap = {};
    ids.forEach(id => {
      const rels = getPersonRelations ? (getPersonRelations(id) || []) : [];
      parentsMap[id] = rels.filter(r => !r._archived && (r.type || '').toString().toLowerCase() === 'parent').map(r => (r.fromPersonId === id ? r.toPersonId : r.fromPersonId)).filter(Boolean);
    });
    ids.forEach(id => {
      const parents = (parentsMap[id] || []).filter(pid => ids.includes(pid)).map(pid => displayedPersonMap[pid]);
      const children = ids.filter(otherId => (parentsMap[otherId] || []).includes(id)).map(oid => displayedPersonMap[oid]);
      const siblings = ids.filter(otherId => otherId !== id && (parentsMap[otherId] || []).some(p => (parentsMap[id] || []).includes(p))).map(oid => displayedPersonMap[oid]);
      rel[id] = { parents, children, siblings };
    });
    return rel;
  }, [displayedPersonMap, getPersonRelations]);

  // Lista alla årtal som finns i boendehändelser
  const timelineYears = useMemo(() => {
    const years = new Set();
    residents.forEach(({ event }) => {
      const match = (event.date || '').match(/\d{4}/);
      if (match) years.add(match[0]);
    });
    return Array.from(years).sort();
  }, [residents]);

  // Scrolla till första boende med valt år
  const scrollToYear = (year) => {
    if (!timelineRef.current) return;
    const el = timelineRef.current.querySelector(`[data-year='${year}']`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  };

  // Load farm image + note when selection changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedFarm) {
        setFarmImage(null);
        setEditableNote('');
        return;
      }
      setEditableNote(selectedFarm.note || '');
      try {
        const base64 = await getImageFromIDB(`place-image-${selectedFarm.id}`);
        if (!cancelled) setFarmImage(base64);
      } catch (e) {
        console.warn('Failed loading farm image', e);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedFarm]);

  const handleImageFile = async (file) => {
    if (!file || !selectedFarm) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        await saveImageToIDB(`place-image-${selectedFarm.id}`, base64);
        setFarmImage(base64);
      } catch (e) { console.error(e); }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async () => {
    if (!selectedFarm) return;
    try {
      await deleteImageFromIDB(`place-image-${selectedFarm.id}`);
      setFarmImage(null);
    } catch (e) { console.error(e); }
  };

  const handleSaveNote = async () => {
    if (!selectedFarm) return;
    const updated = { ...selectedFarm, note: editableNote };
    onSavePlace(updated);
  };

  return (
    <div className="flex h-full">
      {/* Lista över gårdar/torp */}
      <aside className="w-80 border-r border-slate-700 bg-slate-800 p-2 overflow-y-auto">
        <h2 className="font-bold text-lg mb-2 text-slate-200">Gårdsarkivet</h2>
        <ul>
          {farms.map(farm => (
            <li key={farm.id} className="flex items-center justify-between">
              <button
                className={`flex-1 text-left px-2 py-1 rounded hover:bg-blue-100 ${farm.id === selectedFarmId ? 'bg-blue-200 font-bold' : ''}`}
                onClick={() => setSelectedFarmId(farm.id)}
              >
                {farm.specific || farm.village || farm.parish || farm.country}
              </button>
              <button title="Öppna i Platsregistret" className="ml-2 p-1 text-sm text-blue-600 hover:bg-blue-50 rounded" onClick={() => { if (typeof onNavigateToPlace === 'function') onNavigateToPlace(farm.id); if (typeof onOpenPlaceDrawer === 'function') onOpenPlaceDrawer(farm.id); }}>
                🔍
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {/* Tidslinje och filterpanel */}
      <main className="flex-1 p-6 overflow-y-auto">
        {selectedFarm ? (
          <>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-48 h-36 bg-slate-700 rounded border border-slate-600 flex items-center justify-center overflow-hidden">
                {farmImage ? (
                  <img src={farmImage} alt="Gårdsbild" className="object-cover w-full h-full" />
                ) : (
                  <div className="text-sm text-slate-400 p-2">Ingen bild</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{selectedFarm.specific || selectedFarm.village || selectedFarm.parish || selectedFarm.country}</h3>
                <div className="mb-2 text-slate-400">Platskategori: {PLACE_TYPES[selectedFarm.placeType]?.label || (selectedFarm.placeType || '').replace(/_/g, ' ')}</div>
                <div className="mb-2 text-sm text-slate-400">ID: {selectedFarm.id}</div>
                <div className="flex gap-2 mt-2">
                  <label className="p-2 bg-slate-700 rounded cursor-pointer text-sm text-slate-200">
                    Ladda upp bild
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageFile(e.target.files?.[0])} />
                  </label>
                  {farmImage && (
                    <button className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm" onClick={handleRemoveImage}>Ta bort bild</button>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-300 mb-1">Gårdsanteckning</label>
              <textarea value={editableNote} onChange={e => setEditableNote(e.target.value)} className="w-full p-2 border border-slate-600 rounded h-24 bg-slate-900 text-slate-200" placeholder="Skriv anteckningar eller berättelser om gården..."></textarea>
              <div className="mt-2 text-right">
                <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleSaveNote}>Spara anteckning</button>
              </div>
            </div>

            {actionPromptPerson && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black opacity-30" onClick={() => setActionPromptPerson(null)}></div>
                <div className="bg-slate-800 rounded shadow-lg p-4 z-10 w-96 border border-slate-700">
                  <div className="font-bold mb-3 text-slate-200">Vad vill du göra med {actionPromptPerson.firstName} {actionPromptPerson.lastName}?</div>
                  <div className="flex justify-end gap-2">
                    <button className="px-3 py-2 bg-slate-700 rounded text-slate-200 hover:bg-slate-600" onClick={() => setActionPromptPerson(null)}>Avbryt</button>
                    <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={() => { onViewInFamilyTree(actionPromptPerson.id); setActionPromptPerson(null); }}>Visa i släktträd</button>
                    <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={() => { onOpenPerson(actionPromptPerson.id); setActionPromptPerson(null); }}>Redigera personen</button>
                  </div>
                </div>
              </div>
            )}

            {/* Filterpanel och export */}
            <div className="flex flex-wrap gap-4 mb-6 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Filtrera efternamn</label>
                <input type="text" value={filterSurname} onChange={e => setFilterSurname(e.target.value)} className="p-2 border rounded w-32" placeholder="Efternamn..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Filtrera årtal</label>
                <input type="text" value={filterYear} onChange={e => setFilterYear(e.target.value)} className="p-2 border rounded w-24" placeholder="Årtal..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Händelsetyp</label>
                <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)} className="p-2 border rounded w-32">
                  <option value="">Alla</option>
                  <option value="Född">Född</option>
                  <option value="Död">Död</option>
                  <option value="Bosatt">Bosatt</option>
                  <option value="Inflyttning">Inflyttning</option>
                  <option value="Utflyttning">Utflyttning</option>
                </select>
              </div>
              {timelineYears.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Hoppa till år</label>
                  <div className="flex gap-1 flex-wrap">
                    {timelineYears.map(year => (
                      <button key={year} className="px-2 py-1 text-xs bg-slate-700 rounded hover:bg-blue-600 text-slate-300" onClick={() => { setFilterYear(year); scrollToYear(year); }}>{year}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 flex justify-end">
                <button
                  className="px-4 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700"
                  onClick={() => exportResidentsToCSV(filteredResidents, selectedFarm.specific || selectedFarm.village || selectedFarm.parish || selectedFarm.country)}
                  disabled={filteredResidents.length === 0}
                  title="Exportera boendelista som CSV"
                >
                  Exportera CSV
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 mb-6 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Filtrera efternamn</label>
                <input type="text" value={filterSurname} onChange={e => setFilterSurname(e.target.value)} className="p-2 border rounded w-32" placeholder="Efternamn..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Filtrera årtal</label>
                <input type="text" value={filterYear} onChange={e => setFilterYear(e.target.value)} className="p-2 border rounded w-24" placeholder="Årtal..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Händelsetyp</label>
                <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)} className="p-2 border rounded w-32">
                  <option value="">Alla</option>
                  <option value="Född">Född</option>
                  <option value="Död">Död</option>
                  <option value="Bosatt">Bosatt</option>
                  <option value="Inflyttning">Inflyttning</option>
                  <option value="Utflyttning">Utflyttning</option>
                </select>
              </div>
              {timelineYears.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Hoppa till år</label>
                  <div className="flex gap-1 flex-wrap">
                    {timelineYears.map(year => (
                      <button key={year} className="px-2 py-1 text-xs bg-slate-700 rounded hover:bg-blue-600 text-slate-300" onClick={() => { setFilterYear(year); scrollToYear(year); }}>{year}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Horisontell tidslinje */}
            <div className="overflow-x-auto mb-8" ref={timelineRef} style={{ whiteSpace: 'nowrap' }}>
              {filteredResidents.length > 0 ? (
                <div className="flex gap-6">
                  {filteredResidents.map(({ person, event }, i) => {
                    const year = (event.date || '').match(/\d{4}/)?.[0] || '';
                    return (
                      <div key={person.id + event.id} className="min-w-[220px] max-w-xs bg-blue-50 border border-blue-200 rounded-lg p-3 flex-shrink-0 relative" data-year={year}>
                        <button className="font-semibold text-blue-900 text-left" onClick={() => setActionPromptPerson(person)}>{person.firstName} {person.lastName}</button>
                        <div className="text-xs text-slate-400 mb-1">{event.type} {event.date ? '(' + event.date + ')' : ''}</div>
                        {event.description && <div className="text-xs text-slate-500 mb-1">{event.description}</div>}
                        {/* Visa källor */}
                        {getSourcesForEvent(event).length > 0 && (
                          <div className="text-xs text-blue-700 mt-1">
                            Källor: {getSourcesForEvent(event).map(src => (
                              <span key={src.id} className="mr-3">
                                <span className="cursor-pointer underline hover:text-blue-900" title={src.sourceString || src.archive} onClick={() => { onOpenSourceInDrawer(src.id, person.id, event.id); }}>
                                  {buildSourceString(src).split('\n')[0] /* first-line human label */}
                                </span>
                                {src.aid && (
                                  <a href={`https://www.arkivdigital.se/aid/show/${encodeURIComponent(src.aid)}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline" onClick={e => e.stopPropagation()} title={`Öppna AID ${src.aid} på ArkivDigital`}>
                                    (AID)
                                  </a>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Visa släktrelationer till andra boende på gården */}
                        {relationshipsByPerson[person.id] && (
                          <div className="text-xs text-slate-300 mt-2">
                            {relationshipsByPerson[person.id].parents.length > 0 && (
                              <div>Förälder: {relationshipsByPerson[person.id].parents.map(p => (
                                <span key={p.id} className="inline-flex items-center mr-2">
                                  <button className="underline text-blue-700 hover:text-blue-900 mr-1 text-xs" onClick={() => setActionPromptPerson(p)}>{p.firstName} {p.lastName}</button>
                                  <button title="Visa i släktträd" className="w-5 h-5 flex items-center justify-center text-blue-500 hover:text-blue-700" onClick={() => onViewInFamilyTree(p.id)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a1 1 0 00-1 1v3H6a1 1 0 00-1 1v2H3a1 1 0 000 2h2v2a1 1 0 001 1h2v3a1 1 0 002 0v-3h2a1 1 0 001-1v-2h2a1 1 0 000-2h-2V7a1 1 0 00-1-1h-3V3a1 1 0 00-1-1z"/></svg>
                                  </button>
                                </span>
                              ))}</div>
                            )}
                            {relationshipsByPerson[person.id].children.length > 0 && (
                              <div>Barn: {relationshipsByPerson[person.id].children.map(p => (
                                <span key={p.id} className="inline-flex items-center mr-2">
                                  <button className="underline text-blue-700 hover:text-blue-900 mr-1 text-xs" onClick={() => setActionPromptPerson(p)}>{p.firstName} {p.lastName}</button>
                                  <button title="Visa i släktträd" className="w-5 h-5 flex items-center justify-center text-blue-500 hover:text-blue-700" onClick={() => onViewInFamilyTree(p.id)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a1 1 0 00-1 1v3H6a1 1 0 00-1 1v2H3a1 1 0 000 2h2v2a1 1 0 001 1h2v3a1 1 0 002 0v-3h2a1 1 0 001-1v-2h2a1 1 0 000-2h-2V7a1 1 0 00-1-1h-3V3a1 1 0 00-1-1z"/></svg>
                                  </button>
                                </span>
                              ))}</div>
                            )}
                            {relationshipsByPerson[person.id].siblings.length > 0 && (
                              <div>Syskon: {relationshipsByPerson[person.id].siblings.map(p => (
                                <span key={p.id} className="inline-flex items-center mr-2">
                                  <button className="underline text-blue-700 hover:text-blue-900 mr-1 text-xs" onClick={() => setActionPromptPerson(p)}>{p.firstName} {p.lastName}</button>
                                  <button title="Visa i släktträd" className="w-5 h-5 flex items-center justify-center text-blue-500 hover:text-blue-700" onClick={() => onViewInFamilyTree(p.id)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a1 1 0 00-1 1v3H6a1 1 0 00-1 1v2H3a1 1 0 000 2h2v2a1 1 0 001 1h2v3a1 1 0 002 0v-3h2a1 1 0 001-1v-2h2a1 1 0 000-2h-2V7a1 1 0 00-1-1h-3V3a1 1 0 00-1-1z"/></svg>
                                  </button>
                                </span>
                              ))}</div>
                            )}
                          </div>
                        )}
                        <div className="absolute top-2 right-2 text-xs text-slate-500">{year}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-400 italic">Ingen boendehändelse matchar filtren.</div>
              )}
            </div>

            {/* Klassisk lista under tidslinjen */}
            <h4 className="font-bold mb-2">Boende (lista):</h4>
            {filteredResidents.length === 0 && <div className="text-slate-400 italic">Ingen boendehändelse registrerad.</div>}
            <ul className="space-y-2">
                  {filteredResidents.map(({ person, event }, i) => (
                <li key={person.id + event.id} className="border-b pb-2">
                  <div className="font-semibold"><button className="text-left" onClick={() => setActionPromptPerson(person)}>{person.firstName} {person.lastName}</button></div>
                  <div className="text-sm text-slate-400">{event.type} {event.date ? '(' + event.date + ')' : ''}</div>
                  {event.description && <div className="text-xs text-slate-500">{event.description}</div>}
                  {/* Visa källor */}
                  {getSourcesForEvent(event).length > 0 && (
                    <div className="text-xs text-blue-700 mt-1">
                      Källor: {getSourcesForEvent(event).map(src => (
                        <span key={src.id} className="mr-3">
                          <span className="font-medium cursor-pointer underline hover:text-blue-900" title={src.sourceString || src.archive} onClick={() => { onOpenSourceInDrawer(src.id, person.id, event.id); }}>
                            {buildSourceString(src).split('\n')[0]}
                          </span>
                          {src.aid && (
                            <a href={`https://www.arkivdigital.se/aid/show/${encodeURIComponent(src.aid)}`} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline" onClick={e => e.stopPropagation()} title={`Öppna AID ${src.aid} på ArkivDigital`}>
                              (AID)
                            </a>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                      {/* Släktrelationer i listan */}
                      {relationshipsByPerson[person.id] && (
                        <div className="text-xs text-slate-300 mt-1">
                          {relationshipsByPerson[person.id].parents.length > 0 && <div>Förälder: {relationshipsByPerson[person.id].parents.map(p => (
                            <span key={p.id} className="inline-flex items-center mr-2">
                              <button className="underline text-blue-700 hover:text-blue-900 mr-1 text-xs" onClick={() => onOpenPerson(p.id)}>{p.firstName} {p.lastName}</button>
                              <button title="Visa i släktträd" className="w-5 h-5 flex items-center justify-center text-blue-500 hover:text-blue-700" onClick={() => onViewInFamilyTree(p.id)}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a1 1 0 00-1 1v3H6a1 1 0 00-1 1v2H3a1 1 0 000 2h2v2a1 1 0 001 1h2v3a1 1 0 002 0v-3h2a1 1 0 001-1v-2h2a1 1 0 000-2h-2V7a1 1 0 00-1-1h-3V3a1 1 0 00-1-1z"/></svg>
                              </button>
                            </span>
                          ))}</div>}
                          {relationshipsByPerson[person.id].children.length > 0 && <div>Barn: {relationshipsByPerson[person.id].children.map(p => (
                            <span key={p.id} className="inline-flex items-center mr-2">
                              <button className="underline text-blue-700 hover:text-blue-900 mr-1 text-xs" onClick={() => onOpenPerson(p.id)}>{p.firstName} {p.lastName}</button>
                              <button title="Visa i släktträd" className="w-5 h-5 flex items-center justify-center text-blue-500 hover:text-blue-700" onClick={() => onViewInFamilyTree(p.id)}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a1 1 0 00-1 1v3H6a1 1 0 00-1 1v2H3a1 1 0 000 2h2v2a1 1 0 001 1h2v3a1 1 0 002 0v-3h2a1 1 0 001-1v-2h2a1 1 0 000-2h-2V7a1 1 0 00-1-1h-3V3a1 1 0 00-1-1z"/></svg>
                              </button>
                            </span>
                          ))}</div>}
                          {relationshipsByPerson[person.id].siblings.length > 0 && <div>Syskon: {relationshipsByPerson[person.id].siblings.map(p => (
                            <span key={p.id} className="inline-flex items-center mr-2">
                              <button className="underline text-blue-700 hover:text-blue-900 mr-1 text-xs" onClick={() => onOpenPerson(p.id)}>{p.firstName} {p.lastName}</button>
                              <button title="Visa i släktträd" className="w-5 h-5 flex items-center justify-center text-blue-500 hover:text-blue-700" onClick={() => onViewInFamilyTree(p.id)}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10 2a1 1 0 00-1 1v3H6a1 1 0 00-1 1v2H3a1 1 0 000 2h2v2a1 1 0 001 1h2v3a1 1 0 002 0v-3h2a1 1 0 001-1v-2h2a1 1 0 000-2h-2V7a1 1 0 00-1-1h-3V3a1 1 0 00-1-1z"/></svg>
                              </button>
                            </span>
                          ))}</div>}
                        </div>
                      )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="text-slate-400 italic mt-32">Välj en gård/torp till vänster för att se tidslinjen.</div>
        )}
      </main>
    </div>
  );
}
