function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

function getDisplayName(person) {
  if (!person) return 'Okand';
  const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return fullName || person.refNumber || person.id || 'Okand';
}

function getRelationIds(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (typeof item === 'object' ? item?.id : item))
    .filter(Boolean);
}

function getBirthDeathFromEvents(events) {
  const safeEvents = Array.isArray(events) ? events : [];
  const birth = safeEvents.find((e) => String(e?.type || '').toLowerCase().includes('fodel') || String(e?.type || '').toLowerCase().includes('birth'));
  const death = safeEvents.find((e) => String(e?.type || '').toLowerCase().includes('dod') || String(e?.type || '').toLowerCase().includes('death'));
  return { birth, death };
}

function extractYear(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{4})/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? null : year;
}

function sortEventsChronologically(events) {
  const safeEvents = Array.isArray(events) ? events : [];
  return [...safeEvents].sort((a, b) => {
    const ay = extractYear(a?.date);
    const by = extractYear(b?.date);
    if (ay === null && by === null) return 0;
    if (ay === null) return 1;
    if (by === null) return -1;
    return ay - by;
  });
}

function resolvePlaceLabel(eventItem, placesMap) {
  if (!eventItem) return '';
  if (eventItem.place && String(eventItem.place).trim()) return String(eventItem.place).trim();
  if (!eventItem.placeId) return '';
  const place = placesMap.get(String(eventItem.placeId));
  return place?.name || String(eventItem.placeId);
}

function extractSourceIdsFromEvent(eventItem) {
  const eventSources = Array.isArray(eventItem?.sources) ? eventItem.sources : [];
  return eventSources
    .map((sourceItem) => {
      if (!sourceItem) return null;
      if (typeof sourceItem === 'string') return sourceItem;
      return sourceItem.sourceId || sourceItem.id || null;
    })
    .filter(Boolean);
}

function normalizeMediaSrc(mediaItem) {
  const candidate = mediaItem?.url || mediaItem?.imagePath || mediaItem?.path || mediaItem?.thumbnailPath || mediaItem?.thumbnail || '';
  if (!candidate) return '';

  const text = String(candidate).trim();
  if (!text) return '';

  if (/^(https?:|data:|blob:|file:)/i.test(text)) {
    return text;
  }

  if (/^[a-zA-Z]:\\/.test(text)) {
    return `file:///${text.replace(/\\/g, '/')}`;
  }

  return text;
}

function formatSourceLabel(source) {
  if (!source) return 'Okand kalla';
  const title = String(source.title || '').trim();
  if (title) return title;
  const archive = String(source.archive || source.archiveTop || '').trim();
  const volume = String(source.volume || '').trim();
  const page = String(source.page || source.imagePage || '').trim();
  const chunks = [archive, volume, page].filter(Boolean);
  return chunks.join(', ') || source.id || 'Okand kalla';
}

function renderPersonList(ids, peopleMap) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return '<p class="muted">Inga uppgifter.</p>';
  }

  const items = ids
    .map((id) => peopleMap.get(String(id)))
    .filter(Boolean)
    .map((person) => `<li>${escapeHtml(getDisplayName(person))}</li>`)
    .join('');

  if (!items) return '<p class="muted">Inga uppgifter.</p>';
  return `<ul class="compact-list">${items}</ul>`;
}

