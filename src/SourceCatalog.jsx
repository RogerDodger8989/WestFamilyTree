import React, { useState, useMemo, useLayoutEffect, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import ImageGallery from './ImageGallery.jsx';
import Editor from './MaybeEditor.jsx';
import Button from './Button.jsx';
import { User, Tag, X } from 'lucide-react'; 

// --- HJÄLPFUNKTIONER (Oförändrad) ---

function buildSimpleTree(sources) {
  const tree = {};

  for (const src of sources) {
    if (!src || !src.id) continue;

    // NIVÅ 1: ARKIV
    let topLevel = src.archiveTop;
    if (!topLevel) {
        if (src.archive === 'Arkiv Digital') topLevel = 'Arkiv Digital';
        else if (src.archive === 'Riksarkivet') topLevel = 'Riksarkivet';
        else topLevel = 'Övrigt';
    }

    if (!tree[topLevel]) tree[topLevel] = {};

    // SPECIALHANTERING FÖR AD / RA (4 Nivåer)
    if (topLevel === 'Arkiv Digital' || topLevel === 'Riksarkivet') {
        // NIVÅ 2: TITEL / ORT
        let titleLevel = src.title || "Okänd Titel";
        if (!tree[topLevel][titleLevel]) tree[topLevel][titleLevel] = {};

        // NIVÅ 3: VOLYM [ÅR]
        const vol = src.volume || 'Okänd volym';
        const date = src.date ? ` [${src.date}]` : ''; 
        let volLevel = vol + date;
        
        if (!tree[topLevel][titleLevel][volLevel]) tree[topLevel][titleLevel][volLevel] = [];

        // NIVÅ 4: BILD / SIDA (Lövet)
        let pageLabel = "";
        const parts = [];
        if (src.imagePage) {
            const isJustNumbers = /^\d+$/.test(src.imagePage);
            parts.push(isJustNumbers ? `Bild ${src.imagePage}` : src.imagePage);
        }
        if (src.page) {
            const isJustNumbers = /^\d+$/.test(src.page);
            parts.push(isJustNumbers ? `Sid ${src.page}` : src.page);
        }
        if (parts.length > 0) {
            pageLabel = parts.join(' / ');
        } else {
            pageLabel = src.aid || src.bildid || "Utan referens";
        }

        tree[topLevel][titleLevel][volLevel].push({ ...src, label: pageLabel });

    } else {
        // HANTERING FÖR ÖVRIGT (3 Nivåer)
        let bookLevel = src.title || "Namnlös källa";
        if (!tree[topLevel][bookLevel]) tree[topLevel][bookLevel] = [];

        let pageLabel = src.page || src.aid || src.imagePage || src.bildid;
        if (!pageLabel) {
            if (src.images && src.images.length > 0) pageLabel = "Bild";
            else pageLabel = "Källa (Allmän)";
        }
        
        tree[topLevel][bookLevel].push({ ...src, label: pageLabel });
    }
  }
  return tree;
}

function TrustDropdown({ value, onChange }) {
  return (
    <select className="border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={value || 0} onChange={e => onChange(Number(e.target.value))}>
      <option value={0}>☆ Ingen info</option>
      <option value={1}>★ Opålitlig</option>
      <option value={2}>★★ Tvivelaktig</option>
      <option value={3}>★★★ Andrahand</option>
      <option value={4}>★★★★ Förstahand</option>
    </select>
  );
}

// --- HUVUDKOMPONENT ---

export default function SourceCatalog({ 
    sources, 
    people, 
    places = [], 
    onDeleteSource, 
    onEditSource, 
    catalogState, 
    setCatalogState, 
    onCreateNewPerson, 
    onOpenEditModal, 
    isDrawerMode, 
    onLinkSource, 
    onNavigateToPlace,
    onAddSource,
    onOpenLinkPersonModal, 
    onUnlinkSourceFromEvent, 
    alreadyLinkedIds = [] 
}) {
  const { getAllTags } = useApp();
  const { selectedSourceId, expanded, searchTerm, sortOrder = 'name_asc' } = catalogState; 
  const [importString, setImportString] = useState(''); 
  const listContainerRef = useRef(null);

  // State för högerpanelens flikar ('info', 'images', 'notes')
  const [activeRightTab, setActiveRightTab] = useState('info');

  // Tag State (samma som MediaManager)
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const tagInputRef = useRef(null);

  // --- PARSER-LOGIK (Oförändrad) ---
  const parseSourceString = () => {
      if (!importString || !importString.trim()) return;
      const text = importString.trim();
      let updates = { trust: 4 }; 

      const upperText = text.toUpperCase();

      if (upperText.includes('AID:')) {
          updates.archiveTop = 'Arkiv Digital';
          updates.archive = 'Arkiv Digital';
          const aidMatch = text.match(/AID:\s*([a-zA-Z0-9\.]+)/i);
          if (aidMatch) updates.aid = aidMatch[1];
          const nadMatch = text.match(/NAD:\s*([a-zA-Z0-9\/]+)/i) || text.match(/SE\/[A-Z0-9\/]+/);
          if (nadMatch) updates.nad = nadMatch[0].replace(/NAD:\s*/i, '');
          const bildMatch = text.match(/Bild\s*(\d+)/i);
          if (bildMatch) updates.imagePage = bildMatch[1];
          const sidMatch = text.match(/sid\s*(\d+)/i);
          if (sidMatch) updates.page = sidMatch[1];
          const volMatch = text.match(/([A-Z]+\s*[A-Z]*:[a-z0-9]+)/i); 
          if (volMatch) updates.volume = volMatch[1];
          let bestMatch = null;
          if (places && places.length > 0) {
              for (const place of places) {
                  if (place && place.name && text.startsWith(place.name)) {
                      if (!bestMatch || place.name.length > bestMatch.name.length) {
                          bestMatch = place;
                      }
                  }
              }
          }
          if (bestMatch) updates.title = bestMatch.name; 
          else {
              const splitPoint = text.indexOf(updates.volume || '(');
              if (splitPoint > 0) updates.title = text.substring(0, splitPoint).trim();
              else updates.title = "Okänd Titel";
          }

      } else if (upperText.includes('BILDID:')) {
          updates.archiveTop = 'Riksarkivet';
          updates.archive = 'Riksarkivet';
          const bildIdMatch = text.match(/bildid:\s*([A-Z0-9_]+)/i);
          if (bildIdMatch) updates.bildid = bildIdMatch[1];
          const nadMatch = text.match(/(SE\/[\w]+\/\d+)/); 
          if (nadMatch) updates.nad = nadMatch[1];
          const raVolMatch = text.match(/SE\/[\w]+\/\d+\/([^(,]+)/);
          if (raVolMatch) updates.volume = raVolMatch[1].trim();
          const bildNrMatch = text.match(/_(\d+)$/);
          if (bildNrMatch) updates.imagePage = bildNrMatch[1];
          const commaParts = text.split(',');
          if (commaParts.length > 0) updates.title = commaParts[0].trim();
      }

      const dateMatch = text.match(/\((\d{4}[-–]\d{4})\)/) || text.match(/\((\d{4})\)/);
      if (dateMatch) updates.date = dateMatch[1];
      
      updates.note = ""; 

      const safeUpdate = {
          ...selectedSource,
          ...updates,
          title: updates.title || selectedSource.title || "",
          archive: updates.archive || selectedSource.archive || "",
          archiveTop: updates.archiveTop || selectedSource.archiveTop || "Övrigt",
          volume: updates.volume || selectedSource.volume || "",
          page: updates.page || selectedSource.page || "",
          aid: updates.aid || selectedSource.aid || "",
          nad: updates.nad || selectedSource.nad || "",
          bildid: updates.bildid || selectedSource.bildid || "",
          imagePage: updates.imagePage || selectedSource.imagePage || "",
          date: updates.date || selectedSource.date || "",
          note: updates.note, 
          tags: updates.tags || selectedSource.tags || "",
      };

      if (selectedSource) {
          onEditSource(safeUpdate);
          setImportString(''); 
      }
  };

  // --- SORTERING & FILTRERING (Oförändrad) ---
  const sortedSources = useMemo(() => {
    const copy = [...sources];
    switch (sortOrder) {
        case 'name_asc': return copy.sort((a, b) => (a.title || a.archive || '').localeCompare(b.title || b.archive || '', 'sv'));
        case 'name_desc': return copy.sort((a, b) => (b.title || b.archive || '').localeCompare(a.title || a.archive || '', 'sv'));
        case 'date_desc': return copy.sort((a, b) => new Date(b.dateModified || b.dateAdded || 0) - new Date(a.dateModified || a.dateAdded || 0));
        case 'date_asc': return copy.sort((a, b) => new Date(a.dateModified || a.dateAdded || 0) - new Date(b.dateModified || b.dateAdded || 0));
        default: return copy;
    }
  }, [sources, sortOrder]);

  const filteredSources = useMemo(() => {
    if (!searchTerm) return sortedSources;
    const lower = searchTerm.toLowerCase();
    return sortedSources.filter(s => 
      (s.title && s.title.toLowerCase().includes(lower)) ||
      (s.archive && s.archive.toLowerCase().includes(lower)) ||
      (s.page && s.page.toLowerCase().includes(lower)) ||
      (s.id && s.id.toLowerCase().includes(lower))
    );
  }, [sortedSources, searchTerm]);

  const tree = useMemo(() => buildSimpleTree(filteredSources), [filteredSources]);

  // --- EFFEKTER (Oförändrad) ---
  useLayoutEffect(() => {
    if (searchTerm) {
        const newExpanded = { ...expanded };
        let hasChanges = false;
        const expandRecursive = (node, prefix) => {
            if (Array.isArray(node)) return;
            Object.keys(node).forEach(key => {
                const path = prefix + key;
                if (!newExpanded[path]) { newExpanded[path] = true; hasChanges = true; }
                expandRecursive(node[key], path);
            });
        };
        expandRecursive(tree, "");
        if (hasChanges) setCatalogState(prev => ({ ...prev, expanded: newExpanded }));
    }
  }, [searchTerm, tree]); 

  useLayoutEffect(() => {
    if (!selectedSourceId) return;
    let foundPathKeys = [];
    const findPath = (node, currentKeys) => {
        if (Array.isArray(node)) {
            if (node.some(item => item.id === selectedSourceId)) return true;
            return false;
        }
        for (const key in node) {
            if (findPath(node[key], [...currentKeys, key])) {
                foundPathKeys = [...currentKeys, key];
                return true;
            }
        }
        return false;
    };
    findPath(tree, []);
    if (foundPathKeys.length > 0) {
        let currentPath = "";
        let newExpanded = { ...expanded };
        let hasChanges = false;
        for (const key of foundPathKeys) {
            currentPath += key;
            if (!newExpanded[currentPath]) {
                newExpanded[currentPath] = true;
                hasChanges = true;
            }
        }
        if (hasChanges) {
            setCatalogState(prev => ({ ...prev, expanded: newExpanded }));
            return;
        }
    }
    const element = document.getElementById(`source-item-${selectedSourceId}`);
    const container = listContainerRef.current;
    if (element && container) {
        const itemTop = element.offsetTop;
        const containerHeight = container.clientHeight;
        const itemHeight = element.clientHeight;
        container.scrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2);
        element.style.backgroundColor = "#fef08a"; 
        setTimeout(() => { if(element) { element.style.transition = "background-color 1s"; element.style.backgroundColor = ""; }}, 1000);
    }
  }, [selectedSourceId, tree, expanded]); 

  const handleSelect = (id) => setCatalogState(prev => ({ ...prev, selectedSourceId: id }));
  const handleToggle = (key) => setCatalogState(prev => ({ ...prev, expanded: { ...prev.expanded, [key]: !prev.expanded[key] } }));
  const handleSearch = (e) => setCatalogState(prev => ({ ...prev, searchTerm: e.target.value }));
  const handleSortChange = (e) => setCatalogState(prev => ({ ...prev, sortOrder: e.target.value }));
  const selectedSource = sources.find(s => s.id === selectedSourceId);
  const handleSave = (updatedFields) => { onEditSource({ ...selectedSource, ...updatedFields }); };

  // Tag-funktioner (samma som MediaManager)
  // Använd centraliserad tag-lista från AppContext (alla taggar i appen)
  // getAllTags kommer från useApp() och inkluderar taggar från personer, källor och media

  // Få förslag baserat på input (använder centraliserad tag-lista)
  const getTagSuggestions = (input) => {
    if (!input || input.trim().length === 0) return [];
    const allTags = getAllTags ? getAllTags() : [];
    const lowerInput = input.toLowerCase();
    
    // Hämta nuvarande taggar från selectedSource
    let currentTags = selectedSource?.tags || [];
    if (typeof currentTags === 'string' && currentTags.trim()) {
      currentTags = currentTags.split(',').map(t => t.trim()).filter(t => t);
    }
    if (!Array.isArray(currentTags)) {
      currentTags = [];
    }
    
    return allTags.filter(tag => 
      tag.toLowerCase().includes(lowerInput) && 
      !currentTags.includes(tag)
    ).slice(0, 5);
  };

  // Lägg till tagg
  const handleAddTag = (tagText) => {
    if (!tagText || tagText.trim().length === 0) return;
    if (!selectedSource) return;
    
    const tag = tagText.trim();
    
    // Hämta nuvarande taggar
    let currentTags = selectedSource.tags || [];
    if (typeof currentTags === 'string' && currentTags.trim()) {
      currentTags = currentTags.split(',').map(t => t.trim()).filter(t => t);
    }
    if (!Array.isArray(currentTags)) {
      currentTags = [];
    }
    
    // Kontrollera om taggen redan finns
    if (currentTags.includes(tag)) {
      setTagInput('');
      setTagSuggestions([]);
      return;
    }
    
    // Lägg till taggen
    const newTags = [...currentTags, tag];
    handleSave({ tags: newTags });
    
    setTagInput('');
    setTagSuggestions([]);
    
    // Fokusera tagg-input igen efter att taggen lagts till
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }, 50);
  };

  // Rensa tagg-input när källan ändras
  useEffect(() => {
    setTagInput('');
    setTagSuggestions([]);
  }, [selectedSourceId]);

  // --- HITTA KOPPLADE PERSONER (Memoized) ---
    // Grupp: personId -> { person, events: [], isLinkedToImageRegion, family }
    const linkedData = useMemo(() => {
        if (!selectedSourceId || !people) return [];
        const source = sources.find(s => s.id === selectedSourceId);
        const sourceImages = source?.images || [];
        const personMap = new Map();
        // Vanliga kopplingar
        people.forEach(p => {
            let events = [];
            let isLinkedToImageRegion = false;
            if (p.events) {
                p.events.forEach(ev => {
                    if (ev.sources && ev.sources.includes(selectedSourceId)) {
                        events.push(ev);
                    }
                });
            }
            // Bild-tagg
            if (sourceImages.length > 0) {
                const hasImageRegion = sourceImages.some(img => img.regions && img.regions.some(r => r.personId === p.id));
                if (hasImageRegion) {
                    isLinkedToImageRegion = true;
                    // Lägg till "Bild"-händelse om den inte redan finns
                    if (!events.some(e => e.type === 'Bild')) {
                        events.push({ type: 'Bild', id: 'img_' + p.id });
                    }
                }
            }
            if (events.length > 0) {
                personMap.set(p.id, {
                    person: p,
                    events,
                    isLinkedToImageRegion,
                    family: getFamilySuggestions(p, people, selectedSourceId)
                });
            }
        });
        return Array.from(personMap.values());
    }, [selectedSourceId, people, sources]);

  function hasSourceLinked(person, sourceId) {
      if (!person || !person.events) return false;
      return person.events.some(e => e.sources && e.sources.includes(sourceId));
  }

  function getFamilySuggestions(person, allPeople, sourceId) {
      const suggestions = [];
      const rels = person.relations || {};
      const addSugg = (id, role) => {
          const p = allPeople.find(x => x.id === id);
          if (p && !hasSourceLinked(p, sourceId)) {
              suggestions.push({ person: p, role });
          }
      };
      (rels.parents || []).forEach(id => addSugg(id, 'Förälder'));
      if (rels.spouseId) addSugg(rels.spouseId, 'Partner');
      (rels.children || []).forEach(id => addSugg(id, 'Barn'));
      (rels.siblings || []).forEach(id => addSugg(id, 'Syskon'));
      return suggestions;
  }

  const getLifeSpan = (p) => {
      const getYear = (type) => {
          const evt = p.events?.find(e => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
          return evt?.date ? evt.date.substring(0, 4) : '';
      };
      const b = getYear('BIRT');
      const d = getYear('DEAT');
      if (!b && !d) return '';
      return `(${b}-${d})`;
  };

  function translateEvent(type) {
      const map = {
          'BIRT': 'Födelse', 'DEAT': 'Död', 'CHR': 'Dop', 'BURI': 'Begravning',
          'MARR': 'Vigsel', 'DIV': 'Skilsmässa', 'OCCU': 'Yrke', 'RESI': 'Bosatt',
          'EDUC': 'Utbildning', 'CONF': 'Konfirmation', 'PROB': 'Bouppteckning',
          'CENS': 'Husförhör', 'EMIG': 'Utvandring', 'IMMI': 'Invandring'
      };
      return map[type] || type;
  }

  // --- HÄMTA NOTERINGAR (Oförändrad) ---
  const getNotesList = (source) => {
      if (!source) return [];
      if (source.notes && Array.isArray(source.notes)) return source.notes;
      if (source.note) return [{ id: 'legacy', text: source.note }];
      return [];
  };

  const currentNotes = selectedSource ? getNotesList(selectedSource) : [];
  const imagesCount = selectedSource?.images?.length || 0;
  const notesCount = currentNotes.length;

  // --- RENDER TREE (Oförändrad) ---
  const renderTreeNodes = (node, pathPrefix) => {
      if (Array.isArray(node)) {
          return (
            <div className="ml-5 border-l-2 border-slate-700 pl-1">
              {node.map(src => {
                const isLinked = alreadyLinkedIds.includes(src.id);
                return (
                    <div 
                      key={src.id}
                      id={`source-item-${src.id}`} 
                      onClick={() => handleSelect(src.id)}
                      onDoubleClick={() => { if (isDrawerMode && onLinkSource) onLinkSource(src.id); }}
                      className={`
                        cursor-pointer text-xs py-1 px-2 rounded truncate transition-colors duration-200 flex justify-between items-center group
                        ${selectedSourceId === src.id ? 'bg-blue-600 text-blue-100 font-medium border-l-2 border-blue-400 shadow-sm' : 'text-slate-400 hover:bg-slate-700'}
                        ${isLinked ? 'bg-green-900 text-green-200 border-l-2 border-green-500' : ''}
                      `}
                      title={`${src.label} (Dubbelklicka för att koppla)`}
                    >
                      <span className="truncate flex-1">{src.label}</span>
                      
                      {/* ACTION KNAPPAR */}
                                            <div className="flex gap-1 items-center ml-2 shrink-0">
                                                    <Button
                                                        onClick={(e) => { e.stopPropagation(); src.aid && window.open(`http://www.arkivdigital.se/aid/show/${src.aid}`, '_blank'); }}
                                                        variant={src.aid ? "success" : "ghost"}
                                                        size="xs"
                                                        title={src.aid ? "Öppna AID" : "Ingen AID"}
                                                        className={src.aid ? "" : "opacity-50 border border-slate-600"}
                                                    >AD</Button>
                                                    <Button
                                                        onClick={(e) => { e.stopPropagation(); src.bildid && window.open(`https://sok.riksarkivet.se/bildvisning/${src.bildid}`, '_blank'); }}
                                                        variant={src.bildid ? "success" : "ghost"}
                                                        size="xs"
                                                        title={src.bildid ? "Öppna RA" : "Ingen RA-länk"}
                                                        className={src.bildid ? "" : "opacity-50 border border-slate-600"}
                                                    >RA</Button>
                                                    <Button
                                                        onClick={(e) => { e.stopPropagation(); src.nad && window.open(`https://sok.riksarkivet.se/?postid=ArkisRef%20${src.nad}`, '_blank'); }}
                                                        variant={src.nad ? "success" : "ghost"}
                                                        size="xs"
                                                        title={src.nad ? "Öppna NAD" : "Ingen NAD-länk"}
                                                        className={src.nad ? "" : "opacity-50 border border-slate-600"}
                                                    >NAD</Button>
                                            </div>
                      {isLinked && <span className="text-green-400 font-bold ml-1 text-xs">✓</span>}
                    </div>
                );
              })}
            </div>
          );
      }
      return Object.keys(node).sort().map(key => {
          const currentPath = pathPrefix + key;
          const isExpanded = expanded[currentPath];
          return (
            <div key={key} className="mb-1 ml-2">
               <div className="flex items-center cursor-pointer hover:bg-slate-700 py-1 px-1 rounded font-semibold text-slate-100 text-sm transition-colors" onClick={() => handleToggle(currentPath)}>
                <span className="w-4 text-center text-xs text-slate-500 mr-1">{isExpanded ? '▼' : '▶'}</span>{key}
              </div>
              {isExpanded && renderTreeNodes(node[key], currentPath)}
            </div>
          );
      });
  };

  // Keyboard handler för DEL-tangenten
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedSourceId) {
        const selectedSource = sources.find(s => s.id === selectedSourceId);
        if (selectedSource && onDeleteSource) {
          if (confirm('Ta bort källa?')) {
            onDeleteSource(selectedSourceId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSourceId, sources, onDeleteSource]);

  return (
    <div className="flex w-full h-full bg-slate-800 overflow-hidden">
      <aside className="w-80 border-r border-slate-700 bg-slate-800 flex flex-col h-full shrink-0">
        <div className="p-2 border-b border-slate-700 bg-slate-900 space-y-2 shrink-0">
          <input type="text" placeholder="Sök..." className="w-full px-2 py-1 text-sm border border-slate-600 rounded bg-slate-900 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none shadow-sm" value={searchTerm || ''} onChange={handleSearch} />
          <select className="w-full px-2 py-1 text-xs border border-slate-600 rounded bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={sortOrder} onChange={handleSortChange}>
            <option value="name_asc">Namn (A-Ö)</option>
            <option value="name_desc">Namn (Ö-A)</option>
            <option value="date_desc">Senast ändrad (Nyast)</option>
            <option value="date_asc">Senast ändrad (Äldst)</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-2 relative" ref={listContainerRef}>
            {Object.keys(tree).sort().map(arkiv => (
                <div key={arkiv} className="mb-1">
                    <div className="flex items-center cursor-pointer hover:bg-slate-700 py-1 px-1 rounded font-bold text-blue-300 transition-colors" onClick={() => handleToggle(arkiv)}>
                        <span className="w-4 text-center text-xs text-slate-500 mr-1">{expanded[arkiv] ? '▼' : '▶'}</span>{arkiv}
                    </div>
                    {expanded[arkiv] && renderTreeNodes(tree[arkiv], arkiv)}
                </div>
            ))}
            {Object.keys(tree).length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm mt-10">
                    <p>Inga kilder hittades.</p>
                    {onAddSource && <Button onClick={onAddSource} variant="primary" size="sm">Skapa ny källa</Button>}
                </div>
            )}
        </div>
      </aside>

      <main className="flex-1 h-full bg-slate-800 flex flex-col">
        {selectedSource ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* HEADER (Oförändrad) */}
            <div className="p-6 pb-0 shrink-0">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">Redigera Källa</h2>
                        <div className="text-xs text-slate-400">ID: {selectedSource.id}</div>
                    </div>
                    <div className="flex gap-2">
                        {onAddSource && <Button onClick={onAddSource} variant="primary" size="sm">Ny källa</Button>}
                        {isDrawerMode && onLinkSource && <Button onClick={() => onLinkSource(selectedSource.id)} variant="success" size="sm">✓ Koppla källa</Button>}
                        <Button onClick={() => { if(confirm('Ta bort källa?')) onDeleteSource(selectedSource.id); }} variant="danger" size="sm">Ta bort källa</Button>
                    </div>
                </div>

                {/* SNABB-IMPORT (Oförändrad) */}
                <div className="mb-4 p-3 bg-slate-800 border border-slate-700 rounded">
                    <label className="block text-xs font-bold text-blue-300 uppercase mb-1">Snabb-import (AD/RA)</label>
                    <div className="flex gap-2">
                        <textarea className="flex-1 border border-slate-600 rounded p-1 text-xs h-8 resize-none focus:h-16 transition-all bg-slate-900 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Klistra in källtext..." value={importString} onChange={(e) => setImportString(e.target.value)} />
                        <Button onClick={parseSourceString} disabled={!importString} variant="primary" size="sm">Tolka</Button>
                    </div>
                </div>

                {/* FLIKAR (Oförändrad) */}
                <div className="flex border-b mt-4 bg-slate-900 rounded-t-lg shadow-sm">
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'info' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                        onClick={() => setActiveRightTab('info')}
                        title="Källinformation"
                    >
                        <span className="text-lg" role="img" aria-label="Info">ℹ️</span>
                        Info
                        {activeRightTab === 'info' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'images' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                        onClick={() => setActiveRightTab('images')}
                        title="Bilder"
                    >
                        <span className="text-lg" role="img" aria-label="Bilder">🖼️</span>
                        Bilder
                        {imagesCount > 0 && <span className="ml-1 bg-green-900 text-green-200 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{imagesCount}</span>}
                        {activeRightTab === 'images' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'notes' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                        onClick={() => setActiveRightTab('notes')}
                        title="Noteringar"
                    >
                        <span className="text-lg" role="img" aria-label="Noteringar">📝</span>
                        Noteringar
                        {notesCount > 0 && <span className="ml-1 bg-green-900 text-green-200 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{notesCount}</span>}
                        {activeRightTab === 'notes' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'connections' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                        onClick={() => setActiveRightTab('connections')}
                        title="Kopplingar"
                    >
                        <span className="text-lg" role="img" aria-label="Kopplingar">👥</span>
                        Kopplingar
                        {activeRightTab === 'connections' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-6">
                
                {activeRightTab === 'info' && (
                    <div>
                        {/* ... (Källdetaljer oförändrade) ... */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div><label className="block text-xs font-bold text-slate-300 uppercase">Arkiv (Top)</label><input className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.archiveTop || ''} onChange={e => handleSave({ archiveTop: e.target.value })} /></div>
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase">Titel / Ort</label>
                                <input className="w-full border border-slate-600 rounded px-2 py-1 font-semibold bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" list="places-datalist" value={selectedSource.title || ''} onChange={e => handleSave({ title: e.target.value })} />
                                <datalist id="places-datalist">{places.map(p => (<option key={p.id} value={p.name} />))}</datalist>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <div><label className="block text-xs font-bold text-slate-300 uppercase">Volym</label><input className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.volume || ''} onChange={e => handleSave({ volume: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-slate-300 uppercase">År</label><input className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.date || ''} onChange={e => handleSave({ date: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-slate-300 uppercase">Bild</label><input className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.imagePage || ''} onChange={e => handleSave({ imagePage: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-slate-300 uppercase">Sida/Källdetalj</label><input className="w-full border border-slate-600 rounded px-2 py-1 bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.page || ''} onChange={e => handleSave({ page: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-6 bg-slate-900 p-3 rounded border border-slate-700">
                            <div className="flex items-end gap-1"><div className="flex-1"><label className="block text-xs font-bold text-slate-300 uppercase">AID (AD)</label><input className="w-full border border-slate-600 rounded px-2 py-1 font-mono text-xs bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.aid || ''} onChange={e => handleSave({ aid: e.target.value })} /></div>{selectedSource.aid && (<Button onClick={() => window.open(`http://www.arkivdigital.se/aid/show/${selectedSource.aid}`, '_blank')} variant="success" size="xs">AD</Button>)}</div>
                            <div className="flex items-end gap-1"><div className="flex-1"><label className="block text-xs font-bold text-slate-300 uppercase">BildID (RA)</label><input className="w-full border border-slate-600 rounded px-2 py-1 font-mono text-xs bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.bildid || ''} onChange={e => handleSave({ bildid: e.target.value })} /></div>{selectedSource.bildid && (<Button onClick={() => window.open(`https://sok.riksarkivet.se/bildvisning/${selectedSource.bildid}`, '_blank')} variant="success" size="xs">RA</Button>)}</div>
                            <div className="flex items-end gap-1"><div className="flex-1"><label className="block text-xs font-bold text-slate-300 uppercase">NAD</label><input className="w-full border border-slate-600 rounded px-2 py-1 font-mono text-xs bg-slate-900 text-slate-200 focus:border-blue-500 focus:outline-none" value={selectedSource.nad || ''} onChange={e => handleSave({ nad: e.target.value })} /></div>{selectedSource.nad && (<Button onClick={() => window.open(`https://sok.riksarkivet.se/?postid=ArkisRef%20${selectedSource.nad}`, '_blank')} variant="success" size="xs">NAD</Button>)}</div>
                        </div>
                        <div className="mt-4 mb-6 space-y-4">
                           <div className="flex items-center gap-2"><label className="text-xs font-bold text-slate-300 uppercase">Trovärdighet:</label><TrustDropdown value={selectedSource.trust} onChange={v => handleSave({ trust: v })} /></div>
                           
                           {/* TAG-SEKTION (samma som MediaManager) */}
                           <div className="space-y-2">
                               <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Taggar</label>
                               
                               {/* Visade taggar */}
                               {(() => {
                                 let tags = selectedSource?.tags || [];
                                 if (typeof tags === 'string' && tags.trim()) {
                                   tags = tags.split(',').map(t => t.trim()).filter(t => t);
                                 }
                                 if (!Array.isArray(tags)) {
                                   tags = [];
                                 }
                                 
                                 return tags.length > 0 && (
                                   <div className="flex flex-wrap gap-2 mb-2">
                                     {tags.map((tag, idx) => (
                                       <span 
                                         key={idx} 
                                         className="bg-green-600/20 border border-green-500/50 text-green-300 text-xs px-2 py-1 rounded-full flex items-center gap-1.5 group hover:bg-green-600/30 transition-colors"
                                       >
                                         <span>{tag}</span>
                                         <button 
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             const newTags = tags.filter(t => t !== tag);
                                             handleSave({ tags: newTags });
                                           }}
                                           className="text-green-400 hover:text-red-400 transition-colors ml-0.5"
                                           title="Ta bort tagg"
                                         >
                                           <X size={12}/>
                                         </button>
                                       </span>
                                     ))}
                                   </div>
                                 );
                               })()}
                               
                               {/* Input för nya taggar */}
                               <div className="relative">
                                   <input
                                       ref={tagInputRef}
                                       type="text"
                                       placeholder="Skriv eller välj tagg..."
                                       className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                       value={tagInput}
                                       onChange={(e) => {
                                           setTagInput(e.target.value);
                                           setTagSuggestions(getTagSuggestions(e.target.value));
                                       }}
                                       onKeyDown={(e) => {
                                           if (e.key === 'Enter' || e.key === ',') {
                                               e.preventDefault();
                                               e.stopPropagation();
                                               const trimmed = tagInput.trim();
                                               if (trimmed) {
                                                   handleAddTag(trimmed);
                                               }
                                           }
                                       }}
                                       onClick={(e) => {
                                           e.stopPropagation();
                                       }}
                                       onFocus={(e) => {
                                           e.stopPropagation();
                                           e.target.select();
                                           if (tagInput) {
                                               setTagSuggestions(getTagSuggestions(tagInput));
                                           }
                                       }}
                                       onBlur={() => {
                                           setTimeout(() => setTagSuggestions([]), 200);
                                       }}
                                       autoComplete="off"
                                   />
                                   
                                   {/* Autocomplete dropdown */}
                                   {tagSuggestions.length > 0 && tagInput && (
                                       <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-40 overflow-y-auto">
                                           {tagSuggestions.map((suggestion, idx) => (
                                               <button
                                                   key={idx}
                                                   onClick={(e) => {
                                                       e.preventDefault();
                                                       handleAddTag(suggestion);
                                                       setTagInput('');
                                                       setTagSuggestions([]);
                                                   }}
                                                   className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                                               >
                                                   <Tag size={12} className="text-slate-500" />
                                                   <span>{suggestion}</span>
                                               </button>
                                           ))}
                                       </div>
                                   )}
                               </div>
                               
                               <p className="text-[10px] text-slate-500">Tryck Enter eller "," för att lägga till tagg</p>
                           </div>
                        </div>
                    </div>
                )}

                {/* --- FLIK: BILDER --- */}
                {activeRightTab === 'images' && (
                    <div>
                        <ImageGallery 
                            source={selectedSource} 
                            onEditSource={handleSave} 
                            people={people} 
                            onOpenEditModal={onOpenEditModal} 
                        />
                    </div>
                )}

                {/* --- FLIK: NOTERINGAR (Oförändrad) --- */}
                {activeRightTab === 'notes' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-200">Anteckningar</h3>
                            <Button 
                                onClick={() => {
                                    const newNote = { id: `note_${Date.now()}`, text: '', created: new Date().toISOString() };
                                    const newNotes = [...currentNotes, newNote];
                                    handleSave({ notes: newNotes });
                                }}
                                variant="primary"
                                size="sm"
                            >
                                + Ny anteckning
                            </Button>
                        </div>
                        
                        <div className="space-y-4">
                            {currentNotes.map((note, idx) => (
                                <div key={note.id || idx} className="border border-slate-700 rounded bg-slate-900 shadow-sm p-3">
                                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                                        <span>{note.created ? new Date(note.created).toLocaleDateString() : 'Importerad'}</span>
                                        <Button 
                                            onClick={() => {
                                                if(confirm('Ta bort anteckning?')) {
                                                    const newNotes = currentNotes.filter((_, i) => i !== idx);
                                                    handleSave({ notes: newNotes });
                                                }
                                            }}
                                            variant="danger" 
                                            size="xs"
                                        >
                                            Ta bort
                                        </Button>
                                    </div>
                                    <Editor
                                        value={note.text || ''}
                                        onChange={(e) => {
                                            const newNotes = [...currentNotes];
                                            newNotes[idx] = { ...note, text: e.target.value };
                                            handleSave({ notes: newNotes });
                                        }}
                                        containerProps={{ style: { minHeight: '100px' } }}
                                    />
                                </div>
                            ))}
                            {currentNotes.length === 0 && <div className="text-center text-slate-400 italic py-10">Inga anteckningar än.</div>}
                        </div>
                    </div>
                )}

                {/* --- FLIK: KOPPLINGAR --- */}
                {activeRightTab === 'connections' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-200">Kopplade Människor & Händelser</h3>
                            {onOpenLinkPersonModal && (
                                <Button onClick={() => onOpenLinkPersonModal(null)} variant="primary" size="sm">
                                    <span>+</span> Koppla person
                                </Button>
                            )}
                        </div>
                        {linkedData.length === 0 ? (
                            <p className="text-slate-400 text-sm italic text-center py-4">Inga personer är kopplade till denna källa än.</p>
                        ) : (
                            <div className="space-y-6">
                                {linkedData.map((item, index) => (
                                    <div key={index} className="bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
                                        <div className="flex items-center p-3 bg-slate-800 border-b border-slate-700 hover:bg-slate-700 transition-colors">
                                            {/* Rund thumbnail till vänster */}
                                            <div className="w-10 h-10 rounded-full bg-slate-600 flex-shrink-0 overflow-hidden border-2 border-slate-500 mr-3">
                                                {item.person.media && item.person.media.length > 0 ? (
                                                    <img 
                                                        src={item.person.media[0].url} 
                                                        alt={`${item.person.firstName} ${item.person.lastName}`} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                ) : (
                                                    <User className="w-full h-full p-2 text-slate-400" />
                                                )}
                                            </div>
                                            
                                            {item.isLinkedToImageRegion && (
                                                <span className="text-green-600 mr-2" title="Personen är taggad i en bild från denna källa">🖼️</span>
                                            )}
                                            <div className="w-12 text-xs font-mono text-slate-500">#{item.person.refNumber}</div>
                                            <div className="flex-1 font-bold text-blue-400 cursor-pointer hover:underline" onClick={() => onOpenEditModal && onOpenEditModal(item.person.id)}>
                                                {item.person.firstName} {item.person.lastName}
                                                <span className="font-normal text-slate-400 ml-2 text-xs">{getLifeSpan(item.person)}</span>
                                            </div>
                                            <div className="w-48 text-sm font-medium px-2 bg-slate-700 rounded py-0.5 mr-4 flex flex-wrap gap-2 justify-end">
                                                {item.events.map(ev => (
                                                    <span key={ev.id || ev.type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-200 text-green-900 rounded text-xs font-semibold">
                                                        {translateEvent(ev.type)}
                                                        {onUnlinkSourceFromEvent && (
                                                            <button
                                                                onClick={() => { if(confirm(`Ta bort koppling?`)) onUnlinkSourceFromEvent(item.person.id, ev.id, selectedSource.id); }}
                                                                className="ml-1 text-green-900 hover:text-white hover:bg-green-600 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                                                                title={`Ta bort koppling till ${translateEvent(ev.type)}`}
                                                                style={{ lineHeight: 1, fontSize: '13px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {item.family && item.family.length > 0 && (
                                            <div className="bg-slate-900 p-2 pl-12 border-t border-dashed border-slate-700">
                                                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Relaterade familjemedlemmar (Tips)</div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {item.family.map((fam, fIndex) => (
                                                        <div key={fIndex} className="flex items-center justify-between group hover:bg-slate-800 p-1 rounded">
                                                            <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-400 w-16 text-right">{fam.role}:</span><span className="text-slate-300 cursor-pointer hover:text-blue-400" onClick={() => onOpenEditModal && onOpenEditModal(fam.person.id)}>{fam.person.firstName} {fam.person.lastName}</span><span className="text-xs text-slate-500">{getLifeSpan(fam.person)}</span></div>
                                                            {onOpenLinkPersonModal && (
                                                                <button
                                                                    onClick={() => onOpenLinkPersonModal(fam.person.id)}
                                                                    className="opacity-0 group-hover:opacity-100 bg-blue-600 text-blue-100 px-2 py-0.5 rounded text-xs font-semibold hover:bg-blue-500 transition-opacity"
                                                                >
                                                                    Koppla
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <p className="mb-2">← Välj en källa i listan</p>
            {onAddSource && <Button onClick={onAddSource} variant="primary" size="md">Skapa ny källa</Button>}
          </div>
        )}
      </main>
    </div>
  );
}