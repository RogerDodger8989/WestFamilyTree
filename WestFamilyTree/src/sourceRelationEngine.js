import { extractYear, placeSimilarity, matchEvents } from './eventMatchUtils.js';

// Configuration thresholds for the suggestion engine.
// Tweak these values to change sensitivity. They are kept near the top
// so they are easy to adjust or expose to a settings UI later.
// default thresholds (can be overridden by `localStorage.relationEngineConfig`)
const DEFAULTS = {
  PARENT_MIN_YEARS: 15,
  PARENT_MAX_YEARS: 60,
  PARENT_LOOSE_MIN: 11,
  LARGE_AGE_GAP: 50,
  SIBLING_LARGE_GAP: 10,
  SPOUSAL_LARGE_GAP: 30,
  POSTHUMOUS_TOLERANCE: 1
};

function readConfig() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULTS;
    const raw = window.localStorage.getItem('relationEngineConfig');
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch (e) {
    return DEFAULTS;
  }
}

// Conservative relation suggestions from a single source.
// Looks at people linked to the source and suggests parent/child/spouse pairs.
export function suggestRelationsFromSource(source, people = [], dbData = {}) {
  if (!source || !people || people.length === 0) return [];
  const sourceId = source.id;
  // Find people connected to this source (via any event.sources)
  const connected = people.filter(p => (p.events || []).some(e => (e.sources || []).includes(sourceId)));
  const existingRels = new Set((dbData.relations || []).filter(r => !r._archived).map(r => `${r.fromPersonId}|${r.toPersonId}|${(r.type||'').toLowerCase()}`));

  const proposals = [];

  // Helper to push candidate, avoid duplicates
  function pushCandidate(fromId, toId, type, confidence, reasons = [], suspicious = []) {
    if (!fromId || !toId || fromId === toId) return;
    const key = `${fromId}|${toId}|${type}`;
    if (existingRels.has(key)) return; // skip already existing
    if (proposals.some(p => p.fromPersonId === fromId && p.toPersonId === toId && p.type === type)) return;
    // Map suspicious keys to Swedish messages for UI convenience
    const translations = {
      date_contradiction: 'Datumkontradiktion: förälder yngre än barn',
      large_age_gap: 'Stor åldersskillnad (>=50 år)',
      large_age_gap_sibling: 'Stor åldersskillnad för syskon (>=10 år)',
      large_spousal_age_gap: 'Stor ålderskillnad mellan makar (>=30 år)',
      parent_too_young: 'Förälder verkar för ung',
      parent_too_old: 'Förälder verkar ovanligt gammal',
      mother_too_young: 'Modern var för ung (under normal minimiålder)',
      mother_too_old: 'Modern var ovanligt gammal vid födseln',
      born_after_mother_death: 'Barn fött efter moderns död',
      child_after_father_death: 'Barn fött långt efter faderns död (möjlig posthumous varning)'
    };
    const suspiciousMessages = (suspicious || []).map(k => translations[k] || k);
    proposals.push({ fromPersonId: fromId, toPersonId: toId, type, confidence: Math.round(confidence * 100) / 100, reasons, suspicious, suspiciousMessages, sourceId });
  }

  // Precompute birth years and primary places
  const meta = new Map();
  for (const p of connected) {
    const birthEvt = (p.events || []).find(e => (e.type || '').toString().toLowerCase().includes('föd'));
    const deathEvt = (p.events || []).find(e => (e.type || '').toString().toLowerCase().includes('död'));
    const birthYear = birthEvt ? extractYear(birthEvt.date) : null;
    const deathYear = deathEvt ? extractYear(deathEvt.date) : null;
    const place = birthEvt?.place || (p.events && p.events[0] && p.events[0].place) || '';
    meta.set(p.id, { person: p, birthYear, deathYear, place, events: p.events || [] });
  }

  // Pairs
  for (let i = 0; i < connected.length; i++) {
    for (let j = 0; j < connected.length; j++) {
      if (i === j) continue;
      const A = connected[i]; const B = connected[j];
      const ma = meta.get(A.id); const mb = meta.get(B.id);

      // 1) Spouse detection: shared Vigsel / Vigsel-like events
      const cfg = readConfig();
      const matched = matchEvents(ma.events, mb.events, { threshold: 0.5 }).filter(p => p.a && p.b && (p.a.type || '').toString().toLowerCase().includes('vigsel'));
      if (matched && matched.length > 0) {
        // Propose spouse both directions as a single relation type 'spouse'
        const suspicious = [];
        // If birth years available, flag large spousal age gap
        if (ma.birthYear && mb.birthYear) {
          const sDiff = Math.abs(ma.birthYear - mb.birthYear);
          if (sDiff >= cfg.SPOUSAL_LARGE_GAP) suspicious.push('large_spousal_age_gap');
        }
        pushCandidate(A.id, B.id, 'spouse', 0.9, ['shared_vigsel'], suspicious);
        continue; // skip other suggestions for this ordered pair
      }

      // 2) Parent/child inference by birth year difference (correct year math)
      const ya = ma.birthYear; const yb = mb.birthYear;
      if (ya && yb) {
        // ageDiff = how many years older A is than B (positive means A older)
        const ageDiff = yb - ya;
        // If A is older by PARENT_MIN_YEARS..PARENT_MAX_YEARS, suggest A -> parent -> B
        if (ageDiff >= cfg.PARENT_MIN_YEARS && ageDiff <= cfg.PARENT_MAX_YEARS) {
          const base = 0.55 + ((Math.min(ageDiff, 60) - 15) / 45) * 0.35; // 0.55-0.9
          const placeBoost = placeSimilarity(ma.place, mb.place) * 0.2;
          const conf = Math.min(0.98, base + placeBoost);
          const suspicious = [];
          // If birth years contradict (parent not older) mark contradiction
          if (!(ya < yb)) suspicious.push('date_contradiction');
          // Large age gap (>=50) mark as suspicious
            if (ageDiff >= cfg.LARGE_AGE_GAP) suspicious.push('large_age_gap');
          // Parent age at child's birth
          const parentAgeAtBirth = ageDiff; // A's age when B born
          if (parentAgeAtBirth < 12) suspicious.push('parent_too_young');
          if (parentAgeAtBirth > 80) suspicious.push('parent_too_old');
          // If we can detect gender, add mother-specific flags
          const g = (ma.person && (ma.person.gender || ma.person.sex || ma.person.genderIdentity) || '').toString().toLowerCase();
          const isFemale = ['female', 'f', 'k', 'kvinna', 'woman'].some(x => g.includes(x));
          if (isFemale) {
            if (parentAgeAtBirth < 13) suspicious.push('mother_too_young');
            if (parentAgeAtBirth > 50) suspicious.push('mother_too_old');
          }
          // Child born after parent's death
          if (ma.deathYear && mb.birthYear) {
            if (mb.birthYear > ma.deathYear) {
              // If mother died before child's birth, impossible
              if (isFemale) suspicious.push('born_after_mother_death');
              else {
                // father could have posthumous child within configured tolerance
                if (mb.birthYear > ma.deathYear + cfg.POSTHUMOUS_TOLERANCE) suspicious.push('child_after_father_death');
              }
            }
          }
          pushCandidate(A.id, B.id, 'parent', conf, ['age_difference', `ageDiff:${ageDiff}`, `placeSim:${placeSimilarity(ma.place,mb.place).toFixed(2)}`], suspicious);
        }
        // If A is older by PARENT_LOOSE_MIN..(PARENT_MIN_YEARS-1) years, low-confidence suggestion
        else if (ageDiff >= cfg.PARENT_LOOSE_MIN && ageDiff < cfg.PARENT_MIN_YEARS) {
          const conf = 0.25 + placeSimilarity(ma.place, mb.place) * 0.1;
          const suspicious = ['parent_too_young'];
          const g = (ma.person && (ma.person.gender || ma.person.sex || ma.person.genderIdentity) || '').toString().toLowerCase();
          const isFemale = ['female', 'f', 'k', 'kvinna', 'woman'].some(x => g.includes(x));
          if (isFemale) suspicious.push('mother_too_young');
          // Child born after parent's death
          if (ma.deathYear && mb.birthYear && mb.birthYear > ma.deathYear) {
            if (isFemale) suspicious.push('born_after_mother_death'); else if (mb.birthYear > ma.deathYear + cfg.POSTHUMOUS_TOLERANCE) suspicious.push('child_after_father_death');
          }
          pushCandidate(A.id, B.id, 'parent', conf, ['age_difference', `ageDiff:${ageDiff}`], suspicious);
        }
        // Conversely, if A is much younger, suggest child (A -> child -> B)
        const reverseAgeDiff = ya - yb; // how many years older B is than A
        if (reverseAgeDiff >= cfg.PARENT_MIN_YEARS && reverseAgeDiff <= cfg.PARENT_MAX_YEARS) {
          const base = 0.55 + ((Math.min(reverseAgeDiff, 60) - 15) / 45) * 0.35;
          const placeBoost = placeSimilarity(ma.place, mb.place) * 0.2;
          const conf = Math.min(0.98, base + placeBoost);
          const suspicious = [];
          if (!(yb < ya)) suspicious.push('date_contradiction');
          if (reverseAgeDiff >= cfg.LARGE_AGE_GAP) suspicious.push('large_age_gap');
          const parentAgeAtBirth = reverseAgeDiff; // B's age when A born (if B is parent)
          if (parentAgeAtBirth < 12) suspicious.push('parent_too_young');
          if (parentAgeAtBirth > 80) suspicious.push('parent_too_old');
          const g2 = (mb.person && (mb.person.gender || mb.person.sex || mb.person.genderIdentity) || '').toString().toLowerCase();
          const isFemale2 = ['female', 'f', 'k', 'kvinna', 'woman'].some(x => g2.includes(x));
          if (isFemale2) {
            if (parentAgeAtBirth < 13) suspicious.push('mother_too_young');
            if (parentAgeAtBirth > 50) suspicious.push('mother_too_old');
          }
          // Child born after parent's death (reverse direction: parent is B)
          if (mb.deathYear && ma.birthYear) {
            if (ma.birthYear > mb.deathYear) {
              if (isFemale2) suspicious.push('born_after_mother_death');
              else {
                if (ma.birthYear > mb.deathYear + cfg.POSTHUMOUS_TOLERANCE) suspicious.push('child_after_father_death');
              }
            }
          }
          pushCandidate(A.id, B.id, 'child', conf, ['age_difference', `ageDiff:${-reverseAgeDiff}`], suspicious);
        }
        else if (reverseAgeDiff >= cfg.PARENT_LOOSE_MIN && reverseAgeDiff < cfg.PARENT_MIN_YEARS) {
          const conf = 0.25 + placeSimilarity(ma.place, mb.place) * 0.1;
          const suspicious = ['parent_too_young'];
          const g2 = (mb.person && (mb.person.gender || mb.person.sex || mb.person.genderIdentity) || '').toString().toLowerCase();
          const isFemale2 = ['female', 'f', 'k', 'kvinna', 'woman'].some(x => g2.includes(x));
          if (isFemale2) suspicious.push('mother_too_young');
          if (mb.deathYear && ma.birthYear && ma.birthYear > mb.deathYear) {
            if (isFemale2) suspicious.push('born_after_mother_death'); else if (ma.birthYear > mb.deathYear + cfg.POSTHUMOUS_TOLERANCE) suspicious.push('child_after_father_death');
          }
          pushCandidate(A.id, B.id, 'child', conf, ['age_difference', `ageDiff:${-reverseAgeDiff}`], suspicious);
        }
      }

      // 3) Sibling inference: similar birth years within 0-12 years and same place
      if (ya && yb) {
        const diff = Math.abs(ya - yb);
        if (diff <= 12) {
            const placeSim = placeSimilarity(ma.place, mb.place);
            if (placeSim >= 0.4) {
              const conf = 0.45 + placeSim * 0.4; // moderate confidence
              const suspicious = diff >= 10 ? ['large_age_gap_sibling'] : [];
              pushCandidate(A.id, B.id, 'sibling', conf, ['similar_birth', `diff:${diff}`, `placeSim:${placeSim.toFixed(2)}`], suspicious);
            }
          }
      }
    }
  }

  // Sort proposals by confidence desc
  return proposals.sort((a, b) => b.confidence - a.confidence);
}

export default suggestRelationsFromSource;
