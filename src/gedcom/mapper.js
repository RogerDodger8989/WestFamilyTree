// Enkel mappnings-skeleton: konverterar parsed GEDCOM (från parse-gedcom)
// till en minimal `dbData`-liknande struktur som appen kan använda.
// Den här filen innehåller grundläggande heuristik och XREF-bevarande för
// senare matching. Den är medvetet konservativ — förbättra heuristikerna
// i efterföljande iterationer.

import { parseSourceString } from '../parsing.js';

function _getTag(n) {
  return n && (n.tag || n.type || null);
}

function _getValue(n) {
  if (!n) return null;
  return n.value || n.data || n.text || n._ || n.pointer || null;
}

function normalizeXref(x) {
  if (!x && x !== 0) return null;
  let s = x;
  if (typeof s === 'object') {
    // common parser shapes sometimes store the xref under nested fields
    // like `data.xref_id`, `data.xref` or `pointer`. Check those first.
    s = s.xref_id || s.xref || s.pointer || s.id || _getValue(s) || '';
  }
  s = String(s || '').trim();
  // remove surrounding @ if present
  if (s.startsWith('@') && s.endsWith('@')) s = s.slice(1, -1);
  // Some parsers return pointers like "@I1@" or just "I1"; normalize to plain id
  return s || null;
}

function valueToString(v) {
  if (v === null || typeof v === 'undefined') return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    // prefer common text fields
    return v.value || v.text || v.name || v.TITL || v.FILE || JSON.stringify(v);
  }
  return String(v);
}

function findNodeByXref(allNodes, xref) {
  if (!allNodes || !xref) return null;
  const norm = normalizeXref(xref);
  return allNodes.find(n => normalizeXref(n.xref || n.id || _getValue(n)) === norm) || null;
}

function compileNoteText(noteNode, allNodes, visited) {
  // Assemble NOTE text including CONT/CONC and following pointer resolution
  if (!noteNode) return '';
  // visited: a Set of normalized xrefs already visited to avoid cycles
  const seen = visited || new Set();
  // base value may be a pointer object like { pointer: '@T123@' }
  const baseRaw = _getValue(noteNode);
  let base = '';
  // If this node itself has an xref/id, mark it as seen to avoid self-references
  try {
    const selfX = normalizeXref(noteNode.xref || noteNode.id || _getValue(noteNode));
    if (selfX) seen.add(selfX);
  } catch (e) {
    // ignore
  }
  // Handle object pointer shapes
  if (baseRaw && typeof baseRaw === 'object') {
    if (baseRaw.pointer || baseRaw.xref) {
      const ref = findNodeByXref(allNodes, baseRaw.pointer || baseRaw.xref || baseRaw.id);
      const refKey = ref ? normalizeXref(ref.xref || ref.id || _getValue(ref)) : null;
      if (ref && refKey && !seen.has(refKey)) {
        seen.add(refKey);
        base = compileNoteText(ref, allNodes, seen);
      }
    }
    if (!base) base = valueToString(baseRaw);
  } else if (typeof baseRaw === 'string') {
    const s = baseRaw.trim();
    // If string contains multiple JSON-pointer lines, handle each
    if (s.indexOf('\n') !== -1) {
      const parts = s.split(/\r?\n/).map(line => {
        const L = line.trim();
        if (!L) return '';
        try {
          const parsed = JSON.parse(L);
          if (parsed && (parsed.pointer || parsed.xref)) {
            const ref = findNodeByXref(allNodes, parsed.pointer || parsed.xref);
            const refKey = ref ? normalizeXref(ref.xref || ref.id || _getValue(ref)) : null;
            if (ref && refKey && !seen.has(refKey)) {
              seen.add(refKey);
              return compileNoteText(ref, allNodes, seen);
            }
          }
          return valueToString(parsed);
        } catch (e) {
          // not JSON, check if looks like a pointer
          if (L.startsWith('@') && L.endsWith('@')) {
            const ref = findNodeByXref(allNodes, L);
            if (ref) return compileNoteText(ref, allNodes, seen);
          }
          return L;
        }
      }).filter(Boolean);
      base = parts.join('\n');
    } else {
      // single-line: maybe JSON string with pointer
      let handled = false;
      if (s.startsWith('{') && s.endsWith('}')) {
        try {
          const parsed = JSON.parse(s);
          if (parsed && (parsed.pointer || parsed.xref)) {
            const ref = findNodeByXref(allNodes, parsed.pointer || parsed.xref);
            const refKey = ref ? normalizeXref(ref.xref || ref.id || _getValue(ref)) : null;
            if (ref && refKey && !seen.has(refKey)) {
              seen.add(refKey);
              base = compileNoteText(ref, allNodes, seen);
              handled = true;
            }
          }
          if (!handled) base = valueToString(parsed);
        } catch (e) {
          // fallthrough
        }
      }
      if (!handled && !base) {
        if (s.startsWith('@') && s.endsWith('@')) {
          const ref = findNodeByXref(allNodes, s);
          const refKey = ref ? normalizeXref(ref.xref || ref.id || _getValue(ref)) : null;
          if (ref && refKey && !seen.has(refKey)) {
            seen.add(refKey);
            base = compileNoteText(ref, allNodes, seen);
          }
        }
      }
        if (!base) base = valueToString(baseRaw || '');
    }
  } else {
    base = valueToString(baseRaw || '');
  }

  // assemble CONT/CONC children
  const contChildren = (noteNode.children || []).filter(ch => _getTag(ch) === 'CONT' || _getTag(ch) === 'CONC');
  let assembled = base || '';
  for (const cc of contChildren) {
    const tag = _getTag(cc);
    const val = valueToString(_getValue(cc)) || '';
    if (tag === 'CONC') assembled += val;
    else if (tag === 'CONT') assembled += '\n' + val;
  }
  // Convert multiple paragraphs into newline-separated string
  // Post-process assembled text: replace any JSON-pointer substrings or plain pointer tokens
  // with the resolved note text (helps when parsers left pointer JSON as literal strings).
  try {
    let out = assembled || '';
    // Replace JSON objects that include a "pointer" or "xref" field
    out = out.replace(/\{[^}]*\"(?:pointer|xref)\"\s*:\s*\"([^\"]+)\"[^}]*\}/g, (match, p1) => {
      try {
        const ref = findNodeByXref(allNodes, p1);
        const refKey = ref ? normalizeXref(ref.xref || ref.id || _getValue(ref)) : null;
        if (ref && refKey && !seen.has(refKey)) {
          seen.add(refKey);
          return compileNoteText(ref, allNodes, seen) || '';
        }
      } catch (e) {}
      return match;
    });
    // Replace standalone pointer tokens like @T5229@
    out = out.replace(/@[^@\s]+@/g, (tok) => {
      try {
        const ref = findNodeByXref(allNodes, tok);
        const refKey = ref ? normalizeXref(ref.xref || ref.id || _getValue(ref)) : null;
        if (ref && refKey && !seen.has(refKey)) {
          seen.add(refKey);
          return compileNoteText(ref, allNodes, seen) || '';
        }
      } catch (e) {}
      return tok;
    });
    return out || '';
  } catch (e) {
    return assembled || '';
  }
}

