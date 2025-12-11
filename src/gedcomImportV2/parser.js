// Minimal parser för EN INDI-blocksträng (för felsökning och robusthet)
export function parseIndiBlock(indiBlockText) {
  // Dela upp i rader och trimma
  const lines = indiBlockText.split(/\r?\n/).map(l => l.trim());
  // Hitta GIVN, SURN, SEX
  const givn = (lines.find(l => l.match(/^\d+\s+GIVN\s+/)) || '').replace(/^\d+\s+GIVN\s+/, '').trim();
  const surn = (lines.find(l => l.match(/^\d+\s+SURN\s+/)) || '').replace(/^\d+\s+SURN\s+/, '').trim();
  const sexRaw = (lines.find(l => l.match(/^\d+\s+SEX\s+/)) || '').replace(/^\d+\s+SEX\s+/, '').trim();
  let sex = '';
  if (sexRaw === 'M') sex = 'Man';
  else if (sexRaw === 'F') sex = 'Kvinna';
  else sex = sexRaw;
  return { givn, surn, sex };
}
// GEDCOM Import V2 - Grundparser enligt instruktion
// Skapad: 2025-11-28

// Här byggs parsern stegvis utifrån dina regler

import { parseDateV2, parsePlaceV2, parseLatLongV2 } from "./utils";

