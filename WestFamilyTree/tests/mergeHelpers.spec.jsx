import { describe, it, expect } from 'vitest';
import { remapAndDedupeRelations, transferEventsAndLinks } from '../src/mergeHelpers';

describe('remapAndDedupeRelations', () => {
  it('remaps source ids to target and archives self-relations', () => {
    const rels = [
      { id: 'r1', type: 'parent', fromPersonId: 's1', toPersonId: 't' },
      { id: 'r2', type: 'parent', fromPersonId: 's1', toPersonId: 's1' }
    ];
    const out = remapAndDedupeRelations(rels, 't', ['s1'], 'tester');
    const r1 = out.find(r => r.id === 'r1');
    const r2 = out.find(r => r.id === 'r2');
    expect(r1.fromPersonId).toBe('t');
    expect(r1.toPersonId).toBe('t');
    expect(r1._archived).toBe(true); // because became self-relation after remap
    expect(r2._archived).toBe(true);
  });

  it('deduplicates relations keeping first occurrence', () => {
    const rels = [
      { id: 'a', type: 'spouse', fromPersonId: 's1', toPersonId: 't' },
      { id: 'b', type: 'spouse', fromPersonId: 's2', toPersonId: 't' },
      { id: 'c', type: 'spouse', fromPersonId: 's1', toPersonId: 't' }
    ];
    const out = remapAndDedupeRelations(rels, 't', ['s1','s2'], 'tester');
    // After remap, keys will collide and only first occurrences kept (others archived)
    const archived = out.filter(r => r._archived).map(r => r.id);
    expect(archived.length).toBeGreaterThan(0);
  });
});

describe('transferEventsAndLinks', () => {
  it('moves events and links from sources to target and archives sources', () => {
    const people = [
      { id: 't', events: [{ id: 'e1' }], links: { a: '1' } },
      { id: 's1', events: [{ id: 'e2' }], links: { b: '2' } },
      { id: 's2', events: [], links: { a: 'X' } }
    ];
    const out = transferEventsAndLinks(people, 't', ['s1','s2']);
    const target = out.find(p => p.id === 't');
    expect(target.events.some(e => e.id === 'e2')).toBe(true);
    // links: 'a' already exists on target, so s2's 'a' should not overwrite
    expect(target.links.a).toBe('1');
    // s1's 'b' should be copied
    expect(target.links.b).toBe('2');
    // sources archived
    const s1 = out.find(p => p.id === 's1');
    const s2 = out.find(p => p.id === 's2');
    expect(s1._archived).toBe(true);
    expect(s2._archived).toBe(true);
  });
});
