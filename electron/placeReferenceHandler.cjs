const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const SWEDEN_KEYWORDS = new Set(['sverige', 'sweden', 'se']);
const USA_KEYWORDS = new Set(['usa', 'united states', 'united states of america', 'us']);
const REFERENCE_FILES = [
  path.resolve(__dirname, '../docs/svenska-orter.json'),
  path.resolve(__dirname, '../docs/us_cities_states_counties.csv')
];

function assertNotReferenceFile(filePath) {
  const resolved = path.resolve(filePath);
  if (REFERENCE_FILES.includes(resolved)) {
    throw new Error('[placeReferenceHandler] Försök att skriva till readonly-referensfil: ' + resolved);
  }
}

const stateAbbrevToName = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico'
};

const placeReferenceState = {
  loaded: false,
  sweden: [],
  usa: [],
  index: []
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === '|' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((s) => String(s || '').trim());
}

function ensureCountySuffix(county) {
  const c = String(county || '').trim();
  if (!c) return '';
  return c; // Vi litar på din sträng direkt nu, utan att lägga till eller ändra något.
}

function buildSwedenLabel(place) {
  const locality = place.parish || place.village || '';
  const localityLabel = locality
    ? (/forsamling|församling|socken/i.test(locality) ? locality : `${locality} församling`)
    : 'Okand ort';
  return `${localityLabel} (${place.municipality || 'okand kommun'}, ${place.region || 'okant lan'})`;
}

function buildUsLabel(place) {
  return `${place.village || place.parish || 'Unknown city'} (${place.municipality || 'Unknown county'}, ${place.region || 'Unknown state'})`;
}

function parseSwedishPlac(parts) {
  const clean = parts.map((p) => String(p || '').trim()).filter(Boolean);
  const res = { specific: '', village: '', parish: '', municipality: '', region: '', country: 'Sverige' };
  
  if (clean.length === 0) return res;

  const countryTranslations = {
    'sweden': 'Sverige', 'denmark': 'Danmark', 'norway': 'Norge', 'finland': 'Finland', 'germany': 'Tyskland', 'usa': 'USA', 'united states': 'USA'
  };

  // 1. Land
  const last = clean[clean.length - 1].toLowerCase();
  if (countryTranslations[last] || SWEDEN_KEYWORDS.has(last)) {
    res.country = countryTranslations[last] || 'Sverige';
    clean.pop();
  }

  // 2. Region (Län) - Vi letar nu efter kristianstad etc direkt här
  const regionIdx = clean.findIndex(p => / län| lan/i.test(p) || /kristianstad|malmöhus|län\s*\([A-Z]+\)/i.test(p.toLowerCase()));
  if (regionIdx !== -1) {
    res.region = clean.splice(regionIdx, 1)[0];
    res.country = 'Sverige';
  }

  // 3. Specialhantering för begravningsplatser
  const cemeteryKeywords = /kyrkogård|kyrkogard|minneslund|gravplats/i;
  const cemeteryIdx = clean.findIndex(p => cemeteryKeywords.test(p));
  if (cemeteryIdx !== -1) {
    res.specific = clean.splice(cemeteryIdx, 1)[0];
  }

  // 4. Identifiera Församling (Parish)
  const parishIdx = clean.findIndex(p => / församling| forsamling| socken/i.test(p));
  if (parishIdx !== -1) {
    res.parish = clean.splice(parishIdx, 1)[0];
  }

  // 5. Gatuadresser (namn + nummer eller nyckelord)
  // Vi letar nu efter allt som ser ut som en gata, väg eller har ett nummer
  const addressKeywords = /gatan|vägen|gränd|stig|plats|torg|allé|alle|väg|gata|g\./i;
  const addressIdx = clean.findIndex(p => /\d+/.test(p) || addressKeywords.test(p));
  if (addressIdx !== -1) {
    const addr = clean.splice(addressIdx, 1)[0];
    res.specific = res.specific ? `${addr}, ${res.specific}` : addr;
  }

  // 6. Resterande delar (Municipality & Village)
  if (clean.length > 0) {
    const lastPart = clean.pop();
    res.municipality = lastPart;
    if (!res.parish) res.parish = lastPart;
    // Sätt även ortnamnet som village så att vi kan bygga en nivå för det i trädet
    res.village = lastPart;
    
    // Om vi har resterande delar (som inte fångats av adress-indexet), lägg till dem i specific
    if (clean.length > 0) {
      const remaining = clean.join(', ');
      res.specific = res.specific ? `${remaining}, ${res.specific}` : remaining;
    }
  }

  return res;
}

