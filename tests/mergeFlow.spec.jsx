import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppProvider, useApp } from '../src/AppContext.jsx';

function Inspector({ onReady }) {
  const ctx = useApp();
  React.useEffect(() => { if (onReady) onReady(ctx); }, [ctx, onReady]);
  return null;
}

describe('merge flow (integration)', () => {
  it('applies UI-like changes and performs canonical merge (archives sources + records merge)', async () => {
    let ctxRef = null;
    await act(async () => {
      render(<AppProvider><Inspector onReady={(c) => { ctxRef = c; }} /></AppProvider>);
    });

    const fixture = {
      meta: { merges: [] },
      people: [
        { id: 'pTarget', firstName: 'Anna', lastName: 'Target', refNumber: 1, events: [], links: {} },
        { id: 'pSource', firstName: 'Anni', lastName: 'Source', refNumber: 2, events: [], links: {} }
      ],
      relations: [],
      sources: [],
      places: []
    };

    act(() => ctxRef.setDbData(fixture));

    // Simulate what the MergeSummary confirm flow would do before calling mergePersons:
    // (e.g. apply field changes / merged events into people via setDbData)
    // For this test we don't change fields; just call mergePersons and assert results.

    let mergeId = null;
    await act(async () => {
      mergeId = ctxRef.mergePersons({ targetId: 'pTarget', sourceIds: ['pSource'], createdBy: 'test' });
    });

    expect(typeof mergeId).toBe('string');

    const db = ctxRef.dbData;
    // meta should contain the merge record
    expect(db.meta).toBeTruthy();
    expect(Array.isArray(db.meta.merges)).toBe(true);
    const found = db.meta.merges.find(m => m.id === mergeId);
    expect(found).toBeTruthy();
    expect(found.originalPersonIds.includes('pSource')).toBe(true);

    // source person should be archived
    const src = db.people.find(p => p.id === 'pSource');
    expect(src).toBeTruthy();
    expect(src._archived).toBe(true);

  });
});
