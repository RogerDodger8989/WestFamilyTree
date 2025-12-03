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
    const parts = ['specific', 'village', 'parish', 'municipality', 'region', 'country'];
    return parts.map(p => norm[p]).filter(Boolean).join(', ');
}

export default function PlacePicker({ value, allPlaces, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const wrapperRef = useRef(null);

    const selectedPlace = useMemo(() => allPlaces.find(p => p.id === value), [value, allPlaces]);

    const filteredPlaces = useMemo(() => {
        if (!searchTerm) return allPlaces;
        const lowerTerm = searchTerm.toLowerCase();
        return allPlaces.filter(p => {
            // Sök även i normaliserade fält från parsePlaceString
            let norm = p;
            if (!p.country && (p.name || p.plac)) {
                norm = { ...p, ...parsePlaceString(p.name || p.plac) };
            }
            return Object.values(norm).some(val => String(val).toLowerCase().includes(lowerTerm));
        });
    }, [searchTerm, allPlaces]);

    const handleSelect = (placeId) => {
        onChange(placeId);
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
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-l-md pl-9 pr-8 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="Sök plats..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                        onFocus={() => setIsOpen(true)}
                    />
                    {searchTerm && (
                        <button onClick={() => { setSearchTerm(''); setIsOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <button
                    className="bg-gray-100 hover:bg-gray-200 border-y border-r border-gray-300 text-gray-700 p-2 rounded-r-md"
                    title="Öppna platsregister"
                    onClick={() => setIsModalOpen(true)}
                >
                    <Globe size={20} />
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-64 overflow-y-auto">
                    {filteredPlaces.length > 0 ? (
                        <ul>
                            {filteredPlaces.map(place => (
                                <li key={place.id} onClick={() => handleSelect(place.id)} className="px-4 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2 border-b border-gray-200 last:border-0">
                                    <span className="text-sm text-gray-800">{buildPlaceString(place)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-gray-500 text-sm italic">Inga platser hittades</div>
                    )}
                </div>
            )}

            {/* Modal: Place Catalog Picker */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-[90vw] h-[85vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-4 py-2 border-b">
                            <h3 className="font-semibold">Platsregister</h3>
                            <button className="text-xl text-gray-500" onClick={() => setIsModalOpen(false)}>×</button>
                        </div>
                        <div className="h-[calc(100%-40px)]">
                            <PlaceCatalog onPick={(node) => { onChange(node.metadata?.id || node.id); setIsModalOpen(false); }} onClose={() => setIsModalOpen(false)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}