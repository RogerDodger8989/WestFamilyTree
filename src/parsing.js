  // Tar en källsträng och returnerar en array med nivåer: Arkiv Digital, Församling, Volym+årtal, Bild/sida (AID)
  export function parseSourceLevels(sourceText) {
    if (!sourceText || typeof sourceText !== 'string') return [];
    const levels = ['Arkiv Digital'];
    // 2. Församling
    let parish = '';
    const parishMatch = sourceText.match(/^([^(]+\([^)]+\))/);
    if (parishMatch) {
      parish = parishMatch[1].trim();
    }
    levels.push(parish);
    // 3. Volym + årtal
    let vol = '';
    const volMatch = sourceText.match(/([A-Z]{1,3}:\d+)(?:\s*\((\d{4}-\d{4})\))?/);
    if (volMatch) {
      vol = volMatch[1];
      if (volMatch[2]) vol += ` (${volMatch[2]})`;
    }
    levels.push(vol);
    // 4. Bild/sida och AID
    let bild = '';
    const bildSidMatch = sourceText.match(/Bild\s*(\d+)(?:\s*\/\s*sid\s*(\d+))?/i);
    if (bildSidMatch) {
      bild = `Bild ${bildSidMatch[1]}`;
      if (bildSidMatch[2]) bild += `/sid ${bildSidMatch[2]}`;
    }
    // AID
    const aidMatch = sourceText.match(/AID:\s*([^,\)]+)/i);
    if (aidMatch) {
      bild += ` (${aidMatch[1].trim()},)`;
    }
    levels.push(bild);
    return levels;
  }
  // Returnerar källinformation som array av nivåer för trädstruktur
  export function buildSourceLevels({ archive, parish, volume, date, imagePage, page, aid, nad }) {
    const levels = [];
    // 1. Arkiv Digital
    levels.push('Arkiv Digital');
    // 2. Församling
    if (parish && parish.trim()) {
      levels.push(parish.trim());
    } else {
      levels.push('');
    }
    // 3. Volym + årtal
    let vol = '';
    if (volume && volume.trim()) {
      vol = volume.trim();
      if (date && !vol.includes(date)) vol += ` (${date})`;
    }
    levels.push(vol);
    // 4. Bild/sida (med AID i parentes)
    let bild = '';
    if (imagePage && imagePage.trim()) {
      bild = imagePage.trim();
      let extra = [];
      if (aid) extra.push(aid);
      // NAD kan tas med om du vill, annars kommentera bort nästa rad
      // if (nad) extra.push(nad);
      if (extra.length) bild += ` (${extra.join(',')})`;
    }
    levels.push(bild);
    return levels;
  }
  // Bygg hierarkisk källsträng av fält
export function buildSourceString({ archive, volume, imagePage, page, aid, nad, raId, bildId, date }) {
  let str = '';
  // Lägg till Arkiv Digital ENDAST om archive är tomt eller inte redan börjar med Arkiv Digital
  if (archive && archive.trim() === 'Arkiv Digital') {
    str += 'Arkiv Digital';
  } else if (archive) {
    str += archive;
  }
  if (volume) str += (str ? ' ' : '') + volume;
  if (date) str += ` (${date})`;
  // Om både Bild X och sid Y finns, ta bara Bild X
  let bild = '';
  if (imagePage) {
    const bildMatch = imagePage.match(/Bild\s*(\d+)/i);
    if (bildMatch) {
      bild = `Bild ${bildMatch[1]}`;
    }
  }
  if (bild) {
    str += `\n${bild}`;
    // Lägg till AID/NAD inom parentes efter bild om de finns
    let extra = [];
    if (aid) extra.push(`AID: ${aid}`);
    if (nad) extra.push(`NAD: ${nad}`);
    if (raId || bildId) extra.push(`BILDID: ${raId || bildId}`);
    if (extra.length) str += ` (${extra.join(', ')})`;
  } else if (raId || bildId) {
    str += `${str ? '\n' : ''}BILDID: ${raId || bildId}`;
  }
  return str.trim();
}
  