function parseUsPlac(parts) {
  const clean = parts.map((p) => String(p || '').trim()).filter(Boolean);
  const n = clean.length;
  return {
    specific: n > 4 ? clean.slice(0, n - 4).join(', ') : '',
    village: n > 3 ? clean[n - 4] : '',
    parish: n > 3 ? clean[n - 4] : '',
    municipality: n > 2 ? clean[n - 3] : '',
    region: n > 1 ? clean[n - 2] : '',
    country: n > 0 ? clean[n - 1] : 'USA'
  };
}

function scoreSwedenEntry(partsNorm, entry) {
  const localityNorm = normalizeText(entry.locality);
  const municipalityNorm = normalizeText(entry.municipality);
  const countyNorm = normalizeText(entry.county);

  let score = 0;
  if (partsNorm.includes(localityNorm)) score += 5;
  if (partsNorm.includes(municipalityNorm)) score += 3;
  if (partsNorm.includes(countyNorm)) score += 3;

  const hay = partsNorm.join(' | ');
  if (localityNorm && hay.includes(localityNorm)) score += 2;
  if (municipalityNorm && hay.includes(municipalityNorm)) score += 1;
  if (countyNorm && hay.includes(countyNorm)) score += 1;

  const perfect = partsNorm.includes(localityNorm) && (partsNorm.includes(municipalityNorm) || partsNorm.includes(countyNorm));
  return { score, perfect };
}

function scoreUsEntry(partsNorm, entry) {
  const cityNorm = normalizeText(entry.city);
  const aliasNorm = normalizeText(entry.alias);
  const countyNorm = normalizeText(entry.county);
  const stateNorm = normalizeText(entry.state);
  const stateShortNorm = normalizeText(entry.stateShort);

  let score = 0;
  if (partsNorm.includes(cityNorm) || (aliasNorm && partsNorm.includes(aliasNorm))) score += 5;
  if (partsNorm.includes(countyNorm)) score += 3;
  if (partsNorm.includes(stateNorm) || partsNorm.includes(stateShortNorm)) score += 3;

  const hay = partsNorm.join(' | ');
  if (cityNorm && hay.includes(cityNorm)) score += 2;
  if (aliasNorm && hay.includes(aliasNorm)) score += 1;
  if (countyNorm && hay.includes(countyNorm)) score += 1;

  const perfect = (partsNorm.includes(cityNorm) || (aliasNorm && partsNorm.includes(aliasNorm)))
    && partsNorm.includes(countyNorm)
    && (partsNorm.includes(stateNorm) || partsNorm.includes(stateShortNorm));
  return { score, perfect };
}

function normalizeCountyName(value) {
  return String(value || '').replace(/\s+county$/i, '').trim();
}

function getCountryHint(partsNorm) {
  for (const part of partsNorm) {
    if (SWEDEN_KEYWORDS.has(part) || part.endsWith(' län') || part.endsWith(' lan')) return 'SE';
    if (USA_KEYWORDS.has(part) || /^[a-z]{2}$/.test(part)) return 'US';
  }
  return null;
}

