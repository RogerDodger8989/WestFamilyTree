import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { calculateAdvancedRelationship } from './relationshipUtils.js';
import RelationshipPath from './RelationshipPath.jsx';
import { useApp } from './AppContext';

function getLifeSpanString(person) {
    if (!person) return '';
    const birth = person.events?.find(e => e.type === 'Födelse')?.date || '';
    const death = person.events?.find(e => e.type === 'Död')?.date || '';
    return birth || death ? `(${birth} - ${death})` : '';
}

export default function RelationshipCalculatorModal({ isOpen, onClose, allPeople = [] }) {
    const { getPersonRelations } = useApp();
    const [primaryPersonId, setPrimaryPersonId] = useState('');
    const [secondaryPersonId, setSecondaryPersonId] = useState('');
    const [searchPrimary, setSearchPrimary] = useState('');
    const [searchSecondary, setSearchSecondary] = useState('');
    const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
    const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false);

    const filteredPrimaryPeople = useMemo(() => {
        if (!searchPrimary) return allPeople.slice(0, 20);
        return allPeople.filter(p => {
            const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
            return fullName.includes(searchPrimary.toLowerCase()) || (p.refNumber || '').includes(searchPrimary);
        }).slice(0, 20);
    }, [searchPrimary, allPeople]);

    const filteredSecondaryPeople = useMemo(() => {
        if (!searchSecondary) return allPeople.slice(0, 20);
        return allPeople.filter(p => {
            const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
            return fullName.includes(searchSecondary.toLowerCase()) || (p.refNumber || '').includes(searchSecondary);
        }).slice(0, 20);
    }, [searchSecondary, allPeople]);

    const personA = allPeople.find(p => p.id === primaryPersonId);
    const personB = allPeople.find(p => p.id === secondaryPersonId);
    const hasBothFocus = Boolean(personA && personB);
    const advancedRel = hasBothFocus ? calculateAdvancedRelationship(personA.id, personB.id, allPeople, getPersonRelations) : null;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-surface border border-subtle rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-subtle shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-primary">Släktskapsberäkning</h2>
                        <p className="text-sm text-secondary mt-1">Välj två personer för att beräkna deras släktskap</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted hover:text-primary rounded-lg hover:bg-surface-2 p-2 transition-colors"
                        title="Stäng"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {/* Person Selection */}
                    <div className="space-y-4 mb-6">
                        {/* Primary Person Selection */}
                        <div>
                            <label className="block text-sm font-medium text-primary mb-2">
                                Primär person
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Sök efter person..."
                                    value={searchPrimary}
                                    onChange={(e) => {
                                        setSearchPrimary(e.target.value);
                                        setShowPrimaryDropdown(true);
                                    }}
                                    onFocus={() => setShowPrimaryDropdown(true)}
                                    className="w-full px-3 py-2 border border-subtle rounded-lg bg-surface-2 text-primary placeholder-muted focus:outline-none focus:border-accent"
                                />
                                {showPrimaryDropdown && filteredPrimaryPeople.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 border border-subtle rounded-lg bg-surface shadow-lg max-h-48 overflow-y-auto">
                                        {filteredPrimaryPeople.map((person) => (
                                            <button
                                                key={person.id}
                                                type="button"
                                                onClick={() => {
                                                    setPrimaryPersonId(person.id);
                                                    setSearchPrimary('');
                                                    setShowPrimaryDropdown(false);
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-surface-2 text-sm text-primary"
                                            >
                                                {person.firstName} {person.lastName}
                                                {person.refNumber && <span className="text-xs text-secondary ml-2">({person.refNumber})</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {personA && (
                                <div className="mt-2 p-2 bg-warning-soft rounded-lg border border-warning/30">
                                    <div className="text-xs uppercase tracking-wide text-warning font-medium">Vald primär person</div>
                                    <div className="text-sm font-semibold text-primary">{personA.firstName} {personA.lastName}</div>
                                    <div className="text-xs text-secondary">{getLifeSpanString(personA)}</div>
                                </div>
                            )}
                        </div>

                        {/* Secondary Person Selection */}
                        <div>
                            <label className="block text-sm font-medium text-primary mb-2">
                                Sekundär person
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Sök efter person..."
                                    value={searchSecondary}
                                    onChange={(e) => {
                                        setSearchSecondary(e.target.value);
                                        setShowSecondaryDropdown(true);
                                    }}
                                    onFocus={() => setShowSecondaryDropdown(true)}
                                    className="w-full px-3 py-2 border border-subtle rounded-lg bg-surface-2 text-primary placeholder-muted focus:outline-none focus:border-accent"
                                />
                                {showSecondaryDropdown && filteredSecondaryPeople.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 border border-subtle rounded-lg bg-surface shadow-lg max-h-48 overflow-y-auto">
                                        {filteredSecondaryPeople.map((person) => (
                                            <button
                                                key={person.id}
                                                type="button"
                                                onClick={() => {
                                                    setSecondaryPersonId(person.id);
                                                    setSearchSecondary('');
                                                    setShowSecondaryDropdown(false);
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-surface-2 text-sm text-primary"
                                            >
                                                {person.firstName} {person.lastName}
                                                {person.refNumber && <span className="text-xs text-secondary ml-2">({person.refNumber})</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {personB && (
                                <div className="mt-2 p-2 bg-accent-soft rounded-lg border border-accent/30">
                                    <div className="text-xs uppercase tracking-wide text-accent font-medium">Vald sekundär person</div>
                                    <div className="text-sm font-semibold text-primary">{personB.firstName} {personB.lastName}</div>
                                    <div className="text-xs text-secondary">{getLifeSpanString(personB)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Relationship Result */}
                    {hasBothFocus && advancedRel && (
                        <div className="border-t border-subtle pt-4">
                            <div className="text-center">
                                <div className="inline-flex items-center rounded-full border border-strong bg-accent-soft px-4 py-2 text-accent text-sm uppercase tracking-wide font-medium">
                                    Släktskap
                                </div>
                                <div className="mt-3 text-3xl font-bold text-accent">
                                    {advancedRel?.text || 'Okänd relation'}
                                </div>
                                {advancedRel?.lca && advancedRel.lca.id !== personA.id && advancedRel.lca.id !== personB.id && (
                                    <div className="text-sm text-muted mt-3">
                                        Gemensam ana: <span className="font-semibold text-primary">{advancedRel.lca.firstName} {advancedRel.lca.lastName}</span> {getLifeSpanString(advancedRel.lca)}
                                        {advancedRel.lcaCount > 1 ? ` (+ ${advancedRel.lcaCount - 1} till)` : ''}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 border-t border-subtle pt-4">
                                <RelationshipPath startPerson={personA} endPersonId={personB.id} allPeople={allPeople} />
                            </div>
                        </div>
                    )}

                    {!hasBothFocus && (personA || personB) && (
                        <div className="text-center py-8 text-secondary">
                            Välj både primär och sekundär person för att beräkna släktskap
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-subtle flex justify-end gap-3 shrink-0">
                    <button
                        onClick={() => {
                            setPrimaryPersonId('');
                            setSecondaryPersonId('');
                            setSearchPrimary('');
                            setSearchSecondary('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary hover:bg-surface-2 rounded-lg transition-colors"
                    >
                        Rensa val
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-primary bg-accent-soft hover:bg-accent/20 rounded-lg transition-colors"
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </div>
    );
}
