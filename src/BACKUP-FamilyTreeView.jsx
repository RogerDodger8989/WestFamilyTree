import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit2, User, Heart, Network, HeartCrack, PlusCircle, Trash2, Users, 
  Copy, Plus, Minus, Home, Search, ArrowLeft, ArrowRight, AlertTriangle, 
  List, X, MapPin, Star, Baby, UserPlus, GitFork, Bookmark, Maximize2, Minimize2, Settings,
  Link as LinkIcon, Layers, HeartHandshake, HelpCircle
} from 'lucide-react';
import WindowFrame from './WindowFrame.jsx';
import Button from './Button.jsx';
import SelectFatherModal from './SelectFatherModal.jsx';
import { useApp } from './AppContext';
import MediaImage from './components/MediaImage.jsx';

// --- KONSTANTER ---
const CARD_WIDTH_NORMAL = 400;
const FOCUS_WIDTH_NORMAL = 440; 
const CARD_HEIGHT_NORMAL = 200;
const FOCUS_HEIGHT_NORMAL = 230;
const CARD_WIDTH_COMPACT = 280;
const FOCUS_WIDTH_COMPACT = 320;
const CARD_HEIGHT_COMPACT = 140;
const FOCUS_HEIGHT_COMPACT = 170;
const INDENT_X = 60;   
const GAP_Y = 160;     
const SIBLING_GAP = 340;

// ANVÄNDARENS NYA CONFIG FÖR VERTIK AL LAYOUT
const CONFIG_USER = {
  CARD_WIDTH: 180,
  CARD_HEIGHT: 60,
  GAP_X: 40,
  GAP_Y: 70,
  INDENT_X: 60,
  STEP_Y: 80,
};

// --- VALIDERING ---
const validatePerson = (person) => {
    const warnings = [];
    if (!person.birthDate) return warnings;
    const birth = new Date(person.birthDate);
    if (person.deathDate) {
        const death = new Date(person.deathDate);
        if (death < birth) warnings.push("Datafel: Död före födelse");
    }
    return warnings;
};

// --- HJÄLPFUNKTIONER ---
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

// Ortogonala linjer (90-graders svängar) för horisontell layout
const getPath = (source, target, type) => {
  const { x: sx, y: sy } = source;
  const { x: tx, y: ty } = target;
  
  // ============================================================================
  // MANHATTAN ROUTING - ENDAST ortogonala linjer (V och H)
  // ============================================================================
  
  // ELBOW-UP: Syskon → Föräldrar (UPP → HÖGER/VÄNSTER → UPP)
  if (type === 'elbow-up') {
    const midY = sy - 30;
    return `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
  }
  
  // STEP-LEFT: Fokusperson → Partner (NER → HÖGER/VÄNSTER)
  if (type === 'step-left') {
    return `M ${sx} ${sy} V ${ty} H ${tx}`;
  }
  
  // STEP-INDENT: Partner → Barn (NER → HÖGER/VÄNSTER)
  if (type === 'step-indent') {
    return `M ${sx} ${sy} V ${ty} H ${tx}`;
  }
  
  // STEP-LINK: Ortogonal elbow
  if (type === 'step-link') {
    const midY = (sy + ty) / 2;
    return `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
  }
  
  // STRAIGHT: ENDAST vertikal eller horisontell - INGEN diagonal!
  if (type === 'straight') {
    if (sx === tx) {
      // Vertikal
      return `M ${sx} ${sy} V ${ty}`;
    } else if (sy === ty) {
      // Horisontell
      return `M ${sx} ${sy} H ${tx}`;
    } else {
      // Diagonal → Manhattan routing
      const midY = (sy + ty) / 2;
      return `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
    }
  }
  
  // ORTHOGONAL-HORIZONTAL-FIRST: Horisontell först, sedan vertikal
  if (type === 'orthogonal-horizontal-first') {
    const midX = (sx + tx) / 2;
    return `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
  }
  
  // ORTHOGONAL-VERTICAL-FIRST: Vertikal först, sedan horisontell
  if (type === 'orthogonal-vertical-first') {
    const midY = (sy + ty) / 2;
    return `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
  }
  
  // CHILD-FORK: Från barn horisontellt, sedan upp, sedan horisontellt till föräldrar
  if (type === 'child-fork') {
    const horizontalOffset = 50;
    const parentY = ty;
    return `M ${sx} ${sy} H ${sx + horizontalOffset} V ${parentY} H ${tx}`;
  }
  
  // PARTNER-HORIZONTAL: Horisontell linje mellan partners
  if (type === 'partner-horizontal') {
    return `M ${sx} ${sy} H ${tx}`;
  }
  
  // PARTNER-VERTICAL: Vertikal linje
  if (type === 'partner-vertical') {
    return `M ${sx} ${sy} V ${ty}`;
  }
  
  // FALLBACK: Manhattan routing - INGEN diagonal!
  if (sx === tx) {
    return `M ${sx} ${sy} V ${ty}`;
  } else if (sy === ty) {
    return `M ${sx} ${sy} H ${tx}`;
  } else {
    // Default elbow för diagonala fall
    const midY = (sy + ty) / 2;
    return `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
  }
};

// Beräkna ålder eller livslängd
const calculateAge = (birthDate, deathDate) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const end = deathDate ? new Date(deathDate) : new Date();
    if (isNaN(birth.getTime())) return null;
    
    let years = end.getFullYear() - birth.getFullYear();
    const monthDiff = end.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
        years--;
    }
    return years >= 0 ? years : null;
};

// Beräkna status (komplett/ofullständig)
const calculateStatus = (person, birthDate, deathDate) => {
    let score = 0;
    let maxScore = 0;
    
    // Födelsedatum
    maxScore += 2;
    if (birthDate) score += 2;
    
    // Födelseplats
    maxScore += 1;
    const birthEvent = person.events?.find(e => e.type === 'BIRT' || e.type === 'Födelse');
    if (birthEvent?.place) score += 1;
    
    // Dödsdatum (om personen är död)
    if (deathDate) {
        maxScore += 2;
        score += 2;
        
        // Dödsplats
        maxScore += 1;
        const deathEvent = person.events?.find(e => e.type === 'DEAT' || e.type === 'Död');
        if (deathEvent?.place) score += 1;
    }
    
    // Profilbild
    maxScore += 1;
    if (person.media && person.media.length > 0) score += 1;
    
    // Yrke/titel
    maxScore += 1;
    if (person.occupation || person.title) score += 1;
    
    // Förnamn och efternamn
    maxScore += 2;
    if (person.firstName) score += 1;
    if (person.lastName) score += 1;
    
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    
    if (percentage >= 80) return 'complete'; // Grön
    if (percentage >= 50) return 'partial'; // Gul
    return 'incomplete'; // Röd
};

// Konvertera databas-person till visningsformat
const convertPersonForDisplay = (person) => {
    if (!person) return null;
    
    // Hämta födelse/dödsdata från events
    const birthEvent = person.events?.find(e => e.type === 'BIRT' || e.type === 'Födelse');
    const deathEvent = person.events?.find(e => e.type === 'DEAT' || e.type === 'Död');
    
    const birthDate = birthEvent?.date || '';
    const deathDate = deathEvent?.date || '';
    const age = calculateAge(birthDate, deathDate);
    const status = calculateStatus(person, birthDate, deathDate);
    const childrenCount = (person.relations?.children || []).length;
    
    // Hämta yrken från events med typ "Yrke"
    const occupationEvents = (person.events || []).filter(e => e.type === 'Yrke' || e.type === 'OCCU');
    const occupations = occupationEvents
        .map(e => {
            // Ta bort HTML-taggar från notes
            const notes = e.notes ? e.notes.replace(/<[^>]*>/g, '').trim() : '';
            return notes;
        })
        .filter(occ => occ && occ.length > 0);
    
    return {
        id: person.id,
        firstName: person.firstName || 'Okänd',
        lastName: person.lastName || '',
        gender: person.gender || person.sex || 'unknown',
        birthDate: birthDate,
        birthPlace: birthEvent?.place || '',
        deathDate: deathDate,
        deathPlace: deathEvent?.place || '',
        title: person.occupation || person.title || '',
        occupations: occupations, // Array av yrken
        photoUrl: person.photoUrl || '',
        media: person.media || [],
        hasExtendedFamily: (person.relations?.children?.length > 0 || person.relations?.parents?.length > 0),
        isBookmarked: person.isBookmarked || false,
        refNumber: person.refNumber || person.id,
        age: age,
        status: status,
        childrenCount: childrenCount,
        isPlaceholder: person._isPlaceholder || false
    };
};

// --- KOMPONENTER ---

// Enkel "EditPersonModal" simulator (kommer att ersättas av din riktiga EditPersonModal)
const EditPersonModal = ({ person, onClose, onSave }) => {
    if (!person) return null;
    return (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center">
            <div className="bg-white p-6 rounded shadow-lg max-w-md w-full animate-in fade-in zoom-in duration-200">
                <h2 className="text-xl font-bold mb-4">Redigera {person.firstName} {person.lastName}</h2>
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Förnamn</label>
                        <input type="text" defaultValue={person.firstName} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Efternamn</label>
                        <input type="text" defaultValue={person.lastName} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                    </div>
                    {person.parent1 && <p className="text-sm text-blue-600">Kopplar som barn till ID: {person.parent1}</p>}
                    {person.parent2 && <p className="text-sm text-blue-600">Kopplar som barn till ID: {person.parent2}</p>}
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>Avbryt</Button>
                    <Button variant="primary" onClick={() => { if(onSave) onSave(person); onClose(); }}>Spara</Button>
                </div>
            </div>
        </div>
    );
};