function createPlaceFromSwedenEntry(entry, parsedPlac = {}) {
  const parishOrLocality = parsedPlac.parish || entry.locality || '';
  return {
    country: 'Sverige',
    region: ensureCountySuffix(parsedPlac.region || entry.county),
    municipality: parsedPlac.municipality || entry.municipality || '',
    parish: parishOrLocality,
    village: parsedPlac.village || (parishOrLocality && !/forsamling|församling|socken/i.test(parishOrLocality) ? parishOrLocality : ''),
    specific: parsedPlac.specific || '',
    latitude: parsedPlac.latitude || entry.lat, // Prioritera användarens koordinater om de finns
    longitude: parsedPlac.longitude || entry.lon,
    source: 'reference-sweden'
  };
}

function createPlaceFromUsEntry(entry, parsedPlac = {}) {
  const stateName = entry.state || stateAbbrevToName[entry.stateShort] || entry.stateShort || parsedPlac.region || '';
  const city = parsedPlac.village || parsedPlac.parish || entry.alias || entry.city || '';
  return {
    country: 'USA',
    region: stateName,
    municipality: normalizeCountyName(entry.county || parsedPlac.municipality),
    parish: city,
    village: city,
    specific: parsedPlac.specific || '',
    source: 'reference-usa'
  };
}

function mapPlacStringToStructuredPlace(placString) {
  const raw = String(placString || '').trim();
  if (!raw) {
    return { matched: false, confidence: 'none', place: null, countryHint: null, raw: placString };
  }

  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const partsNorm = parts.map((p) => normalizeText(p));
  const countryHint = getCountryHint(partsNorm);

  let best = null;
  if (countryHint !== 'US') {
    for (const se of placeReferenceState.sweden) {
      const scored = scoreSwedenEntry(partsNorm, se);
      if (!best || scored.score > best.score) {
        best = { kind: 'SE', entry: se, score: scored.score, perfect: scored.perfect };
      }
    }
  }

  if (countryHint !== 'SE') {
    for (const us of placeReferenceState.usa) {
      const scored = scoreUsEntry(partsNorm, us);
      if (!best || scored.score > best.score) {
        best = { kind: 'US', entry: us, score: scored.score, perfect: scored.perfect };
      }
    }
  }

  if (!best || best.score < 4) {
    const parsed = countryHint === 'US' ? parseUsPlac(parts) : parseSwedishPlac(parts);
    return { 
      matched: false, 
      confidence: 'low', 
      ...parsed, // Flattened
      countryHint, 
      raw: placString 
    };
  }

  if (best.kind === 'SE') {
    const parsed = parseSwedishPlac(parts);
    const place = createPlaceFromSwedenEntry(best.entry, parsed);
    return {
      matched: true,
      confidence: best.perfect ? 'perfect' : 'partial',
      ...place, // Flattened
      normalizedLabel: buildSwedenLabel(place),
      reference: { type: 'sweden', entry: best.entry },
      raw: placString
    };
  }

  const parsed = parseUsPlac(parts);
  const place = createPlaceFromUsEntry(best.entry, parsed);
  return {
    matched: true,
    confidence: best.perfect ? 'perfect' : 'partial',
    ...place, // Flattened
    normalizedLabel: buildUsLabel(place),
    reference: { type: 'usa', entry: best.entry },
    raw: placString
  };
}

