import React, { useState, useEffect, useMemo } from 'react';
import SmartDateField from './SmartDateField.jsx';
import PlacePicker from './PlacePicker.jsx';

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

export default function EventEditor({ event, index, onEventChange, allPeople, allPlaces, onNavigateToPlace, onNavigateToSource, onEditNote }) {
    const [resolvedPlaceName, setResolvedPlaceName] = useState('');
    const [selectedLinkedPersonId, setSelectedLinkedPersonId] = useState('');
    const resolvedGedcomType = event.gedcomType || (event.type === 'Egen händelse' ? 'custom' : 'event');
    const isAttributeEvent = resolvedGedcomType === 'attribute';
    const isCustomEvent = resolvedGedcomType === 'custom';

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
        <div className="mt-2 p-2 rounded-md border border-slate-700/80 bg-slate-900/50">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-300 mb-1">
                Medverkande / Vittnen (Dopvittnen, inneboende etc)
            </label>
            <select
                value={selectedLinkedPersonId}
                onChange={(e) => {
                    const selectedId = e.target.value;
                    setSelectedLinkedPersonId(selectedId);
                    handleLinkedPersonSelect(selectedId);
                }}
                className="w-full p-1.5 border border-slate-600 bg-slate-900 text-slate-200 rounded text-sm"
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
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-900/40 text-blue-100 border border-blue-700/60 text-xs"
                        >
                            <span>{person.name}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveLinkedPerson(person.id)}
                                className="w-4 h-4 rounded-full bg-slate-800/80 text-slate-200 hover:bg-red-700/80 hover:text-white leading-none"
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
                        className="text-blue-600 hover:underline cursor-pointer font-semibold"
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
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${event.note && event.note.trim().length > 0 ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                    >
                        {event.note && event.note.trim().length > 0 ? '✓ Tillagt' : '+ Lägg till'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteNote}
                        className="text-xs font-semibold px-2 py-1 rounded-full border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 disabled:opacity-50"
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
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</label>
            <input
                type="text"
                className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
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
            <input type="url" className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none" value={event.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="https://..."/>
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
                    className="flex-grow p-1 border border-slate-600 bg-slate-900 text-slate-200 rounded text-sm"
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
                            className="text-blue-600 hover:underline cursor-pointer font-semibold"
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

    const renderCustomTypeField = () => (
        <td className="px-4 py-2">
            <input type="text" className="w-full bg-transparent border-b border-blue-300 focus:border-blue-500 outline-none font-semibold" value={event.customType || ''} onChange={(e) => handleFieldChange('customType', e.target.value)} placeholder="Ange egen händelsetyp..." />
        </td>
    );


    const attributeLabel = getAttributeValueLabel(event.type);
    const attributePlaceholder = `Ange ${String(event.type || 'värde').toLowerCase()}...`;

    let content;
    let typeDisplay = event.type;

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
        case 'Egen händelse':
            typeDisplay = renderCustomTypeField();
            content = renderStandardFields();
            break;
        default:
            if (isCustomEvent) {
                typeDisplay = renderCustomTypeField();
                content = renderStandardFields();
            } else if (isAttributeEvent) {
                content = renderValueField(attributeLabel, attributePlaceholder);
            } else {
                content = renderStandardFields();
            }
            break;
    }

    return (
        <>
            <td className="px-4 py-2 font-medium">{typeDisplay}</td>
            {content}
        </>
    );
}
