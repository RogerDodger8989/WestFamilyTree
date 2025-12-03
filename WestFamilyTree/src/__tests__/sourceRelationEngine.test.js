import { describe, it, expect } from 'vitest';
import suggestRelationsFromSource from '../sourceRelationEngine.js';

function makePerson(id, birthYear, place = 'Socknen', extraEvents = []) {
  const events = [];
  if (birthYear) events.push({ id: `e_birth_${id}`, type: 'Födelse', date: `${birthYear}`, place, sources: ['src1'] });
  return { id, firstName: `Namn${id}`, lastName: `Efternamn${id}`, events: events.concat(extraEvents || []) };
}

describe('suggestRelationsFromSource', () => {
  it('finner parent för rimlig åldersskillnad', () => {
    const src = { id: 'src1' };
    const p1 = makePerson('p1', 1850);
    const p2 = makePerson('p2', 1875);
    const res = suggestRelationsFromSource(src, [p1, p2], { relations: [] });
    const found = res.find(r => r.fromPersonId === 'p1' && r.toPersonId === 'p2' && r.type === 'parent');
    expect(found).toBeTruthy();
    expect(found.suspicious).toEqual([]);
  });

  it('flaggar stor åldersskillnad som suspicious', () => {
    const src = { id: 'src1' };
    const p1 = makePerson('pA', 1820);
    const p2 = makePerson('pB', 1875);
    const res = suggestRelationsFromSource(src, [p1, p2], { relations: [] });
    const found = res.find(r => r.fromPersonId === 'pA' && r.toPersonId === 'pB' && r.type === 'parent');
    expect(found).toBeTruthy();
    expect(found.suspicious).toContain('large_age_gap');
  });

  it('flaggar modern som för ung', () => {
    const src = { id: 'src1' };
    // modern född 1810, barn 1822 -> modern 12 år vid födseln
    const mother = makePerson('mY', 1810);
    mother.gender = 'female';
    const child = makePerson('cY', 1822);
    const res = suggestRelationsFromSource(src, [mother, child], { relations: [] });
    const found = res.find(r => r.fromPersonId === 'mY' && r.toPersonId === 'cY' && r.type === 'parent');
    expect(found).toBeTruthy();
    expect(found.suspicious).toContain('mother_too_young');
    expect(found.suspiciousMessages).toContain('Modern var för ung (under normal minimiålder)');
  });

  it('flaggar barn fött efter moderns död', () => {
    const src = { id: 'src1' };
    const deathEvt = { id: 'e_death_m', type: 'Död', date: '1850', place: 'Socknen', sources: ['src1'] };
    const mother = makePerson('mD', 1820, 'Socknen', [deathEvt]);
    mother.gender = 'female';
    const child = makePerson('cD', 1851);
    const res = suggestRelationsFromSource(src, [mother, child], { relations: [] });
    const found = res.find(r => r.fromPersonId === 'mD' && r.toPersonId === 'cD' && r.type === 'parent');
    expect(found).toBeTruthy();
    expect(found.suspicious).toContain('born_after_mother_death');
    expect(found.suspiciousMessages).toContain('Barn fött efter moderns död');
  });

  it('flaggar stor ålderskillnad mellan makar', () => {
    const src = { id: 'src1' };
    const ev = { id: 'ev_vigsel_big', type: 'Vigsel', date: '1890', place: 'Församlingen', sources: ['src1'] };
    const older = makePerson('o1', 1830, 'Församlingen', [ev]);
    const younger = makePerson('y1', 1868, 'Församlingen', [ev]); // 38 years diff
    const res = suggestRelationsFromSource(src, [older, younger], { relations: [] });
    const found = res.find(r => r.fromPersonId === 'o1' && r.toPersonId === 'y1' && r.type === 'spouse');
    expect(found).toBeTruthy();
    expect(found.suspicious).toContain('large_spousal_age_gap');
    expect(found.suspiciousMessages).toContain('Stor ålderskillnad mellan makar (>=30 år)');
  });

  it('flaggar stor åldersskillnad för syskon', () => {
    const src = { id: 'src1' };
    const p1 = makePerson('s1', 1860, 'Byn');
    const p2 = makePerson('s2', 1872, 'Byn');
    const res = suggestRelationsFromSource(src, [p1, p2], { relations: [] });
    const found = res.find(r => r.fromPersonId === 's1' && r.toPersonId === 's2' && r.type === 'sibling');
    expect(found).toBeTruthy();
    // diff = 12 -> borderline; our engine flags >=10 for sibling large gap
    expect(found.suspicious).toContain('large_age_gap_sibling');
  });

  it('upptäcker vigsel som spouse', () => {
    const src = { id: 'src1' };
    const ev = { id: 'ev_vigsel', type: 'Vigsel', date: '1880', place: 'Församlingen', sources: ['src1'] };
    const p1 = makePerson('m1', 1855, 'Församlingen', [ev]);
    const p2 = makePerson('m2', 1853, 'Församlingen', [ev]);
    const res = suggestRelationsFromSource(src, [p1, p2], { relations: [] });
    const found = res.find(r => r.fromPersonId === 'm1' && r.toPersonId === 'm2' && r.type === 'spouse');
    expect(found).toBeTruthy();
  });

  it('föreslår inte parent/child om barnet är fött före föräldern (kontradiktion)', () => {
    const src = { id: 'src1' };
    const parent = makePerson('par', 1900);
    const child = makePerson('ch', 1890);
    const res = suggestRelationsFromSource(src, [parent, child], { relations: [] });
    // inget parent/child mellan dessa två
    const bad = res.find(r => (r.type === 'parent' || r.type === 'child') && ((r.fromPersonId === 'par' && r.toPersonId === 'ch') || (r.fromPersonId === 'ch' && r.toPersonId === 'par')));
    expect(bad).toBeUndefined();
  });
});