async function initPlaceReferenceLibrary(docsDir) {
  if (placeReferenceState.loaded) return { loaded: true, counts: { sweden: placeReferenceState.sweden.length, usa: placeReferenceState.usa.length } };

  const baseDir = docsDir || path.join(__dirname, '..', 'docs');
  const swedishPath = path.join(baseDir, 'svenska-orter.json');
  const usaPath = path.join(baseDir, 'us_cities_states_counties.csv');

  const swRaw = await fs.promises.readFile(swedishPath, 'utf8');
  const swJson = JSON.parse(swRaw);
  placeReferenceState.sweden = uniqueBy(
    (Array.isArray(swJson) ? swJson : []).map((row, idx) => ({
      id: `se_${idx}`,
      county: String(row.county || '').trim(),
      municipality: String(row.municipality || '').trim(),
      locality: String(row.locality || '').trim(),
      lat: row.lat,
      lon: row.lon
    })).filter((row) => row.locality || row.municipality || row.county),
    (row) => `${normalizeText(row.locality)}|${normalizeText(row.municipality)}|${normalizeText(row.county)}`
  );

  const usaRaw = await fs.promises.readFile(usaPath, 'utf8');
  const lines = usaRaw.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  const usaRows = lines.map(parseCsvLine).map((cols, idx) => ({
    id: `us_${idx}`,
    city: String(cols[0] || '').trim(),
    stateShort: String(cols[1] || '').trim().toUpperCase(),
    state: String(cols[2] || '').trim(),
    county: String(cols[3] || '').trim(),
    alias: String(cols[4] || '').trim()
  })).filter((row) => row.city && row.state);

  placeReferenceState.usa = uniqueBy(usaRows, (row) =>
    `${normalizeText(row.city)}|${normalizeText(row.alias)}|${normalizeText(row.county)}|${normalizeText(row.state)}`
  );

  placeReferenceState.index = [
    ...placeReferenceState.sweden.map((entry) => ({ kind: 'SE', entry })),
    ...placeReferenceState.usa.map((entry) => ({ kind: 'US', entry }))
  ];

  placeReferenceState.loaded = true;
  return {
    loaded: true,
    counts: {
      sweden: placeReferenceState.sweden.length,
      usa: placeReferenceState.usa.length
    }
  };
}

function searchReferencePlaces(query, limit = 25) {
  const qNorm = normalizeText(query);
  if (!qNorm) return [];

  const results = [];

  for (const row of placeReferenceState.sweden) {
    const fields = [row.locality, row.municipality, row.county].map(normalizeText);
    const hit = fields.some((field) => field.includes(qNorm));
    if (!hit) continue;

    const score = (fields[0] === qNorm ? 5 : 0)
      + (fields[0].startsWith(qNorm) ? 3 : 0)
      + (fields[0].includes(qNorm) ? 2 : 0)
      + (fields[1].includes(qNorm) ? 1 : 0)
      + (fields[2].includes(qNorm) ? 1 : 0);

    const place = createPlaceFromSwedenEntry(row);
    results.push({
      id: `ref_se_${row.id}`,
      type: 'reference-sweden',
      score,
      label: buildSwedenLabel(place),
      value: row.locality,
      place,
      referenceId: row.id
    });
  }

  for (const row of placeReferenceState.usa) {
    const cityNorm = normalizeText(row.city);
    const aliasNorm = normalizeText(row.alias);
    const countyNorm = normalizeText(row.county);
    const stateNorm = normalizeText(row.state);
    const hit = cityNorm.includes(qNorm) || aliasNorm.includes(qNorm) || countyNorm.includes(qNorm) || stateNorm.includes(qNorm);
    if (!hit) continue;

    const score = (cityNorm === qNorm || aliasNorm === qNorm ? 5 : 0)
      + (cityNorm.startsWith(qNorm) || aliasNorm.startsWith(qNorm) ? 3 : 0)
      + (cityNorm.includes(qNorm) || aliasNorm.includes(qNorm) ? 2 : 0)
      + (countyNorm.includes(qNorm) ? 1 : 0)
      + (stateNorm.includes(qNorm) ? 1 : 0);

    const place = createPlaceFromUsEntry(row);
    results.push({
      id: `ref_us_${row.id}`,
      type: 'reference-usa',
      score,
      label: buildUsLabel(place),
      value: row.alias || row.city,
      place,
      referenceId: row.id
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 25, 100)));
}

function getSwedenReferencePlaces(limit = 0) {
  const max = Number(limit) || 0;
  const rows = placeReferenceState.sweden.map((row, idx) => ({
    id: `refse_${row.id || idx}`,
    ortnamn: row.locality || '',
    sockenstadnamn: row.locality || '',
    sockenstadkod: '',
    kommunnamn: row.municipality || '',
    kommunkod: '',
    lansnamn: row.county || '',
    lanskod: '',
    latitude: row.lat ?? null,
    longitude: row.lon ?? null,
    detaljtyp: 'Ort',
    source: 'reference-sweden'
  }));

  if (max > 0) {
    return rows.slice(0, max);
  }
  return rows;
}

