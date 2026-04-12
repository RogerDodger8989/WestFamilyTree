const EVENT_BASE_CONFIGS = [
  { value: 'Adoption', label: 'Adoption', icon: '❤️', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Alternativt namn', label: 'Alternativt namn', icon: '💬', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Annulering av vigsel', label: 'Annulering av vigsel', icon: '💔', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Antal barn', label: 'Antal barn', icon: '👶', unique: false, category: 'Familj', gedcomType: 'attribute' },
  { value: 'Antal äktenskap', label: 'Antal äktenskap', icon: '💍', unique: false, category: 'Familj', gedcomType: 'attribute' },
  { value: 'Arkivering av skilsmässa', label: 'Arkivering av skilsmässa', icon: '📁', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Bar mitzvah', label: 'Bar mitzvah', icon: '🕎', unique: true, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Begravning', label: 'Begravning', icon: '⚰️', unique: true, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Bosatt', label: 'Bosatt', icon: '🏠', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Bouppteckning', label: 'Bouppteckning', icon: '✍️', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Dop', label: 'Dop', icon: '💧', unique: true, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Dop som vuxen', label: 'Dop som vuxen', icon: '💧', unique: true, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Död', label: 'Död', icon: '✝️', unique: true, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Egen händelse', label: 'Egen händelse', icon: '📅', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'custom' },
  { value: 'Egendom', label: 'Egendom', icon: '📋', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Emigration', label: 'Emigration', icon: '➡️', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Examen', label: 'Examen', icon: '🎓', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Faktauppgift', label: 'Faktauppgift', icon: '✝️', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Folkräkning', label: 'Folkräkning', icon: '📋', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Fysisk status', label: 'Fysisk status', icon: '✓', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Födelse', label: 'Födelse', icon: '👶', unique: true, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Förlovning', label: 'Förlovning', icon: '💐', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Första nattvarden', label: 'Första nattvarden', icon: '🍞', unique: true, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Immigration', label: 'Immigration', icon: '⬅️', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Kast', label: 'Kast', icon: '👤', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Konfirmation', label: 'Konfirmation', icon: '🙏', unique: true, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Kremering', label: 'Kremering', icon: '🔥', unique: true, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Lysning', label: 'Lysning', icon: '📢', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Militärtjänst', label: 'Militärtjänst', icon: '⚔️', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Nationalitet', label: 'Nationalitet', icon: '🏴', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Naturalisering', label: 'Naturalisering', icon: '🤝', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Notering', label: 'Notering', icon: '📝', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Pensionering', label: 'Pensionering', icon: '💰', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Personnummer', label: 'Personnummer', icon: '📋', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Prästvigling', label: 'Prästvigling', icon: '⛪', unique: false, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Religionstillhörighet', label: 'Religionstillhörighet', icon: '⚙️', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Samlevnad', label: 'Samlevnad', icon: '🤝', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Samvetsäktenskap', label: 'Samvetsäktenskap', icon: '💕', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Skilsmässa', label: 'Skilsmässa', icon: '💔', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Socialförsäkringsnummer', label: 'Socialförsäkringsnummer', icon: '📋', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Testamente', label: 'Testamente', icon: '📜', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Titel', label: 'Titel', icon: '💬', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' },
  { value: 'Troendedop', label: 'Troendedop', icon: '💧', unique: true, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Utbildning', label: 'Utbildning', icon: '📚', unique: false, category: 'Livshändelser', gedcomType: 'event' },
  { value: 'Vigsel', label: 'Vigsel', icon: '💒', unique: false, category: 'Familj', gedcomType: 'event' },
  { value: 'Välsignelse', label: 'Välsignelse', icon: '🙏', unique: false, category: 'Religiöst', gedcomType: 'event' },
  { value: 'Yrke', label: 'Yrke', icon: '💼', unique: false, category: 'Fakta & Egenskaper', gedcomType: 'attribute' }
];

const EVENT_TYPE_CATEGORIES = ['Livshändelser', 'Familj', 'Fakta & Egenskaper', 'Religiöst'];

const ATTRIBUTE_VALUE_LABELS = {
  Yrke: 'Yrke / Titel',
  Titel: 'Titel / Benämning',
  Personnummer: 'Personnummer / ID',
  'Socialförsäkringsnummer': 'Socialförsäkringsnummer / ID',
  'Alternativt namn': 'Alternativt namn / Variant'
};

const NAME_PARTS_FIELDS = [
  { key: 'prefix', label: 'Prefix', inputType: 'text', placeholder: 'Prefix', span: 1 },
  { key: 'firstName', label: 'Förnamn', inputType: 'text', placeholder: 'Förnamn', span: 1 },
  { key: 'middleName', label: 'Mellannamn', inputType: 'text', placeholder: 'Mellannamn', span: 1 },
  { key: 'lastName', label: 'Efternamn', inputType: 'text', placeholder: 'Efternamn', span: 1 },
  { key: 'nickname', label: 'Smeknamn', inputType: 'text', placeholder: 'Smeknamn', span: 1 },
  { key: 'suffix', label: 'Suffix', inputType: 'text', placeholder: 'Suffix', span: 1 },
  {
    key: 'nameType',
    label: 'Namntyp',
    inputType: 'select',
    span: 2,
    options: [
      { value: '', label: 'Välj namntyp...' },
      { value: 'Födelsenamn', label: 'Födelsenamn' },
      { value: 'Gift namn', label: 'Gift namn' },
      { value: 'Smeknamn', label: 'Smeknamn' },
      { value: 'Alias', label: 'Alias' },
      { value: 'Pseudonym', label: 'Pseudonym' },
      { value: 'Annan', label: 'Annan' }
    ]
  },
  { key: 'note', label: 'Notering', inputType: 'textarea', placeholder: 'Notering', span: 2 }
];

const EDUCATION_FIELDS = [
  { key: 'school', label: 'Skola eller lärosäte', inputType: 'text', placeholder: 'Skola eller lärosäte', span: 2 },
  { key: 'program', label: 'Program eller inriktning', inputType: 'text', placeholder: 'Program eller inriktning', span: 1 },
  { key: 'degree', label: 'Examen', inputType: 'text', placeholder: 'Examen', span: 1 },
  { key: 'fieldOfStudy', label: 'Ämne eller studieinriktning', inputType: 'text', placeholder: 'Ämne eller studieinriktning', span: 2 },
  { key: 'startDate', label: 'Startdatum', inputType: 'date', placeholder: 'Startdatum', span: 1 },
  { key: 'endDate', label: 'Slutdatum', inputType: 'date', placeholder: 'Slutdatum', span: 1 },
  { key: 'graduationYear', label: 'Examensår', inputType: 'text', placeholder: 'Examensår', span: 1 },
  { key: 'place', label: 'Plats', inputType: 'text', placeholder: 'Plats', span: 1 },
  { key: 'note', label: 'Notering', inputType: 'textarea', placeholder: 'Notering', span: 2 }
];

const CUSTOM_EVENT_FIELDS = [
  { key: 'customType', label: 'Egen händelsetyp', inputType: 'text', placeholder: 'Ange egen händelsetyp', span: 2 },
  { key: 'note', label: 'Notering', inputType: 'textarea', placeholder: 'Notering', span: 2 }
];

const normalizeText = (value) => String(value ?? '').trim();

const stripHtml = (value) => String(value ?? '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const uniqueByKey = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${String(item?.key || '')}:${String(item?.inputType || '')}`;
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const decorateFields = (fields = []) => uniqueByKey(fields.map((field) => ({ ...field })));

const decorateConfig = (config) => {
  const base = { ...config };

  if (base.value === 'Alternativt namn') {
    return { ...base, fields: decorateFields(NAME_PARTS_FIELDS) };
  }

  if (base.value === 'Utbildning') {
    return { ...base, fields: decorateFields(EDUCATION_FIELDS) };
  }

  if (base.value === 'Egen händelse') {
    return { ...base, fields: decorateFields(CUSTOM_EVENT_FIELDS) };
  }

  if (base.gedcomType === 'attribute') {
    return {
      ...base,
      fields: decorateFields([
        {
          key: 'value',
          label: ATTRIBUTE_VALUE_LABELS[base.value] || `${base.label} / Beskrivning`,
          inputType: 'text',
          placeholder: ATTRIBUTE_VALUE_LABELS[base.value] || `${base.label} / Beskrivning`,
          span: 2
        }
      ])
    };
  }

  return { ...base, fields: [] };
};

export const EVENT_TYPE_CONFIGS = EVENT_BASE_CONFIGS.map(decorateConfig);

const EVENT_TYPE_CONFIG_BY_VALUE = new Map(EVENT_TYPE_CONFIGS.map((config) => [config.value, config]));

export const getEventTypeConfig = (type) => {
  const normalizedType = normalizeText(type);
  if (!normalizedType) return null;
  return EVENT_TYPE_CONFIG_BY_VALUE.get(normalizedType) || null;
};

export const getEventFieldsForType = (type) => {
  const config = getEventTypeConfig(type);
  return Array.isArray(config?.fields) ? config.fields : [];
};

export const getAttributeValueLabel = (eventType) => {
  if (!eventType) return 'Värde / Beskrivning';
  return ATTRIBUTE_VALUE_LABELS[eventType] || `${eventType} / Beskrivning`;
};

const normalizeOptionalArray = (value) => {
  if (Array.isArray(value)) return value.slice();
  if (value == null) return [];
  return value;
};

const pickFirstText = (...values) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return '';
};

export const createEmptyEvent = (type = 'Födelse', overrides = {}) => {
  const config = getEventTypeConfig(type);
  const draft = {
    id: overrides.id || `evt_${Date.now()}`,
    type: normalizeText(type) || 'Födelse',
    gedcomType: config?.gedcomType || overrides.gedcomType || 'event',
    customType: '',
    description: '',
    value: '',
    date: '',
    place: '',
    placeId: '',
    placeData: null,
    sources: [],
    images: [],
    notes: '',
    linkedPersons: []
  };

  if (config?.value === 'Alternativt namn') {
    return {
      ...draft,
      prefix: '',
      firstName: '',
      middleName: '',
      lastName: '',
      nickname: '',
      suffix: '',
      nameType: '',
      note: ''
    };
  }

  if (config?.value === 'Utbildning') {
    return {
      ...draft,
      school: '',
      program: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      graduationYear: '',
      place: '',
      note: ''
    };
  }

  if (config?.value === 'Egen händelse') {
    return {
      ...draft,
      customType: '',
      note: ''
    };
  }

  if (config?.gedcomType === 'attribute') {
    return {
      ...draft,
      value: '',
      description: '',
      note: ''
    };
  }

  return { ...draft, ...overrides };
};

export const normalizeEventForType = (event = {}) => {
  const config = getEventTypeConfig(event?.type);
  const normalized = { ...event };

  normalized.type = normalizeText(event?.type) || normalized.type || 'Egen händelse';
  normalized.gedcomType = config?.gedcomType || normalized.gedcomType || 'event';
  normalized.sources = normalizeOptionalArray(event?.sources);
  normalized.images = normalizeOptionalArray(event?.images);
  normalized.linkedPersons = normalizeOptionalArray(event?.linkedPersons);

  if (config?.value === 'Egen händelse') {
    normalized.customType = pickFirstText(event?.customType, event?.description, event?.value, normalized.customType);
  }

  if (config?.value === 'Alternativt namn') {
    normalized.prefix = normalizeText(event?.prefix || normalized.prefix);
    normalized.firstName = normalizeText(event?.firstName || normalized.firstName);
    normalized.middleName = normalizeText(event?.middleName || normalized.middleName);
    normalized.lastName = normalizeText(event?.lastName || normalized.lastName);
    normalized.nickname = normalizeText(event?.nickname || normalized.nickname);
    normalized.suffix = normalizeText(event?.suffix || normalized.suffix);
    normalized.nameType = normalizeText(event?.nameType || normalized.nameType);
    normalized.note = pickFirstText(event?.note, event?.notes, event?.description, event?.value, normalized.note);
  }

  if (config?.value === 'Utbildning') {
    normalized.school = pickFirstText(event?.school, event?.description, event?.value, normalized.school);
    normalized.program = normalizeText(event?.program || normalized.program);
    normalized.degree = normalizeText(event?.degree || normalized.degree);
    normalized.fieldOfStudy = normalizeText(event?.fieldOfStudy || normalized.fieldOfStudy);
    normalized.startDate = normalizeText(event?.startDate || normalized.startDate);
    normalized.endDate = normalizeText(event?.endDate || normalized.endDate);
    normalized.graduationYear = normalizeText(event?.graduationYear || normalized.graduationYear);
    normalized.place = normalizeText(event?.place || normalized.place);
    normalized.note = pickFirstText(event?.note, event?.notes, event?.description, event?.value, normalized.note);
  }

  if (config?.gedcomType === 'attribute' && config?.value !== 'Alternativt namn') {
    const fallbackValue = pickFirstText(event?.value, event?.description, event?.notes, normalized.value);
    normalized.value = fallbackValue;
    if (!normalizeText(normalized.description)) {
      normalized.description = fallbackValue;
    }
  }

  if (!normalizeText(normalized.description) && normalizeText(normalized.value)) {
    normalized.description = normalizeText(normalized.value);
  }

  if (!normalizeText(normalized.value) && normalizeText(normalized.description) && config?.gedcomType !== 'attribute') {
    normalized.value = normalizeText(normalized.description);
  }

  if (!normalizeText(normalized.notes) && normalizeText(event?.note)) {
    normalized.notes = normalizeText(event.note);
  }

  return normalized;
};

const buildNameSummary = (event = {}) => {
  const parts = [event.prefix, event.firstName, event.middleName, event.lastName]
    .map(normalizeText)
    .filter(Boolean);
  const nickname = normalizeText(event.nickname);
  const suffix = normalizeText(event.suffix);
  const nameType = normalizeText(event.nameType);

  const name = parts.join(' ');
  const decorated = [name, nickname ? `"${nickname}"` : '', suffix].filter(Boolean).join(' ');

  if (decorated) return decorated;
  if (nameType && name) return `${name} (${nameType})`;
  return pickFirstText(event.note, event.notes, event.description, event.value, event.customType);
};

const buildEducationSummary = (event = {}) => {
  const school = normalizeText(event.school || event.description || event.value);
  const program = normalizeText(event.program);
  const degree = normalizeText(event.degree);
  const fieldOfStudy = normalizeText(event.fieldOfStudy);
  const graduationYear = normalizeText(event.graduationYear);
  const place = normalizeText(event.place);

  const heading = [school, program || degree || fieldOfStudy].filter(Boolean).join(', ');
  const secondary = [degree, fieldOfStudy].filter(Boolean).join(', ');
  const yearPart = graduationYear ? `(${graduationYear})` : '';
  const placePart = place ? ` • ${place}` : '';
  const summary = [heading, secondary, yearPart].filter(Boolean).join(' ');
  const trimmedSummary = summary.trim();

  if (trimmedSummary) return `${trimmedSummary}${placePart}`.trim();
  return pickFirstText(event.note, event.notes, event.description, event.value, event.customType);
};

const buildGenericSummary = (event = {}) => {
  const config = getEventTypeConfig(event?.type);
  if (config?.value === 'Egen händelse') {
    return pickFirstText(event.customType, event.description, event.value, event.note, event.notes);
  }

  if (config?.value === 'Alternativt namn') {
    return buildNameSummary(event);
  }

  if (config?.value === 'Utbildning') {
    return buildEducationSummary(event);
  }

  if (config?.gedcomType === 'attribute') {
    return pickFirstText(event.value, event.description, event.note, event.notes);
  }

  return pickFirstText(event.description, event.value, event.note, event.notes, event.customType);
};

export const buildEventSummary = (event = {}) => {
  if (!event || typeof event !== 'object') return '';
  return stripHtml(buildGenericSummary(event));
};

export { EVENT_TYPE_CATEGORIES };