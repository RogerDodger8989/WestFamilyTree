import React, { useState, useMemo, useEffect, useRef } from 'react';
import DraggableModal from './DraggableModal';

function translateEvent(type) {
    const map = {
        'BIRT': 'Födelse', 'DEAT': 'Död', 'CHR': 'Dop', 'BURI': 'Begravning',
        'MARR': 'Vigsel', 'DIV': 'Skilsmässa', 'OCCU': 'Yrke', 'RESI': 'Bosatt',
        'EDUC': 'Utbildning', 'CONF': 'Konfirmation', 'PROB': 'Bouppteckning',
        'CENS': 'Husförhör', 'EMIG': 'Utvandring', 'IMMI': 'Invandring'
    };
    return map[type] || type;
}

function getLifeRange(person) {
    const getDate = (type) => {
        const evt = person.events?.find(e => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
        return evt?.date || '';
    };
    const b = getDate('BIRT');
    const d = getDate('DEAT');
    if (!b && !d) return '';
    return `${b} - ${d}`;
}

export default function LinkPersonModal({ 
    isOpen, 
    onClose, 
    people, 
    onLink, 
    initialPersonId,
    zIndex = 2000
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 50);
        }
    }, [isOpen]);

    const filteredPeople = useMemo(() => {
        if (initialPersonId) return people.filter(p => p.id === initialPersonId);
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return people.filter(p => 
            (p.firstName && p.firstName.toLowerCase().includes(lower)) ||
            (p.lastName && p.lastName.toLowerCase().includes(lower)) ||
            (p.refNumber && String(p.refNumber).includes(lower))
        ).slice(0, 20); 
    }, [people, searchTerm, initialPersonId]);

    if (!isOpen) return null;

    return (
        <DraggableModal
            title="Välj Person"
            onClose={onClose}
            onCancel={onClose}
            showConfirm={false} 
            zIndex={zIndex}
            initialWidth={600}
            initialHeight={600}
        >
            <div className="p-4 h-full flex flex-col">
                {!initialPersonId && (
                    <div className="mb-4">
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder="Sök på namn eller REF..." 
                            className="w-full border p-2 rounded shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto border rounded bg-gray-50">
                    {filteredPeople.length === 0 && searchTerm && (
                        <div className="p-4 text-gray-500 text-center">Inga personer hittades.</div>
                    )}
                    {filteredPeople.map(person => (
                        <div key={person.id} className="border-b bg-white">
                            <div 
                                className="p-3 cursor-pointer hover:bg-blue-50 flex justify-between items-center"
                                onClick={() => onLink(person.id)}
                            >
                                <div className="font-bold text-gray-800 text-sm">
                                    {person.firstName} {person.lastName} 
                                    <span className="text-gray-500 font-normal ml-2">{getLifeRange(person)}</span>
                                    <span className="text-gray-400 font-normal text-xs ml-2">(Ref: {person.refNumber})</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DraggableModal>
    );
}