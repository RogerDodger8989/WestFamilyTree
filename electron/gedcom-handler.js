const fs = require('fs').promises;
const path = require('path');
let iconv;
try {
  iconv = require('iconv-lite');
} catch (e) {
  console.warn('[gedcom-handler] iconv-lite not installed; falling back to simple decoding:', e && e.message);
  iconv = null;
}
let parseGedcom;
try {
  parseGedcom = require('parse-gedcom');
} catch (e) {
  console.error('[gedcom-handler] parse-gedcom not installed:', e && e.message);
  parseGedcom = null;
}
const { dialog } = require('electron');

function detectGedcomCharset(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\n?1\s+CHAR\s+([^\r\n]+)/i);
  return match ? String(match[1] || '').trim().toUpperCase() : null;
}

function detectGedcomVersion(text) {
  if (!text || typeof text !== 'string') return null;
  const gedcBlock = text.match(/1\s+GEDC[\s\S]*?2\s+VERS\s+([^\r\n]+)/i);
  if (gedcBlock && gedcBlock[1]) return String(gedcBlock[1]).trim();
  const fallback = text.match(/\n?0\s+HEAD[\s\S]*?\n2\s+VERS\s+([^\r\n]+)/i);
  return fallback && fallback[1] ? String(fallback[1]).trim() : null;
}

function decodeAnselBuffer(buffer) {
  // ANSEL uses combining diacritics encoded before the base letter.
  const combiningMarks = {
    0xE0: '\u0300', // grave
    0xE1: '\u0301', // acute
    0xE2: '\u0302', // circumflex
    0xE3: '\u0303', // tilde
    0xE4: '\u0304', // macron
    0xE5: '\u030A', // ring above (e.g. a + ring = å)
    0xE6: '\u0327', // cedilla
    0xE7: '\u030C', // caron
    0xE8: '\u0308', // diaeresis (e.g. a + diaeresis = ä)
    0xE9: '\u030B', // double acute
    0xEA: '\u0328', // ogonek
    0xEB: '\u0307', // dot above
    0xEC: '\u0323'  // dot below
  };

  // Practical direct mappings for common Nordic/European letters that appear in legacy files.
  const directMap = {
    0x8D: 'Æ',
    0x8E: 'Ø',
    0x8F: 'Å',
    0x9D: 'æ',
    0x9E: 'ø',
    0x9F: 'å',
    0xA1: 'Ł',
    0xB1: 'ł',
    0xA3: 'Ð',
    0xB3: 'ð',
    0xA4: 'Þ',
    0xB4: 'þ'
  };

  let out = '';
  let pendingCombining = [];

  const pushBase = (baseChar) => {
    if (!baseChar) return;
    if (pendingCombining.length) {
      out += (baseChar + pendingCombining.join('')).normalize('NFC');
      pendingCombining = [];
      return;
    }
    out += baseChar;
  };

  for (let i = 0; i < buffer.length; i += 1) {
    const b = buffer[i];

    if (combiningMarks[b]) {
      pendingCombining.push(combiningMarks[b]);
      continue;
    }

    if (b === 0x0A || b === 0x0D || b === 0x09) {
      // Flush dangling combining marks if malformed content appears before control chars.
      if (pendingCombining.length) {
        out += pendingCombining.join('');
        pendingCombining = [];
      }
      out += String.fromCharCode(b);
      continue;
    }

    if (b < 0x80) {
      pushBase(String.fromCharCode(b));
      continue;
    }

    if (directMap[b]) {
      pushBase(directMap[b]);
      continue;
    }

    // Unknown ANSEL byte: keep replacement to avoid silently corrupting structure.
    pushBase('\uFFFD');
  }

  if (pendingCombining.length) {
    out += pendingCombining.join('');
  }

  return out;
}

function decodeGedcomBuffer(buffer) {
  // Start with UTF-8, then fallback based on CHAR and legacy encodings.
  const utf8Text = buffer.toString('utf8');
  const declaredCharset = detectGedcomCharset(utf8Text);

  if (!iconv) {
    if (declaredCharset === 'ANSEL') {
      return { text: decodeAnselBuffer(buffer), charset: 'ANSEL' };
    }
    return { text: utf8Text, charset: declaredCharset || 'UTF-8' };
  }

  if (declaredCharset === 'ANSEL') {
    return { text: decodeAnselBuffer(buffer), charset: 'ANSEL' };
  }

  if (declaredCharset === 'ANSI' || declaredCharset === 'WINDOWS-1252') {
    return { text: iconv.decode(buffer, 'win1252'), charset: declaredCharset };
  }

  if (declaredCharset === 'ASCII') {
    return { text: iconv.decode(buffer, 'ascii'), charset: 'ASCII' };
  }

  if (declaredCharset === 'UTF-8' || declaredCharset === 'UNICODE' || !declaredCharset) {
    return { text: utf8Text, charset: declaredCharset || 'UTF-8' };
  }

  // Unknown CHAR declaration: keep UTF-8, parser fallback below can still retry.
  return { text: utf8Text, charset: declaredCharset };
}

