/**
 * Source Utility Functions for GEDCOM 5.5.1/7.0 Compatibility
 * Handles deduplication, GEDCOM field mapping, citation formatting, etc.
 */

/**
 * Normalize a string for comparison purposes
 */
export function normalizeForComparison(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9äöå\s]/gi, '');
}

/**
 * Find a master source by title and volume
 * Returns null if no match found
 */
export function findMasterSourceByTitle(db, title, volume) {
  if (!db || !db.sources || !title) return null;

  const normalizedTitle = normalizeForComparison(title);
  const normalizedVolume = normalizeForComparison(volume);

  return (db.sources || []).find(src => {
    const srcTitle = normalizeForComparison(src.title);
    const srcVolume = normalizeForComparison(src.volume);
    return srcTitle === normalizedTitle && srcVolume === normalizedVolume;
  });
}

/**
 * Check for duplicate master sources and return the existing one if found
 * If not found, returns null and caller should create new source
 */
export function findDuplicateMasterSource(db, incomingSource) {
  if (!incomingSource || !db) return null;

  // Priority: check by title + volume combination (master source level)
  const byTitleVolume = findMasterSourceByTitle(db, incomingSource.title, incomingSource.volume);
  if (byTitleVolume) return byTitleVolume;

  // Secondary: if this is from GEDCOM, check by xref if available
  if (incomingSource.gedcomXref || incomingSource.xref) {
    const xref = incomingSource.gedcomXref || incomingSource.xref;
    const byXref = (db.sources || []).find(src => 
      src.gedcomXref === xref || src.xref === xref
    );
    if (byXref) return byXref;
  }

  return null;
}

/**
 * Map source data to GEDCOM SOURCE record format
 */
export function sourceToGedcomMap(source) {
  if (!source) return {};

  return {
    // GEDCOM standard fields (5.5.1/7.0)
    TITL: source.sourceTitle || source.title || '',
    AUTH: source.author || '',
    PUBL: source.publisher || '',
    REPO: source.archive || '',
    
    // Data fields for transcriptions (GEDCOM 7.0 uses DATA.TEXT)
    DATA_TEXT: source.transcriptionText || '',
    
    // Application-specific but GEDCOM-compatible
    QUAY: source.trust || 0, // Quality/trust level
    PAGE: source.page || '',
  };
}

/**
 * Map GEDCOM SOURCE fields to application source format
 */
export function gedcomToSourceMap(gedcomSource) {
  if (!gedcomSource) return {};

  return {
    sourceTitle: gedcomSource.TITL || '',
    title: gedcomSource.TITL || '',
    author: gedcomSource.AUTH || '',
    publisher: gedcomSource.PUBL || '',
    archive: gedcomSource.REPO || '',
    transcriptionText: gedcomSource.DATA_TEXT || '',
    trust: Number(gedcomSource.QUAY) || 0,
    page: gedcomSource.PAGE || '',
  };
}

/**
 * Format a proper bibliographic citation based on source type and data
 */
export function formatBibliographicCitation(source) {
  if (!source) return '';

  const sourceType = source.sourceType || 'document';

  switch (sourceType) {
    case 'book':
      // Format: Author. "Title". Publisher, Year.
      const author = source.author ? `${source.author}. ` : '';
      const title = source.sourceTitle || source.title || 'Unknown';
      const publisher = source.publisher ? `. ${source.publisher}` : '';
      const date = source.date ? `, ${source.date}` : '';
      return `${author}"${title}"${publisher}${date}.`;

    case 'website':
      // Format: Author (if any). "Title". URL. Accessed [date if available].
      const webAuthor = source.author ? `${source.author}. ` : '';
      const webTitle = source.sourceTitle || source.title || 'Web Page';
      const url = source.url ? ` ${source.url}` : '';
      return `${webAuthor}"${webTitle}"${url}.`;

    case 'interview':
      // Format: Interviewer name. Interview with [interviewee]. [Date].
      const interviewer = source.interviewerName || 'Interviewer';
      const interviewee = source.intervieweeName || 'Unknown';
      const intDate = source.date ? ` ${source.date}` : '';
      return `${interviewer}. Interview with ${interviewee}.${intDate}.`;

    case 'newspaper':
      // Format: "[Article Title]". Newspaper Name. [Date], Page [page].
      const articleTitle = source.sourceTitle || source.title || 'Article';
      const newspaper = source.title || 'Unknown Newspaper';
      const pubDate = source.date ? ` ${source.date}` : '';
      const pageInfo = source.page ? `, page ${source.page}` : '';
      return `"${articleTitle}". ${newspaper}${pubDate}${pageInfo}.`;

    default: // 'document'
      // Generic format: Title [Volume] (Year) Page [page].
      const defTitle = source.sourceTitle || source.title || 'Source';
      const defVolume = source.volume ? ` ${source.volume}` : '';
      const defDate = source.date ? ` (${source.date})` : '';
      const defPage = source.page ? ` page ${source.page}` : '';
      return `${defTitle}${defVolume}${defDate}${defPage}.`;
  }
}

