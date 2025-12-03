import React, { useMemo } from 'react';
import { parsePlaceString } from './parsePlaceString.js';

export default function PlaceConnections({ place, allPeople, onPersonClick }) {
    // Normalisera platsen om den bara har PLAC-sträng
    let normPlace = place;
    if (place && !place.country && (place.name || place.plac)) {
        normPlace = { ...place, ...parsePlaceString(place.name || place.plac) };
    }
    const connectedPeople = useMemo(() => {
        if (!normPlace || !allPeople) return [];

        const connections = [];
        for (const person of allPeople) {
            for (const event of person.events || []) {
                if (event.placeId === normPlace.id) {
                    connections.push({
                        person,
                        event,
                    });
                }
            }
        }
        return connections;
    }, [normPlace, allPeople]);

    if (connectedPeople.length === 0) {
        return null; // Visa inget om inga kopplingar finns
    }

    return (
        <div className="mt-6">
            <h4 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-2">Personer & Händelser på denna plats</h4>
            <ul className="space-y-2">
                {connectedPeople.map(({ person, event }, index) => (
                    <li key={`${person.id}-${event.id}-${index}`} className="text-sm p-2 bg-gray-50 rounded-md">
                        <span className="font-bold cursor-pointer hover:underline" onClick={() => onPersonClick(person.id)}>{person.firstName} {person.lastName}</span>
                        <span className="text-gray-600"> - {event.type} ({event.date || 'Okänt datum'})</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}