async function readGedcom(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const decoded = decodeGedcomBuffer(buffer);
    let text = decoded.text;

    if (!parseGedcom) {
      dialog.showErrorBox('Missing dependency', 'The package "parse-gedcom" is not installed for the Electron main process.\nPlease run `npm install parse-gedcom` in the electron folder.');
      return { error: 'parse-gedcom not installed' };
    }

    let parsed = null;
    // Helper to invoke the parser whether it exports a function or an object with .parse
    const invokeParser = (p, txt) => {
      if (typeof p === 'function') return p(txt);
      if (p && typeof p.parse === 'function') return p.parse(txt);
      throw new Error('Unsupported parse-gedcom export shape');
    };

    try {
      parsed = invokeParser(parseGedcom, text);
    } catch (parseErr) {
      if (decoded.charset === 'ANSEL') {
        try {
          const alt = decodeAnselBuffer(buffer);
          parsed = invokeParser(parseGedcom, alt);
        } catch (anselErr) {
          console.error('[gedcom-handler] parse-gedcom failed after ANSEL decode retry:', anselErr);
          if (iconv) {
            try {
              const win1252Alt = iconv.decode(buffer, 'win1252');
              parsed = invokeParser(parseGedcom, win1252Alt);
            } catch (winErr) {
              console.error('[gedcom-handler] parse-gedcom failed after ANSEL and win1252 retries:', winErr);
              throw winErr;
            }
          } else {
            throw anselErr;
          }
        }
      } else if (iconv) {
        // Try alternative decoding with iconv if available (common for Windows-1252 encoded GEDCOMs)
        try {
          const alt = iconv.decode(buffer, 'win1252');
          parsed = invokeParser(parseGedcom, alt);
        } catch (reErr) {
          console.error('[gedcom-handler] parse-gedcom failed after recode:', reErr);
          throw reErr;
        }
      } else {
        console.error('[gedcom-handler] parse-gedcom initial parse failed and no iconv available:', parseErr);
        throw parseErr;
      }
    }

    // Fallback normalizer to produce a flat array of nodes
    function collectNodesLocal(root) {
      const out = [];
      const stack = Array.isArray(root) ? [...root] : [root];
      while (stack.length) {
        const n = stack.shift();
        if (!n) continue;
        if (n.tag) out.push(n);
        if (n.children && Array.isArray(n.children)) {
          for (const c of n.children) stack.push(c);
        }
        if (n.records && Array.isArray(n.records)) {
          for (const c of n.records) stack.push(c);
        }
      }
      return out;
    }

    const rootNodes = Array.isArray(parsed) ? parsed : (parsed && parsed.children ? parsed.children : parsed);
    const safeNodes = Array.isArray(rootNodes) ? rootNodes : collectNodesLocal(parsed);

    const individuals = (safeNodes || []).filter(n => n && n.tag === 'INDI').length;
    const families = (safeNodes || []).filter(n => n && n.tag === 'FAM').length;
    const sources = (safeNodes || []).filter(n => n && n.tag === 'SOUR').length;
    const version = detectGedcomVersion(text) || 'unknown';

    return { parsed, summary: { individuals, families, sources, version, charset: decoded.charset } };
  } catch (err) {
    console.error('[gedcom-handler] readGedcom error:', err);
    return { error: err && err.message ? err.message : String(err) };
  }
}

