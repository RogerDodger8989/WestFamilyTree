import React, { useState, useMemo, useLayoutEffect, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import Editor from './MaybeEditor.jsx';
import Button from './Button.jsx';
import MediaImage from './components/MediaImage.jsx';
import MediaSelector from './MediaSelector.jsx';
import { getAvatarImageStyle } from './imageUtils.js';
import { User, Tag, X } from 'lucide-react'; 
import ContextMenu from './ContextMenu.jsx';
import { buildSourceString } from './parsing.js';

// --- SOURCE TYPE DEFINITIONS (GEDCOM compatible) ---
const SOURCE_TYPES = {
  book: { label: 'Bok', fields: ['author', 'title', 'publisher', 'date'], icon: '📖' },
  website: { label: 'Webbsida', fields: ['author', 'title', 'url', 'date'], icon: '🌐' },
  interview: { label: 'Intervju', fields: ['interviewerName', 'intervieweeName', 'date'], icon: '🎤' },
  document: { label: 'Dokument', fields: ['author', 'title', 'date'], icon: '📄' },
  newspaper: { label: 'Tidning', fields: ['title', 'date', 'page'], icon: '📰' },
};

// --- CONTEXT MENU HELPER ---
function SourceContextMenu({ source, onCopy, onDelete, onCreateSibling, isFolder, children }) {
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
  };

  const handleClose = () => setContextMenu(null);

  const menuItems = [];
  
  if (isFolder) {
    menuItems.push({
      label: '➕ Skapa ny källa på samma nivå',
      onClick: () => {
        onCreateSibling && onCreateSibling(source);
        handleClose();
      }
    });
  } else {
    menuItems.push({ 
      label: '📋 Kopiera källhänvisning', 
      onClick: () => { 
        onCopy && onCopy(source); 
        handleClose();
      } 
    });
    menuItems.push({ 
      label: '➕ Skapa ny källa på samma nivå', 
      onClick: () => { 
        onCreateSibling && onCreateSibling(source); 
        handleClose();
      } 
    });
    menuItems.push({ 
      label: '🗑️ Ta bort källa', 
      onClick: () => { 
        onDelete && onDelete(source.id); 
        handleClose();
      } 
    });
  }

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>
      {contextMenu && contextMenu.visible && (
        <ContextMenu
          visible={true}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleClose}
          items={menuItems}
        />
      )}
    </>
  );
}

// --- CITATION FORMATTER ---
function formatCitation(source) {
  if (!source) return '';
  const isArchiveSource = Boolean(
    source.aid || source.nad || source.raId || source.bildId || source.bildid ||
    source.archiveTop === 'Arkiv Digital' || source.archiveTop === 'Riksarkivet' ||
    source.archive === 'Arkiv Digital' || source.archive === 'Riksarkivet'
  );

  if (!isArchiveSource) {
    const manualCitation = buildSourceString(source);
    if (manualCitation) return manualCitation;
  }

  if (source.archive === 'Arkiv Digital' && source.aid) {
    return `${source.title || ''} ${source.volume || ''} (${source.date || ''}) Bild ${source.imagePage || '?'} (AID: ${source.aid}, NAD: ${source.nad || ''})`.trim();
  }
  if (source.archive === 'Riksarkivet' && source.bildid) {
    return `${source.archive}, ${source.title || ''}, ${source.volume || ''} (${source.date || ''}), bildid: ${source.bildid}`.trim();
  }
  return `${source.title || 'Okänd källa'} ${source.volume ? `[${source.volume}]` : ''} (${source.date || ''})`.trim();
}

// --- AUTO-DEDUPLICATION HELPER ---
function findMasterSource(db, incoming) {
  if (!db || !db.sources || !incoming) return null;
  const normalizeStr = (s) => (s || '').toString().trim().toLowerCase();
  const incomingTitle = normalizeStr(incoming.title);
  const incomingVolume = normalizeStr(incoming.volume);
  
  return (db.sources || []).find(src => 
    normalizeStr(src.title) === incomingTitle && 
    normalizeStr(src.volume) === incomingVolume
  );
}

// --- ORPHANED SOURCES CHECKER ---
function getOrphanedSourceIds(sources, people) {
  if (!sources || !people) return [];
  const usedSourceIds = new Set();
  
  people.forEach(person => {
    if (person.events) {
      person.events.forEach(event => {
        if (event.sources) {
          event.sources.forEach(sourceId => usedSourceIds.add(sourceId));
        }
      });
    }
  });
  
  return sources.filter(src => !usedSourceIds.has(src.id)).map(src => src.id);
}

