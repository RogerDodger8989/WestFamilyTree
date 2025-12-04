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
  'Födelse', 'Dop', 'Konfirmation', 'Vigsel', 'Skilsmässa', 
  'Bosatt', 'Emigration', 'Immigration', 'Död', 'Begravning'
];

// Enkel datumformatterare
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

  const handleAdd = () => {
    if (source.title.trim()) {
      onAdd(source);
      setSource({ type: 'Arkiv', title: '', author: '', year: '', citation: '', url: '' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white border border-gray-300 rounded-lg shadow-2xl w-full max-w-md p-0 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
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

export default function EditPersonModal({ person: initialPerson, allPlaces, onSave, onClose }) {
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
  const [person, setPerson] = useState(initialPerson || {
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
  });

  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [isSourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingEventIndex, setEditingEventIndex] = useState(null);
  const [newEvent, setNewEvent] = useState({ 
    id: `evt_${Date.now()}`,
    type: 'Bosatt', 
    date: '', 
    place: '',
    placeId: '',
    sources: [],
    images: 0,
    notes: ''
  });

  const [tagInput, setTagInput] = useState('');

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
      type: 'Bosatt', 
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
      type: 'Bosatt', 
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
                  <div className="col-span-3">
                    <div className="aspect-[3/4] bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center relative group cursor-pointer overflow-hidden">
                       {person.media?.length > 0 ? (
                         <img src={person.media[0].url} alt="Profil" className="w-full h-full object-cover" />
                       ) : (
                         <User size={64} className="text-gray-400" />
                       )}
                       <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <Camera className="text-white" />
                       </div>
                    </div>
                  </div>
                  <div className="col-span-9 grid grid-cols-2 gap-4 content-start">
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
                          <tr key={evt.id || idx} className="hover:bg-gray-50 transition-colors group">
                            <td className="p-3 font-medium text-gray-900">{evt.type}</td>
                            <td className="p-3 font-mono text-gray-700">{evt.date || '-'}</td>
                            <td className="p-3 text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                               <MapPin size={12} /> {evt.place || '-'}
                            </td>
                            <td className="p-3">
                              <div className="flex justify-center gap-3 text-xs text-gray-600">
                                <span className={`flex items-center gap-1 ${evt.sources?.length > 0 ? 'text-gray-900' : ''}`}><LinkIcon size={12}/> {evt.sources?.length || 0}</span>
                                <span className={`flex items-center gap-1 ${evt.images > 0 ? 'text-gray-900' : ''}`}><ImageIcon size={12}/> {evt.images || 0}</span>
                              </div>
                            </td>
                            <td className="p-3 text-right flex gap-2 justify-end">
                              <button onClick={() => handleEditEvent(idx)} className="text-gray-600 hover:text-gray-900 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => handleDeleteEvent(idx)} className="text-gray-600 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
           <div className="bg-white border border-gray-300 rounded-lg shadow-2xl w-full max-w-lg p-0 overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-900">{editingEventIndex !== null ? 'Redigera' : 'Lägg till'} händelse</h3>
                <button onClick={() => setEventModalOpen(false)} className="text-gray-600 hover:text-gray-900"><X size={20}/></button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Händelsetyp</label>
                  <select 
                    value={newEvent.type}
                    onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                    className="w-full bg-white border border-gray-300 rounded p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                  >
                    {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Datum</label>
                      <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500"/>
                        <input 
                          type="text" 
                          placeholder="ÅÅÅÅ-MM-DD"
                          value={newEvent.date}
                          onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                          className="w-full bg-white border border-gray-300 rounded pl-9 p-2 text-gray-900 focus:border-blue-500 focus:outline-none"
                          onBlur={(e) => setNewEvent({...newEvent, date: standardizeDate(e.target.value)})}
                        />
                      </div>
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
                      onClick={() => setSourceModalOpen(true)}
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-blue-600 px-2 py-1 rounded flex items-center gap-1"
                    >
                      <Plus size={12}/> Lägg till källa
                    </button>
                  </div>
                  
                  {newEvent.sources && newEvent.sources.length > 0 ? (
                    <div className="space-y-2">
                      {newEvent.sources.map((src, idx) => (
                        <div key={src.id} className="bg-gray-50 p-2 rounded text-xs border border-gray-200 flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{src.title}</p>
                            <p className="text-gray-700">{src.type}</p>
                          </div>
                          <button 
                            onClick={() => setNewEvent({
                              ...newEvent, 
                              sources: newEvent.sources.filter((_, i) => i !== idx)
                            })}
                            className="text-gray-600 hover:text-red-600"
                          >
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      ))}
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