// applyGedcom: use the renderer-side mapper (shared code in src/gedcom/mapper.js)
async function applyGedcom(parsed, options = {}) {
  try {
    // Attempt to load the mapper from the app source tree. Support CJS (require)
    // and ESM (dynamic import) variants so the main process won't fail when
    // the renderer project uses "type": "module".
    let mapper = null;
    try {
      mapper = require('../WestFamilyTree/src/gedcom/mapper.js');
      console.debug('[gedcom-handler] loaded mapper via require (relative)');
    } catch (e) {
      try {
        mapper = require(path.join(__dirname, '..', 'WestFamilyTree', 'src', 'gedcom', 'mapper.js'));
        console.debug('[gedcom-handler] loaded mapper via require (path.join)');
      } catch (e2) {
        try {
          const abs = path.join(__dirname, '..', 'WestFamilyTree', 'src', 'gedcom', 'mapper.js');
          const url = 'file://' + abs;
          console.debug('[gedcom-handler] attempting dynamic import of mapper from', url);
          const imported = await import(url);
          mapper = imported && (imported.default || imported);
          console.debug('[gedcom-handler] loaded mapper via dynamic import');
        } catch (impErr) {
          console.error('[gedcom-handler] Failed to load mapper via require/import:', impErr && impErr.message ? impErr.message : impErr);
          mapper = null;
        }
      }
    }

    if (mapper && typeof mapper.mapParsedGedcom === 'function') {
      try {
        const mapped = mapper.mapParsedGedcom(parsed);
        try {
          const pCount = mapped && mapped.people ? mapped.people.length : 0;
          const fCount = mapped && mapped.families ? mapped.families.length : 0;
          const sCount = mapped && mapped.sources ? mapped.sources.length : 0;
          console.debug('[gedcom-handler] mapper produced mapped counts:', { people: pCount, families: fCount, sources: sCount });
        } catch (logErr) {}
        return { applied: true, mapped, options };
      } catch (mapErr) {
        console.error('[gedcom-handler] mapper.mapParsedGedcom error:', mapErr && mapErr.message ? mapErr.message : mapErr);
        // fall through to the summary fallback below
      }
    }

    // Normalise parsed into an array of nodes before filtering to avoid
    // "(parsed || []).filter is not a function" when parsed is an object.
    function collectNodesLocal(root) {
      const out = [];
      const stack = Array.isArray(root) ? [...root] : [root];
      while (stack.length) {
        const n = stack.shift();
        if (!n) continue;
        if (n.tag) out.push(n);
        if (n.children && Array.isArray(n.children)) {
          for (const c of n.children) stack.push(c);
        }
        if (n.records && Array.isArray(n.records)) {
          for (const c of n.records) stack.push(c);
        }
      }
      return out;
    }

    const rootNodes = Array.isArray(parsed) ? parsed : (parsed && parsed.children ? parsed.children : parsed);
    const safeNodes = Array.isArray(rootNodes) ? rootNodes : collectNodesLocal(parsed);

    const individuals = (safeNodes || []).filter(n => n && n.tag === 'INDI').length;
    const families = (safeNodes || []).filter(n => n && n.tag === 'FAM').length;
    const sources = (safeNodes || []).filter(n => n && n.tag === 'SOUR').length;

    return { applied: true, created: { individuals, families, sources }, parsed, options };
  } catch (err) {
    console.error('[gedcom-handler] applyGedcom error:', err);
    return { error: err && err.message ? err.message : String(err) };
  }
}

