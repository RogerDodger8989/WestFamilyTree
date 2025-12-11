import React from 'react';
import { getAncestryPath } from './relationshipUtils.js';
import { useApp } from './AppContext';

function getConnectingRelationship(currentPerson, previousPerson, getPersonRelations) {
    if (!currentPerson || !previousPerson) return '';
    const rels = getPersonRelations ? (getPersonRelations(currentPerson.id) || []) : [];
    for (const r of rels) {
        if (!r || r._archived) continue;
        const t = (r.type || '').toString().toLowerCase();
        const from = r.fromPersonId;
        const to = r.toPersonId;
        if (t === 'parent') {
            // from is parent of to
            if (from === previousPerson.id && to === currentPerson.id) return previousPerson.gender === 'K' ? 'Mor' : 'Far';
            if (from === currentPerson.id && to === previousPerson.id) return previousPerson.gender === 'K' ? 'Dotter' : 'Son';
        }
        if (t === 'child') {
            // from is child of to
            if (from === previousPerson.id && to === currentPerson.id) return previousPerson.gender === 'K' ? 'Dotter' : 'Son';
            if (from === currentPerson.id && to === previousPerson.id) return previousPerson.gender === 'K' ? 'Mor' : 'Far';
        }
    }
    return 'Släkt'; // Fallback
}

export default function RelationshipPath({ startPerson, endPersonId, allPeople }) {
    const { getPersonRelations } = useApp();
    if (!startPerson || !endPersonId || startPerson.id === endPersonId) {
        return null;
    }

    const path = getAncestryPath(startPerson.id, endPersonId, allPeople, getPersonRelations);

    if (!path || path.length <= 1) {
        return null;
    }

    return (
        <div className="text-sm text-slate-300 mb-4 flex flex-wrap items-start gap-x-2">
            <span className="font-bold">Relationsstig:</span>
            {path.map((person, index) => (
                <React.Fragment key={person.id}>
                    <div className="text-center">
                        <div className={`font-semibold ${index % 2 === 0 ? 'text-blue-700' : 'text-red-700'}`}>
                            {person.firstName} {person.lastName}
                        </div>
                        {index > 0 && ( // Visa bara relation för personer efter den första
                                <div className="text-xs text-slate-400 italic">
                                ({getConnectingRelationship(person, path[index - 1], getPersonRelations)})
                            </div>
                        )}
                    </div>
                    {index < path.length - 1 && (
                        <span className="text-slate-400 font-bold self-center">→</span>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}