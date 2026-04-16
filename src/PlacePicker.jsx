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
    // Endast användarplatser får sparas till dbData.places
    const [recentPlaces, setRecentPlaces] = useState(() => window._recentPlaces || []);

    useEffect(() => {
        window._recentPlaces = recentPlaces;
    }, [recentPlaces]);

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
    const [referenceResults, setReferenceResults] = useState([]);
    const wrapperRef = useRef(null);

    const selectedPlace = useMemo(() => allPlaces.find(p => p.id === value), [value, allPlaces]);

    const stripAccents = (s) => {
        if (!s) return '';
        return String(s).normalize('NFD').replace(/\p{Diacritic}+/gu, '').toLowerCase();
    };

    // Endast användarplatser (dbData.places) får sparas
    const userPlaces = useMemo(() => Array.isArray(allPlaces) ? allPlaces.filter(p => p && (p.source === 'user' || !p.source)) : [], [allPlaces]);

    const filteredPlaces = useMemo(() => {
        if (!searchTerm) return userPlaces;
        const lowerTerm = stripAccents(searchTerm);
        const localMatches = userPlaces.filter(p => {
            if (!p) return false;
            const norm = (!p.country && (p.name || p.plac))
                ? { ...p, ...parsePlaceString(p.name || p.plac) }
                : p;
            const fields = [
                norm.name, norm.plac,
                norm.country, norm.region, norm.municipality, norm.parish, norm.village, norm.specific,
                norm.land, norm.lan, norm.socken, norm.by, norm.gard,
                norm.ortnamn, norm.sockenstadnamn, norm.kommunnamn, norm.lansnamn
            ].filter(Boolean).map(v => stripAccents(v));
            if (fields.some(f => f.includes(lowerTerm))) return true;
            const built = stripAccents(buildPlaceString(norm));
            return built.includes(lowerTerm);
        });
        // Kombinera användarplatser och referensplatser
        const refIds = new Set(localMatches.map(r => r.id));
        return [
            ...localMatches,
            ...referenceResults.filter(r => !refIds.has(r.id))
        ];
    }, [userPlaces, searchTerm, referenceResults]);

    // Sök referensplatser (readonly)
    useEffect(() => {
        let abort = false;
        let timeoutId = null;
        const run = async () => {
            try {
                const q = searchTerm.trim();
                if (!q || q.length < 2) { setReferenceResults([]); return; }
                timeoutId = setTimeout(async () => {
                    if (!window.electronAPI || typeof window.electronAPI.searchReferencePlaces !== 'function') {
                        setReferenceResults([]);
                        return;
                    }
                    const response = await window.electronAPI.searchReferencePlaces(q, 30);
                    if (abort) return;
                    if (!response || !response.success) {
                        setReferenceResults([]);
                        return;
                    }
                    setReferenceResults(Array.isArray(response.results) ? response.results : []);
                }, 120);
            } catch (err) {
                setReferenceResults([]);
            }
        };
        run();
        return () => {
            abort = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [searchTerm]);

    // När användaren väljer "lägg till plats" - spara alltid till dbData.places och märk som user
    // DUBBEL: handleSelect tas bort här, se nedan för korrekt version
    const renderItem = (place) => {
        if (place?.type === 'reference-sweden' || place?.type === 'reference-usa') {
            const placeData = place.place || {};
            const typeLabel = place.type === 'reference-sweden' ? 'Referens (SE)' : 'Referens (US)';
            const details = [placeData.parish || placeData.village, placeData.municipality, placeData.region, placeData.country]
                .filter(Boolean)
                .join(' • ');
            return (
                <div className="w-full">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-slate-300 font-medium">{place.label || place.value}</span>
                        <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/30">{typeLabel}</span>
                    </div>
                    {details && <div className="text-[12px] text-muted mt-0.5">{details}</div>}
                </div>
            );
        }

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
                        <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-secondary border border-subtle">{typeLabel}</span>
                    )}
                </div>
                {meta && (
                    <div className="text-[12px] text-muted mt-0.5">{meta}</div>
                )}
            </div>
        );
    };

    // Offline-first: search in Electron-loaded reference library (docs/*.json/csv)
    useEffect(() => {
        let abort = false;
        let timeoutId = null;
        const run = async () => {
            try {
                const q = searchTerm.trim();
                if (!q || q.length < 2) { setReferenceResults([]); return; }
                timeoutId = setTimeout(async () => {
                    if (!window.electronAPI || typeof window.electronAPI.searchReferencePlaces !== 'function') {
                        setReferenceResults([]);
                        return;
                    }
                    const response = await window.electronAPI.searchReferencePlaces(q, 30);
                    if (abort) return;
                    if (!response || !response.success) {
                        setReferenceResults([]);
                        return;
                    }
                    setReferenceResults(Array.isArray(response.results) ? response.results : []);
                }, 120);
            } catch (err) {
                setReferenceResults([]);
            }
        };
        run();
        return () => {
            abort = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [searchTerm]);

    const handleSelect = (placeId, placeObject) => {
        if (!placeObject) return;

        if (placeObject.type === 'reference-sweden' || placeObject.type === 'reference-usa') {
            const placeData = {
                ...(placeObject.place || {}),
                id: null,
                name: placeObject.value || placeObject.label || '',
                displayLabel: placeObject.label || ''
            };
            onChange(null, placeData);
            setIsOpen(false);
            setSearchTerm('');
            return;
        }

        if (!placeId) return;
        onChange(placeId, placeObject);
        addRecentPlace(placeObject);
        setIsOpen(false);
        setSearchTerm('');
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
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <input
                        type="text"
                        className="w-full bg-background border border-subtle text-primary text-sm rounded-l-md pl-9 pr-8 py-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        placeholder="Sök plats..."
                        value={searchTerm || displayValue || buildPlaceString(selectedPlace)}
                        onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                        onFocus={() => setIsOpen(true)}
                    />
                    {searchTerm && (
                        <button onClick={() => { setSearchTerm(''); setIsOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    className="bg-surface-2 hover:bg-surface border-y border-r border-subtle text-primary p-2 rounded-r-md"
                    title="Öppna platsregister"
                    onClick={() => setIsModalOpen(true)}
                >
                    <Globe size={20} />
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-subtle rounded-md shadow-xl max-h-64 overflow-y-auto">
                    {/* Visa senaste platser om sökrutan är tom */}
                    {!searchTerm && recentPlaces.length > 0 && (
                        <div className="border-b border-subtle">
                            <div className="px-4 py-2 text-xs text-muted">Senaste platser</div>
                            <ul>
                                {recentPlaces.map(place => (
                                    <li
                                        key={place.id}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={e => {
                                            e.stopPropagation();
                                            handleSelect(place.id, place);
                                        }}
                                        className="px-4 py-2 hover:bg-surface cursor-pointer flex items-start gap-2 border-b border-subtle last:border-0"
                                    >
                                        <span className="text-sm text-primary font-medium">
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
                                        handleSelect(place.id || null, place);
                                    }}
                                    className="px-4 py-2 hover:bg-surface cursor-pointer flex items-start gap-2 border-b border-subtle last:border-0"
                                >
                                    {renderItem(place)}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-muted text-sm italic">
                            {searchTerm && searchTerm.length >= 2
                                ? (referenceResults.length === 0
                                    ? 'Inga referensplatser hittades'
                                    : 'Söker...')
                                : 'Skriv minst 2 tecken för att söka'}
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Place Catalog Picker */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-background border border-subtle rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-2 border-b">
                            <h3 className="font-semibold">Platsregister</h3>
                            <button className="text-xl text-muted hover:text-primary" onClick={() => setIsModalOpen(false)}>×</button>
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