async function writeGedcom(dbData, options = {}) {
  try {
    const version = options.version || '5.5.1';
    const encoding = version === '5.5.1' ? 'UTF-8' : 'UTF-8';
    const lines = [];

    // ========== HEADER RECORD ==========
    lines.push('0 HEAD');
    lines.push(`1 SOUR WestFamilyTree`);
    lines.push(`2 VERS 1.0`);
    lines.push(`1 DEST DISKETTE`);
    lines.push(`1 DATE ${new Date().toISOString().split('T')[0].replace(/-/g, '')}`);
    lines.push(`2 TIME ${new Date().toTimeString().split(' ')[0]}`);
    lines.push(`1 SUBMITTER @SUBM1@`);
    lines.push(`1 FILE WestFamilyTree.ged`);
    lines.push(`1 COPR Copyright WestFamilyTree`);
    lines.push(`1 GEDC`);
    lines.push(`2 VERS ${version}`);
    lines.push(`2 FORM LINEAGE-LINKED`);
    lines.push(`1 CHAR ${encoding}`);
    lines.push(`1 LANG SV`);

    const xrefCounter = { indi: 0, fam: 0, sour: 0, obje: 0 };
    const xrefMap = new Map(); // Map from internal ID to GEDCOM XREF
    const mediaById = buildMediaLookup(dbData && dbData.media);
    const peopleById = buildPeopleLookup(dbData && dbData.people);

    // Pre-assign all individual XREFs so cross-person refs (e.g. witnesses) resolve reliably.
    if (dbData.people && Array.isArray(dbData.people)) {
      for (const person of dbData.people) {
        if (!person || !person.id) continue;
        if (!xrefMap.has(person.id)) {
          xrefMap.set(person.id, `I${++xrefCounter.indi}`);
        }
      }
    }

    // ========== SUBMITTER RECORD ==========
    lines.push('0 @SUBM1@ SUBM');
    lines.push('1 NAME West Family Database');

    // ========== INDIVIDUALS (INDI) ==========
    if (dbData.people && Array.isArray(dbData.people)) {
      for (const person of dbData.people) {
        const xref = xrefMap.get(person.id) || `I${++xrefCounter.indi}`;
        xrefMap.set(person.id, xref);

        lines.push(`0 @${xref}@ INDI`);

        // NAME with GIVN and SURN subrecords
        const firstName = person.firstName || '';
        const lastName = person.lastName || '';
        const fullName = firstName && lastName ? `${firstName} /${lastName}/` : (firstName || lastName || '?');
        lines.push(`1 NAME ${fullName}`);
        if (firstName) lines.push(`2 GIVN ${firstName}`);
        if (lastName) lines.push(`2 SURN ${lastName}`);

        // SEX
        if (person.gender) {
          lines.push(`1 SEX ${person.gender === 'K' ? 'F' : (person.gender === 'M' ? 'M' : 'U')}`);
        }

        // EVENTS
        if (person.events && Array.isArray(person.events)) {
          for (const evt of person.events) {
            const eventType = String(evt?.type || '').trim();
            const eventTypeKey = eventType.toLowerCase();
            const eventGedcomType = String(evt?.gedcomType || '').trim().toLowerCase();

            // 1) Alternativt namn ska exporteras som extra NAME-block (inte EVEN).
            const isAlternateName = eventTypeKey === 'alternativt namn';
            if (isAlternateName) {
              const altFirstName = String(evt.firstName || '').trim();
              const altLastName = String(evt.lastName || '').trim();
              const formattedAltName = altFirstName && altLastName
                ? `${escapeGedcomValue(altFirstName)} /${escapeGedcomValue(altLastName)}/`
                : (altFirstName ? escapeGedcomValue(altFirstName) : (altLastName ? `/${escapeGedcomValue(altLastName)}/` : ''));

              if (formattedAltName) {
                lines.push(`1 NAME ${formattedAltName}`);
                if (evt.nameType) {
                  lines.push(`2 TYPE ${escapeGedcomValue(evt.nameType)}`);
                }
                appendEventSubLines(lines, evt, xrefMap, mediaById, 2);
              }
              continue;
            }

            // 5) Attribut ska bära sitt värde direkt på nivå 1 (t.ex. OCCU, TITL, EDUC, ...).
            if (eventGedcomType === 'attribute') {
              const attrTag = resolveGedcomAttributeTag(evt);
              const attrValue = escapeGedcomValue(evt.description || evt.value || '');
              lines.push(`1 ${attrTag}${attrValue ? ` ${attrValue}` : ''}`);
              appendEventSubLines(lines, evt, xrefMap, mediaById, 2);
              continue;
            }

            // 3) Egen händelse (custom) ska exporteras som EVEN med optional TYPE.
            if (eventGedcomType === 'custom' || eventTypeKey === 'egen händelse') {
              lines.push('1 EVEN');
              if (evt.customType) {
                lines.push(`2 TYPE ${escapeGedcomValue(evt.customType)}`);
              }
              appendEventSubLines(lines, evt, xrefMap, mediaById, 2);
              continue;
            }

            // Övriga händelser: mappa typ till GEDCOM-tag och behåll befintliga subrader.
            const tag = resolveGedcomEventTag(evt);
            lines.push(`1 ${tag}`);

            // 2) Dödsorsak under DEAT.
            if (tag === 'DEAT' && evt.cause) {
              lines.push(`2 CAUS ${escapeGedcomValue(evt.cause)}`);
            }

            // 4) Resedetaljer för emigration/immigration som NOTE.
            if ((tag === 'EMIG' || tag === 'IMMI') && evt.travelDetails) {
              pushGedcomMultiline(lines, 2, 'NOTE', evt.travelDetails);
            }

            appendEventSubLines(lines, evt, xrefMap, mediaById, 2);
          }
        }

        // Person media as embedded OBJE blocks.
        const personMediaItems = resolveMediaItems(person.media, mediaById);
        writeMediaBlocks(lines, 1, personMediaItems);

        // RELATIONS: Parents
        if (person.relations && person.relations.parents && Array.isArray(person.relations.parents)) {
          for (const parent of person.relations.parents) {
            // This will be linked through FAM records, but we can add FAMC here
            // (we'll set up FAM records after processing all individuals)
          }
        }

        // RELATIONS: Family links
        // These are handled via FAM records below

        // NOTES
        if (person.note) {
          pushGedcomMultiline(lines, 1, 'NOTE', person.note);
        }

        // Change date
        if (person.changeDate) {
          lines.push(`1 CHAN`);
          lines.push(`2 DATE ${formatDateForGedcom(person.changeDate)}`);
        }
      }
    }

    // ========== FAMILIES (FAM) ==========
    if (dbData.relations && Array.isArray(dbData.relations)) {
      // Group relations by family
      const families = new Map();

      for (const rel of dbData.relations) {
        if (rel.type === 'spouse' && rel.person1Id && rel.person2Id) {
          const famKey = [rel.person1Id, rel.person2Id].sort().join('|');
          if (!families.has(famKey)) {
            families.set(famKey, { husb: rel.person1Id, wife: rel.person2Id, children: [] });
          }
        }
      }

      // Add parent-child relations to families
      for (const person of (dbData.people || [])) {
        if (person.relations && person.relations.parents && Array.isArray(person.relations.parents)) {
          for (const parent of person.relations.parents) {
            // Find or create family for this parent-child relationship
            // For now, we'll create a single-parent FAM if needed
            let famFound = false;
            for (const [key, fam] of families) {
              if ((fam.husb === parent.id) || (fam.wife === parent.id)) {
                if (!fam.children.includes(person.id)) {
                  fam.children.push(person.id);
                  famFound = true;
                }
              }
            }
            if (!famFound && parent.id) {
              const famKey = `parent_${parent.id}_child_${person.id}`;
              families.set(famKey, {
                husb: parent.id,
                wife: null,
                children: [person.id]
              });
            }
          }
        }
      }

      // Output FAM records
      for (const [key, fam] of families) {
        const xref = `F${++xrefCounter.fam}`;
        lines.push(`0 @${xref}@ FAM`);

        if (fam.husb && xrefMap.has(fam.husb)) {
          lines.push(`1 HUSB @${xrefMap.get(fam.husb)}@`);
        }
        if (fam.wife && xrefMap.has(fam.wife)) {
          lines.push(`1 WIFE @${xrefMap.get(fam.wife)}@`);
        }

        if (fam.children && Array.isArray(fam.children)) {
          for (const childId of fam.children) {
            if (xrefMap.has(childId)) {
              lines.push(`1 CHIL @${xrefMap.get(childId)}@`);
            }
          }
        }

        // Shared partner events (e.g. RESI/CENS) exported at family level when detected.
        const sharedFamilyEvents = getSharedFamilyEvents(fam, peopleById);
        for (const famEvt of sharedFamilyEvents) {
          lines.push(`1 ${resolveGedcomEventTag(famEvt)}`);
          appendEventSubLines(lines, famEvt, xrefMap, mediaById, 2);
        }
      }

      // Add FAMC/FAMS links to individuals after FAM records are created
      // (This is normally done in post-processing, but we'll keep it simple for now)
    }

    // ========== SOURCES (SOUR) ==========
    if (dbData.sources && Array.isArray(dbData.sources)) {
      for (const source of dbData.sources) {
        const xref = `S${++xrefCounter.sour}`;
        xrefMap.set(source.id, xref);

        lines.push(`0 @${xref}@ SOUR`);

        if (source.title) lines.push(`1 TITL ${escapeGedcomValue(source.title)}`);
        if (source.author) lines.push(`1 AUTH ${escapeGedcomValue(source.author)}`);
        if (source.publ) lines.push(`1 PUBL ${escapeGedcomValue(source.publ)}`);
        if (source.page) lines.push(`1 PAGE ${escapeGedcomValue(source.page)}`);

        if (source.note) {
          lines.push(`1 NOTE ${escapeGedcomValue(source.note)}`);
        }

        // Archive/repository reference
        if (source.archive) {
          lines.push(`1 REPO`);
          lines.push(`2 NAME ${escapeGedcomValue(source.archive)}`);
        }
      }
    }

    // ========== TRAILER ==========
    lines.push('0 TRLR');

    const gedcomText = lines.join('\n');
    return { success: true, gedcomText, version, encoding, recordCounts: xrefCounter };
  } catch (err) {
    console.error('[gedcom-handler] writeGedcom error:', err);
    return { error: err && err.message ? err.message : String(err) };
  }
}

