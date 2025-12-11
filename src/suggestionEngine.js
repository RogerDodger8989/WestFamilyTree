// Lightweight suggestion engine for merge candidates
// Computes weighted scores from several heuristics: name similarity, life overlap,
// place overlap, shared sources and sibling inference via relations.

// NOTE: keep implementation dependency-free and conservative to avoid false duplicates.

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

function similarityScore(a = '', b = '') {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const A = a.toString().toLowerCase();
  const B = b.toString().toLowerCase();
  const dist = levenshtein(A, B);
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 1;
  return 1 - (dist / maxLen);
}

function normalizeNameTokens(p) {
  const fn = (p.firstName || '').toString().toLowerCase().replace(/[^a-z0-9åäö\s]/g, ' ').trim();
  const ln = (p.lastName || '').toString().toLowerCase().replace(/[^a-z0-9åäö]/g, '').trim();
  const fnTokens = fn.split(/\s+/).filter(Boolean);
  return { firstFull: fnTokens.join(' '), firstTokens: fnTokens, surname: ln };
}

function getBirthYear(p) {
  try {
    const ev = (p.events || []).find(e => e.type && /födel|birth/i.test(e.type)) || (p.events || []).find(e => e.type && /födel|birth/i.test(e.type));
    if (!ev || !ev.date) return null;
    const m = ev.date.toString().match(/(\d{4})/);
    return m ? Number(m[1]) : null;
  } catch (e) { return null; }
}

function getDeathYear(p) {
  try {
    const ev = (p.events || []).find(e => e.type && /död|death/i.test(e.type));
    if (!ev || !ev.date) return null;
    const m = ev.date.toString().match(/(\d{4})/);
    return m ? Number(m[1]) : null;
  } catch (e) { return null; }
}

function normalizePlaceStrings(p) {
  const places = [];
  try {
    for (const ev of (p.events || [])) {
      if (!ev.place) continue;
      let s = ev.place.toString().toLowerCase().trim();
      s = s.replace(/[.,]/g, '');
      // strip common words
      s = s.replace(/församling|för|socken|kommun|stad|län/g, '').trim();
      if (s) places.push(s);
    }
  } catch (e) {}
  return Array.from(new Set(places));
}

function placeScore(aPlaces, bPlaces) {
  if (!aPlaces || !bPlaces) return 0;
  const shared = aPlaces.filter(x => bPlaces.includes(x));
  if (shared.length === 0) return 0;
  const union = new Set([...aPlaces, ...bPlaces]).size;
  return shared.length / union;
}

function lifeOverlapScore(a, b) {
  const aB = getBirthYear(a); const aD = getDeathYear(a);
  const bB = getBirthYear(b); const bD = getDeathYear(b);
  if (aB && aD && bB && bD) {
    const s1 = aB; const e1 = aD; const s2 = bB; const e2 = bD;
    const overlap = Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
    const union = Math.max(e1, e2) - Math.min(s1, s2);
    return union > 0 ? overlap / union : 0;
  }
  if (aB && bB) {
    const diff = Math.abs(aB - bB);
    if (diff <= 3) return 1;
    if (diff <= 10) return 0.8;
    if (diff <= 20) return 0.5;
    return 0.2;
  }
  return 0.2; // default low when no reliable dates
}

function sharedSourcesScore(a, b) {
  const aSrc = (a.sources || []).map(s => s.id || s).filter(Boolean);
  const bSrc = (b.sources || []).map(s => s.id || s).filter(Boolean);
  if (aSrc.length === 0 || bSrc.length === 0) return 0;
  const shared = aSrc.filter(x => bSrc.includes(x)).length;
  return Math.min(1, shared / 3);
}

function siblingInferenceScore(a, b, dbData) {
  try {
    const rels = dbData && dbData.relations ? dbData.relations : [];
    const aParents = rels.filter(r => !r._archived && (r.type || '').toString().toLowerCase().includes('parent') && (r.fromPersonId === a.id || r.toPersonId === a.id)).map(r => (r.fromPersonId === a.id ? r.toPersonId : r.fromPersonId));
    const bParents = rels.filter(r => !r._archived && (r.type || '').toString().toLowerCase().includes('parent') && (r.fromPersonId === b.id || r.toPersonId === b.id)).map(r => (r.fromPersonId === b.id ? r.toPersonId : r.fromPersonId));
    const shared = aParents.filter(p => bParents.includes(p));
    return shared.length > 0 ? 0.9 : 0;
  } catch (e) { return 0; }
}

function nameScore(a, b) {
  const na = normalizeNameTokens(a); const nb = normalizeNameTokens(b);
  // strong surname match gives baseline
  if (na.surname && nb.surname && na.surname === nb.surname) {
    const firstSim = similarityScore(na.firstFull, nb.firstFull);
    return Math.max(0.6, 0.6 + 0.4 * firstSim);
  }
  // otherwise combine surname sim and firstname sim
  const surnameSim = similarityScore(na.surname, nb.surname);
  const firstSim = similarityScore(na.firstFull, nb.firstFull);
  return Math.max(0, 0.3 * surnameSim + 0.7 * firstSim);
}

export function computeSuggestions(allPeople = [], dbData = {}, options = {}) {
  const W = Object.assign({ name: 0.45, life: 0.2, place: 0.12, sources: 0.15, sibling: 0.08 }, options.weights || {});
  const maxResults = options.maxResults || 60;

  // Precompute normalized fields
  const pre = allPeople.map(p => ({
    id: p.id,
    person: p,
    nameTokens: normalizeNameTokens(p),
    birth: getBirthYear(p),
    death: getDeathYear(p),
    places: normalizePlaceStrings(p),
    sources: (p.sources || []).map(s => s.id || s).filter(Boolean)
  }));

  const pairs = [];
  const seen = new Set();

  // Candidate generation: coarse buckets by normalized surname or birth-year+surname
  const buckets = new Map();
  for (const item of pre) {
    const s = (item.nameTokens.surname || '').toString();
    const key = `${item.birth || 'x'}::${s}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
    const nKey = s || ('id:' + item.id);
    if (!buckets.has(nKey)) buckets.set(nKey, []);
    buckets.get(nKey).push(item);
  }

  const bucketLists = Array.from(buckets.values());
  for (const bl of bucketLists) {
    if (bl.length < 2) continue;
    for (let i = 0; i < bl.length; i++) {
      for (let j = i + 1; j < bl.length; j++) {
        const a = bl[i].person; const b = bl[j].person;
        const key = [a.id, b.id].sort().join('::');
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([a, b]);
      }
    }
  }

  // As fallback, generate pairs among allPeople if dataset small
  if (pairs.length === 0 && allPeople.length <= 200) {
    for (let i = 0; i < allPeople.length; i++) for (let j = i + 1; j < allPeople.length; j++) pairs.push([allPeople[i], allPeople[j]]);
  }

  const scored = pairs.map(pair => {
    const a = pair[0]; const b = pair[1];
    const ns = nameScore(a, b);
    const ls = lifeOverlapScore(a, b);
    const ps = placeScore(normalizePlaceStrings(a), normalizePlaceStrings(b));
    const ss = sharedSourcesScore(a, b);
    const sib = siblingInferenceScore(a, b, dbData);
    const total = (W.name * ns) + (W.life * ls) + (W.place * ps) + (W.sources * ss) + (W.sibling * sib);
    return { pair: [a, b], score: Math.min(1, Math.max(0, total)), breakdown: { name: ns, life: ls, place: ps, sources: ss, sibling: sib } };
  });

  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, maxResults);
}

export default { computeSuggestions };
