import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, User, Users, Image as ImageIcon, FileText, 
  Activity, Tag, Plus, Trash2, Calendar, MapPin, 
  Link as LinkIcon, Camera, Edit3, AlertCircle, Check, 
  ChevronDown, MoreHorizontal, Search, Globe
} from 'lucide-react';
import PlacePicker from './PlacePicker.jsx';

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
  <div className="flex gap-1 bg-gray-100 p-1 rounded-t border-b border-gray-300 mb-0">
    {['B', 'I', 'U'].map(cmd => (
      <button key={cmd} className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded text-xs font-bold text-gray-700">
        {cmd}
      </button>
    ))}
    <div className="w-px h-4 bg-gray-300 mx-1 self-center"></div>
    <button className="px-2 h-6 flex items-center justify-center hover:bg-gray-200 rounded text-xs text-gray-700">H1</button>
    <button className="px-2 h-6 flex items-center justify-center hover:bg-gray-200 rounded text-xs text-gray-700">Lista</button>
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
        className="bg-white border border-gray-300 rounded-lg shadow-2xl w-full max-w-md p-0 overflow-hidden"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxWidth: '500px'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="modal-header bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center cursor-move">
          <h3 className="font-bold text-gray-900">Lägg till källa</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Källtyp</label>
            <select 
              value={source.type} 
              onChange={e => setSource({...source, type: e.target.value})}
              className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
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
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Titel</label>
            <input 
              type="text"
              value={source.title}
              onChange={e => setSource({...source, title: e.target.value})}
              className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="Källans titel"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Författare</label>
            <input 
              type="text"
              value={source.author}
              onChange={e => setSource({...source, author: e.target.value})}
              className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="Namn"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">År</label>
            <input 
              type="text"
              value={source.year}
              onChange={e => setSource({...source, year: e.target.value})}
              className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="ÅÅÅÅ"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Citat/Referens</label>
            <textarea
              value={source.citation}
              onChange={e => setSource({...source, citation: e.target.value})}
              className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none resize-none"
              rows="3"
              placeholder="Relevanta citat eller sidnummer"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">URL (valfritt)</label>
            <input 
              type="url"
              value={source.url}
              onChange={e => setSource({...source, url: e.target.value})}
              className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
              placeholder="https://..."
            />
          </div>
        </div>
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Avbryt</button>
          <button 
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold"
          >
            Lägg till källa
          </button>
        </div>
      </div>
    </div>
  );
};

// --- HUVUDKOMPONENT ---

