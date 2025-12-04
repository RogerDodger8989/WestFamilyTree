import React, { useState, useEffect, useMemo } from 'react';
import SmartDateField from './SmartDateField.jsx';
import PlacePicker from './PlacePicker.jsx';

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

    const localPlace = useMemo(() => allPlaces.find(p => p.id === event.placeId), [allPlaces, event.placeId]);

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
            </td>
        </>
    );

    const renderValueField = (placeholder) => (
         <td colSpan="3" className="px-4 py-2">
            <input type="text" className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none" value={event.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder={placeholder} />
        </td>
    );

    const renderLinkField = () => (
        <td colSpan="3" className="px-4 py-2">
            <input type="url" className="w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none" value={event.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} placeholder="https://..."/>
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
        </td>
    );

    const renderCustomTypeField = () => (
        <td className="px-4 py-2">
            <input type="text" className="w-full bg-transparent border-b border-blue-300 focus:border-blue-500 outline-none font-semibold" value={event.customType || ''} onChange={(e) => handleFieldChange('customType', e.target.value)} placeholder="Ange egen händelsetyp..." />
        </td>
    );


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
        case 'Alternativt namn':
            content = renderValueField("Ange alternativt namn...");
            break;
        case 'Personnummer':
            content = renderValueField("Ange personnummer...");
            break;
        case 'Yrke':
            content = renderValueField("Ange yrke, t.ex. 'Bonde', 'Smed'...");
            break;
        case 'Utbildning':
            content = renderValueField("Ange skola, kurs eller examen...");
            break;
        case 'Militärtjänst':
            content = renderValueField("Ange regemente, befattning, etc...");
            break;
        case 'Egen händelse':
            typeDisplay = renderCustomTypeField();
            content = renderStandardFields();
            break;
        default:
            content = renderStandardFields();
            break;
    }

    return (
        <>
            <td className="px-4 py-2 font-medium">{typeDisplay}</td>
            {content}
        </>
    );
}
