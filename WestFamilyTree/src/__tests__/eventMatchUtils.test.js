import { describe, it, expect } from 'vitest';
import { parseDateParts, datePrecision, placeSimilarity, matchEvents } from '../eventMatchUtils';

describe('eventMatchUtils', () => {
  it('parses years and precisions correctly', () => {
    expect(parseDateParts('1879')).toEqual({ year: 1879, month: null, day: null });
    expect(parseDateParts('1879-06')).toEqual({ year: 1879, month: 6, day: null });
    expect(parseDateParts('1879-06-12')).toEqual({ year: 1879, month: 6, day: 12 });
    expect(datePrecision('1879')).toBe(1);
    expect(datePrecision('1879-06')).toBe(2);
    expect(datePrecision('1879-06-12')).toBe(3);
  });

  it('computes reasonable place similarity', () => {
    const s1 = 'Stockholm, Sweden';
    const s2 = 'Stockholm';
    const s3 = 'Göteborg';
    expect(placeSimilarity(s1, s2)).toBeGreaterThanOrEqual(0.5);
    expect(placeSimilarity(s1, s3)).toBeLessThan(0.3);
  });

  it('matches events across lists', () => {
    const a = [ { id: 'a1', type: 'Födelse', date: '1879', place: 'Stockholm' }, { id: 'a2', type: 'Dop', date: '1880-01-01' } ];
    const b = [ { id: 'b1', type: 'Födelse', date: '1879-06-12', place: 'Stockholm, Sweden' }, { id: 'b2', type: 'Dop', date: '1880-01-01' } ];
    const pairs = matchEvents(a, b, { threshold: 0.2 });
    // Expect at least one pair matching birth and one matching baptism
    const birthPair = pairs.find(p => (p.a && p.a.id === 'a1') || (p.b && p.b.id === 'b1'));
    expect(birthPair).toBeDefined();
    const bapPair = pairs.find(p => (p.a && p.a.id === 'a2') || (p.b && p.b.id === 'b2'));
    expect(bapPair).toBeDefined();
  });
});
