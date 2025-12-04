import React from 'react';
import { calculateRelationship } from './relationshipUtils.js';
import { useApp } from './AppContext';

function getLifeSpanString(person) {
    if (!person) return '';
    const birth = person.events?.find(e => e.type === 'Födelse')?.date || '';
    const death = person.events?.find(e => e.type === 'Död')?.date || '';
    return birth || death ? `(${birth} - ${death})` : '';
}

export default function RelationshipPanel({ focusPair, allPeople, onClearFocus, onSwapFocus }) {
    if (!focusPair.primary || !focusPair.secondary) {
        return null; // Visa ingenting om inte båda är valda
    }

    const personA = allPeople.find(p => p.id === focusPair.primary);
    const personB = allPeople.find(p => p.id === focusPair.secondary);

    if (!personA || !personB) {
        return null;
    }

    const { getPersonRelations } = useApp();
    const relationship = calculateRelationship(personA.id, personB.id, allPeople, getPersonRelations);

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-800 text-slate-200 p-4 shadow-2xl z-50 flex items-center justify-between animate-slide-in-bottom border-t border-slate-700">
            <div className="flex items-center gap-6">
                {/* Person A */}
                <div className="flex items-center gap-2">
                    <span className="text-yellow-400 text-2xl" title="Primär Fokusperson">★</span>
                    <div>
                        <div className="font-bold">{personA.firstName} {personA.lastName}</div>
                        <div className="text-xs text-slate-400">{getLifeSpanString(personA)}</div>
                    </div>
                </div>

                <button onClick={onSwapFocus} title="Byt plats på fokuspersoner" className="text-2xl hover:text-yellow-400 transition-colors">↔</button>

                {/* Person B */}
                <div className="flex items-center gap-2">
                    <span className="text-blue-500 text-2xl" title="Sekundär Fokusperson">★</span>
                    <div>
                        <div className="font-bold">{personB.firstName} {personB.lastName}</div>
                        <div className="text-xs text-slate-400">{getLifeSpanString(personB)}</div>
                    </div>
                </div>
            </div>

            <div className="text-center">
                <div className="text-lg font-bold">{relationship}</div>
            </div>

            <button onClick={onClearFocus} className="text-slate-400 hover:text-slate-200 text-2xl" title="Rensa fokuspersoner">&times;</button>
        </div>
    );
}