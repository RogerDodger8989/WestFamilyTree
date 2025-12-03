import { describe, it, expect } from 'vitest';
import { simulateMerge } from '../src/mergeUtils';

describe('simulateMerge', () => {
  it('archives self-relations after remap', () => {
    const db = {
      people: [ { id: 't' }, { id: 'a' } ],
      relations: [ { id: 'r1', type: 'parent', fromPersonId: 'a', toPersonId: 't' }, { id: 'r2', type: 'parent', fromPersonId: 'a', toPersonId: 'a' } ]
    };
    const res = simulateMerge(db, 't', ['a']);
    expect(res).toBeTruthy();
    // relation r2 becomes self-relation (a -> a) and should be archived
    const archived = res.archivedList.map(x => x.id);
    expect(archived).toContain('r2');
  });

  it('deduplicates relations after remap', () => {
    const db = {
      people: [ { id: 't' }, { id: 'b' }, { id: 'c' } ],
      relations: [
        { id: 'r1', type: 'spouse', fromPersonId: 'b', toPersonId: 't' },
        { id: 'r2', type: 'spouse', fromPersonId: 'c', toPersonId: 't' },
        { id: 'r3', type: 'spouse', fromPersonId: 'b', toPersonId: 't' }
      ]
    };
    const res = simulateMerge(db, 't', ['b','c']);
    expect(res).toBeTruthy();
    // After remap, some duplicates should be archived
    const archived = res.archivedList.map(x => x.id);
    expect(archived.length).toBeGreaterThan(0);
  });

  it('preserves metadata (sourceIds, note) on preview entries', () => {
    const db = {
      people: [ { id: 't' }, { id: 's' } ],
      relations: [ { id: 'r1', type: 'parent', fromPersonId: 's', toPersonId: 't', sourceIds: ['src1'], note: 'a note' } ]
    };
    const res = simulateMerge(db, 't', ['s']);
    expect(res).toBeTruthy();
    const kept = res.keptList.concat(res.archivedList);
    const found = kept.find(x => x.id === 'r1');
    expect(found).toBeTruthy();
    expect(found.sources).toEqual(['src1']);
    expect(found.note).toBe('a note');
  });
});
