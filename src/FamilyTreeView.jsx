import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit2, User, Heart, Network, HeartCrack, PlusCircle, Trash2, Users, 
  Copy, Plus, Minus, Home, Search, ArrowLeft, ArrowRight, AlertTriangle, 
  List, X, MapPin, Star, Baby, UserPlus, GitFork, Bookmark, Maximize2, Minimize2, Settings,
  Link as LinkIcon, Layers
} from 'lucide-react';
import WindowFrame from './WindowFrame.jsx';
import Button from './Button.jsx';
import SelectFatherModal from './SelectFatherModal.jsx';
import MediaImage from './components/MediaImage.jsx';

// --- KONSTANTER ---
const CARD_WIDTH = 400;
const FOCUS_WIDTH = 440; 
const CARD_HEIGHT = 170;
const FOCUS_HEIGHT = 200;
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
export default function FamilyTreeView({ allPeople = [], focusPersonId, onSetFocus, onOpenEditModal, onCreatePersonAndLink, onDeletePerson, getPersonRelations }) {
    // Konvertera data till visningsformat
    const displayPeople = allPeople.map(convertPersonForDisplay).filter(Boolean);
    const peopleById = {};
    displayPeople.forEach(p => { peopleById[p.id] = p; });

    // Skapa mock data-struktur baserad på fokusperson
    const focusPerson = displayPeople.find(p => p.id === focusPersonId);

    // Bygg relationships för 3 generationer upp/ner
    const buildRelationships = () => {
        if (!focusPerson) return { focusPerson: null, parents: [], grandparents: [], siblings: [], partners: [], children: [], grandchildren: [] };
        const dbPerson = allPeople.find(p => p.id === focusPersonId);
        if (!dbPerson) return { focusPerson: null, parents: [], grandparents: [], siblings: [], partners: [], children: [], grandchildren: [] };

        // Föräldrar
        const parents = (dbPerson.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);

        // Far-/morföräldrar
        let grandparents = [];
        parents.forEach(pid => {
            const parent = allPeople.find(p => p.id === pid);
            if (parent && parent.relations?.parents) {
                const gps = (parent.relations.parents || []).map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
                grandparents = grandparents.concat(gps);
            }
        });
        grandparents = [...new Set(grandparents)];

        // Syskon (andra barn till samma föräldrar)
        const siblings = [];
        allPeople.forEach(person => {
            if (person.id === focusPersonId) return;
            const personParents = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
            if (personParents.length && parents.some(pp => personParents.includes(pp))) {
                siblings.push(person.id);
            }
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
                        partners.push({
                            id: partnerId,
                            children: children,
                            type: (typeof partnerRef === 'object' && partnerRef.type) ? partnerRef.type : 'married',
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

        return { focusPerson: focusPersonId, parents, grandparents, siblings, partners, children, grandchildren };
    };

    const data = {
        focusId: focusPersonId,
        people: peopleById,
        relationships: buildRelationships()
    };

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.8 });
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  
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
      // Spara tiden innan vi skapar barnet för att hitta det senare
      const beforeTime = Date.now();
      
      // Skapa barnet med modern som target - detta skapar barnet och länkar det till modern
      onCreatePersonAndLink(mother.id, 'child');
      
      // Vänta lite för att barnet ska skapas, sedan hitta det och öppna EditPersonModal
      setTimeout(() => {
        // Hitta det nyaste barnet (högsta ID/timestamp) som skapades efter beforeTime
        const allPeopleSorted = [...allPeople].sort((a, b) => {
          const aTime = parseInt(a.id.split('_')[1] || '0');
          const bTime = parseInt(b.id.split('_')[1] || '0');
          return bTime - aTime;
        });
        const newestChild = allPeopleSorted.find(p => {
          const pTime = parseInt(p.id.split('_')[1] || '0');
          return pTime >= beforeTime && 
                 p._isPlaceholder && 
                 p._placeholderRelation === 'child' &&
                 p._placeholderTargetId === mother.id;
        });
        
        if (newestChild && onOpenEditModal) {
          // Lägg till fadern som förälder till barnet
          // Detta görs automatiskt av syncRelations när man sparar i EditPersonModal
          // Men vi kan också lägga till fadern direkt i barnets relations.parents
          if (newestChild.relations && !newestChild.relations.parents) {
            newestChild.relations.parents = [];
          }
          if (newestChild.relations && !newestChild.relations.parents.some(p => p.id === fatherId)) {
            const father = allPeople.find(p => p.id === fatherId);
            if (father) {
              newestChild.relations.parents.push({ 
                id: fatherId, 
                name: `${father.firstName} ${father.lastName}` 
              });
            }
          }
          
          // Öppna EditPersonModal för det nya barnet
          onOpenEditModal(newestChild.id);
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
            const nodeY = cursorY + (CARD_HEIGHT/2);

            if (partner || isGhost) {
                const baseNode = partner || { id: `ghost_parent_${idx}`, firstName: 'Lägg till förälder', lastName: '', isGhostParent: true };
                nodes.push({ ...baseNode, x: 0, y: nodeY, isPartner: !isGhost, isGhostParent: isGhost });
                edges.push({
                    from: { x: 0, y: previousConnectionY },
                    to: { x: 0, y: nodeY - (CARD_HEIGHT/2) + 10 },
                    type: 'straight-down',
                    midPoint: { x: 0, y: (previousConnectionY + nodeY - (CARD_HEIGHT/2)) / 2 },
                    styleType: rel.type
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
                cursorY += 50;
            } else {
                cursorY += CARD_HEIGHT + 60;
                previousConnectionY = cursorY - 70;
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
                {edges.map((edge, i) => (
                    <g key={i}>
                        <path d={getPath(edge.from, edge.to, edge.type)} stroke="#475569" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={edge.styleType === 'divorced' ? '6,6' : '0'} />
                        {edge.midPoint && edge.type === 'straight-down' && (
                            <foreignObject x={edge.midPoint.x - 12} y={edge.midPoint.y - 12} width="24" height="24">
                                <div className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-600 z-10 shadow-lg">
                                     {edge.styleType === 'divorced' ? <HeartCrack size={12} className="text-red-400 opacity-75"/> : <Heart size={12} className="text-rose-500"/>}
                                </div>
                            </foreignObject>
                        )}
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
                            {!isGhost && node.deathDate && <span className="text-sm opacity-90">✝</span>}
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
                            <div className="flex flex-col items-start gap-0.5 relative">
                                <div 
                                    className={`w-20 h-20 rounded overflow-hidden flex-shrink-0 shadow-inner cursor-pointer hover:opacity-80 transition-opacity ${
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
                                        <MediaImage 
                                            url={node.media[0].url} 
                                            alt={`${node.firstName} ${node.lastName}`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <User className={`w-full h-full p-2 ${
                                            node.gender === 'M' 
                                                ? 'text-blue-600' 
                                                : node.gender === 'K' 
                                                    ? 'text-rose-600' 
                                                    : 'text-gray-500'
                                        }`} />
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
                                        </div>
                                        {/* Yrke/titel */}
                                        {node.title && (
                                            <div className="flex flex-col mt-1">
                                                <span className="opacity-70 flex items-center gap-1 font-semibold text-xs uppercase tracking-wide">Yrke</span>
                                                <span className="font-medium truncate text-sm">{node.title}</span>
                                            </div>
                                        )}
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
