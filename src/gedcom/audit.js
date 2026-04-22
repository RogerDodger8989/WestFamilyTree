/**
 * GEDCOM Import Audit Utility
 * Identifies duplicates, potential matches, and data quality issues.
 */

export function auditGedcomImport(gedcomData, existingPeople = []) {
  const individuals = gedcomData.individuals || [];
  const results = [];

  // Index existing people by normalized name and birth year for fast lookup
  const existingMap = new Map();
  existingPeople.forEach(p => {
    const key = getNameBirthKey(p);
    if (!existingMap.has(key)) existingMap.set(key, []);
    existingMap.get(key).push(p);
  });

  individuals.forEach(ind => {
    const key = getNameBirthKey(ind);
    const matches = existingMap.get(key) || [];
    
    let status = 'NEW';
    let matchedPerson = null;
    let warnings = [];

    // Basic data quality warnings
    if (!ind.firstName && !ind.lastName) warnings.push("Saknar namn");
    const birth = getBirthDate(ind);
    const death = getDeathDate(ind);
    if (birth && death && isDateBefore(death, birth)) {
      warnings.push("Dog före födseln");
    }

    if (matches.length > 0) {
      status = 'DUPLICATE';
      // Pick the best match (for now just the first one)
      matchedPerson = matches[0];

      // Check if they are actually 100% identical
      if (isIdentical(ind, matchedPerson)) {
        status = 'IDENTICAL';
      }
    }

    if (warnings.length > 0 && status === 'NEW') {
      status = 'WARNING';
    }

    results.push({
      id: ind.id,
      status,
      person: ind,
      match: matchedPerson,
      warnings
    });
  });

  return results;
}

function normalize(str) {
  return String(str || '').toLocaleLowerCase('sv').replace(/[^a-zåäö0-9]/g, '').trim();
}

function getNameBirthKey(p) {
  const first = normalize(p.firstName);
  const last = normalize(p.lastName);
  const birthDate = getBirthDate(p);
  const year = birthDate ? birthDate.substring(0, 4) : 'unknown';
  return `${first}|${last}|${year}`;
}

function getBirthDate(p) {
  const ev = (p.events || []).find(e => e.type === 'BIRT' || e.type === 'Födelse');
  return ev ? (ev.date || '') : '';
}

function getDeathDate(p) {
  const ev = (p.events || []).find(e => e.type === 'DEAT' || e.type === 'Död');
  return ev ? (ev.date || '') : '';
}

function isDateBefore(d1, d2) {
  if (d1.length >= 4 && d2.length >= 4) {
    return d1.substring(0, 4) < d2.substring(0, 4);
  }
  return false;
}

function isIdentical(p1, p2) {
  // Compare basic fields
  if (normalize(p1.firstName) !== normalize(p2.firstName)) return false;
  if (normalize(p1.lastName) !== normalize(p2.lastName)) return false;
  if (p1.gender !== p2.gender) return false;

  // Compare event counts
  const evs1 = p1.events || [];
  const evs2 = p2.events || [];
  if (evs1.length !== evs2.length) return false;

  // Simple string comparison of events (could be improved)
  const s1 = JSON.stringify(evs1.sort((a,b) => a.type.localeCompare(b.type)));
  const s2 = JSON.stringify(evs2.sort((a,b) => a.type.localeCompare(b.type)));
  
  return s1 === s2;
}