function sanitizeWindowsSegment(value) {
  return String(value || '')
    .replace(/[\\/*?"<>|:]/g, '-')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/g, '')
    .replace(/-+/g, '-');
}

function formatVolumeForPath(volume) {
  const compact = String(volume || 'okand-volym')
    .replace(/\s+/g, '')
    .replace(/[\/]+/g, '-');
  return sanitizeWindowsSegment(compact) || 'okand-volym';
}

function buildRiksarkivetImageRelativePath({ archiveName, volume, year, bildid }) {
  const archiveSegment = sanitizeWindowsSegment(archiveName || 'Riksarkivet') || 'Riksarkivet';
  const volumeSegment = formatVolumeForPath(volume);
  const yearSegment = sanitizeWindowsSegment(year || '').trim();
  const folderName = yearSegment ? `${volumeSegment} (${yearSegment})` : volumeSegment;
  const bildIdSegment = sanitizeWindowsSegment(bildid || 'okand') || 'okand';
  return `sources/${archiveSegment}/${folderName}/bildid-${bildIdSegment}.jpg`;
}

function buildRiksarkivetIiifCandidates(bildid) {
  const cleanBildId = String(bildid || '').trim().toUpperCase();
  if (!cleanBildId) return [];

  const candidates = [];
  const encodedBildId = encodeURIComponent(cleanBildId);
  const baseMatch = cleanBildId.match(/^([A-Z0-9]+?)(?:_(\d+))?$/);
  const baseId = baseMatch?.[1] || '';
  const frameId = baseMatch?.[2] || '';
  const paddedFrame = frameId ? frameId.padStart(5, '0') : '';

  candidates.push(`https://lbiiif.riksarkivet.se/arkis!${encodedBildId}/full/max/0/default.jpg`);
  if (baseId && frameId) {
    candidates.push(`https://lbiiif.riksarkivet.se/arkis!${encodeURIComponent(`${baseId}_${paddedFrame}`)}/full/max/0/default.jpg`);
    candidates.push(`https://lbiiif.riksarkivet.se/arkis!${encodeURIComponent(`${baseId}_${frameId}`)}/full/max/0/default.jpg`);
  }
  if (baseId) {
    candidates.push(`https://lbiiif.riksarkivet.se/arkis!${encodeURIComponent(baseId)}/full/max/0/default.jpg`);
  }

  candidates.push(`https://sok.riksarkivet.se/bildvisning/${encodedBildId}/iiif/full/max/0/default.jpg`);
  candidates.push(`https://sok.riksarkivet.se/bildvisning/${encodedBildId}/iiif/full/full/0/default.jpg`);
  candidates.push(`https://sok.riksarkivet.se/bildvisning/${encodedBildId}/iiif/full/2000,/0/default.jpg`);

  return Array.from(new Set(candidates));
}

// --- HJÄLPFUNKTIONER (Oförändrad) ---

function buildSimpleTree(sources) {
  const tree = {};

  const getSourceTypeLabel = (src) => {
    const key = String(src?.sourceType || '').trim().toLowerCase();
    if (key && SOURCE_TYPES[key]) return SOURCE_TYPES[key].label;
    if (src?.sourceType) return String(src.sourceType);
    return SOURCE_TYPES.document.label;
  };

  for (const src of sources) {
    if (!src || !src.id) continue;

    // NIVÅ 1: ARKIV
    let topLevel = src.archiveTop;
    if (!topLevel) {
        if (src.archive === 'Arkiv Digital') topLevel = 'Arkiv Digital';
        else if (src.archive === 'Riksarkivet') topLevel = 'Riksarkivet';
        else topLevel = 'Övrigt';
    }

    if (!tree[topLevel]) tree[topLevel] = {};

    // SPECIALHANTERING FÖR AD / RA (4 Nivåer)
    if (topLevel === 'Arkiv Digital' || topLevel === 'Riksarkivet') {
        // NIVÅ 2: TITEL / ORT
        let titleLevel = src.title || "Okänd Titel";
        if (!tree[topLevel][titleLevel]) tree[topLevel][titleLevel] = {};

        // NIVÅ 3: VOLYM [ÅR]
        const vol = src.volume || 'Okänd volym';
        const date = src.date ? ` [${src.date}]` : ''; 
        let volLevel = vol + date;
        
        if (!tree[topLevel][titleLevel][volLevel]) tree[topLevel][titleLevel][volLevel] = [];

        // NIVÅ 4: BILD / SIDA (Lövet)
        let pageLabel = "";
        const parts = [];
        if (src.imagePage) {
            const isJustNumbers = /^\d+$/.test(src.imagePage);
            parts.push(isJustNumbers ? `Bild ${src.imagePage}` : src.imagePage);
        }
        if (src.page) {
            const isJustNumbers = /^\d+$/.test(src.page);
            parts.push(isJustNumbers ? `Sid ${src.page}` : src.page);
        }
        if (parts.length > 0) {
            pageLabel = parts.join(' / ');
        } else {
            pageLabel = src.aid || src.bildid || "Utan referens";
        }

        tree[topLevel][titleLevel][volLevel].push({ ...src, label: pageLabel });

    } else {
        // HANTERING FÖR ÖVRIGT (4 Nivåer)
        // Övrigt -> Källtyp -> Författare -> Titel (Datum) -> källa
        const sourceTypeLevel = getSourceTypeLabel(src);
        if (!tree[topLevel][sourceTypeLevel]) tree[topLevel][sourceTypeLevel] = {};

        const authorLevel = String(src.author || '').trim() || 'Okänd författare';
        if (!tree[topLevel][sourceTypeLevel][authorLevel]) tree[topLevel][sourceTypeLevel][authorLevel] = {};

        const titleBase = String(src.sourceTitle || src.title || 'Namnlös källa').trim();
        const dateSuffix = src.date ? ` (${src.date})` : '';
        const titleLevel = `${titleBase}${dateSuffix}`;
        if (!tree[topLevel][sourceTypeLevel][authorLevel][titleLevel]) {
          tree[topLevel][sourceTypeLevel][authorLevel][titleLevel] = [];
        }

        let pageLabel = src.page || src.aid || src.imagePage || src.bildid;
        if (!pageLabel) {
            if (src.images && src.images.length > 0) pageLabel = "Bild";
            else pageLabel = "Källa (Allmän)";
        }

        tree[topLevel][sourceTypeLevel][authorLevel][titleLevel].push({ ...src, label: pageLabel });
    }
  }
  return tree;
}

function TrustDropdown({ value, onChange }) {
  return (
    <select className="border border-subtle rounded px-2 py-1 text-sm bg-background text-primary focus:border-accent focus:outline-none" value={value || 0} onChange={e => onChange(Number(e.target.value))}>
      <option value={0}>☆ Ingen info</option>
      <option value={1}>★ Opålitlig</option>
      <option value={2}>★★ Tvivelaktig</option>
      <option value={3}>★★★ Andrahand</option>
      <option value={4}>★★★★ Förstahand</option>
    </select>
  );
}

// --- HUVUDKOMPONENT ---

export default function SourceCatalog({ 
    sources, 
    people, 
    places = [], 
    onDeleteSource, 
    onEditSource, 
    catalogState, 
    setCatalogState, 
    onCreateNewPerson, 
    onOpenEditModal, 
    isDrawerMode, 
    onLinkSource, 
    onNavigateToPlace,
    onAddSource,
    onOpenLinkPersonModal, 
    onUnlinkSourceFromEvent, 
    alreadyLinkedIds = [] 
}) {
  const { getAllTags, showStatus = () => {}, dbData, setDbData } = useApp();
  const { selectedSourceId, expanded, searchTerm, sortOrder = 'name_asc' } = catalogState; 
  const [importString, setImportString] = useState(''); 
  const listContainerRef = useRef(null);

  // State för högerpanelens flikar ('info', 'images', 'notes')
  const [activeRightTab, setActiveRightTab] = useState('info');

  // Tag State (samma som MediaManager)
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const tagInputRef = useRef(null);

  // New state for GEDCOM features
  const [showOrphanedOnly, setShowOrphanedOnly] = useState(false);

  const buildExpandedStateForAllTreeNodes = (treeNode, prefix = '') => {
    const out = {};
    if (Array.isArray(treeNode)) return out;
    Object.keys(treeNode || {}).forEach((key) => {
      const path = `${prefix}${key}`;
      out[path] = true;
      Object.assign(out, buildExpandedStateForAllTreeNodes(treeNode[key], path));
    });
    return out;
  };

  // --- PARSER-LOGIK ---
  const parseSourceString = async () => {
      if (!importString || !importString.trim()) {
        showStatus('Klistra in en källtext först.', 'warning');
        return;
      }
      const text = importString.trim();
      let updates = { trust: 4 };

      const upperText = text.toUpperCase();

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
          if (places && places.length > 0) {
              for (const place of places) {
                  if (place && place.name && text.startsWith(place.name)) {
                      if (!bestMatch || place.name.length > bestMatch.name.length) {
                          bestMatch = place;
                      }
                  }
              }
          }
          if (bestMatch) updates.title = bestMatch.name;
          else {
              const splitPoint = text.indexOf(updates.volume || '(');
              if (splitPoint > 0) updates.title = text.substring(0, splitPoint).trim();
              else updates.title = "Okänd Titel";
          }

      } else if (upperText.includes('BILDID:')) {
          updates.archiveTop = 'Riksarkivet';
          updates.archive = 'Riksarkivet';
          const bildIdMatch = text.match(/bildid:\s*([A-Z0-9_]+)/i);
          if (bildIdMatch) updates.bildid = bildIdMatch[1];
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
      
      updates.note = "";

      // Guard: only continue if text could be parsed into meaningful AD/RA source fields.
      const hasParseSignals = Boolean(
        updates.aid ||
        updates.bildid ||
        (updates.nad && updates.volume) ||
        (updates.volume && (updates.imagePage || updates.page))
      );

      if (!hasParseSignals) {
        showStatus('Ogiltig text för snabb-import. Klistra in en AD/RA-källa.', 'warning');
        return;
      }

      const parsedSource = {
        title: updates.title || 'Ny källa',
        sourceTitle: updates.title || 'Ny källa',
        archive: updates.archive || '',
        archiveTop: updates.archiveTop || 'Övrigt',
        volume: updates.volume || '',
        page: updates.page || '',
        aid: updates.aid || '',
        nad: updates.nad || '',
        bildid: updates.bildid || '',
        imagePage: updates.imagePage || '',
        date: updates.date || '',
        note: '',
        tags: '',
        trust: 4,
        sourceType: 'document'
      };

      // Duplicate handling (strong identity): focus existing source in expanded tree.
      const norm = (v) => String(v || '').trim().toLowerCase();
      const parsedAid = norm(parsedSource.aid);
      const parsedBild = norm(parsedSource.bildid || parsedSource.bildId || parsedSource.raId);
      const parsedNad = norm(parsedSource.nad);
      const parsedVol = norm(parsedSource.volume);
      const parsedDate = norm(parsedSource.date);

      const existing = (sources || []).find((src) => {
        if (!src) return false;
        const srcAid = norm(src.aid);
        const srcBild = norm(src.bildid || src.bildId || src.raId);
        const srcNad = norm(src.nad);
        const srcVol = norm(src.volume);
        const srcDate = norm(src.date);

        if (parsedAid && srcAid && parsedAid === srcAid) return true;
        if (parsedBild && srcBild && parsedBild === srcBild) return true;
        if (parsedNad && srcNad && parsedVol && srcVol && parsedNad === srcNad && parsedVol === srcVol) {
          if (!parsedDate || !srcDate || parsedDate === srcDate) return true;
        }
        return false;
      });

      if (existing) {
        const fullTree = buildSimpleTree(sources || []);
        const expandedAll = buildExpandedStateForAllTreeNodes(fullTree);
        setShowOrphanedOnly(false);
        setCatalogState(prev => ({
          ...prev,
          selectedSourceId: existing.id,
          searchTerm: '',
          expanded: { ...expandedAll }
        }));
        setImportString('');
        showStatus('Dublett hittad. Fokuserar och markerar befintlig källa.', 'success');
        return;
      }

      const newSourceId = `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      let downloadedMedia = null;

      const isRiksarkivetImport = parsedSource.archiveTop === 'Riksarkivet' && Boolean(parsedSource.bildid);
      if (isRiksarkivetImport) {
        await new Promise((resolve) => setTimeout(resolve, 160));
        showStatus('Laddar ner originaldokument från Riksarkivet...', 'info');

        try {
          const bildid = String(parsedSource.bildid || '').trim();
          const relativePath = buildRiksarkivetImageRelativePath({
            archiveName: parsedSource.title || parsedSource.sourceTitle || parsedSource.archiveTop,
            volume: parsedSource.volume,
            year: parsedSource.date,
            bildid
          });

          let saveResult = null;
          const iiifCandidates = buildRiksarkivetIiifCandidates(bildid);

          if (window.electronAPI && typeof window.electronAPI.downloadRiksarkivetImageToMedia === 'function') {
            const ipcResult = await window.electronAPI.downloadRiksarkivetImageToMedia(bildid, relativePath);
            if (ipcResult?.success) {
              saveResult = ipcResult;
            } else if (ipcResult?.error) {
              console.warn('[SourceCatalog] Main process RA download failed, trying renderer fallback:', ipcResult.error);
            }
          }

          if (!saveResult) {
            let response = null;
            let lastError = null;
            for (const candidateUrl of iiifCandidates) {
              try {
                const attempt = await fetch(candidateUrl, {
                  headers: {
                    Accept: 'image/jpeg,image/*;q=0.9,*/*;q=0.8'
                  }
                });
                if (attempt.ok) {
                  response = attempt;
                  break;
                }
                lastError = new Error(`HTTP ${attempt.status} (${candidateUrl})`);
              } catch (err) {
                lastError = err;
              }
            }

            if (!response || !response.ok) {
              throw lastError || new Error('Kunde inte hämta bild från Riksarkivet IIIF');
            }

            const imageBuffer = await response.arrayBuffer();
            if (window.electronAPI && typeof window.electronAPI.saveFileBufferToMedia === 'function') {
              const fallbackSave = await window.electronAPI.saveFileBufferToMedia(new Uint8Array(imageBuffer), relativePath);
              if (!fallbackSave || !fallbackSave.success) {
                throw new Error(fallbackSave?.error || 'Kunde inte spara filen lokalt');
              }
              saveResult = fallbackSave;
            }
          }

          if (!saveResult?.success) {
            throw new Error(saveResult?.error || 'Kunde inte spara Riksarkivet-bilden');
          }

          const savedPath = String(saveResult.filePath || saveResult.path || relativePath).replace(/\\/g, '/');
          const mediaId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          downloadedMedia = {
            id: mediaId,
            url: `media://${encodeURIComponent(savedPath)}`,
            filePath: savedPath,
            name: `bildid-${bildid}.jpg`,
            date: new Date().toISOString().split('T')[0],
            description: '',
            note: '',
            tags: [],
            libraryId: 'sources',
            connections: {
              people: [],
              places: [],
              sources: [newSourceId]
            }
          };
        } catch (error) {
          console.error('[SourceCatalog] RA original download failed:', error);
          showStatus('Källan sparas, men originalbilden från Riksarkivet kunde inte hämtas.', 'warning');
        }
      }

      const createSourcePayload = {
        id: newSourceId,
        title: parsedSource.title || 'Ny källa',
        sourceTitle: parsedSource.sourceTitle || parsedSource.title || 'Ny källa',
        archiveTop: parsedSource.archiveTop || 'Övrigt',
        archive: parsedSource.archive || '',
        sourceType: parsedSource.sourceType || 'document',
        author: parsedSource.author || '',
        volume: parsedSource.volume || '',
        page: parsedSource.page || '',
        note: parsedSource.note || '',
        aid: parsedSource.aid || '',
        nad: parsedSource.nad || '',
        bildid: parsedSource.bildid || '',
        imagePage: parsedSource.imagePage || '',
        date: parsedSource.date || '',
        tags: parsedSource.tags || '',
        trust: Number.isFinite(Number(parsedSource.trust)) ? Number(parsedSource.trust) : 4,
        dateAdded: new Date().toISOString(),
        images: []
      };

      if (typeof setDbData === 'function') {
        setDbData((prev) => {
          const prevSources = Array.isArray(prev?.sources) ? prev.sources : [];
          const prevMedia = Array.isArray(prev?.media) ? prev.media : [];

          let imageRefId = null;
          let nextMedia = prevMedia;

          if (downloadedMedia) {
            const existingMedia = prevMedia.find((item) =>
              String(item?.filePath || '').replace(/\\/g, '/') === downloadedMedia.filePath
            );

            if (existingMedia) {
              imageRefId = existingMedia.id;
              nextMedia = prevMedia.map((item) => {
                if (String(item?.id) !== String(existingMedia.id)) return item;
                const currentConn = item?.connections && typeof item.connections === 'object' ? item.connections : {};
                const currentSources = Array.isArray(currentConn.sources) ? currentConn.sources : [];
                if (currentSources.includes(newSourceId)) return item;
                return {
                  ...item,
                  connections: {
                    ...currentConn,
                    people: Array.isArray(currentConn.people) ? currentConn.people : [],
                    places: Array.isArray(currentConn.places) ? currentConn.places : [],
                    sources: [...currentSources, newSourceId]
                  }
                };
              });
            } else {
              imageRefId = downloadedMedia.id;
              nextMedia = [...prevMedia, downloadedMedia];
            }
          }

          const nextSource = imageRefId
            ? { ...createSourcePayload, images: [imageRefId] }
            : createSourcePayload;

          return {
            ...prev,
            sources: [...prevSources, nextSource],
            media: nextMedia
          };
        });

        setShowOrphanedOnly(false);
        setCatalogState((prev) => ({
          ...prev,
          selectedSourceId: newSourceId,
          searchTerm: '',
          expanded: { ...prev.expanded, [createSourcePayload.archiveTop || 'Övrigt']: true }
        }));

        if (downloadedMedia) {
          requestMediaManagerRefresh('quick-import-riksarkivet-original');
        }

        setImportString('');
        showStatus('Ny källa skapad från snabb-import.', 'success');
        return;
      }

      // No duplicate: create a new source from parsed text.
      if (onAddSource) {
        onAddSource({ ...parsedSource, id: newSourceId, images: downloadedMedia ? [downloadedMedia.id] : [] });
        setImportString('');
        showStatus('Ny källa skapad från snabb-import.', 'success');
        return;
      }

      // Fallback if creation callback is unavailable.
      if (selectedSource) {
        onEditSource({ ...selectedSource, ...parsedSource });
        setImportString('');
      }
  };

  // --- SORTERING & FILTRERING (Oförändrad) ---
  const sortedSources = useMemo(() => {
    const copy = [...sources];
    switch (sortOrder) {
        case 'name_asc': return copy.sort((a, b) => (a.title || a.archive || '').localeCompare(b.title || b.archive || '', 'sv'));
        case 'name_desc': return copy.sort((a, b) => (b.title || b.archive || '').localeCompare(a.title || a.archive || '', 'sv'));
        case 'date_desc': return copy.sort((a, b) => new Date(b.dateModified || b.dateAdded || 0) - new Date(a.dateModified || a.dateAdded || 0));
        case 'date_asc': return copy.sort((a, b) => new Date(a.dateModified || a.dateAdded || 0) - new Date(b.dateModified || b.dateAdded || 0));
        default: return copy;
    }
  }, [sources, sortOrder]);

  const normalizeSearchText = (value) => {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  };

  // OCR/typing tolerance for Swedish source volumes where I/l/1 are often mixed up (AI:6 vs Al:6).
  const normalizeVolumeAmbiguity = (value) => normalizeSearchText(value).replace(/[l1]/g, 'i');

  const getSourceSearchBlob = (source) => {
    if (!source || typeof source !== 'object') return '';

    const notesText = Array.isArray(source.notes)
      ? source.notes.map((n) => (typeof n === 'string' ? n : n?.text || '')).join(' ')
      : '';

    const tagsText = Array.isArray(source.tags)
      ? source.tags.join(' ')
      : String(source.tags || '');

    const fields = [
      source.id,
      source.title,
      source.sourceTitle,
      source.archiveTop,
      source.archive,
      source.volume,
      source.date,
      source.page,
      source.imagePage,
      source.aid,
      source.nad,
      source.bildid,
      source.bildId,
      source.raId,
      source.sourceString,
      source.note,
      notesText,
      tagsText,
      source.author,
      source.publisher,
      source.url,
      source.interviewerName,
      source.intervieweeName,
      source.sourceType,
      source.transcription,
      source.text,
    ];

    return normalizeSearchText(fields.filter(Boolean).join(' '));
  };

  const filteredSources = useMemo(() => {
    let result = sortedSources;
    if (!searchTerm) {
      result = sortedSources;
    } else {
      const query = normalizeSearchText(searchTerm);
      const queryTokens = query.split(' ').filter(Boolean);
      const fuzzyTokens = queryTokens.map(normalizeVolumeAmbiguity);

      result = sortedSources.filter((s) => {
        const blob = getSourceSearchBlob(s);
        if (!blob) return false;
        const blobFuzzy = normalizeVolumeAmbiguity(blob);

        // All tokens must match, either exact-normalized or fuzzy-normalized.
        return queryTokens.every((token, idx) => {
          const fuzzyToken = fuzzyTokens[idx];
          return blob.includes(token) || blobFuzzy.includes(fuzzyToken);
        });
      });
    }
    
    // Apply orphaned sources filter
    if (showOrphanedOnly) {
      const orphanedIds = getOrphanedSourceIds(sources, people);
      result = result.filter(s => orphanedIds.includes(s.id));
    }
    
    return result;
  }, [sortedSources, searchTerm, showOrphanedOnly, sources, people]);

  const tree = useMemo(() => buildSimpleTree(filteredSources), [filteredSources]);

  // --- EFFEKTER (Oförändrad) ---
  useLayoutEffect(() => {
    if (searchTerm) {
        const newExpanded = { ...expanded };
        let hasChanges = false;
        const expandRecursive = (node, prefix) => {
            if (Array.isArray(node)) return;
            Object.keys(node).forEach(key => {
                const path = prefix + key;
                if (!newExpanded[path]) { newExpanded[path] = true; hasChanges = true; }
                expandRecursive(node[key], path);
            });
        };
        expandRecursive(tree, "");
        if (hasChanges) setCatalogState(prev => ({ ...prev, expanded: newExpanded }));
    }
  }, [searchTerm, tree]); 

  useLayoutEffect(() => {
    if (!selectedSourceId) return;
    let foundPathKeys = [];
    const findPath = (node, currentKeys) => {
        if (Array.isArray(node)) {
            if (node.some(item => item.id === selectedSourceId)) return true;
            return false;
        }
        for (const key in node) {
            if (findPath(node[key], [...currentKeys, key])) {
                foundPathKeys = [...currentKeys, key];
                return true;
            }
        }
        return false;
    };
    findPath(tree, []);
    if (foundPathKeys.length > 0) {
        let currentPath = "";
        let newExpanded = { ...expanded };
        let hasChanges = false;
        for (const key of foundPathKeys) {
            currentPath += key;
            if (!newExpanded[currentPath]) {
                newExpanded[currentPath] = true;
                hasChanges = true;
            }
        }
        if (hasChanges) {
            setCatalogState(prev => ({ ...prev, expanded: newExpanded }));
            return;
        }
    }
    const element = document.getElementById(`source-item-${selectedSourceId}`);
    const container = listContainerRef.current;
    if (element && container) {
        const itemTop = element.offsetTop;
        const containerHeight = container.clientHeight;
        const itemHeight = element.clientHeight;
        container.scrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2);
        element.style.backgroundColor = "#fef08a"; 
        setTimeout(() => { if(element) { element.style.transition = "background-color 1s"; element.style.backgroundColor = ""; }}, 1000);
    }
  }, [selectedSourceId, tree, expanded]); 

  const handleSelect = (id) => setCatalogState(prev => ({ ...prev, selectedSourceId: id }));
  const handleToggle = (key) => setCatalogState(prev => ({ ...prev, expanded: { ...prev.expanded, [key]: !prev.expanded[key] } }));
  const handleSearch = (e) => setCatalogState(prev => ({ ...prev, searchTerm: e.target.value }));
  const handleSortChange = (e) => setCatalogState(prev => ({ ...prev, sortOrder: e.target.value }));
  const selectedSource = sources.find(s => s.id === selectedSourceId);
  const currentMediaFolderPath = String(dbData?.meta?.mediaFolderPath || '').trim();

  const requestMediaManagerRefresh = (reason = 'source-catalog') => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('WFT:mediaRefreshRequested', { detail: { reason } }));
  };
  const sourceMediaItems = useMemo(() => {
    if (!selectedSource) return [];
    const refs = Array.isArray(selectedSource.images) ? selectedSource.images : [];
    const mediaList = Array.isArray(dbData?.media) ? dbData.media : [];
    const byId = new Map(mediaList.map((m) => [String(m?.id || ''), m]));
    const byPath = new Map(mediaList.map((m) => [String(m?.filePath || '').replace(/\\/g, '/'), m]));

    const resolved = refs
      .map((entry) => {
        const mediaId = String(typeof entry === 'string' ? entry : (entry?.mediaId || entry?.id || '')).trim();
        const fallbackPath = String(typeof entry === 'object' ? (entry?.filePath || entry?.src || '') : '').replace(/\\/g, '/');
        return (mediaId && byId.get(mediaId)) || (fallbackPath && byPath.get(fallbackPath)) || null;
      })
      .filter(Boolean);

    const seen = new Set();
    return resolved.filter((item) => {
      const key = String(item?.id || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [selectedSource, dbData?.media]);

  const handleSourceMediaChange = (newMediaList) => {
    if (!selectedSource?.id || !Array.isArray(newMediaList) || typeof setDbData !== 'function') return;

    const selectedIds = new Set(newMediaList.map((item) => String(item?.id || '').trim()).filter(Boolean));

    setDbData((prev) => {
      if (!prev) return prev;

      const prevMedia = Array.isArray(prev.media) ? prev.media : [];
      const mediaMap = new Map(prevMedia.map((item) => [String(item?.id || ''), { ...item }]));

      const toSourceIds = (sourcesValue) => {
        if (!Array.isArray(sourcesValue)) return [];
        return sourcesValue.map((entry) => String(typeof entry === 'string' ? entry : entry?.id || '')).filter(Boolean);
      };

      newMediaList.forEach((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return;
        const existing = mediaMap.get(id) || {};
        const existingConn = existing.connections && typeof existing.connections === 'object' ? existing.connections : {};
        const nextSourceIds = Array.from(new Set([...toSourceIds(existingConn.sources), selectedSource.id]));
        mediaMap.set(id, {
          ...existing,
          ...item,
          libraryId: 'sources',
          connections: {
            ...existingConn,
            ...(item?.connections && typeof item.connections === 'object' ? item.connections : {}),
            people: Array.isArray(existingConn.people) ? existingConn.people : [],
            places: Array.isArray(existingConn.places) ? existingConn.places : [],
            sources: nextSourceIds,
          },
        });
      });

      mediaMap.forEach((item, id) => {
        const conn = item?.connections && typeof item.connections === 'object' ? item.connections : {};
        const sourceIds = toSourceIds(conn.sources);
        if (!sourceIds.includes(selectedSource.id)) return;
        if (selectedIds.has(id)) return;
        mediaMap.set(id, {
          ...item,
          connections: {
            ...conn,
            sources: sourceIds.filter((sourceId) => sourceId !== selectedSource.id),
          },
        });
      });

      const nextMedia = Array.from(mediaMap.values());
      const nextSources = (Array.isArray(prev.sources) ? prev.sources : []).map((src) => {
        if (!src || src.id !== selectedSource.id) return src;
        return { ...src, images: Array.from(selectedIds) };
      });

      return { ...prev, media: nextMedia, sources: nextSources };
    });

    requestMediaManagerRefresh('source-media-change');
  };

  const isArchiveManagedSource = Boolean(
    selectedSource && (
      selectedSource.archiveTop === 'Arkiv Digital' ||
      selectedSource.archiveTop === 'Riksarkivet' ||
      selectedSource.archive === 'Arkiv Digital' ||
      selectedSource.archive === 'Riksarkivet' ||
      selectedSource.aid ||
      selectedSource.bildid ||
      selectedSource.nad
    )
  );

    const findSourcePathKeys = (treeNode, sourceId, path = []) => {
      if (Array.isArray(treeNode)) {
        return treeNode.some((item) => item && item.id === sourceId) ? path : null;
      }
      for (const key of Object.keys(treeNode || {})) {
        const res = findSourcePathKeys(treeNode[key], sourceId, [...path, key]);
        if (res) return res;
      }
      return null;
    };

    const handleSave = (updatedFields) => {
      if (!selectedSource) return;
      const updatedSource = { ...selectedSource, ...updatedFields };
      onEditSource(updatedSource);

      // Keep tree focus and expansion in sync while renaming/re-grouping source.
      const affectsTreePath = [
        'title', 'sourceTitle', 'author', 'date', 'sourceType',
        'archiveTop', 'archive', 'volume', 'imagePage', 'page'
      ].some((k) => Object.prototype.hasOwnProperty.call(updatedFields, k));

      if (!affectsTreePath) return;

      const nextSources = (sources || []).map((s) => (s && s.id === updatedSource.id ? updatedSource : s));
      const nextTree = buildSimpleTree(nextSources);
      const keys = findSourcePathKeys(nextTree, updatedSource.id, []) || [];

      let path = '';
      const expandPatch = {};
      for (const key of keys) {
        path += key;
        expandPatch[path] = true;
      }

      setShowOrphanedOnly(false);
      setCatalogState((prev) => ({
        ...prev,
        selectedSourceId: updatedSource.id,
        searchTerm: '',
        expanded: { ...prev.expanded, ...expandPatch }
      }));
    };

  // Tag-funktioner (samma som MediaManager)
  // Använd centraliserad tag-lista från AppContext (alla taggar i appen)
  // getAllTags kommer från useApp() och inkluderar taggar från personer, källor och media

  // Få förslag baserat på input (använder centraliserad tag-lista)
  const getTagSuggestions = (input) => {
    if (!input || input.trim().length === 0) return [];
    const allTags = getAllTags ? getAllTags() : [];
    const lowerInput = input.toLowerCase();
    
    // Hämta nuvarande taggar från selectedSource
    let currentTags = selectedSource?.tags || [];
    if (typeof currentTags === 'string' && currentTags.trim()) {
      currentTags = currentTags.split(',').map(t => t.trim()).filter(t => t);
    }
    if (!Array.isArray(currentTags)) {
      currentTags = [];
    }
    
    return allTags.filter(tag => 
      tag.toLowerCase().includes(lowerInput) && 
      !currentTags.includes(tag)
    ).slice(0, 5);
  };

  // Lägg till tagg
  const handleAddTag = (tagText) => {
    if (!tagText || tagText.trim().length === 0) return;
    if (!selectedSource) return;
    
    const tag = tagText.trim();
    
    // Hämta nuvarande taggar
    let currentTags = selectedSource.tags || [];
    if (typeof currentTags === 'string' && currentTags.trim()) {
      currentTags = currentTags.split(',').map(t => t.trim()).filter(t => t);
    }
    if (!Array.isArray(currentTags)) {
      currentTags = [];
    }
    
    // Kontrollera om taggen redan finns
    if (currentTags.includes(tag)) {
      setTagInput('');
      setTagSuggestions([]);
      return;
    }
    
    // Lägg till taggen
    const newTags = [...currentTags, tag];
    handleSave({ tags: newTags });
    
    setTagInput('');
    setTagSuggestions([]);
    
    // Fokusera tagg-input igen efter att taggen lagts till
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }, 50);
  };

  // Rensa tagg-input när källan ändras
  useEffect(() => {
    setTagInput('');
    setTagSuggestions([]);
  }, [selectedSourceId]);

  // --- HITTA KOPPLADE PERSONER (Memoized) ---
    // Grupp: personId -> { person, events: [], isLinkedToImageRegion, family }
    const linkedData = useMemo(() => {
        if (!selectedSourceId || !people) return [];
        const source = sources.find(s => s.id === selectedSourceId);
        const sourceImages = source?.images || [];
        const personMap = new Map();
        // Vanliga kopplingar
        people.forEach(p => {
            let events = [];
            let isLinkedToImageRegion = false;
            if (p.events) {
                p.events.forEach(ev => {
                    if (ev.sources && ev.sources.includes(selectedSourceId)) {
                        events.push(ev);
                    }
                });
            }
            // Bild-tagg
            if (sourceImages.length > 0) {
                const hasImageRegion = sourceImages.some(img => img.regions && img.regions.some(r => r.personId === p.id));
                if (hasImageRegion) {
                    isLinkedToImageRegion = true;
                    // Lägg till "Bild"-händelse om den inte redan finns
                    if (!events.some(e => e.type === 'Bild')) {
                        events.push({ type: 'Bild', id: 'img_' + p.id });
                    }
                }
            }
            if (events.length > 0) {
                personMap.set(p.id, {
                    person: p,
                    events,
                    isLinkedToImageRegion,
                    family: getFamilySuggestions(p, people, selectedSourceId)
                });
            }
        });
        return Array.from(personMap.values());
    }, [selectedSourceId, people, sources]);

  function hasSourceLinked(person, sourceId) {
      if (!person || !person.events) return false;
      return person.events.some(e => e.sources && e.sources.includes(sourceId));
  }

  function getFamilySuggestions(person, allPeople, sourceId) {
      const suggestions = [];
      const rels = person.relations || {};
      const addSugg = (id, role) => {
          const p = allPeople.find(x => x.id === id);
          if (p && !hasSourceLinked(p, sourceId)) {
              suggestions.push({ person: p, role });
          }
      };
      (rels.parents || []).forEach(id => addSugg(id, 'Förälder'));
      if (rels.spouseId) addSugg(rels.spouseId, 'Partner');
      (rels.children || []).forEach(id => addSugg(id, 'Barn'));
      (rels.siblings || []).forEach(id => addSugg(id, 'Syskon'));
      return suggestions;
  }

  const getLifeSpan = (p) => {
      const getYear = (type) => {
          const evt = p.events?.find(e => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
          return evt?.date ? evt.date.substring(0, 4) : '';
      };
      const b = getYear('BIRT');
      const d = getYear('DEAT');
      if (!b && !d) return '';
      return `(${b}-${d})`;
  };

  function translateEvent(type) {
      const map = {
          'BIRT': 'Födelse', 'DEAT': 'Död', 'CHR': 'Dop', 'BURI': 'Begravning',
          'MARR': 'Vigsel', 'DIV': 'Skilsmässa', 'OCCU': 'Yrke', 'RESI': 'Bosatt',
          'EDUC': 'Utbildning', 'CONF': 'Konfirmation', 'PROB': 'Bouppteckning',
          'CENS': 'Husförhör', 'EMIG': 'Utvandring', 'IMMI': 'Invandring'
      };
      return map[type] || type;
  }

  // --- HÄMTA NOTERINGAR (Oförändrad) ---
  const getNotesList = (source) => {
      if (!source) return [];
      if (source.notes && Array.isArray(source.notes)) return source.notes;
      if (source.note) return [{ id: 'legacy', text: source.note }];
      return [];
  };

  const currentNotes = selectedSource ? getNotesList(selectedSource) : [];
  const imagesCount = selectedSource?.images?.length || 0;
  const notesCount = currentNotes.length;
  const connectionsCount = Array.isArray(linkedData)
    ? linkedData.reduce((sum, item) => sum + (Array.isArray(item?.events) ? item.events.length : 0), 0)
    : 0;

  const inferSourceTypeFromLabel = (label) => {
    const text = String(label || '').trim().toLowerCase();
    if (!text) return null;
    if (text.includes('webb')) return 'website';
    if (text.includes('intervju')) return 'interview';
    if (text.includes('tidning')) return 'newspaper';
    if (text.includes('bok')) return 'book';
    if (text.includes('dokument')) return 'document';
    return null;
  };

  const buildDefaultsForSameLevel = (target) => {
    if (!target) return { archiveTop: 'Övrigt' };

    // Leaf source: clone grouping context from the clicked source.
    if (target.kind === 'source') {
      const archiveTop = target.archiveTop || (target.archive === 'Arkiv Digital' || target.archive === 'Riksarkivet' ? target.archive : 'Övrigt');
      return {
        archiveTop,
        archive: target.archive || (archiveTop === 'Arkiv Digital' || archiveTop === 'Riksarkivet' ? archiveTop : ''),
        title: target.sourceTitle || target.title || '',
        sourceTitle: target.sourceTitle || target.title || '',
        author: target.author || '',
        volume: target.volume || '',
        date: target.date || '',
        sourceType: target.sourceType || null
      };
    }

    // Folder node: derive defaults from tree ancestry.
    const ancestors = Array.isArray(target.ancestors) ? target.ancestors : [];
    const root = ancestors[0] || 'Övrigt';
    const defaults = {
      archiveTop: root,
      archive: (root === 'Arkiv Digital' || root === 'Riksarkivet') ? root : ''
    };

    if ((root === 'Arkiv Digital' || root === 'Riksarkivet') && ancestors.length >= 2) {
      defaults.title = ancestors[1];
    }

    if ((root === 'Arkiv Digital' || root === 'Riksarkivet') && ancestors.length >= 3) {
      const volLabel = String(ancestors[2] || '').trim();
      const m = volLabel.match(/^(.*?)(?:\s*\[(\d{4}(?:[-–]\d{4})?)\])?$/);
      defaults.volume = (m && m[1] ? m[1] : volLabel).trim();
      defaults.date = (m && m[2]) ? m[2] : '';
    }

    if (root === 'Övrigt') {
      const typeLabel = ancestors[1] || '';
      const inferredType = inferSourceTypeFromLabel(typeLabel);
      if (inferredType) defaults.sourceType = inferredType;

      if (ancestors.length >= 3) {
        defaults.author = ancestors[2] === 'Okänd författare' ? '' : ancestors[2];
      }

      if (ancestors.length >= 4) {
        const titleWithDate = String(ancestors[3] || '').trim();
        const m = titleWithDate.match(/^(.*?)(?:\s+\((\d{4}(?:[-–]\d{4})?)\))?$/);
        const parsedTitle = (m && m[1] ? m[1] : titleWithDate).trim();
        defaults.title = parsedTitle;
        defaults.sourceTitle = parsedTitle;
        if (m && m[2]) defaults.date = m[2];
      }
    }

    // Also try infer source type from clicked folder label for non-Övrigt subfolders.
    if (!defaults.sourceType) {
      defaults.sourceType = inferSourceTypeFromLabel(ancestors[ancestors.length - 1]);
    }

    return defaults;
  };

  const handleMoveManualSourceToContext = (sourceId, targetContext) => {
    if (!sourceId || !targetContext) return;

    const dragged = (sources || []).find((s) => s && s.id === sourceId);
    if (!dragged) return;

    if ((dragged.archiveTop || 'Övrigt') !== 'Övrigt') {
      showStatus('Drag-and-drop mellan mappar stöds bara för manuella källor under Övrigt.', 'warning');
      return;
    }

    const next = { ...dragged };

    if (targetContext.kind === 'source') {
      next.title = targetContext.sourceTitle || targetContext.title || next.title;
      next.sourceTitle = targetContext.sourceTitle || targetContext.title || next.sourceTitle || next.title;
      next.author = targetContext.author || '';
      next.sourceType = targetContext.sourceType || next.sourceType;
      next.date = targetContext.date || next.date;
    } else if (targetContext.kind === 'folder') {
      const ancestors = Array.isArray(targetContext.ancestors) ? targetContext.ancestors : [];
      if (ancestors[0] === 'Övrigt') {
        const inferredType = inferSourceTypeFromLabel(ancestors[1]);
        if (inferredType) next.sourceType = inferredType;
        if (ancestors.length >= 3) {
          next.author = ancestors[2] === 'Okänd författare' ? '' : ancestors[2];
        }
        if (ancestors.length >= 4) {
          const titleWithDate = String(ancestors[3] || '').trim();
          const m = titleWithDate.match(/^(.*?)(?:\s+\((\d{4}(?:[-–]\d{4})?)\))?$/);
          const parsedTitle = (m && m[1] ? m[1] : titleWithDate).trim();
          if (parsedTitle) {
            next.title = parsedTitle;
            next.sourceTitle = parsedTitle;
          }
          if (m && m[2]) next.date = m[2];
        }
      }
    }

    const changed = (
      String(next.title || '') !== String(dragged.title || '') ||
      String(next.sourceTitle || '') !== String(dragged.sourceTitle || '') ||
      String(next.author || '') !== String(dragged.author || '') ||
      String(next.sourceType || '') !== String(dragged.sourceType || '') ||
      String(next.date || '') !== String(dragged.date || '')
    );
    if (!changed) return;

    onEditSource(next);
    showStatus('Källa flyttad till vald nivå.', 'success');
  };

  // --- RENDER TREE (Updated with badges & context menu) ---
  const renderTreeNodes = (node, pathPrefix, ancestors = []) => {
      if (Array.isArray(node)) {
          return (
            <div className="ml-5 border-l-2 border-subtle pl-1">
              {node.map(src => {
                const isLinked = alreadyLinkedIds.includes(src.id);
                return (
                    <SourceContextMenu
                      key={src.id}
                      source={{ ...src, kind: 'source' }}
                      isFolder={false}
                      onCopy={handleCopyCitation}
                      onDelete={handleDeleteSource}
                      onCreateSibling={handleCreateSourceSibling}
                    >
                      <div 
                        id={`source-item-${src.id}`} 
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'source', id: src.id, title: src.title }));
                          e.dataTransfer.effectAllowed = 'move';
                          e.currentTarget.style.opacity = '0.55';
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const dropData = e.dataTransfer.getData('application/json');
                          if (dropData) {
                            try {
                              const data = JSON.parse(dropData);
                              if (data.type !== 'source') return;
                              if (data.id === src.id) return;
                              // Dropping on a source row means inherit that source's context.
                              handleMoveManualSourceToContext(data.id, { ...src, kind: 'source' });
                            } catch (err) { /* ignore */ }
                          }
                        }}
                        onClick={() => handleSelect(src.id)}
                        onDoubleClick={() => { if (isDrawerMode && onLinkSource) onLinkSource(src.id); }}
                        className={`
                          cursor-pointer text-xs py-1 px-2 rounded truncate transition-colors duration-200 flex justify-between items-center group
                          ${selectedSourceId === src.id ? 'bg-accent text-on-accent font-medium border-l-2 border-accent shadow-sm' : 'text-muted hover:bg-surface-2'}
                          ${isLinked ? 'bg-green-900 text-green-200 border-l-2 border-green-500' : ''}
                        `}
                        title={`${src.label} (Högerklicka för meny)`}
                      >
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <span className="truncate flex-1">{src.label}</span>
                        </div>
                        
                        {/* ACTION KNAPPAR */}
                        <div className="flex gap-1 items-center ml-2 shrink-0">
                          <Button
                            onClick={(e) => { e.stopPropagation(); src.aid && window.open(`http://www.arkivdigital.se/aid/show/${src.aid}`, '_blank'); }}
                            variant="ghost"
                            size="xs"
                            title={src.aid ? "Öppna AID" : "Ingen AID"}
                            className={src.aid ? "border border-emerald-500 bg-emerald-100 text-black font-semibold hover:bg-emerald-200" : "opacity-50 border border-subtle text-muted"}
                          >AD</Button>
                          <Button
                            onClick={(e) => { e.stopPropagation(); src.bildid && window.open(`https://sok.riksarkivet.se/bildvisning/${src.bildid}`, '_blank'); }}
                            variant="ghost"
                            size="xs"
                            title={src.bildid ? "Öppna RA" : "Ingen RA-länk"}
                            className={src.bildid ? "border border-sky-500 bg-sky-100 text-black font-semibold hover:bg-sky-200" : "opacity-50 border border-subtle text-muted"}
                          >RA</Button>
                          <Button
                            onClick={(e) => { e.stopPropagation(); src.nad && window.open(`https://sok.riksarkivet.se/?postid=ArkisRef%20${src.nad}`, '_blank'); }}
                            variant="ghost"
                            size="xs"
                            title={src.nad ? "Öppna NAD" : "Ingen NAD-länk"}
                            className={src.nad ? "border border-violet-500 bg-violet-100 text-black font-semibold hover:bg-violet-200" : "opacity-50 border border-subtle text-muted"}
                          >NAD</Button>
                        </div>
                        {isLinked && <span className="text-green-400 font-bold ml-1 text-xs">✓</span>}
                      </div>
                    </SourceContextMenu>
                );
              })}
            </div>
          );
      }
      return Object.keys(node).sort().map(key => {
          const currentPath = pathPrefix + key;
          const isExpanded = expanded[currentPath];
          const nextAncestors = [...ancestors, key];
          return (
            <div key={key} className="mb-1 ml-2">
              <SourceContextMenu
                source={{ kind: 'folder', key, path: currentPath, ancestors: nextAncestors }}
                isFolder={true}
                onCreateSibling={handleCreateSourceSibling}
              >
               <div
                className="flex items-center cursor-pointer hover:bg-surface-2 py-1 px-1 rounded font-semibold text-primary text-sm transition-colors"
                onClick={() => handleToggle(currentPath)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const dropData = e.dataTransfer.getData('application/json');
                  if (!dropData) return;
                  try {
                    const data = JSON.parse(dropData);
                    if (data.type !== 'source') return;
                    if (nextAncestors[0] !== 'Övrigt') return;
                    handleMoveManualSourceToContext(data.id, { kind: 'folder', ancestors: nextAncestors });
                  } catch (err) { /* ignore */ }
                }}
              >
                <span className="w-4 text-center text-xs text-muted mr-1">{isExpanded ? '▼' : '▶'}</span>{key}
              </div>
              </SourceContextMenu>
              {isExpanded && renderTreeNodes(node[key], currentPath, nextAncestors)}
            </div>
          );
      });
  };

  // Keyboard handler för DEL-tangenten
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' && selectedSourceId) {
        const selectedSource = sources.find(s => s.id === selectedSourceId);
        if (selectedSource && onDeleteSource) {
          if (confirm('Ta bort källa?')) {
            onDeleteSource(selectedSourceId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSourceId, sources, onDeleteSource]);

  // Handlers for new features
  const handleCopyCitation = async (src) => {
    const citation = formatCitation(src);
    try {
      await navigator.clipboard.writeText(citation);
      showStatus('Källhänvisning kopierad.');
    } catch (err) {
      console.error('Kopieringsfel:', err);
      showStatus('Kunde inte kopiera källhänvisning.', 'error');
    }
  };

  const handleDeleteSource = (sourceId) => {
    if (confirm('Ta bort denna källa?')) {
      onDeleteSource(sourceId);
    }
  };

  const openSourceUrl = (rawUrl) => {
    const value = String(rawUrl || '').trim();
    if (!value) return;
    const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      window.open(href, '_blank');
    } catch (err) {
      console.error('Kunde inte öppna URL:', err);
    }
  };

  const handleCreateSourceSibling = (sourceOrNode) => {
    if (onAddSource) {
      onAddSource(buildDefaultsForSameLevel(sourceOrNode));
    }
  };

  return (
    <div className="flex w-full h-full bg-surface overflow-hidden">
      <aside className="w-80 border-r border-subtle bg-surface flex flex-col h-full shrink-0">
        <div className="p-2 border-b border-subtle bg-background space-y-2 shrink-0">
          <div className="mb-1 p-2 bg-surface border border-subtle rounded">
            <label className="block text-xs font-bold text-accent uppercase mb-1">Snabb-import (AD/RA)</label>
            <div className="flex gap-2">
              <textarea
                className="flex-1 border border-subtle rounded p-1 text-xs h-8 resize-none focus:h-16 transition-all bg-background text-primary focus:ring-2 focus:ring-accent focus:border-accent"
                placeholder="Klistra in källtext..."
                value={importString}
                onChange={(e) => setImportString(e.target.value)}
              />
              <Button
                onClick={parseSourceString}
                variant="primary"
                size="sm"
                className="bg-accent text-on-accent border border-accent hover:opacity-90 font-semibold"
              >
                Tolka
              </Button>
            </div>
          </div>
          <input type="text" placeholder="Sök..." className="w-full px-2 py-1 text-sm border border-subtle rounded bg-background text-primary placeholder-slate-500 focus:border-accent focus:outline-none shadow-sm" value={searchTerm || ''} onChange={handleSearch} />
          <select className="w-full px-2 py-1 text-xs border border-subtle rounded bg-background text-primary focus:border-accent focus:outline-none" value={sortOrder} onChange={handleSortChange}>
            <option value="name_asc">Namn (A-Ö)</option>
            <option value="name_desc">Namn (Ö-A)</option>
            <option value="date_desc">Senast ändrad (Nyast)</option>
            <option value="date_asc">Senast ändrad (Äldst)</option>
          </select>
          <button
            onClick={() => setShowOrphanedOnly(!showOrphanedOnly)}
            className={`w-full px-2 py-1 text-xs font-semibold rounded transition-colors ${
              showOrphanedOnly 
                ? 'bg-yellow-900 text-yellow-200 border border-yellow-500' 
                : 'bg-surface-2 text-secondary border border-subtle hover:bg-surface-3'
            }`}
            title="Visa endast okopplade källor"
          >
            {showOrphanedOnly ? '🗑️ Visa oklopplade' : 'Visa alla'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 relative" ref={listContainerRef}>
            {Object.keys(tree).sort().map(arkiv => (
                <div key={arkiv} className="mb-1">
                    <SourceContextMenu
                source={{ kind: 'folder', key: arkiv, ancestors: [arkiv] }}
                      isFolder={true}
                onCreateSibling={handleCreateSourceSibling}
                    >
                    <div
                      className="flex items-center cursor-pointer hover:bg-surface-2 py-1 px-1 rounded font-bold text-accent transition-colors"
                      onClick={() => handleToggle(arkiv)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const dropData = e.dataTransfer.getData('application/json');
                        if (!dropData) return;
                        try {
                          const data = JSON.parse(dropData);
                          if (data.type !== 'source') return;
                          if (arkiv === 'Övrigt') {
                            showStatus('Släpp på en undermapp under Övrigt (t.ex. Webbsida) för att flytta källan.', 'warning');
                          }
                        } catch (err) { /* ignore */ }
                      }}
                    >
                        <span className="w-4 text-center text-xs text-muted mr-1">{expanded[arkiv] ? '▼' : '▶'}</span>{arkiv}
                    </div>
                    </SourceContextMenu>
              {expanded[arkiv] && renderTreeNodes(tree[arkiv], arkiv, [arkiv])}
                </div>
            ))}
            {Object.keys(tree).length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted text-sm mt-10">
                    <p>Inga kilder hittades.</p>
                    {onAddSource && <Button onClick={onAddSource} variant="primary" size="sm">Skapa ny källa</Button>}
                </div>
            )}
        </div>
      </aside>

      <main className="flex-1 h-full bg-surface flex flex-col">
        {selectedSource ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* HEADER (Oförändrad) */}
            <div className="p-6 pb-0 shrink-0">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-on-accent">Redigera Källa</h2>
                        <div className="text-xs text-muted">ID: {selectedSource.id}</div>
                    </div>
                    <div className="flex gap-2">
                        {onAddSource && <Button onClick={onAddSource} variant="primary" size="sm">Ny källa</Button>}
                        {isDrawerMode && onLinkSource && <Button onClick={() => onLinkSource(selectedSource.id)} variant="success" size="sm">✓ Koppla källa</Button>}
                        <Button onClick={() => { if(confirm('Ta bort källa?')) onDeleteSource(selectedSource.id); }} variant="danger" size="sm">Ta bort källa</Button>
                    </div>
                </div>

                {/* FLIKAR (Oförändrad) */}
                <div className="flex border-b mt-4 bg-background rounded-t-lg shadow-sm">
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'info' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                        onClick={() => setActiveRightTab('info')}
                        title="Källinformation"
                    >
                        <span className="text-lg" role="img" aria-label="Info">ℹ️</span>
                        Info
                        {activeRightTab === 'info' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'images' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                        onClick={() => setActiveRightTab('images')}
                        title="Bilder"
                    >
                        <span className="text-lg" role="img" aria-label="Bilder">🖼️</span>
                        Bilder
                        {imagesCount > 0 && <span className="ml-1 bg-green-900 text-green-200 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{imagesCount}</span>}
                        {activeRightTab === 'images' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'notes' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                        onClick={() => setActiveRightTab('notes')}
                        title="Noteringar"
                    >
                        <span className="text-lg" role="img" aria-label="Noteringar">📝</span>
                        Noteringar
                        {notesCount > 0 && <span className="ml-1 bg-green-900 text-green-200 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{notesCount}</span>}
                        {activeRightTab === 'notes' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'connections' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                        onClick={() => setActiveRightTab('connections')}
                        title="Kopplingar"
                    >
                        <span className="text-lg" role="img" aria-label="Kopplingar">👥</span>
                        Kopplingar
                      {connectionsCount > 0 && <span className="ml-1 bg-green-900 text-green-200 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{connectionsCount}</span>}
                        {activeRightTab === 'connections' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-6">
                
                {activeRightTab === 'info' && (
                    <div>
                        {/* ORIGINAL FIELDS (AD/RA only) */}
                        {isArchiveManagedSource && (
                        <>
                        <h3 className="text-sm font-bold text-secondary mb-4 uppercase">Arkivreferens (AD/RA)</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div><label className="block text-xs font-bold text-secondary uppercase">Arkivsystem</label><input className="w-full border border-subtle rounded px-2 py-1 bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.archiveTop || ''} onChange={e => handleSave({ archiveTop: e.target.value })} /></div>
                            <div>
                            <label className="block text-xs font-bold text-secondary uppercase">Titel (TITL)</label>
                            <input className="w-full border border-subtle rounded px-2 py-1 font-semibold bg-background text-primary focus:border-accent focus:outline-none" list="places-datalist" value={selectedSource.sourceTitle || selectedSource.title || ''} onChange={e => handleSave({ sourceTitle: e.target.value, title: e.target.value })} />
                                <datalist id="places-datalist">{places.map(p => (<option key={p.id} value={p.name} />))}</datalist>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-6">
                          <div><label className="block text-xs font-bold text-secondary uppercase">Arkivvolym</label><input className="w-full border border-subtle rounded px-2 py-1 bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.volume || ''} onChange={e => handleSave({ volume: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-secondary uppercase">År</label><input className="w-full border border-subtle rounded px-2 py-1 bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.date || ''} onChange={e => handleSave({ date: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-secondary uppercase">Bild</label><input className="w-full border border-subtle rounded px-2 py-1 bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.imagePage || ''} onChange={e => handleSave({ imagePage: e.target.value })} /></div>
                            <div><label className="block text-xs font-bold text-secondary uppercase">Sida/Källdetalj</label><input className="w-full border border-subtle rounded px-2 py-1 bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.page || ''} onChange={e => handleSave({ page: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-6 bg-background p-3 rounded border border-subtle">
                            <div className="flex items-end gap-1">
                              <div className="flex-1">
                                <label className="block text-xs font-bold text-secondary uppercase">AID (AD)</label>
                                <input className="w-full border border-subtle rounded px-2 py-1 font-mono text-xs bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.aid || ''} onChange={e => handleSave({ aid: e.target.value })} />
                              </div>
                              {selectedSource.aid && (
                                <Button
                                  onClick={() => window.open(`http://www.arkivdigital.se/aid/show/${selectedSource.aid}`, '_blank')}
                                  variant="ghost"
                                  size="xs"
                                  className="border border-emerald-500 bg-emerald-100 text-black font-semibold hover:bg-emerald-200"
                                >AD</Button>
                              )}
                            </div>
                            <div className="flex items-end gap-1">
                              <div className="flex-1">
                                <label className="block text-xs font-bold text-secondary uppercase">BildID (RA)</label>
                                <input className="w-full border border-subtle rounded px-2 py-1 font-mono text-xs bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.bildid || ''} onChange={e => handleSave({ bildid: e.target.value })} />
                              </div>
                              {selectedSource.bildid && (
                                <Button
                                  onClick={() => window.open(`https://sok.riksarkivet.se/bildvisning/${selectedSource.bildid}`, '_blank')}
                                  variant="ghost"
                                  size="xs"
                                  className="border border-sky-500 bg-sky-100 text-black font-semibold hover:bg-sky-200"
                                >RA</Button>
                              )}
                            </div>
                            <div className="flex items-end gap-1">
                              <div className="flex-1">
                                <label className="block text-xs font-bold text-secondary uppercase">NAD</label>
                                <input className="w-full border border-subtle rounded px-2 py-1 font-mono text-xs bg-background text-primary focus:border-accent focus:outline-none" value={selectedSource.nad || ''} onChange={e => handleSave({ nad: e.target.value })} />
                              </div>
                              {selectedSource.nad && (
                                <Button
                                  onClick={() => window.open(`https://sok.riksarkivet.se/?postid=ArkisRef%20${selectedSource.nad}`, '_blank')}
                                  variant="ghost"
                                  size="xs"
                                  className="border border-violet-500 bg-violet-100 text-black font-semibold hover:bg-violet-200"
                                >NAD</Button>
                              )}
                            </div>
                        </div>
                          </>
                          )}
                        <div className="mt-4 mb-6 space-y-4">
                            {/* KÄLLTYP & GEDCOM FÄLT (manuella källor) */}
                          {!isArchiveManagedSource && (
                        <div className="mb-6 p-3 bg-background border border-accent/30 rounded">
                            <label className="block text-xs font-bold text-accent uppercase mb-2">Källtyp (GEDCOM AUTH/TITL/PUBL)</label>
                            <select 
                              className="w-full border border-subtle rounded px-2 py-1.5 text-sm bg-background text-primary focus:border-accent focus:outline-none mb-3"
                              value={selectedSource.sourceType || 'document'}
                              onChange={e => handleSave({ sourceType: e.target.value })}
                            >
                              {Object.entries(SOURCE_TYPES).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                              ))}
                            </select>

                            {/* DYNAMIC FIELDS BASED ON SOURCE TYPE */}
                            {(() => {
                              const sourceType = selectedSource.sourceType || 'document';
                              const config = SOURCE_TYPES[sourceType] || SOURCE_TYPES.document;
                              return (
                                <div className="grid grid-cols-2 gap-2">
                                  {config.fields.includes('author') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Författare (AUTH)</label>
                                      <input 
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        value={selectedSource.author || ''}
                                        onChange={e => handleSave({ author: e.target.value })}
                                        placeholder="ex. John Smith"
                                      />
                                    </div>
                                  )}
                                  {config.fields.includes('title') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Titel (TITL)</label>
                                      <input 
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        value={selectedSource.sourceTitle || selectedSource.title || ''}
                                        onChange={e => handleSave({ sourceTitle: e.target.value, title: e.target.value })}
                                        placeholder="ex. Parish Records"
                                      />
                                    </div>
                                  )}
                                  {config.fields.includes('publisher') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Förlag (PUBL)</label>
                                      <input 
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        value={selectedSource.publisher || ''}
                                        onChange={e => handleSave({ publisher: e.target.value })}
                                        placeholder="ex. Unknown Publisher"
                                      />
                                    </div>
                                  )}
                                  {config.fields.includes('url') && (
                                    <div className="col-span-2">
                                      <label className="block text-xs font-bold text-secondary uppercase">URL</label>
                                      <div className="flex items-center gap-2">
                                        <input 
                                          className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                          type="url"
                                          value={selectedSource.url || ''}
                                          onChange={e => handleSave({ url: e.target.value })}
                                          placeholder="https://example.com"
                                        />
                                        <Button
                                          onClick={() => openSourceUrl(selectedSource.url)}
                                          variant="ghost"
                                          size="xs"
                                          disabled={!String(selectedSource.url || '').trim()}
                                          title={selectedSource.url ? 'Öppna URL' : 'Ingen URL'}
                                          className={String(selectedSource.url || '').trim()
                                            ? 'border border-sky-500 bg-sky-100 text-black font-semibold hover:bg-sky-200'
                                            : 'opacity-50 border border-subtle text-muted'
                                          }
                                        >
                                          URL
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {config.fields.includes('interviewerName') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Intervjuare</label>
                                      <input 
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        value={selectedSource.interviewerName || ''}
                                        onChange={e => handleSave({ interviewerName: e.target.value })}
                                        placeholder="ex. Mary Doe"
                                      />
                                    </div>
                                  )}
                                  {config.fields.includes('intervieweeName') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Intervjuad person</label>
                                      <input 
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        value={selectedSource.intervieweeName || ''}
                                        onChange={e => handleSave({ intervieweeName: e.target.value })}
                                        placeholder="ex. John Smith"
                                      />
                                    </div>
                                  )}
                                  {config.fields.includes('date') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Datum</label>
                                      <input 
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        type="text"
                                        value={selectedSource.date || ''}
                                        onChange={e => handleSave({ date: e.target.value })}
                                        placeholder="ex. 1950 eller 1950-05-15"
                                      />
                                    </div>
                                  )}
                                  {config.fields.includes('page') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Sida</label>
                                      <input 
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        value={selectedSource.page || ''}
                                        onChange={e => handleSave({ page: e.target.value })}
                                        placeholder="ex. 42 eller 40-45"
                                      />
                                    </div>
                                  )}
                                  {!config.fields.includes('page') && (
                                    <div>
                                      <label className="block text-xs font-bold text-secondary uppercase">Sida / Källdetalj (PAGE)</label>
                                      <input
                                        className="w-full border border-subtle rounded px-2 py-1 text-xs bg-background text-primary focus:border-accent focus:outline-none"
                                        value={selectedSource.page || ''}
                                        onChange={e => handleSave({ page: e.target.value })}
                                        placeholder="ex. 42 eller rad/kolumn"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                        )}

                        <div className="flex items-center gap-2"><label className="text-xs font-bold text-secondary uppercase">Trovärdighet:</label><TrustDropdown value={selectedSource.trust} onChange={v => handleSave({ trust: v })} /></div>

                        {/* TRANSKRIBERING / AVSKRIFT (GEDCOM DATA.TEXT) */}
                        <div className="mb-6 p-3 bg-background border border-blue-900/30 rounded">
                            <label className="block text-xs font-bold text-blue-300 uppercase mb-2">Transkribering / Avskrift (DATA.TEXT)</label>
                            <div className="text-xs text-blue-200 mb-2">Ordagrant avskrift av källans text. Hålls skild från egna noteringar.</div>
                            <Editor
                              value={selectedSource.transcriptionText || ''}
                              onChange={(e) => handleSave({ transcriptionText: e.target.value })}
                              containerProps={{ style: { minHeight: '120px', overflow: 'auto' } }}
                              spellCheck={true}
                              lang="sv"
                            />
                        </div>
                           
                           {/* TAG-SEKTION (samma som MediaManager) */}
                           <div className="space-y-2">
                               <label className="text-[10px] font-bold text-muted uppercase mb-2 block">Taggar</label>
                               
                               {/* Visade taggar */}
                               {(() => {
                                 let tags = selectedSource?.tags || [];
                                 if (typeof tags === 'string' && tags.trim()) {
                                   tags = tags.split(',').map(t => t.trim()).filter(t => t);
                                 }
                                 if (!Array.isArray(tags)) {
                                   tags = [];
                                 }
                                 
                                 return tags.length > 0 && (
                                   <div className="flex flex-wrap gap-2 mb-2">
                                     {tags.map((tag, idx) => (
                                       <span 
                                         key={idx} 
                                         className="bg-green-600/20 border border-green-500/50 text-green-300 text-xs px-2 py-1 rounded-full flex items-center gap-1.5 group hover:bg-green-600/30 transition-colors"
                                       >
                                         <span>{tag}</span>
                                         <button 
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             const newTags = tags.filter(t => t !== tag);
                                             handleSave({ tags: newTags });
                                           }}
                                           className="text-green-400 hover:text-red-400 transition-colors ml-0.5"
                                           title="Ta bort tagg"
                                         >
                                           <X size={12}/>
                                         </button>
                                       </span>
                                     ))}
                                   </div>
                                 );
                               })()}
                               
                               {/* Input för nya taggar */}
                               <div className="relative">
                                   <input
                                       ref={tagInputRef}
                                       type="text"
                                       placeholder="Skriv eller välj tagg..."
                                       className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-sm text-on-accent focus:outline-none focus:border-accent"
                                       value={tagInput}
                                       onChange={(e) => {
                                           setTagInput(e.target.value);
                                           setTagSuggestions(getTagSuggestions(e.target.value));
                                       }}
                                       onKeyDown={(e) => {
                                           if (e.key === 'Enter' || e.key === ',') {
                                               e.preventDefault();
                                               e.stopPropagation();
                                               const trimmed = tagInput.trim();
                                               if (trimmed) {
                                                   handleAddTag(trimmed);
                                               }
                                           }
                                       }}
                                       onClick={(e) => {
                                           e.stopPropagation();
                                       }}
                                       onFocus={(e) => {
                                           e.stopPropagation();
                                           e.target.select();
                                           if (tagInput) {
                                               setTagSuggestions(getTagSuggestions(tagInput));
                                           }
                                       }}
                                       onBlur={() => {
                                           setTimeout(() => setTagSuggestions([]), 200);
                                       }}
                                       autoComplete="off"
                                   />
                                   
                                   {/* Autocomplete dropdown */}
                                   {tagSuggestions.length > 0 && tagInput && (
                                       <div className="absolute z-50 w-full mt-1 bg-surface border border-subtle rounded shadow-lg max-h-40 overflow-y-auto">
                                           {tagSuggestions.map((suggestion, idx) => (
                                               <button
                                                   key={idx}
                                                   onClick={(e) => {
                                                       e.preventDefault();
                                                       handleAddTag(suggestion);
                                                       setTagInput('');
                                                       setTagSuggestions([]);
                                                   }}
                                                   className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-surface-2 transition-colors flex items-center gap-2"
                                               >
                                                   <Tag size={12} className="text-muted" />
                                                   <span>{suggestion}</span>
                                               </button>
                                           ))}
                                       </div>
                                   )}
                               </div>
                               
                               <p className="text-[10px] text-muted">Tryck Enter eller "," för att lägga till tagg</p>
                           </div>
                        </div>
                    </div>
                )}

                {/* --- FLIK: BILDER --- */}
                {activeRightTab === 'images' && (
                    <div className="max-w-5xl mx-auto space-y-4">
                        <div className="text-[10px] text-muted" title={currentMediaFolderPath || 'Standard media-mapp'}>
                          Aktiv media-mapp: {currentMediaFolderPath || 'Standard (../media)'}
                        </div>
                        <MediaSelector
                          media={sourceMediaItems}
                          onMediaChange={handleSourceMediaChange}
                          mediaSortConfig={selectedSource?.mediaSortConfig || { sortBy: 'custom', imageSize: 0.62 }}
                          onMediaSortChange={(newConfig) => handleSave({ mediaSortConfig: newConfig })}
                          entityType="source"
                          entityId={selectedSource?.id}
                          allPeople={people || []}
                          onOpenEditModal={onOpenEditModal}
                          allMediaItems={Array.isArray(dbData?.media) ? dbData.media : []}
                          onUpdateAllMedia={(updatedAllMedia) => {
                            if (typeof setDbData === 'function') {
                              setDbData((prev) => ({ ...prev, media: updatedAllMedia }));
                              requestMediaManagerRefresh('source-media-global-update');
                            }
                          }}
                          allSources={sources || []}
                          allPlaces={places || []}
                        />
                    </div>
                )}

                {/* --- FLIK: NOTERINGAR (Oförändrad) --- */}
                {activeRightTab === 'notes' && (
                    <div className="max-w-3xl mx-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-primary">Anteckningar</h3>
                            <Button 
                                onClick={() => {
                                    const newNote = { id: `note_${Date.now()}`, text: '', created: new Date().toISOString() };
                                    const newNotes = [...currentNotes, newNote];
                                    handleSave({ notes: newNotes });
                                }}
                                variant="primary"
                                size="sm"
                            >
                                + Ny anteckning
                            </Button>
                        </div>
                        
                        <div className="space-y-4">
                            {currentNotes.map((note, idx) => (
                                <div key={note.id || idx} className="border border-subtle rounded bg-background shadow-sm p-3">
                                    <div className="flex justify-between text-xs text-muted mb-1">
                                        <span>{note.created ? new Date(note.created).toLocaleDateString() : 'Importerad'}</span>
                                        <Button 
                                            onClick={() => {
                                                if(confirm('Ta bort anteckning?')) {
                                                    const newNotes = currentNotes.filter((_, i) => i !== idx);
                                                    handleSave({ notes: newNotes });
                                                }
                                            }}
                                            variant="danger" 
                                            size="xs"
                                        >
                                            Ta bort
                                        </Button>
                                    </div>
                                    <Editor
                                        value={note.text || ''}
                                        onChange={(e) => {
                                            const newNotes = [...currentNotes];
                                            newNotes[idx] = { ...note, text: e.target.value };
                                            handleSave({ notes: newNotes });
                                        }}
                                        containerProps={{ style: { minHeight: '100px' } }}
                                    />
                                </div>
                            ))}
                            {currentNotes.length === 0 && <div className="text-center text-muted italic py-10">Inga anteckningar än.</div>}
                        </div>
                    </div>
                )}

                {/* --- FLIK: KOPPLINGAR --- */}
                {activeRightTab === 'connections' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-primary">Kopplade Människor & Händelser</h3>
                            {onOpenLinkPersonModal && (
                                <Button onClick={() => onOpenLinkPersonModal(null)} variant="primary" size="sm">
                                    <span>+</span> Koppla person
                                </Button>
                            )}
                        </div>
                        {linkedData.length === 0 ? (
                            <p className="text-muted text-sm italic text-center py-4">Inga personer är kopplade till denna källa än.</p>
                        ) : (
                            <div className="space-y-6">
                                {linkedData.map((item, index) => (
                                    <div key={index} className="bg-background border border-subtle rounded-md overflow-hidden">
                                        <div className="flex items-center p-3 bg-surface border-b border-subtle hover:bg-surface-2 transition-colors">
                                            {/* Rund thumbnail till vänster */}
                                            <div className="w-10 h-10 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong mr-3">
                                                {item.person.media && item.person.media.length > 0 ? (
                                                    <MediaImage 
                                                        url={item.person.media[0].url || item.person.media[0].path}
                                                        alt={`${item.person.firstName} ${item.person.lastName}`} 
                                                        className="w-full h-full object-cover"
                                                        style={getAvatarImageStyle(item.person.media[0], item.person.id)}
                                                    />
                                                ) : (
                                                    <User className="w-full h-full p-2 text-muted" />
                                                )}
                                            </div>
                                            
                                            {item.isLinkedToImageRegion && (
                                                <span className="text-green-600 mr-2" title="Personen är taggad i en bild från denna källa">🖼️</span>
                                            )}
                                            <div className="w-12 text-xs font-mono text-muted">#{item.person.refNumber}</div>
                                            <div className="flex-1 font-bold text-accent cursor-pointer hover:underline" onClick={() => onOpenEditModal && onOpenEditModal(item.person.id)}>
                                                {item.person.firstName} {item.person.lastName}
                                                <span className="font-normal text-muted ml-2 text-xs">{getLifeSpan(item.person)}</span>
                                            </div>
                                            <div className="w-48 text-sm font-medium px-2 bg-surface-2 rounded py-0.5 mr-4 flex flex-wrap gap-2 justify-end">
                                                {item.events.map(ev => (
                                                    <span key={ev.id || ev.type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-200 text-green-900 rounded text-xs font-semibold">
                                                        {translateEvent(ev.type)}
                                                        {onUnlinkSourceFromEvent && (
                                                            <button
                                                                onClick={() => { if(confirm(`Ta bort koppling?`)) onUnlinkSourceFromEvent(item.person.id, ev.id, selectedSource.id); }}
                                                                className="ml-1 text-green-900 hover:text-on-accent hover:bg-green-600 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                                                                title={`Ta bort koppling till ${translateEvent(ev.type)}`}
                                                                style={{ lineHeight: 1, fontSize: '13px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {item.family && item.family.length > 0 && (
                                            <div className="bg-background p-2 pl-12 border-t border-dashed border-subtle">
                                                <div className="text-xs font-bold text-muted uppercase mb-2">Relaterade familjemedlemmar (Tips)</div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    {item.family.map((fam, fIndex) => (
                                                        <div key={fIndex} className="flex items-center justify-between group hover:bg-surface p-1 rounded">
                                                            <div className="flex items-center gap-2"><span className="text-xs font-bold text-muted w-16 text-right">{fam.role}:</span><span className="text-secondary cursor-pointer hover:text-accent" onClick={() => onOpenEditModal && onOpenEditModal(fam.person.id)}>{fam.person.firstName} {fam.person.lastName}</span><span className="text-xs text-muted">{getLifeSpan(fam.person)}</span></div>
                                                            {onOpenLinkPersonModal && (
                                                                <button
                                                                    onClick={() => onOpenLinkPersonModal(fam.person.id)}
                                                                    className="opacity-0 group-hover:opacity-100 bg-accent text-on-accent px-2 py-0.5 rounded text-xs font-semibold hover:bg-accent transition-opacity"
                                                                >
                                                                    Koppla
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <p className="mb-2">← Välj en källa i listan</p>
            {onAddSource && <Button onClick={onAddSource} variant="primary" size="md">Skapa ny källa</Button>}
          </div>
        )}
      </main>
    </div>
  );
}