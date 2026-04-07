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
            <div className="w-full rounded-xl border border-subtle bg-surface shadow-lg">
                <div className="px-4 py-3 text-sm text-secondary">
                    Välj en <span className="text-warning font-semibold">primär</span> och en <span className="text-accent font-semibold">sekundär</span> person för att beräkna släktskap.
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
            <div className="mx-auto w-full max-w-6xl rounded-xl border border-subtle bg-surface backdrop-blur shadow-2xl">
                <div className="px-4 pt-3 pb-2 border-b border-subtle flex items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-lg border border-strong bg-warning-soft px-2 py-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-warning">Primär</div>
                            <div className="font-semibold text-primary truncate">{personA.firstName} {personA.lastName}</div>
                            <div className="text-[11px] text-muted truncate">{getLifeSpanString(personA)}</div>
                        </div>

                        <button
                            onClick={onSwapFocus}
                            title="Byt plats på fokuspersoner"
                            className="shrink-0 w-8 h-8 rounded-full border border-subtle text-secondary hover:text-primary hover:border-strong hover:bg-surface-2 transition-colors"
                        >
                            ↔
                        </button>

                        <div className="rounded-lg border border-strong bg-accent-soft px-2 py-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-accent">Sekundär</div>
                            <div className="font-semibold text-primary truncate">{personB.firstName} {personB.lastName}</div>
                            <div className="text-[11px] text-muted truncate">{getLifeSpanString(personB)}</div>
                        </div>
                    </div>

                    <button
                        onClick={onClearFocus}
                        className="text-muted hover:text-primary hover:bg-surface-2 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                        title="Rensa fokuspersoner"
                    >
                        &times;
                    </button>
                </div>

                <div className="px-4 pt-3 pb-2 text-center">
                    <div className="inline-flex items-center rounded-full border border-strong bg-accent-soft px-3 py-1 text-accent text-xs uppercase tracking-wide">Släktskap</div>
                    <div className="mt-2 text-2xl font-bold text-accent">{advancedRel?.text || 'Okänd relation'}</div>
                    {advancedRel?.lca && advancedRel.lca.id !== personA.id && advancedRel.lca.id !== personB.id && (
                        <div className="text-xs text-muted mt-2">
                            Gemensam ana: <span className="font-semibold text-primary">{advancedRel.lca.firstName} {advancedRel.lca.lastName}</span> {getLifeSpanString(advancedRel.lca)}
                            {advancedRel.lcaCount > 1 ? ` (+ ${advancedRel.lcaCount - 1} till)` : ''}
                        </div>
                    )}
                </div>

                <div className="px-4 pb-3 pt-2 border-t border-subtle">
                    <RelationshipPath startPerson={personA} endPersonId={personB.id} allPeople={allPeople} />
                </div>
            </div>
        </div>
    );
}