import React, { useState, useEffect, useMemo } from 'react';
import SmartDateField from './SmartDateField.jsx';
import PlacePicker from './PlacePicker.jsx';
import {
    EVENT_TYPE_CONFIGS,
    buildEventSummary,
    getEventTypeConfig
} from './eventFieldConfig.js';

const ATTRIBUTE_VALUE_LABELS = {
    'Yrke': 'Yrke / Titel',
    'Titel': 'Titel / Benämning',
    'Personnummer': 'Personnummer / ID',
    'Socialförsäkringsnummer': 'Socialförsäkringsnummer / ID',
    'Alternativt namn': 'Alternativt namn / Variant'
};

// NY HJÄLPFUNKTION (kopierad från EditPersonModal för konsistens)
function buildPlaceString(place) {
  if (!place) return 'Okänd plats';
  const parts = [
    place.country,
    place.region,
    place.municipality,
    place.parish,
    place.village,
    place.specific
  ];
  return parts.filter(Boolean).join(', ');
}

export default function EventEditor({ event, index, onEventChange, allPeople, allPlaces, onNavigateToPlace, onNavigateToSource, onEditNote, eventTypes = [] }) {
    const [resolvedPlaceName, setResolvedPlaceName] = useState('');
    const [selectedLinkedPersonId, setSelectedLinkedPersonId] = useState('');
    const availableEventTypes = useMemo(() => {
        if (Array.isArray(eventTypes) && eventTypes.length > 0) return eventTypes;
        if (Array.isArray(EVENT_TYPE_CONFIGS) && EVENT_TYPE_CONFIGS.length > 0) return EVENT_TYPE_CONFIGS;
        if (event?.type) {
            return [{ value: event.type, label: event.type, gedcomType: event.gedcomType || (event.type === 'Egen händelse' ? 'custom' : 'event') }];
        }
        return [];
    }, [eventTypes, event?.type, event?.gedcomType]);
    const resolvedGedcomType = event.gedcomType || (event.type === 'Egen händelse' ? 'custom' : 'event');
    const isAttributeEvent = resolvedGedcomType === 'attribute';
    const selectedEventTypeConfig = useMemo(() => getEventTypeConfig(event.type) || availableEventTypes.find((item) => item.value === event.type) || null, [availableEventTypes, event.type]);
    const eventSummary = useMemo(() => buildEventSummary(event), [event]);

    const gedcomTypeBadgeClass = useMemo(() => {
        if (resolvedGedcomType === 'attribute') return 'bg-warning-soft text-warning border-strong';
        if (resolvedGedcomType === 'custom') return 'bg-accent-soft text-accent border-strong';
        return 'bg-accent-soft text-accent border-strong';
    }, [resolvedGedcomType]);

    const getAttributeValueLabel = (eventType) => {
        if (!eventType) return 'Värde / Beskrivning';
        return ATTRIBUTE_VALUE_LABELS[eventType] || `${eventType} / Beskrivning`;
    };

    const localPlace = useMemo(() => allPlaces.find(p => p.id === event.placeId), [allPlaces, event.placeId]);
    const sortedPeople = useMemo(() => {
        return [...(allPeople || [])].sort((a, b) => {
            const firstNameA = String(a?.firstName || '').toLocaleLowerCase('sv');
            const firstNameB = String(b?.firstName || '').toLocaleLowerCase('sv');
            if (firstNameA !== firstNameB) return firstNameA.localeCompare(firstNameB, 'sv');

            const lastNameA = String(a?.lastName || '').toLocaleLowerCase('sv');
            const lastNameB = String(b?.lastName || '').toLocaleLowerCase('sv');
            return lastNameA.localeCompare(lastNameB, 'sv');
        });
    }, [allPeople]);
    const linkedPersonIds = Array.isArray(event.linkedPersons) ? event.linkedPersons : [];
    const linkedPeople = useMemo(() => {
        return linkedPersonIds
            .map((personId) => {
                const person = (allPeople || []).find((candidate) => candidate.id === personId);
                if (person) {
                    return {
                        id: personId,
                        name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || `Person ${personId}`,
                    };
                }
                return { id: personId, name: `Okänd person (${personId})` };
            })
            .filter(Boolean);
    }, [linkedPersonIds, allPeople]);

    useEffect(() => {
        let abort = false;
        async function resolve() {
            if (!event.placeId) { setResolvedPlaceName(''); return; }
            if (localPlace) {
                const name = buildPlaceString(localPlace);
                setResolvedPlaceName(name);
                return;
            }
            try {
                const res = await fetch(`http://localhost:5005/official_places/${encodeURIComponent(event.placeId)}`);
                if (!res.ok) { setResolvedPlaceName(''); return; }
                const data = await res.json();
                if (abort) return;
                const name = data.ortnamn || data.sockenstadnamn || data.kommunnamn || data.lansnamn || '';
                const meta = [data.sockenstadnamn, data.kommunnamn, data.lansnamn].filter(Boolean).join(' • ');
                setResolvedPlaceName(meta ? `${name} (${meta})` : name);
            } catch (e) {
                if (!abort) setResolvedPlaceName('');
            }
        }
        resolve();
        return () => { abort = true; };
    }, [event.placeId, localPlace]);
    const handleFieldChange = (field, value) => {
        console.log('EventEditor: handleFieldChange called with field:', field, 'value:', value);
        const updatedEvent = { ...event, [field]: value };
        onEventChange(index, updatedEvent);
    };

    const handleDeleteNote = () => {
        handleFieldChange('description', '');
    };

    const handleEventTypeChange = (nextType) => {
        if (!nextType || nextType === event.type) return;

        const nextTypeConfig = availableEventTypes.find((item) => item.value === nextType) || null;
        const hadLinkedPersons = Array.isArray(event.linkedPersons) && event.linkedPersons.length > 0;
        if (hadLinkedPersons) {
            const shouldContinue = window.confirm('Om du byter händelsetyp kommer de kopplade vittnena/medverkande att raderas eftersom deras roller kanske inte längre stämmer. Vill du fortsätta?');
            if (!shouldContinue) return;
        }

        const nextGedcomType = nextTypeConfig?.gedcomType || 'event';
        const nextEvent = {
            ...event,
            type: nextType,
            gedcomType: nextGedcomType,
            linkedPersons: [],
            cause: undefined
        };

        if (nextGedcomType === 'custom') {
            nextEvent.customType = String(event.customType || '').trim();
        } else {
            nextEvent.customType = undefined;
        }

        onEventChange(index, nextEvent);
    };

    const handleLinkedPersonSelect = (personId) => {
        if (!personId) {
            setSelectedLinkedPersonId('');
            return;
        }

        const uniqueIds = linkedPersonIds.includes(personId)
            ? linkedPersonIds
            : [...linkedPersonIds, personId];

        handleFieldChange('linkedPersons', uniqueIds);
        setSelectedLinkedPersonId('');
    };

    const handleRemoveLinkedPerson = (personId) => {
        handleFieldChange('linkedPersons', linkedPersonIds.filter((id) => id !== personId));
    };

    const renderLinkedPersonsSection = () => (
        <div className="mt-2 p-2 rounded-md border border-subtle bg-surface/50">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-secondary mb-1">
                Medverkande / Vittnen (Dopvittnen, inneboende etc)
            </label>
            <select
                value={selectedLinkedPersonId}
                onChange={(e) => {
                    const selectedId = e.target.value;
                    setSelectedLinkedPersonId(selectedId);
                    handleLinkedPersonSelect(selectedId);
                }}
                className="w-full p-1.5 border border-subtle bg-surface text-primary rounded text-sm"
            >
                <option value="">Välj person att koppla...</option>
                {sortedPeople.map((person) => (
                    <option key={person.id} value={person.id}>
                        {`${person.firstName || ''} ${person.lastName || ''}`.trim() || `Person ${person.id}`}
                    </option>
                ))}
            </select>

            {linkedPeople.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {linkedPeople.map((person) => (
                        <span
                            key={person.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-soft text-accent border border-strong text-xs"
                        >
                            <span>{person.name}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveLinkedPerson(person.id)}
                                className="w-4 h-4 rounded-full bg-surface/80 text-primary hover:bg-warning-soft hover:text-warning leading-none"
                                aria-label={`Ta bort ${person.name}`}
                                title={`Ta bort ${person.name}`}
                            >
                                x
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
    
    const renderStandardFields = () => (
        <>
            <td className="px-4 py-2"><SmartDateField value={event.date || ''} onChange={(val) => handleFieldChange('date', val)} placeholder="Datum (t.ex. 25 jan 1990)" /></td>
            <td className="px-4 py-2">
                {event.placeId ? (
                    <span
                        onClick={() => onNavigateToPlace && onNavigateToPlace(event.placeId, event.id)}
                        className="text-accent hover:underline cursor-pointer font-semibold"
                        title="Klicka för att visa i Platsregistret"
                    >
                        {resolvedPlaceName || buildPlaceString(localPlace)}
                    </span>
                ) : (
                    <PlacePicker
                        value={event.placeId || ''}
                        allPlaces={allPlaces}
                        onChange={(placeId) => {
                            console.log('EventEditor: PlacePicker onChange triggered with placeId:', placeId);
                            handleFieldChange('placeId', placeId);
                            handleFieldChange('place', '');
                        }}
                    />
                )}
            </td>
            <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onEditNote} // ANVÄND onEditNote ISTÄLLET
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${event.note && event.note.trim().length > 0 ? 'bg-accent-soft text-accent border-strong hover:bg-accent-soft/80' : 'bg-accent-soft text-accent border-strong hover:bg-accent-soft/80'}`}
                    >
                        {event.note && event.note.trim().length > 0 ? '✓ Tillagt' : '+ Lägg till'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteNote}
                        className="text-xs font-semibold px-2 py-1 rounded-full border bg-warning-soft text-warning border-strong hover:bg-warning-soft/80 disabled:opacity-50"
                        disabled={!event.description || event.description.trim().length === 0}
                    >
                        Ta bort
                    </button>
                </div>
                {renderLinkedPersonsSection()}
            </td>
        </>
    );

    const renderValueField = (label, placeholder) => (
         <td colSpan="3" className="px-4 py-2">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">{label}</label>
            <input
                type="text"
                className="w-full bg-transparent border-b border-transparent focus:border-accent outline-none"
                value={event.description ?? event.value ?? ''}
                onChange={(e) => {
                    handleFieldChange('description', e.target.value);
                    handleFieldChange('value', e.target.value);
                }}
                placeholder={placeholder}
            />
            {renderLinkedPersonsSection()}
        </td>
    );

    const renderLinkField = () => (
        <td colSpan="3" className="px-4 py-2">
            <input type="url" className="w-full bg-transparent border-b border-transparent focus:border-accent outline-none" value={event.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="https://..."/>
            {renderLinkedPersonsSection()}
        </td>
    );

    const renderPartnerField = () => (
         <td colSpan="3" className="px-4 py-2">
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Partner:</span>
                <select
                    value={event.partnerId || ''}
                    onChange={(e) => handleFieldChange('partnerId', e.target.value)}
                    className="flex-grow p-1 border border-subtle bg-surface text-primary rounded text-sm"
                >
                    <option value="">Välj partner...</option>
                    {allPeople.map(p => (
                        <option key={p.id} value={p.id}>{p.firstName} {p.lastName} (REF: {p.refNumber})</option>
                    ))}
                </select>
                 <SmartDateField value={event.date || ''} onChange={(val) => handleFieldChange('date', val)} placeholder="Datum" />
                 <div className="flex-grow">
                    {event.placeId ? (
                        <span
                            onClick={() => onNavigateToPlace && onNavigateToPlace(event.placeId, event.id)}
                            className="text-accent hover:underline cursor-pointer font-semibold"
                            title="Klicka för att visa i Platsregistret"
                        >
                            {resolvedPlaceName || buildPlaceString(localPlace)}
                        </span>
                    ) : (
                        <PlacePicker
                            value={event.placeId || ''}
                            allPlaces={allPlaces}
                            onChange={(placeId) => {
                                console.log('EventEditor (partner field): PlacePicker onChange triggered with placeId:', placeId);
                                handleFieldChange('placeId', placeId);
                                handleFieldChange('place', '');
                            }}
                        />
                    )}
                 </div>
            </div>
            {renderLinkedPersonsSection()}
        </td>
    );

    const attributeLabel = getAttributeValueLabel(event.type);
    const attributePlaceholder = `Ange ${String(event.type || 'värde').toLowerCase()}...`;

    let content;

    switch (event.type) {
        case 'Vigsel':
        case 'Förlovning':
        case 'Skilsmässa':
            content = renderPartnerField();
            break;
        case 'Länk: FamilySearch':
        case 'Länk: Facebook':
            content = renderLinkField();
            break;
        default:
            if (isAttributeEvent) {
                content = renderValueField(attributeLabel, attributePlaceholder);
            } else {
                content = renderStandardFields();
            }
            break;
    }

    return (
        <>
            <td className="px-4 py-2 font-medium align-top">
                <div className="space-y-2 rounded-md border border-subtle bg-surface/60 px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 min-w-0">
                            <span className="text-sm leading-none text-secondary">{selectedEventTypeConfig?.icon || '•'}</span>
                            <span className="text-xs font-semibold text-primary truncate">
                                {selectedEventTypeConfig?.label || event.type || 'Händelse'}
                            </span>
                        </div>
                        <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${gedcomTypeBadgeClass}`}>
                            {resolvedGedcomType}
                        </span>
                    </div>
                    {eventSummary && (
                        <div className="text-[11px] text-secondary truncate">
                            {eventSummary}
                        </div>
                    )}

                    <div className="relative">
                        <select
                            value={event.type || ''}
                            onChange={(e) => handleEventTypeChange(e.target.value)}
                            className="w-full appearance-none bg-background/80 border border-subtle rounded-md pl-2 pr-8 py-1.5 text-primary text-sm focus:border-accent focus:outline-none"
                            title="Byt händelsetyp"
                        >
                            {availableEventTypes.map((eventType) => (
                                <option key={eventType.value} value={eventType.value}>
                                    {eventType.label}
                                </option>
                            ))}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">▾</span>
                    </div>

                    {resolvedGedcomType === 'custom' && (
                        <input
                            type="text"
                            className="w-full bg-background/80 border border-subtle rounded-md px-2 py-1.5 focus:border-accent outline-none font-semibold text-primary"
                            value={event.customType || ''}
                            onChange={(e) => handleFieldChange('customType', e.target.value)}
                            placeholder="Ange egen händelsetyp..."
                        />
                    )}
                </div>
            </td>
            {content}
        </>
    );
}
