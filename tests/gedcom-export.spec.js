import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);

function loadGedcomHandlerForTests() {
  const modulePath = path.resolve(process.cwd(), 'electron', 'gedcom-handler.js');
  const source = fs.readFileSync(modulePath, 'utf8');

  const module = { exports: {} };
  const nodeRequire = createRequire(modulePath);
  const sandboxRequire = (request) => {
    if (request === 'electron') {
      return { dialog: { showErrorBox: () => {} } };
    }
    return nodeRequire(request);
  };

  const wrapper = `(function(require, module, exports, __filename, __dirname){${source}\n})`;
  const compiled = vm.runInNewContext(wrapper, {
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  }, { filename: modulePath });

  compiled(sandboxRequire, module, module.exports, modulePath, path.dirname(modulePath));
  return module.exports;
}

const { writeGedcom } = loadGedcomHandlerForTests();

describe('GEDCOM export smoke test', () => {
  it('exports family/shared events, witnesses, media, and long notes with CONT/CONC', async () => {
    const veryLongSingleLine = `Biografi: ${'A'.repeat(420)}`;
    const secondLongLine = `Andra raden: ${'B'.repeat(320)}`;

    const mockDbData = {
      people: [
        {
          id: 'p1',
          firstName: 'Anna',
          lastName: 'Andersson',
          gender: 'K',
          media: ['m1'],
          // Long multiline note to force CONT and CONC.
          note: `${veryLongSingleLine}\n${secondLongLine}`,
          events: [
            {
              id: 'evt_resi_p1',
              type: 'Bosatt',
              date: '1901-01-01',
              place: 'Stockholm, Sverige',
              sources: []
            },
            {
              id: 'evt_birth_p1',
              type: 'Födelse',
              date: '1880-11-21',
              place: 'Uppsala, Sverige',
              linkedPersons: ['p2'],
              sources: []
            }
          ],
          relations: {
            parents: [],
            partners: [{ id: 'p2', name: 'Erik Berg' }],
            children: []
          }
        },
        {
          id: 'p2',
          firstName: 'Erik',
          lastName: 'Berg',
          gender: 'M',
          events: [
            {
              id: 'evt_resi_p2',
              type: 'Bosatt',
              date: '1901-01-01',
              place: 'Stockholm, Sverige',
              sources: []
            }
          ],
          relations: {
            parents: [],
            partners: [{ id: 'p1', name: 'Anna Andersson' }],
            children: []
          }
        }
      ],
      relations: [
        { type: 'spouse', person1Id: 'p1', person2Id: 'p2' }
      ],
      media: [
        {
          id: 'm1',
          url: 'media://photos/anna-portrait.jpg',
          title: 'Anna portratt'
        }
      ],
      sources: []
    };

    const result = await writeGedcom(mockDbData, { version: '5.5.1' });

    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
    expect(typeof result.gedcomText).toBe('string');

    const ged = result.gedcomText;

    // RESI in family block (shared partner event promoted to FAM block).
    expect(ged).toMatch(/0 @F1@ FAM[\s\S]*?\n1 RESI\b/);

    // Witness exported under event.
    expect(ged).toMatch(/1 BIRT[\s\S]*?\n2 WITN @I2@/);

    // Person media exported as OBJE + FILE.
    expect(ged).toContain('1 OBJE');
    expect(ged).toContain('2 FILE media://photos/anna-portrait.jpg');

    // Long multiline note exported with GEDCOM continuation tags.
    expect(ged).toContain('\n2 CONT ');
    expect(ged).toContain('\n2 CONC ');
  });

  it('exports alternate names, death causes, custom events, and attributes correctly', async () => {
    const mockDbData = {
      people: [
        {
          id: 'p100',
          firstName: 'Karl',
          lastName: 'Svensson',
          gender: 'M',
          events: [
            {
              id: 'evt_alt_name',
              type: 'Alternativt namn',
              firstName: 'Kalle',
              lastName: 'Svensson',
              nameType: 'Smeknamn'
            },
            {
              id: 'evt_death',
              type: 'Död',
              date: '1960-02-10',
              place: 'Falun, Sverige',
              cause: 'Ålderdom'
            },
            {
              id: 'evt_custom',
              type: 'Egen händelse',
              gedcomType: 'custom',
              customType: 'Studentexamen',
              date: '1900-06-01',
              place: 'Uppsala, Sverige'
            },
            {
              id: 'evt_attr',
              type: 'Yrke',
              gedcomType: 'attribute',
              description: 'Smed'
            }
          ],
          relations: {
            parents: [],
            partners: [],
            children: []
          }
        }
      ],
      relations: [],
      media: [],
      sources: []
    };

    const result = await writeGedcom(mockDbData, { version: '5.5.1' });

    expect(result).toBeTruthy();
    expect(result.success).toBe(true);
    expect(typeof result.gedcomText).toBe('string');

    const ged = result.gedcomText;

    // Alternativt namn ska vara eget NAME-block med TYPE.
    expect(ged).toMatch(/\n1 NAME Kalle \/Svensson\//);
    expect(ged).toMatch(/\n2 TYPE Smeknamn/);

    // Död + dödsorsak.
    expect(ged).toMatch(/\n1 DEAT\b[\s\S]*?\n2 CAUS Ålderdom/);

    // Custom event as EVEN + TYPE.
    expect(ged).toMatch(/\n1 EVEN\b[\s\S]*?\n2 TYPE Studentexamen/);

    // Attribut på nivå 1 med värde.
    expect(ged).toMatch(/\n1 OCCU Smed/);
  });
});
