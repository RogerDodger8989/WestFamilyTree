import React, { useState, useMemo, useRef, useEffect } from 'react';
import { parsePlaceString } from './parsePlaceString.js';

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
        <div className="relative w-full" ref={wrapperRef}>
            <div onClick={() => setIsOpen(!isOpen)} className="w-full p-1 bg-transparent border-b border-gray-300 hover:border-blue-500 cursor-pointer min-h-[30px]">
                {selectedPlace ? <span className="text-sm">{buildPlaceString(selectedPlace)}</span> : <span className="text-sm text-gray-400">Välj plats...</span>}
            </div>

            {isOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    <input
                        type="text"
                        placeholder="Sök plats..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="sticky top-0 w-full p-2 border-b"
                        autoFocus
                    />
                    <ul>{filteredPlaces.map(place => (<li key={place.id} onClick={() => handleSelect(place.id)} className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-100">{buildPlaceString(place)}</li>))}</ul>
                </div>
            )}
        </div>
    );
}