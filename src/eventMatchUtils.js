// Utilities for date parsing/precision and fuzzy place matching

function parseDateParts(dateStr) {
  if (!dateStr) return { year: null, month: null, day: null };
  const s = dateStr.toString().trim();
  // Try YYYY-MM-DD, YYYY-MM, YYYY
  const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return { year: Number(ymd[1]), month: Number(ymd[2]), day: Number(ymd[3]) };
  const ym = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) return { year: Number(ym[1]), month: Number(ym[2]), day: null };
  const y = s.match(/^(\d{4})$/);
  if (y) return { year: Number(y[1]), month: null, day: null };
  // Try to extract first 4-digit year anywhere
  const yany = s.match(/(\d{4})/);
  if (yany) return { year: Number(yany[1]), month: null, day: null };
  return { year: null, month: null, day: null };
}

function datePrecision(dateStr) {
  if (!dateStr) return 0;
  const parts = parseDateParts(dateStr);
  if (parts.day) return 3;
  if (parts.month) return 2;
  if (parts.year) return 1;
  return 0;
}

function extractYear(dateStr) {
  return parseDateParts(dateStr).year;
}

// Simple place similarity: token overlap after normalization
function normalizePlace(s) {
  if (!s) return '';
  return s.toString().toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/å|ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => t.length > 1) // drop very short tokens
    .join(' ');
}

function placeSimilarity(a, b) {
  if (!a || !b) return 0;
  const na = normalizePlace(a).split(' ');
  const nb = normalizePlace(b).split(' ');
  if (na.length === 0 || nb.length === 0) return 0;
  const setB = new Set(nb);
  let common = 0;
  for (const tok of na) if (setB.has(tok)) common++;
  const score = common / Math.max(na.length, nb.length);
  return Math.min(1, Math.max(0, score));
}

// Match two lists of events with a score using type/date/year/place
function matchEvents(evsA = [], evsB = [], opts = {}) {
  const extractType = (e) => (e && e.type ? e.type.toString().toLowerCase() : '');
  const pairs = [];
  const usedB = new Set();
  for (const ea of evsA) {
    let best = null; let bestScore = 0;
    for (const eb of evsB) {
      if (usedB.has(eb.id)) continue;
      let score = 0;
      const ta = extractType(ea); const tb = extractType(eb);
      if (ta && tb && ta === tb) score += 0.4;
      if ((ea.date || '') === (eb.date || '')) score += 0.45; else {
        const ya = extractYear(ea.date); const yb = extractYear(eb.date);
        if (ya && yb && ya === yb) score += 0.25;
      }
      const placeScore = placeSimilarity(ea.place, eb.place);
      score += 0.15 * placeScore;
      if (score > bestScore) { bestScore = score; best = eb; }
    }
    if (best && bestScore >= (opts.threshold || 0.35)) { pairs.push({ a: ea, b: best, score: bestScore }); usedB.add(best.id); } else { pairs.push({ a: ea, b: null, score: 0 }); }
  }
  for (const eb of evsB) if (!usedB.has(eb.id)) pairs.push({ a: null, b: eb, score: 0 });
  return pairs;
}

export { parseDateParts, datePrecision, extractYear, normalizePlace, placeSimilarity, matchEvents };
