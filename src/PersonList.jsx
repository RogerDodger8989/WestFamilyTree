import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import MediaImage from './components/MediaImage.jsx';
import { getAvatarImageStyle } from './imageUtils.js';
import { Search, LayoutGrid, List, X, Image as ImageIcon, BookOpen, AlertTriangle, ArrowUpDown, ChevronUp, ChevronDown, SlidersHorizontal, Plus, Trash2, Download, Save, Palette, Network, Edit3 } from 'lucide-react';

const FILTER_PRESET_STORAGE_KEY = 'westfamilytree_personlist_filter_presets_v1';
const PERSON_LIST_COLUMNS_STORAGE_KEY = 'westfamilytree_personlist_columns_v1';
const NARROW_VIEWPORT_WIDTH = 768;
const BRANCH_COLOR_PRESETS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2'];
const ALL_PERSON_EVENT_TYPES = [
  'Adoption',
  'Alternativt namn',
  'Annulering av vigsel',
  'Antal barn',
  'Antal äktenskap',
  'Arkivering av skilsmässa',
  'Bar mitzvah',
  'Begravning',
  'Bosatt',
  'Bouppteckning',
  'Dop',
  'Dop som vuxen',
  'Död',
  'Egen händelse',
  'Egendom',
  'Emigration',
  'Examen',
  'Faktauppgift',
  'Folkräkning',
  'Fysisk status',
  'Födelse',
  'Förlovning',
  'Första nattvarden',
  'Immigration',
  'Kast',
  'Konfirmation',
  'Kremering',
  'Lysning',
  'Militärtjänst',
  'Nationalitet',
  'Naturalisering',
  'Notering',
  'Pensionering',
  'Personnummer',
  'Prästvigling',
  'Religionstillhörighet',
  'Samlevnad',
  'Samvetsäktenskap',
  'Skilsmässa',
  'Socialförsäkringsnummer',
  'Testamente',
  'Titel',
  'Troendedop',
  'Utbildning',
  'Vigsel',
  'Välsignelse',
  'Yrke'
];