// Hjälpfunktion: Extrahera block ur GEDCOM
function extractBlocks(lines, tag) {
  const blocks = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(new RegExp(`^0 @[^@]+@ ${tag}`))) {
      if (current) blocks.push(current);
      current = { start: i, lines: [line] };
    } else if (current) {
      if (line.startsWith('0 ')) {
        blocks.push(current);
        current = null;
      } else {
        current.lines.push(line);
      }
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

// Hjälpfunktion: Hämta subtag-värde
function getSubTag(lines, tag) {
  const re = new RegExp(`^\s*\d+\s+${tag}\s+(.+)$`);
  const found = lines.find(l => re.test(l));
  return found ? found.match(re)[1].trim() : null;
}

// Hjälpfunktion: Hämta alla subtag-värden
function getAllSubTags(lines, tag) {
  const re = new RegExp(`^\s*\d+\s+${tag}\s+(.+)$`);
  return lines.filter(l => re.test(l)).map(l => l.match(re)[1].trim());
}

// Extrahera tiltalsnamn (versaler) ur GIVN
function extractGivenName(givn) {
  if (!givn) return { callName: '', given: '' };
  const match = givn.match(/([A-ZÅÄÖ]+)/);
  return {
    callName: match ? match[1] : '',
    given: givn
  };
}

export function parseGedcomV2(gedcomText) {
  const lines = gedcomText.split(/\r?\n/);
  const individuals = [];
  let sources = [];
  let media = [];

  // Hämta alla INDI-block
  const indiBlocks = extractBlocks(lines, 'INDI');

  for (const block of indiBlocks) {
    const blines = block.lines;
    // REF = individnummer
    const refMatch = blines[0].match(/^0 @(I\d+)@ INDI/);
    const ref = refMatch ? refMatch[1] : null;
    // NAME
    const name = getSubTag(blines, 'NAME');
    // GIVN
    const givn = getSubTag(blines, 'GIVN');
    const { callName, given } = extractGivenName(givn);
    // SURN
    const surn = getSubTag(blines, 'SURN');
    // SEX
    const sex = getSubTag(blines, 'SEX');
    let gender = null;
    if (sex === 'F') gender = 'Kvinna';
    else if (sex === 'M') gender = 'Man';

    // Händelser: BIRT, CHR, DEAT, BURI, RESI, OCCU
    const eventTags = ['BIRT', 'CHR', 'DEAT', 'BURI', 'RESI', 'OCCU'];
    const events = [];
    const localSources = [];
    const localMedia = [];
    for (let i = 0; i < blines.length; i++) {
      const line = blines[i];
      const eventTag = eventTags.find(tag => line.match(new RegExp(`^\s*1 ${tag}`)));
      if (eventTag) {
        // Samla sublines för eventet
        const eventLines = [line];
        let j = i + 1;
        while (j < blines.length && !blines[j].match(/^\s*1 /)) {
          eventLines.push(blines[j]);
          j++;
        }
        // DATE
        const date = getSubTag(eventLines, 'DATE');
        // PLAC
        const place = getSubTag(eventLines, 'PLAC');
        // MAP/LATI/LONG
        let lat = null, long = null;
        for (let k = 0; k < eventLines.length; k++) {
          if (eventLines[k].match(/\bMAP\b/)) {
            // Leta efter LATI och LONG under MAP
            for (let m = k + 1; m < eventLines.length; m++) {
              if (eventLines[m].match(/\bLATI\b/)) lat = eventLines[m].replace(/.*LATI /, '');
              if (eventLines[m].match(/\bLONG\b/)) long = eventLines[m].replace(/.*LONG /, '');
              if (eventLines[m].match(/^\s*\d+ /) && !eventLines[m].match(/LATI|LONG/)) break;
            }
          }
        }
        // SOUR, PAGE, QUAY, OBJE
        const eventSources = [];
        for (let k = 0; k < eventLines.length; k++) {
          if (eventLines[k].match(/\bSOUR /)) {
            const sourLine = eventLines[k];
            const sourRef = sourLine.replace(/.*SOUR /, '').replace(/@/g, '');
            // PAGE
            let page = null, quay = null, obj = null, form = null, titl = null, file = null;
            let l = k + 1;
            while (l < eventLines.length && eventLines[l].match(/^\s*\d+ /) && !eventLines[l].match(/SOUR|OBJE/)) {
              if (eventLines[l].match(/\bPAGE /)) page = eventLines[l].replace(/.*PAGE /, '');
              if (eventLines[l].match(/\bQUAY /)) quay = eventLines[l].replace(/.*QUAY /, '');
              l++;
            }
            // OBJE under SOUR
            for (let m = l; m < eventLines.length; m++) {
              if (eventLines[m].match(/\bOBJE/)) {
                let n = m + 1;
                while (n < eventLines.length && eventLines[n].match(/^\s*\d+ /)) {
                  if (eventLines[n].match(/\bFORM /)) form = eventLines[n].replace(/.*FORM /, '');
                  if (eventLines[n].match(/\bTITL /)) titl = eventLines[n].replace(/.*TITL /, '');
                  if (eventLines[n].match(/\bFILE /)) file = eventLines[n].replace(/.*FILE /, '');
                  n++;
                }
                obj = { form, titl, file };
                localMedia.push({ form, titl, file, linkedTo: ref });
                break;
              }
            }
            eventSources.push({ sourRef, page, quay, obj });
            localSources.push({ sourRef, page, quay, obj, linkedTo: ref });
          }
        }
        // OBJE direkt under event
        for (let k = 0; k < eventLines.length; k++) {
          if (eventLines[k].match(/\bOBJE/)) {
            let form = null, titl = null, file = null;
            let l = k + 1;
            while (l < eventLines.length && eventLines[l].match(/^\s*\d+ /)) {
              if (eventLines[l].match(/\bFORM /)) form = eventLines[l].replace(/.*FORM /, '');
              if (eventLines[l].match(/\bTITL /)) titl = eventLines[l].replace(/.*TITL /, '');
              if (eventLines[l].match(/\bFILE /)) file = eventLines[l].replace(/.*FILE /, '');
              l++;
            }
            localMedia.push({ form, titl, file, linkedTo: ref });
          }
        }
        // Konvertera plats och koordinater
        const parsedPlace = place ? parsePlaceV2(place) : null;
        const parsedDate = date ? parseDateV2(date) : null;
        const parsedLatLong = (lat && long) ? parseLatLongV2(lat, long) : null;
        events.push({
          type: eventTag,
          date: parsedDate,
          place: parsedPlace,
          lat: parsedLatLong ? parsedLatLong.lat : null,
          long: parsedLatLong ? parsedLatLong.long : null,
          sources: eventSources
        });
        i = j - 1;
      }
    }

    // OBJE på individnivå
    for (let i = 0; i < blines.length; i++) {
      if (blines[i].match(/\bOBJE/)) {
        let form = null, titl = null, file = null;
        let l = i + 1;
        while (l < blines.length && blines[l].match(/^\s*\d+ /)) {
          if (blines[l].match(/\bFORM /)) form = blines[l].replace(/.*FORM /, '');
          if (blines[l].match(/\bTITL /)) titl = blines[l].replace(/.*TITL /, '');
          if (blines[l].match(/\bFILE /)) file = blines[l].replace(/.*FILE /, '');
          l++;
        }
        media.push({ form, titl, file, linkedTo: ref });
      }
    }

    // NOTE och DATA.TEXT/CONT
    const notes = [];
    for (let i = 0; i < blines.length; i++) {
      if (blines[i].match(/\bNOTE/)) {
        let noteText = blines[i].replace(/.*NOTE ?/, '');
        let html = noteText;
        let l = i + 1;
        while (l < blines.length && (blines[l].match(/\bCONT\b/) || blines[l].match(/\bCONC\b/))) {
          if (blines[l].match(/\bCONT\b/)) {
            html += '<br>' + blines[l].replace(/.*CONT ?/, '');
          } else if (blines[l].match(/\bCONC\b/)) {
            html += blines[l].replace(/.*CONC ?/, '');
          }
          l++;
        }
        notes.push({ ref, html });
      }
      // DATA.TEXT/CONT
      if (blines[i].match(/\bDATA\b/)) {
        let l = i + 1;
        let html = '';
        while (l < blines.length && (blines[l].match(/\bTEXT\b/) || blines[l].match(/\bCONT\b/))) {
          if (blines[l].match(/\bTEXT\b/)) {
            html += blines[l].replace(/.*TEXT ?/, '');
          } else if (blines[l].match(/\bCONT\b/)) {
            html += '<br>' + blines[l].replace(/.*CONT ?/, '');
          }
          l++;
        }
        if (html) notes.push({ ref, html });
      }
    }


    individuals.push({
      REF: ref,
      NAME: name,
      GIVN: given,
      CALLNAME: callName,
      SURN: surn,
      SEX: gender,
      EVENTS: events,
      NOTES: notes
    });
    sources = sources.concat(localSources);
    media = media.concat(localMedia);
  }

  // Samla alla notes globalt också
  let allNotes = [];
  individuals.forEach(ind => {
    if (ind.NOTES && ind.NOTES.length > 0) {
      allNotes = allNotes.concat(ind.NOTES);
    }
  });
  return {
    individuals: individuals || [],
    sources: sources || [],
    media: media || [],
    events: [],
    notes: allNotes || []
  };
}
