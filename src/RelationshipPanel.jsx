import React from 'react';
import { calculateAdvancedRelationship } from './relationshipUtils.js';
import RelationshipPath from './RelationshipPath.jsx';
import { useApp } from './AppContext';

function getLifeSpanString(person) {
    if (!person) return '';
    const birth = person.events?.find(e => e.type === 'Födelse')?.date || '';
    const death = person.events?.find(e => e.type === 'Död')?.date || '';
    return birth || death ? `(${birth} - ${death})` : '';
}

export default function RelationshipPanel({ focusPair, allPeople, onClearFocus, onSwapFocus, inline = false }) {
    const hasBothFocus = Boolean(focusPair?.primary && focusPair?.secondary);
    if (!hasBothFocus && !inline) {
        return null; // Visa inget i flytande läge om båda inte är valda
    }

    if (!hasBothFocus && inline) {
        return (
            <div className="w-full rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-lg">
                <div className="px-4 py-3 text-sm text-slate-300">
                    Välj en <span className="text-yellow-300 font-semibold">primär</span> och en <span className="text-blue-300 font-semibold">sekundär</span> person för att beräkna släktskap.
                </div>
            </div>
        );
    }

    const personA = allPeople.find(p => p.id === focusPair.primary);
    const personB = allPeople.find(p => p.id === focusPair.secondary);

    if (!personA || !personB) {
        return null;
    }

    const { getPersonRelations } = useApp();
    const advancedRel = calculateAdvancedRelationship(personA.id, personB.id, allPeople, getPersonRelations);

    return (
        <div className={inline ? 'w-full' : 'fixed bottom-0 left-0 right-0 z-50 animate-slide-in-bottom px-3 pb-3'}>
            <div className="mx-auto w-full max-w-6xl rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur shadow-2xl">
                <div className="px-4 pt-3 pb-2 border-b border-slate-700/70 flex items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-lg border border-yellow-500/40 bg-yellow-900/20 px-2 py-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-yellow-300">Primär</div>
                            <div className="font-semibold text-slate-100 truncate">{personA.firstName} {personA.lastName}</div>
                            <div className="text-[11px] text-slate-400 truncate">{getLifeSpanString(personA)}</div>
                        </div>

                        <button
                            onClick={onSwapFocus}
                            title="Byt plats på fokuspersoner"
                            className="shrink-0 w-8 h-8 rounded-full border border-slate-600 text-slate-300 hover:text-white hover:border-blue-500 hover:bg-slate-800 transition-colors"
                        >
                            ↔
                        </button>

                        <div className="rounded-lg border border-blue-500/40 bg-blue-900/20 px-2 py-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-blue-300">Sekundär</div>
                            <div className="font-semibold text-slate-100 truncate">{personB.firstName} {personB.lastName}</div>
                            <div className="text-[11px] text-slate-400 truncate">{getLifeSpanString(personB)}</div>
                        </div>
                    </div>

                    <button
                        onClick={onClearFocus}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                        title="Rensa fokuspersoner"
                    >
                        &times;
                    </button>
                </div>

                <div className="px-4 pt-3 pb-2 text-center">
                    <div className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-900/20 px-3 py-1 text-blue-300 text-xs uppercase tracking-wide">Släktskap</div>
                    <div className="mt-2 text-2xl font-bold text-blue-300">{advancedRel?.text || 'Okänd relation'}</div>
                    {advancedRel?.lca && advancedRel.lca.id !== personA.id && advancedRel.lca.id !== personB.id && (
                        <div className="text-xs text-slate-400 mt-2">
                            Gemensam ana: <span className="font-semibold text-slate-200">{advancedRel.lca.firstName} {advancedRel.lca.lastName}</span> {getLifeSpanString(advancedRel.lca)}
                            {advancedRel.lcaCount > 1 ? ` (+ ${advancedRel.lcaCount - 1} till)` : ''}
                        </div>
                    )}
                </div>

                <div className="px-4 pb-3 pt-2 border-t border-slate-700/70">
                    <RelationshipPath startPerson={personA} endPersonId={personB.id} allPeople={allPeople} />
                </div>
            </div>
        </div>
    );
}