// Avancerad söklista med Context Menu
const AdvancedSearchModal = ({ 
    onClose, people, focusId, onNavigate, onEdit, 
    onAddParent, onAddSibling, onAddPartner, onAddChild, 
    onDelete, onToggleMain, onToggleBookmark 
}) => {
    const [query, setQuery] = useState('');
    const [filteredPeople, setFilteredPeople] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);

    useEffect(() => {
        const list = people.filter(p => {
            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
            const q = query.toLowerCase();
            return fullName.includes(q) || (p.birthPlace && p.birthPlace.toLowerCase().includes(q));
        });
        setFilteredPeople(list);
    }, [query, people]);

    // --- RÄKNA UT RELATION ---
    const getRelationship = (person, targetId) => {
        if (targetId === focusId) return { text: "Huvudperson", color: "text-yellow-400" };
        
        // Föräldrar
        const parentIds = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
        if (parentIds.includes(targetId)) return { text: "Förälder", color: "text-blue-300" };
        
        // Partner
        if (person.relations?.spouseId === targetId) return { text: "Partner", color: "text-pink-300" };
        
        // Barn
        const childIds = (person.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
        if (childIds.includes(targetId)) return { text: "Barn", color: "text-indigo-300" };
        
        return { text: "-", color: "text-slate-600" };
    };

    const handleContextMenu = (e, person) => {
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 220);
        const y = Math.min(e.clientY, window.innerHeight - 300);
        setContextMenu({ x, y, person });
    };

    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const MenuItem = ({ icon: Icon, label, onClick, color = "text-slate-300", shortcut }) => (
        <button 
            className={`w-full text-left px-3 py-2 hover:bg-blue-600/20 hover:text-blue-100 flex items-center justify-between text-sm transition-colors group ${color}`} 
            onClick={(e) => { e.stopPropagation(); onClick(); setContextMenu(null); }}
        >
            <div className="flex items-center gap-3">
                <Icon size={16} className="opacity-70 group-hover:opacity-100"/> 
                <span>{label}</span>
            </div>
            {shortcut && <span className="text-xs opacity-30 font-mono">{shortcut}</span>}
        </button>
    );

    return (
        <WindowFrame 
            title="Personregister & Sök" 
            onClose={onClose} 
            icon={List}
            initialWidth={1000}
            initialHeight={650}
        >
            <div className="flex flex-col h-full">
                {/* Header med count */}
                <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-slate-400 text-sm">
                        {filteredPeople.length} personer
                    </span>
                </div>

                {/* Sökfält */}
                <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="Sök på namn, plats..." 
                            className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm placeholder-slate-500"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                        {query && (
                             <button onClick={() => setQuery('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white"><X size={16}/></button>
                        )}
                    </div>
                </div>

                {/* Tabellrubriker */}
                <div className="grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wider text-slate-500 font-bold px-4 py-2 border-b border-slate-700 bg-slate-800/30">
                    <div className="col-span-4 pl-8">Namn & Titel</div>
                    <div className="col-span-2">Relation</div>
                    <div className="col-span-3">Född</div>
                    <div className="col-span-2">Död</div>
                    <div className="col-span-1 text-center">Info</div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredPeople.map((p, idx) => {
                        const focusPerson = people.find(fp => fp.id === focusId);
                        const relation = getRelationship(focusPerson || {}, p.id);
                        
                        return (
                        <div 
                            key={p.id}
                            className={`grid grid-cols-12 gap-2 px-4 py-2 border-b border-slate-800 hover:bg-blue-900/20 transition-colors items-center cursor-default group ${idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}`}
                            onDoubleClick={() => onEdit(p)}
                            onContextMenu={(e) => handleContextMenu(e, p)}
                        >
                            {/* NAMN */}
                            <div className="col-span-4 font-medium text-slate-200 flex items-center gap-3 overflow-hidden">
                                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-xs font-bold border border-slate-600 relative">
                                    {p.gender === 'M' ? <span className="text-blue-300">M</span> : <span className="text-rose-300">K</span>}
                                    {p.isBookmarked && <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full shadow-sm"></div>}
                                </div>
                                <div className="truncate">
                                    <span className={p.id === focusId ? "text-yellow-400 font-bold" : ""}>{p.firstName} {p.lastName}</span>
                                    {p.title && <div className="text-[10px] text-slate-500 truncate">{p.title}</div>}
                                </div>
                            </div>
                            
                            {/* RELATION */}
                            <div className={`col-span-2 text-xs font-medium flex items-center gap-1.5 ${relation.color}`}>
                                {relation.text !== '-' && <LinkIcon size={10} className="opacity-50"/>}
                                {relation.text}
                            </div>
                            
                            {/* FÖDD */}
                            <div 
                                className="col-span-3 text-sm text-slate-400 truncate hover:text-blue-400 cursor-pointer flex flex-col justify-center"
                                onClick={(e) => { e.stopPropagation(); if(p.birthPlace) alert(`Navigerar till platsregistret: ${p.birthPlace}`); }}
                            >
                                <span>{p.birthDate}</span>
                                {p.birthPlace && <span className="text-[10px] opacity-60 flex items-center gap-1"><MapPin size={8}/> {p.birthPlace}</span>}
                            </div>
                            
                            {/* DÖD */}
                            <div 
                                className="col-span-2 text-sm text-slate-400 truncate hover:text-blue-400 cursor-pointer flex flex-col justify-center"
                                onClick={(e) => { e.stopPropagation(); if(p.deathPlace) alert(`Navigerar till platsregistret: ${p.deathPlace}`); }}
                            >
                                <span>{p.deathDate}</span>
                                {p.deathPlace && <span className="text-[10px] opacity-60 flex items-center gap-1"><MapPin size={8}/> {p.deathPlace}</span>}
                            </div>
                            
                            {/* ÅTGÄRD */}
                            <div className="col-span-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); onNavigate(p.id); onClose(); }} title="Visa i träd" className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Network size={14}/></button>
                            </div>
                        </div>
                    )})}
                    
                    {filteredPeople.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
                            <Search size={32} className="opacity-20"/>
                            <span>Inga personer matchade din sökning.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Context Menu för Lista */}
            {contextMenu && (
                <div 
                    className="fixed z-[2000] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-64 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                     <div className="px-3 py-2 border-b border-slate-700 bg-slate-800/50">
                        <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Vald person</div>
                        <div className="font-medium text-slate-200 truncate">{contextMenu.person.firstName} {contextMenu.person.lastName}</div>
                    </div>
                    
                    <div className="py-1">
                        <MenuItem icon={Edit2} label="Redigera" onClick={() => onEdit(contextMenu.person)} color="text-blue-300" />
                        <MenuItem icon={UserPlus} label="Skapa ny (Oberoende)" onClick={() => onEdit({firstName: 'Ny', lastName: 'Person'})} />
                    </div>
                    
                    <div className="h-px bg-slate-700 mx-2"/>
                    
                    <div className="py-1">
                        <MenuItem icon={Users} label="Skapa förälder" onClick={() => onAddParent(contextMenu.person)} />
                        <MenuItem icon={GitFork} label="Skapa syskon" onClick={() => onAddSibling(contextMenu.person)} />
                        <MenuItem icon={Baby} label="Skapa barn" onClick={() => onAddChild(contextMenu.person)} />
                        <MenuItem icon={Heart} label="Skapa partner" onClick={() => onAddPartner(contextMenu.person)} />
                    </div>
                    
                    <div className="h-px bg-slate-700 mx-2"/>
                    
                    <div className="py-1">
                        <MenuItem 
                            icon={Star} 
                            label="Gör till Huvudperson" 
                            onClick={() => onToggleMain(contextMenu.person)} 
                            color={contextMenu.person.id === focusId ? "text-yellow-400" : "text-slate-300"} 
                        />
                        <MenuItem 
                            icon={Bookmark} 
                            label="Bokmärke" 
                            onClick={() => onToggleBookmark(contextMenu.person)} 
                            color={contextMenu.person.isBookmarked ? "text-blue-400" : "text-slate-300"}
                        />
                         <MenuItem icon={Network} label="Visa i Trädvy" onClick={() => { onNavigate(contextMenu.person.id); onClose(); }} color="text-green-400" />
                    </div>

                    <div className="h-px bg-slate-700 mx-2"/>

                    <div className="py-1">
                         <MenuItem icon={Trash2} label="Radera person" onClick={() => onDelete(contextMenu.person)} color="text-red-400" />
                    </div>
                </div>
            )}
        </WindowFrame>
    );
};

// Modal för att välja partner om man har flera
const PartnerSelectModal = ({ partners, onSelect, onClose, people }) => {
    return (
        <div className="fixed inset-0 z-[3000] bg-black/70 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
                <div className="flex items-center gap-3 mb-4 text-blue-400">
                    <Users size={24} />
                    <h3 className="text-lg font-bold text-white">Välj andra föräldern</h3>
                </div>
                <p className="text-slate-400 text-sm mb-6">Den valda personen har flera partners. Vem ska barnet kopplas till?</p>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {partners.map(p => {
                        const person = people[p.id];
                        if (!person) return null;
                        return (
                            <button 
                                key={p.id}
                                onClick={() => onSelect(p.id)}
                                className="w-full flex items-center p-3 rounded bg-slate-700/50 hover:bg-blue-600/20 hover:border-blue-500/50 border border-transparent transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center shrink-0 mr-3 text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <User size={18} />
                                </div>
                                <div className="text-left">
                                    <div className="text-slate-200 font-medium group-hover:text-blue-200">{person.firstName} {person.lastName}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1"><Heart size={10}/> {p.type === 'married' ? 'Gift' : 'Partner'}</div>
                                </div>
                            </button>
                        );
                    })}
                    {/* Alternativ för okänd partner */}
                    <button 
                        onClick={() => onSelect(null)}
                        className="w-full flex items-center p-3 rounded bg-slate-700/30 hover:bg-slate-700 border border-dashed border-slate-600 text-slate-400 hover:text-white transition-colors"
                    >
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 mr-3 border border-slate-600">
                            <AlertTriangle size={16} />
                        </div>
                        <div className="text-left">
                            <div className="font-medium">Okänd / Ingen av ovan</div>
                            <div className="text-xs opacity-60">Koppla endast till en förälder</div>
                        </div>
                    </button>
                </div>
             </div>
        </div>
    );
};


