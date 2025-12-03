import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppProvider, useApp } from '../src/AppContext.jsx';

function Inspector({ onReady }) {
  const ctx = useApp();
  React.useEffect(() => { if (onReady) onReady(ctx); }, [ctx, onReady]);
  return null;
}

describe('mergePersons and undoMerge', () => {
  it('remaps relations and archives sources, undo restores snapshot', async () => {
    let ctxRef = null;
    await act(async () => {
      render(<AppProvider><Inspector onReady={(c) => { ctxRef = c; }} /></AppProvider>);
    });

    // Setup a fixture database
    const fixture = {
      meta: { merges: [] },
      people: [
        { id: 'pA', firstName: 'Target', lastName: 'One', refNumber: 1, events: [], links: {} },
        { id: 'pB', firstName: 'Source', lastName: 'Two', refNumber: 2, events: [], links: {} },
        { id: 'pC', firstName: 'Source', lastName: 'Three', refNumber: 3, events: [], links: {} },
        { id: 'pX', firstName: 'Other', lastName: 'X', refNumber: 4, events: [], links: {} }
      ],
      relations: [
        { id: 'r0', type: 'parent', fromPersonId: 'pA', toPersonId: 'pX' },
        { id: 'r1', type: 'parent', fromPersonId: 'pB', toPersonId: 'pX' },
        { id: 'r2', type: 'spouse', fromPersonId: 'pB', toPersonId: 'pC' },
        { id: 'r3', type: 'sibling', fromPersonId: 'pC', toPersonId: 'pX' }
      ],
      sources: [],
      places: []
    };

    act(() => {
      ctxRef.setDbData(fixture);
    });

    let mergeId = null;
    await act(async () => {
      mergeId = ctxRef.mergePersons({ targetId: 'pA', sourceIds: ['pB', 'pC'], createdBy: 'test' });
    });

    // After merge: sources archived and some relations archived
    const db = ctxRef.dbData;
    const pB = db.people.find(p => p.id === 'pB');
    const pC = db.people.find(p => p.id === 'pC');
    expect(pB._archived).toBe(true);
    expect(pC._archived).toBe(true);

    const rel1 = db.relations.find(r => r.id === 'r1');
    const rel2 = db.relations.find(r => r.id === 'r2');
    const rel0 = db.relations.find(r => r.id === 'r0');

    expect(rel0._archived === true).toBe(false);
    expect(rel1._archived).toBe(true);
    expect(rel2._archived).toBe(true);

    // Undo the merge
    await act(async () => {
      const ok = ctxRef.undoMerge(mergeId);
      expect(ok).toBe(true);
    });

    const db2 = ctxRef.dbData;
    const pB2 = db2.people.find(p => p.id === 'pB');
    const pC2 = db2.people.find(p => p.id === 'pC');
    expect(pB2._archived).toBeUndefined();
    expect(pC2._archived).toBeUndefined();
  });
});
