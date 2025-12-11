import React, { useMemo } from 'react';
import { useApp } from './AppContext';
import { computeSuggestions } from './suggestionEngine';

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
      // convert to previous shape: { pair, score }
      return computed.map(c => ({ pair: c.pair, score: c.score, breakdown: c.breakdown }));
    } catch (e) {
      return [];
    }
  }, [allPeople, dbData]);

  return (
    <div className="card p-3 bg-slate-800 border border-slate-700" style={{ minHeight: 220 }}>
      <div className="font-medium mb-2 text-slate-200">Förslag</div>
      <div className="text-xs text-slate-400 mb-2">Automatch baserat på namn, födelseår och efternamn</div>
      <div style={{ maxHeight: 440, overflow: 'auto' }}>
        {suggestions.length === 0 && <div className="text-sm text-slate-400">Inga förslag</div>}
        {suggestions.map((s, i) => (
          <div key={i} className="p-2 border-b border-slate-600 hover:bg-slate-700 cursor-pointer" onClick={() => onOpenPair && onOpenPair(s.pair)}>
            <div className="flex justify-between">
              <div>
                <div className="font-semibold text-slate-200">{s.pair[0].firstName} {s.pair[0].lastName} ↔ {s.pair[1].firstName} {s.pair[1].lastName}</div>
                <div className="text-xs text-slate-400">REF: {s.pair[0].refNumber} · {s.pair[1].refNumber}</div>
                {s.breakdown && (
                  <div className="text-xs text-slate-400 mt-1">Namn: {Math.round(s.breakdown.name*100)}% · Liv: {Math.round(s.breakdown.life*100)}% · Plats: {Math.round(s.breakdown.place*100)}% · Källor: {Math.round(s.breakdown.sources*100)}%</div>
                )}
              </div>
              <div className="text-sm text-slate-300">{Math.round(s.score * 100)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
