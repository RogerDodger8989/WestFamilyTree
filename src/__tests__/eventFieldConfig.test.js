import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEventSummary,
  createEmptyEvent,
  getEventFieldsForType,
  normalizeEventForType
} from '../eventFieldConfig.js';

test('alternativt namn exposes structured fields and summary', () => {
  const fields = getEventFieldsForType('Alternativt namn').map((field) => field.key);
  assert.deepEqual(fields, [
    'prefix',
    'firstName',
    'middleName',
    'lastName',
    'nickname',
    'suffix',
    'nameType',
    'note'
  ]);

  const summary = buildEventSummary({
    type: 'Alternativt namn',
    prefix: 'Dr',
    firstName: 'Anna',
    middleName: 'Maria',
    lastName: 'Andersson',
    nickname: 'Lill-Anna',
    suffix: 'Jr'
  });

  assert.equal(summary, 'Dr Anna Maria Andersson "Lill-Anna" Jr');
});

test('education exposes structured fields and summary', () => {
  const draft = createEmptyEvent('Utbildning');
  assert.equal(draft.type, 'Utbildning');
  assert.equal(draft.school, '');
  assert.equal(draft.program, '');

  const summary = buildEventSummary({
    type: 'Utbildning',
    school: 'Uppsala universitet',
    program: 'Juridik',
    graduationYear: '2012',
    place: 'Uppsala'
  });

  assert.equal(summary, 'Uppsala universitet, Juridik (2012) • Uppsala');
});

test('legacy event data is preserved and summarized', () => {
  const normalized = normalizeEventForType({
    type: 'Egen händelse',
    description: 'Gammal beskrivning',
    value: 'Gammalt värde',
    notes: 'Gamla noteringar',
    customType: 'Middag'
  });

  assert.equal(normalized.description, 'Gammal beskrivning');
  assert.equal(normalized.value, 'Gammalt värde');
  assert.equal(normalized.notes, 'Gamla noteringar');
  assert.equal(buildEventSummary(normalized), 'Middag');
});

test('unknown types fall back safely', () => {
  const summary = buildEventSummary({
    type: 'Okänd typ',
    description: 'Legacy text'
  });

  assert.equal(summary, 'Legacy text');
});