function GenderIcon({ gender, className = '' }) {
  if (gender === 'M') {
    return (
      <svg className={`w-5 h-5 text-accent fill-current ${className}`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2a5 5 0 0 0-5 5c0 2.47 1.8 4.5 4.1 4.92L11 13H9v2h2v7h2v-7h2v-2h-2l-.1-1.08A5 5 0 0 0 12 2zm0 2a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3z" />
      </svg>
    );
  }
  if (gender === 'K') {
    return (
      <svg className={`w-5 h-5 text-pink-200 fill-current ${className}`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2a5 5 0 0 0-5 5a5 5 0 0 0 5 5a5 5 0 0 0 5-5a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3zm0 8c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm0 2c2.11 0 3.63.53 4.4 1H7.6c.77-.47 2.29-1 4.4-1z" />
      </svg>
    );
  }
  return null;
}

function getDefaultVisibleColumnsByViewport() {
  const wideDefaults = {
    ref: true,
    firstName: true,
    lastName: true,
    gender: true,
    birthYear: true,
    birthPlace: true,
    deathYear: true,
    deathPlace: true,
    occupation: true
  };

  if (typeof window === 'undefined') return wideDefaults;
  if (window.innerWidth >= NARROW_VIEWPORT_WIDTH) return wideDefaults;

  return {
    ref: false,
    firstName: true,
    lastName: true,
    gender: false,
    birthYear: true,
    birthPlace: false,
    deathYear: true,
    deathPlace: false,
    occupation: false
  };
}

function PersonList({ people, onOpenEditModal, onOpenRelationModal, onDeletePerson, focusPair, onSetFocusPair, bookmarks, onCreatePerson }) {
  const [viewMode, setViewMode] = useState('list');
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sortBy, setSortBy] = useState('ref');
  const [sortDirection, setSortDirection] = useState('asc');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [advancedFilterMode, setAdvancedFilterMode] = useState('AND');
  const [advancedFilterText, setAdvancedFilterText] = useState('');
  const [advancedFilterRules, setAdvancedFilterRules] = useState([
    { id: 'rule_1', field: 'name', operator: 'contains', value: '' }
  ]);
  const [savedPresets, setSavedPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState('');
  const [contextMenu, setContextMenu] = useState({ isOpen: false, x: 0, y: 0, personId: null });
  const [colorMenu, setColorMenu] = useState({ isOpen: false, personId: null, color: BRANCH_COLOR_PRESETS[0] });
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState(['ref', 'firstName', 'lastName', 'gender', 'birthYear', 'birthPlace', 'deathYear', 'deathPlace', 'occupation']);
  const [visibleColumns, setVisibleColumns] = useState(() => getDefaultVisibleColumnsByViewport());
  const [draggedColumnId, setDraggedColumnId] = useState(null);
  const [dragOverColumnId, setDragOverColumnId] = useState(null);
  const [hasLoadedColumnPreferences, setHasLoadedColumnPreferences] = useState(false);
  const advancedRuleCounterRef = useRef(1);
  const columnDragSuppressSortRef = useRef(false);
  const columnsMenuRef = useRef(null);
  const { dbData, setDbData, undoMerge, restorePerson, showStatus, setFamilyTreeFocusPersonId, familyTreeFocusPersonId, recordAudit } = useApp();

  const advancedFilterFields = useMemo(
    () => [
      { value: 'name', label: 'Namn' },
      { value: 'ref', label: 'REF-nummer' },
      { value: 'eventType', label: 'Händelsetyp' },
      { value: 'eventDate', label: 'Händelsedatum' },
      { value: 'eventPlace', label: 'Ort/Plats' },
      { value: 'createdAt', label: 'Skapad datum' },
      { value: 'updatedAt', label: 'Senast ändrad datum' },
      { value: 'hasSources', label: 'Har källor' },
      { value: 'hasMedia', label: 'Har media' },
      { value: 'hasWarnings', label: 'Har varningar' },
      { value: 'isEmigrant', label: 'Är emigrant' },
      { value: 'color', label: 'Grenfärg' }
    ],
    []
  );

  const booleanFields = useMemo(() => new Set(['hasSources', 'hasMedia', 'hasWarnings', 'isEmigrant']), []);
  const dateFields = useMemo(() => new Set(['eventDate', 'createdAt', 'updatedAt']), []);
  const numberFields = useMemo(() => new Set(['ref']), []);

  const extractIdFromRelationEntry = (entry) => {
    if (!entry) return null;
    if (typeof entry === 'string' || typeof entry === 'number') return String(entry);
    return String(
      entry.id
      || entry.personId
      || entry.parentId
      || entry.childId
      || entry.fromPersonId
      || entry.toPersonId
      || ''
    ) || null;
  };

  const getPersonByIdMap = useMemo(() => {
    const sourcePeople = Array.isArray(dbData?.people) ? dbData.people : people;
    const map = new Map();
    for (const person of sourcePeople) {
      if (!person?.id) continue;
      map.set(String(person.id), person);
    }
    return map;
  }, [dbData, people]);

  const eventTypeMatches = (eventType, candidateTypes) => {
    const normalized = String(eventType || '').toLowerCase();
    return candidateTypes.some((candidate) => normalized.includes(candidate));
  };

  const getBirthEvent = (person) => {
    const events = Array.isArray(person?.events) ? person.events : [];
    return events.find((event) => eventTypeMatches(event?.type, ['fodelse', 'födelse', 'birt', 'född', 'fodd']));
  };

  const getDeathEvent = (person) => {
    const events = Array.isArray(person?.events) ? person.events : [];
    return events.find((event) => eventTypeMatches(event?.type, ['dod', 'död', 'deat', 'begravning', 'begravd']));
  };

  const getMarriageEvent = (person) => {
    const events = Array.isArray(person?.events) ? person.events : [];
    return events.find((event) => eventTypeMatches(event?.type, ['marr', 'vigsel', 'gift']));
  };

  const getPersonInitials = (person) => {
    const first = String(person?.firstName || '').trim().charAt(0).toUpperCase();
    const last = String(person?.lastName || '').trim().charAt(0).toUpperCase();
    return `${first}${last}`.trim() || String(person?.firstName || '').trim().slice(0, 2).toUpperCase() || '?';
  };

  const getBirthYear = (person) => {
    const date = String(getBirthEvent(person)?.date || '');
    const match = date.match(/(\d{4})/);
    return match ? match[1] : '';
  };

  const personHasSources = (person) => {
    const personSourceIds = Array.isArray(person?.sourceIds) ? person.sourceIds : [];
    if (personSourceIds.length > 0) return true;
    const events = Array.isArray(person?.events) ? person.events : [];
    return events.some((event) => Array.isArray(event?.sources) && event.sources.length > 0);
  };

  const personHasWarnings = (person) => {
    const candidates = [
      person?.validationWarnings,
      person?._validationWarnings,
      person?.warnings,
      person?._warnings,
      person?.meta?.warnings
    ];
    return candidates.some((candidate) => Array.isArray(candidate) && candidate.length > 0);
  };

  const personIsEmigrant = (person) => {
    const events = Array.isArray(person?.events) ? person.events : [];
    return events.some((event) => eventTypeMatches(event?.type, ['emigration', 'utflyttning', 'utflyttad']));
  };

  const personHasMedia = (person) => {
    if (Array.isArray(person?.media) && person.media.length > 0) return true;
    if (Array.isArray(person?.mediaIds) && person.mediaIds.length > 0) return true;
    return false;
  };

  const getMediaPreviewSrc = (person) => {
    const media = Array.isArray(person?.media) ? person.media : [];
    const firstMedia = media.find((entry) => entry && typeof entry === 'object');
    if (!firstMedia) return '';
    return firstMedia.thumbnailPath || firstMedia.thumbnail || firstMedia.imagePath || firstMedia.path || firstMedia.url || '';
  };

  const getKeyLifeEvents = (person) => {
    const candidates = [getBirthEvent(person), getMarriageEvent(person), getDeathEvent(person)].filter(Boolean);
    return candidates.slice(0, 3);
  };

  const getFieldOperatorOptions = (field) => {
    if (field === 'eventType') {
      return [
        { value: 'has_event_type', label: 'har händelsen' },
        { value: 'not_has_event_type', label: 'har inte händelsen' }
      ];
    }

    if (booleanFields.has(field)) {
      return [
        { value: 'is_true', label: 'är sant' },
        { value: 'is_false', label: 'är falskt' }
      ];
    }

    if (dateFields.has(field)) {
      return [
        { value: 'on_or_after', label: 'på eller efter' },
        { value: 'after', label: 'efter' },
        { value: 'on_or_before', label: 'på eller före' },
        { value: 'before', label: 'före' },
        { value: 'equals', label: 'exakt datum' }
      ];
    }

    if (numberFields.has(field)) {
      return [
        { value: 'equals', label: 'är lika med' },
        { value: 'not_equals', label: 'är inte lika med' },
        { value: 'gt', label: 'större än' },
        { value: 'gte', label: 'större eller lika med' },
        { value: 'lt', label: 'mindre än' },
        { value: 'lte', label: 'mindre eller lika med' }
      ];
    }

    return [
      { value: 'contains', label: 'innehåller' },
      { value: 'not_contains', label: 'innehåller inte' },
      { value: 'equals', label: 'är exakt' },
      { value: 'not_equals', label: 'är inte' },
      { value: 'starts_with', label: 'börjar med' },
      { value: 'ends_with', label: 'slutar med' }
    ];
  };

  const addAdvancedFilterRule = () => {
    advancedRuleCounterRef.current += 1;
    setAdvancedFilterRules((prev) => [
      ...prev,
      { id: `rule_${advancedRuleCounterRef.current}`, field: 'name', operator: 'contains', value: '' }
    ]);
  };

  const removeAdvancedFilterRule = (ruleId) => {
    setAdvancedFilterRules((prev) => {
      const next = prev.filter((rule) => rule.id !== ruleId);
      return next.length > 0 ? next : [{ id: `rule_${advancedRuleCounterRef.current + 1}`, field: 'name', operator: 'contains', value: '' }];
    });
  };

  const updateAdvancedFilterRule = (ruleId, patch) => {
    setAdvancedFilterRules((prev) => prev.map((rule) => {
      if (rule.id !== ruleId) return rule;
      const updated = { ...rule, ...patch };
      if (patch.field) {
        const nextOps = getFieldOperatorOptions(patch.field);
        const hasCurrent = nextOps.some((option) => option.value === updated.operator);
        if (!hasCurrent) updated.operator = nextOps[0].value;
        if (booleanFields.has(patch.field)) {
          updated.value = '';
        }
        if (patch.field === 'eventType') {
          const options = getFieldValueOptions('eventType');
          updated.value = options[0] || '';
        }
      }
      return updated;
    }));
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilterMode('AND');
    setAdvancedFilterText('');
    advancedRuleCounterRef.current += 1;
    setAdvancedFilterRules([{ id: `rule_${advancedRuleCounterRef.current}`, field: 'name', operator: 'contains', value: '' }]);
    setActivePresetId('');
  };

  const normalizePresetRules = (rules) => {
    if (!Array.isArray(rules) || rules.length === 0) {
      return [{ id: 'rule_1', field: 'name', operator: 'contains', value: '' }];
    }
    return rules.map((rule, index) => ({
      id: rule?.id || `rule_${index + 1}`,
      field: rule?.field || 'name',
      operator: rule?.operator || 'contains',
      value: rule?.value ?? ''
    }));
  };

  const getCurrentFilterPreset = () => ({
    quickFilter,
    query,
    sortBy,
    sortDirection,
    advancedFilterMode,
    advancedFilterText,
    advancedFilterRules
  });

  const applyFilterPreset = (preset) => {
    if (!preset) return;
    forceHideHover();
    setQuickFilter(String(preset.quickFilter || 'all'));
    setQuery(String(preset.query || ''));
    setSortBy(String(preset.sortBy || 'ref'));
    setSortDirection(String(preset.sortDirection || 'asc'));
    setAdvancedFilterMode(String(preset.advancedFilterMode || 'AND'));
    setAdvancedFilterText(String(preset.advancedFilterText || ''));
    const normalizedRules = normalizePresetRules(preset.advancedFilterRules);
    setAdvancedFilterRules(normalizedRules);
    const maxRuleId = normalizedRules.reduce((max, rule) => {
      const n = Number(String(rule.id || '').replace('rule_', ''));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 1);
    advancedRuleCounterRef.current = maxRuleId;
    setActivePresetId(String(preset.id || ''));
  };

  const saveCurrentPreset = () => {
    const name = window.prompt('Namn på filterprofil:', 'Min filterprofil');
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return;

    const id = activePresetId || `preset_${Date.now()}`;
    const preset = {
      id,
      name: trimmedName,
      ...getCurrentFilterPreset()
    };

    setSavedPresets((prev) => {
      const exists = prev.some((entry) => entry.id === id);
      return exists ? prev.map((entry) => (entry.id === id ? preset : entry)) : [...prev, preset];
    });
    setActivePresetId(id);
    showStatus('Filterprofil sparad.');
  };

  const deleteActivePreset = () => {
    if (!activePresetId) return;
    setSavedPresets((prev) => prev.filter((entry) => entry.id !== activePresetId));
    setActivePresetId('');
    showStatus('Filterprofil borttagen.');
  };

  const auditEntries = useMemo(() => {
    return Array.isArray(dbData?.meta?.audit) ? dbData.meta.audit : [];
  }, [dbData]);

  const personAuditMeta = useMemo(() => {
    const map = new Map();
    for (const entry of auditEntries) {
      if (!entry || entry.entityType !== 'person' || !entry.entityId) continue;
      const ts = Date.parse(entry.timestamp || 0);
      if (Number.isNaN(ts) || ts <= 0) continue;

      const existing = map.get(entry.entityId) || { createdAt: null, lastModifiedAt: null };

      if (entry.type === 'create') {
        existing.createdAt = existing.createdAt == null ? ts : Math.min(existing.createdAt, ts);
      }

      if (entry.type === 'edit' || entry.type === 'create') {
        existing.lastModifiedAt = existing.lastModifiedAt == null ? ts : Math.max(existing.lastModifiedAt, ts);
      }

      map.set(entry.entityId, existing);
    }
    return map;
  }, [auditEntries]);

  const advancedFieldValueOptions = useMemo(() => {
    const eventTypes = new Set(ALL_PERSON_EVENT_TYPES);
    const eventPlaces = new Set();
    const colorOptions = new Set(BRANCH_COLOR_PRESETS);

    for (const person of people) {
      const events = Array.isArray(person?.events) ? person.events : [];
      for (const event of events) {
        if (event?.type) eventTypes.add(String(event.type).trim());
        if (event?.place) eventPlaces.add(String(event.place).trim());
      }

      if (person?.color) colorOptions.add(String(person.color));
    }

    const sortSv = (values) => values.filter(Boolean).sort((a, b) => a.localeCompare(b, 'sv'));

    return {
      eventType: sortSv([...eventTypes]),
      eventPlace: sortSv([...eventPlaces]),
      color: sortSv([...colorOptions])
    };
  }, [people]);

  const getFieldValueOptions = (field) => advancedFieldValueOptions[field] || [];

  const forceHideHover = () => {};

  const personMatchesQuery = (person, rawQuery) => {
    const trimmed = String(rawQuery || '').trim().toLowerCase();
    if (!trimmed) return true;

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const events = Array.isArray(person?.events) ? person.events : [];
    const personText = [
      person?.firstName,
      person?.lastName,
      person?.refNumber,
      ...events.map((event) => event?.type),
      ...events.map((event) => event?.date),
      ...events.map((event) => event?.place),
      ...events.map((event) => event?.description)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const birthYear = getBirthYear(person).toLowerCase();
    const placeText = events
      .map((event) => event?.place)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => {
      const [prefixRaw, ...rest] = token.split(':');
      if (rest.length === 0) {
        return personText.includes(token);
      }

      const value = rest.join(':').trim();
      const prefix = prefixRaw.trim();
      if (!value) return true;

      if (['ar', 'år', 'year', 'fodelsear', 'födelseår', 'born'].includes(prefix)) {
        return birthYear.includes(value);
      }

      if (['ort', 'plats', 'place'].includes(prefix)) {
        return placeText.includes(value);
      }

      if (['ref', 'id'].includes(prefix)) {
        return String(person?.refNumber || person?.id || '').toLowerCase().includes(value);
      }

      if (['namn', 'name'].includes(prefix)) {
        const fullName = `${person?.firstName || ''} ${person?.lastName || ''}`.toLowerCase();
        return fullName.includes(value);
      }

      return personText.includes(value);
    });
  };

  const getPersonFieldValue = (person, field) => {
    const events = Array.isArray(person?.events) ? person.events : [];

    if (field === 'name') return `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
    if (field === 'ref') return Number(person?.refNumber || 0);
    if (field === 'eventType') return events.map((event) => event?.type).filter(Boolean).join(' ');
    if (field === 'eventDate') return events.map((event) => event?.date).filter(Boolean).join(' ');
    if (field === 'eventPlace') return events.map((event) => event?.place).filter(Boolean).join(' ');
    if (field === 'createdAt') return personAuditMeta.get(person.id)?.createdAt || null;
    if (field === 'updatedAt') return personAuditMeta.get(person.id)?.lastModifiedAt || null;
    if (field === 'hasSources') return personHasSources(person);
    if (field === 'hasMedia') return personHasMedia(person);
    if (field === 'hasWarnings') return personHasWarnings(person);
    if (field === 'isEmigrant') return personIsEmigrant(person);
    if (field === 'color') return String(person?.color || '');

    return '';
  };

  const evaluateAdvancedRule = (person, rule) => {
    const fieldValue = getPersonFieldValue(person, rule.field);
    const operator = rule.operator;
    const rawValue = String(rule.value || '').trim();

    if (rule.field === 'eventType') {
      if (!rawValue) return true;
      const events = Array.isArray(person?.events) ? person.events : [];
      const normalizedTarget = rawValue.toLowerCase();
      const hasType = events.some((event) => String(event?.type || '').toLowerCase() === normalizedTarget);
      if (operator === 'has_event_type') return hasType;
      if (operator === 'not_has_event_type') return !hasType;
      return true;
    }

    if (booleanFields.has(rule.field)) {
      if (operator === 'is_true') return Boolean(fieldValue) === true;
      if (operator === 'is_false') return Boolean(fieldValue) === false;
      return true;
    }

    if (!rawValue) return true;

    if (dateFields.has(rule.field)) {
      const targetTs = Date.parse(rawValue);
      if (Number.isNaN(targetTs)) return false;

      if (rule.field === 'eventDate') {
        const events = Array.isArray(person?.events) ? person.events : [];
        const eventTimestamps = events
          .map((event) => Date.parse(String(event?.date || '')))
          .filter((timestamp) => Number.isFinite(timestamp));

        if (eventTimestamps.length === 0) return false;

        if (operator === 'on_or_after') return eventTimestamps.some((ts) => ts >= targetTs);
        if (operator === 'after') return eventTimestamps.some((ts) => ts > targetTs);
        if (operator === 'on_or_before') return eventTimestamps.some((ts) => ts <= targetTs);
        if (operator === 'before') return eventTimestamps.some((ts) => ts < targetTs);
        if (operator === 'equals') return eventTimestamps.some((ts) => new Date(ts).toDateString() === new Date(targetTs).toDateString());
        return true;
      }

      const currentTs = Number(fieldValue || 0);
      if (!currentTs) return false;

      if (operator === 'on_or_after') return currentTs >= targetTs;
      if (operator === 'after') return currentTs > targetTs;
      if (operator === 'on_or_before') return currentTs <= targetTs;
      if (operator === 'before') return currentTs < targetTs;
      if (operator === 'equals') return new Date(currentTs).toDateString() === new Date(targetTs).toDateString();
      return true;
    }

    if (numberFields.has(rule.field)) {
      const a = Number(fieldValue);
      const b = Number(rawValue);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;

      if (operator === 'equals') return a === b;
      if (operator === 'not_equals') return a !== b;
      if (operator === 'gt') return a > b;
      if (operator === 'gte') return a >= b;
      if (operator === 'lt') return a < b;
      if (operator === 'lte') return a <= b;
      return true;
    }

    const current = String(fieldValue || '').toLowerCase();
    const needle = rawValue.toLowerCase();

    if (operator === 'contains') return current.includes(needle);
    if (operator === 'not_contains') return !current.includes(needle);
    if (operator === 'equals') return current === needle;
    if (operator === 'not_equals') return current !== needle;
    if (operator === 'starts_with') return current.startsWith(needle);
    if (operator === 'ends_with') return current.endsWith(needle);
    return true;
  };

  const personMatchesAdvancedFilters = (person) => {
    const activeRules = advancedFilterRules.filter((rule) => {
      if (booleanFields.has(rule.field)) return true;
      return String(rule.value || '').trim().length > 0;
    });

    const rulePass = activeRules.length === 0
      ? true
      : advancedFilterMode === 'AND'
        ? activeRules.every((rule) => evaluateAdvancedRule(person, rule))
        : activeRules.some((rule) => evaluateAdvancedRule(person, rule));

    const textPass = String(advancedFilterText || '').trim()
      ? personMatchesQuery(person, advancedFilterText)
      : true;

    return rulePass && textPass;
  };

  const personMatchesQuickFilter = (person, activeFilter) => {
    if (activeFilter === 'warnings') return personHasWarnings(person);
    if (activeFilter === 'bookmarked') return bookmarks.includes(person.id);
    return true;
  };

  const sortedPeople = useMemo(
    () => {
      const getFullName = (person) => `${person?.firstName || ''} ${person?.lastName || ''}`.trim().toLowerCase();
      const byRef = (a, b) => (a.refNumber || 0) - (b.refNumber || 0);
      const directionSign = sortDirection === 'asc' ? 1 : -1;

      const sorted = [...people].sort((a, b) => {
        if (sortBy === 'firstName') {
          const aFirst = String(a?.firstName || '').trim().toLowerCase();
          const bFirst = String(b?.firstName || '').trim().toLowerCase();
          const firstDiff = aFirst.localeCompare(bFirst, 'sv');
          if (firstDiff !== 0) return firstDiff * directionSign;

          const aLast = String(a?.lastName || '').trim().toLowerCase();
          const bLast = String(b?.lastName || '').trim().toLowerCase();
          const lastDiff = aLast.localeCompare(bLast, 'sv');
          return lastDiff !== 0 ? lastDiff * directionSign : byRef(a, b) * directionSign;
        }

        if (sortBy === 'lastName') {
          const aLast = String(a?.lastName || '').trim().toLowerCase();
          const bLast = String(b?.lastName || '').trim().toLowerCase();
          const lastDiff = aLast.localeCompare(bLast, 'sv');
          if (lastDiff !== 0) return lastDiff * directionSign;

          const aFirst = String(a?.firstName || '').trim().toLowerCase();
          const bFirst = String(b?.firstName || '').trim().toLowerCase();
          const firstDiff = aFirst.localeCompare(bFirst, 'sv');
          return firstDiff !== 0 ? firstDiff * directionSign : byRef(a, b) * directionSign;
        }

        if (sortBy === 'created') {
          const aCreated = personAuditMeta.get(a.id)?.createdAt || 0;
          const bCreated = personAuditMeta.get(b.id)?.createdAt || 0;
          const diff = aCreated - bCreated;
          return diff !== 0 ? diff * directionSign : byRef(a, b) * directionSign;
        }

        if (sortBy === 'updated') {
          const aUpdated = personAuditMeta.get(a.id)?.lastModifiedAt || 0;
          const bUpdated = personAuditMeta.get(b.id)?.lastModifiedAt || 0;
          const diff = aUpdated - bUpdated;
          return diff !== 0 ? diff * directionSign : byRef(a, b) * directionSign;
        }

        if (sortBy === 'birthYear') {
          const aYear = Number.parseInt(getBirthYear(a), 10);
          const bYear = Number.parseInt(getBirthYear(b), 10);
          const aValue = Number.isNaN(aYear) ? Number.POSITIVE_INFINITY : aYear;
          const bValue = Number.isNaN(bYear) ? Number.POSITIVE_INFINITY : bYear;
          const diff = aValue - bValue;
          return diff !== 0 ? diff * directionSign : byRef(a, b) * directionSign;
        }

        if (sortBy === 'deathYear') {
          const aYear = (() => {
            const date = String(getDeathEvent(a)?.date || '');
            const match = date.match(/(\d{4})/);
            return match ? Number.parseInt(match[1], 10) : Number.NaN;
          })();
          const bYear = (() => {
            const date = String(getDeathEvent(b)?.date || '');
            const match = date.match(/(\d{4})/);
            return match ? Number.parseInt(match[1], 10) : Number.NaN;
          })();
          const aValue = Number.isNaN(aYear) ? Number.POSITIVE_INFINITY : aYear;
          const bValue = Number.isNaN(bYear) ? Number.POSITIVE_INFINITY : bYear;
          const diff = aValue - bValue;
          return diff !== 0 ? diff * directionSign : byRef(a, b) * directionSign;
        }

        if (sortBy === 'birthPlace') {
          const aPlace = String(getBirthEvent(a)?.place || '').trim().toLowerCase();
          const bPlace = String(getBirthEvent(b)?.place || '').trim().toLowerCase();
          const diff = aPlace.localeCompare(bPlace, 'sv');
          if (diff !== 0) return diff * directionSign;
          const aFirst = String(a?.firstName || '').trim().toLowerCase();
          const bFirst = String(b?.firstName || '').trim().toLowerCase();
          const firstDiff = aFirst.localeCompare(bFirst, 'sv');
          return firstDiff !== 0 ? firstDiff * directionSign : byRef(a, b) * directionSign;
        }

        if (sortBy === 'deathPlace') {
          const aPlace = String(getDeathEvent(a)?.place || '').trim().toLowerCase();
          const bPlace = String(getDeathEvent(b)?.place || '').trim().toLowerCase();
          const diff = aPlace.localeCompare(bPlace, 'sv');
          if (diff !== 0) return diff * directionSign;
          const aFirst = String(a?.firstName || '').trim().toLowerCase();
          const bFirst = String(b?.firstName || '').trim().toLowerCase();
          const firstDiff = aFirst.localeCompare(bFirst, 'sv');
          return firstDiff !== 0 ? firstDiff * directionSign : byRef(a, b) * directionSign;
        }

        return byRef(a, b) * directionSign;
      });

      return sorted;
    },
    [people, sortBy, sortDirection, personAuditMeta]
  );

  const filteredPeople = useMemo(
    () => sortedPeople.filter((person) => (
      personMatchesQuickFilter(person, quickFilter)
      && personMatchesQuery(person, query)
      && personMatchesAdvancedFilters(person)
    )),
    [sortedPeople, quickFilter, query, advancedFilterRules, advancedFilterMode, advancedFilterText]
  );

  const bookmarkedPeople = filteredPeople.filter((p) => bookmarks.includes(p.id));
  const otherPeople = filteredPeople.filter((p) => !bookmarks.includes(p.id));

  const quickFilterCounts = useMemo(() => {
    const counts = {
      warnings: 0,
      bookmarked: 0
    };

    for (const person of sortedPeople) {
      if (personHasWarnings(person)) counts.warnings += 1;
      if (bookmarks.includes(person.id)) counts.bookmarked += 1;
    }

    return counts;
  }, [sortedPeople, bookmarks]);

  const getParentIds = (personId) => {
    const person = getPersonByIdMap.get(String(personId));
    if (!person) return [];
    const fromPerson = Array.isArray(person?.relations?.parents)
      ? person.relations.parents.map(extractIdFromRelationEntry).filter(Boolean)
      : [];
    return [...new Set(fromPerson)];
  };

  const getChildIds = (personId) => {
    const person = getPersonByIdMap.get(String(personId));
    if (!person) return [];
    const fromPerson = Array.isArray(person?.relations?.children)
      ? person.relations.children.map(extractIdFromRelationEntry).filter(Boolean)
      : [];
    return [...new Set(fromPerson)];
  };

  const collectLineageIds = (startPersonId, direction) => {
    const seen = new Set();
    const queue = [String(startPersonId)];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || seen.has(currentId)) continue;
      seen.add(currentId);

      const nextIds = direction === 'ancestors' ? getParentIds(currentId) : getChildIds(currentId);
      nextIds.forEach((nextId) => {
        if (!seen.has(nextId)) queue.push(nextId);
      });
    }

    return seen;
  };

  const applyBranchColor = (personId, scope, color) => {
    if (!personId || !color) return;

    const selectedColor = String(color).trim();
    if (!selectedColor) return;

    let targetIds = new Set([String(personId)]);
    if (scope === 'ancestors') targetIds = collectLineageIds(personId, 'ancestors');
    if (scope === 'descendants') targetIds = collectLineageIds(personId, 'descendants');

    setDbData((prev) => {
      if (!prev || !Array.isArray(prev.people)) return prev;
      const updatedPeople = prev.people.map((person) => (
        targetIds.has(String(person.id)) ? { ...person, color: selectedColor } : person
      ));
      return { ...prev, people: updatedPeople };
    });

    try {
      recordAudit({
        type: 'edit',
        entityType: 'person-color',
        entityId: String(personId),
        details: {
          scope,
          color: selectedColor,
          personIds: Array.from(targetIds)
        }
      });
    } catch {
      // Ignore audit failures for color tagging.
    }

    const scopeText = scope === 'self' ? 'denna person' : scope === 'ancestors' ? 'alla anor' : 'alla ättlingar';
    showStatus(`Grenfärg satt på ${scopeText}.`);
  };

  const getLifeSpanString = (person) => {
    const birthEvent = getBirthEvent(person);
    const deathEvent = getDeathEvent(person);
    const birthDate = birthEvent?.date || '';
    const deathDate = deathEvent?.date || '';
    if (!birthDate && !deathDate) return '';
    return `(${birthDate} - ${deathDate})`;
  };

  const personColumns = useMemo(() => ([
    { id: 'ref', label: 'Ref Nr' },
    { id: 'firstName', label: 'F.Namn' },
    { id: 'lastName', label: 'E.Namn' },
    { id: 'gender', label: 'Kön' },
    { id: 'birthYear', label: 'Född År' },
    { id: 'birthPlace', label: 'Född Plats' },
    { id: 'deathYear', label: 'Död År' },
    { id: 'deathPlace', label: 'Död Plats' },
    { id: 'occupation', label: 'Yrke / Titel' }
  ]), []);

  const getOccupationText = (person) => {
    const events = Array.isArray(person?.events) ? person.events : [];
    const occupationEvent = events.find((event) => {
      const type = String(event?.type || '').toLowerCase();
      return type === 'yrke' || type === 'titel';
    });
    if (!occupationEvent) return '';
    return String(occupationEvent?.description || occupationEvent?.value || occupationEvent?.notes || '').trim();
  };

  const getDatePlaceText = (event) => {
    if (!event) return '-';
    const date = String(event?.date || '').trim();
    const place = String(event?.place || '').trim();
    if (!date && !place) return '-';
    if (!place) return date;
    if (!date) return place;
    return `${date} | ${place}`;
  };

  const renderedColumnOrder = useMemo(
    () => columnOrder.filter((columnId) => visibleColumns[columnId]),
    [columnOrder, visibleColumns]
  );

  const toggleColumnVisibility = (columnId) => {
    setVisibleColumns((prev) => {
      const next = { ...prev, [columnId]: !prev[columnId] };
      const anyVisible = Object.values(next).some(Boolean);
      return anyVisible ? next : prev;
    });
  };

  const handleColumnDragStart = (columnId) => {
    columnDragSuppressSortRef.current = true;
    setDraggedColumnId(columnId);
    setDragOverColumnId(null);
  };

  const handleColumnDragOver = (event, targetColumnId) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (draggedColumnId && draggedColumnId !== targetColumnId) {
      setDragOverColumnId(targetColumnId);
    } else {
      setDragOverColumnId(null);
    }
  };

  const handleColumnDragLeave = (event, targetColumnId) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    setDragOverColumnId((prev) => (prev === targetColumnId ? null : prev));
  };

  const handleColumnDragEnd = () => {
    window.setTimeout(() => {
      columnDragSuppressSortRef.current = false;
    }, 120);
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  const handleColumnDrop = (targetColumnId) => {
    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null);
      setDragOverColumnId(null);
      return;
    }

    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(draggedColumnId);
      const toIndex = next.indexOf(targetColumnId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggedColumnId);
      return next;
    });
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  const renderPersonCell = (person, columnId) => {
    if (columnId === 'ref') return <span className="font-mono text-xs text-muted">{person.refNumber || '-'}</span>;

    if (columnId === 'firstName') {
      return (
        <div className="flex items-center gap-2 min-w-0">
          <span
            onClick={(e) => {
              e.stopPropagation();
              forceHideHover();
              onSetFocusPair('primary', person.id);
            }}
            className={`cursor-pointer text-base leading-none ${person.id === focusPair.primary ? 'text-warning' : 'text-muted hover:text-warning'}`}
            title="Sätt som Primär Fokus"
          >★</span>
          <span
            onClick={(e) => {
              e.stopPropagation();
              forceHideHover();
              onSetFocusPair('secondary', person.id);
            }}
            className={`cursor-pointer text-base leading-none ${person.id === focusPair.secondary ? 'text-accent' : 'text-muted hover:text-accent'}`}
            title="Sätt som Sekundär Fokus"
          >★</span>
          <GenderIcon gender={person.gender} className="flex-shrink-0" />
          <span className="truncate font-semibold text-primary">{person.firstName || '-'}</span>
        </div>
      );
    }

    if (columnId === 'lastName') return <span className="text-secondary font-medium">{person.lastName || '-'}</span>;

    if (columnId === 'gender') return <span className="text-secondary">{person.gender || person.sex || '-'}</span>;
    if (columnId === 'birthYear') return <span className="text-secondary">{getBirthYear(person) || '-'}</span>;
    if (columnId === 'birthPlace') return <span className="text-secondary">{String(getBirthEvent(person)?.place || '-')}</span>;
    if (columnId === 'deathYear') {
      const deathDate = String(getDeathEvent(person)?.date || '');
      const yearMatch = deathDate.match(/(\d{4})/);
      return <span className="text-secondary">{yearMatch ? yearMatch[1] : '-'}</span>;
    }
    if (columnId === 'deathPlace') return <span className="text-secondary">{String(getDeathEvent(person)?.place || '-')}</span>;
    if (columnId === 'occupation') return <span className="text-secondary">{getOccupationText(person) || '-'}</span>;

    return <span className="text-muted">-</span>;
  };

  const toIsoDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };

  const escapeCsvValue = (value) => {
    const text = String(value ?? '');
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportFilteredPeopleToCsv = () => {
    if (filteredPeople.length === 0) {
      showStatus('Ingen data att exportera.');
      return;
    }

    const header = [
      'ref',
      'fornamn',
      'efternamn',
      'kon',
      'fodelsedatum',
      'fodelseort',
      'dodsdatum',
      'dodsort',
      'skapad',
      'senast_andrad',
      'har_kallor',
      'har_media',
      'har_varningar',
      'ar_emigrant'
    ];

    const rows = filteredPeople.map((person) => {
      const birth = getBirthEvent(person) || {};
      const death = getDeathEvent(person) || {};
      const audit = personAuditMeta.get(person.id) || {};
      return [
        person.refNumber || '',
        person.firstName || '',
        person.lastName || '',
        person.gender || '',
        birth.date || '',
        birth.place || '',
        death.date || '',
        death.place || '',
        toIsoDate(audit.createdAt),
        toIsoDate(audit.lastModifiedAt),
        personHasSources(person) ? 'ja' : 'nej',
        personHasMedia(person) ? 'ja' : 'nej',
        personHasWarnings(person) ? 'ja' : 'nej',
        personIsEmigrant(person) ? 'ja' : 'nej'
      ].map(escapeCsvValue).join(',');
    });

    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `personer-filtrerad-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showStatus('CSV-export klar.');
  };

  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (quickFilter !== 'all') {
      const quickMap = {
        warnings: 'Snabbfilter: Varningar'
      };
      chips.push({ id: 'quick', label: quickMap[quickFilter] || 'Snabbfilter', clear: () => setQuickFilter('all') });
    }

    if (query.trim()) {
      chips.push({ id: 'query', label: `Sök: ${query.trim()}`, clear: () => setQuery('') });
    }

    if (advancedFilterText.trim()) {
      chips.push({ id: 'adv_text', label: `Fritext: ${advancedFilterText.trim()}`, clear: () => setAdvancedFilterText('') });
    }

    const fieldMap = Object.fromEntries(advancedFilterFields.map((field) => [field.value, field.label]));
    const activeRules = advancedFilterRules.filter((rule) => {
      if (booleanFields.has(rule.field)) return true;
      return String(rule.value || '').trim().length > 0;
    });

    activeRules.forEach((rule) => {
      const operators = getFieldOperatorOptions(rule.field);
      const operatorLabel = operators.find((option) => option.value === rule.operator)?.label || rule.operator;
      const valueLabel = booleanFields.has(rule.field) ? '' : ` ${String(rule.value || '').trim()}`;
      chips.push({
        id: `rule_${rule.id}`,
        label: `${fieldMap[rule.field] || rule.field} ${operatorLabel}${valueLabel}`,
        clear: () => removeAdvancedFilterRule(rule.id)
      });
    });

    return chips;
  }, [
    quickFilter,
    query,
    advancedFilterText,
    advancedFilterRules,
    advancedFilterFields,
    booleanFields
  ]);

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, personId: null });
    setColorMenu({ isOpen: false, personId: null, color: BRANCH_COLOR_PRESETS[0] });
  };

  const copyText = async (value) => {
    const text = String(value || '');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showStatus('Kopierat till urklipp.');
    } catch {
      showStatus('Kunde inte kopiera till urklipp.');
    }
  };

  const executePersonAction = (action, personId) => {
    forceHideHover();
    const person = people.find((p) => p.id === personId);
    if (!person) return;

    if (action === 'edit') onOpenEditModal(person.id);
    if (action === 'tree') onOpenRelationModal(person.id);
    if (action === 'primary') onSetFocusPair('primary', person.id);
    if (action === 'secondary') onSetFocusPair('secondary', person.id);
    if (action === 'copy-ref') copyText(person.refNumber);
    if (action === 'copy-name') copyText(`${person.firstName || ''} ${person.lastName || ''}`.trim());
    if (action === 'color-self') applyBranchColor(person.id, 'self', colorMenu.color);
    if (action === 'color-ancestors') applyBranchColor(person.id, 'ancestors', colorMenu.color);
    if (action === 'color-descendants') applyBranchColor(person.id, 'descendants', colorMenu.color);
    if (action === 'delete') onDeletePerson(person.id);

    closeContextMenu();
  };

  const handleContextMenu = (event, personId) => {
    event.preventDefault();
    forceHideHover();

    const menuWidth = 260;
    const menuHeight = Math.min(580, window.innerHeight - 16);
    let x = event.clientX;
    let y = event.clientY;

    const maxX = Math.max(8, window.innerWidth - menuWidth - 8);
    const maxY = Math.max(8, window.innerHeight - menuHeight - 8);

    x = Math.min(Math.max(x, 8), maxX);
    y = Math.min(Math.max(y, 8), maxY);

    setContextMenu({ isOpen: true, x, y, personId });
    const person = people.find((p) => p.id === personId);
    setColorMenu({
      isOpen: false,
      personId,
      color: person?.color || BRANCH_COLOR_PRESETS[0]
    });
  };

  useEffect(() => {
    if (!contextMenu.isOpen) return undefined;

    const handleGlobalClick = () => closeContextMenu();
    const handleGlobalEscape = (event) => {
      if (event.key === 'Escape') closeContextMenu();
    };

    const handleMenuShortcuts = (event) => {
      if (!contextMenu.personId) return;
      if (event.key === 'Enter') executePersonAction('edit', contextMenu.personId);
      if (event.key.toLowerCase() === 't') executePersonAction('tree', contextMenu.personId);
      if (event.key.toLowerCase() === 'p') executePersonAction('primary', contextMenu.personId);
      if (event.key.toLowerCase() === 's') executePersonAction('secondary', contextMenu.personId);
      if (event.key === 'Delete') executePersonAction('delete', contextMenu.personId);
    };

    document.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleGlobalEscape);
    window.addEventListener('keydown', handleMenuShortcuts);

    return () => {
      document.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleGlobalEscape);
      window.removeEventListener('keydown', handleMenuShortcuts);
    };
  }, [contextMenu.isOpen, contextMenu.personId]);

  const sortableColumns = useMemo(() => new Set([
    'ref',
    'firstName',
    'lastName',
    'birthYear',
    'birthPlace',
    'deathYear',
    'deathPlace',
    'created',
    'updated'
  ]), []);

  const columnSortKeyMap = useMemo(() => ({
    ref: 'ref',
    firstName: 'firstName',
    lastName: 'lastName',
    birthYear: 'birthYear',
    birthPlace: 'birthPlace',
    deathYear: 'deathYear',
    deathPlace: 'deathPlace'
  }), []);

  const handleColumnHeaderSort = (columnId) => {
    if (columnDragSuppressSortRef.current) return;
    const sortKey = columnSortKeyMap[columnId];
    if (!sortKey || !sortableColumns.has(sortKey)) return;

    if (sortBy === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(sortKey);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setSavedPresets(parsed);
    } catch {
      // Ignore malformed preset storage.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
    } catch {
      // Ignore storage write failures.
    }
  }, [savedPresets]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERSON_LIST_COLUMNS_STORAGE_KEY);
      if (!raw) {
        setHasLoadedColumnPreferences(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        setHasLoadedColumnPreferences(true);
        return;
      }

      if (Array.isArray(parsed.order)) {
        const allowed = new Set(personColumns.map((column) => column.id));
        const filtered = parsed.order.filter((columnId) => allowed.has(columnId));
        const missing = personColumns.map((column) => column.id).filter((columnId) => !filtered.includes(columnId));
        setColumnOrder([...filtered, ...missing]);
      }

      if (parsed.visible && typeof parsed.visible === 'object') {
        setVisibleColumns((prev) => {
          const next = { ...prev };
          for (const column of personColumns) {
            if (typeof parsed.visible[column.id] === 'boolean') {
              next[column.id] = parsed.visible[column.id];
            }
          }
          const anyVisible = Object.values(next).some(Boolean);
          return anyVisible ? next : prev;
        });
      }
    } catch {
      // Ignore malformed storage.
    } finally {
      setHasLoadedColumnPreferences(true);
    }
  }, [personColumns]);

  useEffect(() => {
    if (!hasLoadedColumnPreferences) return;
    try {
      localStorage.setItem(PERSON_LIST_COLUMNS_STORAGE_KEY, JSON.stringify({
        order: columnOrder,
        visible: visibleColumns
      }));
    } catch {
      // Ignore storage write failures.
    }
  }, [columnOrder, visibleColumns, hasLoadedColumnPreferences]);

  useEffect(() => {
    if (!isColumnMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (columnsMenuRef.current && columnsMenuRef.current.contains(event.target)) return;
      setIsColumnMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isColumnMenuOpen]);

  const StatusIndicators = ({ person }) => (
    <div className="flex items-center gap-1.5 ml-2">
      {personHasMedia(person) && <ImageIcon className="w-3.5 h-3.5 text-muted" title="Har media" />}
      {personHasSources(person) && <BookOpen className="w-3.5 h-3.5 text-accent" title="Har källor" />}
      {personHasWarnings(person) && <AlertTriangle className="w-3.5 h-3.5 text-amber-300" title="Har varningar" />}
    </div>
  );

  const PersonRow = ({ person }) => {
    const handleRestore = (e) => {
      e.stopPropagation();
      forceHideHover();
      const merge = (dbData?.meta?.merges || []).find(m => (m.originalPersonIds || []).includes(person.id));
      if (merge && undoMerge) {
        try {
          const ok = undoMerge(merge.id);
          if (ok) showStatus('Sammanfogning ångrad.');
          else showStatus('Återställning misslyckades.');
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.debug('undoMerge failed', err);
          showStatus('Återställning misslyckades.');
        }
      } else if (restorePerson) {
        try {
          restorePerson(person.id);
          showStatus('Person återställd från arkiv.');
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.debug('restorePerson failed', err);
          showStatus('Återställning misslyckades.');
        }
      } else {
        showStatus('Ingen ångra-information hittades.');
      }
    };

    return (
      <div
        key={person.id}
        onContextMenu={(e) => handleContextMenu(e, person.id)}
        className="relative flex justify-between items-center gap-3 p-3 hover:bg-surface-2 transition border-b border-subtle last:border-0"
        style={person?.color ? { borderLeft: `4px solid ${person.color}`, paddingLeft: '0.5rem' } : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-mono mr-2">REF: {person.refNumber}</span>
          <span
            onClick={(e) => { e.stopPropagation(); forceHideHover(); onSetFocusPair('primary', person.id); }}
            className={`cursor-pointer text-xl ${person.id === focusPair.primary ? 'text-warning' : 'text-muted hover:text-warning'}`}
            title="Sätt som Primär Fokus"
          >★</span>
          <span
            onClick={(e) => { e.stopPropagation(); forceHideHover(); onSetFocusPair('secondary', person.id); }}
            className={`cursor-pointer text-xl ${person.id === focusPair.secondary ? 'text-accent' : 'text-muted hover:text-accent'}`}
            title="Sätt som Sekundär Fokus"
          >★</span>
          <GenderIcon gender={person.gender} className="mr-2 flex-shrink-0" />
          <span className="cursor-pointer hover:text-accent" onClick={() => { forceHideHover(); onOpenEditModal(person.id); }}>
            <span className="font-bold text-primary">{person.firstName} {person.lastName}</span>
            {person._archived && <span className="text-danger font-semibold ml-2">ARKIVERAD</span>}
            {person._archived && (
              <button onClick={(e) => handleRestore(e)} className="ml-2 px-2 py-0.5 bg-danger text-on-accent rounded text-xs hover:bg-danger">Återställ</button>
            )}
            <span className="text-muted text-sm font-normal ml-1">{getLifeSpanString(person)}</span>
          </span>
          {person?.color && (
            <span
              className="inline-flex w-2.5 h-2.5 rounded-full border border-subtle"
              style={{ backgroundColor: person.color }}
              title={`Grenfärg: ${person.color}`}
            />
          )}
          <StatusIndicators person={person} />
        </div>
        <div className="flex gap-2 items-center">
          <button
        onClick={(e) => {
          e.stopPropagation();
          forceHideHover();
          setFamilyTreeFocusPersonId(person.id);
          // setFamilyTreeFocusPersonId wrapper sätter automatiskt isDirty
          showStatus('Huvudperson sparad!');
        }}
            title="Huvudperson - sätt som fokus i trädvyn"
            className={`px-2 py-0.5 text-xs border rounded ${familyTreeFocusPersonId === person.id ? 'bg-warning border-warning text-on-accent' : 'bg-surface-2 border-subtle text-secondary hover:bg-surface'}`}
          >
            Huvudperson
          </button>

          <button
            onClick={() => { forceHideHover(); onOpenEditModal(person.id); }}
            title="Redigera person"
            aria-label="Redigera person"
            className="inline-flex items-center justify-center px-2 py-0.5 text-xs bg-surface-2 border border-subtle text-primary rounded hover:bg-surface"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => { forceHideHover(); onOpenRelationModal(person.id); }}
            title="Visa i släktträd"
            aria-label="Visa i släktträd"
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border border-accent text-accent rounded hover:bg-accent-soft"
          >
            <Network className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => { forceHideHover(); onDeletePerson(person.id); }}
            title="Ta bort person"
            aria-label="Ta bort person"
            className="inline-flex items-center justify-center px-2 py-0.5 text-xs border border-danger text-danger rounded hover:bg-danger-soft font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const PersonCard = ({ person }) => {
    const portraitImage = getMediaPreviewSrc(person);
    const primaryMedia = Array.isArray(person?.media) ? person.media.find((entry) => entry && typeof entry === 'object') : null;
    const latestPrimaryMedia = Array.isArray(dbData?.media)
      ? dbData.media.find((entry) => String(entry?.id) === String(primaryMedia?.id)) || primaryMedia
      : primaryMedia;

    const handleRestore = (e) => {
      e.stopPropagation();
      const merge = (dbData?.meta?.merges || []).find((m) => (m.originalPersonIds || []).includes(person.id));
      if (merge && undoMerge) {
        try {
          const ok = undoMerge(merge.id);
          if (ok) showStatus('Sammanfogning ångrad.');
          else showStatus('Återställning misslyckades.');
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') console.debug('undoMerge failed', err);
          showStatus('Återställning misslyckades.');
        }
      } else if (restorePerson) {
        try {
          restorePerson(person.id);
          showStatus('Person återställd från arkiv.');
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') console.debug('restorePerson failed', err);
          showStatus('Återställning misslyckades.');
        }
      } else {
        showStatus('Ingen ångra-information hittades.');
      }
    };

    return (
      <article
        key={person.id}
        onContextMenu={(e) => handleContextMenu(e, person.id)}
        className="relative bg-background border border-subtle rounded-lg p-3 hover:border-strong transition"
        style={person?.color ? { borderLeft: `4px solid ${person.color}` } : undefined}
      >
        <div className="flex items-start gap-3">
          {portraitImage ? (
            <div className="w-10 h-10 rounded-full border border-subtle bg-surface overflow-hidden">
              <MediaImage
                url={portraitImage}
                alt={`${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Porträtt'}
                className="w-full h-full object-cover"
                style={getAvatarImageStyle(latestPrimaryMedia, person.id)}
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full border border-subtle bg-surface text-primary flex items-center justify-center font-semibold text-sm">
              {getPersonInitials(person)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted font-mono">REF: {person.refNumber}</span>
              <GenderIcon gender={person.gender} className="flex-shrink-0" />
              {person?.color && (
                <span
                  className="inline-flex w-2.5 h-2.5 rounded-full border border-subtle"
                  style={{ backgroundColor: person.color }}
                  title={`Grenfärg: ${person.color}`}
                />
              )}
              <StatusIndicators person={person} />
            </div>
            <button type="button" onClick={() => { forceHideHover(); onOpenEditModal(person.id); }} className="text-left hover:text-accent">
              <div className="font-semibold text-primary truncate">{person.firstName} {person.lastName}</div>
              <div className="text-xs text-muted truncate">{getLifeSpanString(person) || 'Okänt livsspann'}</div>
            </button>
            {person._archived && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-danger text-xs font-semibold">ARKIVERAD</span>
                <button onClick={(e) => handleRestore(e)} className="px-2 py-0.5 bg-danger text-on-accent rounded text-xs hover:bg-danger">Återställ</button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              forceHideHover();
              setFamilyTreeFocusPersonId(person.id);
              showStatus('Huvudperson sparad!');
            }}
            title="Huvudperson - sätt som fokus i trädvyn"
            className={`px-2 py-0.5 text-xs border rounded ${familyTreeFocusPersonId === person.id ? 'bg-warning border-warning text-on-accent' : 'bg-surface-2 border-subtle text-secondary hover:bg-surface'}`}
          >
            Huvudperson
          </button>
          <button
            onClick={() => { forceHideHover(); onOpenEditModal(person.id); }}
            title="Redigera person"
            aria-label="Redigera person"
            className="inline-flex items-center justify-center px-2 py-0.5 text-xs bg-surface-2 border border-subtle text-primary rounded hover:bg-surface"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { forceHideHover(); onOpenRelationModal(person.id); }}
            title="Visa i släktträd"
            aria-label="Visa i släktträd"
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border border-accent text-accent rounded hover:bg-accent-soft"
          >
            <Network className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => { forceHideHover(); onDeletePerson(person.id); }}
            title="Ta bort person"
            aria-label="Ta bort person"
            className="inline-flex items-center justify-center px-2 py-0.5 text-xs border border-danger text-danger rounded hover:bg-danger-soft font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              forceHideHover();
              onSetFocusPair('primary', person.id);
            }}
            className={`px-2 py-0.5 text-xs border rounded ${person.id === focusPair.primary ? 'border-warning text-warning bg-warning-soft' : 'border-subtle text-secondary hover:bg-surface-2'}`}
          >
            Primär
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              forceHideHover();
              onSetFocusPair('secondary', person.id);
            }}
            className={`px-2 py-0.5 text-xs border rounded ${person.id === focusPair.secondary ? 'border-accent text-accent bg-accent-soft' : 'border-subtle text-secondary hover:bg-surface-2'}`}
          >
            Sekundär
          </button>
        </div>
      </article>
    );
  };

  const contextMenuPerson = people.find((person) => person.id === contextMenu.personId);
  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="card h-full min-h-0 flex flex-col">
        <div className="p-4 border-b border-subtle bg-background flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="font-semibold text-primary">Människor i databasen</h2>
          </div>
          <span className="text-xs bg-surface-2 px-2 py-1 rounded-full text-secondary">{filteredPeople.length} / {people.length}</span>
        </div>

        <div className="p-3 border-b border-subtle bg-background space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök namn, datum, ort..."
                className="w-full bg-background border border-subtle rounded pl-9 pr-8 py-2 text-sm text-primary focus:outline-none focus:border-accent"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                  aria-label="Rensa sök"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onCreatePerson && onCreatePerson()}
              className="px-3 py-2 rounded bg-success hover:bg-success text-on-accent text-sm font-semibold flex items-center gap-1"
              title="Skapa ny person"
            >
              <Plus className="w-4 h-4" />
              Ny
            </button>

            <div className="relative" ref={columnsMenuRef}>
              <button
                type="button"
                onClick={() => setIsColumnMenuOpen((prev) => !prev)}
                className="px-3 py-2 rounded border border-subtle bg-surface hover:bg-surface-2 text-primary text-sm flex items-center gap-1"
                title="Visa eller dölj kolumner"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Kolumner
              </button>
              {isColumnMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-background border border-subtle rounded shadow-xl z-20 p-2 space-y-1">
                  {personColumns.map((column) => (
                    <label key={column.id} className="flex items-center gap-2 text-sm text-primary px-2 py-1 rounded hover:bg-surface cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(visibleColumns[column.id])}
                        onChange={() => toggleColumnVisibility(column.id)}
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                  <p className="text-[11px] text-muted px-2 pt-1">Dra kolumnrubriker i tabellen för att ändra ordning.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-surface border border-subtle rounded p-1">
              <button
                type="button"
                onClick={() => setIsAdvancedFilterOpen(true)}
                className="px-2 py-1 rounded text-xs flex items-center gap-1 text-secondary hover:bg-surface-2"
                title="Avancerad filtrering"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Avancerat
              </button>
              <select
                value={activePresetId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  if (!nextId) {
                    setActivePresetId('');
                    return;
                  }
                  const preset = savedPresets.find((entry) => entry.id === nextId);
                  applyFilterPreset(preset);
                }}
                className="bg-background border border-subtle rounded px-2 py-1 text-xs text-secondary focus:outline-none focus:border-accent max-w-[180px]"
                title="Filterprofiler"
              >
                <option value="">Profil: ingen</option>
                {savedPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={saveCurrentPreset}
                className="px-2 py-1 rounded text-xs flex items-center gap-1 text-secondary hover:bg-surface-2"
                title="Spara aktuell filterprofil"
              >
                <Save className="w-3.5 h-3.5" />
                Spara
              </button>
              <button
                type="button"
                onClick={exportFilteredPeopleToCsv}
                className="px-2 py-1 rounded text-xs flex items-center gap-1 text-secondary hover:bg-surface-2"
                title="Exportera filtrerad lista till CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-background border border-subtle rounded px-2 py-1 text-xs text-secondary focus:outline-none focus:border-accent"
                title="Sortera"
              >
                <option value="ref">Sortera: REF</option>
                <option value="firstName">Sortera: F.Namn</option>
                <option value="lastName">Sortera: E.Namn</option>
                <option value="birthYear">Sortera: Född År</option>
                <option value="birthPlace">Sortera: Född Plats</option>
                <option value="deathYear">Sortera: Död År</option>
                <option value="deathPlace">Sortera: Död Plats</option>
                <option value="created">Sortera: Skapad</option>
                <option value="updated">Sortera: Senast ändrad</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="px-2 py-1 rounded text-xs flex items-center gap-1 text-secondary hover:bg-surface-2"
                title="Växla sorteringsriktning"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${viewMode === 'list' ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-2'}`}
                title="Kompakt listvy"
              >
                <List className="w-3.5 h-3.5" />
                Lista
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${viewMode === 'grid' ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-2'}`}
                title="Visuell porträttvy"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Porträtt
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs border ${quickFilter === 'all' ? 'bg-accent border-accent text-on-accent' : 'bg-surface border-subtle text-secondary hover:bg-surface-2'}`}
            >
              Alla
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('warnings')}
              className={`px-2.5 py-1 rounded-full text-xs border ${quickFilter === 'warnings' ? 'bg-danger border-danger text-on-accent' : 'bg-surface border-subtle text-secondary hover:bg-surface-2'}`}
            >
              Varningar ({quickFilterCounts.warnings})
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('bookmarked')}
              className={`px-2.5 py-1 rounded-full text-xs border ${quickFilter === 'bookmarked' ? 'bg-accent border-accent text-on-accent' : 'bg-surface border-subtle text-secondary hover:bg-surface-2'}`}
            >
              Bokmärkta ({quickFilterCounts.bookmarked})
            </button>

            {activeFilterChips.map((chip) => (
              <span key={chip.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-surface-2 border border-subtle text-primary">
                <span className="max-w-[220px] truncate" title={chip.label}>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.clear}
                  className="text-secondary hover:text-primary"
                  aria-label={`Rensa ${chip.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-surface">
          {filteredPeople.length === 0 ? (
            <div className="p-8 text-center text-muted">Registret är tomt.</div>
          ) : (
            <>
              {viewMode === 'list' && (
                <div className="max-w-full overflow-x-auto overflow-y-visible custom-scrollbar">
                  <table className="w-full min-w-[980px] text-sm text-left border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10 bg-background text-secondary text-xs uppercase">
                      <tr>
                        <th className="w-1 px-0 py-0 border-b border-subtle" aria-hidden="true" />
                        {renderedColumnOrder.map((columnId) => {
                          const column = personColumns.find((entry) => entry.id === columnId);
                          const isDragged = draggedColumnId === columnId;
                          const isDropTarget = dragOverColumnId === columnId && draggedColumnId && draggedColumnId !== columnId;
                          return (
                            <th
                              key={columnId}
                              draggable
                              onDragStart={() => handleColumnDragStart(columnId)}
                              onDragOver={(event) => handleColumnDragOver(event, columnId)}
                              onDragLeave={(event) => handleColumnDragLeave(event, columnId)}
                              onDragEnd={handleColumnDragEnd}
                              onDrop={() => handleColumnDrop(columnId)}
                              className={`px-3 py-2 border-b border-subtle cursor-move select-none transition-colors ${isDragged ? 'opacity-50' : ''} ${isDropTarget ? 'border-l-4 border-l-accent bg-accent-soft' : ''}`}
                              title="Dra för att flytta kolumn"
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleColumnHeaderSort(columnId);
                                }}
                                className="inline-flex items-center gap-1 text-inherit hover:text-primary"
                                title={`Sortera på ${column?.label || columnId}`}
                              >
                                <span>{column?.label || columnId}</span>
                                {sortBy === columnSortKeyMap[columnId] && (
                                  sortDirection === 'asc'
                                    ? <ChevronUp className="w-3 h-3" />
                                    : <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            </th>
                          );
                        })}
                        <th className="px-3 py-2 border-b border-subtle text-right">Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...bookmarkedPeople, ...otherPeople].map((person) => (
                        <tr
                          key={person.id}
                          onContextMenu={(event) => handleContextMenu(event, person.id)}
                          onClick={() => {
                            forceHideHover();
                            onOpenEditModal(person.id);
                          }}
                          className="border-b border-subtle hover:bg-surface-2 cursor-pointer"
                        >
                          <td
                            className="w-1 px-0 py-0"
                            style={person?.color ? { backgroundColor: person.color } : { backgroundColor: 'transparent' }}
                            aria-hidden="true"
                          />
                          {renderedColumnOrder.map((columnId) => (
                            <td key={`${person.id}-${columnId}`} className="px-3 py-2 align-top">
                              {renderPersonCell(person, columnId)}
                            </td>
                          ))}
                          <td className="px-3 py-2 align-top">
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  forceHideHover();
                                  onOpenEditModal(person.id);
                                }}
                                title="Redigera person"
                                aria-label="Redigera person"
                                className="inline-flex items-center justify-center px-2 py-0.5 text-xs bg-surface-2 border border-subtle text-primary rounded hover:bg-surface"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  forceHideHover();
                                  onOpenRelationModal(person.id);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs border border-accent text-accent rounded hover:bg-accent-soft"
                                title="Visa i släktträd"
                                aria-label="Visa i släktträd"
                              >
                                <Network className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  forceHideHover();
                                  onDeletePerson(person.id);
                                }}
                                title="Ta bort person"
                                aria-label="Ta bort person"
                                className="inline-flex items-center justify-center px-2 py-0.5 text-xs border border-danger text-danger rounded hover:bg-danger-soft font-semibold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {viewMode === 'grid' && (
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {bookmarkedPeople.map((person) => <PersonCard key={person.id} person={person} />)}
                  {otherPeople.map((person) => <PersonCard key={person.id} person={person} />)}
                </div>
              )}

              {bookmarkedPeople.length > 0 && otherPeople.length > 0 && (
                <div className="px-4 pb-2 text-xs text-muted">Bokmärken visas först.</div>
              )}
            </>
          )}
        </div>

        {contextMenu.isOpen && contextMenuPerson && (
          <div
            className="fixed z-[7000] w-64 bg-background border border-subtle rounded-lg shadow-2xl py-1 overflow-y-auto"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              maxHeight: 'calc(100vh - 16px)'
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted">Huvudåtgärder</div>
            <button onClick={() => executePersonAction('edit', contextMenu.personId)} className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface flex items-center justify-between">
              <span>Redigera person</span><span className="text-muted text-[11px]">Enter</span>
            </button>
            <button onClick={() => executePersonAction('tree', contextMenu.personId)} className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface flex items-center justify-between">
              <span>Visa i släktträd</span><span className="text-muted text-[11px]">T</span>
            </button>

            <hr className="border-subtle my-1" />
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted">Fokus</div>
            <button onClick={() => executePersonAction('primary', contextMenu.personId)} className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface flex items-center justify-between">
              <span>Sätt som primär</span><span className="text-muted text-[11px]">P</span>
            </button>
            <button onClick={() => executePersonAction('secondary', contextMenu.personId)} className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface flex items-center justify-between">
              <span>Sätt som sekundär</span><span className="text-muted text-[11px]">S</span>
            </button>

            <hr className="border-subtle my-1" />
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted">Data</div>
            <button onClick={() => executePersonAction('copy-ref', contextMenu.personId)} className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface">
              Kopiera REF-nummer
            </button>
            <button onClick={() => executePersonAction('copy-name', contextMenu.personId)} className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface">
              Kopiera fullständigt namn
            </button>

            <hr className="border-subtle my-1" />
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted">Grenfärg</div>
            <button
              onClick={() => setColorMenu((prev) => ({
                isOpen: !(prev.isOpen && prev.personId === contextMenu.personId),
                personId: contextMenu.personId,
                color: prev.personId === contextMenu.personId ? prev.color : (contextMenuPerson?.color || BRANCH_COLOR_PRESETS[0])
              }))}
              className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
            >
              <Palette className="w-4 h-4" />
              Färgkoda gren...
            </button>

            {colorMenu.isOpen && colorMenu.personId === contextMenu.personId && (
              <div className="px-3 pb-2 pt-1 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {BRANCH_COLOR_PRESETS.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setColorMenu((prev) => ({ ...prev, color: swatch }))}
                      className={`w-5 h-5 rounded-full border ${colorMenu.color === swatch ? 'border-strong' : 'border-strong'}`}
                      style={{ backgroundColor: swatch }}
                      title={swatch}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  <button
                    type="button"
                    onClick={() => executePersonAction('color-self', contextMenu.personId)}
                    className="w-full px-2 py-1.5 text-left text-xs text-primary bg-surface border border-subtle rounded hover:bg-surface-2"
                  >
                    Bara denna person
                  </button>
                  <button
                    type="button"
                    onClick={() => executePersonAction('color-ancestors', contextMenu.personId)}
                    className="w-full px-2 py-1.5 text-left text-xs text-primary bg-surface border border-subtle rounded hover:bg-surface-2"
                  >
                    Alla anor (bakåt)
                  </button>
                  <button
                    type="button"
                    onClick={() => executePersonAction('color-descendants', contextMenu.personId)}
                    className="w-full px-2 py-1.5 text-left text-xs text-primary bg-surface border border-subtle rounded hover:bg-surface-2"
                  >
                    Alla ättlingar (framåt)
                  </button>
                </div>
              </div>
            )}

            <hr className="border-subtle my-1" />
            <button onClick={() => executePersonAction('delete', contextMenu.personId)} className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft/20 flex items-center justify-between">
              <span>Ta bort person</span><span className="text-danger text-[11px]">Del</span>
            </button>
          </div>
        )}

        {isAdvancedFilterOpen && (
          <div className="fixed inset-0 z-[7200] bg-background/50 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-surface border border-subtle rounded-lg shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-subtle bg-background flex items-center justify-between">
                <div>
                  <h3 className="text-primary font-semibold">Avancerad filtrering</h3>
                  <p className="text-xs text-muted mt-1">Bygg IF/OR-villkor för namn, händelser, datum, skapad och mer.</p>
                </div>
                <div className="flex items-center gap-2">
                  {activePresetId && (
                    <button
                      type="button"
                      onClick={deleteActivePreset}
                      className="px-3 py-1.5 text-xs border border-danger text-danger rounded hover:bg-danger-soft"
                    >
                      Ta bort profil
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearAdvancedFilters}
                    className="px-3 py-1.5 text-xs border border-subtle rounded text-secondary hover:bg-surface-2"
                  >
                    Nollställ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdvancedFilterOpen(false)}
                    className="px-3 py-1.5 text-xs bg-accent rounded text-on-accent hover:bg-accent"
                  >
                    Klar
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-muted mb-1">Fritext (global)</label>
                    <input
                      type="text"
                      value={advancedFilterText}
                      onChange={(e) => setAdvancedFilterText(e.target.value)}
                      placeholder="Ex: stockholm 1890 vigsel"
                      className="w-full bg-background border border-subtle rounded px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Regellogik</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAdvancedFilterMode('AND')}
                        className={`px-3 py-2 rounded text-xs border ${advancedFilterMode === 'AND' ? 'bg-accent border-accent text-on-accent' : 'bg-background border-subtle text-secondary hover:bg-surface-2'}`}
                      >
                        IF + AND (alla)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdvancedFilterMode('OR')}
                        className={`px-3 py-2 rounded text-xs border ${advancedFilterMode === 'OR' ? 'bg-accent border-accent text-on-accent' : 'bg-background border-subtle text-secondary hover:bg-surface-2'}`}
                      >
                        IF + OR (minst en)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {advancedFilterRules.map((rule, index) => {
                    const operators = getFieldOperatorOptions(rule.field);
                    const needsValue = !booleanFields.has(rule.field);
                    const valueOptions = getFieldValueOptions(rule.field);
                    const hasValueOptions = needsValue && valueOptions.length > 0;
                    const isBooleanField = booleanFields.has(rule.field);
                    const isEventTypeField = rule.field === 'eventType';

                    return (
                      <div key={rule.id} className="border border-subtle rounded bg-background p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-muted">{index === 0 ? 'IF' : advancedFilterMode}</div>
                          <button
                            type="button"
                            onClick={() => removeAdvancedFilterRule(rule.id)}
                            className="text-muted hover:text-danger"
                            title="Ta bort villkor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <select
                            value={rule.field}
                            onChange={(e) => updateAdvancedFilterRule(rule.id, { field: e.target.value })}
                            className="bg-background border border-subtle rounded px-2 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                          >
                            {advancedFilterFields.map((field) => (
                              <option key={field.value} value={field.value}>{field.label}</option>
                            ))}
                          </select>

                          {isEventTypeField ? (
                            <select
                              value={rule.value}
                              onChange={(e) => updateAdvancedFilterRule(rule.id, { value: e.target.value })}
                              className="bg-background border border-subtle rounded px-2 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                            >
                              <option value="">Välj händelse...</option>
                              {valueOptions.map((valueOption) => (
                                <option key={valueOption} value={valueOption}>{valueOption}</option>
                              ))}
                            </select>
                          ) : isBooleanField ? (
                            <div className="flex items-center text-xs text-muted px-2 py-2 border border-subtle rounded bg-background">
                              Booleskt villkor
                            </div>
                          ) : (
                            <select
                              value={rule.operator}
                              onChange={(e) => updateAdvancedFilterRule(rule.id, { operator: e.target.value })}
                              className="bg-background border border-subtle rounded px-2 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                            >
                              {operators.map((operator) => (
                                <option key={operator.value} value={operator.value}>{operator.label}</option>
                              ))}
                            </select>
                          )}

                          {isEventTypeField ? (
                            <div className="flex items-center gap-2 bg-background border border-subtle rounded p-1">
                              <button
                                type="button"
                                onClick={() => updateAdvancedFilterRule(rule.id, { operator: 'has_event_type' })}
                                className={`px-2 py-1 rounded text-xs ${rule.operator === 'has_event_type' ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-2'}`}
                              >
                                Har
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAdvancedFilterRule(rule.id, { operator: 'not_has_event_type' })}
                                className={`px-2 py-1 rounded text-xs ${rule.operator === 'not_has_event_type' ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-2'}`}
                              >
                                Har inte
                              </button>
                            </div>
                          ) : isBooleanField ? (
                            <div className="flex items-center gap-2 bg-background border border-subtle rounded p-1">
                              <button
                                type="button"
                                onClick={() => updateAdvancedFilterRule(rule.id, { operator: 'is_true' })}
                                className={`px-2 py-1 rounded text-xs ${rule.operator === 'is_true' ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-2'}`}
                              >
                                Ja
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAdvancedFilterRule(rule.id, { operator: 'is_false' })}
                                className={`px-2 py-1 rounded text-xs ${rule.operator === 'is_false' ? 'bg-accent text-on-accent' : 'text-secondary hover:bg-surface-2'}`}
                              >
                                Nej
                              </button>
                            </div>
                          ) : needsValue ? (
                            hasValueOptions ? (
                              <select
                                value={rule.value}
                                onChange={(e) => updateAdvancedFilterRule(rule.id, { value: e.target.value })}
                                className="bg-background border border-subtle rounded px-2 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                              >
                                <option value="">Välj värde...</option>
                                {valueOptions.map((valueOption) => (
                                  <option key={valueOption} value={valueOption}>{valueOption}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={dateFields.has(rule.field) ? 'date' : numberFields.has(rule.field) ? 'number' : 'text'}
                                value={rule.value}
                                onChange={(e) => updateAdvancedFilterRule(rule.id, { value: e.target.value })}
                                placeholder="Värde"
                                className="bg-background border border-subtle rounded px-2 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                              />
                            )
                          ) : (
                            <div className="flex items-center text-xs text-muted px-2 py-2 border border-subtle rounded bg-background">Boolean-villkor utan värde</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addAdvancedFilterRule}
                  className="px-3 py-2 rounded text-xs border border-subtle text-secondary hover:bg-surface-2 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Lägg till IF-regel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonList;