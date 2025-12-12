import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, User, Users, Image as ImageIcon, FileText, 
  Activity, Tag, Plus, Trash2, Calendar, MapPin, 
  Link as LinkIcon, Camera, Edit3, AlertCircle, Check, 
  ChevronDown, MoreHorizontal, Search, Globe
} from 'lucide-react';
import WindowFrame from './WindowFrame.jsx';
import PlacePicker from './PlacePicker.jsx';
import ImageViewer from './ImageViewer.jsx';
import Editor from './MaybeEditor.jsx';
import MediaSelector from './MediaSelector.jsx';

// --- KONSTANTER ---

const RELATION_TYPES = {
  parent: ['Biologisk', 'Adoptiv', 'Fosterförälder', 'Styvförälder'],
  partner: ['Gift', 'Sambo', 'Förlovad', 'Skild', 'Okänd'],
  child: ['Biologiskt', 'Adoptivbarn', 'Fosterbarn', 'Styvbarn']
};

const PRIORITY_LEVELS = [
  { level: 0, label: 'Ingen prio', color: 'text-slate-400' },
  { level: 1, label: 'Låg prio', color: 'text-green-400' },
  { level: 2, label: 'Mellan prio', color: 'text-yellow-400' },
  { level: 3, label: 'Hög prio', color: 'text-orange-400' },
  { level: 4, label: 'Mycket hög prio', color: 'text-red-400' },
  { level: 5, label: 'Extremt hög prio', color: 'text-red-600 font-bold' },
];

const EVENT_TYPES = [
  { value: 'Adoption', label: 'Adoption', icon: '❤️', unique: false },
  { value: 'Alternativt namn', label: 'Alternativt namn', icon: '💬', unique: false },
  { value: 'Annulering av vigsel', label: 'Annulering av vigsel', icon: '💔', unique: false },
  { value: 'Antal barn', label: 'Antal barn', icon: '👶', unique: false },
  { value: 'Antal äktenskap', label: 'Antal äktenskap', icon: '💍', unique: false },
  { value: 'Arkivering av skilsmässa', label: 'Arkivering av skilsmässa', icon: '📁', unique: false },
  { value: 'Bar mitzvah', label: 'Bar mitzvah', icon: '🕎', unique: true },
  { value: 'Begravning', label: 'Begravning', icon: '⚰️', unique: true },
  { value: 'Bosatt', label: 'Bosatt', icon: '🏠', unique: false },
  { value: 'Bouppteckning', label: 'Bouppteckning', icon: '✍️', unique: false },
  { value: 'Dop', label: 'Dop', icon: '💧', unique: true },
  { value: 'Dop som vuxen', label: 'Dop som vuxen', icon: '💧', unique: true },
  { value: 'Död', label: 'Död', icon: '✝️', unique: true },
  { value: 'Egen händelse', label: 'Egen händelse', icon: '📅', unique: false },
  { value: 'Egendom', label: 'Egendom', icon: '📋', unique: false },
  { value: 'Emigration', label: 'Emigration', icon: '➡️', unique: false },
  { value: 'Examen', label: 'Examen', icon: '🎓', unique: false },
  { value: 'Faktauppgift', label: 'Faktauppgift', icon: '✝️', unique: false },
  { value: 'Folkräkning', label: 'Folkräkning', icon: '📋', unique: false },
  { value: 'Fysisk status', label: 'Fysisk status', icon: '✓', unique: false },
  { value: 'Födelse', label: 'Födelse', icon: '👶', unique: true },
  { value: 'Förlovning', label: 'Förlovning', icon: '💐', unique: false },
  { value: 'Första nattvarden', label: 'Första nattvarden', icon: '🍞', unique: true },
  { value: 'Immigration', label: 'Immigration', icon: '⬅️', unique: false },
  { value: 'Kast', label: 'Kast', icon: '👤', unique: false },
  { value: 'Konfirmation', label: 'Konfirmation', icon: '🙏', unique: true },
  { value: 'Kremering', label: 'Kremering', icon: '🔥', unique: true },
  { value: 'Lysning', label: 'Lysning', icon: '📢', unique: false },
  { value: 'Militärtjänst', label: 'Militärtjänst', icon: '⚔️', unique: false },
  { value: 'Nationalitet', label: 'Nationalitet', icon: '🏴', unique: false },
  { value: 'Naturalisering', label: 'Naturalisering', icon: '🤝', unique: false },
  { value: 'Notering', label: 'Notering', icon: '📝', unique: false },
  { value: 'Pensionering', label: 'Pensionering', icon: '💰', unique: false },
  { value: 'Personnummer', label: 'Personnummer', icon: '📋', unique: false },
  { value: 'Prästvigling', label: 'Prästvigling', icon: '⛪', unique: false },
  { value: 'Religionstillhörighet', label: 'Religionstillhörighet', icon: '⚙️', unique: false },
  { value: 'Samlevnad', label: 'Samlevnad', icon: '🤝', unique: false },
  { value: 'Samvetsäktenskap', label: 'Samvetsäktenskap', icon: '💕', unique: false },
  { value: 'Skilsmässa', label: 'Skilsmässa', icon: '💔', unique: false },
  { value: 'Socialförsäkringsnummer', label: 'Socialförsäkringsnummer', icon: '📋', unique: false },
  { value: 'Testamente', label: 'Testamente', icon: '📜', unique: false },
  { value: 'Titel', label: 'Titel', icon: '💬', unique: false },
  { value: 'Troendedop', label: 'Troendedop', icon: '💧', unique: true },
  { value: 'Utbildning', label: 'Utbildning', icon: '📚', unique: false },
  { value: 'Vigsel', label: 'Vigsel', icon: '💒', unique: false },
  { value: 'Välsignelse', label: 'Välsignelse', icon: '🙏', unique: false },
  { value: 'Yrke', label: 'Yrke', icon: '💼', unique: false }
];

// Smart datumformatterare med stöd för olika format och prefix
const parseAndFormatDate = (input) => {
  if (!input || !input.trim()) return '';
  
  const original = input.trim();
  let prefix = '';
  let dateStr = original;
  
  // Hantera prefix (från, omkring, till, mellan)
  const prefixMatch = original.match(/^(från|omkring|ca|c|till|före|efter|mellan)\s+/i);
  if (prefixMatch) {
    const p = prefixMatch[1].toLowerCase();
    if (p === 'från') prefix = 'från ';
    else if (p === 'omkring' || p === 'ca' || p === 'c') prefix = 'ca ';
    else if (p === 'till' || p === 'före') prefix = 'före ';
    else if (p === 'efter') prefix = 'efter ';
    else if (p === 'mellan') prefix = 'mellan ';
    dateStr = original.substring(prefixMatch[0].length);
  }
  
  // Hantera "från-till" intervall
  if (dateStr.includes('-') && !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parts = dateStr.split('-').map(s => s.trim());
    if (parts.length === 2) {
      return `${parseDate(parts[0])} - ${parseDate(parts[1])}`;
    }
  }
  
  return prefix + parseDate(dateStr);
};

const parseDate = (input) => {
  if (!input) return '';
  
  const cleaned = input.trim();
  
  // Redan i rätt format (ÅÅÅÅ-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  
  // Format: ÅÅÅÅMMDD (8 siffror utan separator) - t.ex. 20090401
  if (/^\d{8}$/.test(cleaned)) {
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  // Månadsmappning
  const months = {
    'jan': '01', 'januari': '01',
    'feb': '02', 'februari': '02',
    'mar': '03', 'mars': '03',
    'apr': '04', 'april': '04',
    'maj': '05', 'may': '05',
    'jun': '06', 'juni': '06',
    'jul': '07', 'juli': '07',
    'aug': '08', 'augusti': '08',
    'sep': '09', 'september': '09',
    'okt': '10', 'oktober': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };
  
  // Format: 21 nov 1980, 21 november 1980
  const monthNameMatch = cleaned.match(/(\d{1,2})\s+([a-zå-ö]+)\s+(\d{4})/i);
  if (monthNameMatch) {
    const day = monthNameMatch[1].padStart(2, '0');
    const monthName = monthNameMatch[2].toLowerCase();
    const year = monthNameMatch[3];
    const month = months[monthName];
    if (month) return `${year}-${month}-${day}`;
  }
  
  // Format: 21/11/1980, 21.11.1980, 21-11-1980
  const numericMatch = cleaned.match(/(\d{1,2})[\/\.\-\s](\d{1,2})[\/\.\-\s](\d{4})/);
  if (numericMatch) {
    const day = numericMatch[1].padStart(2, '0');
    const month = numericMatch[2].padStart(2, '0');
    const year = numericMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Format: 1980-11-21 (redan ok)
  const isoMatch = cleaned.match(/(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Bara årtal
  if (/^\d{4}$/.test(cleaned)) return cleaned;
  
  // Kunde inte tolka - returnera original
  return input;
};

// Enkel datumformatterare (gammal)
const standardizeDate = (input) => {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return input;
};

// --- SUB-COMPONENTS ---

const EditorToolbar = () => (
  <div className="flex gap-1 bg-slate-800 p-1 rounded-t border-b border-slate-700 mb-0">
    {['B', 'I', 'U'].map(cmd => (
      <button key={cmd} className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-xs font-bold text-slate-300">
        {cmd}
      </button>
    ))}
    <div className="w-px h-4 bg-slate-600 mx-1 self-center"></div>
    <button className="px-2 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-xs text-slate-300">H1</button>
    <button className="px-2 h-6 flex items-center justify-center hover:bg-slate-700 rounded text-xs text-slate-300">Lista</button>
  </div>
);

// Sub-modal för att lägga till källa
const SourceModal = ({ isOpen, onClose, onAdd, eventType }) => {
  const [source, setSource] = useState({
    type: 'Arkiv',
    title: '',
    author: '',
    year: '',
    citation: '',
    url: ''
  });

  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 250, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.modal-header')) {
      setIsDragging(true);
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleAdd = () => {
    if (source.title.trim()) {
      onAdd(source);
      setSource({ type: 'Arkiv', title: '', author: '', year: '', citation: '', url: '' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4100] flex items-center justify-center bg-black/30">
      <div 
        ref={modalRef}
        className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md p-0 overflow-hidden"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxWidth: '500px'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="modal-header bg-slate-900 p-4 border-b border-slate-700 flex justify-between items-center cursor-move">
          <h3 className="font-bold text-white">Lägg till källa</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Källtyp</label>
            <select 
              value={source.type} 
              onChange={e => setSource({...source, type: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option>Arkiv</option>
              <option>Bok</option>
              <option>Artikel</option>
              <option>Webb</option>
              <option>Familjebok</option>
              <option>Övrigt</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Titel</label>
            <input 
              type="text"
              value={source.title}
              onChange={e => setSource({...source, title: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Källans titel"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Författare</label>
            <input 
              type="text"
              value={source.author}
              onChange={e => setSource({...source, author: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none"
              placeholder="Namn"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">År</label>
            <input 
              type="text"
              value={source.year}
              onChange={e => setSource({...source, year: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:border-blue-500 focus:outline-none"
              placeholder="ÅÅÅÅ"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Citat/Referens</label>
            <textarea
              value={source.citation}
              onChange={e => setSource({...source, citation: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:border-blue-500 focus:outline-none resize-none"
              rows="3"
              placeholder="Relevanta citat eller sidnummer"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">URL (valfritt)</label>
            <input 
              type="url"
              value={source.url}
              onChange={e => setSource({...source, url: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:border-blue-500 focus:outline-none"
              placeholder="https://..."
            />
          </div>
        </div>
        <div className="bg-slate-900 p-4 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Avbryt</button>
          <button 
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
          >
            Lägg till källa
          </button>
        </div>
      </div>
    </div>
  );
};

// --- HUVUDKOMPONENT ---

export default function EditPersonModal({ person: initialPerson, allPlaces, onSave, onClose, onOpenSourceDrawer, allSources, allPeople, onOpenEditModal, allMediaItems = [], onUpdateAllMedia = () => {} }) {
    // Relation linking modal state
    const [relationModalOpen, setRelationModalOpen] = useState(false);
    const [relationTypeToAdd, setRelationTypeToAdd] = useState(null);
    const [relationSearch, setRelationSearch] = useState('');
    const [relationSearchIndex, setRelationSearchIndex] = useState(0);
    const [relationSortBy, setRelationSortBy] = useState('name'); // 'name', 'recent', 'related'

    // Open relation picker modal
    const openRelationModal = (type) => {
      setRelationTypeToAdd(type);
      setRelationModalOpen(true);
      setRelationSearch('');
      setRelationSearchIndex(0);
      setRelationSortBy('name');
    };

    // Generell funktion: Säkerställ att alla föräldrar till samma barn är partners
    const ensureParentsArePartners = (childId, currentPersonId, currentPersonRelations) => {
      if (!childId || !currentPersonId) return currentPersonRelations;
      
      const child = allPeople.find(p => p.id === childId);
      if (!child) return currentPersonRelations;
      
      // Hämta alla föräldrar till barnet
      const childParentsFromChild = (child.relations?.parents || [])
        .map(p => typeof p === 'object' ? p.id : p)
        .filter(Boolean);
      
      // Hitta andra personer som har detta barn i sin children-lista
      const childParentsFromOthers = allPeople
        .filter(p => p.id !== currentPersonId && p.relations?.children)
        .filter(p => {
          const children = (p.relations.children || []).map(c => typeof c === 'object' ? c.id : c);
          return children.includes(childId);
        })
        .map(p => p.id);
      
      // Kombinera alla föräldrar (inklusive den nuvarande personen om de lägger till sig själv som förälder)
      const allParents = [...new Set([...childParentsFromChild, ...childParentsFromOthers, currentPersonId])]
        .filter(Boolean);
      
      // Om barnet har fler än en förälder, säkerställ att alla är partners med varandra
      if (allParents.length > 1) {
        const rels = { ...currentPersonRelations };
        if (!rels.partners) rels.partners = [];
        
        allParents.forEach(parentId => {
          if (parentId === currentPersonId) return; // Skippa sig själv
          
          const otherParent = allPeople.find(p => p.id === parentId);
          if (!otherParent) return;
          
          // Kolla om de redan är partners
          const alreadyPartners = rels.partners.some(p => 
            (typeof p === 'object' ? p.id : p) === parentId
          );
          
          if (!alreadyPartners) {
            rels.partners.push({ 
              id: parentId, 
              name: `${otherParent.firstName} ${otherParent.lastName}`,
              type: 'Okänd' // Sätt som "Okänd" som standard
            });
          }
        });
        
        return rels;
      }
      
      return currentPersonRelations;
    };

    // Add selected person as relation
    const addRelation = (personId) => {
      const selected = allPeople.find(p => p.id === personId);
      if (!selected) return;
      setPerson(prev => {
        const rels = { ...prev.relations };
        if (!rels[relationTypeToAdd]) rels[relationTypeToAdd] = [];
        // Prevent duplicates
        if (!rels[relationTypeToAdd].some(r => r.id === selected.id)) {
          rels[relationTypeToAdd].push({ id: selected.id, name: `${selected.firstName} ${selected.lastName}` });
        }
        
        // Automatisk partner-relation: Säkerställ att alla föräldrar till samma barn är partners
        if (relationTypeToAdd === 'children') {
          // När man lägger till ett barn: säkerställ att alla föräldrar till detta barn är partners
          const updatedRels = ensureParentsArePartners(personId, prev.id, rels);
          return { ...prev, relations: updatedRels };
        } else if (relationTypeToAdd === 'parents') {
          // När man lägger till en förälder på ett barn, lägg bara till föräldern
          // Partner-relationer mellan föräldrarna skapas automatiskt när man sparar (i App.jsx)
          // Här ska vi bara lägga till föräldern, inget mer
        }
        
        return { ...prev, relations: rels };
      });
      setRelationModalOpen(false);
      setRelationTypeToAdd(null);
      setRelationSearch('');
      setRelationSearchIndex(0);
    };

    // Remove relation
    const removeRelation = (type, id) => {
      setPerson(prev => {
        const rels = { ...prev.relations };
        rels[type] = rels[type].filter(r => r.id !== id);
        return { ...prev, relations: rels };
      });
    };
  const [activeTab, setActiveTab] = useState('info');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef(null);

  // Helper: Få födelse- och dödsdata från events
  const getLifeInfo = (personData) => {
    if (!personData || !personData.events) {
      return { birthYear: null, deathYear: null, lifeSpan: null };
    }

    const birthEvent = personData.events.find(e => e.type === 'Födelse');
    const deathEvent = personData.events.find(e => e.type === 'Död');

    const birthYear = birthEvent && birthEvent.date ? birthEvent.date.substring(0, 4) : null;
    const deathYear = deathEvent && deathEvent.date ? deathEvent.date.substring(0, 4) : null;

    let lifeSpan = null;
    if (birthYear && deathYear) {
      lifeSpan = parseInt(deathYear) - parseInt(birthYear);
    }

    return { birthYear, deathYear, lifeSpan };
  };

  // Helper: Hämta födelse- och dödsdatum med plats för personväljaren
  const getPersonLifeDetails = (personData) => {
    if (!personData || !personData.events) {
      return { birthDate: '', birthPlace: '', deathDate: '', deathPlace: '' };
    }

    const birthEvent = personData.events.find(e => e.type === 'Födelse');
    const deathEvent = personData.events.find(e => e.type === 'Död');

    const birthDate = birthEvent?.date || '';
    const birthPlace = birthEvent?.place || '';
    const deathDate = deathEvent?.date || '';
    const deathPlace = deathEvent?.place || '';

    return { birthDate, birthPlace, deathDate, deathPlace };
  };

  // Helper: Beräkna relationstyp mellan två personer (enkel version)
  const getRelationshipType = (personAId, personBId) => {
    if (personAId === personBId) return null;
    
    const personA = allPeople.find(p => p.id === personAId);
    const personB = allPeople.find(p => p.id === personBId);
    if (!personA || !personB) return null;

    // Kolla om de är partners
    const aPartners = (personA.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
    if (aPartners.includes(personBId)) return 'partner';

    // Kolla om de är föräldrar/barn
    const aParents = (personA.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
    if (aParents.includes(personBId)) return 'parent';
    
    const aChildren = (personA.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
    if (aChildren.includes(personBId)) return 'child';

    // Kolla om de är syskon (gemensamma föräldrar)
    const bParents = (personB.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
    const commonParents = aParents.filter(p => bParents.includes(p));
    if (commonParents.length > 0) return 'sibling';

    return null;
  };

  // Helper: Beräkna ålder vid ett visst datum
  const calculateAgeAtEvent = (birthDate, eventDate) => {
    if (!birthDate || !eventDate) return null;
    
    const birthYear = parseInt(birthDate.substring(0, 4));
    const eventYear = parseInt(eventDate.substring(0, 4));
    
    if (isNaN(birthYear) || isNaN(eventYear)) return null;
    
    return eventYear - birthYear;
  };

  // Helper: Sortera events efter datum
  const sortedEvents = () => {
    if (!person.events) return [];
    return [...person.events].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateA.localeCompare(dateB);
    });
  };

  // Helper: Bygg platshierarki från placeId eller placeData
  const getPlaceHierarchy = (evt) => {
    // Försök först använda placeData om den finns (nyare events)
    let place = evt?.placeData;
    
    // Annars försök hitta i allPlaces
    if (!place && evt?.placeId && allPlaces) {
      place = allPlaces.find(p => p.id === evt.placeId);
    }
    
    if (!place) return evt?.place || '';
    
    // Bygg hierarki från minst till störst
    const parts = [
      place.gard,
      place.by,
      place.specific,
      place.village,
      place.socken,
      place.sockenstadnamn,
      place.parish,
      place.kommunnamn,
      place.municipality,
      place.lansnamn,
      place.region,
      place.land,
      place.country
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : place.name || place.ortnamn || '';
  };

  const handleMouseDown = (e) => {
    // Bara drag från header
    if (e.target.closest('.modal-header')) {
      setIsDragging(true);
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);
  const [person, setPerson] = useState(() => {
    const base = initialPerson || {
      id: 'I_new',
      refId: '',
      firstName: '',
      lastName: '',
      sex: 'U',
      birthDate: '',
      deathDate: '',
      birthPlace: '',
      deathPlace: '',
      tags: [],
      events: [],
      relations: { parents: [], partners: [], children: [] },
      research: [],
      media: [],
      notes: []
    };
    
    // Säkerställ att events är en array
    if (!Array.isArray(base.events)) {
      base.events = [];
    }
    
    return base;
  });

  // Handle keyboard navigation in relation picker (moved after person definition)
  useEffect(() => {
    if (!relationModalOpen) return;

    const handleKeyDown = (e) => {
      // Beräkna filtrerad lista (samma logik som i modalen)
      const filtered = allPeople
        .filter(p => {
          if (p.id === person.id) return false;
          if (!relationSearch) return true;
          const searchLower = relationSearch.toLowerCase();
          const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
          const ref = (p.refNumber || p.refId || '').toString().toLowerCase();
          return fullName.includes(searchLower) || ref.includes(searchLower) ||
                 (p.firstName || '').toLowerCase().includes(searchLower) ||
                 (p.lastName || '').toLowerCase().includes(searchLower);
        })
        .map(p => {
          const relationship = getRelationshipType(person.id, p.id);
          const modifiedAt = p.modifiedAt || p.createdAt || '';
          return { ...p, relationship, modifiedAt };
        })
        .sort((a, b) => {
          if (relationSortBy === 'recent') {
            return (b.modifiedAt || '').localeCompare(a.modifiedAt || '');
          } else if (relationSortBy === 'related') {
            const order = { 'partner': 1, 'parent': 2, 'child': 3, 'sibling': 4 };
            const aOrder = order[a.relationship] || 99;
            const bOrder = order[b.relationship] || 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          } else {
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          }
        });

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setRelationSearchIndex(prev => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setRelationSearchIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[relationSearchIndex]) {
          addRelation(filtered[relationSearchIndex].id);
        }
      } else if (e.key === 'Escape') {
        setRelationModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationModalOpen, relationSearch, relationSearchIndex, relationSortBy, person.id, allPeople]);

  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [isSourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingEventIndex, setEditingEventIndex] = useState(null);
  const [eventModalPosition, setEventModalPosition] = useState({ x: window.innerWidth / 2 - 300, y: 100 });
  const [isEventModalDragging, setIsEventModalDragging] = useState(false);
  const [eventModalDragOffset, setEventModalDragOffset] = useState({ x: 0, y: 0 });
  const eventModalRef = useRef(null);
  const [eventTypeSearchOpen, setEventTypeSearchOpen] = useState(false);
  const [eventTypeSearchText, setEventTypeSearchText] = useState('');
  const [eventTypeSearchIndex, setEventTypeSearchIndex] = useState(0);
  const eventTypeSearchRef = useRef(null);
  const [newEvent, setNewEvent] = useState({ 
    id: `evt_${Date.now()}`,
    type: 'Födelse', 
    date: '', 
    place: '',
    placeId: '',
    sources: [],
    images: 0,
    notes: ''
  });

  const [tagInput, setTagInput] = useState('');
  const [selectedEventIndex, setSelectedEventIndex] = useState(null);
  const [sourceRefreshKey, setSourceRefreshKey] = useState(0);
  
  // State för noteringar-fliken
  const [noteSearch, setNoteSearch] = useState('');
  const [draggedNoteIndex, setDraggedNoteIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Re-render detail block när allSources ändras
  useEffect(() => {
    setSourceRefreshKey(prev => prev + 1);
  }, [allSources]);

  // Kontrollera om en händelsetyp redan finns (för unique events)
  const canAddEventType = (eventType) => {
    const eventConfig = EVENT_TYPES.find(e => e.value === eventType);
    if (!eventConfig || !eventConfig.unique) return true;
    return !person.events?.some(e => e.type === eventType);
  };

  // Tag handling
  const addTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.replace(',', '').trim();
      if (!person.tags.includes(newTag)) {
        setPerson({ ...person, tags: [...person.tags, newTag] });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setPerson({ ...person, tags: person.tags.filter(t => t !== tagToRemove) });
  };

  // Event handling
  const handleAddEvent = () => {
    setEditingEventIndex(null);
    setNewEvent({ 
      id: `evt_${Date.now()}`,
      type: 'Födelse', 
      date: '', 
      place: '',
      placeId: '',
      placeData: null,
      sources: [],
      images: 0,
      notes: ''
    });
    setEventModalOpen(true);
  };

  const handleEditEvent = (index) => {
    setEditingEventIndex(index);
    setNewEvent(person.events[index]);
    setEventModalOpen(true);
  };

  const handleSaveEvent = () => {
    // Validera: om det är en ny händelse (inte redigering) och händelsen är unique, kolla om den redan finns
    if (editingEventIndex === null) {
      const eventConfig = EVENT_TYPES.find(e => e.value === newEvent.type);
      if (eventConfig?.unique && person.events?.some(e => e.type === newEvent.type)) {
        alert(`Händelsen "${newEvent.type}" finns redan och kan bara läggas till en gång.`);
        return;
      }
    }
    
    if (editingEventIndex !== null) {
      const updated = person.events.map((e, i) => i === editingEventIndex ? newEvent : e);
      setPerson({ ...person, events: updated });
    } else {
      setPerson({ ...person, events: [...person.events, newEvent] });
    }
    setEventModalOpen(false);
    setEditingEventIndex(null);
    setNewEvent({ 
      id: `evt_${Date.now()}`,
      type: 'Födelse', 
      date: '', 
      place: '',
      placeId: '',
      placeData: null,
      sources: [],
      images: 0,
      notes: ''
    });
  };

  const handleDeleteEvent = (index) => {
    setPerson({ ...person, events: person.events.filter((_, i) => i !== index) });
    // Reset modal state if open
    setEventModalOpen(false);
    setEditingEventIndex(null);
    setNewEvent({ 
      id: `evt_${Date.now()}`,
      type: 'Födelse', 
      date: '', 
      place: '',
      placeId: '',
      placeData: null,
      sources: [],
      images: 0,
      notes: ''
    });
  };

  const handleAddSource = (source) => {
    const updatedEvent = {
      ...newEvent,
      sources: [...(newEvent.sources || []), { id: `src_${Date.now()}`, ...source }]
    };
    setNewEvent(updatedEvent);
  };

  // Event Modal dragging handlers
  const handleEventModalMouseDown = (e) => {
    if (e.target.closest('.modal-header')) {
      setIsEventModalDragging(true);
      const rect = eventModalRef.current.getBoundingClientRect();
      setEventModalDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleEventModalMouseMove = (e) => {
    if (!isEventModalDragging) return;
    setEventModalPosition({
      x: e.clientX - eventModalDragOffset.x,
      y: e.clientY - eventModalDragOffset.y
    });
  };

  const handleEventModalMouseUp = () => {
    setIsEventModalDragging(false);
  };

  useEffect(() => {
    if (isEventModalDragging) {
      document.addEventListener('mousemove', handleEventModalMouseMove);
      document.addEventListener('mouseup', handleEventModalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleEventModalMouseMove);
        document.removeEventListener('mouseup', handleEventModalMouseUp);
      };
    }
  }, [isEventModalDragging, eventModalDragOffset]);

  // Event type search functions
  const getFilteredEventTypes = () => {
    if (!eventTypeSearchText) return EVENT_TYPES;
    const search = eventTypeSearchText.toLowerCase();
    return EVENT_TYPES.filter(t => t.label.toLowerCase().includes(search));
  };

  const handleEventTypeSearchKeyDown = (e) => {
    const filteredTypes = getFilteredEventTypes();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setEventTypeSearchIndex(prev => Math.min(prev + 1, filteredTypes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setEventTypeSearchIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTypes[eventTypeSearchIndex]) {
        const selectedType = filteredTypes[eventTypeSearchIndex];
        if (editingEventIndex !== null || canAddEventType(selectedType.value)) {
          setNewEvent({...newEvent, type: selectedType.value});
          setEventTypeSearchOpen(false);
          setEventTypeSearchText('');
          setEventTypeSearchIndex(0);
        }
      }
    } else if (e.key === 'Escape') {
      setEventTypeSearchOpen(false);
      setEventTypeSearchText('');
      setEventTypeSearchIndex(0);
    }
  };

  const handleEventTypeSelect = (eventType) => {
    if (editingEventIndex !== null || canAddEventType(eventType)) {
      setNewEvent({...newEvent, type: eventType});
      setEventTypeSearchOpen(false);
      setEventTypeSearchText('');
      setEventTypeSearchIndex(0);
    }
  };

  useEffect(() => {
    if (eventTypeSearchText !== '') {
      setEventTypeSearchIndex(0);
    }
  }, [eventTypeSearchText]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (eventTypeSearchRef.current && !eventTypeSearchRef.current.contains(e.target)) {
        setEventTypeSearchOpen(false);
        setEventTypeSearchText('');
        setEventTypeSearchIndex(0);
      }
    };
    
    if (eventTypeSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [eventTypeSearchOpen]);

  // Image paste handler - TAS BORT: MediaSelector hanterar paste nu

  const handleSave = async () => {
    try {
      if (onSave) {
        await onSave(person);
      }
      if (onClose) onClose();
    } catch (error) {
      console.error('Error saving person:', error);
    }
  };

  return (
    <>
      {/* BARA INNEHÅL - WindowFrame hanterar containern */}
      <div className="w-full h-full bg-slate-800 flex flex-col overflow-hidden">        {/* HEADER */}
        <div className="modal-header h-16 bg-slate-700 border-b border-slate-600 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4 select-none">
            <div className="w-10 h-10 rounded-full bg-slate-600 overflow-hidden border-2 border-slate-500 pointer-events-none">
              {person.media?.length > 0 ? (
                <img src={person.media[0].url} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-1 text-slate-400" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-200 leading-tight">
                {person.firstName} {person.lastName}
              </h1>
              <p className="text-xs text-slate-400">
                {(() => {
                  const { birthYear, deathYear, lifeSpan } = getLifeInfo(person);
                  if (birthYear && deathYear && lifeSpan !== null) {
                    return `${birthYear} — ${deathYear} (ca. ${lifeSpan} år)`;
                  } else if (birthYear && deathYear) {
                    return `${birthYear} — ${deathYear}`;
                  } else if (birthYear) {
                    return `${birthYear} — Levande`;
                  } else {
                    return '? — ?';
                  }
                })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <nav className="flex gap-1">
                {[
                  { id: 'info', icon: User, label: 'Info' },
                  { id: 'relations', icon: Users, label: 'Relationer' },
                  { id: 'media', icon: ImageIcon, label: 'Media' },
                  { id: 'notes', icon: FileText, label: 'Noteringar' },
                  { id: 'research', icon: Activity, label: 'Forskning' },
                  { id: 'tags', icon: Tag, label: 'Taggar' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all relative ${
                      activeTab === tab.id 
                      ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-500' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border-b-2 border-transparent'
                    }`}
                  >
                    <tab.icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                ))}
             </nav>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-hidden flex bg-slate-900 relative">
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {/* FLIK: INFO */}
            {activeTab === 'info' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Grunddata */}
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-2">
                    <div className="aspect-[3/4] bg-slate-700 rounded-lg border border-slate-600 flex items-center justify-center relative group cursor-pointer overflow-hidden">
                       {person.media?.length > 0 ? (
                         <img src={person.media[0].url} alt="Profil" className="w-full h-full object-cover" />
                       ) : (
                         <User size={40} className="text-slate-400" />
                       )}
                       <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera size={20} className="text-white" />
                       </div>
                    </div>
                  </div>
                  <div className="col-span-10 grid grid-cols-2 gap-4 content-start">
                    <div>
                      <label className="text-xs uppercase font-bold text-slate-300">Förnamn</label>
                      <input type="text" value={person.firstName} onChange={e => setPerson({...person, firstName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold text-slate-300">Efternamn</label>
                      <input type="text" value={person.lastName} onChange={e => setPerson({...person, lastName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold text-slate-300">Kön</label>
                      <select value={person.sex} onChange={e => setPerson({...person, sex: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none">
                        <option value="M">Man</option>
                        <option value="K">Kvinna</option>
                        <option value="U">Okänd</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold text-slate-300">Ref Nr</label>
                      <input
                        type="text"
                        value={person.refNumber || ''}
                        onBlur={e => {
                          const val = e.target.value.trim();
                          if (!val) {
                            // Tilldela automatiskt nästa lediga nummer
                            const maxRef = allPeople?.reduce((max, p) => {
                              const num = parseInt(p.refNumber, 10);
                              return (!isNaN(num) && num > max) ? num : max;
                            }, 0) || 0;
                            setPerson({...person, refNumber: String(maxRef + 1)});
                          }
                        }}
                        onChange={e => {
                          const val = e.target.value;
                          // Kontrollera om refNumber redan finns hos annan person
                          const isDuplicate = allPeople?.some(p => p.id !== person.id && String(p.refNumber) === String(val));
                          if (isDuplicate) {
                            alert('Ref Nr används redan av en annan person! Välj ett unikt nummer.');
                            setPerson({...person, refNumber: ''});
                          } else {
                            setPerson({...person, refNumber: val});
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Livshändelser */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                      <Activity size={16} className="text-blue-600"/> Livshändelser
                    </h3>
                    <button 
                      onClick={handleAddEvent}
                      className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
                    >
                      <Plus size={14}/> Lägg till händelse
                    </button>
                  </div>
                  
                  <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-800 text-slate-300 text-xs uppercase">
                        <tr>
                          <th className="p-3">Ålder</th>
                          <th className="p-3">Typ</th>
                          <th className="p-3">Datum</th>
                          <th className="p-3">Plats</th>
                          <th className="p-3">Info</th>
                          <th className="p-3 text-center">Info</th>
                          <th className="p-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {sortedEvents().map((evt, idx) => {
                          const age = calculateAgeAtEvent(person.events?.find(e => e.type === 'Födelse')?.date, evt.date);
                          let partnerName = '';
                          if (evt.type === 'Vigsel' && evt.partnerId && person.relations?.partners?.length > 0) {
                            const partner = person.relations.partners.find(p => p.id === evt.partnerId);
                            partnerName = partner ? partner.name : '';
                          }
                          return (
                            <tr 
                              key={evt.id || idx} 
                              onClick={() => {
                                if (editingEventIndex === null) {
                                  setSelectedEventIndex(selectedEventIndex === idx ? null : idx);
                                }
                              }}
                              className={`hover:bg-slate-800 transition-colors group cursor-pointer ${
                                selectedEventIndex === idx && editingEventIndex === null ? 'bg-blue-900/30 border-l-4 border-blue-500' : ''
                              }`}
                            >
                              <td className="p-3 text-slate-300">{age !== null ? `${age} år` : '-'}</td>
                              <td className="p-3 font-medium text-slate-200">{evt.type}</td>
                              <td className="p-3 font-mono text-slate-300">{evt.date || '-'}</td>
                              <td 
                                className="p-3 text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                                title={getPlaceHierarchy(evt)}
                              >
                                 <MapPin size={12} /> {evt.place || '-'}
                              </td>
                              <td className="p-3 text-slate-200">{partnerName}</td>
                              <td className="p-3">
                                <div className="flex justify-center gap-3 text-xs text-slate-400">
                                  <span 
                                    className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${evt.sources?.length > 0 ? 'text-slate-200' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedEventIndex(idx); }}
                                  >
                                    <LinkIcon size={12}/> {evt.sources?.length || 0}
                                  </span>
                                  <span 
                                    className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${evt.notes ? 'text-slate-200' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); }}
                                    title={evt.notes || ''}
                                  >
                                    <FileText size={12}/> {evt.notes ? 1 : 0}
                                  </span>
                                  <span 
                                    className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${evt.images > 0 ? 'text-slate-200' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); }}
                                  >
                                    <ImageIcon size={12}/> {evt.images || 0}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-right flex gap-2 justify-end">
                                <button onClick={(e) => { e.stopPropagation(); handleEditEvent(idx); }} className="text-slate-400 hover:text-slate-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit3 size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(idx); }} className="text-slate-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {(!person.events || person.events.length === 0) && (
                          <tr>
                            <td colSpan="7" className="p-4 text-center text-slate-400 text-sm">Inga händelser tillagda än</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* FLIK: RELATIONER */}
            {activeTab === 'relations' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Föräldrar */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                   <div className="flex justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200 uppercase">Föräldrar</h4>
                      <button onClick={() => openRelationModal('parents')} className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"><Plus size={12}/> Lägg till</button>
                   </div>
                   {person.relations?.parents?.length > 0 ? (
                     person.relations.parents.map((p, idx) => (
                       <div key={p.id || idx} className="flex items-center justify-between bg-slate-700 p-2 rounded mb-2 border border-slate-600">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-400"><User size={16}/></div>
                            <span className="text-slate-200 font-medium">{p.name}</span>
                            <select
                              value={p.type || RELATION_TYPES.parent[0]}
                              onChange={e => {
                                const newType = e.target.value;
                                setPerson(prev => {
                                  const rels = { ...prev.relations };
                                  rels.parents = rels.parents.map((rel, i) => i === idx ? { ...rel, type: newType } : rel);
                                  return { ...prev, relations: rels };
                                });
                              }}
                              className="bg-slate-900 border border-slate-600 text-xs rounded px-2 py-1 text-slate-200 ml-2"
                            >
                              {RELATION_TYPES.parent.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <button onClick={() => removeRelation('parents', p.id)} className="text-red-600 hover:text-red-800 text-xs ml-2"><Trash2 size={14}/></button>
                       </div>
                     ))
                   ) : (
                     <p className="text-xs text-slate-400">Ingen förälder tillagd</p>
                   )}
                </div>

                {/* Partners */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                   <div className="flex justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200 uppercase">Partner</h4>
                      <button onClick={() => openRelationModal('partners')} className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"><Plus size={12}/> Lägg till</button>
                   </div>
                   {person.relations?.partners?.length > 0 ? (
                     person.relations.partners.map((p, idx) => (
                       <div key={p.id || idx} className="flex items-center justify-between bg-slate-700 p-2 rounded mb-2 border border-slate-600">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-400"><User size={16}/></div>
                            <span className="text-slate-200 font-medium">{p.name}</span>
                            <select
                              value={p.type || RELATION_TYPES.partner[0]}
                              onChange={e => {
                                const newType = e.target.value;
                                setPerson(prev => {
                                  const rels = { ...prev.relations };
                                  // Spara nya relationstypen
                                  rels.partners = rels.partners.map((rel, i) => i === idx ? { ...rel, type: newType } : rel);
                                  let events = [...prev.events];
                                  // Hämta tidigare typ (innan ändring)
                                  const prevType = prev.relations.partners[idx]?.type;
                                  // Skapa skilsmässa-händelse om man väljer Skild
                                  if (newType === 'Skild') {
                                    const alreadyExists = events.some(ev => ev.type === 'Skilsmässa' && ev.partnerId === p.id);
                                    if (!alreadyExists) {
                                      events.push({
                                        id: `evt_${Date.now()}`,
                                        type: 'Skilsmässa',
                                        date: '',
                                        place: '',
                                        partnerId: p.id,
                                        sources: [],
                                        images: 0,
                                        notes: ''
                                      });
                                    }
                                  }
                                  // Ta bort skilsmässa-händelse om man ändrar från Skild till något annat
                                  if (prevType === 'Skild' && newType !== 'Skild') {
                                    events = events.filter(ev => !(ev.type === 'Skilsmässa' && ev.partnerId === p.id));
                                  }
                                  return { ...prev, relations: rels, events };
                                });
                              }}
                              className="bg-slate-900 border border-slate-600 text-xs rounded px-2 py-1 text-slate-200 ml-2"
                            >
                              {RELATION_TYPES.partner.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <button onClick={() => removeRelation('partners', p.id)} className="text-red-600 hover:text-red-800 text-xs ml-2"><Trash2 size={14}/></button>
                       </div>
                     ))
                   ) : (
                     <p className="text-xs text-slate-400">Ingen partner tillagd</p>
                   )}
                </div>

                {/* Barn */}
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                   <div className="flex justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-200 uppercase">Barn</h4>
                      <button onClick={() => openRelationModal('children')} className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"><Plus size={12}/> Lägg till</button>
                   </div>
                   {person.relations?.children?.length > 0 ? (
                     person.relations.children.map((c, idx) => (
                       <div key={c.id || idx} className="flex items-center justify-between bg-slate-900 p-2 rounded mb-2 border border-slate-700">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400"><User size={16}/></div>
                            <span className="text-slate-200 font-medium">{c.name}</span>
                            <select
                              value={c.type || RELATION_TYPES.child[0]}
                              onChange={e => {
                                const newType = e.target.value;
                                setPerson(prev => {
                                  const rels = { ...prev.relations };
                                  rels.children = rels.children.map((rel, i) => i === idx ? { ...rel, type: newType } : rel);
                                  return { ...prev, relations: rels };
                                });
                              }}
                              className="bg-slate-900 border border-slate-600 text-xs rounded px-2 py-1 text-slate-200 ml-2"
                            >
                              {RELATION_TYPES.child.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                          <button onClick={() => removeRelation('children', c.id)} className="text-red-600 hover:text-red-800 text-xs ml-2"><Trash2 size={14}/></button>
                       </div>
                     ))
                   ) : (
                     <p className="text-xs text-slate-400">Inget barn tillagd</p>
                   )}
                </div>

                {/* Relation Picker Modal */}
                {relationModalOpen && (() => {
                  // Filtrera och sortera personer
                  const filteredPeople = allPeople
                    .filter(p => {
                      if (p.id === person.id) return false; // Exkludera sig själv
                      if (!relationSearch) return true;
                      
                      const searchLower = relationSearch.toLowerCase();
                      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
                      const ref = (p.refNumber || p.refId || '').toString().toLowerCase();
                      
                      // Sök på f.namn, e.namn, ref
                      return fullName.includes(searchLower) || 
                             ref.includes(searchLower) ||
                             (p.firstName || '').toLowerCase().includes(searchLower) ||
                             (p.lastName || '').toLowerCase().includes(searchLower);
                    })
                    .map(p => {
                      const relationship = getRelationshipType(person.id, p.id);
                      const modifiedAt = p.modifiedAt || p.createdAt || '';
                      return { ...p, relationship, modifiedAt };
                    })
                    .sort((a, b) => {
                      if (relationSortBy === 'recent') {
                        // Sortera efter senast ändrad (nyast först)
                        return (b.modifiedAt || '').localeCompare(a.modifiedAt || '');
                      } else if (relationSortBy === 'related') {
                        // Sortera efter relationstyp (partners först, sedan föräldrar, barn, syskon, osv)
                        const order = { 'partner': 1, 'parent': 2, 'child': 3, 'sibling': 4 };
                        const aOrder = order[a.relationship] || 99;
                        const bOrder = order[b.relationship] || 99;
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        // Om samma typ, sortera alfabetiskt
                        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                      } else {
                        // Sortera alfabetiskt (standard)
                        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                      }
                    });

                  return (
                    <WindowFrame
                      title="Välj person att koppla"
                      icon={User}
                      onClose={() => setRelationModalOpen(false)}
                      initialWidth={800}
                      initialHeight={600}
                      zIndex={4200}
                    >
                      <div className="h-full flex flex-col bg-slate-800 overflow-hidden">
                        <div className="p-4 space-y-3 flex-shrink-0">
                          {/* Sökfält */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18}/>
                            <input
                              type="text"
                              value={relationSearch}
                              onChange={e => { setRelationSearch(e.target.value); setRelationSearchIndex(0); }}
                              placeholder="Sök på namn, ref, f.namn, e.namn..."
                              className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-10 text-white focus:border-blue-500 focus:outline-none"
                              autoFocus
                            />
                          </div>
                          
                          {/* Filter/Sortering */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setRelationSortBy('name'); setRelationSearchIndex(0); }}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                relationSortBy === 'name' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              Namn
                            </button>
                            <button
                              onClick={() => { setRelationSortBy('recent'); setRelationSearchIndex(0); }}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                relationSortBy === 'recent' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              Senast tillagd
                            </button>
                            <button
                              onClick={() => { setRelationSortBy('related'); setRelationSearchIndex(0); }}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                relationSortBy === 'related' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              Närmast släkt
                            </button>
                          </div>

                          {/* Personlista */}
                          <div className="flex-1 overflow-y-auto divide-y divide-slate-700 custom-scrollbar">
                            {filteredPeople.length === 0 ? (
                              <div className="text-slate-400 py-8 text-center">Ingen person hittades</div>
                            ) : (
                              filteredPeople.map((p, idx) => {
                                const { birthDate, birthPlace, deathDate, deathPlace } = getPersonLifeDetails(p);
                                const sex = p.sex || 'U';
                                const sexLabel = sex === 'M' ? 'M' : sex === 'K' ? 'F' : 'U';
                                const profileImage = p.media && p.media.length > 0 ? p.media[0].url : null;
                                
                                return (
                                  <div 
                                    key={p.id} 
                                    className={`flex items-start gap-3 py-3 px-3 cursor-pointer hover:bg-slate-700 transition-colors ${
                                      idx === relationSearchIndex ? 'bg-blue-600 text-white' : 'text-slate-200'
                                    }`}
                                    onClick={() => addRelation(p.id)}
                                    onMouseEnter={() => setRelationSearchIndex(idx)}
                                  >
                                    {/* Rund thumbnail */}
                                    <div className="w-12 h-12 rounded-full bg-slate-600 flex-shrink-0 overflow-hidden border-2 border-slate-500">
                                      {profileImage ? (
                                        <img src={profileImage} alt={`${p.firstName} ${p.lastName}`} className="w-full h-full object-cover" />
                                      ) : (
                                        <User className="w-full h-full p-2 text-slate-400" />
                                      )}
                                    </div>
                                    
                                    {/* Personinfo */}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-base mb-1">
                                        {p.firstName} {p.lastName}
                                        {p.relationship && (
                                          <span className="ml-2 text-xs font-normal text-slate-400">
                                            ({p.relationship === 'partner' ? 'Partner' : 
                                              p.relationship === 'parent' ? 'Förälder' : 
                                              p.relationship === 'child' ? 'Barn' : 
                                              p.relationship === 'sibling' ? 'Syskon' : ''})
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Födelsedatum och plats */}
                                      {(birthDate || birthPlace) && (
                                        <div className="text-sm text-slate-400 mb-0.5">
                                          * {birthDate || '????-??-??'} {birthPlace && ` ${birthPlace}`} ({sexLabel})
                                        </div>
                                      )}
                                      
                                      {/* Dödsdatum och plats */}
                                      {(deathDate || deathPlace) && (
                                        <div className="text-sm text-slate-400">
                                          + {deathDate || '????-??-??'} {deathPlace && ` ${deathPlace}`} ({sexLabel})
                                        </div>
                                      )}
                                      
                                      {/* Om inga datum finns */}
                                      {!birthDate && !deathDate && (
                                        <div className="text-sm text-slate-500 italic">
                                          Inga datum registrerade
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </WindowFrame>
                  );
                })()}
              </div>
            )}

            {/* FLIK: MEDIA */}
            {activeTab === 'media' && (
              <div className="animate-in fade-in duration-300 h-full">
                <MediaSelector
                  media={person.media || []}
                  onMediaChange={(newMedia) => {
                    setPerson(prev => ({ ...prev, media: newMedia }));
                  }}
                  entityType="person"
                  entityId={person.id}
                  allPeople={allPeople}
                  onOpenEditModal={onOpenEditModal}
                  allMediaItems={allMediaItems}
                  onUpdateAllMedia={onUpdateAllMedia}
                  allSources={allSources || []}
                  allPlaces={allPlaces || []}
                />
              </div>
            )}

            {/* FLIK: FORSKNING */}
            {activeTab === 'research' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between mb-4">
                   <h3 className="text-md font-bold text-slate-200 uppercase">Forskningsuppgifter</h3>
                   <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-1">
                     <Plus size={14}/> Ny uppgift
                   </button>
                </div>

                <div className="space-y-3">
                   {person.research?.map((task, idx) => {
                     const prio = PRIORITY_LEVELS.find(p => p.level === task.priority) || PRIORITY_LEVELS[0];
                     return (
                       <div key={idx} className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex-1">
                               <input type="text" defaultValue={task.task} className="bg-transparent font-medium text-slate-200 w-full focus:outline-none focus:border-b border-blue-500" />
                             </div>
                             <div className="flex gap-2 ml-4">
                               <select 
                                 className={`bg-slate-900 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 ${prio.color}`}
                                 defaultValue={task.priority}
                               >
                                 {PRIORITY_LEVELS.map(p => (
                                   <option key={p.level} value={p.level}>{p.level} - {p.label}</option>
                                 ))}
                               </select>
                               <button className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                             </div>
                          </div>
                          
                          <div className="bg-slate-800 rounded border border-slate-700 mt-2">
                            <EditorToolbar />
                            <textarea 
                              className="w-full bg-transparent text-sm text-slate-200 p-2 focus:outline-none min-h-[60px] resize-y"
                              defaultValue={task.notes}
                            />
                          </div>
                       </div>
                     );
                   })}
                </div>
              </div>
            )}

            {/* FLIK: TAGGAR */}
            {activeTab === 'tags' && (
              <div className="animate-in fade-in duration-300">
                <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Hantera Taggar</label>
                <div className="flex items-center gap-2 mb-4">
                  <input 
                    type="text" 
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 w-64 focus:outline-none focus:border-blue-500"
                    placeholder="Skriv tagg och tryck Enter..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={addTag}
                  />
                  <p className="text-xs text-slate-400">Separera med komma eller enter.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {person.tags?.map(tag => (
                    <span key={tag} className="flex items-center gap-1 bg-green-100 border border-green-300 text-green-800 px-3 py-1 rounded-full text-sm">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-green-900"><X size={14}/></button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* FLIK: NOTERINGAR */}
            {activeTab === 'notes' && (() => {
              // Säkerställ att alla noteringar har datum (för bakåtkompatibilitet)
              const notesWithDates = (person.notes || []).map(note => {
                if (!note.createdAt) {
                  return { ...note, createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() };
                }
                if (!note.modifiedAt) {
                  return { ...note, modifiedAt: note.createdAt };
                }
                return note;
              });

              // Filtrera noteringar baserat på söktext
              const filteredNotes = notesWithDates.filter(note => {
                if (!noteSearch) return true;
                const searchLower = noteSearch.toLowerCase();
                const titleMatch = (note.title || '').toLowerCase().includes(searchLower);
                // Sök även i HTML-innehållet (strippa HTML-taggar för sökning)
                const contentText = (note.content || '').replace(/<[^>]*>/g, '').toLowerCase();
                const contentMatch = contentText.includes(searchLower);
                return titleMatch || contentMatch;
              });

              // Hantera drag start
              const handleDragStart = (e, index) => {
                setDraggedNoteIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.outerHTML);
                e.target.style.opacity = '0.5';
              };

              // Hantera drag over
              const handleDragOver = (e, index) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverIndex(index);
              };

              // Hantera drag leave
              const handleDragLeave = () => {
                setDragOverIndex(null);
              };

              // Hantera drop
              const handleDrop = (e, dropIndex) => {
                e.preventDefault();
                if (draggedNoteIndex === null || draggedNoteIndex === dropIndex) {
                  setDraggedNoteIndex(null);
                  setDragOverIndex(null);
                  return;
                }

                // Hitta originalindex i den ofiltrerade listan
                const draggedNote = filteredNotes[draggedNoteIndex];
                const originalDraggedIndex = notesWithDates.findIndex(n => n.id === draggedNote.id);
                const originalDropIndex = notesWithDates.findIndex(n => n.id === filteredNotes[dropIndex].id);

                if (originalDraggedIndex !== -1 && originalDropIndex !== -1) {
                  const newNotes = [...notesWithDates];
                  const [removed] = newNotes.splice(originalDraggedIndex, 1);
                  newNotes.splice(originalDropIndex, 0, removed);
                  
                  setPerson(prev => ({
                    ...prev,
                    notes: newNotes
                  }));
                }

                setDraggedNoteIndex(null);
                setDragOverIndex(null);
              };

              // Hantera drag end
              const handleDragEnd = (e) => {
                e.target.style.opacity = '1';
                setDraggedNoteIndex(null);
                setDragOverIndex(null);
              };

              // Formatera datum
              const formatDate = (dateString) => {
                if (!dateString) return '';
                try {
                  const date = new Date(dateString);
                  return date.toLocaleDateString('sv-SE', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                } catch {
                  return dateString;
                }
              };

              return (
                <div className="space-y-4 animate-in fade-in duration-300">
                   <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-200">Noteringar</h3>
                      <button 
                        onClick={() => {
                          const now = new Date().toISOString();
                          const newNote = {
                            id: `note_${Date.now()}`,
                            title: 'Ny notering',
                            content: '',
                            createdAt: now,
                            modifiedAt: now
                          };
                          setPerson(prev => ({
                            ...prev,
                            notes: [...(prev.notes || []), newNote]
                          }));
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                      >
                        <Plus size={14}/> Ny notering
                      </button>
                   </div>

                   {/* Sökfält */}
                   <div className="relative mb-4">
                     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18}/>
                     <input
                       type="text"
                       value={noteSearch}
                       onChange={(e) => setNoteSearch(e.target.value)}
                       placeholder="Sök i noteringar..."
                       className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-10 text-white focus:border-blue-500 focus:outline-none"
                     />
                     {noteSearch && (
                       <button
                         onClick={() => setNoteSearch('')}
                         className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                       >
                         <X size={18}/>
                       </button>
                     )}
                   </div>
                   
                   {(!notesWithDates || notesWithDates.length === 0) ? (
                     <div className="text-center py-12 text-slate-400">
                       <FileText size={48} className="mx-auto mb-4 opacity-50" />
                       <p className="text-sm">Inga noteringar ännu. Klicka på "Ny notering" för att lägga till en.</p>
                     </div>
                   ) : filteredNotes.length === 0 ? (
                     <div className="text-center py-12 text-slate-400">
                       <Search size={48} className="mx-auto mb-4 opacity-50" />
                       <p className="text-sm">Inga noteringar matchar din sökning.</p>
                     </div>
                   ) : (
                     filteredNotes.map((note, idx) => {
                       // Hitta originalindex
                       const originalIndex = notesWithDates.findIndex(n => n.id === note.id);
                       
                       return (
                         <div 
                           key={note.id || idx} 
                           draggable
                           onDragStart={(e) => handleDragStart(e, idx)}
                           onDragOver={(e) => handleDragOver(e, idx)}
                           onDragLeave={handleDragLeave}
                           onDrop={(e) => handleDrop(e, idx)}
                           onDragEnd={handleDragEnd}
                           className={`bg-slate-900 border border-slate-700 rounded-lg overflow-hidden transition-all cursor-move ${
                             dragOverIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/50' : ''
                           } ${draggedNoteIndex === idx ? 'opacity-50' : ''}`}
                         >
                            <div className="bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                               <div className="flex-1 flex items-center gap-2">
                                 <div className="text-slate-500 cursor-grab active:cursor-grabbing" title="Dra för att sortera">
                                   <MoreHorizontal size={18}/>
                                 </div>
                                 <input 
                                   type="text" 
                                   value={note.title || 'Notering'}
                                   onChange={(e) => {
                                     const now = new Date().toISOString();
                                     setPerson(prev => ({
                                       ...prev,
                                       notes: prev.notes.map((n, i) => 
                                         i === originalIndex 
                                           ? { ...n, title: e.target.value, modifiedAt: now } 
                                           : n
                                       )
                                     }));
                                   }}
                                   className="bg-transparent font-bold text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 flex-1"
                                   placeholder="Titel på notering..."
                                   onClick={(e) => e.stopPropagation()}
                                 />
                               </div>
                               <div className="flex gap-3 items-center ml-3">
                                 {/* Datum */}
                                 <div className="text-xs text-slate-500 flex flex-col items-end">
                                   {note.createdAt && (
                                     <span title="Skapad">Skapad: {formatDate(note.createdAt)}</span>
                                   )}
                                   {note.modifiedAt && note.modifiedAt !== note.createdAt && (
                                     <span title="Senast ändrad" className="text-slate-600">Ändrad: {formatDate(note.modifiedAt)}</span>
                                   )}
                                 </div>
                                 <button 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     setPerson(prev => ({
                                       ...prev,
                                       notes: prev.notes.filter((_, i) => i !== originalIndex)
                                     }));
                                   }}
                                   className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                   title="Ta bort notering"
                                 >
                                   <Trash2 size={16}/>
                                 </button>
                               </div>
                            </div>
                            <div className="p-4 bg-slate-800" onClick={(e) => e.stopPropagation()}>
                              <Editor
                                value={note.content || ''}
                                onChange={(e) => {
                                  const now = new Date().toISOString();
                                  setPerson(prev => ({
                                    ...prev,
                                    notes: prev.notes.map((n, i) => 
                                      i === originalIndex 
                                        ? { ...n, content: e.target.value, modifiedAt: now } 
                                        : n
                                    )
                                  }));
                                }}
                                onBlur={() => {
                                  // Autospara när man lämnar editorn
                                }}
                              />
                            </div>
                         </div>
                       );
                     })
                   )}
                </div>
              );
            })()}

          </div>
        </div>

        {/* DETAIL BLOCK - visa källa-info för vald händelse */}
        {selectedEventIndex !== null && editingEventIndex === null && person.events?.[selectedEventIndex] && (
          <div className="bg-slate-800 border-t border-slate-700 p-4 max-h-40 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
              <h4 className="text-sm font-bold text-slate-200">
                {person.events[selectedEventIndex].type} 
                {person.events[selectedEventIndex].date && ` - ${person.events[selectedEventIndex].date}`}
              </h4>
              {/* INFO-rad kopiad från livshändelser */}
              <div className="flex gap-3 text-xs text-slate-400">
                <span 
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${person.events[selectedEventIndex].sources?.length > 0 ? 'text-slate-200' : ''}`}
                >
                  <LinkIcon size={12}/> {person.events[selectedEventIndex].sources?.length || 0}
                </span>
                <span 
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${person.events[selectedEventIndex].notes ? 'text-slate-200' : ''}`}
                  title={person.events[selectedEventIndex].notes || ''}
                >
                  <FileText size={12}/> {person.events[selectedEventIndex].notes ? 1 : 0}
                </span>
                <span 
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${person.events[selectedEventIndex].images > 0 ? 'text-slate-200' : ''}`}
                >
                  <ImageIcon size={12}/> {person.events[selectedEventIndex].images || 0}
                </span>
              </div>
            </div>
            
            {person.events[selectedEventIndex].sources && person.events[selectedEventIndex].sources.length > 0 ? (
              <div className="space-y-2" key={`sources-${sourceRefreshKey}`}>
                {person.events[selectedEventIndex].sources.map((sourceId) => {
                  // Hämta källan från allSources
                  let source = allSources?.find(s => s.id === sourceId);
                  
                  if (!source) return null;
                  
                  // Mappa database-fältnamn till display-namn
                  // Database uses: date, imagePage, page, trust
                  // Display uses: year, image, page, credibility
                  const displaySource = {
                    ...source,
                    year: source.date || source.year,
                    image: source.imagePage || source.image,
                    credibility: source.trust || source.credibility
                  };
                  
                  console.log('🔍 SOURCE FOR DISPLAY (mapped):', {
                    sourceId,
                    title: displaySource.title,
                    volume: displaySource.volume,
                    year: displaySource.year,
                    image: displaySource.image,
                    page: displaySource.page,
                    credibility: displaySource.credibility,
                    allSourcesLength: allSources?.length
                  });
                  
                  return (
                    <div key={sourceId} className="bg-slate-800 p-2 rounded border border-slate-700 flex items-start gap-3">
                      {/* Thumbnails */}
                      <div className="flex gap-1 items-start">
                        {displaySource.images && displaySource.images.length > 0 ? (
                          displaySource.images.slice(0, 3).map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img 
                                src={img.url || img.thumbnail || img} 
                                alt="Thumbnail" 
                                className="h-8 w-8 object-cover rounded cursor-pointer border border-slate-600 hover:border-blue-500"
                                onClick={() => {
                                  const fullUrl = img.url || img;
                                  window.open(fullUrl, '_blank');
                                }}
                              />
                              <div className="absolute hidden group-hover:block z-50 bg-slate-900 border border-slate-600 rounded shadow-lg p-1 left-0 top-10">
                                <img src={img.url || img} alt="Preview" className="h-32 w-32 object-cover rounded" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-8 w-8 bg-slate-700 rounded flex items-center justify-center text-slate-400">
                            <ImageIcon size={12} />
                          </div>
                        )}
                      </div>
                      
                      {/* Source info */}
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-slate-200 mb-1">
                          {displaySource.title || 'Ingen titel'}
                          {displaySource.location && ` (${displaySource.location})`}
                          {displaySource.volume && ` vol. ${displaySource.volume}`}
                          {displaySource.year && ` (${displaySource.year})`}
                          {displaySource.image && ` Bild ${displaySource.image}`}
                          {displaySource.page && ` / Sida ${displaySource.page}`}
                        </div>
                        
                        {/* Trovärdighet - Stjärnor */}
                        <div className="flex gap-0.5 mt-1 items-center">
                          <span className="text-xs text-slate-400 mr-1">Trovärdighet:</span>
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={i < (displaySource.credibility || 0) ? "text-yellow-500" : "text-slate-600"}>★</span>
                          ))}
                          {displaySource.credibilityLabel && <span className="ml-1 text-slate-300 text-xs">{displaySource.credibilityLabel}</span>}
                        </div>
                        
                        {/* Trovärdighetsikoner */}
                        <div className="flex gap-2 mt-1">
                          {/* AD - Arkivdigital */}
                          <button 
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${displaySource.aid ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer' : 'bg-slate-700 text-slate-500 cursor-default'}`}
                            title={displaySource.aid ? `AID: ${displaySource.aid}` : 'Inte länkat till Arkivdigital'}
                            onClick={() => displaySource.aid && window.open(`https://sok.riksarkivet.se/bildvisning/${displaySource.aid}`, '_blank')}
                          >
                            AD
                          </button>
                          
                          {/* RA - Riksarkivet */}
                          <button 
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${displaySource.bildId ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer' : 'bg-slate-700 text-slate-500 cursor-default'}`}
                            title={displaySource.bildId ? `BILDID: ${displaySource.bildId}` : 'Inte länkat till Riksarkivet'}
                            onClick={() => displaySource.bildId && window.open(`https://www.riksarkivet.se/bildvisning/${displaySource.bildId}`, '_blank')}
                          >
                            RA
                          </button>
                          
                          {/* NAD - Näringsliv Arkiv Digital */}
                          <button 
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${displaySource.nad ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer' : 'bg-slate-700 text-slate-500 cursor-default'}`}
                            title={displaySource.nad ? `NAD: ${displaySource.nad}` : 'Inte länkat till NAD'}
                            onClick={() => displaySource.nad && window.open(`https://nad.ra.se/${displaySource.nad}`, '_blank')}
                          >
                            NAD
                          </button>
                        </div>
                        
                        {displaySource.notes && (
                          <div className="mt-1 text-slate-400 text-xs italic line-clamp-1">
                            {displaySource.notes}
                          </div>
                        )}
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-1 ml-2 items-center text-xs">
                        {/* Noter-ikon */}
                        {displaySource.notes && (
                          <div className="relative group">
                            <button 
                              className="text-slate-400 hover:text-blue-600 p-1 flex items-center gap-0.5"
                              title="Noter"
                            >
                              <FileText size={12} />
                              <span className="text-slate-400">1</span>
                            </button>
                            <div className="absolute hidden group-hover:block z-50 bg-slate-900 text-white text-xs rounded shadow-lg p-2 right-0 top-6 min-w-max max-w-xs whitespace-normal">
                              {displaySource.notes}
                              <div className="absolute top-0 right-2 transform -translate-y-1 w-2 h-2 bg-slate-900 rotate-45"></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Bild-ikon */}
                        {displaySource.images && displaySource.images.length > 0 && (
                          <button 
                            className="text-slate-400 hover:text-blue-600 p-1 flex items-center gap-0.5"
                            title={`${displaySource.images.length} bilder`}
                          >
                            <ImageIcon size={12} />
                            <span className="text-slate-400">{displaySource.images.length}</span>
                          </button>
                        )}
                        
                        <button 
                          onClick={() => {
                            // Öppna Source Drawer för att redigera källan
                            if (onOpenSourceDrawer) {
                              onOpenSourceDrawer(person.id, null);
                              // Navigera till källan (detta kan behöva justeras beroende på hur SourceDrawer hanterar navigation)
                              console.log('Opening source drawer to edit source:', sourceId);
                            }
                          }}
                          className="text-slate-400 hover:text-blue-600 p-1"
                          title="Redigera källa"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            const newSources = person.events[selectedEventIndex].sources.filter(id => id !== sourceId);
                            const updatedEvents = person.events.map((e, i) => 
                              i === selectedEventIndex ? { ...e, sources: newSources } : e
                            );
                            setPerson({ ...person, events: updatedEvents });
                          }}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Ta bort källa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Ingen källa kopplad till denna händelse</p>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="h-16 bg-slate-900 border-t border-slate-700 flex items-center justify-between px-6 shrink-0">
          <div className="text-xs text-slate-400">
            Senast ändrad: {new Date().toISOString().split('T')[0]}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Avbryt</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium shadow-lg transition-all transform hover:scale-[1.02]">
              <Save size={18} /> Spara Ändringar
            </button>
          </div>
        </div>
      </div>

      {/* --- EVENT MODAL (SUB-MODAL) --- */}
      {isEventModalOpen && (
        <WindowFrame
          title={`${editingEventIndex !== null ? 'Redigera' : 'Lägg till'} händelse`}
          icon={Activity}
          initialWidth={600}
          initialHeight={650}
          onClose={() => {
            setEventModalOpen(false);
            setEditingEventIndex(null);
          }}
        >
          <div className="flex flex-col h-full">
              <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                <div ref={eventTypeSearchRef} className="relative">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Händelsetyp</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={eventTypeSearchOpen ? eventTypeSearchText : EVENT_TYPES.find(t => t.value === newEvent.type)?.label || ''}
                      onChange={(e) => {
                        setEventTypeSearchText(e.target.value);
                        if (!eventTypeSearchOpen) setEventTypeSearchOpen(true);
                      }}
                      onFocus={() => {
                        setEventTypeSearchOpen(true);
                        setEventTypeSearchText('');
                      }}
                      onKeyDown={handleEventTypeSearchKeyDown}
                      placeholder="Sök händelsetyp..."
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                    />
                    {eventTypeSearchOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-600 rounded shadow-lg max-h-60 overflow-y-auto">
                        {getFilteredEventTypes().map((eventType, index) => {
                          const isDisabled = eventType.unique && 
                                           editingEventIndex === null && 
                                           !canAddEventType(eventType.value);
                          const isSelected = index === eventTypeSearchIndex;
                          return (
                            <div
                              key={eventType.value}
                              onClick={() => !isDisabled && handleEventTypeSelect(eventType.value)}
                              className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                                isSelected ? 'bg-blue-500 text-white' : 'hover:bg-slate-800 text-slate-200'
                              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span>{eventType.icon}</span>
                              <span>{eventType.label}</span>
                              {isDisabled && <span className="text-xs ml-auto">(finns redan)</span>}
                            </div>
                          );
                        })}
                        {getFilteredEventTypes().length === 0 && (
                          <div className="px-3 py-2 text-slate-400 text-sm">
                            Inga matchande händelsetyper
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {newEvent.type && EVENT_TYPES.find(e => e.value === newEvent.type)?.unique && 
                   editingEventIndex === null && 
                   !canAddEventType(newEvent.type) && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Denna händelse kan bara läggas till en gång</p>
                  )}
                </div>
                {/* Partner dropdown for Vigsel */}
                {newEvent.type === 'Vigsel' && person.relations?.partners?.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Partner</label>
                    <select
                      value={newEvent.partnerId || ''}
                      onChange={e => setNewEvent({ ...newEvent, partnerId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Välj partner...</option>
                      {person.relations.partners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Datum</label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"/>
                        <input 
                          type="text" 
                          placeholder="t.ex. 21 nov 1980, från 1950, ca 1920"
                          value={newEvent.date}
                          onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                          className="w-full bg-slate-900 border border-slate-600 rounded pl-9 p-2 text-slate-200 focus:border-blue-500 focus:outline-none"
                          onBlur={(e) => setNewEvent({...newEvent, date: parseAndFormatDate(e.target.value)})}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Format: ÅÅÅÅ-MM-DD, eller skriv naturligt</p>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Plats</label>
                      <PlacePicker
                        value={newEvent.placeId || ''}
                        displayValue={newEvent.place || ''}
                        allPlaces={allPlaces || []}
                        onChange={(placeId, placeObject) => {
                          const placeName = placeObject ? (placeObject.name || placeObject.ortnamn || placeObject.sockenstadnamn || '') : '';
                          setNewEvent({...newEvent, placeId, place: placeName, placeData: placeObject});
                        }}
                      />
                   </div>
                </div>
                
                {/* Källor */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase">Källor</label>
                    <button 
                      onClick={() => {
                        // Öppna source drawer UTAN att spara personen
                        // Använd ett speciellt eventId som signalerar att vi är i edit-läge
                        if (onOpenSourceDrawer) {
                          // Sätt en global callback som source drawer kan använda
                          window.__addSourceToEvent = (sourceId) => {
                            setNewEvent(prev => ({
                              ...prev,
                              sources: prev.sources.includes(sourceId) 
                                ? prev.sources 
                                : [...prev.sources, sourceId]
                            }));
                          };
                          
                          // Öppna drawer med ett speciellt flag
                          onOpenSourceDrawer(person.id, '__editing__');
                        } else {
                          setSourceModalOpen(true);
                        }
                      }}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-blue-400 px-2 py-1 rounded flex items-center gap-1"
                    >
                      <Plus size={12}/> Lägg till källa
                    </button>
                  </div>
                  
                  {newEvent.sources && newEvent.sources.length > 0 ? (
                    <div className="space-y-2">
                      {newEvent.sources.map((sourceId, idx) => {
                        const source = allSources?.find(s => s.id === sourceId);
                        if (!source) return null;
                        
                        return (
                          <div key={sourceId} className="bg-slate-800 p-3 rounded text-sm border border-slate-700 flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-200 mb-1">
                                {source.title || 'Ingen titel'}
                                {source.location && ` / ${source.location}`}
                                {source.volume && ` vol. ${source.volume}`}
                                {source.year && ` (${source.year})`}
                              </p>
                              {source.aid && (
                                <a 
                                  href={`https://sok.riksarkivet.se/bildvisning/${source.aid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  AID: {source.aid}
                                </a>
                              )}
                            </div>
                            <div className="flex gap-2 ml-3">
                              <button 
                                onClick={() => setNewEvent({
                                  ...newEvent, 
                                  sources: newEvent.sources.filter(id => id !== sourceId)
                                })}
                                className="text-slate-400 hover:text-red-600 p-1"
                                title="Ta bort källa"
                              >
                                <Trash2 size={14}/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Ingen källa tillagd</p>
                  )}
                </div>
                
                {/* Noteringar */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Noteringar</label>
                  <textarea
                    value={newEvent.notes}
                    onChange={(e) => setNewEvent({...newEvent, notes: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 focus:border-blue-500 focus:outline-none text-sm resize-none"
                    rows="3"
                    placeholder="Lägg till noter för denna händelse..."
                  />
                </div>
              </div>
              <div className="bg-slate-800 p-4 border-t border-slate-700 flex justify-end gap-3">
                 <button onClick={() => {
                   setEventModalOpen(false);
                   setEditingEventIndex(null);
                 }} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Avbryt</button>
                 <button 
                   onClick={handleSaveEvent}
                   className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold"
                 >
                   {editingEventIndex !== null ? 'Uppdatera' : 'Lägg till'} händelse
                 </button>
              </div>
          </div>
        </WindowFrame>
      )}

      {/* --- SOURCE MODAL (SUB-MODAL) --- */}
      <SourceModal 
        isOpen={isSourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        onAdd={handleAddSource}
        eventType={newEvent.type}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; border: 2px solid #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </>
  );
}