// Helper functions for GEDCOM export

function formatDateForGedcom(dateStr) {
  if (!dateStr) return '';
  // Expected format: ISO date (YYYY-MM-DD) or just year (YYYY)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    const months = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${parseInt(d)} ${months[parseInt(m)]} ${y}`;
  }
  if (/^\d{4}$/.test(dateStr)) {
    return `${dateStr}`;
  }
  return dateStr; // fallback: return as-is
}

function escapeGedcomValue(str) {
  if (!str) return '';
  // GEDCOM line continuation using CONT/CONC not implemented here for simplicity
  // For now, just escape special characters
  return String(str)
    .replace(/\\/g, '\\\\') // backslash first
    .replace(/\/@/g, '@');   // avoid accidental XREF markers
}

function buildPeopleLookup(people) {
  const map = new Map();
  if (!Array.isArray(people)) return map;
  for (const person of people) {
    if (!person || !person.id) continue;
    map.set(String(person.id), person);
  }
  return map;
}

function buildMediaLookup(media) {
  const map = new Map();
  if (!Array.isArray(media)) return map;
  for (const mediaItem of media) {
    if (!mediaItem || !mediaItem.id) continue;
    map.set(String(mediaItem.id), mediaItem);
  }
  return map;
}

function normalizeLinkedPersonId(entry) {
  if (!entry) return '';
  if (typeof entry === 'string' || typeof entry === 'number') return String(entry);
  return String(
    entry.personId
    || entry.linkedPersonId
    || entry.targetId
    || entry.id
    || ''
  );
}

