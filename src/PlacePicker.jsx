import React, { useState, useMemo, useRef, useEffect } from 'react';
import { parsePlaceString } from './parsePlaceString.js';
import PlaceCatalog from './PlaceCatalogNew.jsx';
import { Globe, Search, X, History } from 'lucide-react';

// Helper för att bygga en läsbar sträng från ett platsobjekt
export function buildPlaceString(place) {
    if (!place) return '';
    // Om platsen saknar normaliserade fält, parsa PLAC-strängen (t.ex. "name" eller "plac")
    let norm = place;
    if (!place.country && (place.name || place.plac)) {
        norm = { ...place, ...parsePlaceString(place.name || place.plac) };
    }
    // Stöd både engelska och svenska nycklar
    const candidates = [
        // Engelska
        norm.specific, norm.village, norm.parish, norm.municipality, norm.region, norm.country,
        // Svenska (från parsePlaceString)
        norm.gard, norm.by, norm.socken, norm.lan, norm.land,
        // Generella
        norm.name, norm.plac
    ].filter(Boolean);
    return candidates.join(', ');
}

export default function PlacePicker({ value, displayValue, allPlaces, onChange }) {
        // Spara senaste platser globalt (window) för enkel demo, kan bytas till context eller localStorage
        const [recentPlaces, setRecentPlaces] = useState(() => window._recentPlaces || []);

        useEffect(() => {
            window._recentPlaces = recentPlaces;
        }, [recentPlaces]);

        // Lägg till vald plats i senaste-listan
        const addRecentPlace = (place) => {
            if (!place || !place.id) return;
            setRecentPlaces(prev => {
                const filtered = prev.filter(p => p.id !== place.id);
                return [place, ...filtered].slice(0, 5);
            });
        };
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [serverResults, setServerResults] = useState([]);
    const wrapperRef = useRef(null);

    const selectedPlace = useMemo(() => allPlaces.find(p => p.id === value), [value, allPlaces]);

    const stripAccents = (s) => {
        if (!s) return '';
        return String(s).normalize('NFD').replace(/\p{Diacritic}+/gu, '').toLowerCase();
    };

    const filteredPlaces = useMemo(() => {
        if (!Array.isArray(allPlaces)) return [];
        if (!searchTerm) return allPlaces;
        const lowerTerm = stripAccents(searchTerm);
        const localMatches = allPlaces.filter(p => {
            if (!p) return false;
            const norm = (!p.country && (p.name || p.plac))
                ? { ...p, ...parsePlaceString(p.name || p.plac) }
                : p;
            // Only search known string fields to avoid [object Object]
            const fields = [
                // Generella
                norm.name, norm.plac,
                // Engelska
                norm.country, norm.region, norm.municipality, norm.parish, norm.village, norm.specific,
                // Svenska
                norm.land, norm.lan, norm.socken, norm.by, norm.gard,
                // Officiell databas-nycklar
                norm.ortnamn, norm.sockenstadnamn, norm.kommunnamn, norm.lansnamn
            ].filter(Boolean).map(v => stripAccents(v));
            if (fields.some(f => f.includes(lowerTerm))) return true;
            // Fallback: built string
            const built = stripAccents(buildPlaceString(norm));
            return built.includes(lowerTerm);
        });
        // Prioritize server results if present
        if (Array.isArray(serverResults) && serverResults.length > 0) {
            // Deduplicate by namn + koordinater + typ
            const seen = new Set();
            const deduped = [];
            for (const p of serverResults) {
                const lat = p.raw?.latitude ?? p.raw?.metadata?.latitude ?? '';
                const lon = p.raw?.longitude ?? p.raw?.metadata?.longitude ?? '';
                const type = p.raw?.detaljtyp || p.raw?.type || p.type || '';
                const key = `${(p.name||'').trim().toLowerCase()}|${lat}|${lon}|${type}`;
                if (seen.has(key)) continue;
                seen.add(key);
                // Sätt typ på platsen för visning
                p._dedupType = type;
                deduped.push(p);
            }
            return deduped;
        }
        return localMatches;
    }, [searchTerm, allPlaces, serverResults]);
    const renderItem = (place) => {
        // Use raw official fields when available, else fall back to parsed/local
        const raw = place.raw || place;
        const name = raw.ortnamn || raw.sockenstadnamn || raw.kommunnamn || raw.lansnamn || place.name || place.plac || '';
        const type = (place._dedupType || raw.detaljtyp || raw.type || '').toLowerCase();
        const metaParts = [];
        if (raw.sockenstadnamn) metaParts.push(raw.sockenstadnamn);
        if (raw.kommunnamn) metaParts.push(raw.kommunnamn);
        if (raw.lansnamn) metaParts.push(raw.lansnamn);
        // Fallback: try parsed hierarchy
        if (metaParts.length === 0) {
            const parsed = (!place.country && (place.name || place.plac)) ? parsePlaceString(place.name || place.plac) : {};
            const alt = [parsed.parish, parsed.municipality, parsed.region, parsed.country].filter(Boolean);
            metaParts.push(...alt);
        }
        const meta = metaParts.filter(Boolean).join(' • ');
        const typeLabel = type === 'parish' ? 'Församling'
            : type === 'municipality' ? 'Kommun'
            : type === 'county' ? 'Län'
            : type === 'village' ? 'Ort'
            : type === 'building' ? 'Byggnad'
            : type === 'cemetary' ? 'Kyrkogård'
            : type === 'specific' ? 'Adress'
            : type === 'country' ? 'Land'
            : '';
        return (
            <div className="w-full">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300 font-medium">{name}</span>
                    {typeLabel && (
                        <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600">{typeLabel}</span>
                    )}
                </div>
                {meta && (
                    <div className="text-[12px] text-slate-400 mt-0.5">{meta}</div>
                )}
            </div>
        );
    };

    // Fetch official places from backend for autocomplete
    useEffect(() => {
        let abort = false;
        const run = async () => {
            try {
                const q = searchTerm.trim();
                if (!q || q.length < 2) { setServerResults([]); return; }
                const url = `http://localhost:5005/official_places/search?q=${encodeURIComponent(q)}`;
                const res = await fetch(url);
                if (!res.ok) { setServerResults([]); return; }
                const data = await res.json();
                if (abort) return;
                // Map to a uniform shape expected by builder and selection
                const mapped = (Array.isArray(data) ? data : []).map(p => ({
                    id: p.id,
                    name: p.ortnamn || p.sockenstadnamn || p.kommunnamn || p.lansnamn || p.name,
                    ortnamn: p.ortnamn,
                    sockenstadnamn: p.sockenstadnamn,
                    kommunnamn: p.kommunnamn,
                    lansnamn: p.lansnamn,
                    // Keep raw for potential future use
                    raw: p
                }));
                setServerResults(mapped);
            } catch (err) {
                setServerResults([]);
            }
        };
        run();
        return () => { abort = true; };
    }, [searchTerm]);

    const handleSelect = (placeId, placeObject) => {
        if (placeId) {
            onChange(placeId, placeObject);
            addRecentPlace(placeObject);
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    // Stäng listan om man klickar utanför
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="relative w-full max-w-md" ref={wrapperRef}>
            {/* Input + Globe */}
            <div className="relative flex items-center">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-l-md pl-9 pr-8 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="Sök plats..."
                        value={searchTerm || displayValue || buildPlaceString(selectedPlace)}
                        onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                        onFocus={() => setIsOpen(true)}
                    />
                    {searchTerm && (
                        <button onClick={() => { setSearchTerm(''); setIsOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    className="bg-slate-700 hover:bg-slate-600 border-y border-r border-slate-700 text-slate-200 p-2 rounded-r-md"
                    title="Öppna platsregister"
                    onClick={() => setIsModalOpen(true)}
                >
                    <Globe size={20} />
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-64 overflow-y-auto">
                    {/* Visa senaste platser om sökrutan är tom */}
                    {!searchTerm && recentPlaces.length > 0 && (
                        <div className="border-b border-slate-700">
                            <div className="px-4 py-2 text-xs text-slate-400">Senaste platser</div>
                            <ul>
                                {recentPlaces.map(place => (
                                    <li
                                        key={place.id}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={e => {
                                            e.stopPropagation();
                                            handleSelect(place.id, place);
                                        }}
                                        className="px-4 py-2 hover:bg-slate-700 cursor-pointer flex items-start gap-2 border-b border-slate-700 last:border-0"
                                    >
                                        <span className="text-sm text-slate-300 font-medium">
                                            {place.name || place.ortnamn || place.sockenstadnamn || place.kommunnamn || place.lansnamn}
                                            {place.lanskod ? ` (${place.lanskod})` : ''}
                                            {place.sockenstadnamn ? ', Församling' : place.kommunnamn ? ', Kommun' : place.lansnamn ? ', Län' : place.ortnamn ? ', Ort' : ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Visa vanliga sökresultat om man skriver */}
                    {filteredPlaces.length > 0 ? (
                        <ul>
                            {filteredPlaces.map(place => (
                                <li 
                                    key={place.id} 
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent input blur
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(place.id, place);
                                    }}
                                    className="px-4 py-2 hover:bg-slate-700 cursor-pointer flex items-start gap-2 border-b border-slate-700 last:border-0"
                                >
                                    {renderItem(place)}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-slate-400 text-sm italic">
                            {searchTerm && searchTerm.length >= 2
                                ? (serverResults.length === 0
                                    ? 'Inga platser hittades (kontrollera anslutning till officiellt register)'
                                    : 'Söker...')
                                : 'Skriv minst 2 tecken för att söka'}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Place Catalog Picker */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-2 border-b">
                            <h3 className="font-semibold">Platsregister</h3>
                            <button className="text-xl text-slate-400 hover:text-white" onClick={() => setIsModalOpen(false)}>×</button>
                        </div>
                        <div className="h-[calc(100%-40px)]">
                            <PlaceCatalog onPick={(node) => {
                                const placeId = node.metadata?.id || node.id;
                                console.log('PlacePicker modal: Selected node:', node, 'ID:', placeId);
                                if (placeId) {
                                    onChange(placeId);
                                    setIsModalOpen(false);
                                } else {
                                    console.warn('PlacePicker modal: No valid ID found on node');
                                }
                            }} onClose={() => setIsModalOpen(false)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}