// --- MAIN APP ---
export default function FamilyTreeView({ allPeople = [], focusPersonId, onSetFocus, onOpenEditModal, onCreatePersonAndLink, onAddParentToChildAndSetPartners, onDeletePerson, getPersonRelations, personToCenter, onPersonCentered }) {
    const app = useApp();
    // Konvertera data till visningsformat
    const displayPeople = allPeople.map(convertPersonForDisplay).filter(Boolean);
    const peopleById = {};
    displayPeople.forEach(p => { peopleById[p.id] = p; });

    // Skapa mock data-struktur baserad på fokusperson
    const focusPerson = displayPeople.find(p => p.id === focusPersonId);

    // State för antal generationer att visa
    const [generations, setGenerations] = useState(3); // Standard 3, max 10
    const [compactView, setCompactView] = useState(false); // Kompakt vy (mindre kort)

    // Bygg relationships för 3 generationer upp/ner
    // Rekursiv funktion för att hitta förfäder (uppåt)
    const getAncestors = (personId, depth, maxDepth) => {
        if (depth >= maxDepth || !personId) return [];
        const person = allPeople.find(p => p.id === personId);
        if (!person || !person.relations?.parents) return [];
        
        const parentIds = (person.relations.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
        const ancestors = [...parentIds];
        
        // Rekursivt hämta förfäder till varje förälder
        parentIds.forEach(pid => {
            const parentAncestors = getAncestors(pid, depth + 1, maxDepth);
            ancestors.push(...parentAncestors);
        });
        
        return [...new Set(ancestors)];
    };

    // Rekursiv funktion för att hitta ättlingar (nedåt)
    const getDescendants = (personId, depth, maxDepth) => {
        if (depth >= maxDepth || !personId) return [];
        const person = allPeople.find(p => p.id === personId);
        if (!person || !person.relations?.children) return [];
        
        const childIds = (person.relations.children || []).map(c => typeof c === 'object' ? c.id : c).filter(Boolean);
        const descendants = [...childIds];
        
        // Rekursivt hämta ättlingar till varje barn
        childIds.forEach(cid => {
            const childDescendants = getDescendants(cid, depth + 1, maxDepth);
            descendants.push(...childDescendants);
        });
        
        return [...new Set(descendants)];
    };

    const buildRelationships = () => {
        if (!focusPerson) return { focusPerson: null, parents: [], grandparents: [], siblings: [], partners: [], children: [], grandchildren: [], ancestors: [], descendants: [] };
        const dbPerson = allPeople.find(p => p.id === focusPersonId);
        if (!dbPerson) return { focusPerson: null, parents: [], grandparents: [], siblings: [], partners: [], children: [], grandchildren: [], ancestors: [], descendants: [] };

        // Beräkna antal generationer uppåt och nedåt (dela på 2, avrunda uppåt)
        const generationsUp = Math.ceil(generations / 2);
        const generationsDown = Math.floor(generations / 2);

        // Föräldrar (generation 1 uppåt)
        const parents = (dbPerson.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);

        // Alla förfäder (rekursivt)
        const allAncestors = getAncestors(focusPersonId, 0, generationsUp);
        
        // Far-/morföräldrar (generation 2 uppåt)
        let grandparents = [];
        parents.forEach(pid => {
            const parent = allPeople.find(p => p.id === pid);
            if (parent && parent.relations?.parents) {
                const gps = (parent.relations.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
                grandparents = grandparents.concat(gps);
            }
        });
        grandparents = [...new Set(grandparents)];
        
        // Ytterligare generationer uppåt (om generations > 2)
        const additionalAncestors = allAncestors.filter(aid => !parents.includes(aid) && !grandparents.includes(aid));

        // Syskon (andra barn till samma föräldrar)
        const siblings = [];
        allPeople.forEach(person => {
            if (person.id === focusPersonId) return;
            const personParents = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
            if (personParents.length && parents.some(pp => personParents.includes(pp))) {
                siblings.push(person.id);
            }
        });
        
        // Sortera syskon: först efter födelsedatum, sedan efter namn
        siblings.sort((a, b) => {
            const personA = allPeople.find(p => p.id === a);
            const personB = allPeople.find(p => p.id === b);
            if (!personA || !personB) return 0;
            
            // Hämta födelsedatum från events
            const birthA = personA.events?.find(e => e.type === 'BIRT' || e.type === 'Födelse')?.date || '';
            const birthB = personB.events?.find(e => e.type === 'BIRT' || e.type === 'Födelse')?.date || '';
            
            if (birthA && birthB) {
                return birthA.localeCompare(birthB);
            }
            if (birthA) return -1;
            if (birthB) return 1;
            
            // Om inget datum: sortera efter namn
            const nameA = `${personA.firstName || ''} ${personA.lastName || ''}`.trim();
            const nameB = `${personB.firstName || ''} ${personB.lastName || ''}`.trim();
            return nameA.localeCompare(nameB);
        });

        // Partners (ingifta)
        const partners = [];
        
        console.log('[buildRelationships] Focus person:', focusPersonId, 'dbPerson.relations:', dbPerson.relations);
        
        // Kolla först efter partners-arrayen (från EditPersonModal)
        if (dbPerson.relations?.partners && Array.isArray(dbPerson.relations.partners)) {
            console.log('[buildRelationships] Found partners array:', dbPerson.relations.partners.length, dbPerson.relations.partners);
            dbPerson.relations.partners.forEach(partnerRef => {
                const partnerId = typeof partnerRef === 'object' ? partnerRef.id : partnerRef;
                if (!partnerId) return;
                
                const spouse = allPeople.find(p => p.id === partnerId);
                if (spouse) {
                    // Hitta gemensamma barn
                const children = allPeople.filter(child => {
                    const childParents = (child.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
                    // Koppla bara om barnet uttryckligen har båda föräldrarna
                    return childParents.includes(focusPersonId) && childParents.includes(partnerId) && childParents.length > 1;
                }).map(c => c.id);
                    
                    // Kontrollera om partnern redan finns i listan
                    if (!partners.some(p => p.id === partnerId)) {
                        // Mappa partner-typ: 'Skild' -> 'divorced' för rendering
                        let partnerType = (typeof partnerRef === 'object' && partnerRef.type) ? partnerRef.type : 'married';
                        if (partnerType === 'Skild') {
                            partnerType = 'divorced';
                        }
                        partners.push({
                            id: partnerId,
                            children: children,
                            type: partnerType,
                            isPartner: true // markerar ingift
                        });
                    }
                }
            });
        }
        
        // Fallback: kolla även efter spouseId (för bakåtkompatibilitet)
        console.log('[buildRelationships] Checking spouseId:', dbPerson.relations?.spouseId, 'current partners:', partners.length);
        if (dbPerson.relations?.spouseId && !partners.some(p => p.id === dbPerson.relations.spouseId)) {
            const spouse = allPeople.find(p => p.id === dbPerson.relations.spouseId);
            if (spouse) {
                // Hitta gemensamma barn
                const children = allPeople.filter(child => {
                    const childParents = (child.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
                    return childParents.includes(focusPersonId) && childParents.includes(dbPerson.relations.spouseId);
                }).map(c => c.id);
                partners.push({
                    id: dbPerson.relations.spouseId,
                    children: children,
                    type: 'married',
                    isPartner: true // markerar ingift
                });
            }
        }

        // Hitta alla barn som har denna person som förälder men som inte redan är kopplade till en partner
        const allChildrenOfThisPerson = allPeople.filter(child => {
            const childParents = (child.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
            return childParents.includes(focusPersonId);
        });
        
        // Separera barn i två grupper:
        // 1. Barn som redan är kopplade till en partner (via partners-arrayen ovan)
        const childrenAlreadyInPartners = new Set();
        partners.forEach(p => {
            (p.children || []).forEach(cid => childrenAlreadyInPartners.add(cid));
        });
        
        // 2. Barn som INTE är kopplade till någon partner (inklusive barn med flera föräldrar där föräldrarna inte är partners)
        const childrenWithoutPartner = allChildrenOfThisPerson
            .filter(child => !childrenAlreadyInPartners.has(child.id))
            .map(c => c.id);
        
        if (childrenWithoutPartner.length > 0) {
            partners.push({
                id: null,
                children: childrenWithoutPartner,
                type: 'single',
                isPartner: false
            });
        }
        
        // Sortera partners: först efter datum (vigsel/sambo), sedan efter namn
        partners.sort((a, b) => {
            // Partners utan ID (ghost parents) ska vara sist
            if (!a.id && b.id) return 1;
            if (a.id && !b.id) return -1;
            if (!a.id && !b.id) return 0;
            
            const partnerA = allPeople.find(p => p.id === a.id);
            const partnerB = allPeople.find(p => p.id === b.id);
            if (!partnerA || !partnerB) return 0;
            
            // Hämta vigsel/sambo datum från events
            const eventA = partnerA.events?.find(e => 
                (e.type === 'Vigsel' || e.type === 'MARRIAGE' || e.type === 'Sambo') && 
                e.partnerId === focusPersonId
            )?.date || '';
            const eventB = partnerB.events?.find(e => 
                (e.type === 'Vigsel' || e.type === 'MARRIAGE' || e.type === 'Sambo') && 
                e.partnerId === focusPersonId
            )?.date || '';
            
            // Om ingen event hittas, kolla i andra riktningen
            const eventAReverse = dbPerson.events?.find(e => 
                (e.type === 'Vigsel' || e.type === 'MARRIAGE' || e.type === 'Sambo') && 
                e.partnerId === a.id
            )?.date || '';
            const eventBReverse = dbPerson.events?.find(e => 
                (e.type === 'Vigsel' || e.type === 'MARRIAGE' || e.type === 'Sambo') && 
                e.partnerId === b.id
            )?.date || '';
            
            const dateA = eventA || eventAReverse;
            const dateB = eventB || eventBReverse;
            
            if (dateA && dateB) {
                return dateA.localeCompare(dateB);
            }
            if (dateA) return -1;
            if (dateB) return 1;
            
            // Om inget datum: sortera efter namn
            const nameA = `${partnerA.firstName || ''} ${partnerA.lastName || ''}`.trim();
            const nameB = `${partnerB.firstName || ''} ${partnerB.lastName || ''}`.trim();
            return nameA.localeCompare(nameB);
        });

        // Barn
        // DEBUG: Kolla alla personer i allPeople för att se om någon har Jimmy som förälder
        console.log('[buildRelationships] DEBUG: All people count:', allPeople.length);
        console.log('[buildRelationships] DEBUG: Focus person ID:', focusPersonId);
        console.log('[buildRelationships] DEBUG: Checking all people for children...');
        console.log('[buildRelationships] DEBUG: All people and their relations:');
        allPeople.forEach(person => {
            const personParents = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
            const personChildren = (person.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
            console.log(`[buildRelationships] DEBUG: Person ${person.id} (${person.firstName} ${person.lastName}): parents=`, personParents, 'children=', personChildren);
            if (personParents.includes(focusPersonId)) {
                console.log(`[buildRelationships] DEBUG: ✅ Found child: ${person.id} (${person.firstName} ${person.lastName}) with parents:`, personParents);
            }
        });
        
        // Metod 1: Kolla om barnet har fokus-personen i sin parents-lista
        const childrenFromParents = allPeople.filter(child => {
            const childParents = (child.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
            return childParents.includes(focusPersonId);
        }).map(c => c.id);
        
        // Metod 2 (fallback): Kolla om fokus-personen har barnet i sin children-lista
        const focusPersonChildren = (dbPerson.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
        
        // Metod 3: Kolla om partnern har barnet i sin children-lista (som fallback)
        const childrenFromPartners = [];
        if (dbPerson.relations?.partners && Array.isArray(dbPerson.relations.partners)) {
            dbPerson.relations.partners.forEach(partnerRef => {
                const partnerId = typeof partnerRef === 'object' ? partnerRef.id : partnerRef;
                if (!partnerId) return;
                const partner = allPeople.find(p => p.id === partnerId);
                if (partner && partner.relations?.children) {
                    const partnerChildren = (partner.relations.children || []).map(c => typeof c === 'object' ? c.id : c);
                    partnerChildren.forEach(childId => {
                        if (!childrenFromPartners.includes(childId)) {
                            childrenFromPartners.push(childId);
                        }
                    });
                }
            });
        }
        
        // Kombinera alla metoder (ta bort dubbletter)
        const children = [...new Set([...childrenFromParents, ...focusPersonChildren, ...childrenFromPartners])];
        
        console.log('[buildRelationships] Focus person children from parents array:', childrenFromParents);
        console.log('[buildRelationships] Focus person children from children array:', focusPersonChildren);
        console.log('[buildRelationships] Focus person children from partners children array:', childrenFromPartners);
        console.log('[buildRelationships] Combined children:', children);

        // Barnbarn
        let grandchildren = [];
        children.forEach(cid => {
            const child = allPeople.find(p => p.id === cid);
            if (child && child.relations?.children) {
                const gcs = (child.relations.children || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
                grandchildren = grandchildren.concat(gcs);
            }
        });
        grandchildren = [...new Set(grandchildren)];

        // Alla ättlingar (rekursivt)
        const allDescendants = getDescendants(focusPersonId, 0, generationsDown);
        
        // Ytterligare generationer nedåt (om generations > 2)
        const additionalDescendants = allDescendants.filter(did => !children.includes(did) && !grandchildren.includes(did));

        // Föräldrar till partners (svärföräldrar) - EFTER att partners-arrayen är skapad
        const partnersParents = [];
        partners.forEach(partnerRef => {
            const partnerId = partnerRef.id;
            if (!partnerId) return;
            const partner = allPeople.find(p => p.id === partnerId);
            if (partner && partner.relations?.parents) {
                const partnerParents = (partner.relations.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
                partnerParents.forEach(ppId => {
                    if (!partnersParents.includes(ppId) && !parents.includes(ppId) && !grandparents.includes(ppId) && !additionalAncestors.includes(ppId)) {
                        partnersParents.push(ppId);
                    }
                });
            }
        });

        const result = { 
            focusPerson: focusPersonId, 
            parents, 
            grandparents, 
            siblings, 
            partners, 
            children, 
            grandchildren,
            ancestors: additionalAncestors || [],
            descendants: additionalDescendants || [],
            partnersParents: partnersParents || []
        };
        
        console.log('[buildRelationships] Final partners count:', result.partners.length, result.partners);
        return result;
    };

    const relationships = buildRelationships();
    
    // Beräkna antal personer i trädet
    const countPeopleInTree = () => {
        const peopleSet = new Set();
        if (relationships.focusPerson) peopleSet.add(relationships.focusPerson);
        (relationships.parents || []).forEach(id => peopleSet.add(id));
        (relationships.grandparents || []).forEach(id => peopleSet.add(id));
        (relationships.ancestors || []).forEach(id => peopleSet.add(id));
        (relationships.siblings || []).forEach(id => peopleSet.add(id));
        (relationships.partners || []).forEach(rel => {
            if (rel.id) peopleSet.add(rel.id);
            (rel.children || []).forEach(id => peopleSet.add(id));
        });
        (relationships.children || []).forEach(id => peopleSet.add(id));
        (relationships.grandchildren || []).forEach(id => peopleSet.add(id));
        (relationships.descendants || []).forEach(id => peopleSet.add(id));
        (relationships.partnersParents || []).forEach(id => peopleSet.add(id));
        return peopleSet.size;
    };
    
    const peopleCount = countPeopleInTree();
    
    // Dynamiska kortstorlekar baserat på vy
    const CARD_WIDTH = compactView ? CARD_WIDTH_COMPACT : CARD_WIDTH_NORMAL;
    const FOCUS_WIDTH = compactView ? FOCUS_WIDTH_COMPACT : FOCUS_WIDTH_NORMAL;
    const CARD_HEIGHT = compactView ? CARD_HEIGHT_COMPACT : CARD_HEIGHT_NORMAL;
    const FOCUS_HEIGHT = compactView ? FOCUS_HEIGHT_COMPACT : FOCUS_HEIGHT_NORMAL;

    const data = {
        focusId: focusPersonId,
        people: peopleById,
        relationships: relationships
    };

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.8 });
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [heartContextMenu, setHeartContextMenu] = useState(null); // { x, y, person1Id, person2Id, currentType }
  
  // Modals state
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [editPerson, setEditPerson] = useState(null);
  const [partnerSelect, setPartnerSelect] = useState(null);
  const [selectFatherModal, setSelectFatherModal] = useState(null); // { mother: person }

  // Sök & Historik states
  const [searchResults, setSearchResults] = useState([]);
  const [history, setHistory] = useState([focusPersonId]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [treeContextMenu, setTreeContextMenu] = useState(null);

  // --- ACTIONS ---
  const navigateToPerson = (id) => {
      if (id === data.focusId) return;
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(id);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      if (onSetFocus) onSetFocus(id);
  };

  // Stäng tree context menu vid klick
  useEffect(() => {
    const closeMenu = () => setTreeContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // Stäng heart context menu vid klick
  useEffect(() => {
    const closeMenu = () => setHeartContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleTreeContextMenu = (e, person) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 280);
    const y = Math.min(e.clientY, window.innerHeight - 400);
    setTreeContextMenu({ x, y, person });
  };

  const handleEditPerson = (person) => {
      if (onOpenEditModal) {
        onOpenEditModal(person.id);
      } else {
        setEditPerson(person);
      }
  };

  const handleAddChild = (parent) => {
      // Öppna modal för att välja far
      setSelectFatherModal({ mother: parent });
  };

  const handleCreateChildWithPartners = (p1, p2) => {
      setPartnerSelect(null);
      if (onCreatePersonAndLink) {
        onCreatePersonAndLink(p1, 'child');
      } else {
        setEditPerson({ 
            firstName: 'Nytt', 
            lastName: 'Barn', 
            parent1: p1, 
            parent2: p2,
            isNew: true
        });
      }
  };

  // Handler när far är vald i SelectFatherModal
  const handleFatherSelected = (fatherId, isNew) => {
    const mother = selectFatherModal?.mother;
    if (!mother) return;
    
    setSelectFatherModal(null);
    
    // Skapa barnet med båda föräldrarna
    if (onCreatePersonAndLink) {
      // Skapa barnet med modern som target - detta skapar barnet och länkar det till modern
      const newChildId = onCreatePersonAndLink(mother.id, 'child');
      
      // Vänta lite för att barnet ska skapas i state, sedan lägg till fadern
      setTimeout(() => {
        // Använd newChildId om det finns, annars hitta det nyaste barnet
        const childId = newChildId || (() => {
          const allPeopleSorted = [...allPeople].sort((a, b) => {
            const aTime = parseInt(a.id.split('_')[1] || '0');
            const bTime = parseInt(b.id.split('_')[1] || '0');
            return bTime - aTime;
          });
          const newestChild = allPeopleSorted.find(p => 
            p._isPlaceholder && 
            p._placeholderRelation === 'child' &&
            p._placeholderTargetId === mother.id
          );
          return newestChild?.id;
        })();
        
        if (childId && onAddParentToChildAndSetPartners) {
          // Lägg till fadern som förälder till barnet och sätta modern och fadern som partners
          onAddParentToChildAndSetPartners(childId, fatherId, mother.id);
        }
        
        if (childId && onOpenEditModal) {
          // Öppna EditPersonModal för det nya barnet
          onOpenEditModal(childId);
        }
      }, 300);
    }
  };

  // Handler när "Ny" klickas i SelectFatherModal (skapar placeholder far)
  const handleCreateNewFather = () => {
    const mother = selectFatherModal?.mother;
    if (!mother || !onCreatePersonAndLink) return;
    
    // Skapa placeholder far
    onCreatePersonAndLink(mother.id, 'spouse');
    
    // Vänta lite för att fadern ska skapas, sedan använd den för att skapa barnet
    setTimeout(() => {
      // Hitta den nyaste personen (högsta ID/timestamp) som är en placeholder spouse
      const allPeopleSorted = [...allPeople].sort((a, b) => {
        const aTime = parseInt(a.id.split('_')[1] || '0');
        const bTime = parseInt(b.id.split('_')[1] || '0');
        return bTime - aTime;
      });
      const newestFather = allPeopleSorted.find(p => 
        p._isPlaceholder && 
        p._placeholderRelation === 'spouse' &&
        p._placeholderTargetId === mother.id
      );
      
      if (newestFather) {
        handleFatherSelected(newestFather.id, true);
      }
    }, 200);
  };

  const handleAddParent = (child) => {
      if (onCreatePersonAndLink) {
        onCreatePersonAndLink(child.id, 'parent');
      } else {
        setEditPerson({ firstName: 'Ny', lastName: 'Förälder', childId: child.id, isNew: true });
      }
  };
  
  const handleAddSibling = (sibling) => {
      if (onCreatePersonAndLink) {
        onCreatePersonAndLink(sibling.id, 'sibling');
      } else {
        setEditPerson({ firstName: 'Nytt', lastName: 'Syskon', siblingId: sibling.id, isNew: true });
      }
  };
  
  const handleAddPartner = (person) => {
      if (onCreatePersonAndLink) {
        onCreatePersonAndLink(person.id, 'spouse');
      } else {
        setEditPerson({ firstName: 'Ny', lastName: 'Partner', partnerTo: person.id, isNew: true });
      }
  };

  const handleDelete = (person) => {
      if(confirm(`Är du säker på att du vill radera ${person.firstName} ${person.lastName}?`)) {
          if (onDeletePerson) {
              onDeletePerson(person.id);
          } else {
              alert("Person raderad (Mock)");
          }
      }
  };
  
  const handleToggleMain = (person) => {
      navigateToPerson(person.id);
  };

  const handleToggleBookmark = (person) => {
      // TODO: Implementera bokmärke i databas
      alert("Bokmärke funktion ej implementerad än");
  };

// ============================================================================
// ADAPTER: Konvertera från WestFamilyTree databas till VerticalFamilyTree format
// ============================================================================
const buildMockDB = () => {
  // Konvertera persons
  const persons = allPeople.map(p => ({
    id: p.id,
    name: p.name,
    gender: p.sex === 'M' ? 'male' : 'female',
    birthYear: (() => {
      const birthEvent = p.events?.find(e => e.type === 'BIRT' || e.type === 'Födelse');
      if (!birthEvent?.date) return 9999;
      const year = birthEvent.date.match(/\d{4}/);
      return year ? parseInt(year[0]) : 9999;
    })(),
    img: p.media?.length > 0 ? p.media[0].path : null,
  }));

  // Bygg parent_child relations
  const parent_child = [];
  allPeople.forEach(person => {
    const childIds = (person.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
    childIds.forEach(childId => {
      parent_child.push({ parent_id: person.id, child_id: childId });
    });
  });

  // Bygg relationships (partners)
  const relationships = [];
  const processed = new Set();
  allPeople.forEach(person => {
    const partnerIds = (person.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
    partnerIds.forEach(partnerId => {
      const key = [person.id, partnerId].sort().join('-');
      if (!processed.has(key)) {
        relationships.push({ person1_id: person.id, person2_id: partnerId });
        processed.add(key);
      }
    });
  });

  return { persons, parent_child, relationships };
};

// ============================================================================
// EXAKT KOPIERAD FUNKTION FRÅN VerticalFamilyTree.jsx
// ============================================================================
const calculateVerticalLayout = () => {
  const db = buildMockDB();
  const focusId = data.focusId;
  
  const nodes = [];
  const edges = [];
  
  const focusPerson = db.persons.find(p => p.id === focusId);
  if (!focusPerson) return { nodes: [], edges: [] };

  // --------------------------------------------------------------------------
  // 1. DATAINSAMLING GEN 1 (Föräldrar + Styvföräldrar)
  // --------------------------------------------------------------------------
  
  const parentRels = db.parent_child.filter(pc => pc.child_id === focusId);
  const parents = parentRels.map(rel => db.persons.find(p => p.id === rel.parent_id));
  parents.sort((a, b) => (a.gender === 'male' ? -1 : 1));

  // --------------------------------------------------------------------------
  // 2. DATAINSAMLING GEN 2 (Syskon & Halvsyskon)
  // --------------------------------------------------------------------------
  
  const siblingIds = new Set();
  parents.forEach(parent => {
      const children = db.parent_child.filter(pc => pc.parent_id === parent.id).map(pc => pc.child_id);
      children.forEach(id => {
          if (id !== focusId) siblingIds.add(id);
      });
  });
  
  const siblings = Array.from(siblingIds).map(id => db.persons.find(p => p.id === id));
  siblings.sort((a, b) => a.birthYear - b.birthYear);

  const olderSiblings = siblings.filter(s => s.birthYear < focusPerson.birthYear);
  const youngerSiblings = siblings.filter(s => s.birthYear > focusPerson.birthYear);

  // --------------------------------------------------------------------------
  // 3. PLACERING (X/Y)
  // --------------------------------------------------------------------------
  
  const startX = 600; 
  const startY = 300;
  
  // --- A. PLACERA FOKUS ---
  nodes.push({ ...focusPerson, x: startX, y: startY, type: 'focus' });

  // --- B. PLACERA SYSKON (SIDLED) ---
  let leftCursor = startX - (CONFIG_USER.CARD_WIDTH + CONFIG_USER.GAP_X);
  olderSiblings.reverse().forEach(sib => { 
      nodes.push({ ...sib, x: leftCursor, y: startY, type: 'sibling' });
      leftCursor -= (CONFIG_USER.CARD_WIDTH + CONFIG_USER.GAP_X);
  });

  let rightCursor = startX + (CONFIG_USER.CARD_WIDTH + CONFIG_USER.GAP_X);
  youngerSiblings.forEach(sib => {
      nodes.push({ ...sib, x: rightCursor, y: startY, type: 'sibling' });
      rightCursor += (CONFIG_USER.CARD_WIDTH + CONFIG_USER.GAP_X);
  });

  // --- C. PLACERA GEN 1 (FÖRÄLDRAR & STYVFÖRÄLDRAR) ---
  
  const parentsY = startY - CONFIG_USER.GAP_Y - CONFIG_USER.CARD_HEIGHT;
  const parentsCenterX = startX + CONFIG_USER.CARD_WIDTH/2;
  
  const dad = parents.find(p => p.gender === 'male');
  const mom = parents.find(p => p.gender === 'female');
  
  const dadX = parentsCenterX - CONFIG_USER.CARD_WIDTH - 20; 
  const momX = parentsCenterX + 20;                     

  // Hjälpfunktion för att placera styvföräldrar
  const placeStepParents = (bioParent, bioParentX, side) => {
      if (!bioParent) return;
      nodes.push({ ...bioParent, x: bioParentX, y: parentsY, type: 'parent' });

      const otherBio = parents.find(p => p.id !== bioParent.id);
      const pRels = db.relationships.filter(r => r.person1_id === bioParent.id || r.person2_id === bioParent.id);
      const stepParents = pRels.map(r => {
          const pid = r.person1_id === bioParent.id ? r.person2_id : r.person1_id;
          return db.persons.find(p => p.id === pid);
      }).filter(p => !otherBio || p.id !== otherBio.id);

      let spCursor = bioParentX;
      stepParents.forEach(sp => {
          if (side === 'left') spCursor -= (CONFIG_USER.CARD_WIDTH + CONFIG_USER.GAP_X);
          else spCursor += (CONFIG_USER.CARD_WIDTH + CONFIG_USER.GAP_X);
          
          nodes.push({ ...sp, x: spCursor, y: parentsY, type: 'stepparent' });
          edges.push({
              id: `stepparent-${sp.id}-${bioParent.id}`,
              x1: side === 'left' ? spCursor + CONFIG_USER.CARD_WIDTH : spCursor,
              y1: parentsY + CONFIG_USER.CARD_HEIGHT/2,
              x2: side === 'left' ? bioParentX : bioParentX + CONFIG_USER.CARD_WIDTH,
              y2: parentsY + CONFIG_USER.CARD_HEIGHT/2,
              type: 'step-link'
          });
      });
  };

  placeStepParents(dad, dadX, 'left');
  placeStepParents(mom, momX, 'right');

  // Koppla fokus till Bio-föräldrarna (Linje uppåt)
  if (dad || mom) {
      edges.push({
          id: 'focus-parents',
          x1: parentsCenterX, y1: parentsY + CONFIG_USER.CARD_HEIGHT,
          x2: parentsCenterX, y2: startY,
          type: 'straight'
      });
  }

  // --- NY LOGIK: Koppla Syskon till RÄTT Föräldrapar (Elbow) ---
  [...olderSiblings, ...youngerSiblings].forEach(sib => {
      const sibNode = nodes.find(n => n.id === sib.id);
      if (!sibNode) return;

      // Hitta syskonets föräldrar i DB
      const pIds = db.parent_child.filter(pc => pc.child_id === sib.id).map(pc => pc.parent_id);
      const pNodes = pIds.map(pid => nodes.find(n => n.id === pid)).filter(Boolean);

      let targetX = parentsCenterX;
      
      if (pNodes.length === 2) {
          const p1 = pNodes[0];
          const p2 = pNodes[1];
          targetX = ((p1.x + CONFIG_USER.CARD_WIDTH/2) + (p2.x + CONFIG_USER.CARD_WIDTH/2)) / 2;
      } else if (pNodes.length === 1) {
          targetX = pNodes[0].x + CONFIG_USER.CARD_WIDTH/2;
      }

      edges.push({
          id: `sib-${sib.id}`,
          x1: sibNode.x + CONFIG_USER.CARD_WIDTH/2, y1: sibNode.y,
          x2: targetX, y2: parentsY + CONFIG_USER.CARD_HEIGHT,
          type: 'elbow-up'
      });
  });

  // --------------------------------------------------------------------------
  // 4. FOKUS PARTNERS & BARN (NEDÅT)
  // --------------------------------------------------------------------------
  
  const myPartnerRels = db.relationships.filter(r => r.person1_id === focusId || r.person2_id === focusId);
  const myPartners = myPartnerRels.map(r => {
      const pid = r.person1_id === focusId ? r.person2_id : r.person1_id;
      return db.persons.find(p => p.id === pid);
  });

  if (myPartners.length === 0) {
      const kids = db.parent_child.filter(pc => pc.parent_id === focusId).map(pc => pc.child_id);
      if (kids.length > 0) myPartners.push(null); 
  }

  let currentY = startY + CONFIG_USER.CARD_HEIGHT + 40; 
  
  myPartners.forEach(partner => {
      let childrenIds = [];
      if (partner) {
          childrenIds = db.persons.filter(p => {
              const rels = db.parent_child.filter(pc => pc.child_id === p.id);
              const hasMe = rels.some(r => r.parent_id === focusId);
              const hasPartner = rels.some(r => r.parent_id === partner.id);
              return hasMe && hasPartner;
          }).map(p => p.id);
      } else {
          childrenIds = db.parent_child.filter(pc => pc.parent_id === focusId).map(pc => pc.child_id);
      }
      const children = childrenIds.map(id => db.persons.find(p => p.id === id)).sort((a,b) => a.birthYear - b.birthYear);

      const partnerX = startX; 
      if (partner) {
          nodes.push({ ...partner, x: partnerX, y: currentY, type: 'partner' });
          edges.push({
              id: `partner-${partner.id}`,
              x1: startX + 20, y1: startY + CONFIG_USER.CARD_HEIGHT, 
              x2: partnerX, y2: currentY + CONFIG_USER.CARD_HEIGHT/2, 
              type: 'step-left' 
          });
      }

      let childY = currentY + CONFIG_USER.CARD_HEIGHT + 20;
      const childX = partnerX + CONFIG_USER.INDENT_X;

      children.forEach(child => {
          nodes.push({ ...child, x: childX, y: childY, type: 'child' });
          const sourceY = partner ? currentY + CONFIG_USER.CARD_HEIGHT : startY + CONFIG_USER.CARD_HEIGHT;
          edges.push({
              id: `child-${child.id}`,
              x1: partnerX + 20, y1: sourceY, 
              x2: childX, y2: childY + CONFIG_USER.CARD_HEIGHT/2, 
              type: 'step-indent'
          });
          childY += CONFIG_USER.CARD_HEIGHT + 10; 
      });
      currentY = childY + 20;
  });

  // Konvertera tillbaka nodes till vårt format med MediaImage
  const finalNodes = nodes.map(n => convertPersonForDisplay(allPeople.find(p => p.id === n.id) || n));
  
  return { 
    nodes: finalNodes.map((n, i) => ({ ...n, ...nodes[i] })), 
    edges 
  };
};

  // --- LAYOUT & RENDER LOGIK ---
  // Hjälpfunktion: Beräkna höjden på ett sub-träd rekursivt
  const calculateSubtreeHeight = (personId, direction, maxDepth, currentDepth = 0, visited = new Set()) => {
    if (currentDepth >= maxDepth || visited.has(personId)) return CARD_HEIGHT;
    visited.add(personId);
    
    const person = data.people[personId];
    if (!person) return CARD_HEIGHT;
    
    let maxChildHeight = 0;
    
    if (direction === 'ancestors') {
      // Förfäder: kolla föräldrar
      const parents = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
      if (parents.length > 0) {
        parents.forEach(pid => {
          const height = calculateSubtreeHeight(pid, direction, maxDepth, currentDepth + 1, new Set(visited));
          maxChildHeight = Math.max(maxChildHeight, height);
        });
      }
    } else if (direction === 'descendants') {
      // Ättlingar: kolla barn
      const children = (person.relations?.children || []).map(c => typeof c === 'object' ? c.id : c).filter(Boolean);
      if (children.length > 0) {
        children.forEach(cid => {
          const height = calculateSubtreeHeight(cid, direction, maxDepth, currentDepth + 1, new Set(visited));
          maxChildHeight = Math.max(maxChildHeight, height);
        });
      }
    }
    
    return CARD_HEIGHT + maxChildHeight + (maxChildHeight > 0 ? GAP_Y : 0);
  };

  // Hjälpfunktion: Placera en person och dess förfäder rekursivt
  const placeAncestors = (personId, generationX, startY, maxDepth, currentDepth = 0, visited = new Set()) => {
    if (currentDepth >= maxDepth || visited.has(personId)) return { nodes: [], edges: [], height: CARD_HEIGHT };
    visited.add(personId);
    
    const person = data.people[personId];
    if (!person) return { nodes: [], edges: [], height: CARD_HEIGHT };
    
        const nodes = [];
        const edges = [];
    let currentY = startY;
    
    // Hämta föräldrar
    const parentIds = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
    
    if (parentIds.length === 0 && currentDepth < maxDepth) {
      // Ghost node för saknad förälder
      const ghostId = `ghost_${personId}_parent`;
      nodes.push({
        id: ghostId,
        firstName: 'Lägg till förälder',
        lastName: '',
        isGhostParent: true,
        x: generationX,
        y: currentY
      });
      // Linje från ghost node till person
      edges.push({
        from: { x: generationX, y: currentY + (CARD_HEIGHT/2) },
        to: { x: generationX - (CARD_WIDTH + 100), y: currentY + (CARD_HEIGHT/2) },
        type: 'orthogonal-horizontal-first'
      });
      return { nodes, edges, height: CARD_HEIGHT };
    }
    
    // Om det finns exakt 2 föräldrar som är partners, placera dem horisontellt
    if (parentIds.length === 2) {
      const parent1 = data.people[parentIds[0]];
      const parent2 = data.people[parentIds[1]];
      
      const arePartners = parent1 && parent2 && (
        (parent1.relations?.partners || []).some(p => {
          const partnerId = typeof p === 'object' ? p.id : p;
          return partnerId === parentIds[1];
        }) ||
        (parent2.relations?.partners || []).some(p => {
          const partnerId = typeof p === 'object' ? p.id : p;
          return partnerId === parentIds[0];
        })
      );
      
      if (arePartners && parent1 && parent2) {
        // Placera föräldrar horisontellt på samma Y-nivå (samma som i calculateLayout)
        const partnerGap = 500;
        const parent1X = generationX - (partnerGap/2) - (CARD_WIDTH/2);
        const parent2X = generationX + (partnerGap/2) + (CARD_WIDTH/2);
        const parentY = currentY;
        
        nodes.push({ ...parent1, x: parent1X, y: parentY });
        nodes.push({ ...parent2, x: parent2X, y: parentY });
        
        // Horisontell partner-linje med hjärta
        const partner1 = (parent1.relations?.partners || []).find(p => {
          const partnerId = typeof p === 'object' ? p.id : p;
          return partnerId === parentIds[1];
        });
        const partnerType = (typeof partner1 === 'object' && partner1.type) ? partner1.type : 'Gift';
        
        edges.push({
          from: { x: parent1X + (CARD_WIDTH/2) - 10, y: parentY },
          to: { x: parent2X - (CARD_WIDTH/2) + 10, y: parentY },
          type: 'partner-horizontal',
          midPoint: { x: generationX, y: parentY },
          styleType: partnerType,
          person1Id: parentIds[0],
          person2Id: parentIds[1]
        });
        
        // Vertikal linje från mitten av partner-linjen (hjärtat) ner till person
        edges.push({
          from: { x: generationX, y: parentY + (CARD_HEIGHT/2) - 20 },
          to: { x: generationX, y: currentY + (CARD_HEIGHT/2) + 20 },
          type: 'parent'
        });
        
        return { nodes, edges, height: CARD_HEIGHT };
      }
    }
    
    // Om de inte är partners eller det är fler än 2, placera dem vertikalt
    parentIds.forEach((pid, index) => {
                const parent = data.people[pid];
      if (!parent) return;
      
      const parentY = currentY + (index * (CARD_HEIGHT + GAP_Y));
      nodes.push({ ...parent, x: generationX, y: parentY });
      
      // Ortogonal linje från förälder till person
      edges.push({
        from: { x: generationX, y: parentY + (CARD_HEIGHT/2) },
        to: { x: generationX - (CARD_WIDTH + 100), y: parentY + (CARD_HEIGHT/2) },
        type: 'orthogonal-horizontal-first'
      });
      edges.push({
        from: { x: generationX - (CARD_WIDTH + 100), y: parentY + (CARD_HEIGHT/2) },
        to: { x: generationX - (CARD_WIDTH + 100), y: currentY + (CARD_HEIGHT/2) },
        type: 'orthogonal-vertical-first'
      });
    });
    
    return { nodes, edges, height: parentIds.length * (CARD_HEIGHT + GAP_Y) };
  };

  // Hjälpfunktion: Placera en person och dess ättlingar rekursivt
  const placeDescendants = (personId, generationX, startY, maxDepth, currentDepth = 0, visited = new Set()) => {
    if (currentDepth >= maxDepth || visited.has(personId)) return { nodes: [], edges: [], height: CARD_HEIGHT };
    visited.add(personId);
    
    const person = data.people[personId];
    if (!person) return { nodes: [], edges: [], height: CARD_HEIGHT };
    
    const nodes = [];
    const edges = [];
    let currentY = startY;
    
    // Hämta barn
    const childIds = (person.relations?.children || []).map(c => typeof c === 'object' ? c.id : c).filter(Boolean);
    
    if (childIds.length === 0) {
      return { nodes, edges, height: CARD_HEIGHT };
    }
    
    // Placera barn vertikalt
    childIds.forEach((cid, index) => {
      const child = data.people[cid];
      if (!child) return;
      
      const childY = currentY + (index * (CARD_HEIGHT + GAP_Y));
      nodes.push({ ...child, x: generationX, y: childY });
      
      // Ortogonal linje från person till barn (gaffel-struktur)
      edges.push({
        from: { x: generationX + (CARD_WIDTH + 100), y: currentY + (CARD_HEIGHT/2) },
        to: { x: generationX + (CARD_WIDTH + 100), y: childY + (CARD_HEIGHT/2) },
        type: 'orthogonal-vertical-first'
      });
      edges.push({
        from: { x: generationX + (CARD_WIDTH + 100), y: childY + (CARD_HEIGHT/2) },
        to: { x: generationX, y: childY + (CARD_HEIGHT/2) },
        type: 'orthogonal-horizontal-first'
      });
      
      currentY += CARD_HEIGHT + GAP_Y;
    });
    
    return { nodes, edges, height: childIds.length * (CARD_HEIGHT + GAP_Y) };
  };

  const calculateLayout = () => {
        const nodes = [];
        const edges = [];
        const focusPerson = data.people[data.focusId];
        if (!focusPerson) return { nodes, edges };
        
        // Hjälpfunktion: Beräkna bredden på ett sub-träd (rekursivt)
        const calculateSubtreeWidth = (childIds, depth = 0, maxDepth = 3) => {
          if (depth >= maxDepth || childIds.length === 0) {
            return CARD_WIDTH;
          }
          
          let maxWidth = CARD_WIDTH;
          childIds.forEach(childId => {
            const child = allPeople.find(p => p.id === childId);
            if (!child) return;
            
            // Hitta denna barns barn (rekursivt)
            const childChildren = (child.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
            const childWidth = calculateSubtreeWidth(childChildren, depth + 1, maxDepth);
            maxWidth = Math.max(maxWidth, childWidth);
          });
          
          // Om det finns flera barn, lägg till avstånd mellan dem
          if (childIds.length > 1) {
            maxWidth = Math.max(maxWidth, childIds.length * (CARD_WIDTH + 100));
          }
          
          return maxWidth;
        };

        // Hjälpfunktion: Placera barn rekursivt under en Union Node
        const placeChildrenUnderUnionNode = (unionX, unionY, childIds, depth = 0, maxDepth = 3) => {
          if (depth >= maxDepth || childIds.length === 0) {
            return { height: 0, width: CARD_WIDTH };
          }
          
          let totalHeight = 0;
          let maxChildWidth = CARD_WIDTH;
          const childY = unionY + CARD_HEIGHT + 100;
          
          childIds.forEach((childId, index) => {
            const child = allPeople.find(p => p.id === childId);
            if (!child) return;
            
            // Placera barnet
            const childX = unionX; // Centrera under Union Node för nu
            const childPlaceY = childY + (index * (CARD_HEIGHT + 100));
            nodes.push({ ...child, x: childX, y: childPlaceY });
            
            // Linje från Union Node till barnet
            edges.push({
              from: { x: unionX, y: unionY },
              to: { x: childX, y: childPlaceY - (CARD_HEIGHT/2) + 20 },
              type: 'parent'
            });
            
            // Rekursivt placera barnbarn
            const childChildren = (child.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
            const { height: childSubtreeHeight, width: childSubtreeWidth } = placeChildrenUnderUnionNode(
              childX, childPlaceY + (CARD_HEIGHT/2), childChildren, depth + 1, maxDepth
            );
            
            totalHeight += CARD_HEIGHT + 100 + childSubtreeHeight;
            maxChildWidth = Math.max(maxChildWidth, childSubtreeWidth);
          });
          
          return { height: totalHeight, width: maxChildWidth };
        };
        
        // Fokus-person centrerad på X=0, Y=0
        nodes.push({ ...focusPerson, x: 0, y: 0, isFocus: true });

        // Föräldrar - placera OVANFÖR fokus-personen (negativ Y)
        const pIds = data.relationships.parents || [];
        const parentY = -(CARD_HEIGHT + 100);
        
        if (pIds.length === 2) {
          // Använd allPeople för att få uppdaterad data med partners-relationer
          const parent1FromAll = allPeople.find(p => p.id === pIds[0]);
          const parent2FromAll = allPeople.find(p => p.id === pIds[1]);
          const parent1 = data.people[pIds[0]];
          const parent2 = data.people[pIds[1]];
          
          // Kolla om de är partners (använd allPeople för uppdaterad data)
          const parent1Partners = (parent1FromAll?.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
          const parent2Partners = (parent2FromAll?.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
          const arePartners = parent1FromAll && parent2FromAll && (
            parent1Partners.includes(pIds[1]) || parent2Partners.includes(pIds[0])
          );
          
          console.log('[calculateLayout] Föräldrar:', {
            parent1Id: pIds[0],
            parent1Name: parent1FromAll?.firstName + ' ' + parent1FromAll?.lastName,
            parent1Partners: parent1Partners,
            parent2Id: pIds[1],
            parent2Name: parent2FromAll?.firstName + ' ' + parent2FromAll?.lastName,
            parent2Partners: parent2Partners,
            arePartners: arePartners
          });
          
          if (arePartners && parent1 && parent2) {
            // Placera föräldrar horisontellt bredvid varandra
            const partnerGap = 500;
            const parent1X = -(partnerGap/2) - (CARD_WIDTH/2);
            const parent2X = (partnerGap/2) + (CARD_WIDTH/2);
            
            nodes.push({ ...parent1, x: parent1X, y: parentY });
            nodes.push({ ...parent2, x: parent2X, y: parentY });
            
            // Horisontell partner-linje (använd allPeople för att få partner-typ)
            const partner1 = (parent1FromAll.relations?.partners || []).find(p => {
              const partnerId = typeof p === 'object' ? p.id : p;
              return partnerId === pIds[1];
            });
            const partnerType = (typeof partner1 === 'object' && partner1.type) ? partner1.type : 'Okänd';
            
            edges.push({
              from: { x: parent1X + (CARD_WIDTH/2) - 10, y: parentY },
              to: { x: parent2X - (CARD_WIDTH/2) + 10, y: parentY },
              type: 'partner-horizontal',
              midPoint: { x: 0, y: parentY },
              styleType: partnerType,
              person1Id: pIds[0],
              person2Id: pIds[1]
            });
            
            // Vertikal linje från mitten av partner-linjen NER till fokus-personen
            edges.push({
              from: { x: 0, y: parentY + (CARD_HEIGHT/2) - 20 },
              to: { x: 0, y: -(FOCUS_HEIGHT/2) + 20 },
              type: 'parent'
            });
          } else {
            // Om de inte är partners, placera dem vertikalt
        const pGap = 340;
        const pStartX = -((pIds.length - 1) * pGap) / 2;
        pIds.forEach((pid, index) => {
            const p = data.people[pid];
            if (!p) return;
            const x = pStartX + (index * pGap);
            nodes.push({ ...p, x, y: parentY });
              edges.push({
                from: { x: 0, y: -(FOCUS_HEIGHT/2) + 20 },
                to: { x, y: parentY + (CARD_HEIGHT/2) - 20 },
                type: 'parent'
              });
            });
          }
        } else if (pIds.length > 0) {
          // Om det inte är exakt 2 föräldrar
          const pGap = 340;
          const pStartX = -((pIds.length - 1) * pGap) / 2;
          pIds.forEach((pid, index) => {
            const p = data.people[pid];
            if (!p) return;
            const x = pStartX + (index * pGap);
            nodes.push({ ...p, x, y: parentY });
            edges.push({
              from: { x: 0, y: -(FOCUS_HEIGHT/2) + 20 },
              to: { x, y: parentY + (CARD_HEIGHT/2) - 20 },
              type: 'parent'
            });
          });
        }

        // Partners och barn med Union Nodes
        const partners = data.relationships.partners || [];
        const allChildren = data.relationships.children || [];
        const focusPersonId = data.focusId;
        
        // För att undvika att visa samma barn under flera partners
        const alreadyShownChildren = new Set();
        
        console.log(`[calculateLayout] Focus person ID: ${focusPersonId}, allChildren:`, allChildren);
        
        // Beräkna bredden på varje partners barn-subträd
        const partnerData = partners
          .filter(partnerRef => partnerRef.id) // Hoppa över ghost partners
          .map(partnerRef => {
            const partnerId = partnerRef.id;
            const partner = data.people[partnerId];
            if (!partner) return null;
            
            // Hitta partnern i allPeople för att få uppdaterad data
            const partnerInAllPeople = allPeople.find(p => p.id === partnerId);
            const partnerChildrenList = (partnerInAllPeople?.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
            
            // Hitta alla barn som har både fokus och denna partner som föräldrar
            const partnerChildren = allChildren.filter(childId => {
              if (alreadyShownChildren.has(childId)) return false;
              
              const child = allPeople.find(p => p.id === childId);
              if (!child) return false;
              
              const childParents = (child.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
              const hasBothParents = childParents.includes(focusPersonId) && childParents.includes(partnerId);
              
              const partnerHasChild = partnerChildrenList.includes(childId);
              const focusHasChild = allChildren.includes(childId);
              const bothHaveChild = focusHasChild && partnerHasChild;
              
              const shouldShow = hasBothParents || bothHaveChild;
              
              if (shouldShow) {
                alreadyShownChildren.add(childId);
              }
              
              return shouldShow;
            });
            
            // Beräkna bredden på denna partners barn-subträd
            const subtreeWidth = calculateSubtreeWidth(partnerChildren);
            
            return {
              partnerRef,
              partnerId,
              partner,
              partnerChildren,
              subtreeWidth
            };
          })
          .filter(Boolean);
        
        // Placera partners horisontellt med Union Nodes
        // Layout: [Partner 1] — (Union A) — [Fokusperson] — (Union B) — [Partner 2]
        const partnerGap = 200; // Minsta avstånd mellan partners
        const leftPartners = [];
        const rightPartners = [];
        
        // Dela upp partners i vänster och höger (första till vänster, resten till höger)
        partnerData.forEach((partnerInfo, index) => {
          if (index === 0) {
            leftPartners.push(partnerInfo);
          } else {
            rightPartners.push(partnerInfo);
          }
        });
        
        // Placera partners till vänster
        let leftOffset = 0;
        leftPartners.forEach((partnerInfo) => {
          const { partnerRef, partnerId, partner, partnerChildren, subtreeWidth } = partnerInfo;
          
          const neededSpace = Math.max(subtreeWidth, CARD_WIDTH) + partnerGap;
          const partnerX = -leftOffset - neededSpace - (CARD_WIDTH / 2);
          const unionX = (partnerX + 0) / 2; // Mittpunkt mellan partner och fokus
          
          leftOffset += neededSpace;
          
          // Placera partnern på samma Y-nivå som fokus (Y=0)
          nodes.push({ ...partner, x: partnerX, y: 0 });
          
          // Horisontell linje mellan fokus och partner med hjärta
          edges.push({
            from: { x: partnerX + (CARD_WIDTH/2) - 10, y: 0 },
            to: { x: 0 - (FOCUS_WIDTH/2) + 10, y: 0 },
            type: 'partner-horizontal',
            midPoint: { x: unionX, y: 0 },
            styleType: partnerRef.type || 'Gift',
            person1Id: partnerId,
            person2Id: focusPersonId
          });
          
          // Placera barnen under Union Node
          if (partnerChildren.length > 0) {
            placeChildrenUnderUnionNode(unionX, 0, partnerChildren);
          }
          
          // Placera partnerns föräldrar ovanför partnern
          const partnerInAllPeople = allPeople.find(p => p.id === partnerId);
          if (partnerInAllPeople && partnerInAllPeople.relations?.parents) {
            const partnerParentIds = (partnerInAllPeople.relations.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
            const partnerParentsY = -(CARD_HEIGHT + 100);
            
            if (partnerParentIds.length === 2) {
              const partnerParent1FromAll = allPeople.find(p => p.id === partnerParentIds[0]);
              const partnerParent2FromAll = allPeople.find(p => p.id === partnerParentIds[1]);
              const partnerParent1 = data.people[partnerParentIds[0]];
              const partnerParent2 = data.people[partnerParentIds[1]];
              
              // Kolla om de är partners
              const partnerParent1Partners = (partnerParent1FromAll?.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
              const partnerParent2Partners = (partnerParent2FromAll?.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
              const partnerParentsArePartners = partnerParent1FromAll && partnerParent2FromAll && (
                partnerParent1Partners.includes(partnerParentIds[1]) || partnerParent2Partners.includes(partnerParentIds[0])
              );
              
              if (partnerParentsArePartners && partnerParent1 && partnerParent2) {
                const partnerParentGap = 500;
                const partnerParent1X = partnerX - (partnerParentGap/2) - (CARD_WIDTH/2);
                const partnerParent2X = partnerX + (partnerParentGap/2) + (CARD_WIDTH/2);
                
                nodes.push({ ...partnerParent1, x: partnerParent1X, y: partnerParentsY });
                nodes.push({ ...partnerParent2, x: partnerParent2X, y: partnerParentsY });
                
                // Horisontell partner-linje
                const partnerParent1Rel = (partnerParent1FromAll.relations?.partners || []).find(p => {
                  const pId = typeof p === 'object' ? p.id : p;
                  return pId === partnerParentIds[1];
                });
                const partnerParentType = (typeof partnerParent1Rel === 'object' && partnerParent1Rel.type) ? partnerParent1Rel.type : 'Okänd';
                
                edges.push({
                  from: { x: partnerParent1X + (CARD_WIDTH/2) - 10, y: partnerParentsY },
                  to: { x: partnerParent2X - (CARD_WIDTH/2) + 10, y: partnerParentsY },
                  type: 'partner-horizontal',
                  midPoint: { x: partnerX, y: partnerParentsY },
                  styleType: partnerParentType,
                  person1Id: partnerParentIds[0],
                  person2Id: partnerParentIds[1]
                });
                
                // Vertikal linje från partnerns föräldrar ner till partnern
                edges.push({
                  from: { x: partnerX, y: partnerParentsY + (CARD_HEIGHT/2) - 20 },
                  to: { x: partnerX, y: 0 - (CARD_HEIGHT/2) + 20 },
                  type: 'parent'
                });
              } else if (partnerParent1 && partnerParent2) {
                // Om de inte är partners, placera dem vertikalt
                const partnerPGap = 340;
                const partnerPStartX = partnerX - ((partnerParentIds.length - 1) * partnerPGap) / 2;
                partnerParentIds.forEach((ppid, pidx) => {
                  const pp = data.people[ppid];
                  if (!pp) return;
                  const ppx = partnerPStartX + (pidx * partnerPGap);
                  nodes.push({ ...pp, x: ppx, y: partnerParentsY });
                  edges.push({
                    from: { x: partnerX, y: 0 - (CARD_HEIGHT/2) + 20 },
                    to: { x: ppx, y: partnerParentsY + (CARD_HEIGHT/2) - 20 },
                    type: 'parent'
                  });
                });
              }
            } else if (partnerParentIds.length > 0) {
              // Om det inte är exakt 2 föräldrar
              const partnerPGap = 340;
              const partnerPStartX = partnerX - ((partnerParentIds.length - 1) * partnerPGap) / 2;
              partnerParentIds.forEach((ppid, pidx) => {
                const pp = data.people[ppid];
                if (!pp) return;
                const ppx = partnerPStartX + (pidx * partnerPGap);
                nodes.push({ ...pp, x: ppx, y: partnerParentsY });
                edges.push({
                  from: { x: partnerX, y: 0 - (CARD_HEIGHT/2) + 20 },
                  to: { x: ppx, y: partnerParentsY + (CARD_HEIGHT/2) - 20 },
                  type: 'parent'
                });
              });
            }
          }
        });
        
        // Placera partners till höger
        let rightOffset = 0;
        rightPartners.forEach((partnerInfo) => {
          const { partnerRef, partnerId, partner, partnerChildren, subtreeWidth } = partnerInfo;
          
          const neededSpace = Math.max(subtreeWidth, CARD_WIDTH) + partnerGap;
          const partnerX = rightOffset + neededSpace + (CARD_WIDTH / 2);
          const unionX = (0 + partnerX) / 2; // Mittpunkt mellan fokus och partner
          
          rightOffset += neededSpace;
          
          // Placera partnern på samma Y-nivå som fokus (Y=0)
          nodes.push({ ...partner, x: partnerX, y: 0 });
          
          // Horisontell linje mellan fokus och partner med hjärta
          edges.push({
            from: { x: 0 + (FOCUS_WIDTH/2) - 10, y: 0 },
            to: { x: partnerX - (CARD_WIDTH/2) + 10, y: 0 },
            type: 'partner-horizontal',
            midPoint: { x: unionX, y: 0 },
            styleType: partnerRef.type || 'Gift',
            person1Id: focusPersonId,
            person2Id: partnerId
          });
          
          // Placera barnen under Union Node
          if (partnerChildren.length > 0) {
            placeChildrenUnderUnionNode(unionX, 0, partnerChildren);
          }
          
          // Placera partnerns föräldrar ovanför partnern
          const partnerInAllPeople = allPeople.find(p => p.id === partnerId);
          if (partnerInAllPeople && partnerInAllPeople.relations?.parents) {
            const partnerParentIds = (partnerInAllPeople.relations.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
            const partnerParentsY = -(CARD_HEIGHT + 100);
            
            if (partnerParentIds.length === 2) {
              const partnerParent1FromAll = allPeople.find(p => p.id === partnerParentIds[0]);
              const partnerParent2FromAll = allPeople.find(p => p.id === partnerParentIds[1]);
              const partnerParent1 = data.people[partnerParentIds[0]];
              const partnerParent2 = data.people[partnerParentIds[1]];
              
              // Kolla om de är partners
              const partnerParent1Partners = (partnerParent1FromAll?.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
              const partnerParent2Partners = (partnerParent2FromAll?.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
              const partnerParentsArePartners = partnerParent1FromAll && partnerParent2FromAll && (
                partnerParent1Partners.includes(partnerParentIds[1]) || partnerParent2Partners.includes(partnerParentIds[0])
              );
              
              if (partnerParentsArePartners && partnerParent1 && partnerParent2) {
                const partnerParentGap = 500;
                const partnerParent1X = partnerX - (partnerParentGap/2) - (CARD_WIDTH/2);
                const partnerParent2X = partnerX + (partnerParentGap/2) + (CARD_WIDTH/2);
                
                nodes.push({ ...partnerParent1, x: partnerParent1X, y: partnerParentsY });
                nodes.push({ ...partnerParent2, x: partnerParent2X, y: partnerParentsY });
                
                // Horisontell partner-linje
                const partnerParent1Rel = (partnerParent1FromAll.relations?.partners || []).find(p => {
                  const pId = typeof p === 'object' ? p.id : p;
                  return pId === partnerParentIds[1];
                });
                const partnerParentType = (typeof partnerParent1Rel === 'object' && partnerParent1Rel.type) ? partnerParent1Rel.type : 'Okänd';
                
                edges.push({
                  from: { x: partnerParent1X + (CARD_WIDTH/2) - 10, y: partnerParentsY },
                  to: { x: partnerParent2X - (CARD_WIDTH/2) + 10, y: partnerParentsY },
                  type: 'partner-horizontal',
                  midPoint: { x: partnerX, y: partnerParentsY },
                  styleType: partnerParentType,
                  person1Id: partnerParentIds[0],
                  person2Id: partnerParentIds[1]
                });
                
                // Vertikal linje från partnerns föräldrar ner till partnern
                edges.push({
                  from: { x: partnerX, y: partnerParentsY + (CARD_HEIGHT/2) - 20 },
                  to: { x: partnerX, y: 0 - (CARD_HEIGHT/2) + 20 },
                  type: 'parent'
                });
              } else if (partnerParent1 && partnerParent2) {
                // Om de inte är partners, placera dem vertikalt
                const partnerPGap = 340;
                const partnerPStartX = partnerX - ((partnerParentIds.length - 1) * partnerPGap) / 2;
                partnerParentIds.forEach((ppid, pidx) => {
                  const pp = data.people[ppid];
                  if (!pp) return;
                  const ppx = partnerPStartX + (pidx * partnerPGap);
                  nodes.push({ ...pp, x: ppx, y: partnerParentsY });
                  edges.push({
                    from: { x: partnerX, y: 0 - (CARD_HEIGHT/2) + 20 },
                    to: { x: ppx, y: partnerParentsY + (CARD_HEIGHT/2) - 20 },
                    type: 'parent'
                  });
                });
              }
            } else if (partnerParentIds.length > 0) {
              // Om det inte är exakt 2 föräldrar
              const partnerPGap = 340;
              const partnerPStartX = partnerX - ((partnerParentIds.length - 1) * partnerPGap) / 2;
              partnerParentIds.forEach((ppid, pidx) => {
                const pp = data.people[ppid];
                if (!pp) return;
                const ppx = partnerPStartX + (pidx * partnerPGap);
                nodes.push({ ...pp, x: ppx, y: partnerParentsY });
                edges.push({
                  from: { x: partnerX, y: 0 - (CARD_HEIGHT/2) + 20 },
                  to: { x: ppx, y: partnerParentsY + (CARD_HEIGHT/2) - 20 },
                  type: 'parent'
                });
              });
            }
          }
        });

        return { nodes, edges };
    };

  // ANVÄND DEN NYA LAYOUT-FUNKTIONEN!
  const { nodes, edges } = calculateVerticalLayout();

  // Mouse handlers
  const handleWheel = (e) => {
    e.preventDefault();
    setTransform(prev => ({ ...prev, scale: Math.min(Math.max(prev.scale + (-e.deltaY * 0.001), 0.1), 3) }));
  };
  const handleMouseDown = (e) => { 
      if (e.button === 0) { setDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); }
  };
  const handleMouseMove = (e) => {
    if (!dragging) return;
    setTransform(prev => ({ ...prev, x: prev.x + (e.clientX - lastPos.x), y: prev.y + (e.clientY - lastPos.y) }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };
  
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setTransform(prev => ({ ...prev, x: width / 2, y: height / 2 - 100 }));
    }
  }, []);

  // Centrera en specifik person (men gör den inte till fokus)
  useEffect(() => {
    if (personToCenter && nodes.length > 0 && containerRef.current) {
      const personNode = nodes.find(n => n.id === personToCenter);
      if (personNode) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        // Centrera på personens koordinater
        const centerX = width / 2 - (personNode.x * transform.scale);
        const centerY = height / 2 - (personNode.y * transform.scale);
        setTransform(prev => ({ ...prev, x: centerX, y: centerY }));
        
        // Anropa callback när centrering är klar
        if (onPersonCentered) {
          setTimeout(() => {
            onPersonCentered();
          }, 100);
        }
      }
    }
  }, [personToCenter, nodes, transform.scale, onPersonCentered]);

  // Om ingen fokusperson, visa meddelande
  if (!focusPerson) {
    return (
      <div className="w-full h-screen bg-slate-950 overflow-hidden flex items-center justify-center">
        <div className="text-slate-400 text-center">
          <Network size={64} className="mx-auto mb-4 opacity-20" />
          <p>Välj en person att fokusera på för att visa släktträdet.</p>
          <Button 
            variant="primary" 
            className="mt-4"
            onClick={() => setIsAdvancedSearchOpen(true)}
          >
            <Search size={16} />
            Sök person
          </Button>
        </div>

        {isAdvancedSearchOpen && (
          <AdvancedSearchModal 
              onClose={() => setIsAdvancedSearchOpen(false)}
              people={displayPeople}
              focusId={data.focusId}
              onNavigate={navigateToPerson}
              onEdit={handleEditPerson}
              onAddParent={handleAddParent}
              onAddSibling={handleAddSibling}
              onAddChild={handleAddChild}
              onAddPartner={handleAddPartner}
              onDelete={handleDelete}
              onToggleMain={handleToggleMain}
              onToggleBookmark={handleToggleBookmark}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-slate-950 overflow-hidden relative font-sans text-slate-800 select-none" onContextMenu={(e) => e.preventDefault()}>
      
      {/* --- TOPPEN VÄNSTER: SÖK & HISTORIK --- */}
      <div className="absolute top-4 left-4 z-50 flex gap-2">
          {/* Historik */}
          <div className="flex bg-slate-800 rounded shadow border border-slate-600">
              <button 
                onClick={() => {
                  const newIndex = Math.max(0, historyIndex - 1);
                  setHistoryIndex(newIndex);
                  if (onSetFocus) onSetFocus(history[newIndex]);
                }}
                disabled={historyIndex === 0}
                className="p-2 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-px bg-slate-600"></div>
              <button 
                onClick={() => {
                  const newIndex = Math.min(history.length - 1, historyIndex + 1);
                  setHistoryIndex(newIndex);
                  if (onSetFocus) onSetFocus(history[newIndex]);
                }}
                disabled={historyIndex >= history.length - 1}
                className="p-2 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
              >
                <ArrowRight size={20} />
              </button>
          </div>
          {/* Snabb-sök */}
          <div className="relative group">
              <div className="flex items-center bg-slate-800 border border-slate-600 rounded shadow px-3 py-2 w-64 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                  <Search size={16} className="text-slate-400 mr-2" />
                  <input 
                    type="text" placeholder="Snabb sök..." 
                    className="bg-transparent border-none outline-none text-slate-200 text-sm w-full placeholder-slate-500"
                    onChange={(e) => {
                         const q = e.target.value.toLowerCase();
                         setSearchResults(q.length > 1 ? displayPeople.filter(p => (p.firstName+' '+p.lastName).toLowerCase().includes(q)) : []);
                    }}
                  />
              </div>
              {/* Resultat dropdown */}
              {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-600 rounded shadow-xl z-50">
                      {searchResults.map(p => (
                          <div key={p.id} className="px-3 py-2 hover:bg-slate-700 cursor-pointer text-slate-200 text-sm" onClick={() => { navigateToPerson(p.id); setSearchResults([]); }}>
                              {p.firstName} {p.lastName}
                          </div>
                      ))}
                  </div>
              )}
          </div>
          {/* Generationer slider */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded shadow px-3 py-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Generationer:</span>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={generations} 
                onChange={(e) => setGenerations(parseInt(e.target.value))}
                className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((generations - 1) / 9) * 100}%, #475569 ${((generations - 1) / 9) * 100}%, #475569 100%)`
                }}
              />
              <span className="text-sm text-slate-200 font-medium min-w-[2rem] text-right">{generations}</span>
          </div>
          {/* Antal personer */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded shadow px-3 py-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Personer:</span>
              <span className="text-sm text-slate-200 font-medium">{peopleCount}</span>
          </div>
          {/* Kompakt/Utökad vy */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded shadow px-3 py-2">
              <button
                onClick={() => setCompactView(!compactView)}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  compactView 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
                title={compactView ? 'Växla till utökad vy' : 'Växla till kompakt vy'}
              >
                {compactView ? 'Utökad' : 'Kompakt'}
              </button>
          </div>
      </div>

      {/* --- TOPPEN HÖGER: VERKTYG & NY AVANCERAD SÖK KNAPP --- */}
      <div className="absolute top-4 right-4 z-50 flex items-start gap-3">
         
         {/* DEN NYA KNAPPEN: AVANCERAD SÖK */}
         <Button
            variant="primary"
            size="md"
            onClick={() => setIsAdvancedSearchOpen(true)}
         >
             <List size={18} />
             <span className="hidden sm:inline">Avancerad sök</span>
         </Button>

         {/* Zoom kontroller */}
         <div className="flex flex-col gap-2 bg-slate-800/80 p-2 rounded border border-slate-700 shadow-lg backdrop-blur-sm">
             <button onClick={() => setTransform(p => ({...p, scale: p.scale + 0.1}))} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-slate-200"><Plus size={20}/></button>
             <button onClick={() => setTransform(p => ({...p, scale: p.scale - 0.1}))} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-slate-200"><Minus size={20}/></button>
             <button onClick={() => setTransform(p => ({x: window.innerWidth/2, y: window.innerHeight/2 - 100, scale: 0.8}))} className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-slate-200"><Home size={20}/></button>
         </div>
      </div>

      {/* --- MODALS --- */}
      {isAdvancedSearchOpen && (
          <AdvancedSearchModal 
              onClose={() => setIsAdvancedSearchOpen(false)}
              people={displayPeople}
              focusId={data.focusId}
              onNavigate={navigateToPerson}
              onEdit={handleEditPerson}
              onAddParent={handleAddParent}
              onAddSibling={handleAddSibling}
              onAddChild={handleAddChild}
              onAddPartner={handleAddPartner}
              onDelete={handleDelete}
              onToggleMain={handleToggleMain}
              onToggleBookmark={handleToggleBookmark}
          />
      )}

      {editPerson && (
          <EditPersonModal 
              person={editPerson} 
              onClose={() => setEditPerson(null)} 
          />
      )}

      {partnerSelect && (
          <PartnerSelectModal
              partners={partnerSelect.partners}
              people={data.people}
              onClose={() => setPartnerSelect(null)}
              onSelect={(partnerId) => handleCreateChildWithPartners(partnerSelect.parentId, partnerId)}
          />
      )}

      {selectFatherModal && (
          <SelectFatherModal
              mother={selectFatherModal.mother}
              allPeople={allPeople}
              getPersonRelations={getPersonRelations}
              onSelect={handleFatherSelected}
              onCreateNew={handleCreateNewFather}
              onClose={() => setSelectFatherModal(null)}
          />
      )}

      {/* --- CANVAS --- */}
      <div 
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0 }}>
            {/* Linjer (SVG) */}
            <svg style={{ position: 'absolute', top: -50000, left: -50000, width: 100000, height: 100000, pointerEvents: 'none', zIndex: 0 }} viewBox="-50000 -50000 100000 100000">
                {edges.map((edge, i) => {
                    // Stöd för både from/to OCH x1/y1/x2/y2 format
                    const source = edge.from || { x: edge.x1, y: edge.y1 };
                    const target = edge.to || { x: edge.x2, y: edge.y2 };
                    
                    return (
                    <g key={i}>
                        <path d={getPath(source, target, edge.type)} stroke="#475569" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={(edge.type === 'partner-horizontal' || edge.type === 'partner-vertical' || edge.type === 'step-link' || edge.styleType === 'divorced' || edge.styleType === 'Skild' || edge.dashed) ? '6,6' : '0'} />
                        {edge.midPoint && (edge.type === 'straight-down' || edge.type === 'partner-horizontal' || edge.type === 'partner-vertical' || edge.type === 'step-left') && (() => {
                            // Bestäm ikon och färg baserat på partner-typ
                            let IconComponent;
                            let iconColor;
                            
                            if (edge.styleType === 'divorced' || edge.styleType === 'Skild') {
                                IconComponent = HeartCrack;
                                iconColor = 'text-blue-300';
                            } else if (edge.styleType === 'Förlovad') {
                                IconComponent = Heart;
                                iconColor = 'text-yellow-400';
                            } else if (edge.styleType === 'Sambo') {
                                IconComponent = HeartHandshake;
                                iconColor = 'text-green-400';
                            } else if (edge.styleType === 'Okänd') {
                                // För okänd: visa både Heart och HelpCircle
                                return (
                                    <foreignObject x={edge.midPoint.x - 24} y={edge.midPoint.y - 24} width="48" height="48" style={{ pointerEvents: 'all' }}>
                                        <div 
                                            className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-600 z-10 shadow-lg relative cursor-pointer hover:bg-slate-700 transition-colors"
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (edge.person1Id && edge.person2Id) {
                                                    const x = Math.min(e.clientX, window.innerWidth - 200);
                                                    const y = Math.min(e.clientY, window.innerHeight - 300);
                                                    setHeartContextMenu({ x, y, person1Id: edge.person1Id, person2Id: edge.person2Id, currentType: edge.styleType || 'Okänd' });
                                                }
                                            }}
                                        >
                                            <Heart size={20} className="text-slate-400 absolute" />
                                            <HelpCircle size={12} className="text-slate-500 absolute -top-1 -right-1 bg-slate-800 rounded-full" />
                                </div>
                            </foreignObject>
                                );
                            } else {
                                // Gift eller married (default)
                                IconComponent = Heart;
                                iconColor = 'text-rose-500';
                            }
                            
                            return (
                                <foreignObject x={edge.midPoint.x - 24} y={edge.midPoint.y - 24} width="48" height="48" style={{ pointerEvents: 'all' }}>
                                    <div 
                                        className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-600 z-10 shadow-lg cursor-pointer hover:bg-slate-700 transition-colors"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (edge.person1Id && edge.person2Id) {
                                                const x = Math.min(e.clientX, window.innerWidth - 200);
                                                const y = Math.min(e.clientY, window.innerHeight - 300);
                                                setHeartContextMenu({ x, y, person1Id: edge.person1Id, person2Id: edge.person2Id, currentType: edge.styleType || 'Gift' });
                                            }
                                        }}
                                    >
                                        <IconComponent size={24} className={iconColor}/>
                                    </div>
                                </foreignObject>
                            );
                        })()}
                    </g>
                    );
                })}
            </svg>

            {/* Kort (Nodes) */}
            {nodes.map(node => {
                const warnings = validatePerson(node);
                const isGhost = !!node.isGhostParent;
                // Använd CONFIG_USER för nya layouten
                const width = CONFIG_USER.CARD_WIDTH;
                const height = CONFIG_USER.CARD_HEIGHT;
                
                // Tooltip-innehåll
                const tooltipContent = !isGhost ? [
                    node.birthPlace && `Född: ${node.birthPlace}`,
                    node.deathPlace && `Död: ${node.deathPlace}`,
                    node.title && `Yrke: ${node.title}`,
                    node.age !== null && `Ålder: ${node.age} år`,
                    node.childrenCount > 0 && `${node.childrenCount} barn`
                ].filter(Boolean).join('\n') : '';
                
                return (
                    <div 
                        key={node.id}
                        className={`absolute flex flex-col shadow-2xl rounded-lg overflow-hidden border-2 transition-all duration-300 hover:scale-105 hover:z-50 
                            ${isGhost ? 'bg-slate-800 border-slate-500 border-dashed text-slate-200 opacity-90' : (node.gender === 'M' ? 'bg-blue-50 border-blue-200' : node.gender === 'K' ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200')} 
                            ${node.isFocus ? 'ring-4 ring-yellow-400 z-40' : 'z-10'}`
                        }
                        style={{ left: node.x - width / 2, top: node.y - height / 2, width, height }}
                        onDoubleClick={isGhost ? undefined : () => navigateToPerson(node.id)}
                        onContextMenu={(e) => { if (isGhost) return; handleTreeContextMenu(e, node); }}
                        title={tooltipContent}
                    >
                        <div className={`${isGhost ? 'bg-slate-700 text-slate-100 italic' : (node.gender === 'M' ? 'bg-blue-600' : node.gender === 'K' ? 'bg-rose-500' : 'bg-gray-500') + ' text-white'} px-3 py-1.5 flex items-center gap-2 shadow-sm relative`}>
                            {/* Korset före förnamnet om personen är död */}
                            {!isGhost && node.deathDate && <span className="text-xl font-bold text-red-600">✝</span>}
                            <span className="font-bold truncate text-sm flex-1">{node.firstName} {node.lastName}</span>
                            {/* Släktträdsikon till vänster om REF */}
                            {!isGhost && node.isPartner && (
                                <button title="Visa träd för denna person" className="p-1 rounded hover:bg-blue-700/30" onClick={e => { e.stopPropagation(); navigateToPerson(node.id); }}>
                                    <Network size={16} className="text-blue-200" />
                                </button>
                            )}
                            {/* Ref-nummer - samma storlek som namnet */}
                            {!isGhost && node.refNumber && (
                                <span className="font-bold text-sm">Ref: {node.refNumber}</span>
                            )}
                            {!isGhost && node.isBookmarked && <Star size={12} className="fill-yellow-300 text-yellow-300"/>}
                            {!isGhost && warnings.length > 0 && <AlertTriangle size={14} className="text-yellow-300 animate-pulse" />}
                            {!isGhost && node.isPlaceholder && (
                                <span className="text-[9px] opacity-80 bg-slate-600 px-1.5 py-0.5 rounded">Placeholder</span>
                            )}
                            {isGhost && <span className="text-xs opacity-80">Saknad förälder</span>}
                        </div>

                        <div className="flex flex-1 p-3 gap-3 relative group">
                            <div className="flex flex-col items-center gap-0.5 relative">
                                <div 
                                    className={`w-20 h-20 rounded overflow-hidden flex-shrink-0 shadow-inner cursor-pointer hover:opacity-80 transition-opacity relative ${
                                        isGhost 
                                            ? 'bg-slate-700 border border-slate-500' 
                                            : node.gender === 'M' 
                                                ? 'bg-blue-300 border border-blue-400' 
                                                : node.gender === 'K' 
                                                    ? 'bg-rose-300 border border-rose-400' 
                                                    : 'bg-gray-300 border border-gray-400'
                                    }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isGhost && onOpenEditModal) {
                                            onOpenEditModal(node.id);
                                        }
                                    }}
                                >
                                    {isGhost ? (
                                        <Plus className="w-full h-full p-2 text-slate-200" />
                                    ) : node.media && node.media.length > 0 && node.media[0]?.url ? (
                                        <>
                                            <MediaImage 
                                                url={node.media[0].url} 
                                                alt={`${node.firstName} ${node.lastName}`}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Svart snedstreck för avlidna personer */}
                                            {node.deathDate && (
                                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                                                    <div className="absolute top-0 left-0 bg-black" style={{ transform: 'rotate(-45deg)', transformOrigin: 'top left', width: '141%', height: '4px', top: '-2px', left: '-2px' }}></div>
                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <User className={`w-full h-full p-2 ${
                                                node.gender === 'M' 
                                                    ? 'text-blue-600' 
                                                    : node.gender === 'K' 
                                                        ? 'text-rose-600' 
                                                        : 'text-gray-500'
                                            }`} />
                                            {/* Svart snedstreck för avlidna personer */}
                                            {node.deathDate && (
                                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                                                    <div className="absolute top-0 left-0 bg-black" style={{ transform: 'rotate(-45deg)', transformOrigin: 'top left', width: '141%', height: '4px', top: '-2px', left: '-2px' }}></div>
                            </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                {/* Ålder under profilbilden - centrerat */}
                                {!isGhost && node.age !== null && (
                                    <div className="flex flex-col items-center mt-1">
                                        <span className={`text-sm font-medium ${isGhost ? 'text-slate-200' : 'text-slate-700'}`}>
                                            {node.age} år
                                        </span>
                                    </div>
                                )}
                                {/* Antal barn badge - vänsterjusterad */}
                                {!isGhost && node.childrenCount > 0 && (
                                    <div className="bg-blue-600 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white shadow-sm mt-1">
                                        {node.childrenCount}
                                    </div>
                                )}
                            </div>
                            <div className={`flex-1 flex flex-col text-sm space-y-1 ${isGhost ? 'text-slate-200' : 'text-slate-700'}`}>
                                {isGhost ? (
                                    <>
                                        <div className="font-semibold text-base">Lägg till förälder</div>
                                        <div className="text-xs opacity-80">Klicka för att lägga till saknad förälder</div>
                                    </>
                                ) : (
                                    <>
                                        {/* Födelse och död i samma höjd som profilbilden */}
                                        <div className="flex flex-col gap-1">
                                {node.birthDate && (
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <span className="text-slate-600 font-bold">*</span>
                                                    <span className="font-medium">
                                                        {node.birthDate}
                                                        {node.birthPlace && `, ${node.birthPlace}`}
                                                    </span>
                                    </div>
                                )}
                                {node.deathDate && (
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <span className="text-slate-600 font-bold">+</span>
                                                    <span className="font-medium">
                                                        {node.deathDate}
                                                        {node.deathPlace && `, ${node.deathPlace}`}
                                                    </span>
                                    </div>
                                )}
                                            {/* Yrken under dödsdatumet */}
                                            {node.occupations && node.occupations.length > 0 && (
                                                <div className="flex items-center gap-1.5 text-sm mt-0.5">
                                                    <span className="text-slate-600 font-bold">Yrke:</span>
                                                    <span className="font-medium">
                                                        {node.occupations.join(', ')}
                                                    </span>
                            </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

      {/* Context Menu för Trädvy */}
      {treeContextMenu && (
        <div 
          className="fixed z-[6000] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-64 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50"
          style={{ left: treeContextMenu.x, top: treeContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-700 bg-slate-800/50">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Vald person</div>
            <div className="font-medium text-slate-200 truncate">{treeContextMenu.person.firstName} {treeContextMenu.person.lastName}</div>
          </div>
          
          <div className="py-1">
            <TreeMenuItem icon={Edit2} label="Redigera" onClick={() => { setTreeContextMenu(null); handleEditPerson(treeContextMenu.person); }} color="text-blue-300" />
            <TreeMenuItem icon={UserPlus} label="Skapa ny (Oberoende)" onClick={() => { setTreeContextMenu(null); handleEditPerson({firstName: 'Ny', lastName: 'Person'}); }} />
          </div>
          
          <div className="h-px bg-slate-700 mx-2"/>
          
          <div className="py-1">
            <TreeMenuItem icon={Users} label="Skapa förälder" onClick={() => { setTreeContextMenu(null); handleAddParent(treeContextMenu.person); }} />
            <TreeMenuItem icon={GitFork} label="Skapa syskon" onClick={() => { setTreeContextMenu(null); handleAddSibling(treeContextMenu.person); }} />
            <TreeMenuItem icon={Baby} label="Skapa barn" onClick={() => { setTreeContextMenu(null); handleAddChild(treeContextMenu.person); }} />
            <TreeMenuItem icon={Heart} label="Skapa partner" onClick={() => { setTreeContextMenu(null); handleAddPartner(treeContextMenu.person); }} />
          </div>
          
          <div className="h-px bg-slate-700 mx-2"/>
          
          <div className="py-1">
            <TreeMenuItem 
              icon={Star} 
              label="Gör till Huvudperson" 
              onClick={() => { setTreeContextMenu(null); handleToggleMain(treeContextMenu.person); }} 
              color={treeContextMenu.person.id === data.focusId ? "text-yellow-400" : "text-slate-300"} 
            />
            <TreeMenuItem 
              icon={Bookmark} 
              label="Bokmärke" 
              onClick={() => { setTreeContextMenu(null); handleToggleBookmark(treeContextMenu.person); }} 
              color={treeContextMenu.person.isBookmarked ? "text-blue-400" : "text-slate-300"}
            />
          </div>

          <div className="h-px bg-slate-700 mx-2"/>

          <div className="py-1">
            <TreeMenuItem icon={Trash2} label="Radera person" onClick={() => { setTreeContextMenu(null); handleDelete(treeContextMenu.person); }} color="text-red-400" />
          </div>
        </div>
      )}

      {/* Context Menu för Hjärta (Relationstyp) */}
      {heartContextMenu && (
        <div 
          className="fixed z-[6000] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-56 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50"
          style={{ left: heartContextMenu.x, top: heartContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-slate-700 bg-slate-800/50">
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Relationstyp</div>
            <div className="text-xs text-slate-400">Ändra relationstyp</div>
    </div>
          
          <div className="py-1">
            {['Gift', 'Sambo', 'Förlovad', 'Skild', 'Okänd'].map((type) => (
              <TreeMenuItem 
                key={type}
                icon={type === 'Skild' ? HeartCrack : type === 'Sambo' ? HeartHandshake : type === 'Okänd' ? HelpCircle : Heart}
                label={type}
                onClick={() => {
                  const { person1Id, person2Id } = heartContextMenu;
                  
                  // Hitta båda personerna
                  const person1 = allPeople.find(p => p.id === person1Id);
                  const person2 = allPeople.find(p => p.id === person2Id);
                  
                  if (person1 && person2) {
                    // Uppdatera person1's partner-typ
                    const updatedPerson1 = JSON.parse(JSON.stringify(person1));
                    if (!updatedPerson1.relations) updatedPerson1.relations = {};
                    if (!updatedPerson1.relations.partners) updatedPerson1.relations.partners = [];
                    
                    const partner1Index = updatedPerson1.relations.partners.findIndex(p => 
                      (typeof p === 'object' ? p.id : p) === person2Id
                    );
                    
                    // Hantera Skilsmässa-händelser
                    let events1 = [...(updatedPerson1.events || [])];
                    const prevType1 = partner1Index >= 0 && typeof updatedPerson1.relations.partners[partner1Index] === 'object' 
                      ? updatedPerson1.relations.partners[partner1Index].type 
                      : 'Gift';
                    
                    if (type === 'Skild' && prevType1 !== 'Skild') {
                      // Skapa skilsmässa-händelse om den inte redan finns
                      const alreadyExists = events1.some(ev => ev.type === 'Skilsmässa' && ev.partnerId === person2Id);
                      if (!alreadyExists) {
                        events1.push({
                          id: `evt_${Date.now()}`,
                          type: 'Skilsmässa',
                          date: '',
                          place: '',
                          partnerId: person2Id,
                          sources: [],
                          images: 0,
                          notes: ''
                        });
                      }
                    } else if (prevType1 === 'Skild' && type !== 'Skild') {
                      // Ta bort skilsmässa-händelse
                      events1 = events1.filter(ev => !(ev.type === 'Skilsmässa' && ev.partnerId === person2Id));
                    }
                    updatedPerson1.events = events1;
                    
                    if (partner1Index >= 0) {
                      updatedPerson1.relations.partners[partner1Index] = {
                        ...(typeof updatedPerson1.relations.partners[partner1Index] === 'object' ? updatedPerson1.relations.partners[partner1Index] : { id: person2Id }),
                        id: person2Id,
                        name: `${person2.firstName} ${person2.lastName}`,
                        type: type
                      };
                    } else {
                      updatedPerson1.relations.partners.push({
                        id: person2Id,
                        name: `${person2.firstName} ${person2.lastName}`,
                        type: type
                      });
                    }
                    
                    // Uppdatera person2's partner-typ
                    const updatedPerson2 = JSON.parse(JSON.stringify(person2));
                    if (!updatedPerson2.relations) updatedPerson2.relations = {};
                    if (!updatedPerson2.relations.partners) updatedPerson2.relations.partners = [];
                    
                    const partner2Index = updatedPerson2.relations.partners.findIndex(p => 
                      (typeof p === 'object' ? p.id : p) === person1Id
                    );
                    
                    // Hantera Skilsmässa-händelser
                    let events2 = [...(updatedPerson2.events || [])];
                    const prevType2 = partner2Index >= 0 && typeof updatedPerson2.relations.partners[partner2Index] === 'object' 
                      ? updatedPerson2.relations.partners[partner2Index].type 
                      : 'Gift';
                    
                    if (type === 'Skild' && prevType2 !== 'Skild') {
                      // Skapa skilsmässa-händelse om den inte redan finns
                      const alreadyExists = events2.some(ev => ev.type === 'Skilsmässa' && ev.partnerId === person1Id);
                      if (!alreadyExists) {
                        events2.push({
                          id: `evt_${Date.now() + 1}`,
                          type: 'Skilsmässa',
                          date: '',
                          place: '',
                          partnerId: person1Id,
                          sources: [],
                          images: 0,
                          notes: ''
                        });
                      }
                    } else if (prevType2 === 'Skild' && type !== 'Skild') {
                      // Ta bort skilsmässa-händelse
                      events2 = events2.filter(ev => !(ev.type === 'Skilsmässa' && ev.partnerId === person1Id));
                    }
                    updatedPerson2.events = events2;
                    
                    if (partner2Index >= 0) {
                      updatedPerson2.relations.partners[partner2Index] = {
                        ...(typeof updatedPerson2.relations.partners[partner2Index] === 'object' ? updatedPerson2.relations.partners[partner2Index] : { id: person1Id }),
                        id: person1Id,
                        name: `${person1.firstName} ${person1.lastName}`,
                        type: type
                      };
                    } else {
                      updatedPerson2.relations.partners.push({
                        id: person1Id,
                        name: `${person1.firstName} ${person1.lastName}`,
                        type: type
                      });
                    }
                    
                    // Uppdatera båda personerna i dbData
                    app.setDbData(prev => {
                      const updatedPeople = prev.people.map(p => {
                        if (p.id === person1Id) return updatedPerson1;
                        if (p.id === person2Id) return updatedPerson2;
                        return p;
                      });
                      return { ...prev, people: updatedPeople };
                    });
                  }
                  
                  setHeartContextMenu(null);
                }}
                color={heartContextMenu.currentType === type ? "text-blue-400" : "text-slate-300"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// MenuItem component för tree context menu
const TreeMenuItem = ({ icon: Icon, label, onClick, color = "text-slate-300", shortcut }) => (
  <button 
    className={`w-full text-left px-3 py-2 hover:bg-blue-600/20 hover:text-blue-100 flex items-center justify-between text-sm transition-colors group ${color}`} 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
  >
    <div className="flex items-center gap-3">
      <Icon size={16} className="opacity-70 group-hover:opacity-100"/> 
      <span>{label}</span>
    </div>
    {shortcut && <span className="text-xs opacity-30 font-mono">{shortcut}</span>}
  </button>
);
