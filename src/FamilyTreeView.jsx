import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit2, User, Heart, Network, HeartCrack, PlusCircle, Trash2, Users, 
  Copy, Plus, Minus, Home, Search, ArrowLeft, ArrowRight, AlertTriangle, 
  List, X, MapPin, Star, Baby, UserPlus, GitFork, Bookmark, Maximize2, Minimize2, Settings,
  Link as LinkIcon, Layers, HeartHandshake, HelpCircle, ChevronRight, ChevronLeft
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

const getPath = (source, target, type) => {
  const { x: sx, y: sy } = source;
  const { x: tx, y: ty } = target;
  if (type === 'child-fork') {
    const radius = 25;
    return `M ${sx} ${sy} L ${sx} ${ty - radius} Q ${sx} ${ty} ${sx + radius} ${ty} L ${tx} ${ty}`;
  }
  if (type === 'parent') return `M ${sx} ${sy} C ${sx} ${sy - 80}, ${tx} ${ty + 80}, ${tx} ${ty}`;
  return `M ${sx} ${sy} L ${tx} ${ty}`;
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
export default function FamilyTreeView({ allPeople = [], focusPersonId, onSetFocus, onOpenEditModal, onCreatePersonAndLink, onAddParentToChildAndSetPartners, onDeletePerson, getPersonRelations }) {
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
    const [searchHistory, setSearchHistory] = useState([]); // Sökhistorik
    const [showSearchHistory, setShowSearchHistory] = useState(false); // Visa sökhistorik
    const [showMinimap, setShowMinimap] = useState(true); // Visa/dölj minikarta

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
        
        // Kolla först efter partners-arrayen (från EditPersonModal)
        if (dbPerson.relations?.partners && Array.isArray(dbPerson.relations.partners)) {
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
        const children = allPeople.filter(child => {
            const childParents = (child.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
            return childParents.includes(focusPersonId);
        }).map(c => c.id);

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

        return { 
            focusPerson: focusPersonId, 
            parents, 
            grandparents, 
            siblings, 
            partners, 
            children, 
            grandchildren,
            ancestors: additionalAncestors || [],
            descendants: additionalDescendants || []
        };
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

  // --- LAYOUT & RENDER LOGIK ---
  const calculateLayout = () => {
        const nodes = [];
        const edges = [];
        const focusPerson = data.people[data.focusId];
        if (focusPerson) nodes.push({ ...focusPerson, x: 0, y: 0, isFocus: true });

        // Far-/morföräldrar
        const gpIds = data.relationships.grandparents || [];
        const grandparentY = -520;
        const gpGap = 260;
        const gpStartX = -((gpIds.length - 1) * gpGap) / 2;
        gpIds.forEach((gid, index) => {
            const gp = data.people[gid];
            if (!gp) return;
            const x = gpStartX + (index * gpGap);
            nodes.push({ ...gp, x, y: grandparentY });
            // Koppla till respektive barn (förälder)
            (data.relationships.parents || []).forEach(pid => {
                const parent = data.people[pid];
                if (parent) {
                    edges.push({ from: { x, y: grandparentY + (CARD_HEIGHT/2) - 20 }, to: { x: parent.x || 0, y: -260 + (CARD_HEIGHT/2) - 20 }, type: 'grandparent' });
                }
            });
        });

        // Föräldrar
        const pIds = data.relationships.parents || [];
        const parentY = -260;
        const pGap = 340;
        const pStartX = -((pIds.length - 1) * pGap) / 2;
        pIds.forEach((pid, index) => {
            const p = data.people[pid];
            if (!p) return;
            const x = pStartX + (index * pGap);
            nodes.push({ ...p, x, y: parentY });
            edges.push({ from: { x: 0, y: - (FOCUS_HEIGHT/2) + 20 }, to: { x, y: parentY + (CARD_HEIGHT/2) - 20 }, type: 'parent' });
            // Spara x för koppling från far-/morföräldrar
            p.x = x;
        });

        // Syskon
        const sIds = data.relationships.siblings || [];
        sIds.forEach((sid, i) => {
            const sib = data.people[sid];
            if (!sib) return;
            const x = -(FOCUS_WIDTH/2) - 100 - (CARD_WIDTH/2) - (i * SIBLING_GAP);
            nodes.push({ ...sib, x: x, y: 0 });
            edges.push({ from: { x: -(FOCUS_WIDTH/2) + 10, y: 0 }, to: { x: x + (CARD_WIDTH/2) - 10, y: 0 }, type: 'sibling' });
        });

        // Partners (ingifta)
        let cursorY = (FOCUS_HEIGHT/2) + 60;
        let previousConnectionY = (FOCUS_HEIGHT/2) - 10;
        (data.relationships.partners || []).forEach((rel, idx) => {
            const partner = data.people[rel.id];
            // Ghost-parent om saknad partner men ensamstående barn finns
            const isGhost = !partner && rel.id === null;
            
            // Öka avståndet mellan partners till det dubbla (förutom första partnern)
            if (idx > 0) {
                cursorY = previousConnectionY + CARD_HEIGHT * 3; // Tredubbla avståndet för att göra linjerna längre
            }
            
            const nodeY = cursorY + (CARD_HEIGHT/2);

            if (partner || isGhost) {
                const baseNode = partner || { id: `ghost_parent_${idx}`, firstName: 'Lägg till förälder', lastName: '', isGhostParent: true };
                nodes.push({ ...baseNode, x: 0, y: nodeY, isPartner: !isGhost, isGhostParent: isGhost });
                edges.push({
                    from: { x: 0, y: previousConnectionY },
                    to: { x: 0, y: nodeY - (CARD_HEIGHT/2) + 10 },
                    type: 'straight-down',
                    midPoint: { x: 0, y: (previousConnectionY + nodeY - (CARD_HEIGHT/2)) / 2 },
                    styleType: rel.type,
                    person1Id: focusPersonId, // Huvudpersonen
                    person2Id: rel.id // Partnern
                });
                previousConnectionY = nodeY + (CARD_HEIGHT/2) - 10;
            } else {
                // Ingen partner att visa och ingen ghost: hoppa över
                return;
            }
            // Barn till partner
            const children = rel.children || [];
            if (children.length > 0) {
                const stemX = 0;
                const stemStartY = previousConnectionY;
                cursorY = previousConnectionY + 70;
                children.forEach((cid) => {
                    const child = data.people[cid];
                    if (!child) return;
                    const childX = INDENT_X + (CARD_WIDTH/2);
                    const childY = cursorY + (CARD_HEIGHT/2);
                    nodes.push({ ...child, x: childX, y: childY });
                    edges.push({ from: { x: stemX, y: stemStartY }, to: { x: childX - (CARD_WIDTH/2) + 10, y: childY }, type: 'child-fork' });
                    cursorY += GAP_Y;
                });
                const nextPartnerConnectionY = cursorY - GAP_Y + (CARD_HEIGHT/2) + 50;
                edges.push({ from: { x: 0, y: previousConnectionY }, to: { x: 0, y: nextPartnerConnectionY }, type: 'straight-down' });
                previousConnectionY = nextPartnerConnectionY;
                // Öka avståndet mellan partners till det dubbla (lägg till CARD_HEIGHT * 3 extra)
                if (idx < (data.relationships.partners || []).length - 1) {
                    cursorY = previousConnectionY + CARD_HEIGHT * 3; // Tredubbla avståndet
                } else {
                cursorY += 50;
                }
            } else {
                // Om inga barn: öka avståndet mellan partners till det dubbla
                if (idx < (data.relationships.partners || []).length - 1) {
                    cursorY = previousConnectionY + CARD_HEIGHT * 3; // Tredubbla avståndet
                    previousConnectionY = cursorY - 70;
            } else {
                cursorY += CARD_HEIGHT + 60;
                previousConnectionY = cursorY - 70;
                }
            }
        });

        // Barnbarn
        const gcIds = data.relationships.grandchildren || [];
        const grandchildY = cursorY + 180;
        const gcGap = 220;
        const gcStartX = -((gcIds.length - 1) * gcGap) / 2;
        gcIds.forEach((gid, index) => {
            const gc = data.people[gid];
            if (!gc) return;
            const x = gcStartX + (index * gcGap);
            nodes.push({ ...gc, x, y: grandchildY });
            // Koppla till respektive förälder (barn)
            (data.relationships.children || []).forEach(cid => {
                const child = data.people[cid];
                if (child) {
                    edges.push({ from: { x, y: grandchildY - (CARD_HEIGHT/2) + 20 }, to: { x: child.x || 0, y: (child.y || 0) + (CARD_HEIGHT/2) - 20 }, type: 'grandchild' });
                }
            });
        });
        return { nodes, edges };
    };

  const { nodes, edges } = calculateLayout();
  
  // Animerad övergång när huvudperson ändras
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevFocusPersonId = useRef(focusPersonId);
  
  useEffect(() => {
    if (prevFocusPersonId.current !== focusPersonId) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 500);
      prevFocusPersonId.current = focusPersonId;
      return () => clearTimeout(timer);
    }
  }, [focusPersonId]);

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
                    type="text" 
                    placeholder="Snabb sök..." 
                    className="bg-transparent border-none outline-none text-slate-200 text-sm w-full placeholder-slate-500"
                    onFocus={() => setShowSearchHistory(true)}
                    onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
                    onChange={(e) => {
                         const q = e.target.value.toLowerCase();
                         setSearchResults(q.length > 1 ? displayPeople.filter(p => (p.firstName+' '+p.lastName).toLowerCase().includes(q)) : []);
                         if (q.length > 0) {
                             setShowSearchHistory(false);
                         } else {
                             setShowSearchHistory(true);
                         }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                            const query = e.target.value.trim();
                            // Lägg till i sökhistorik om den inte redan finns
                            setSearchHistory(prev => {
                                const filtered = prev.filter(h => h !== query);
                                return [query, ...filtered].slice(0, 10); // Max 10 sökningar
                            });
                            // Sök efter person
                            const found = displayPeople.find(p => 
                                (p.firstName+' '+p.lastName).toLowerCase().includes(query.toLowerCase())
                            );
                            if (found && onSetFocus) {
                                navigateToPerson(found.id);
                                e.target.value = '';
                                setSearchResults([]);
                                setShowSearchHistory(false);
                            }
                        }
                    }}
                  />
              </div>
              {/* Sökhistorik dropdown */}
              {showSearchHistory && searchResults.length === 0 && searchHistory.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-600 rounded shadow-xl z-50 max-h-60 overflow-y-auto">
                      <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-700">Tidigare sökningar</div>
                      {searchHistory.map((query, idx) => (
                          <div 
                              key={idx} 
                              className="px-3 py-2 hover:bg-slate-700 cursor-pointer text-slate-200 text-sm flex items-center justify-between group" 
                              onClick={() => {
                                  const found = displayPeople.find(p => 
                                      (p.firstName+' '+p.lastName).toLowerCase().includes(query.toLowerCase())
                                  );
                                  if (found && onSetFocus) {
                                      navigateToPerson(found.id);
                                      setShowSearchHistory(false);
                                  }
                              }}
                          >
                              <span className="flex items-center gap-2">
                                  <Search size={12} className="text-slate-500" />
                                  {query}
                              </span>
                              <button
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      setSearchHistory(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                              >
                                  <X size={14} />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
              {/* Resultat dropdown */}
              {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-slate-800 border border-slate-600 rounded shadow-xl z-50">
                      {searchResults.map(p => (
                          <div 
                              key={p.id} 
                              className="px-3 py-2 hover:bg-slate-700 cursor-pointer text-slate-200 text-sm" 
                              onClick={() => { 
                                  navigateToPerson(p.id); 
                                  setSearchResults([]); 
                                  setShowSearchHistory(false);
                                  // Lägg till i sökhistorik
                                  const query = `${p.firstName} ${p.lastName}`.trim();
                                  setSearchHistory(prev => {
                                      const filtered = prev.filter(h => h !== query);
                                      return [query, ...filtered].slice(0, 10);
                                  });
                              }}
                          >
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

      {/* --- MINIKARTA --- */}
      {nodes.length > 0 && (
        <div className="fixed bottom-16 right-4 z-[70]">
          {/* Toggle-knapp, alltid på samma ställe (nere till höger) */}
          <button
            onClick={() => setShowMinimap(!showMinimap)}
            className="absolute bottom-2 right-2 z-[80] bg-slate-800/95 border border-slate-600 rounded-lg shadow-xl p-2 hover:bg-slate-700 transition-colors"
            title={showMinimap ? 'Fäll in översikt' : 'Fäll ut översikt'}
          >
            {showMinimap ? (
              <ChevronRight size={18} className="text-slate-300 rotate-180" />
            ) : (
              <ChevronRight size={18} className="text-slate-300" />
            )}
          </button>

          {/* Panel för kartan */}
          <div
            className={`relative bg-slate-800/95 border border-slate-600 rounded-lg shadow-xl p-3 w-72 transition-all duration-300 ease-in-out ${
              showMinimap ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16 pointer-events-none'
            }`}
            style={{ paddingBottom: '3rem' }} /* lämna plats för knappen */
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-slate-400 font-bold">Översikt</div>
            </div>
            <div className="relative w-full h-40 bg-slate-900 rounded border border-slate-700 overflow-hidden">
              {/* Miniaturvy av trädet */}
              {(() => {
                const nodeXs = nodes.map(n => n.x || 0);
                const nodeYs = nodes.map(n => n.y || 0);
                const minX = Math.min(...nodeXs);
                const maxX = Math.max(...nodeXs);
                const minY = Math.min(...nodeYs);
                const maxY = Math.max(...nodeYs);
                const widthRaw = Math.max(maxX - minX, 1);
                const heightRaw = Math.max(maxY - minY, 1);
                const width = Math.max(widthRaw, 800);
                const height = Math.max(heightRaw, 800);
                const padding = Math.max(width, height) * 0.15;
                const viewBox = `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`;

                return (
                  <svg
                    viewBox={viewBox}
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Miniatur-linjer */}
                    {edges.slice(0, 200).map((edge, i) => {
                      const strokeW = Math.min(Math.max(Math.max(width, height) / 1200, 0.5), 2);
                      return (
                        <line
                          key={i}
                          x1={edge.from.x}
                          y1={edge.from.y}
                          x2={edge.to.x}
                          y2={edge.to.y}
                          stroke="#475569"
                          strokeWidth={strokeW}
                          opacity={0.3}
                        />
                      );
                    })}
                    {/* Miniatur-noder */}
                    {nodes.map((node, i) => {
                      const isFocus = node.id === focusPersonId;
                      const radius = Math.min(Math.max(Math.max(width, height) / 200, 2), 8);
                      return (
                        <circle
                          key={i}
                          cx={node.x || 0}
                          cy={node.y || 0}
                          r={isFocus ? radius * 2 : radius}
                          fill={isFocus ? '#3b82f6' : '#64748b'}
                          stroke={isFocus ? '#60a5fa' : '#475569'}
                          strokeWidth={isFocus ? radius * 0.4 : radius * 0.25}
                          className="cursor-pointer"
                          onClick={() => node.id && onSetFocus && onSetFocus(node.id)}
                        />
                      );
                    })}
                    {/* Viewport-indikator */}
                    {containerRef.current && (() => {
                      const rect = containerRef.current.getBoundingClientRect();
                      const viewportWidth = rect.width / transform.scale;
                      const viewportHeight = rect.height / transform.scale;
                      const viewportX = (transform.x - rect.width / 2) / transform.scale;
                      const viewportY = (transform.y - rect.height / 2) / transform.scale;
                      const strokeW = Math.min(Math.max(Math.max(width, height) / 900, 0.5), 2.5);
                      return (
                        <rect
                          x={viewportX}
                          y={viewportY}
                          width={viewportWidth}
                          height={viewportHeight}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={strokeW}
                          strokeDasharray="4,4"
                          opacity={0.6}
                        />
                      );
                    })()}
                  </svg>
                );
              })()}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Zoom: {(transform.scale * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      )}

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
                {edges.map((edge, i) => (
                    <g key={i}>
                        <path d={getPath(edge.from, edge.to, edge.type)} stroke="#475569" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={(edge.styleType === 'divorced' || edge.styleType === 'Skild') ? '6,6' : '0'} />
                        {edge.midPoint && edge.type === 'straight-down' && (() => {
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
                ))}
            </svg>

            {/* Kort (Nodes) */}
            {nodes.map(node => {
                const warnings = validatePerson(node);
                const isGhost = !!node.isGhostParent;
                const width = node.isFocus ? FOCUS_WIDTH : CARD_WIDTH;
                const height = node.isFocus ? FOCUS_HEIGHT : CARD_HEIGHT;
                
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