function getEventLinkedPersonIds(evt) {
  const linked = Array.isArray(evt?.linkedPersons) ? evt.linkedPersons : [];
  const seen = new Set();
  const out = [];

  for (const item of linked) {
    const id = normalizeLinkedPersonId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

function getEventLinkedPersonFreeTextNotes(evt, xrefMap) {
  const linked = Array.isArray(evt?.linkedPersons) ? evt.linkedPersons : [];
  const notes = [];
  const seen = new Set();

  for (const entry of linked) {
    if (!entry || typeof entry !== 'object') continue;

    const linkedId = normalizeLinkedPersonId(entry);
    const hasKnownPersonRef = linkedId && xrefMap && xrefMap.get(String(linkedId));
    const role = String(entry.role || '').trim();
    const name = String(entry.name || entry.personName || '').trim();
    const noteText = String(entry.note || '').trim();

    if (hasKnownPersonRef && !role && !noteText) continue;
    if (!name && !role && !noteText) continue;

    const parts = [];
    if (role) parts.push(role);
    if (name) parts.push(name);
    let line = parts.length > 0 ? `Vittne (${parts.join(': ')})` : 'Vittne';
    if (noteText) line += ` - ${noteText}`;

    if (seen.has(line)) continue;
    seen.add(line);
    notes.push(line);
  }

  return notes;
}

function splitForGedcomLine(content, maxLength) {
  if (!content) return [''];
  const safeMax = Math.max(1, maxLength);
  const chunks = [];
  let remaining = String(content);
  while (remaining.length > safeMax) {
    chunks.push(remaining.slice(0, safeMax));
    remaining = remaining.slice(safeMax);
  }
  chunks.push(remaining);
  return chunks;
}

function pushGedcomMultiline(lines, level, tag, text, options = {}) {
  if (text === null || text === undefined) return;

  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const logicalLines = normalized.split('\n');
  const firstPrefix = `${level} ${tag} `;
  const contPrefix = `${level + 1} CONT `;
  const concPrefix = `${level + 1} CONC `;

  const firstMax = Math.max(1, 248 - firstPrefix.length);
  const contMax = Math.max(1, 248 - contPrefix.length);
  const concMax = Math.max(1, 248 - concPrefix.length);

  const emitWrapped = (prefix, lineValue, wrapMax, emitConcForRest) => {
    const escaped = escapeGedcomValue(lineValue || '');
    const chunks = splitForGedcomLine(escaped, wrapMax);
    lines.push(`${prefix}${chunks[0]}`);
    if (emitConcForRest) {
      for (let i = 1; i < chunks.length; i += 1) {
        lines.push(`${concPrefix}${chunks[i]}`);
      }
    }
  };

  emitWrapped(firstPrefix, logicalLines[0] || '', firstMax, true);

  for (let i = 1; i < logicalLines.length; i += 1) {
    const lineText = logicalLines[i] || '';
    const escaped = escapeGedcomValue(lineText);
    const chunks = splitForGedcomLine(escaped, contMax);
    lines.push(`${contPrefix}${chunks[0]}`);
    for (let j = 1; j < chunks.length; j += 1) {
      const concChunks = splitForGedcomLine(chunks[j], concMax);
      for (const conc of concChunks) {
        lines.push(`${concPrefix}${conc}`);
      }
    }
  }
}

function getMediaFilePath(mediaItem) {
  return String(
    mediaItem?.filePath
    || mediaItem?.path
    || mediaItem?.url
    || mediaItem?.fileName
    || ''
  ).trim();
}

function getMediaFormat(mediaItem, filePath) {
  const fromMeta = String(mediaItem?.format || mediaItem?.mimeType || '').trim().toUpperCase();
  if (fromMeta) {
    if (fromMeta.includes('/')) {
      return fromMeta.split('/').pop();
    }
    return fromMeta;
  }

  const match = String(filePath || '').match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match && match[1] ? String(match[1]).toUpperCase() : '';
}

function resolveMediaItems(mediaList, mediaById) {
  if (!Array.isArray(mediaList)) return [];
  const out = [];
  const seen = new Set();

  for (const entry of mediaList) {
    let mediaItem = null;
    if (typeof entry === 'string' || typeof entry === 'number') {
      mediaItem = mediaById.get(String(entry)) || null;
      if (!mediaItem) {
        mediaItem = { id: String(entry), fileName: String(entry) };
      }
    } else if (entry && typeof entry === 'object') {
      mediaItem = entry.id ? (mediaById.get(String(entry.id)) || entry) : entry;
    }

    if (!mediaItem) continue;
    const key = String(mediaItem.id || getMediaFilePath(mediaItem) || Math.random());
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mediaItem);
  }

  return out;
}

function writeMediaBlocks(lines, level, mediaItems) {
  if (!Array.isArray(mediaItems) || mediaItems.length === 0) return;

  for (const mediaItem of mediaItems) {
    const filePath = getMediaFilePath(mediaItem);
    if (!filePath) continue;

    const fileTag = `${level + 1} FILE ${escapeGedcomValue(filePath)}`;
    lines.push(`${level} OBJE`);
    lines.push(fileTag);

    const format = getMediaFormat(mediaItem, filePath);
    if (format) lines.push(`${level + 1} FORM ${escapeGedcomValue(format)}`);

    const title = String(mediaItem.title || mediaItem.name || mediaItem.caption || '').trim();
    if (title) lines.push(`${level + 1} TITL ${escapeGedcomValue(title)}`);
  }
}

const EVENT_TYPE_TO_GEDCOM_TAG = {
  'födelse': 'BIRT',
  'birth': 'BIRT',
  'dop': 'BAPM',
  'dop som vuxen': 'BAPL',
  'troendedop': 'BAPL',
  'konfirmation': 'CONF',
  'död': 'DEAT',
  'death': 'DEAT',
  'begravning': 'BURI',
  'kremering': 'CREM',
  'vigsel': 'MARR',
  'förlovning': 'ENGA',
  'skilsmässa': 'DIV',
  'bosatt': 'RESI',
  'emigration': 'EMIG',
  'immigration': 'IMMI',
  'adoption': 'ADOP',
  'utbildning': 'EDUC',
  'militärtjänst': 'EVEN',
  'bar mitzvah': 'BARM',
  'första nattvarden': 'FCOM',
  'prästvigling': 'ORDN',
  'välsignelse': 'BLES',
  'naturalisering': 'NATU',
  'folkräkning': 'CENS',
  'pensionering': 'RETI',
  'lysning': 'MARB',
  'samlevnad': 'EVEN',
  'samvetsäktenskap': 'EVEN',
  'annulering av vigsel': 'ANUL',
  'arkivering av skilsmässa': 'DIVF',
  'bouppteckning': 'PROB'
};

const ATTRIBUTE_TYPE_TO_GEDCOM_TAG = {
  'yrke': 'OCCU',
  'titel': 'TITL',
  'utbildning': 'EDUC',
  'personnummer': 'IDNO',
  'socialförsäkringsnummer': 'IDNO',
  'nationalitet': 'NATI',
  'religionstillhörighet': 'RELI',
  'kast': 'CAST',
  'egendom': 'PROP',
  'fysisk status': 'DSCR',
  'notering': 'FACT',
  'faktauppgift': 'FACT',
  'testamente': 'WILL',
  'antal barn': 'NCHI',
  'antal äktenskap': 'NMR'
};

const DIRECT_GEDCOM_EVENT_TAGS = new Set([
  'BIRT', 'DEAT', 'BURI', 'CREM', 'CHR', 'CHRA', 'BAPM', 'BAPL', 'BLES', 'FCOM', 'CONF',
  'MARR', 'MARB', 'MARC', 'MARL', 'MARS', 'DIV', 'DIVF', 'ANUL', 'ENGA', 'RESI', 'EMIG',
  'IMMI', 'NATU', 'ADOP', 'CENS', 'EDUC', 'OCCU', 'TITL', 'RELI', 'CAST', 'DSCR', 'IDNO',
  'NATI', 'NCHI', 'NMR', 'PROB', 'RETI', 'ORDN', 'WILL', 'EVEN', 'FACT'
]);

function normalizeEventType(type) {
  return String(type || '').trim();
}

function resolveGedcomEventTag(evt) {
  const rawType = normalizeEventType(evt?.type);
  const upperType = rawType.toUpperCase();
  if (DIRECT_GEDCOM_EVENT_TAGS.has(upperType)) return upperType;

  const mappedTag = EVENT_TYPE_TO_GEDCOM_TAG[rawType.toLowerCase()];
  if (mappedTag) return mappedTag;

  return 'EVEN';
}

function resolveGedcomAttributeTag(evt) {
  const rawType = normalizeEventType(evt?.type);
  const upperType = rawType.toUpperCase();
  if (DIRECT_GEDCOM_EVENT_TAGS.has(upperType)) return upperType;

  const mappedTag = ATTRIBUTE_TYPE_TO_GEDCOM_TAG[rawType.toLowerCase()];
  if (mappedTag) return mappedTag;

  return 'FACT';
}

function getSharedFamilyEvents(fam, peopleById) {
  const husb = fam && fam.husb ? peopleById.get(String(fam.husb)) : null;
  const wife = fam && fam.wife ? peopleById.get(String(fam.wife)) : null;
  if (!husb || !wife) return [];

  const candidateTagSet = new Set(['RESI', 'CENS']);
  const husbandEvents = Array.isArray(husb.events) ? husb.events : [];
  const wifeEvents = Array.isArray(wife.events) ? wife.events : [];

  const wifeIndex = new Map();
  for (const evt of wifeEvents) {
    const tag = resolveGedcomEventTag(evt);
    if (!candidateTagSet.has(tag)) continue;
    const key = `${tag}|${String(evt.date || '').trim()}|${String(evt.place || '').trim()}`;
    wifeIndex.set(key, evt);
  }

  const shared = [];
  const sharedKeys = new Set();

  for (const evt of husbandEvents) {
    const tag = resolveGedcomEventTag(evt);
    if (!candidateTagSet.has(tag)) continue;

    const key = `${tag}|${String(evt.date || '').trim()}|${String(evt.place || '').trim()}`;
    const matchedWifeEvent = wifeIndex.get(key);
    const linkedIds = getEventLinkedPersonIds(evt);
    const explicitlyLinkedToSpouse = linkedIds.includes(String(wife.id));

    if (!matchedWifeEvent && !explicitlyLinkedToSpouse) continue;
    if (sharedKeys.has(key)) continue;
    sharedKeys.add(key);

    const mergedSources = [
      ...(Array.isArray(evt.sources) ? evt.sources : []),
      ...(Array.isArray(matchedWifeEvent && matchedWifeEvent.sources) ? matchedWifeEvent.sources : [])
    ];

    const mergedImages = [
      ...(Array.isArray(evt.images) ? evt.images : []),
      ...(Array.isArray(matchedWifeEvent && matchedWifeEvent.images) ? matchedWifeEvent.images : [])
    ];

    shared.push({
      ...evt,
      type: tag,
      sources: Array.from(new Set(mergedSources.filter(Boolean))),
      images: Array.from(new Set(mergedImages.filter(Boolean))),
      linkedPersons: Array.from(new Set([
        ...(Array.isArray(evt.linkedPersons) ? evt.linkedPersons.map(normalizeLinkedPersonId) : []),
        String(husb.id),
        String(wife.id)
      ].filter(Boolean)))
    });
  }

  return shared;
}

function appendEventSubLines(lines, evt, xrefMap, mediaById, childLevel = 2) {
  if (evt.date) lines.push(`${childLevel} DATE ${formatDateForGedcom(evt.date)}`);
  if (evt.place) lines.push(`${childLevel} PLAC ${escapeGedcomValue(evt.place)}`);

  // Behåll tidigare prioritet: description före note.
  if (evt.description || evt.note) {
    const note = evt.description || evt.note || '';
    pushGedcomMultiline(lines, childLevel, 'NOTE', note);
  }

  // Exportera kopplade personer under händelse som vittnen/medverkande.
  const witnessIds = getEventLinkedPersonIds(evt);
  for (const witnessId of witnessIds) {
    const witnessXref = xrefMap.get(String(witnessId));
    if (witnessXref) {
      lines.push(`${childLevel} WITN @${witnessXref}@`);
    }
  }

  const witnessNotes = getEventLinkedPersonFreeTextNotes(evt, xrefMap);
  for (const witnessNote of witnessNotes) {
    pushGedcomMultiline(lines, childLevel, 'NOTE', witnessNote);
  }

  if (evt.sources && Array.isArray(evt.sources)) {
    for (const srcId of evt.sources) {
      const srcXref = xrefMap.get(srcId) || `S${srcId}`;
      lines.push(`${childLevel} SOUR @${srcXref}@`);
    }
  }

  // Event-specific media under the event block.
  const eventMedia = resolveMediaItems(
    Array.isArray(evt.images) ? evt.images : (Array.isArray(evt.media) ? evt.media : []),
    mediaById
  );
  writeMediaBlocks(lines, childLevel, eventMedia);
}

module.exports = { readGedcom, applyGedcom, writeGedcom };
