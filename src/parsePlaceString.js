// parsePlaceString.js
// Tolkar GEDCOM PLAC-strängar enligt svensk/amerikansk logik och returnerar ett objekt med fält och landskod.

const SWEDEN_KEYWORDS = ['sverige', 'sweden', 'swe'];
const USA_KEYWORDS = ['usa', 'united states', 'amerika', 'america'];
const SWEDEN_LAN_SUFFIX = 'län';
const US_STATE_REGEX = /^[A-Z]{2}$/;


export function parsePlaceString(placString) {
  let usedHeuristics = false;
  if (!placString || typeof placString !== 'string') return { raw: placString, parts: [], usedHeuristics };

  // Hantera fall utan kommatecken (t.ex. "Fresta Stockholms län Sverige")
  let parts = placString.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    // Försök splitta på mellanslag om det finns flera ord
    const wsParts = placString.split(/\s+/).filter(Boolean);
    if (wsParts.length > 2) {
      // Gissa att sista är land, näst sista län/stat
      parts = [];
      let i = wsParts.length - 1;
      // Land
      parts.unshift(wsParts[i]);
      i--;
      // Län/stat
      parts.unshift(wsParts[i]);
      i--;
      // Resten som en del
      if (i >= 0) parts.unshift(wsParts.slice(0, i + 1).join(' '));
      usedHeuristics = true;
    }
  }

  // Land
  let country = parts[parts.length - 1]?.toLowerCase() || '';
  let countryCode = null;
  let type = null;
  if (SWEDEN_KEYWORDS.includes(country)) {
    countryCode = 'SE';
    type = 'sweden';
  } else if (USA_KEYWORDS.includes(country)) {
    countryCode = 'US';
    type = 'usa';
  } else if (country.endsWith(SWEDEN_LAN_SUFFIX)) {
    countryCode = 'SE';
    type = 'sweden';
    usedHeuristics = true;
  } else if (US_STATE_REGEX.test(country)) {
    countryCode = 'US';
    type = 'usa';
    usedHeuristics = true;
  } else {
    // Fler länder/specialfall kan läggas till här
    if (country === 'norge' || country === 'norway' || country === 'no') {
      countryCode = 'NO';
      type = 'norway';
    } else if (country === 'finland' || country === 'suomi' || country === 'fi') {
      countryCode = 'FI';
      type = 'finland';
    }
  }

  // Om land saknas, försök gissa
  if (!type && parts.length > 0) {
    const last = parts[parts.length - 1];
    if (last.endsWith(SWEDEN_LAN_SUFFIX)) {
      countryCode = 'SE';
      type = 'sweden';
      usedHeuristics = true;
    } else if (US_STATE_REGEX.test(last)) {
      countryCode = 'US';
      type = 'usa';
      usedHeuristics = true;
    }
  }

  // Fältmappning
  let result = { raw: placString, parts, countryCode, type, usedHeuristics };
  if (type === 'sweden') {
    // Gård/Torp, By, Socken, Län, Land
    result.land = parts[parts.length - 1] || '';
    result.lan = parts[parts.length - 2] || '';
    result.socken = parts[parts.length - 3] || '';
    result.by = parts[parts.length - 4] || '';
    result.gard = parts[parts.length - 5] || '';
  } else if (type === 'usa') {
    // Stad, County, Stat, Land
    result.land = parts[parts.length - 1] || '';
    result.state = parts[parts.length - 2] || '';
    result.county = parts[parts.length - 3] || '';
    result.city = parts[parts.length - 4] || '';
    result.address = parts[parts.length - 5] || '';
  } else if (type === 'norway') {
    // Exempel: By, Fylke, Land
    result.land = parts[parts.length - 1] || '';
    result.fylke = parts[parts.length - 2] || '';
    result.by = parts[parts.length - 3] || '';
  } else if (type === 'finland') {
    // Exempel: By, Län, Land
    result.land = parts[parts.length - 1] || '';
    result.lan = parts[parts.length - 2] || '';
    result.by = parts[parts.length - 3] || '';
  }
  return result;
}

// Hjälpfunktion för flagg-emoji (kan användas i UI)
export function getFlagEmoji(countryCode) {
  if (!countryCode) return '';
  const code = countryCode.toUpperCase();
  if (code === 'SE') return '🇸🇪';
  if (code === 'US') return '🇺🇸';
  return '';
}