/**
 * Format quick citation for inline references (e.g., used in tree item labels)
 * Shorter version of bibliographic citation
 */
export function formatQuickCitation(source) {
  if (!source) return '';

  // For Arkiv Digital
  if (source.archive === 'Arkiv Digital' && source.aid) {
    return `${source.title || ''} ${source.volume || ''} (${source.date || ''}) [AD: ${source.aid}]`.trim();
  }

  // For Riksarkivet
  if (source.archive === 'Riksarkivet' && source.bildid) {
    return `${source.title || ''} (${source.date || ''}) [RA: ${source.bildid}]`.trim();
  }

  // Default
  return `${source.title || 'Källa'} (${source.date || 'datum okänt'})`;
}

/**
 * Get an archive/source origin color code (for UI badges)
 */
export function getArchiveColorCode(source) {
  if (!source) return 'neutral';
  
  if (source.archive === 'Arkiv Digital') return 'arkiv-digital';
  if (source.archive === 'Riksarkivet') return 'riksarkivet';
  if (source.sourceType === 'website') return 'website';
  if (source.sourceType === 'interview') return 'interview';
  
  return 'neutral';
}

/**
 * Get an archive/source origin label (for UI display)
 */
export function getArchiveLabel(source) {
  if (!source) return 'Okänd källa';
  
  if (source.archive === 'Arkiv Digital') return 'Arkiv Digital';
  if (source.archive === 'Riksarkivet') return 'Riksarkivet';
  
  const typeLabels = {
    book: 'Bok',
    website: 'Webbsida',
    interview: 'Intervju',
    document: 'Dokument',
    newspaper: 'Tidning',
  };
  
  return typeLabels[source.sourceType || 'document'];
}

/**
 * Validate that a source has minimal required fields for its type
 */
export function validateSourceByType(source) {
  if (!source) return { valid: false, errors: ['Source is null'] };

  const errors = [];
  const sourceType = source.sourceType || 'document';

  // Common validations
  if (!source.title && !source.sourceTitle) {
    errors.push('Titel saknas');
  }

  // Type-specific validations
  switch (sourceType) {
    case 'website':
      if (!source.url) {
        errors.push('URL behövs för webbkällor');
      }
      break;
    case 'interview':
      if (!source.intervieweeName) {
        errors.push('Intervjuad persons namn behövs');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a new source with GEDCOM-compatible default structure
 */
export function createNewSourceWithDefaults(overrides = {}) {
  return {
    id: `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: '',
    sourceTitle: '',
    volume: '',
    archive: 'Övrigt',
    archiveTop: 'Övrigt',
    date: '',
    page: '',
    imagePage: '',
    aid: '',
    bildid: '',
    nad: '',
    
    // GEDCOM fields
    sourceType: 'document',
    author: '',
    publisher: '',
    url: '',
    interviewerName: '',
    intervieweeName: '',
    transcriptionText: '',
    
    // Metadata
    trust: 0,
    tags: [],
    notes: [],
    images: [],
    created: new Date().toISOString(),
    dateAdded: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    
    ...overrides,
  };
}

/**
 * Merge two sources (for deduplication)
 * Returns the merged source with data from both
 */
export function mergeSources(master, incoming) {
  if (!master || !incoming) return master || incoming;

  return {
    ...master,
    // Prefer non-empty incoming values over master (for filling gaps)
    title: master.title || incoming.title,
    sourceTitle: master.sourceTitle || incoming.sourceTitle,
    author: master.author || incoming.author,
    publisher: master.publisher || incoming.publisher,
    volume: master.volume || incoming.volume,
    date: master.date || incoming.date,
    
    // For transcriptions, append if different
    transcriptionText: master.transcriptionText || incoming.transcriptionText,
    
    // Merge tags (unique)
    tags: Array.from(new Set([
      ...(master.tags || []),
      ...(incoming.tags || []),
    ])),
    
    // Merge notes
    notes: [
      ...(master.notes || []),
      ...(incoming.notes || []),
    ],
    
    // Merge images (by path to avoid duplicates)
    images: Array.from(new Map(
      [
        ...(master.images || []),
        ...(incoming.images || []),
      ].map(img => [img.path || img.url, img])
    ).values()),
    
    // Update modification timestamp
    dateModified: new Date().toISOString(),
  };
}

/**
 * Get orphaned source IDs (sources not referenced by any person/event)
 */
export function getOrphanedSourceIds(sources, people) {
  if (!sources || !people) return [];

  const usedSourceIds = new Set();

  // Collect all source IDs referenced in person events
  people.forEach(person => {
    if (person.events && Array.isArray(person.events)) {
      person.events.forEach(event => {
        if (event.sources && Array.isArray(event.sources)) {
          event.sources.forEach(sourceId => usedSourceIds.add(sourceId));
        }
      });
    }
  });

  return sources.filter(src => !usedSourceIds.has(src.id)).map(src => src.id);
}
