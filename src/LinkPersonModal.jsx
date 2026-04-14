import React, { useState, useMemo, useEffect, useRef } from 'react';
import WindowFrame from './WindowFrame';

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
    skipEventSelection = false, // New prop for face tagging mode
    excludePersonIds = [], // Array of person IDs to exclude (already tagged)
    zIndex = 10000
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPerson, setSelectedPerson] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedPerson(null);
            // Multiple attempts to ensure focus
            const focusInput = () => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.click(); // Also trigger click to ensure focus
                }
            };
            
            requestAnimationFrame(() => {
                focusInput();
                setTimeout(focusInput, 50);
                setTimeout(focusInput, 150);
                setTimeout(focusInput, 300);
            });
        }
    }, [isOpen]);

    const filteredPeople = useMemo(() => {
        const excluded = new Set((excludePersonIds || []).map((id) => String(id)));
        const availablePeople = (people || []).filter((p) => !excluded.has(String(p?.id)));

        if (initialPersonId) {
            return availablePeople.filter((p) => String(p?.id) === String(initialPersonId));
        }

        const lower = searchTerm.trim().toLowerCase();
        if (!lower) {
            return availablePeople
                .slice()
                .sort((a, b) => `${a?.lastName || ''} ${a?.firstName || ''}`.localeCompare(`${b?.lastName || ''} ${b?.firstName || ''}`, 'sv'))
                .slice(0, 200);
        }

        return availablePeople
            .filter((p) =>
                (p.firstName && p.firstName.toLowerCase().includes(lower)) ||
                (p.lastName && p.lastName.toLowerCase().includes(lower)) ||
                (p.refNumber && String(p.refNumber).toLowerCase().includes(lower))
            )
            .slice(0, 200);
    }, [people, searchTerm, initialPersonId, excludePersonIds]);

    if (!isOpen) return null;

    // Om en person är vald, visa dess events
    if (selectedPerson) {
        return (
            <WindowFrame
                title={`Välj Händelse - ${selectedPerson.firstName} ${selectedPerson.lastName}`}
                onClose={() => setSelectedPerson(null)}
                initialWidth={600}
                initialHeight={600}
                zIndex={zIndex}
            >
                <div className="p-4 h-full flex flex-col">
                    <div className="mb-3 text-sm text-muted">
                        Välj en händelse att koppla till källan.
                    </div>
                    <div className="flex-1 overflow-y-auto border rounded bg-surface border-subtle mb-4">
                        {(!selectedPerson.events || selectedPerson.events.length === 0) && (
                            <div className="p-4 text-muted text-center italic">Inga händelser</div>
                        )}
                        {selectedPerson.events && selectedPerson.events.map(event => (
                            <div key={event.id} className="border-b border-subtle bg-surface last:border-b-0">
                                <div 
                                    className="p-3 cursor-pointer hover:bg-surface-2 flex justify-between items-center transition-colors"
                                    onClick={() => {
                                        onLink(selectedPerson.id, event.id);
                                        setSelectedPerson(null);
                                        onClose();
                                    }}
                                >
                                    <div className="text-primary text-sm">
                                        <span className="font-bold">{event.type}</span>
                                        <span className="text-muted ml-2">{event.date || '-'}</span>
                                        <span className="text-muted text-xs ml-2">{event.place || ''}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedPerson(null)}
                            className="px-4 py-2 bg-surface-2 hover:bg-surface text-primary rounded text-sm font-medium transition-colors"
                        >
                            Tillbaka
                        </button>
                        <button
                            onClick={() => {
                                // Skicka signal att man vill skapa event för denna person
                                onLink(selectedPerson.id, '__create_new_event__');
                                setSelectedPerson(null);
                                onClose();
                            }}
                            className="flex-1 px-4 py-2 bg-accent hover:bg-accent text-on-accent rounded text-sm font-medium transition-colors"
                        >
                            + Lägg till ny händelse
                        </button>
                    </div>
                </div>
            </WindowFrame>
        );
    }

    // Visa person-väljare
    return (
        <WindowFrame
            title="Välj Person"
            onClose={onClose}
            initialWidth={600}
            initialHeight={600}
            zIndex={zIndex}
        >
            <div className="p-4 h-full flex flex-col">
                {!initialPersonId && (
                    <div className="mb-4">
                        <input 
                            ref={inputRef}
                            type="text" 
                            placeholder="Sök på namn eller REF..." 
                            className="w-full border p-2 rounded shadow-sm focus:ring-2 focus:ring-accent outline-none bg-background text-primary border-subtle"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onClick={() => inputRef.current?.focus()}
                            autoFocus
                        />
                    </div>
                )}

                <div className="flex-1 overflow-y-auto border rounded bg-surface border-subtle">
                    {filteredPeople.length === 0 && (
                        <div className="p-4 text-muted text-center">Inga personer hittades.</div>
                    )}
                    {filteredPeople.map(person => (
                        <div key={person.id} className="border-b border-subtle bg-surface last:border-b-0">
                            <div 
                                className="p-3 cursor-pointer hover:bg-surface-2 flex justify-between items-center transition-colors"
                                onClick={() => {
                                    if (skipEventSelection) {
                                        // For face tagging: select person directly and close
                                        onLink(person.id, null);
                                        onClose();
                                    } else {
                                        // For source linking: go to event selection step
                                        setSelectedPerson(person);
                                    }
                                }}
                            >
                                <div className="font-bold text-primary text-sm">
                                    {person.firstName} {person.lastName} 
                                    <span className="text-muted font-normal ml-2">{getLifeRange(person)}</span>
                                    <span className="text-muted font-normal text-xs ml-2">(Ref: {person.refNumber})</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </WindowFrame>
    );
}