function classifyVolume(record) {
  const title = String(record.title || '').toUpperCase();
  const series = String(record.series || '').toUpperCase();
  const hay = `${title} ${series}`;

  if (/HUSF[ÖO]RH[ÖO]R|F[ÖO]RSAMLINGSBOK|\bA\s*I\b|\bAI\b/.test(hay)) return 'Husförhörslängder';
  if (/F[ÖO]DELSE|DOP|\bC\s*I\b|\bCI\b/.test(hay)) return 'Födelseböcker';
  if (/VIGSEL|LYSN|\bE\s*I\b|\bEI\b/.test(hay)) return 'Vigselböcker';
  if (/D[ÖO]D|BEGRAV|\bF\s*I\b|\bFI\b/.test(hay)) return 'Död- och begravningsböcker';
  return 'Övrigt';
}

function extractYearFromDateString(dateStr) {
  const s = String(dateStr || '');
  const m = s.match(/(\d{4}\s*[-–]\s*\d{4}|\d{4})/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function getSeriesFromReferenceCode(referenceCode) {
  const parts = String(referenceCode || '').split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 5) return '';
  return parts.slice(3, parts.length - 1).join('/').trim();
}

function getVolumeFromReferenceCode(referenceCode) {
  const parts = String(referenceCode || '').split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  if (parts.length < 4) return parts[parts.length - 1] || '';
  return parts.slice(3).join('/').trim();
}

function buildVolumeRecordFromSearchItem(rec, idx) {
  const metadata = rec && rec.metadata && typeof rec.metadata === 'object' ? rec.metadata : {};
  const hierarchy = Array.isArray(metadata.hierarchy) ? metadata.hierarchy : [];
  const provenance = Array.isArray(metadata.provenance) ? metadata.provenance : [];
  const archiveCaption = String(hierarchy[0] && hierarchy[0].caption ? hierarchy[0].caption : '').trim();
  const seriesCaption = String(hierarchy[hierarchy.length - 1] && hierarchy[hierarchy.length - 1].caption ? hierarchy[hierarchy.length - 1].caption : '').trim();
  const provenanceCaption = String(provenance[0] && provenance[0].caption ? provenance[0].caption : '').trim();
  const referenceCode = String(metadata.referenceCode || '').trim();
  const year = extractYearFromDateString(metadata.date);
  const volume = getVolumeFromReferenceCode(referenceCode);
  const seriesCode = getSeriesFromReferenceCode(referenceCode);
  const nad = String(rec.id || referenceCode || '').trim();
  const sourceTitle = [archiveCaption, seriesCaption, referenceCode].filter(Boolean).join(' - ').trim();
  const title = sourceTitle || referenceCode || String(rec.caption || '').trim();

  return {
    id: `ra_vol_${nad || idx}`,
    title,
    volume,
    year,
    nad,
    archiveTop: 'Riksarkivet',
    archive: 'Riksarkivet',
    category: classifyVolume({ title, series: seriesCaption || seriesCode }),
    referenceCode,
    series: seriesCaption || seriesCode,
    archiveName: archiveCaption,
    provenance: provenanceCaption,
    htmlUrl: rec && rec._links ? rec._links.html : undefined,
    raw: rec
  };
}

async function fetchRiksarkivetRecords(params) {
  const url = `https://data.riksarkivet.se/api/records?${new URLSearchParams(params).toString()}`;
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'WestFamilyTree/1.0 (+https://github.com)'
  };

  const response = await fetch(url, { headers, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Riksarkivet Search API svarade ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  return { payload, items, url };
}

async function searchRiksarkivetArchives(placeName, rows = 80) {
  const query = String(placeName || '').trim();
  if (!query) {
    return { success: false, error: 'Platsnamn saknas', tree: [] };
  }

  const maxRows = Math.max(10, Math.min(Number(rows) || 80, 200));
  const requestPlans = [
    {
      text: query,
      facet: 'ObjectType:Record;Type:Volume',
      limit: String(maxRows),
      sort: 'relevance'
    },
    {
      place: query,
      facet: 'ObjectType:Record;Type:Volume',
      limit: String(maxRows),
      sort: 'relevance'
    }
  ];

  const apiResults = [];
  const errors = [];
  for (const params of requestPlans) {
    try {
      const response = await fetchRiksarkivetRecords(params);
      apiResults.push(response);
    } catch (err) {
      errors.push(err && err.message ? err.message : String(err));
    }
  }

  if (apiResults.length === 0) {
    return {
      success: false,
      error: errors.length > 0 ? errors.join(' | ') : 'Kunde inte hämta data från Riksarkivet Search API.',
      tree: []
    };
  }

  const mergedItems = [];
  const seenItemIds = new Set();
  for (const result of apiResults) {
    for (const item of result.items) {
      const id = String(item && item.id ? item.id : '').trim();
      if (!id || seenItemIds.has(id)) continue;
      seenItemIds.add(id);
      mergedItems.push(item);
    }
  }

  const normalizedQuery = normalizeText(query);
  const volumeRows = mergedItems
    .map((rec, idx) => buildVolumeRecordFromSearchItem(rec, idx))
    .filter((row) => row.title)
    .sort((a, b) => {
      const aHay = normalizeText([a.title, a.provenance, a.archiveName, a.series].filter(Boolean).join(' | '));
      const bHay = normalizeText([b.title, b.provenance, b.archiveName, b.series].filter(Boolean).join(' | '));
      const aChurch = /kyrkoarkiv|församling|forsamling/i.test(`${a.archiveName || ''} ${a.provenance || ''}`) ? 1 : 0;
      const bChurch = /kyrkoarkiv|församling|forsamling/i.test(`${b.archiveName || ''} ${b.provenance || ''}`) ? 1 : 0;
      const aCategoryBoost = a.category !== 'Övrigt' ? 1 : 0;
      const bCategoryBoost = b.category !== 'Övrigt' ? 1 : 0;
      const aScore = (aHay.includes(normalizedQuery) ? 2 : 0) + aChurch + aCategoryBoost;
      const bScore = (bHay.includes(normalizedQuery) ? 2 : 0) + bChurch + bCategoryBoost;
      if (aScore !== bScore) return bScore - aScore;
      return String(a.title).localeCompare(String(b.title), 'sv');
    })
    .slice(0, maxRows);

  const grouped = new Map();
  for (const row of volumeRows) {
    if (!grouped.has(row.category)) grouped.set(row.category, []);
    grouped.get(row.category).push(row);
  }

  const categoryOrder = new Map([
    ['Husförhörslängder', 0],
    ['Födelseböcker', 1],
    ['Vigselböcker', 2],
    ['Död- och begravningsböcker', 3],
    ['Övrigt', 9]
  ]);

  const tree = Array.from(grouped.entries())
    .sort((a, b) => {
      const aRank = categoryOrder.has(a[0]) ? categoryOrder.get(a[0]) : 8;
      const bRank = categoryOrder.has(b[0]) ? categoryOrder.get(b[0]) : 8;
      if (aRank !== bRank) return aRank - bRank;
      return String(a[0]).localeCompare(String(b[0]), 'sv');
    })
    .map(([category, children], idx) => ({
    id: `ra_cat_${idx}`,
    label: category,
    children: children.sort((a, b) => String(a.title).localeCompare(String(b.title), 'sv'))
  }));

  return {
    success: true,
    query,
    total: volumeRows.length,
    source: 'https://data.riksarkivet.se/api/records',
    tree
  };
}

module.exports = {
  initPlaceReferenceLibrary,
  searchReferencePlaces,
  getSwedenReferencePlaces,
  mapPlacStringToStructuredPlace,
  searchRiksarkivetArchives
};
