import React, { useMemo } from 'react';
import { buildSourceString } from './parsing.js'; // Återanvänd helper för att bygga en snygg källsträng

import { parsePlaceString } from './parsePlaceString.js';

export default function PlaceSourceConnections({ place, allSources, onNavigateToSource, onAttachSource, onSavePlace }) {


    // Normalisera platsen om den bara har PLAC-sträng
    let normPlace = place;
    if (place && !place.country && (place.name || place.plac)) {
        normPlace = { ...place, ...parsePlaceString(place.name || place.plac) };
    }

    const connectedSources = useMemo(() => {
        // Hitta alla källor vars ID finns i platsens 'sourceIds'-array
        if (!normPlace || !normPlace.sourceIds || !allSources) return [];
        return allSources.filter(source => normPlace.sourceIds.includes(source.id));
    }, [normPlace, allSources]);

    // NY LOGIK: Hitta föreslagna källor
    const suggestedSources = useMemo(() => {
        if (!normPlace || !allSources || !normPlace.parish) return [];

        const connectedIds = normPlace.sourceIds || [];
        const placeParishLower = normPlace.parish.toLowerCase();

        return allSources.filter(source => {
            // Inkludera inte källor som redan är kopplade
            if (connectedIds.includes(source.id)) return false;
            // Matcha om källans arkiv innehåller platsens församlingsnamn
            return source.archive && source.archive.toLowerCase().includes(placeParishLower);
        });
    }, [normPlace, allSources]);

    // NY FUNKTION: Hanterar snabbkoppling från förslagslistan
    const handleQuickAttach = (sourceId) => {
        const updatedSourceIds = [...(place.sourceIds || []), sourceId];
        onSavePlace({ ...place, sourceIds: updatedSourceIds });
    };

    return (
        <div className="mt-6">
            <div className="flex justify-between items-center border-b pb-2 mb-2">
                <h4 className="text-lg font-semibold text-slate-200">Kopplade Källor</h4>
                <button onClick={() => onAttachSource('place', place.id)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">[+ Koppla källa]</button>
            </div>
            {connectedSources.length > 0 ? (
                <ul className="space-y-2 mb-6">
                    {connectedSources.map(source => (
                        <li key={source.id} className="text-sm p-2 bg-slate-800 rounded-md border border-slate-700">
                            <span className="font-bold cursor-pointer hover:underline" onClick={() => onNavigateToSource(source.id)}>{buildSourceString(source)}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-slate-400 italic mt-2 mb-6">Inga källor är kopplade till denna plats än.</p>
            )}

            {/* NYTT: Sektion för föreslagna källor */}
            {suggestedSources.length > 0 && (
                <div>
                    <h5 className="text-md font-semibold text-slate-200 border-b pb-1 mb-2">Föreslagna Källor (baserat på platsnamn)</h5>
                    <ul className="space-y-1">
                        {suggestedSources.map(source => (
                            <li key={source.id} className="text-sm p-1.5 bg-slate-700 rounded-md flex justify-between items-center">
                                <span className="font-semibold cursor-pointer hover:underline text-slate-200" onClick={() => onNavigateToSource(source.id)}>
                                    {buildSourceString(source)}
                                </span>
                                <button onClick={() => handleQuickAttach(source.id)} className="px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 font-semibold">[+ Koppla]</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}