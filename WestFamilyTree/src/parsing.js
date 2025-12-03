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
export function buildSourceString({ archive, volume, imagePage, page, aid, nad, date }) {
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
    if (extra.length) str += ` (${extra.join(', ')})`;
  }
  return str.trim();
}
  
export function parseSourceString(sourceText) {
    const result = {
        archive: '', volume: '', imagePage: '', page: '', aid: '', nad: '', date: '', raId: '',
        note: '', trust: 0, tags: '', title: ''
    };
    if (!sourceText || typeof sourceText !== 'string') return result;

    let text = sourceText.trim();

    // 1. Extrahera AID, NAD, RA-ID. Dessa har tydliga mönster.
    const aidMatch = text.match(/(?:AID:\s*|www\.arkivdigital\.se\/aid\/show\/)(v\d+\.b\d+\.s\d+|v\d+\.b\d+|v\d+)/i);
    if (aidMatch) {
        result.aid = aidMatch[1].trim();
        text = text.replace(aidMatch[0], '');
    }
    const nadMatch = text.match(/(SE\/[A-Z]{2,}\/[^\s,]+)/i);
    if (nadMatch) {
        result.nad = nadMatch[1].trim();
        text = text.replace(nadMatch[0], '');
    }
    const raIdMatch = text.match(/(?:RA-bildid:\s*|sok\.riksarkivet\.se\/bildvisning\/)([A-Z0-9_]+)/i);
    if (raIdMatch) {
        result.raId = raIdMatch[1].trim();
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

    // 4. Extrahera Volym och Årtal, t.ex. "CI:9 (1930-1939)"
    const volMatch = text.match(/([A-Z]{1,4}:\d+[a-z]?)\s*(?:\((\d{4}-\d{4})\))?/);
    if (volMatch) {
        result.volume = volMatch[1].trim();
        result.date = volMatch[2] || '';
        text = text.replace(volMatch[0], '');
    }

    // 5. Det som är kvar är troligen arkiv/församling. Rensa bort skräp.
    result.archive = text.replace(/Källa:|Källdetalj:|Notes:|Bild:/gi, '').replace(/[,]/g, ' ').trim();

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

    // Sätt en generell titel för källan
    result.title = [result.archive, result.volume, result.date ? `(${result.date})` : ''].filter(Boolean).join(' ').trim();

    // Om AID finns, sätt trovärdighet till 4 (Förstahandsuppgift)
    if (result.aid) result.trust = 4;

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