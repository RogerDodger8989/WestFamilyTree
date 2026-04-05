import React, { useMemo } from 'react';
import { useApp } from './AppContext';
import { computeSuggestions } from './suggestionEngine';
import MediaImage from './components/MediaImage';
import { getAvatarImageStyle } from './imageUtils';
import { ArrowRightLeft, User } from 'lucide-react';

function normalizeName(p) {
  const fn = (p.firstName || '').toString().toLowerCase().replace(/[^a-z0-9åäö]/g, '').trim();
  const ln = (p.lastName || '').toString().toLowerCase().replace(/[^a-z0-9åäö]/g, '').trim();
  return `${fn} ${ln}`.trim();
}

function getBirthYear(p) {
  try {
    const ev = (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('födel')) || (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('birth'));
    if (!ev || !ev.date) return null;
    const m = ev.date.toString().match(/(\d{4})/);
    return m ? Number(m[1]) : null;
  } catch (e) { return null; }
}

function getDeathYear(p) {
  try {
    const ev = (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('död')) || (p.events || []).find(e => e.type && e.type.toString().toLowerCase().includes('death'));
    if (!ev || !ev.date) return null;
    const m = ev.date.toString().match(/(\d{4})/);
    return m ? Number(m[1]) : null;
  } catch (e) { return null; }
}

function getLifeSpan(p) {
  const birth = getBirthYear(p);
  const death = getDeathYear(p);
  if (!birth && !death) return null;
  if (birth && !death) return `f. ${birth}`;
  if (!birth && death) return `d. ${death}`;
  return `${birth}–${death}`;
}

function getScoreBadgeStyle(score) {
  if (score > 0.9) return 'bg-green-900 text-green-100 border border-green-700';
  if (score > 0.7) return 'bg-yellow-900 text-yellow-100 border border-yellow-700';
  return 'bg-slate-700 text-slate-100 border border-slate-600';
}

function levenshtein(a = '', b = '') {
  a = a || '';
  b = b || '';
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const v0 = new Array(bl + 1);
  const v1 = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) v0[j] = j;
  for (let i = 0; i < al; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < bl; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= bl; j++) v0[j] = v1[j];
  }
  return v1[bl];
}

function similarityScore(s1, s2) {
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  const a = s1.toString().toLowerCase();
  const b = s2.toString().toLowerCase();
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - (dist / maxLen);
}

export default function SuggestionsPanel({ allPeople = [], onOpenPair }) {
  const { dbData } = useApp();
  const suggestions = useMemo(() => {
    try {
      const computed = computeSuggestions(allPeople, dbData || {}, { maxResults: 60 });
      return computed.map(c => ({ pair: c.pair, score: c.score, breakdown: c.breakdown }));
    } catch (e) {
      return [];
    }
  }, [allPeople, dbData]);

  return (
    <div className="card p-3 bg-slate-800 border border-slate-700" style={{ minHeight: 220 }}>
      <div className="font-medium mb-1 text-slate-200">Förslag</div>
      <div className="text-xs text-slate-400 mb-3">Automatch baserat på namn, födelseår och efternamn</div>
      <div style={{ maxHeight: 440, overflow: 'auto' }}>
        {suggestions.length === 0 && <div className="text-sm text-slate-400">Inga förslag</div>}
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
              className="mb-3 p-3 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg cursor-pointer transition-all hover:shadow-lg hover:bg-slate-850"
            >
              {/* Score Badge */}
              <div className="flex justify-between items-start mb-2">
                <div className={`text-sm font-bold px-2 py-1 rounded ${scoreBadgeClass}`}>
                  {Math.round(s.score * 100)}% match
                </div>
              </div>

              {/* Person Pair Cards */}
              <div className="flex items-center justify-between gap-3 mb-3">
                {/* Person 1 */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 border border-slate-600 overflow-hidden flex items-center justify-center">
                    {p1.media && p1.media.length > 0 ? (
                      <MediaImage
                        media={p1.media[0]}
                        style={getAvatarImageStyle(p1.media[0])}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={18} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {p1.firstName} {p1.lastName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p1.refNumber}{lifeSpan1 && ` · ${lifeSpan1}`}
                    </div>
                  </div>
                </div>

                {/* Arrow in Middle */}
                <div className="flex-shrink-0 text-slate-500">
                  <ArrowRightLeft size={16} />
                </div>

                {/* Person 2 */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 border border-slate-600 overflow-hidden flex items-center justify-center">
                    {p2.media && p2.media.length > 0 ? (
                      <MediaImage
                        media={p2.media[0]}
                        style={getAvatarImageStyle(p2.media[0])}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={18} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {p2.firstName} {p2.lastName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p2.refNumber}{lifeSpan2 && ` · ${lifeSpan2}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdown Tags */}
              {s.breakdown && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {s.breakdown.name !== undefined && (
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">
                      Namn: {Math.round(s.breakdown.name * 100)}%
                    </span>
                  )}
                  {s.breakdown.life !== undefined && (
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">
                      Liv: {Math.round(s.breakdown.life * 100)}%
                    </span>
                  )}
                  {s.breakdown.place !== undefined && (
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">
                      Plats: {Math.round(s.breakdown.place * 100)}%
                    </span>
                  )}
                  {s.breakdown.sources !== undefined && (
                    <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">
                      Källor: {Math.round(s.breakdown.sources * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
