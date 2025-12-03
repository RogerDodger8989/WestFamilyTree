import { describe, it, expect } from 'vitest';
import { simulateMerge } from '../mergeUtils';

describe('mergeUtils smoke', () => {
  it('simulateMerge runs on small dataset', () => {
    const db = {
      people: [ { id: 'p1', firstName: 'A', events: [] }, { id: 'p2', firstName: 'B', events: [] } ],
      relations: []
    };
    const out = simulateMerge(db, 'p1', ['p2']);
    expect(out).toBeTruthy();
    expect(typeof out).toBe('object');
  });
});