export default function EditPersonModal({ person: initialPerson, allPlaces, onSave, onClose, onOpenSourceDrawer, allSources }) {
  const [activeTab, setActiveTab] = useState('info');
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef(null);

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
    if (editingEventIndex !== null) {
      const updated = person.events.map((e, i) => i === editingEventIndex ? newEvent : e);
      setPerson({ ...person, events: updated });
    } else {
      setPerson({ ...person, events: [...person.events, newEvent] });
    }
    setEventModalOpen(false);
    setNewEvent({ 
      id: `evt_${Date.now()}`,
      type: 'Födelse', 
      date: '', 
      place: '',
      placeId: '',
      sources: [],
      images: 0,
      notes: ''
    });
  };

  const handleDeleteEvent = (index) => {
    setPerson({ ...person, events: person.events.filter((_, i) => i !== index) });
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

  // Image paste handler
  useEffect(() => {
    const handlePaste = (e) => {
      if (activeTab !== 'media') return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          const fakeUrl = URL.createObjectURL(blob);
          setPerson(prev => ({
            ...prev,
            media: [...prev.media, { id: `img_${Date.now()}`, url: fakeUrl, name: 'Urklipp.png', type: 'image' }]
          }));
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

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
      {/* MODAL CONTAINER */}
      <div
        ref={modalRef}
        className="w-full max-w-5xl h-[85vh] bg-white border border-gray-300 rounded-xl shadow-xl flex flex-col overflow-hidden"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          position: 'fixed',
          width: '85vw',
          maxWidth: '1280px',
          zIndex: 4000
        }}
        onMouseDown={handleMouseDown}
      >        {/* HEADER */}
        <div className="modal-header h-16 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-6 shrink-0 cursor-move">
          <div className="flex items-center gap-4 select-none">
            <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden border-2 border-gray-400 pointer-events-none">
              {person.media?.length > 0 ? (
                <img src={person.media[0].url} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-full h-full p-1 text-gray-500" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {person.firstName} {person.lastName} <span className="text-gray-500 font-normal text-sm">({person.refId || 'Ny'})</span>
              </h1>
              <p className="text-xs text-gray-600">{person.birthDate || '?'} — {person.deathDate || 'Levande'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <nav className="flex bg-gray-100 p-1 rounded-lg mr-4">
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
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all ${
                      activeTab === tab.id 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    <tab.icon size={14} /> {tab.label}
                  </button>
                ))}
             </nav>
             <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-600 hover:text-gray-900 cursor-pointer"><X size={20}/></button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-hidden flex bg-white relative">
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {/* FLIK: INFO */}
            {activeTab === 'info' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Grunddata */}
                <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-2">
                    <div className="aspect-[3/4] bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center relative group cursor-pointer overflow-hidden">
                       {person.media?.length > 0 ? (
                         <img src={person.media[0].url} alt="Profil" className="w-full h-full object-cover" />
                       ) : (
                         <User size={40} className="text-gray-400" />
                       )}
                       <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera size={20} className="text-white" />
                       </div>
                    </div>
                  </div>
                  <div className="col-span-10 grid grid-cols-2 gap-4 content-start">
                    <div>
                      <label className="text-xs uppercase font-bold text-gray-600">Förnamn</label>
                      <input type="text" value={person.firstName} onChange={e => setPerson({...person, firstName: e.target.value})} className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold text-gray-600">Efternamn</label>
                      <input type="text" value={person.lastName} onChange={e => setPerson({...person, lastName: e.target.value})} className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold text-gray-600">Kön</label>
                      <select value={person.sex} onChange={e => setPerson({...person, sex: e.target.value})} className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none">
                        <option value="M">Man</option>
                        <option value="K">Kvinna</option>
                        <option value="U">Okänd</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-bold text-gray-600">Ref Nr</label>
                      <input type="text" value={person.refId} onChange={e => setPerson({...person, refId: e.target.value})} className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none" />
                    </div>
                  </div>
                </div>

                {/* Livshändelser */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                      <Activity size={16} className="text-blue-600"/> Livshändelser
                    </h3>
                    <button 
                      onClick={handleAddEvent}
                      className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
                    >
                      <Plus size={14}/> Lägg till händelse
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                        <tr>
                          <th className="p-3">Typ</th>
                          <th className="p-3">Datum</th>
                          <th className="p-3">Plats</th>
                          <th className="p-3 text-center">Info</th>
                          <th className="p-3 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {person.events?.map((evt, idx) => (
                          <tr 
                            key={evt.id || idx} 
                            onClick={() => {
                              if (editingEventIndex === null) {
                                setSelectedEventIndex(selectedEventIndex === idx ? null : idx);
                              }
                            }}
                            className={`hover:bg-gray-50 transition-colors group cursor-pointer ${
                              selectedEventIndex === idx && editingEventIndex === null ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                            }`}
                          >
                            <td className="p-3 font-medium text-gray-900">{evt.type}</td>
                            <td className="p-3 font-mono text-gray-700">{evt.date || '-'}</td>
                            <td className="p-3 text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                               <MapPin size={12} /> {evt.place || '-'}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-3 text-xs text-gray-600">
                                <span 
                                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${evt.sources?.length > 0 ? 'text-gray-900' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setSelectedEventIndex(idx); }}
                                >
                                  <LinkIcon size={12}/> {evt.sources?.length || 0}
                                </span>
                                <span 
                                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${evt.notes ? 'text-gray-900' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); }}
                                  title={evt.notes || ''}
                                >
                                  <FileText size={12}/> {evt.notes ? 1 : 0}
                                </span>
                                <span 
                                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${evt.images > 0 ? 'text-gray-900' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); }}
                                >
                                  <ImageIcon size={12}/> {evt.images || 0}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right flex gap-2 justify-end">
                              <button onClick={(e) => { e.stopPropagation(); handleEditEvent(idx); }} className="text-gray-600 hover:text-gray-900 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(idx); }} className="text-gray-600 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {(!person.events || person.events.length === 0) && (
                          <tr>
                            <td colSpan="5" className="p-4 text-center text-gray-600 text-sm">Inga händelser tillagda än</td>
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
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <div className="flex justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-900 uppercase">Föräldrar</h4>
                      <button className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"><Plus size={12}/> Lägg till</button>
                   </div>
                   {person.relations?.parents?.length > 0 ? (
                     person.relations.parents.map((p, idx) => (
                       <div key={idx} className="flex items-center justify-between bg-white p-2 rounded mb-2 border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600"><User size={16}/></div>
                            <span className="text-gray-900 font-medium">{p.name}</span>
                          </div>
                          <select className="bg-white border border-gray-300 text-xs rounded px-2 py-1 text-gray-900">
                            {RELATION_TYPES.parent.map(r => <option key={r}>{r}</option>)}
                          </select>
                       </div>
                     ))
                   ) : (
                     <p className="text-xs text-gray-600">Ingen förälder tillagd</p>
                   )}
                </div>

                {/* Partners */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <div className="flex justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-900 uppercase">Partner</h4>
                      <button className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"><Plus size={12}/> Lägg till</button>
                   </div>
                   {person.relations?.partners?.length > 0 ? (
                     person.relations.partners.map((p, idx) => (
                       <div key={idx} className="flex items-center justify-between bg-white p-2 rounded mb-2 border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600"><User size={16}/></div>
                            <span className="text-gray-900 font-medium">{p.name}</span>
                          </div>
                          <select className="bg-white border border-gray-300 text-xs rounded px-2 py-1 text-gray-900">
                            {RELATION_TYPES.partner.map(r => <option key={r}>{r}</option>)}
                          </select>
                       </div>
                     ))
                   ) : (
                     <p className="text-xs text-gray-600">Ingen partner tillagd</p>
                   )}
                </div>

                {/* Barn */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <div className="flex justify-between mb-2">
                      <h4 className="text-sm font-bold text-gray-900 uppercase">Barn</h4>
                      <button className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"><Plus size={12}/> Lägg till</button>
                   </div>
                   {person.relations?.children?.length > 0 ? (
                     person.relations.children.map((c, idx) => (
                       <div key={idx} className="flex items-center justify-between bg-white p-2 rounded mb-2 border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600"><User size={16}/></div>
                            <span className="text-gray-900 font-medium">{c.name}</span>
                          </div>
                          <select className="bg-white border border-gray-300 text-xs rounded px-2 py-1 text-gray-900">
                             {RELATION_TYPES.child.map(r => <option key={r}>{r}</option>)}
                          </select>
                       </div>
                     ))
                   ) : (
                     <p className="text-xs text-gray-600">Inget barn tillagd</p>
                   )}
                </div>
              </div>
            )}

            {/* FLIK: MEDIA */}
            {activeTab === 'media' && (
              <div className="animate-in fade-in duration-300 h-full flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-xs text-gray-600">Dra och släpp filer här eller klistra in (Ctrl+V).</p>
                </div>
                
                <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-wrap content-start p-4 gap-4 overflow-y-auto">
                   {person.media?.map(m => (
                     <div key={m.id} className="w-32 group relative">
                       <div className="aspect-square bg-gray-200 rounded border border-gray-300 overflow-hidden relative">
                         <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                           <button className="p-1 bg-gray-600 rounded hover:bg-blue-600 text-white"><Edit3 size={12}/></button>
                           <button className="p-1 bg-gray-600 rounded hover:bg-red-600 text-white"><Trash2 size={12}/></button>
                         </div>
                       </div>
                       <p className="text-xs text-center mt-1 truncate text-gray-700">{m.name}</p>
                     </div>
                   ))}
                   
                   <div className="w-32 aspect-square flex flex-col items-center justify-center border-2 border-gray-300 border-dashed rounded hover:border-gray-400 hover:bg-gray-100 transition-colors cursor-pointer text-gray-600 hover:text-gray-900">
                      <Plus size={24} />
                      <span className="text-xs mt-2">Lägg till</span>
                   </div>
                </div>
              </div>
            )}

            {/* FLIK: FORSKNING */}
            {activeTab === 'research' && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-between mb-4">
                   <h3 className="text-md font-bold text-gray-900 uppercase">Forskningsuppgifter</h3>
                   <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-1">
                     <Plus size={14}/> Ny uppgift
                   </button>
                </div>

                <div className="space-y-3">
                   {person.research?.map((task, idx) => {
                     const prio = PRIORITY_LEVELS.find(p => p.level === task.priority) || PRIORITY_LEVELS[0];
                     return (
                       <div key={idx} className="bg-white border border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                             <div className="flex-1">
                               <input type="text" defaultValue={task.task} className="bg-transparent font-medium text-gray-900 w-full focus:outline-none focus:border-b border-blue-500" />
                             </div>
                             <div className="flex gap-2 ml-4">
                               <select 
                                 className={`bg-white border border-gray-300 text-xs rounded px-2 py-1 text-gray-900 ${prio.color}`}
                                 defaultValue={task.priority}
                               >
                                 {PRIORITY_LEVELS.map(p => (
                                   <option key={p.level} value={p.level}>{p.level} - {p.label}</option>
                                 ))}
                               </select>
                               <button className="text-gray-600 hover:text-red-600"><Trash2 size={16}/></button>
                             </div>
                          </div>
                          
                          <div className="bg-gray-50 rounded border border-gray-200 mt-2">
                            <EditorToolbar />
                            <textarea 
                              className="w-full bg-transparent text-sm text-gray-900 p-2 focus:outline-none min-h-[60px] resize-y"
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
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Hantera Taggar</label>
                <div className="flex items-center gap-2 mb-4">
                  <input 
                    type="text" 
                    className="bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 w-64 focus:outline-none focus:border-blue-500"
                    placeholder="Skriv tagg och tryck Enter..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={addTag}
                  />
                  <p className="text-xs text-gray-600">Separera med komma eller enter.</p>
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
            {activeTab === 'notes' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                 <div className="flex justify-end">
                    <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded flex items-center gap-1"><Plus size={14}/> Ny notering</button>
                 </div>
                 {person.notes?.map((note, idx) => (
                   <div key={idx} className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 p-2 border-b border-gray-200 flex justify-between items-center">
                         <input type="text" defaultValue={note.title} className="bg-transparent font-bold text-sm text-gray-900 focus:outline-none" />
                         <div className="flex gap-2">
                           <button className="text-gray-600 hover:text-red-600"><Trash2 size={14}/></button>
                         </div>
                      </div>
                      <EditorToolbar />
                      <textarea 
                        className="w-full bg-gray-50 text-sm text-gray-900 p-3 focus:outline-none min-h-[150px] resize-y"
                        defaultValue={note.content}
                      />
                   </div>
                 ))}
              </div>
            )}

          </div>
        </div>

        {/* DETAIL BLOCK - visa källa-info för vald händelse */}
        {selectedEventIndex !== null && editingEventIndex === null && person.events?.[selectedEventIndex] && (
          <div className="bg-white border-t border-gray-200 p-4 max-h-40 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
              <h4 className="text-sm font-bold text-gray-900">
                {person.events[selectedEventIndex].type} 
                {person.events[selectedEventIndex].date && ` - ${person.events[selectedEventIndex].date}`}
              </h4>
              {/* INFO-rad kopiad från livshändelser */}
              <div className="flex gap-3 text-xs text-gray-600">
                <span 
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${person.events[selectedEventIndex].sources?.length > 0 ? 'text-gray-900' : ''}`}
                >
                  <LinkIcon size={12}/> {person.events[selectedEventIndex].sources?.length || 0}
                </span>
                <span 
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${person.events[selectedEventIndex].notes ? 'text-gray-900' : ''}`}
                  title={person.events[selectedEventIndex].notes || ''}
                >
                  <FileText size={12}/> {person.events[selectedEventIndex].notes ? 1 : 0}
                </span>
                <span 
                  className={`flex items-center gap-1 cursor-pointer hover:text-blue-600 ${person.events[selectedEventIndex].images > 0 ? 'text-gray-900' : ''}`}
                >
                  <ImageIcon size={12}/> {person.events[selectedEventIndex].images || 0}
                </span>
              </div>
            </div>
            
            {person.events[selectedEventIndex].sources && person.events[selectedEventIndex].sources.length > 0 ? (
              <div className="space-y-2">
                {person.events[selectedEventIndex].sources.map((sourceId) => {
                  const source = allSources?.find(s => s.id === sourceId);
                  if (!source) return null;
                  
                  return (
                    <div key={sourceId} className="bg-gray-50 p-2 rounded border border-gray-200 flex items-start gap-3">
                      {/* Thumbnails */}
                      <div className="flex gap-1 items-start">
                        {source.images && source.images.length > 0 ? (
                          source.images.slice(0, 3).map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img 
                                src={img.url || img.thumbnail || img} 
                                alt="Thumbnail" 
                                className="h-8 w-8 object-cover rounded cursor-pointer border border-gray-300 hover:border-blue-500"
                                onClick={() => {
                                  const fullUrl = img.url || img;
                                  window.open(fullUrl, '_blank');
                                }}
                              />
                              <div className="absolute hidden group-hover:block z-50 bg-white border border-gray-300 rounded shadow-lg p-1 left-0 top-10">
                                <img src={img.url || img} alt="Preview" className="h-32 w-32 object-cover rounded" />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                            <ImageIcon size={12} />
                          </div>
                        )}
                      </div>
                      
                      {/* Source info */}
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-gray-900">
                          {source.title || 'Ingen titel'}
                          {source.location && ` / ${source.location}`}
                          {source.volume && ` vol. ${source.volume}`}
                          {source.year && ` (${source.year})`}
                        </div>
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
                        {source.notes && (
                          <div className="mt-1 text-gray-600 text-xs italic line-clamp-1">
                            {source.notes}
                          </div>
                        )}
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex gap-1 ml-2 items-center text-xs">
                        {/* Noter-ikon */}
                        {source.notes && (
                          <div className="relative group">
                            <button 
                              className="text-gray-600 hover:text-blue-600 p-1 flex items-center gap-0.5"
                              title="Noter"
                            >
                              <FileText size={12} />
                              <span className="text-gray-600">1</span>
                            </button>
                            <div className="absolute hidden group-hover:block z-50 bg-gray-900 text-white text-xs rounded shadow-lg p-2 right-0 top-6 min-w-max max-w-xs whitespace-normal">
                              {source.notes}
                              <div className="absolute top-0 right-2 transform -translate-y-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Bild-ikon */}
                        {source.images && source.images.length > 0 && (
                          <button 
                            className="text-gray-600 hover:text-blue-600 p-1 flex items-center gap-0.5"
                            title={`${source.images.length} bilder`}
                          >
                            <ImageIcon size={12} />
                            <span className="text-gray-600">{source.images.length}</span>
                          </button>
                        )}
                        
                        <button 
                          onClick={() => {
                            // TODO: Redigera källa
                            console.log('Edit source:', source);
                          }}
                          className="text-gray-600 hover:text-blue-600 p-1"
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
                          className="text-gray-600 hover:text-red-600 p-1"
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
              <p className="text-xs text-gray-600">Ingen källa kopplad till denna händelse</p>
            )}
          </div>
        )}

        {/* FOOTER */}
        <div className="h-16 bg-gray-50 border-t border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="text-xs text-gray-600">
            Senast ändrad: {new Date().toISOString().split('T')[0]}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Avbryt</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium shadow-lg transition-all transform hover:scale-[1.02]">
              <Save size={18} /> Spara Ändringar
            </button>
          </div>
        </div>
      </div>

      {/* --- EVENT MODAL (SUB-MODAL) --- */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-[4050] flex items-center justify-center bg-black/30">
           <div 
             ref={eventModalRef}
             className="bg-white border border-gray-300 rounded-lg shadow-2xl w-full max-w-lg p-0 overflow-hidden"
             style={{
               position: 'fixed',
               left: `${eventModalPosition.x}px`,
               top: `${eventModalPosition.y}px`,
               maxWidth: '600px'
             }}
             onMouseDown={handleEventModalMouseDown}
           >
              <div className="modal-header bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center cursor-move">
                <h3 className="font-bold text-gray-900">{editingEventIndex !== null ? 'Redigera' : 'Lägg till'} händelse</h3>
                <button onClick={() => setEventModalOpen(false)} className="text-gray-600 hover:text-gray-900"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div ref={eventTypeSearchRef} className="relative">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Händelsetyp</label>
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
                      className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                    {eventTypeSearchOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
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
                                isSelected ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'
                              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span>{eventType.icon}</span>
                              <span>{eventType.label}</span>
                              {isDisabled && <span className="text-xs ml-auto">(finns redan)</span>}
                            </div>
                          );
                        })}
                        {getFilteredEventTypes().length === 0 && (
                          <div className="px-3 py-2 text-gray-500 text-sm">
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
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Datum</label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"/>
                        <input 
                          type="text" 
                          placeholder="t.ex. 21 nov 1980, från 1950, ca 1920"
                          value={newEvent.date}
                          onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                          className="w-full bg-white border border-gray-300 rounded pl-9 p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                          onBlur={(e) => setNewEvent({...newEvent, date: parseAndFormatDate(e.target.value)})}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Format: ÅÅÅÅ-MM-DD, eller skriv naturligt</p>
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Plats</label>
                      <PlacePicker
                        value={newEvent.placeId || ''}
                        allPlaces={allPlaces || []}
                        onChange={(placeId) => {
                          const place = (allPlaces || []).find(p => p.id === placeId);
                          const placeName = place ? (place.name || place.ortnamn || place.sockenstadnamn || '') : '';
                          setNewEvent({...newEvent, placeId, place: placeName});
                        }}
                      />
                   </div>
                </div>
                
                {/* Källor */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-gray-600 uppercase">Källor</label>
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
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-blue-600 px-2 py-1 rounded flex items-center gap-1"
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
                          <div key={sourceId} className="bg-gray-50 p-3 rounded text-sm border border-gray-200 flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-1">
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
                                onClick={() => {
                                  // TODO: Öppna redigera källa modal
                                  console.log('Edit source:', source);
                                }}
                                className="text-gray-600 hover:text-blue-600 p-1"
                                title="Redigera källa"
                              >
                                <Edit3 size={14}/>
                              </button>
                              <button 
                                onClick={() => setNewEvent({
                                  ...newEvent, 
                                  sources: newEvent.sources.filter(id => id !== sourceId)
                                })}
                                className="text-gray-600 hover:text-red-600 p-1"
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
                    <p className="text-xs text-gray-600">Ingen källa tillagd</p>
                  )}
                </div>
                
                {/* Noteringar */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Noteringar</label>
                  <textarea
                    value={newEvent.notes}
                    onChange={(e) => setNewEvent({...newEvent, notes: e.target.value})}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none text-sm resize-none"
                    rows="3"
                    placeholder="Lägg till noter för denna händelse..."
                  />
                </div>
              </div>
              <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
                 <button onClick={() => setEventModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Avbryt</button>
                 <button 
                   onClick={handleSaveEvent}
                   className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold"
                 >
                   {editingEventIndex !== null ? 'Uppdatera' : 'Lägg till'} händelse
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* --- SOURCE MODAL (SUB-MODAL) --- */}
      <SourceModal 
        isOpen={isSourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        onAdd={handleAddSource}
        eventType={newEvent.type}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; border: 2px solid #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </>
  );
}