function quayToText(q) {
  const n = Number(q);
  if (Number.isNaN(n)) return '';
  if (n <= 0) return 'Ingen trovärdighet';
  if (n === 1) return 'Opålitlig uppgift';
  if (n === 2) return 'Andrahandsuppgift';
  if (n >= 3) return 'Förstahandsuppgift';
  return '';
}

function extractValue(node, tag) {
  if (!node || !node.children) return null;
  const child = node.children.find(c => _getTag(c) === tag);
  return child ? _getValue(child) : null;
}

function parseName(nameNode) {
  // nameNode.value kan vara "Given /Surname/"
  if (!nameNode) return { given: '', surname: '' };
  const raw = valueToString(_getValue(nameNode));
  // GEDCOM uses slashes around surname: "GIVEN /SURNAME/"
  const m = raw.match(/^(.*?)\s*\/(.*)\//);
  if (m) {
    return { given: (m[1] || '').trim(), surname: (m[2] || '').trim() };
  }
  // fallback: split on last space
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { given: parts[0], surname: '' };
  return { given: parts.slice(0, -1).join(' '), surname: parts.slice(-1)[0] };
}

function collectNodes(root) {
  const out = [];
  const stack = Array.isArray(root) ? [...root] : [root];
  while (stack.length) {
    const n = stack.shift();
    if (!n) continue;
    // If this node has a tag/type, treat it as a GEDCOM node
    if (_getTag(n)) out.push(n);
    // If node has children, push them
    const children = n.children || n.records || n.items || null;
    if (children && Array.isArray(children)) {
      for (const c of children) stack.push(c);
    }
  }
  return out;
}

function mapIndividuals(parsedNodes, all) {
      // DEBUG: logga alla taggar för denna person
      if (typeof window !== 'undefined' && window.console) {
        const tags = (node.children || []).map(c => _getTag(c));
        console.log('GEDCOM INDI xref', xref, 'tags:', tags);
      }
  const individuals = [];
  const allNodes = all || collectNodes(parsedNodes || []);
  const indiNodes = allNodes.filter(n => _getTag(n) === 'INDI');
  // citations collected from event/fam source citations
  const citations = [];
  for (const node of indiNodes) {
    const xref = normalizeXref(node.xref || node.id || _getValue(node));
    const children = node.children || [];
    // Hämta första GIVN, SURN, SEX direkt bland barnen
    const givnNode = children.find(c => _getTag(c) === 'GIVN');
    const surnNode = children.find(c => _getTag(c) === 'SURN');
    const sexNode = children.find(c => _getTag(c) === 'SEX');
    const given = givnNode ? valueToString(_getValue(givnNode)).trim() : '';
    const surname = surnNode ? valueToString(_getValue(surnNode)).trim() : '';
    const sex = sexNode ? valueToString(_getValue(sexNode)).trim() : '';
      // events: look for nodes with tags like BIRT, DEAT, BURI, MARR
      const events = children.filter(c => ['BIRT', 'DEAT', 'BURI', 'CHR', 'BAPT'].includes(c.tag)).map(ev => {
        const date = valueToString(extractValue(ev, 'DATE')) || null;
        const place = valueToString(extractValue(ev, 'PLAC')) || null;

        // --- Platsmatchning: försök hitta placeId ---
        let placeId = null;
        if (place) {
          const parsed = parsePlaceString(place);
          // Enkel match: Sverige, län, socken, by, gård
          placeId = (places.find(p =>
            (p.land || '').toLowerCase() === (parsed.land || '').toLowerCase() &&
            (!p.lan || (p.lan || '').toLowerCase() === (parsed.lan || '').toLowerCase()) &&
            (!p.socken || (p.socken || '').toLowerCase() === (parsed.socken || '').toLowerCase()) &&
            (!p.by || (p.by || '').toLowerCase() === (parsed.by || '').toLowerCase()) &&
            (!p.gard || (p.gard || '').toLowerCase() === (parsed.gard || '').toLowerCase())
          ) || {}).id || null;
          // USA-matchning
          if (!placeId && parsed.type === 'usa') {
            placeId = (places.find(p =>
              (p.land || '').toLowerCase() === (parsed.land || '').toLowerCase() &&
              (!p.state || (p.state || '').toLowerCase() === (parsed.state || '').toLowerCase()) &&
              (!p.county || (p.county || '').toLowerCase() === (parsed.county || '').toLowerCase()) &&
              (!p.city || (p.city || '').toLowerCase() === (parsed.city || '').toLowerCase())
            ) || {}).id || null;
          }
        }

        // collect SOUR pointers attached to this event (may be multiple)
        const srcChildren = (ev.children || []).filter(c => _getTag(c) === 'SOUR');
        const srcs = [];
        for (const s of srcChildren) {
          const sref = normalizeXref(_getValue(s) || s.pointer || s.xref || null);
          if (sref) srcs.push(sref);
          // extract citation-level details if present
          const page = valueToString(extractValue(s, 'PAGE')) || null;
          // date often stored under DATA/DATE
          const dataNode = (s.children || []).find(ch => _getTag(ch) === 'DATA');
          const dateC = dataNode ? valueToString(extractValue(dataNode, 'DATE')) : (valueToString(extractValue(s, 'DATE')) || null);
          const quay = valueToString(extractValue(s, 'QUAY')) || null;
          // NOTE may be split using CONT/CONC under the NOTE node(s)
          const noteNodes = (s.children || []).filter(ch => _getTag(ch) === 'NOTE');
          let noteText = '';
          for (const nn of noteNodes) {
            const assembled = compileNoteText(nn, allNodes, new Set());
            if (noteText) noteText += '\n' + assembled; else noteText = assembled;
          }
          // OBJE children under the SOUR citation
          const objeFiles = (s.children || []).filter(ch => _getTag(ch) === 'OBJE').map(objNode => {
            const fnode = (objNode.children || []).find(c => _getTag(c) === 'FILE');
            const rawVal = _getValue(fnode) || _getValue(objNode) || null;
            return valueToString(rawVal).trim();
          }).filter(Boolean);
          // push a citation entry
          citations.push({ sourceXref: sref || null, page: page || null, date: dateC || null, quay: quay || null, quayText: quayToText(quay), note: noteText || null, images: objeFiles, raw: s, origin: 'gedcom', archiveTop: 'Övrigt' });
        }
        // Return event med placeId om vi hittade match
        return { type: ev.tag, date, place, placeId, sourceXrefs: srcs };
      });
    const notes = children.filter(c => _getTag(c) === 'NOTE').map(n => compileNoteText(n, allNodes, new Set()) || '').join('\n');
    // media/objects attached to this individual
    const media = children
      .filter(c => _getTag(c) === 'OBJE')
      .map(objNode => {
        const fchild = (objNode.children || []).find(ch => _getTag(ch) === 'FILE');
        const tchild = (objNode.children || []).find(ch => _getTag(ch) === 'TITL');
        const rawFile = _getValue(fchild) || _getValue(objNode) || null;
        const rawTitle = _getValue(tchild) || null;
        return { file: valueToString(rawFile).trim() || null, title: valueToString(rawTitle).trim() || null, raw: objNode };
      });

    individuals.push({
      xref,
      firstName: given,
      lastName: surname,
      gender: sex,
      events,
      notes,
      media,
      raw: node
    });
  }
  // attach citations to the result as a convenience
  // Note: mapParsedGedcom will include these citations in its return value
  individuals._citations = citations;
  return individuals;
}

function mapFamilies(parsedNodes) {
  const all = collectNodes(parsedNodes || []);
  const famNodes = all.filter(n => _getTag(n) === 'FAM');
  const families = famNodes.map(node => {
    const xref = normalizeXref(node.xref || node.id || _getValue(node));
    const husband = (node.children || []).find(c => _getTag(c) === 'HUSB');
    const wife = (node.children || []).find(c => _getTag(c) === 'WIFE');
    const children = (node.children || []).filter(c => _getTag(c) === 'CHIL').map(c => normalizeXref(_getValue(c) || c.xref || c.value)).filter(Boolean);
    const marr = (node.children || []).find(c => _getTag(c) === 'MARR');
    const marrDate = marr ? extractValue(marr, 'DATE') : null;
    // collect any SOUR pointers attached to the marriage node
    const marrSources = (marr && marr.children) ? (marr.children || []).filter(c => _getTag(c) === 'SOUR').map(s => normalizeXref(_getValue(s) || s.pointer || s.xref || null)).filter(Boolean) : [];
    const husbandRef = husband ? normalizeXref(_getValue(husband) || husband.xref || husband.value) : null;
    const wifeRef = wife ? normalizeXref(_getValue(wife) || wife.xref || wife.value) : null;
    return { xref, husband: husbandRef, wife: wifeRef, children, marrDate, marrSourceXrefs: marrSources, raw: node };
  });
  return families;
}

function mapSources(parsedNodes) {
  const all = collectNodes(parsedNodes || []);
  const srcNodes = all.filter(n => _getTag(n) === 'SOUR');
  return srcNodes.map(n => {
    const rawTitle = extractValue(n, 'TITL') || _getValue(n) || '';
    const title = valueToString(rawTitle).trim();
    const author = valueToString(extractValue(n, 'AUTH') || '').trim();
    const publisher = valueToString(extractValue(n, 'PUBL') || '').trim();
    const repo = valueToString(extractValue(n, 'REPO') || '').trim();
    // Try to parse known Arkiv Digital style source strings into structured fields
    const parsed = parseSourceString(title || '');
    // collect media attached to source
    const media = (n.children || []).filter(c => _getTag(c) === 'OBJE').map(objNode => {
      const fchild = (objNode.children || []).find(ch => _getTag(ch) === 'FILE');
      const tchild = (objNode.children || []).find(ch => _getTag(ch) === 'TITL');
      const rawFile = _getValue(fchild) || _getValue(objNode) || null;
      const rawTitleMedia = _getValue(tchild) || null;
      return {
        file: valueToString(rawFile).trim() || null,
        title: valueToString(rawTitleMedia).trim() || null,
        raw: objNode
      };
    });
    return {
      xref: normalizeXref(n.xref || n.id || _getValue(n)),
      title,
      author,
      publisher,
      repo,
      media,
      origin: 'gedcom',
      archiveTop: 'Övrigt',
      // populated parsed fields
      archive: parsed.archive || '',
      volume: parsed.volume || '',
      imagePage: parsed.imagePage || '',
      page: parsed.page || '',
      aid: parsed.aid || '',
      date: parsed.date || '',
      raw: n
    };
  });
}

// Main mapper: return an object { people, families, sources }
function mapParsedGedcom(parsed) {
  const all = collectNodes(parsed || []);
  const people = mapIndividuals(parsed, all);
  const families = mapFamilies(parsed);
  const sources = mapSources(parsed);
  // collect any citations that mapIndividuals gathered
  const citations = (Array.isArray(people) && people._citations) ? people._citations : [];
  return { people, families, sources, citations };
}
export { mapParsedGedcom };
export default mapParsedGedcom;
