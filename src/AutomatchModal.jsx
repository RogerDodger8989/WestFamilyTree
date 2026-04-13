import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { useApp } from './AppContext';
import { computeSuggestions } from './suggestionEngine';
import MediaImage from './components/MediaImage';
import { getAvatarImageStyle } from './imageUtils';
import { ArrowRightLeft, User } from 'lucide-react';

function getLifeSpan(p) {
  try {
    const birthEvent = (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('födel')) || (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('birth'));
    const deathEvent = (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('död')) || (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('death'));
    
    const birth = birthEvent?.date ? birthEvent.date.toString().match(/(\d{4})/) : null;
    const death = deathEvent?.date ? deathEvent.date.toString().match(/(\d{4})/) : null;
    
    const birthYear = birth ? Number(birth[1]) : null;
    const deathYear = death ? Number(death[1]) : null;
    
    if (!birthYear && !deathYear) return null;
    if (birthYear && !deathYear) return `f. ${birthYear}`;
    if (!birthYear && deathYear) return `d. ${deathYear}`;
    return `${birthYear}-${deathYear}`;
  } catch (e) {
    return null;
  }
}

function getScoreBadgeStyle(score) {
  if (score > 0.9) return 'bg-success text-on-accent border border-success';
  if (score > 0.7) return 'bg-warning text-on-accent border border-warning';
  return 'bg-surface-2 text-primary border border-subtle';
}

export default function AutomatchModal({ isOpen, onClose, allPeople = [], onOpenPair }) {
  const { dbData } = useApp();
  const suggestions = useMemo(() => {
    try {
      const computed = computeSuggestions(allPeople, dbData || {}, { maxResults: 60 });
      return computed.map(c => ({ pair: c.pair, score: c.score, breakdown: c.breakdown }));
    } catch (e) {
      return [];
    }
  }, [allPeople, dbData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface border border-subtle rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle shrink-0">
          <div>
            <h2 className="text-xl font-bold text-primary">Automatch-förslag</h2>
            <p className="text-sm text-secondary mt-1">Automatch baserat på namn, födelseår och efternamn</p>
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
          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-secondary">Inga förslag</div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s, i) => {
                const p1 = s.pair[0];
                const p2 = s.pair[1];
                const lifeSpan1 = getLifeSpan(p1);
                const lifeSpan2 = getLifeSpan(p2);
                const scoreBadgeClass = getScoreBadgeStyle(s.score);

                return (
                  <div
                    key={i}
                    onClick={() => onOpenPair && onOpenPair(s.pair)}
                    className="p-4 bg-surface-2 border border-subtle hover:border-accent rounded-lg cursor-pointer transition-all hover:shadow-md hover:bg-surface-2 hover:border-accent"
                  >
                    {/* Score Badge */}
                    <div className="flex justify-between items-start mb-3">
                      <div className={`text-sm font-bold px-2.5 py-1 rounded ${scoreBadgeClass}`}>
                        {Math.round(s.score * 100)}% match
                      </div>
                    </div>

                    {/* Person Pair Cards */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      {/* Person 1 */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface border border-subtle overflow-hidden flex items-center justify-center">
                          {p1.media && p1.media.length > 0 ? (
                            <MediaImage
                              media={p1.media[0]}
                              style={getAvatarImageStyle(p1.media[0])}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User size={18} className="text-secondary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-primary truncate">
                            {p1.firstName} {p1.lastName}
                          </div>
                          <div className="text-xs text-secondary">
                            {p1.refNumber}{lifeSpan1 && ` · ${lifeSpan1}`}
                          </div>
                        </div>
                      </div>

                      {/* Arrow in Middle */}
                      <div className="flex-shrink-0 text-muted">
                        <ArrowRightLeft size={16} />
                      </div>

                      {/* Person 2 */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface border border-subtle overflow-hidden flex items-center justify-center">
                          {p2.media && p2.media.length > 0 ? (
                            <MediaImage
                              media={p2.media[0]}
                              style={getAvatarImageStyle(p2.media[0])}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User size={18} className="text-secondary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-primary truncate">
                            {p2.firstName} {p2.lastName}
                          </div>
                          <div className="text-xs text-secondary">
                            {p2.refNumber}{lifeSpan2 && ` · ${lifeSpan2}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Tags */}
                    {s.breakdown && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {s.breakdown.name !== undefined && (
                          <span className="px-2 py-1 bg-surface text-primary rounded border border-subtle">
                            Namn: {Math.round(s.breakdown.name * 100)}%
                          </span>
                        )}
                        {s.breakdown.life !== undefined && (
                          <span className="px-2 py-1 bg-surface text-primary rounded border border-subtle">
                            Liv: {Math.round(s.breakdown.life * 100)}%
                          </span>
                        )}
                        {s.breakdown.place !== undefined && (
                          <span className="px-2 py-1 bg-surface text-primary rounded border border-subtle">
                            Plats: {Math.round(s.breakdown.place * 100)}%
                          </span>
                        )}
                        {s.breakdown.sources !== undefined && (
                          <span className="px-2 py-1 bg-surface text-primary rounded border border-subtle">
                            Källor: {Math.round(s.breakdown.sources * 100)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