export function generatePersonaktHTML(person, globalData = {}, printOptions = {}) {
  const safePerson = person || {};
  const allPeople = Array.isArray(globalData.people) ? globalData.people : [];
  const allSources = Array.isArray(globalData.sources) ? globalData.sources : [];
  const allPlaces = Array.isArray(globalData.places) ? globalData.places : [];

  const options = {
    includeBasics: true,
    includeEvents: true,
    includeFamilyParentsSiblings: true,
    includeFamilyPartnersChildren: true,
    includeFamilyGrandchildren: false,
    includeMedia: true,
    includeNotesBiography: true,
    includeSourceList: true,
    ...printOptions,
  };

  const peopleMap = new Map(allPeople.map((p) => [String(p.id), p]));
  const placesMap = new Map(allPlaces.map((p) => [String(p.id), p]));
  const sourcesMap = new Map(allSources.map((s) => [String(s.id), s]));

  const personName = getDisplayName(safePerson);
  const profileImage = normalizeMediaSrc(Array.isArray(safePerson.media) ? safePerson.media[0] : null);

  const events = sortEventsChronologically(safePerson.events || []);
  const sourceIdSet = new Set();
  events.forEach((eventItem) => {
    extractSourceIdsFromEvent(eventItem).forEach((sourceId) => sourceIdSet.add(String(sourceId)));
  });

  const sourceList = [...sourceIdSet]
    .map((sourceId) => sourcesMap.get(sourceId) || { id: sourceId, title: sourceId })
    .filter(Boolean);

  const parentIds = getRelationIds(safePerson?.relations?.parents);
  const siblingIds = getRelationIds(safePerson?.relations?.siblings);
  const partnerIds = getRelationIds(safePerson?.relations?.partners);
  const childIds = getRelationIds(safePerson?.relations?.children);

  const grandChildrenIds = [];
  if (options.includeFamilyGrandchildren) {
    childIds.forEach((childId) => {
      const child = peopleMap.get(String(childId));
      const localGrandChildren = getRelationIds(child?.relations?.children);
      localGrandChildren.forEach((grandChildId) => {
        if (!grandChildrenIds.includes(grandChildId)) grandChildrenIds.push(grandChildId);
      });
    });
  }

  const { birth, death } = getBirthDeathFromEvents(events);
  const birthText = (birth?.date || safePerson.birthDate || '').toString().trim();
  const deathText = (death?.date || safePerson.deathDate || '').toString().trim();
  const birthPlace = resolvePlaceLabel(birth || { place: safePerson.birthPlace }, placesMap);
  const deathPlace = resolvePlaceLabel(death || { place: safePerson.deathPlace }, placesMap);

  const notesArray = Array.isArray(safePerson.notes) ? safePerson.notes : [];
  const notesText = notesArray
    .map((item) => {
      const title = String(item?.title || '').trim();
      const content = String(item?.content || '').trim();
      if (!title && !content) return '';
      return `
        <article class="note-item avoid-break">
          ${title ? `<h4>${escapeHtml(title)}</h4>` : ''}
          <p>${nl2br(content || '')}</p>
        </article>
      `;
    })
    .filter(Boolean)
    .join('');

  const researchNotes = String(safePerson?.research?.notes || '').trim();

  const mediaItems = (Array.isArray(safePerson.media) ? safePerson.media : [])
    .map((mediaItem) => ({
      src: normalizeMediaSrc(mediaItem),
      caption: String(mediaItem?.caption || mediaItem?.title || mediaItem?.name || '').trim(),
    }))
    .filter((mediaItem) => mediaItem.src);

  const generatedAt = new Date().toLocaleString('sv-SE');

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Personakt - ${escapeHtml(personName)}</title>
  <style>
    @page {
      size: A4;
      margin: 17mm 15mm 19mm 15mm;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: Georgia, Garamond, "Times New Roman", serif;
      line-height: 1.62;
      font-size: 11.5pt;
      text-rendering: optimizeLegibility;
    }

    * {
      box-sizing: border-box;
    }

    .page {
      max-width: 190mm;
      margin: 0 auto;
      padding: 8mm 8mm 12mm 8mm;
      background: #ffffff;
    }

    .print-header,
    .print-footer {
      display: none;
    }

    .title-block {
      position: relative;
      border: 1px solid #111111;
      padding: 7mm 7mm 6mm 7mm;
      margin-bottom: 8mm;
      page-break-inside: avoid;
      text-align: center;
      background: #ffffff;
    }

    .title-block::before,
    .title-block::after {
      content: "";
      position: absolute;
      left: 5mm;
      right: 5mm;
      border-top: 1px solid #111111;
    }

    .title-block::before {
      top: 3mm;
    }

    .title-block::after {
      bottom: 3mm;
    }

    .title-kicker {
      font-size: 10.3pt;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: #2d2d2d;
      margin-bottom: 1.4mm;
    }

    .title-block h1 {
      margin: 0;
      font-size: 24pt;
      line-height: 1.24;
      letter-spacing: 0.45px;
      text-transform: none;
      font-weight: 700;
    }

    .title-ornament {
      font-size: 12pt;
      letter-spacing: 1px;
      margin: 1.8mm 0 2mm 0;
    }

    .title-meta {
      margin-top: 2.6mm;
      font-size: 10.2pt;
      color: #333333;
      line-height: 1.5;
    }

    .basfakta {
      display: table;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8mm;
      page-break-inside: avoid;
    }

    .basfakta-row {
      display: table-row;
    }

    .basfakta-cell {
      display: table-cell;
      vertical-align: top;
      padding: 0 5mm 0 0;
    }

    .profile-frame {
      display: inline-block;
      border: 1px solid #111111;
      outline: 1px solid #111111;
      outline-offset: 2px;
      padding: 1.2mm;
      background: #ffffff;
      box-shadow: 0 1.2mm 2mm rgba(0, 0, 0, 0.08);
    }

    .profile-image {
      width: 34mm;
      height: 45mm;
      border: 1px solid #1a1a1a;
      object-fit: cover;
      display: block;
      background: #f5f5f5;
    }

    .section {
      margin-bottom: 8mm;
      page-break-inside: avoid;
    }

    .section h2 {
      margin: 0 0 2.8mm 0;
      border-bottom: 1px solid #111111;
      border-top: 1px solid #111111;
      padding: 1.6mm 0 1.4mm 0;
      font-size: 13.4pt;
      letter-spacing: 0.35px;
      text-transform: uppercase;
      font-weight: 700;
    }

    p {
      margin: 0 0 2mm 0;
    }

    .muted {
      color: #4a4a4a;
      font-style: italic;
      margin: 0;
    }

    .compact-list {
      margin: 0;
      padding-left: 5mm;
    }

    .compact-list li {
      margin-bottom: 1.6mm;
      page-break-inside: avoid;
    }

    .event-item,
    .note-item,
    .source-item,
    .media-item,
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .event-item {
      border: 1px solid #222222;
      border-left: 2px solid #111111;
      padding: 3.2mm;
      margin-bottom: 2.7mm;
      background: #ffffff;
    }

    .event-item + .event-item {
      position: relative;
    }

    .event-item + .event-item::before {
      content: "";
      position: absolute;
      top: -1.7mm;
      left: 0;
      right: 0;
      border-top: 1px dotted #555555;
    }

    .event-title {
      font-weight: 700;
      font-size: 11.7pt;
      margin-bottom: 1.2mm;
    }

    .event-meta {
      font-size: 10.4pt;
      color: #2d2d2d;
      margin-bottom: 1.1mm;
    }

    .event-desc {
      margin: 0;
      font-size: 10.8pt;
    }

    .family-grid {
      display: table;
      width: 100%;
      border-collapse: collapse;
    }

    .family-row {
      display: table-row;
    }

    .family-col {
      display: table-cell;
      vertical-align: top;
      width: 50%;
      padding-right: 5mm;
    }

    .family-col:last-child {
      padding-right: 0;
      padding-left: 3mm;
    }

    .subhead {
      margin: 0 0 1.7mm 0;
      font-size: 11.2pt;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }

    .note-item {
      border-left: 2px solid #111111;
      padding-left: 3mm;
      margin-bottom: 2.7mm;
    }

    .note-item h4 {
      margin: 0 0 1mm 0;
      font-size: 11.4pt;
    }

    .note-item p {
      margin: 0;
    }

    .source-item {
      margin-bottom: 2.3mm;
      font-size: 10.6pt;
      padding-left: 1mm;
    }

    .source-index {
      font-weight: 700;
    }

    .media-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
    }

    .media-item {
      border: 1px solid #111111;
      outline: 1px solid #111111;
      outline-offset: 2px;
      padding: 2.2mm;
      background: #ffffff;
      box-shadow: 0 1.2mm 2mm rgba(0, 0, 0, 0.08);
    }

    .media-item img {
      width: 100%;
      height: auto;
      display: block;
      object-fit: cover;
      max-height: 68mm;
      background: #f2f2f2;
      border: 1px solid #1a1a1a;
    }

    .media-caption {
      margin-top: 1.7mm;
      font-size: 10pt;
      color: #333333;
    }

    .footer-note {
      margin-top: 8mm;
      border-top: 1px solid #111111;
      padding-top: 2mm;
      font-size: 9.5pt;
      color: #333333;
      page-break-inside: avoid;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .print-header,
      .print-footer {
        display: flex;
        position: fixed;
        left: 0;
        right: 0;
        color: #262626;
        font-size: 9.5pt;
        letter-spacing: 0.15px;
      }

      .print-header {
        top: 6mm;
        justify-content: space-between;
        border-bottom: 1px solid #111111;
        padding: 0 15mm 1.6mm 15mm;
      }

      .print-footer {
        bottom: 5.5mm;
        justify-content: space-between;
        border-top: 1px solid #111111;
        padding: 1.6mm 15mm 0 15mm;
      }

      .page-number::before {
        content: "Sida " counter(page);
      }

      .page {
        margin: 0;
        max-width: none;
        padding: 14mm 0 14mm 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <span>Personakt: ${escapeHtml(personName)}</span>
    <span>WestFamilyTree</span>
  </div>

  <div class="print-footer">
    <span>Utskriven: ${escapeHtml(generatedAt)} fran WestFamilyTree</span>
    <span class="page-number"></span>
  </div>

  <main class="page">
    <header class="title-block avoid-break">
      <div class="title-kicker">Genealogisk Dokumentation</div>
      <h1>Personakt for ${escapeHtml(personName)}</h1>
      <div class="title-ornament">* * *</div>
      <div class="title-meta">
        <div><strong>Namn:</strong> ${escapeHtml(personName)}</div>
        <div><strong>Referens:</strong> ${escapeHtml(safePerson.refNumber || safePerson.refId || safePerson.id || '-')}</div>
        <div><strong>Utskriven:</strong> ${escapeHtml(generatedAt)}</div>
      </div>
    </header>

    ${options.includeBasics !== false ? `
      <section class="section basfakta-section avoid-break">
        <h2>Basfakta</h2>
        <div class="basfakta">
          <div class="basfakta-row">
            <div class="basfakta-cell" style="width:38mm;">
              <div class="profile-frame">
                ${profileImage ? `<img class="profile-image" src="${escapeHtml(profileImage)}" alt="Profilbild" />` : `<div class="profile-image" aria-label="Ingen profilbild"></div>`}
              </div>
            </div>
            <div class="basfakta-cell">
              <p><strong>Fullstandigt namn:</strong> ${escapeHtml(personName)}</p>
              <p><strong>Kon:</strong> ${escapeHtml(safePerson.sex || '-')}</p>
              <p><strong>Fodd:</strong> ${escapeHtml(birthText || '-')}${birthPlace ? `, ${escapeHtml(birthPlace)}` : ''}</p>
              <p><strong>Dod:</strong> ${escapeHtml(deathText || '-')}${deathPlace ? `, ${escapeHtml(deathPlace)}` : ''}</p>
              ${safePerson.tags && safePerson.tags.length > 0 ? `<p><strong>Taggar:</strong> ${escapeHtml(safePerson.tags.join(', '))}</p>` : ''}
            </div>
          </div>
        </div>
      </section>
    ` : ''}

    ${options.includeEvents ? `
      <section class="section">
        <h2>Livshandelser</h2>
        ${events.length === 0 ? '<p class="muted">Inga registrerade handelser.</p>' : events.map((eventItem) => {
          const placeLabel = resolvePlaceLabel(eventItem, placesMap);
          const sourceIds = extractSourceIdsFromEvent(eventItem);
          const sourceRefs = sourceIds
            .map((sourceId) => [...sourceIdSet].indexOf(String(sourceId)) + 1)
            .filter((refNo) => refNo > 0);
          return `
            <article class="event-item">
              <div class="event-title">${escapeHtml(eventItem.type || 'Handelse')}</div>
              <div class="event-meta">
                <strong>Datum:</strong> ${escapeHtml(eventItem.date || '-')} ${placeLabel ? `| <strong>Plats:</strong> ${escapeHtml(placeLabel)}` : ''}
              </div>
              ${eventItem.description || eventItem.info ? `<p class="event-desc">${nl2br(eventItem.description || eventItem.info || '')}</p>` : ''}
              ${sourceRefs.length > 0 ? `<p class="event-desc"><strong>Kallor:</strong> ${escapeHtml(sourceRefs.map((n) => `[${n}]`).join(' '))}</p>` : ''}
            </article>
          `;
        }).join('')}
      </section>
    ` : ''}

    ${options.includeFamilyParentsSiblings ? `
      <section class="section">
        <h2>Familj - Foraldrar och Syskon</h2>
        <div class="family-grid">
          <div class="family-row">
            <div class="family-col">
              <h3 class="subhead">Foraldrar</h3>
              ${renderPersonList(parentIds, peopleMap)}
            </div>
            <div class="family-col">
              <h3 class="subhead">Syskon</h3>
              ${renderPersonList(siblingIds, peopleMap)}
            </div>
          </div>
        </div>
      </section>
    ` : ''}

    ${options.includeFamilyPartnersChildren ? `
      <section class="section">
        <h2>Familj - Partners och Barn</h2>
        <div class="family-grid">
          <div class="family-row">
            <div class="family-col">
              <h3 class="subhead">Partners</h3>
              ${renderPersonList(partnerIds, peopleMap)}
            </div>
            <div class="family-col">
              <h3 class="subhead">Barn</h3>
              ${renderPersonList(childIds, peopleMap)}
            </div>
          </div>
        </div>
      </section>
    ` : ''}

    ${options.includeFamilyGrandchildren ? `
      <section class="section">
        <h2>Familj - Barnbarn</h2>
        ${renderPersonList(grandChildrenIds, peopleMap)}
      </section>
    ` : ''}

    ${options.includeNotesBiography ? `
      <section class="section">
        <h2>Noteringar och Biografi</h2>
        ${notesText || '<p class="muted">Inga noteringar.</p>'}
        ${researchNotes ? `
          <article class="note-item avoid-break">
            <h4>Forskningsnotering</h4>
            <p>${nl2br(researchNotes)}</p>
          </article>
        ` : ''}
      </section>
    ` : ''}

    ${options.includeMedia ? `
      <section class="section">
        <h2>Media</h2>
        ${mediaItems.length === 0 ? '<p class="muted">Inga kopplade bilder.</p>' : `
          <div class="media-grid">
            ${mediaItems.map((mediaItem) => `
              <figure class="media-item">
                <img src="${escapeHtml(mediaItem.src)}" alt="Personmedia" />
                ${mediaItem.caption ? `<figcaption class="media-caption">${escapeHtml(mediaItem.caption)}</figcaption>` : ''}
              </figure>
            `).join('')}
          </div>
        `}
      </section>
    ` : ''}

    ${options.includeSourceList ? `
      <section class="section">
        <h2>Kallforteckning</h2>
        ${sourceList.length === 0 ? '<p class="muted">Inga kallor kopplade till valda sektioner.</p>' : sourceList.map((source, index) => {
          const details = [
            source.archiveTop,
            source.archive,
            source.volume,
            source.page || source.imagePage,
            source.date,
          ].filter(Boolean).map((value) => escapeHtml(value)).join(', ');

          return `
            <div class="source-item">
              <span class="source-index">[${index + 1}]</span>
              ${escapeHtml(formatSourceLabel(source))}
              ${details ? `<div>${details}</div>` : ''}
            </div>
          `;
        }).join('')}
      </section>
    ` : ''}

    <footer class="footer-note">
      Denna personakt ar genererad automatiskt i WestFamilyTree for utskrift till PDF (A4).
    </footer>
  </main>
</body>
</html>`;
}