export function parseSourceString(sourceText) {
    const result = {
    archiveTop: 'Övrigt',
    archive: '', volume: '', imagePage: '', page: '', aid: '', nad: '', date: '', raId: '', bildId: '', bildid: '',
        note: '', trust: 0, tags: '', title: ''
    };
    if (!sourceText || typeof sourceText !== 'string') return result;

    let text = sourceText.trim();

  // 1. Extrahera AID, NAD, RA-ID/BILDID. Dessa har tydliga mönster.
    const aidMatch = text.match(/(?:AID:\s*|www\.arkivdigital\.se\/aid\/show\/)(v\d+\.b\d+\.s\d+|v\d+\.b\d+|v\d+)/i);
    if (aidMatch) {
        result.aid = aidMatch[1].trim();
        text = text.replace(aidMatch[0], '');
    }

  // NAD kan innehålla mellanslag i serie/volymdelen, t.ex. SE/LLA/13262/A I/14
  // Viktigt: stoppa före årtalsparentes så (1852-1856) kan parsas separat.
  const nadMatch = text.match(/\b(SE\/[A-ZÅÄÖ]{2,}\/[^,\n\(]+)/i);
    if (nadMatch) {
    result.nad = nadMatch[1].replace(/\s{2,}/g, ' ').trim();
        text = text.replace(nadMatch[0], '');
    }

  const raIdMatch = text.match(/(?:RA-bildid\s*:\s*|bild-?id\s*:\s*|sok\.riksarkivet\.se\/bildvisning\/)([A-Z0-9_]+)/i);
    if (raIdMatch) {
        result.raId = raIdMatch[1].trim();
    result.bildId = result.raId;
    result.bildid = result.raId;
        text = text.replace(raIdMatch[0], '');
    }

    // 2. Om AID finns, parsa bild/sida från den
    if (result.aid) {
        const aidParts = result.aid.match(/v\d+\.b(\d+)(?:\.s(\d+))?/);
        if (aidParts) {
            result.imagePage = aidParts[1] || '';
            result.page = aidParts[2] || '';
        }
    }

    // 3. Extrahera "Bild X / sid Y" om det inte redan är parsat från AID
    const bildSidMatch = text.match(/Bild\s*(\d+)(?:\s*\/\s*sid\s*(\d+))?/i);
    if (bildSidMatch) {
        if (!result.imagePage) result.imagePage = bildSidMatch[1];
        if (!result.page) result.page = bildSidMatch[2] || '';
        text = text.replace(bildSidMatch[0], '');
    }

    // 4. Extrahera årtal i spann, t.ex. (1852-1856)
    const yearRangeMatch = text.match(/\((\d{4}\s*-\s*\d{4})\)/);
    if (yearRangeMatch) {
      result.date = yearRangeMatch[1].replace(/\s+/g, '');
      text = text.replace(yearRangeMatch[0], '');
    }

    // 5. Extrahera volym (stöder både CI:9 och A I/14)
    const volMatch = text.match(/\b([A-ZÅÄÖ]{1,4}\s*[IVX]{0,4}\s*[:\/]\s*\d+[a-z]?)\b/i);
    if (volMatch) {
      result.volume = volMatch[1].replace(/\s*:\s*/g, ':').replace(/\s*\/\s*/g, '/').replace(/\s{2,}/g, ' ').trim();
        text = text.replace(volMatch[0], '');
    }

    // Fallback: plocka volym från NAD om den inte hittades i fritexten
    if (!result.volume && result.nad) {
      const nadVolumeMatch = result.nad.match(/\/(?:[^\/]*\/)?([A-ZÅÄÖ]{1,4}\s*[IVX]{0,4}\s*[:\/]\s*\d+[a-z]?)\s*$/i);
      if (nadVolumeMatch) {
        result.volume = nadVolumeMatch[1].replace(/\s*:\s*/g, ':').replace(/\s*\/\s*/g, '/').replace(/\s{2,}/g, ' ').trim();
      }
    }

    // 6. Det som är kvar är troligen arkiv/församling. Rensa bort skräp.
    const cleanedArchive = text
      .replace(/Källa:|Källdetalj:|Notes:|Bild:|bild-?id\s*:/gi, '')
      .replace(/[\(\)]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const archiveParts = cleanedArchive
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    result.archive = archiveParts.join(', ');

    if (result.aid) {
      result.archiveTop = 'Arkiv Digital';
    } else if (result.raId || result.bildId || result.nad) {
      result.archiveTop = 'Riksarkivet';
    }

    // Gammal regex, kan tas bort eller behållas som fallback om den nya inte täcker allt.
    /* const archiveRegex = /^(.+?)\s+(?=[A-Z]{1,3}:\d+)/;
    const archiveMatch = text.match(archiveRegex);
    if (archiveMatch) {
        result.archive = archiveMatch[1].trim();
        text = text.substring(archiveMatch[0].length);
    }

    // 3. Extrahera Volym, Årtal, Bild och Sida från resten
    const mainRegex = /([A-Z]{1,3}:\d+)\s*\((\d{4}-\d{4})\)\s*Bild\s*(\d+)(?:\s*\/\s*sid\s*(\d+))?/;
    const mainMatch = text.match(mainRegex);
    if (mainMatch) {
        result.volume = mainMatch[1];
        result.date = mainMatch[2];
        result.imagePage = mainMatch[3]; // Bara numret för "Bild"
        result.page = mainMatch[4] || ''; // Bara numret för "Sida"
    } */

    // Legacy-kompatibel titel: endast arkiv/titel för att undvika dubblering med volym/år i UI.
    result.title = result.archive || '';

    // Om AID/BILDID finns, sätt högre trovärdighet
    if (result.aid || result.raId) result.trust = 4;

    return result;
}

/**
 * Generates a structured filename and path based on source parts.
 * @param {{archive: string, volume: string, imagePage: string}} sourceParts 
 * @returns {{filename: string, path: string}}
 */
export function generateImagePath(sourceParts) {
  // Funktion för att rensa bort tecken som är ogiltiga i FILNAMN (inte mappar)
  const cleanFilenamePart = (s) => (s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');

  // Diverse-bilder: om archive === 'diverse' eller volume === 'diverse'
  if (sourceParts.archive === 'diverse' || sourceParts.volume === 'diverse') {
    let filename = cleanFilenamePart(sourceParts.filename || 'bild') + '.png';
    return { filename, path: `diverse/${filename}` };
  }
 
  const arc = sourceParts.archive || 'OkäntArkiv';
  const vol = (sourceParts.volume || '').replace(':', '_');
  
  // Bild 60 / sid 1 -> Bild_60-s1 (Ny, smartare logik)
  let pag = '';
  if (sourceParts.imagePage) {
    const bildMatch = sourceParts.imagePage.match(/Bild\s*(\d+)/i);
    const sidMatch = sourceParts.imagePage.match(/sid\s*(\d+)/i);
    
    if (bildMatch) pag += `Bild_${bildMatch[1]}`;
    if (sidMatch) pag += (pag ? '-' : '') + `s${sidMatch[1]}`; // Lägg till "-sX" om det finns en bild-del
  }
  // AID
  let aid = '';
  if (sourceParts.otherInfo) {
    const aidMatch = sourceParts.otherInfo.match(/AID[:\s]*([\w\.]+)/i);
    if (aidMatch) aid = aidMatch[1];
  }
 
  // Bygg filnamnet: Arkiv_Volym_Bild-sid_AID.png
  let filename = `${cleanFilenamePart(arc)}_${vol}`;
  if (pag) filename += `_${pag}`;
  if (aid) filename += `_${aid}`;
  filename = filename.replace(/__+/g, '_') + '.png';
 
  // Bygg path med undermappar (behåll originaltecken i mappnamn)
  let path = `kallor/${arc}`;
  if (vol) path += `/${vol}`;
  path += `/${filename}`;
  return { filename, path };
}

// Mirrors the legacy quick-import parser used in SourceCatalog so all import paths
// can share identical behavior (AD/RA with special handling for BILDID/NAD/volume/date).
export function parseSourceQuickImport(sourceText, places = []) {
  if (!sourceText || !String(sourceText).trim()) return {};

  const text = String(sourceText).trim();
  const upperText = text.toUpperCase();
  let updates = { trust: 4 };

  if (upperText.includes('AID:')) {
    updates.archiveTop = 'Arkiv Digital';
    updates.archive = 'Arkiv Digital';

    const aidMatch = text.match(/AID:\s*([a-zA-Z0-9\.]+)/i);
    if (aidMatch) updates.aid = aidMatch[1];

    const nadMatch = text.match(/NAD:\s*([a-zA-Z0-9\/]+)/i) || text.match(/SE\/[A-Z0-9\/]+/);
    if (nadMatch) updates.nad = nadMatch[0].replace(/NAD:\s*/i, '');

    const bildMatch = text.match(/Bild\s*(\d+)/i);
    if (bildMatch) updates.imagePage = bildMatch[1];

    const sidMatch = text.match(/sid\s*(\d+)/i);
    if (sidMatch) updates.page = sidMatch[1];

    const volMatch = text.match(/([A-Z]+\s*[A-Z]*:[a-z0-9]+)/i);
    if (volMatch) updates.volume = volMatch[1];

    let bestMatch = null;
    const safePlaces = Array.isArray(places) ? places : [];
    for (const place of safePlaces) {
      if (place && place.name && text.startsWith(place.name)) {
        if (!bestMatch || place.name.length > bestMatch.name.length) {
          bestMatch = place;
        }
      }
    }

    if (bestMatch) {
      updates.title = bestMatch.name;
    } else {
      const splitPoint = text.indexOf(updates.volume || '(');
      if (splitPoint > 0) updates.title = text.substring(0, splitPoint).trim();
      else updates.title = 'Okänd Titel';
    }
  } else if (upperText.includes('BILDID:')) {
    updates.archiveTop = 'Riksarkivet';
    updates.archive = 'Riksarkivet';

    const bildIdMatch = text.match(/bildid:\s*([A-Z0-9_]+)/i);
    if (bildIdMatch) {
      updates.bildid = bildIdMatch[1];
      updates.bildId = bildIdMatch[1];
      updates.raId = bildIdMatch[1];
    }

    const nadMatch = text.match(/(SE\/[\w]+\/\d+)/);
    if (nadMatch) updates.nad = nadMatch[1];

    const raVolMatch = text.match(/SE\/[\w]+\/\d+\/([^(,]+)/);
    if (raVolMatch) updates.volume = raVolMatch[1].trim();

    const bildNrMatch = text.match(/_(\d+)$/);
    if (bildNrMatch) updates.imagePage = bildNrMatch[1];

    const commaParts = text.split(',');
    if (commaParts.length > 0) updates.title = commaParts[0].trim();
  }

  const dateMatch = text.match(/\((\d{4}[-–]\d{4})\)/) || text.match(/\((\d{4})\)/);
  if (dateMatch) updates.date = dateMatch[1];

  return updates;
}