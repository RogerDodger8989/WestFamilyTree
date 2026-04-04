import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveDatabaseData, loadDatabaseData } from './databaseHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sökväg till vår tillfälliga testdatabas
const TEST_DB_PATH = path.join(__dirname, 'test-relation-integration.sqlite');

describe('Integrationstest: SQLite Relationspersistens', () => {
  
  // Städa upp testfilen efter att testerna har körts
  after(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('Ska kunna spara och läsa tillbaka en relation mellan två personer', async () => {
    // 1. Förbered testdata
    const mockRelations = [{
      id: 'rel_123',
      fromPersonId: 'p_1',
      toPersonId: 'p_2',
      type: 'partner',
      startDate: '1990-01-01',
      endDate: '',
      certainty: 'High',
      note: 'Integrationstest relation',
      sourceIds: ['src_1'],
      reason: 'Automatisk matchning',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      _archived: false
    }];

    // 2. Skriv till databasen via vår nya handler (Produktionskod)
    await saveDatabaseData(TEST_DB_PATH, { relations: mockRelations });

    // 3. Läs från databasen (Produktionskod)
    const loaded = await loadDatabaseData(TEST_DB_PATH);
    const loadedRelations = loaded.relations;

    // 4. Verifiera (Assert)
    assert.strictEqual(loadedRelations.length, 1, 'Databasen ska innehålla exakt 1 relation');
    
    const loadedRel = loadedRelations[0];
    assert.strictEqual(loadedRel.id, 'rel_123', 'ID på relationen ska matcha');
    assert.strictEqual(loadedRel.fromPersonId, 'p_1', 'fromPersonId ska matcha');
    assert.strictEqual(loadedRel.toPersonId, 'p_2', 'toPersonId ska matcha');
    assert.strictEqual(loadedRel.type, 'partner', 'relationstypen ska matcha');
    assert.strictEqual(loadedRel._archived, 0, '_archived flaggan ska sparas som integer 0/1 i SQLite');
    assert.deepEqual(loadedRel.sourceIds, ['src_1'], 'sourceIds ska komma ut som en json-array');
  });

  it('Ska kunna hantera flera relationer med JSON-arrayer och _archived-flaggor', async () => {
    const mockRelations = [
      {
        id: 'rel_201',
        fromPersonId: 'p_10',
        toPersonId: 'p_20',
        type: 'parent',
        startDate: '',
        endDate: '',
        certainty: 'Medium',
        note: 'Ett notering',
        sourceIds: ['src_1', 'src_2'],
        reason: 'Manuell inmatning',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        _archived: false
      },
      {
        id: 'rel_202',
        fromPersonId: 'p_20',
        toPersonId: 'p_30',
        type: 'sibling',
        startDate: '',
        endDate: '',
        certainty: 'Low',
        note: 'Arkiverad relation',
        sourceIds: [],
        reason: 'Felaktig koppling',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        _archived: true
      }
    ];

    await saveDatabaseData(TEST_DB_PATH, { relations: mockRelations });

    const loaded = await loadDatabaseData(TEST_DB_PATH);
    const loadedRelations = loaded.relations;

    assert.strictEqual(loadedRelations.length, 2, 'Databasen ska innehålla båda relationerna');
    const rel1 = loadedRelations.find(r => r.id === 'rel_201');
    const rel2 = loadedRelations.find(r => r.id === 'rel_202');
    
    assert.deepEqual(rel1.sourceIds, ['src_1', 'src_2'], 'sourceIds ska sparas korrekt som JSON-array');
    assert.strictEqual(rel2._archived, 1, 'Arkiverad relation ska ha _archived = 1');
  });
});