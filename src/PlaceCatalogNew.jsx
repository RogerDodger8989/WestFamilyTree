import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from './AppContext.jsx';
import WindowFrame from './WindowFrame.jsx';
import MediaImage from './components/MediaImage.jsx';
import { getAvatarImageStyle } from './imageUtils.js';
import PlaceEditModal from './PlaceEditModal.jsx';
import PlaceCreateModal from './PlaceCreateModal.jsx';
import Editor from './MaybeEditor.jsx';
import { User, X } from 'lucide-react';

// Hjälpfunktion för att formatera namn och kod
function formatPlaceName(node) {
  function cleanName(name) {
    if (!name) return '';
    return name.replace(/\s*\(K-\d{4}\)/g, '').replace(/\s+/g, ' ').trim();
  }
  function onlyOneKod(name, kod) {
    if (!kod) return name;
    if (name.includes(`(${kod})`)) return name;
    let n = name.replace(/\s*\([A-ZÅÄÖ]{1}\)/g, '').trim();
    n = n.replace(/\s*\([A-ZÅÄÖ]{1}\)$/,'').trim();
    return `${n} (${kod})`;
  }
  if (node.type === 'Län') {
    const kod = node.metadata.lanskod;
    return onlyOneKod(cleanName(node.metadata.lansnamn || node.name) + ' län', kod);
  }
  if (node.type === 'Kommun') {
    const kod = node.metadata.lanskod;
    return onlyOneKod(cleanName(node.metadata.kommunnamn || node.name) + ' kommun', kod);
  }
  if (node.type === 'Församling') {
    const kod = node.metadata.lanskod;
    let namn = cleanName(node.metadata.sockenstadnamn || node.name);
    if (!namn.toLowerCase().endsWith('församling') && !namn.toLowerCase().endsWith('socken')) {
      namn += ' församling';
    }
    return onlyOneKod(namn, kod);
  }

  return onlyOneKod(cleanName(node.metadata.ortnamn || node.name), node.metadata.lanskod);
}

// Ikoner för varje platstyp
const PLACE_TYPE_ICONS = {
  'Country': '🌍',
  'Province': '📜',
  'County': '🗺️',
  'Municipality': '🏛️',
  'Parish': '⛪',
  'Village': '🏘️',
  'Farm': '🚜',
  'Cottage': '🛖',
  'Hundred': '⚖️',
  'Building': '🏠',
  'Cemetary': '🪦',
  'Address': '📍',
  'default': '📍'
};

const PLACE_TYPE_LABELS = {
  'Country': 'Land',
  'Province': 'Landskap',
  'County': 'Län',
  'Municipality': 'Kommun',
  'Parish': 'Församling',
  'Village': 'By/Ort',
  'Farm': 'Gård/Hemman',
  'Cottage': 'Torp/Stuga',
  'Hundred': 'Härad',
  'Building': 'Byggnad',
  'Cemetary': 'Kyrkogård',
  'Address': 'Gata/Adress',
  'default': 'Plats'
};
// Röd och blå Leaflet-ikon
const redIcon = new L.Icon({
  iconUrl: '/marker-icon-red.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
const blueIcon = new L.Icon({
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});


const DEFAULT_MAP_CENTER = [62.2, 15.2];

// Arrow toggle component
function ArrowToggle({ open, ...props }) {
  return (
    <span {...props} style={{ cursor: 'pointer', userSelect: 'none', fontSize: '1.2em', marginRight: 6 }}>
      {open ? '▼' : '▲'}
    </span>
  );
}

const toNumberCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const getNodeCoordinates = (node) => {
  if (!node) return null;
  const lat = toNumberCoordinate(node.metadata?.latitude ?? node.latitude);
  const lng = toNumberCoordinate(node.metadata?.longitude ?? node.longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
};

const MapSelectionSync = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom, { duration: 0.6 });
  }, [map, center, zoom]);

  return null;
};

// Komponent för att rendera ikoner baserat på platstyp
const LocationIcon = ({ type, className = '' }) => {
  const icon = PLACE_TYPE_ICONS[type] || PLACE_TYPE_ICONS.default;
  return <span className={`${className}`}>{icon}</span>;
};

// Rekursiv träd-nod komponent
const TreeNode = ({ 
  node, 
  level, 
  expandedNodes, 
  toggleExpand, 
  selectedNodeId, 
  selectedNodeIds,
  onSelect,
  onToggleMultiSelect,
  onContextMenu,
  onDoubleClick,
  highlightTerm,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const placeId = String(node?.metadata?.id ?? node?.id ?? '').trim();
  const isMultiSelected = selectedNodeIds && selectedNodeIds.has(placeId);
  const isUserPlace = node.metadata?.source === 'user' || String(node.id || '').startsWith('user_');
  
  // Highlight matching text
  const highlightText = (text) => {
    if (!highlightTerm || !text) return text;
    const parts = text.split(new RegExp(`(${highlightTerm})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === highlightTerm.toLowerCase() ? 
        <mark key={i} className="bg-amber-700 text-amber-100">{part}</mark> : part
    );
  };

  return (
    <div>
        <div 
          data-place-id={node.id}
          draggable={isUserPlace}
          onDragStart={(e) => onDragStart && onDragStart(e, node)}
          onDragOver={(e) => onDragOver && onDragOver(e, node)}
          onDrop={(e) => onDrop && onDrop(e, node)}
          className={`flex items-center py-1 px-2 cursor-pointer select-none hover:bg-surface-2 transition-colors ${
            isSelected || isMultiSelected ? 'bg-accent border-l-4 border-accent' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={(e) => onSelect(node, e)}
          onDoubleClick={() => onDoubleClick(node)}
          onContextMenu={(e) => onContextMenu(e, node)}
        >
        <div 
          className="mr-1 text-muted hover:text-secondary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleExpand(node.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <span className="text-sm">▼</span>
            ) : (
              <span className="text-sm">▶</span>
            )
          ) : (
            <span className="w-[14px] inline-block" /> 
          )}
        </div>

        <input
          type="checkbox"
          className="mr-2 h-4 w-4"
          checked={isMultiSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onToggleMultiSelect && onToggleMultiSelect(node, e.target.checked)}
          disabled={!placeId || placeId === 'root'}
          aria-label={`Välj plats ${formatPlaceName(node)}`}
        />
        
        <LocationIcon 
          type={node.type}
          className="mr-2 text-base"
        />
        <span className="text-sm text-primary">
          {highlightText(formatPlaceName(node))}
        </span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode 
              key={child.id} 
              node={child} 
              level={level + 1} 
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
              onSelect={onSelect}
              onToggleMultiSelect={onToggleMultiSelect}
              onContextMenu={onContextMenu}
              onDoubleClick={onDoubleClick}
              highlightTerm={highlightTerm}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Högermeny (Context Menu)
const ContextMenu = ({ x, y, node, onClose, onAction }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuItems = [
    { label: 'Ny plats under', action: 'new', icon: '➕' },
    { label: 'Redigera', action: 'edit', icon: '✏️' },
    { label: 'Radera', action: 'delete', icon: '🗑️' },
    { label: '---', action: 'separator' },
    { label: 'Kopiera ID', action: 'copy-id', icon: '🔖' },
    { label: 'Kopiera', action: 'copy', icon: '📋' },
    { label: 'Klistra in', action: 'paste', icon: '📄' },
    { label: '---', action: 'separator' },
    { label: 'Exportera', action: 'export', icon: '📤' },
    { label: 'Importera', action: 'import', icon: '📥' },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-surface border border-subtle rounded shadow-lg py-1 z-50"
      style={{ top: y, left: x }}
    >
      {menuItems.map((item, idx) => 
        item.action === 'separator' ? (
          <div key={idx} className="border-t border-subtle my-1" />
        ) : (
          <button
            key={idx}
            className="w-full text-left px-4 py-2 text-sm hover:bg-surface-2 flex items-center gap-2 text-primary transition-colors"
            onClick={() => {
              onAction(item.action, node);
              onClose();
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>
  );
};

export default function PlaceCatalog({ catalogState, setCatalogState, onPick, onClose, isDrawerMode = false, onLinkPlace, onCalculateMergeImpact, onMergePlaces, allPeople = [], onOpenEditModal }) {
  // State for map visibility - default minimized
  const [showMap, setShowMap] = useState(false);
  // Ref for Leaflet map
  const leafletMapRef = useRef(null);
  // Riksarkivet state
  const [riksarkivetResults, setRiksarkivetResults] = useState([]);
  const [riksarkivetLoading, setRiksarkivetLoading] = useState(false);
  const [riksarkivetError, setRiksarkivetError] = useState(null);
  const [riksarkivetSearched, setRiksarkivetSearched] = useState(false);
  // Ingen set-hantering behövs för Riksarkivet OAI-PMH
  const { recordAudit, showStatus, setDbData, dbData, showUndoToast } = useApp();
  // EN källa till platsdata
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));
  const [selectedNode, setSelectedNode] = useState(null);
  const [linkedPeople, setLinkedPeople] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);
  const [sortOrder, setSortOrder] = useState('name-asc');
  const [contextMenu, setContextMenu] = useState(null);
  const [editingPlace, setEditingPlace] = useState(null);
  const [creatingParent, setCreatingParent] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState('info');
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState([]);
  const [lastSelectedPlaceId, setLastSelectedPlaceId] = useState(null);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeMasterId, setMergeMasterId] = useState('');
  const [isMergeFinalStep, setIsMergeFinalStep] = useState(false);
  const [mergeImpactPreview, setMergeImpactPreview] = useState(null);
  const [placeToDelete, setPlaceToDelete] = useState(null);
  const [pendingFocusId, setPendingFocusId] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [moveConfirmation, setMoveConfirmation] = useState(null);
  const [sidePanelForm, setSidePanelForm] = useState({ name: '', type: 'Village', latitude: '', longitude: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const fileInputRef = useRef(null);
  const selectedPlaceIdSet = useMemo(() => new Set(selectedPlaceIds), [selectedPlaceIds]);

  // Bygg träd och flatPlaces från places
  const tree = useMemo(() => convertListToTree(places), [places]);
  const flatPlaces = useMemo(() => flattenTree(tree), [tree]);
  const mapPlaces = useMemo(() => {
    return flatPlaces
      .map((node) => {
        const coordinates = getNodeCoordinates(node);
        if (!coordinates) return null;
        return {
          node,
          id: node.metadata?.id ?? node.id,
          name: formatPlaceName(node),
          coordinates,
        };
      })
      .filter(Boolean);
  }, [flatPlaces]);
  const selectedCoordinates = useMemo(() => getNodeCoordinates(selectedNode), [selectedNode]);

  // --- NYTT: Effekt för att fokusera och fälla ut trädet när en ny plats skapats ---
  useEffect(() => {
    if (!pendingFocusId || !flatPlaces.length) return;

    // Hitta noden i den platta listan (som nu förhoppningsvis innehåller den nya platsen)
    const targetNode = flatPlaces.find(p => p.id === pendingFocusId || p.metadata?.id === pendingFocusId);
    
    if (targetNode) {
      // 1. Expandera föräldrar
      const pathIds = new Set();
      const findPath = (nodes, targetId, currentPath = []) => {
        for (const n of nodes) {
          if (n.id === targetId) return currentPath;
          if (n.children) {
            const res = findPath(n.children, targetId, [...currentPath, n.id]);
            if (res) return res;
          }
        }
        return null;
      };

      const path = findPath(tree, targetNode.id);
      if (path) {
        // Börja med ett rent set (root + sökvägen) för att "städa upp" listan enligt önskemål
        const next = new Set(['root']);
        path.forEach(id => next.add(id));
        setExpandedNodes(next);
      }

      // 2. Markera noden
      setSelectedNode(targetNode);
      setSelectedPlaceIds([targetNode.id]);
      
      // 3. Rensa pending
      setPendingFocusId(null);
      
      // 4. Scrolla till vy om möjligt (valfritt)
      console.log('Automatiskt fokus satt på:', targetNode.name);
    }
  }, [pendingFocusId, flatPlaces, tree]);

  // Function to fly to coordinates
  function flyToCoordinates(coords, zoom = 11) {
    if (leafletMapRef.current && coords && coords.length === 2) {
      leafletMapRef.current.flyTo(coords, zoom, { duration: 0.7 });
    }
  }
  // Stäng med ESC när i pick-läge
  useEffect(() => {
    if (!onPick) return;
    const handler = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPick, onClose]);

  // Hjälpfunktion: lägg till ny nod under parentId i trädet

  function addNodeToTree(nodes, parentId, newNode) {
    return nodes.map(node => {
      if (node.id === parentId) {
        const children = [...(node.children || []), newNode].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
        return { ...node, children };
      }
      if (node.children && node.children.length > 0) {
        return { ...node, children: addNodeToTree(node.children, parentId, newNode) };
      }
      return node;
    });
  }

  // Async function for Riksarkivet search
  const handleRiksarkivetSearch = async (placeName) => {
    setRiksarkivetLoading(true);
    setRiksarkivetError(null);
    setRiksarkivetSearched(true);
    try {
      if (!window.electronAPI || typeof window.electronAPI.searchRiksarkivetArchives !== 'function') {
        throw new Error('Riksarkivet-sök kräver Electron.');
      }
      const response = await window.electronAPI.searchRiksarkivetArchives(placeName, 120);
      if (!response || !response.success) {
        throw new Error(response?.error || 'Kunde inte hämta data från Riksarkivet.');
      }
      setRiksarkivetResults(Array.isArray(response.tree) ? response.tree : []);
    } catch (err) {
      setRiksarkivetResults([]);
      setRiksarkivetError(err?.message || 'Riksarkivet-sök misslyckades.');
    } finally {
      setRiksarkivetLoading(false);
    }
  };

  const handleCreateSourceFromRiksarkivetVolume = (volumeEntry) => {
    if (!volumeEntry || typeof setDbData !== 'function') return;
    const sourceId = `src_ra_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const source = {
      id: sourceId,
      title: getSelectedPlaceQuery() || selectedNode?.name || 'Riksarkivet',
      sourceTitle: getSelectedPlaceQuery() || selectedNode?.name || 'Riksarkivet',
      archiveTop: 'Riksarkivet',
      archive: 'Riksarkivet',
      sourceType: 'document',
      volume: volumeEntry.volume || volumeEntry.title || '',
      date: volumeEntry.year || '',
      nad: volumeEntry.nad || '',
      note: volumeEntry.title || '',
      tags: 'Riksarkivet',
      trust: 4,
      dateAdded: new Date().toISOString(),
      images: []
    };

    setDbData((prev) => {
      const prevSources = Array.isArray(prev?.sources) ? prev.sources : [];
      const duplicate = prevSources.find((s) =>
        String(s?.archiveTop || '').toLowerCase() === 'riksarkivet'
        && String(s?.title || '').trim().toLowerCase() === String(source.title || '').trim().toLowerCase()
        && String(s?.volume || '').trim().toLowerCase() === String(source.volume || '').trim().toLowerCase()
        && String(s?.nad || '').trim().toLowerCase() === String(source.nad || '').trim().toLowerCase()
      );
      if (duplicate) return prev;
      return { ...prev, sources: [...prevSources, source] };
    });

    showStatus && showStatus(`Master-källa skapad: ${source.volume || source.title}`);
  };

  // Uppdatera noteringsutkast när plats byts
  useEffect(() => {
    setNoteDraft(selectedNode?.metadata?.note || '');
    
    // Synka även redigeringsformuläret i sidopanelen
    if (selectedNode) {
      setSidePanelForm({
        name: selectedNode.name || '',
        type: selectedNode.type || 'Village',
        latitude: String(selectedNode.metadata?.latitude || ''),
        longitude: String(selectedNode.metadata?.longitude || '')
      });
      setHasUnsavedChanges(false);
    }
  }, [selectedNode]);

  function convertListToTree(placeList) {
    const root = {
      id: 'root',
      name: 'Sverige',
      type: 'Country',
      children: [],
      metadata: {}
    };

    const typeMap = {
      'Län': 'County', 'Kommun': 'Municipality', 'Församling': 'Parish',
      'Ort': 'Village', 'Byggnad': 'Building', 'Kyrkogård': 'Cemetary',
      'Land': 'Country', 'root': 'Country',
      'Gård': 'Farm', 'Hemman': 'Farm', 'Torp': 'Cottage',
      'Härad': 'Hundred', 'Landskap': 'Province', 'Gata': 'Address', 'Adress': 'Address'
    };

    // 1. Skapa mappar för administrativ skelett-struktur
    const counties = new Map();
    const municipalities = new Map();
    const parishes = new Map();
    const allNodes = new Map();
    allNodes.set('root', root);

    // Hjälpfunktion för att normalisera namn för skelett-noder
    const getCleanName = (name) => String(name || '').replace(/\s*\(K-\d{4}\)/g, '').trim();

    // 2. Första passet: Identifiera alla unika administrativa behållare och skapa skelett
    for (const place of (placeList || [])) {
      if (!place || !place.id) continue;
      
      const p_lan = place.lansnamn || place.region;
      const p_kommun = place.kommunnamn || place.municipality;
      const p_forsamling = place.sockenstadnamn || place.parish;

      if (p_lan && !counties.has(p_lan)) {
        const node = {
          id: `lan-${p_lan}`,
          name: `${getCleanName(p_lan)} län`,
          type: 'County',
          children: [],
          metadata: { lansnamn: p_lan, lanskod: place.lanskod }
        };
        counties.set(p_lan, node);
        allNodes.set(node.id, node);
        root.children.push(node);
      }

      if (p_lan && p_kommun && !municipalities.has(`${p_lan}|${p_kommun}`)) {
        const key = `${p_lan}|${p_kommun}`;
        const node = {
          id: `kommun-${p_kommun}`,
          name: `${getCleanName(p_kommun)} kommun`,
          type: 'Municipality',
          children: [],
          metadata: { kommunnamn: p_kommun, kommunkod: place.kommunkod, lansnamn: p_lan, lanskod: place.lanskod }
        };
        municipalities.set(key, node);
        allNodes.set(node.id, node);
        counties.get(p_lan).children.push(node);
      }

      if (p_lan && p_kommun && p_forsamling && !parishes.has(`${p_lan}|${p_kommun}|${p_forsamling}`)) {
        const key = `${p_lan}|${p_kommun}|${p_forsamling}`;
        let label = getCleanName(p_forsamling);
        if (label && !label.toLowerCase().endsWith('församling') && !label.toLowerCase().endsWith('socken')) {
          label += ' församling';
        }
        const node = {
          id: `forsamling-${p_forsamling}`,
          name: label,
          type: 'Parish',
          children: [],
          metadata: { sockenstadnamn: p_forsamling, sockenstadkod: place.sockenstadkod, kommunnamn: p_kommun, kommunkod: place.kommunkod, lansnamn: p_lan, lanskod: place.lanskod }
        };
        parishes.set(key, node);
        allNodes.set(node.id, node);
        municipalities.get(`${p_lan}|${p_kommun}`).children.push(node);
      }
    }

    // 3. Andra passet: Skapa noder för alla orter/byggnader och lägg in i kartan
    const placeNodes = (placeList || []).map(place => {
      const nodeType = place.type ? (typeMap[place.type] || place.type) : 'Village';
      const node = {
        id: place.id,
        name: place.ortnamn || place.village || place.specific || place.name || '',
        type: nodeType,
        children: [],
        metadata: place
      };
      allNodes.set(node.id, node);
      return node;
    });

    // 4. Tredje passet: Koppla noder till rätt förälder (prioritera parentid)
    for (const node of placeNodes) {
      const place = node.metadata;
      const parentId = place.parentid || place.metadata?.parentid;
      
      if (parentId && allNodes.has(parentId) && parentId !== node.id) {
        // Om vi har ett explicit parentid, flytta den dit
        const parent = allNodes.get(parentId);
        if (!parent.children.some(c => c.id === node.id)) {
          parent.children.push(node);
        }
      } else {
        // Fallback: Använd administrativa hierarkin
        const p_lan = place.lansnamn || place.region;
        const p_kommun = place.kommunnamn || place.municipality;
        const p_forsamling = place.sockenstadnamn || place.parish;

        let fallbackParent = null;
        if (p_lan && p_kommun && p_forsamling) {
          fallbackParent = parishes.get(`${p_lan}|${p_kommun}|${p_forsamling}`);
        } else if (p_lan && p_kommun) {
          fallbackParent = municipalities.get(`${p_lan}|${p_kommun}`);
        } else if (p_lan) {
          fallbackParent = counties.get(p_lan);
        }

        if (fallbackParent) {
          if (!fallbackParent.children.some(c => c.id === node.id)) {
            fallbackParent.children.push(node);
          }
        } else {
          // Ospecificerade
          let unspecifiedNode = root.children.find(c => c.id === 'unspecified');
          if (!unspecifiedNode) {
            unspecifiedNode = { id: 'unspecified', name: 'Ospecificerade platser', type: 'Village', children: [], metadata: {} };
            root.children.push(unspecifiedNode);
            allNodes.set('unspecified', unspecifiedNode);
          }
          if (!unspecifiedNode.children.some(c => c.id === node.id)) {
            unspecifiedNode.children.push(node);
          }
        }
      }
    }

    const sortChildren = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'sv'));
        node.children.forEach(sortChildren);
      }
    };

    sortChildren(root);
    return [root];
  }

  function buildPlaceListFromPeople(people) {
    const source = Array.isArray(people) ? people : [];
    const map = new Map();
    let syntheticId = 1;

    const normalizeName = (value, fallback) => {
      const v = String(value || '').trim();
      return v || fallback;
    };

    for (const person of source) {
      const events = Array.isArray(person?.events) ? person.events : [];
      for (const evt of events) {
        const pd = evt?.placeData && typeof evt.placeData === 'object' ? evt.placeData : null;

        const lansnamn = normalizeName(pd?.region, 'Okänd län');
        const kommunnamn = normalizeName(pd?.municipality, 'Okänd kommun');
        const sockenstadnamn = normalizeName(pd?.parish || pd?.village, 'Okänd församling');
        const ortnamn = normalizeName(pd?.specific || pd?.village || evt?.place, 'Okänd ort');

        const key = [lansnamn, kommunnamn, sockenstadnamn, ortnamn].join('|').toLowerCase();
        if (map.has(key)) continue;

        map.set(key, {
          id: evt?.placeId || pd?.id || `derived_place_${syntheticId++}`,
          lansnamn,
          lanskod: '',
          kommunnamn,
          kommunkod: '',
          sockenstadnamn,
          sockenstadkod: '',
          ortnamn,
          latitude: pd?.latitude ?? null,
          longitude: pd?.longitude ?? null,
        });
      }
    }

    return Array.from(map.values());
  }

  const loadPlaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://127.0.0.1:5005/official_places/full_tree');
      if (!res.ok) {
        throw new Error(`official_places/full_tree svarade ${res.status}`);
      }
      const data = await res.json();
      console.log('DEBUG: Data från backend /official_places/full_tree:', data);

      // --- NYTT: Lägg till användarplatser även när API:t svarar ---
      const apiPlaces = Array.isArray(data.list) && data.list.length > 0
        ? data.list
        : (Array.isArray(data.tree) ? data.tree : []);
      const userPlaces = Array.isArray(dbData?.places) ? dbData.places : [];
      
      // Filter för att dölja "Okända" och "Ospecificerade" platser som skräpat ner servern
      const filterJunk = (p) => {
        const text = [
          p.lansnamn, p.region, p.kommunnamn, p.municipality, 
          p.sockenstadnamn, p.parish, p.ortnamn, p.village, 
          p.specific, p.name
        ].filter(Boolean).join(' ').toLowerCase();
        return text.includes('okänd') || text.includes('okänt') || text.includes('ospecificerad');
      };

      const filteredApi = apiPlaces.filter(p => !filterJunk(p));
      const filteredUser = userPlaces.filter(p => !filterJunk(p));

      // Slå ihop alla platser (ignorera peopleDerivedPlaces för att slippa spök-platser)
      const mergedPlaces = [...filteredApi, ...filteredUser];
      setPlaces(mergedPlaces);
    } catch (e) {
      // Fallback: Endast lokala platser
      const localPlaces = Array.isArray(dbData?.places) ? dbData.places : [];
      const filteredLocal = localPlaces.filter(p => {
        const text = [
          p.lansnamn, p.region, p.kommunnamn, p.municipality, 
          p.sockenstadnamn, p.parish, p.ortnamn, p.village, 
          p.specific, p.name
        ].filter(Boolean).join(' ').toLowerCase();
        return !(text.includes('okänd') || text.includes('okänt') || text.includes('ospecificerad'));
      });
      const mergedPlaces = [...filteredLocal];

      const hasRenderableChildren = (treeData) => {
        if (!Array.isArray(treeData) || treeData.length === 0) return false;
        const root = treeData[0];
        return Array.isArray(root?.children) && root.children.length > 0;
      };

      if (mergedPlaces.length > 0) {
        const fallbackTree = convertListToTree(mergedPlaces);
        if (hasRenderableChildren(fallbackTree)) {
          setPlaces(mergedPlaces);
          showStatus && showStatus('Platsregister laddat lokalt (API ej tillgängligt).');
          return;
        }
      }

      try {
        if (window.electronAPI && typeof window.electronAPI.getReferenceSwedenPlaces === 'function') {
          const resp = await window.electronAPI.getReferenceSwedenPlaces(0);
          const list = Array.isArray(resp?.list) ? resp.list : [];
          if (resp?.success && list.length > 0) {
            const referenceTree = convertListToTree(list);
            if (hasRenderableChildren(referenceTree)) {
              setPlaces(list);
              showStatus && showStatus('Platsregister laddat från lokalt referensbibliotek.');
              return;
            }
          }
        }
      } catch (referenceErr) {
        console.warn('Reference fallback failed:', referenceErr);
      }

      {
        try {
          setPlaces([]);
          showStatus && showStatus('Platsregister tomt lokalt och API är inte tillgängligt.', 'error');
        } catch (_) {
          // no-op
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Ladda personer kopplade till en plats
  const loadLinkedPeople = async (placeId) => {
    try {
      // Använd allPeople från props istället för att hämta från backend
      const linked = [];
      for (const person of allPeople) {
        if (person.events && Array.isArray(person.events)) {
          for (const event of person.events) {
            if (event.placeId == placeId || event.place_id == placeId) {
              linked.push({
                personId: person.id,
                person: person, // Spara hela person-objektet
                eventType: event.type,
                eventDate: event.date || '',
                eventId: event.id
              });
            }
          }
        }
      }
      
      setLinkedPeople(linked);
    } catch (err) {
      console.error('Kunde inte ladda kopplade personer:', err);
      setLinkedPeople([]);
    }
  };

  // Initiera laddningen av platser när komponenten monteras
  useEffect(() => {
    loadPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uppdatera listan med kopplade personer när en plats väljs i trädet
  useEffect(() => {
    if (selectedNode) {
      loadLinkedPeople(selectedNode.metadata?.id || selectedNode.id);
    } else {
      setLinkedPeople([]);
    }
  }, [selectedNode, allPeople]);

  // Konvertera backend-data till trädstruktur
  function convertBackendToTree(data) {
    if (!data || !data.tree) return [];
    
    // Hjälpfunktion: plocka första giltiga namn ur en lista fält
    const pickName = (node, fields) => {
      for (const f of fields) {
        const val = node[f];
        if (val && typeof val === 'string' && val.trim() && !val.toLowerCase().includes('okänd')) {
          return val.trim();
        }
      }
      return '';
    };

    const convertNode = (node, type = 'lan') => {
      if (!node) return null;
      let children = [];
      let nodeName = '';
      let nodeId = '';
      if (type === 'lan') {
        const regionName = pickName(node, ['region', 'lansnamn', 'ortnamn']);
        nodeName = regionName ? `${regionName} (Län)` : '(saknas)';
        nodeId = `lan-${node.region_id || node.lanskod || node.region || node.lansnamn || node.id || Math.random()}`;
        if (Array.isArray(node.children)) {
          children = node.children.map(child => convertNode(child, 'kommun'));
        } else if (node.children && typeof node.children === 'object') {
          children = Object.values(node.children).flat().map(child => convertNode(child, 'kommun'));
        }
      } else if (type === 'kommun') {
        const municipalityName = pickName(node, ['municipality', 'kommunnamn', 'ortnamn']);
        nodeName = municipalityName ? `${municipalityName} (Kommun)` : '(saknas)';
        nodeId = `kommun-${node.municipality_id || node.kommunkod || node.municipality || node.kommunnamn || node.id || Math.random()}`;
        if (Array.isArray(node.children)) {
          children = node.children.map(child => convertNode(child, 'forsamling'));
        } else if (node.children && typeof node.children === 'object') {
          children = Object.values(node.children).flat().map(child => convertNode(child, 'forsamling'));
        }
      } else if (type === 'forsamling') {
        const parishName = pickName(node, ['parish', 'sockenstadnamn', 'ortnamn']);
        nodeName = parishName ? `${parishName} (Församling)` : '(saknas)';
        nodeId = `forsamling-${node.parish_id || node.sockenstadkod || node.parish || node.sockenstadnamn || node.id || Math.random()}`;
        if (Array.isArray(node.children)) {
          children = node.children.map(child => convertNode(child, 'ort'));
        } else if (node.children && typeof node.children === 'object') {
          children = Object.values(node.children).flat().map(child => convertNode(child, 'ort'));
        }
      } else if (type === 'ort') {
        const villageName = pickName(node, ['village', 'ortnamn']);
        nodeName = villageName ? `${villageName} (Ort)` : '(saknas)';
        nodeId = `ort-${node.village_id || node.id || node.village || node.ortnamn || Math.random()}`;
        children = [];
      }
      return {
        id: nodeId,
        name: nodeName,
        type: typeToPlaceType(type),
        children: children,
        metadata: node
      };
    };
    
    // Skapa Sverige som root
    const sverigeNode = {
      id: 'root',
      name: 'Sverige',
      type: 'Country',
      children: [],
      metadata: {}
    };
    
    if (Array.isArray(data.tree)) {
      sverigeNode.children = data.tree.map(node => convertNode(node, 'lan')).filter(Boolean);
    }
    
    return [sverigeNode];
  }

  function typeToPlaceType(type) {
    const map = {
      'lan': 'County',
      'kommun': 'Municipality',
      'forsamling': 'Parish',
      'ort': 'Village'
    };
    return map[type] || 'default';
  }

  // Platta ut trädet för sökning och ta bort dubletter baserat på namn + koordinater
  function flattenTree(nodes) {
    const result = [];
    const traverse = (node) => {
      result.push(node);
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    nodes.forEach(traverse);
    // Deduplicera baserat på namn + koordinater
    const seen = new Set();
    return result.filter(n => {
      const key = `${n.name?.trim().toLowerCase()}|${n.metadata?.latitude ?? ''}|${n.metadata?.longitude ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Filtrera trädet baserat på sökning (returnerar både filtered tree och nodes to expand)
  function filterTree(nodes, term) {
    if (!term) return { filtered: nodes, nodesToExpand: new Set() };
    
    const filtered = [];
    const lowerTerm = term.toLowerCase();
    const nodesToExpand = new Set();
    
    const matchesSearch = (node) => {
      return node.name.toLowerCase().includes(lowerTerm);
    };
    
    const filterNode = (node, ancestorIds = []) => {
      const matches = matchesSearch(node);
      
      if (matches) {
        // Om noden matchar: returnera den och ALLA dess barn (explosiv sökning)
        ancestorIds.forEach(id => nodesToExpand.add(id));
        nodesToExpand.add(node.id);
        return node; 
      }

      // Om inte match: kolla om barn matchar
      const filteredChildren = node.children ? node.children.map(child => filterNode(child, [...ancestorIds, node.id])).filter(Boolean) : [];
      
      if (filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        };
      }
      return null;
    };
    
    nodes.forEach(node => {
      const result = filterNode(node);
      if (result) filtered.push(result);
    });
    
    return { filtered, nodesToExpand };
  }
  
  // Auto-expandera noder vid sökning
  useEffect(() => {
    if (searchTerm && tree.length > 0) {
      const { nodesToExpand } = filterTree(tree, searchTerm);
      if (nodesToExpand.size > 0) {
        setExpandedNodes(prev => new Set([...prev, ...nodesToExpand]));
      }
    }
  }, [searchTerm, tree]);

  // Hitta en nod i trädet rekursivt
  function findNodeById(nodes, targetId, parentIds = []) {
    for (const node of nodes) {
      if (node.id === targetId || node.metadata?.id === targetId) {
        return { node, parentIds };
      }
      if (node.children && node.children.length > 0) {
        const result = findNodeById(node.children, targetId, [...parentIds, node.id]);
        if (result) return result;
      }
    }
    return null;
  }

  // Auto-välj och expandera plats när selectedPlaceId sätts från props
  useEffect(() => {
    const selectedPlaceId = catalogState?.selectedPlaceId;
    if (!selectedPlaceId || !tree.length || loading) return;

    const result = findNodeById(tree, selectedPlaceId);
    if (result) {
      const { node, parentIds } = result;
      
      // Expanderar alla föräldranoder så att noden är synlig - städar även här
      const newExpanded = new Set(['root']);
      let hasChanges = false;
      parentIds.forEach(id => {
        if (!newExpanded.has(id)) {
          newExpanded.add(id);
          hasChanges = true;
        }
      });
      if (hasChanges) {
        setExpandedNodes(newExpanded);
      }
      
      // Sätt selectedNode
      setSelectedNode(node);
      const normalizedId = String(selectedPlaceId).trim();
      setSelectedPlaceIds((prev) => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
      
      // Scrolla till noden efter en kort delay (för att vänta på att DOM uppdateras)
      setTimeout(() => {
        const element = document.querySelector(`[data-place-id="${node.id}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Markera temporärt
          element.style.backgroundColor = '#fef08a';
          setTimeout(() => {
            if (element) {
              element.style.transition = 'background-color 1s';
              element.style.backgroundColor = '';
            }
          }, 1000);
        }
      }, 100);
    }
  }, [catalogState?.selectedPlaceId, tree, loading]);

  useEffect(() => {
    if (!flatPlaces.length) return;
    const validIds = new Set(
      flatPlaces
        .map((node) => String(node?.metadata?.id ?? node?.id ?? '').trim())
        .filter((id) => id && id !== 'root')
    );

    setSelectedPlaceIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [flatPlaces]);

  // Expandera nod
  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  // Välj nod
  const handleSelect = (node, event) => {
    setSelectedNode(node);
    const selectedId = node?.metadata?.id ?? node?.id;

    if (selectedId) {
      const normalizedId = String(selectedId).trim();
      const canUseRange = event?.shiftKey && lastSelectedPlaceId;
      const canToggle = event?.ctrlKey || event?.metaKey;

      if (canUseRange) {
        const selectableIds = flatPlaces
          .map((p) => String(p?.metadata?.id ?? p?.id ?? '').trim())
          .filter((id) => id && id !== 'root');
        const startIndex = selectableIds.indexOf(String(lastSelectedPlaceId));
        const endIndex = selectableIds.indexOf(normalizedId);

        if (startIndex >= 0 && endIndex >= 0) {
          const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
          const idsInRange = selectableIds.slice(start, end + 1);
          setSelectedPlaceIds((prev) => Array.from(new Set([...prev, ...idsInRange])));
        } else {
          setSelectedPlaceIds((prev) => Array.from(new Set([...prev, normalizedId])));
        }
      } else if (canToggle) {
        setSelectedPlaceIds((prev) => {
          if (prev.includes(normalizedId)) {
            const next = prev.filter((id) => id !== normalizedId);
            return next.length > 0 ? next : [normalizedId];
          }
          return [...prev, normalizedId];
        });
      } else {
        setSelectedPlaceIds([normalizedId]);
      }

      setLastSelectedPlaceId(normalizedId);
      setMergeMasterId((prev) => prev || normalizedId);
    }

    if (selectedId && setCatalogState) {
      setCatalogState((prev = {}) => ({
        ...prev,
        selectedPlaceId: selectedId,
      }));
    }
  };

  const handleToggleMultiSelect = (node, checked) => {
    const selectedId = String(node?.metadata?.id ?? node?.id ?? '').trim();
    if (!selectedId || selectedId === 'root') return;

    setSelectedNode(node);
    setLastSelectedPlaceId(selectedId);
    setSelectedPlaceIds((prev) => {
      if (checked) return prev.includes(selectedId) ? prev : [...prev, selectedId];
      return prev.filter((id) => id !== selectedId);
    });

    if (setCatalogState) {
      setCatalogState((prev = {}) => ({
        ...prev,
        selectedPlaceId: selectedId,
      }));
    }
  };

  const getPlaceNodeId = (node) => String(node?.metadata?.id ?? node?.id ?? '').trim();

  const getPlaceDisplayName = (node) => {
    if (!node) return 'Okänd plats';
    return formatPlaceName(node) || node.name || String(node?.metadata?.id || node?.id || 'Okänd plats');
  };

  const openMergeDialog = () => {
    if (selectedPlaceIds.length < 2) {
      showStatus && showStatus('Välj minst två platser att slå ihop.', 'warning');
      return;
    }
    setMergeMasterId((prev) => prev || selectedPlaceIds[0]);
    setMergeImpactPreview(null);
    setIsMergeFinalStep(false);
    setIsMergeDialogOpen(true);
  };

  const handleContinueToFinalMergeConfirm = () => {
    const masterPlaceId = String(mergeMasterId || selectedPlaceIds[0] || '').trim();
    if (!masterPlaceId) {
      showStatus && showStatus('Välj en master-plats för merge.', 'error');
      return;
    }

    const mergePlaceIds = Array.from(new Set(selectedPlaceIds));
    const calculate = typeof onCalculateMergeImpact === 'function' ? onCalculateMergeImpact : null;
    const simulated = calculate
      ? calculate({ masterPlaceId, mergePlaceIds })
      : null;

    if (simulated && simulated.success === false) {
      if (simulated.error === 'master-missing') {
        showStatus && showStatus('Välj en master-plats innan merge.', 'error');
      } else if (simulated.error === 'not-enough-places') {
        showStatus && showStatus('Välj minst två olika platser för merge.', 'warning');
      }
      return;
    }

    const fallbackImpact = {
      success: true,
      changedEvents: 0,
      changedMediaFiles: 0,
      removedPlaces: Math.max(0, mergePlaceIds.length - 1),
    };

    setMergeImpactPreview(simulated && simulated.success ? simulated : fallbackImpact);
    setIsMergeFinalStep(true);
  };

  const handleConfirmMerge = async () => {
    if (typeof onMergePlaces !== 'function') return;
    const masterPlaceId = String(mergeMasterId || selectedPlaceIds[0] || '').trim();
    if (!masterPlaceId) {
      showStatus && showStatus('Välj en master-plats för merge.', 'error');
      return;
    }

    const mergePlaceIds = Array.from(new Set(selectedPlaceIds));
    const masterNode = flatPlaces.find((n) => getPlaceNodeId(n) === masterPlaceId);
    const result = onMergePlaces({
      masterPlaceId,
      mergePlaceIds,
      masterPlaceName: getPlaceDisplayName(masterNode),
    });

    if (!result || result.success === false) return;

    setIsMergeDialogOpen(false);
    setIsMergeFinalStep(false);
    setMergeImpactPreview(null);
    setSelectedPlaceIds([masterPlaceId]);
    setMergeMasterId(masterPlaceId);

    if (masterNode) {
      setSelectedNode(masterNode);
      const nextSelectedId = masterNode?.metadata?.id ?? masterNode?.id;
      if (nextSelectedId && setCatalogState) {
        setCatalogState((prev = {}) => ({
          ...prev,
          selectedPlaceId: nextSelectedId,
        }));
      }
    }

    await loadPlaces();
  };

  // Dubbelklick för redigering
  const handleDoubleClick = (node) => {
    setEditingPlace(node);
  };

  // Högermeny
  const handleContextMenu = (e, node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleContextAction = async (action, node) => {
    // Avvakta så att kontextmenyn hinner stängas i DOM innan vi blockerar med native confirm.
    // Annars fryser webbläsaren muspekaren i ett låst läge över sökrutan.
    await new Promise(resolve => setTimeout(resolve, 50));

    switch (action) {
      case 'new':
        setCreatingParent(node);
        break;
      case 'edit':
        setEditingPlace(node);
        break;
      case 'delete': {
        if (!node) {
          showStatus && showStatus('Ingen plats är markerad.', 'error');
          break;
        }

        // Kontrollera om det är en virtuell mapp-nod skapad av trädgeneratorn
        if (!node.metadata?.id && (node.id === 'unspecified' || String(node.id).startsWith('lan-') || String(node.id).startsWith('kom-') || String(node.id).startsWith('for-'))) {
          showStatus && showStatus('Detta är en grupperingsmapp. Du måste markera och radera de enskilda platserna som ligger inuti den.', 'error');
          break;
        }

        if (!node.metadata?.id) {
          showStatus && showStatus('Kan inte radera: saknar ID.', 'error');
          break;
        }
        // Robust check for user place: check all possible locations
        const isUserPlace = (
          node.source === 'user' ||
          node.metadata?.source === 'user' ||
          (node.node && node.node.source === 'user') ||
          (node.node && node.node.metadata?.source === 'user') ||
          // Allow deletion if no source at all (treat as user place)
          (
            node.source === undefined &&
            node.metadata?.source === undefined &&
            (!node.node || (node.node.source === undefined && node.node.metadata?.source === undefined))
          )
        );
        if (!isUserPlace) {
          showStatus && showStatus('Du kan bara radera egna platser.', 'error');
          break;
        }
        setPlaceToDelete(node);
        break;
      }
      case 'copy-id':
        navigator.clipboard.writeText(node.id);
        break;
      case 'copy':
        navigator.clipboard.writeText(JSON.stringify(node, null, 2));
        break;
      case 'paste':
        alert('Klistra in plats (kommer snart)');
        break;
      case 'export':
        exportPlace(node);
        break;
      case 'import':
        fileInputRef.current?.click();
        break;
      default:
        break;
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNode?.metadata?.id) return;
    setIsSavingNote(true);
    try {
      const response = await fetch(`http://127.0.0.1:5005/official_places/${selectedNode.metadata.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteDraft })
      });
      if (!response.ok) throw new Error('Kunde inte spara notering');
      showStatus && showStatus('Notering sparad.');
      await loadPlaces();
    } catch (err) {
      showStatus && showStatus('Kunde inte spara notering.', 'error');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Exportera plats till JSON
  const exportPlace = (node) => {
    const dataStr = JSON.stringify(node, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `place-${node.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Spara platsredigering
  // Endast användarplatser får sparas/ändras
  const handleSavePlace = async (formData) => {
    if (!editingPlace || !editingPlace.metadata?.id) {
      throw new Error('Ingen plats vald för redigering');
    }
    // Blockera ändring av referensplatser
    if (!editingPlace.metadata.source || editingPlace.metadata.source === 'reference-sweden' || editingPlace.metadata.source === 'reference-usa') {
      showStatus && showStatus('❌ Du kan inte ändra officiella/referensplatser. Skapa en ny plats om du vill göra ändringar.', 'error');
      return;
    }
    // Spara till dbData.places
    setDbData(prev => {
      const places = Array.isArray(prev.places) ? prev.places : [];
      let updated = false;
      
      const updatedPlace = {
        ...formData,
        id: editingPlace.metadata.id,
        source: 'user',
        type: formData.type, // Spara typ även på toppnivå
        metadata: {
          ...formData,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          note: formData.note || '',
          type: formData.type // Spara typ även i metadata
        }
      };

      const newPlaces = places.map(p => {
        if (p.id === editingPlace.metadata.id) {
          updated = true;
          return updatedPlace;
        }
        return p;
      });
      if (!updated) newPlaces.push(updatedPlace);
      return { ...prev, places: newPlaces };
    });
    
    // Uppdatera lokal state direkt så det syns omedelbart
    setPlaces(prev => {
      let updated = false;
      const updatedPlace = {
        ...formData,
        id: editingPlace.metadata.id,
        source: 'user',
        type: formData.type,
        metadata: {
          ...formData,
          latitude: formData.latitude || null,
          longitude: formData.longitude || null,
          note: formData.note || '',
          type: formData.type
        }
      };
      const newPlaces = prev.map(p => {
        if (p.id === editingPlace.metadata.id) {
          updated = true;
          return updatedPlace;
        }
        return p;
      });
      if (!updated) newPlaces.push(updatedPlace);
      return newPlaces;
    });

    showStatus && showStatus('Plats sparad.');
    // Ingen loadPlaces() här för att undvika frysning/flash, dbData synkar automatiskt
  };

  // Skapa ny plats
  // Skapa ny plats: endast till dbData.places
  const handleCreatePlace = async (formData) => {
    const parentNode = flatPlaces.find(p => (p.id === formData.parentid || p.metadata?.id === formData.parentid));
    const pm = parentNode?.metadata || {};
    
    // Kopiera f�r�lderns platshierarki
    // Kopiera hierarki robust
    const inheritedFields = {
      lansnamn: pm.lansnamn || pm.region || '',
      lanskod: pm.lanskod || '',
      kommunnamn: pm.kommunnamn || pm.municipality || '',
      kommunkod: pm.kommunkod || '',
      sockenstadnamn: pm.sockenstadnamn || pm.parish || ''
    };

    // Fallback för virtuella noder
    if (parentNode?.type === 'Parish' && !inheritedFields.sockenstadnamn) {
      inheritedFields.sockenstadnamn = parentNode.name.replace(/\s*församling$/i, '').replace(/\s*socken$/i, '').trim();
    }
    if (parentNode?.type === 'Municipality' && !inheritedFields.kommunnamn) {
      inheritedFields.kommunnamn = parentNode.name.replace(/\s*kommun$/i, '').trim();
    }

    const tempId = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const newPlace = {
      ...inheritedFields,
      ...formData,
      id: tempId,
      source: 'user',
      type: formData.type,
      metadata: {
        ...inheritedFields,
        ...formData,
        id: tempId,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        note: formData.note || '',
        type: formData.type
      }
    };

    setDbData(prev => {
      const placesList = Array.isArray(prev.places) ? prev.places : [];
      return { ...prev, places: [...placesList, newPlace] };
    });
    
    setPlaces(prev => [...prev, newPlace]);
    setPendingFocusId(tempId);

    showStatus && showStatus('Ny plats skapad.');
    setSearchTerm('');
    setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    }, 100);
  };

  // Drag & Drop i trädet
  const handleDragStart = (e, node) => {
    setDraggingNode(node);
    e.dataTransfer.setData('sourceId', node.id);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragOver = (e, node) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetNode) => {
    e.preventDefault();
    if (!draggingNode || draggingNode.id === targetNode.id) return;

    // Vi tillåter bara att flytta till noder som INTE är löv eller egna platser (förutom om man vill stapla)
    // Men i detta fall: flytta under mål-noden
    setMoveConfirmation({
      source: draggingNode,
      target: targetNode
    });
  };

  const handleConfirmMove = () => {
    if (!moveConfirmation) return;
    const { source, target } = moveConfirmation;
    setMoveConfirmation(null);
    setDraggingNode(null);

    const originalDbData = dbData;
    const originalPlaces = places;

    // Hitta målhierarki
    const m = target.metadata || {};
    const updatedHierarchy = {
      lansnamn: m.lansnamn || m.region || '',
      lanskod: m.lanskod || '',
      kommunnamn: m.kommunnamn || m.municipality || '',
      kommunkod: m.kommunkod || '',
      sockenstadnamn: m.sockenstadnamn || m.parish || '',
      parentid: target.metadata?.id || target.id
    };

    const targetId = source.metadata?.id || source.id;

    // Uppdatera dbData
    setDbData(prev => {
      const pList = Array.isArray(prev.places) ? prev.places : [];
      return {
        ...prev,
        places: pList.map(p => {
          if (p.id === targetId || p.metadata?.id === targetId) {
            return {
              ...p,
              ...updatedHierarchy,
              metadata: {
                ...p.metadata,
                ...updatedHierarchy
              }
            };
          }
          return p;
        })
      };
    });

    // Uppdatera places omedelbart
    setPlaces(prev => prev.map(p => {
      if (p.id === targetId || p.metadata?.id === targetId) {
        return {
          ...p,
          ...updatedHierarchy,
          metadata: {
            ...p.metadata,
            ...updatedHierarchy
          }
        };
      }
      return p;
    }));

    setPendingFocusId(targetId);

    if (showUndoToast) {
      showUndoToast(`Flyttade "${source.name}" till under "${target.name}".`, () => {
        setDbData(originalDbData);
        setPlaces(originalPlaces);
      });
    }
  };

  const handleSaveSidePanel = () => {
    if (!selectedNode) return;
    
    const originalDbData = dbData;
    const originalPlaces = places;
    const targetId = selectedNode.metadata?.id || selectedNode.id;

    // Skapa det uppdaterade objektet
    const updatedMetadata = {
      ...(selectedNode.metadata || {}),
      ortnamn: sidePanelForm.name,
      name: sidePanelForm.name,
      type: sidePanelForm.type,
      latitude: sidePanelForm.latitude ? parseFloat(sidePanelForm.latitude) : null,
      longitude: sidePanelForm.longitude ? parseFloat(sidePanelForm.longitude) : null,
      source: selectedNode.metadata?.source || 'user_override' // Markera som användarens data
    };

    // 1. Uppdatera dbData (personliga databasen)
    setDbData(prev => {
      const pList = Array.isArray(prev.places) ? prev.places : [];
      const existsInDb = pList.some(p => String(p.id) === String(targetId) || String(p.metadata?.id) === String(targetId));

      if (existsInDb) {
        // Om den redan finns i db, uppdatera den
        return {
          ...prev,
          places: pList.map(p => {
            if (String(p.id) === String(targetId) || String(p.metadata?.id) === String(targetId)) {
              return { ...p, ...updatedMetadata, metadata: updatedMetadata };
            }
            return p;
          })
        };
      } else {
        // Om den är officiell och saknas i db, lägg till som ny (Override)
        const newEntry = {
          id: targetId,
          ...updatedMetadata,
          metadata: updatedMetadata
        };
        return {
          ...prev,
          places: [...pList, newEntry]
        };
      }
    });

    // 2. Uppdatera lokala places-listan för omedelbar respons
    setPlaces(prev => {
      const existsInPlaces = prev.some(p => String(p.id) === String(targetId));
      if (existsInPlaces) {
        return prev.map(p => {
          if (String(p.id) === String(targetId)) {
            return { ...p, ...updatedMetadata, metadata: updatedMetadata, name: sidePanelForm.name, type: sidePanelForm.type };
          }
          return p;
        });
      } else {
        // Detta borde inte hända om trädvyn är korrekt, men för säkerhets skull:
        return [...prev, { id: targetId, ...updatedMetadata, metadata: updatedMetadata, name: sidePanelForm.name, type: sidePanelForm.type }];
      }
    });

    setHasUnsavedChanges(false);
    showStatus && showStatus(`Ändringar sparade för "${sidePanelForm.name}".`);
  };

  // Importera XML-fil
  const handleImportXML = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      // TODO: Implementera XML-parsering och backend-anrop här.
      // Denna funktion var korrupt och har återställts för att fixa syntaxfelet.
      alert("XML-import är inte implementerad än.");
    } catch (err) {
      alert('Kunde inte importera XML-fil: ' + err.message);
      console.error('Import error:', err);
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Bygg breadcrumbs (sökväg)
  const getPath = (nodes, targetId, path = []) => {
    if (!Array.isArray(nodes)) return null;
    for (const node of nodes) {
      if (node.id === targetId) return [...path, node.name];
      if (node.children) {
        const result = getPath(node.children, targetId, [...path, node.name]);
        if (result) return result;
      }
    }
    return null;
  };

  const breadcrumbs = selectedNode ? (getPath(tree, selectedNode.id || selectedNode.metadata?.id) || []) : [];
  
  // Sortera och filtrera trädet
  const sortTree = (nodes) => {
    if (!nodes || nodes.length === 0) return nodes;
    const sorted = [...nodes].sort((a, b) => {
      if (sortOrder === 'name-asc') return (a.name || '').localeCompare(b.name || '', 'sv');
      if (sortOrder === 'name-desc') return (b.name || '').localeCompare(a.name || '', 'sv');
      if (sortOrder === 'type') return (a.type || '').localeCompare(b.type || '');
      return 0;
    });
    return sorted.map(node => ({
      ...node,
      children: node.children ? sortTree(node.children) : []
    }));
  };
  
  let displayTree = tree;
  if (searchTerm) {
    const { filtered } = filterTree(tree, searchTerm);
    displayTree = filtered;
  }
  displayTree = sortTree(displayTree);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="bg-surface border-b border-subtle px-4 py-2 flex items-center gap-2 shadow-sm">
        <button 
          className="px-3 py-1 bg-accent text-on-accent text-sm rounded hover:bg-accent font-medium"
          onClick={() => setCreatingParent(selectedNode || tree[0])}
        >
          ➕ Ny
        </button>
        <button 
          className="px-3 py-1 bg-surface-2 text-secondary text-sm rounded hover:bg-surface font-medium"
          onClick={() => editingPlace ? setEditingPlace(null) : (selectedNode && setEditingPlace(selectedNode))}
          disabled={!selectedNode}
        >
          ✏️ Redigera
        </button>
        <button 
          className="px-3 py-1 bg-red-600 text-red-100 text-sm rounded hover:bg-red-700 font-medium"
          onClick={() => alert('Radera (kommer snart)')}
          disabled={!selectedNode}
        >
          🗑️ Radera
        </button>

        {!onPick && !isDrawerMode && typeof onMergePlaces === 'function' && (
          <button
            className="px-3 py-1 bg-amber-600 text-amber-100 text-sm rounded hover:bg-amber-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={openMergeDialog}
            disabled={selectedPlaceIds.length < 2}
            title="Slå ihop valda platser"
          >
            🔀 Slå ihop platser
          </button>
        )}
        
        <div className="flex-1" />
        
          <input
            type="text"
            placeholder="Sök plats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-subtle bg-background text-primary rounded px-3 py-1 text-sm w-64 focus:border-accent focus:outline-none"
            ref={searchInputRef}
          />
        
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border border-subtle bg-background text-on-accent rounded px-3 py-1 text-sm focus:border-accent focus:outline-none"
        >
          <option value="name-asc">Namn (A-Ö)</option>
          <option value="name-desc">Namn (Ö-A)</option>
          <option value="type">Typ</option>
        </select>
        
        <button 
          className="px-3 py-1 bg-green-600 text-green-100 text-sm rounded hover:bg-green-500 font-medium"
          onClick={() => fileInputRef.current?.click()}
        >
          📥 Importera
        </button>
        <button 
          className="px-3 py-1 bg-accent text-on-accent text-sm rounded hover:bg-accent font-medium"
          onClick={() => selectedNode && exportPlace(selectedNode)}
          disabled={!selectedNode}
        >
          📤 Exportera
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          className="hidden"
          onChange={handleImportXML}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tree View */}
        <div className="w-1/3 min-w-[300px] border-r border-subtle flex flex-col bg-surface">
          <div className="p-2 bg-surface border-b border-subtle text-xs font-bold uppercase text-secondary">
            Platsstruktur
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="text-center text-muted mt-8">Laddar platser...</div>
            ) : error ? (
              <div className="text-center text-red-500 mt-8">Fel: {error}</div>
            ) : displayTree.length === 0 ? (
              <div className="text-center text-muted mt-8">Inga platser funna</div>
            ) : (
              displayTree.map(node => (
                <TreeNode 
                  key={node.id} 
                  node={node} 
                  level={0} 
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  selectedNodeId={selectedNode?.id}
                  selectedNodeIds={selectedPlaceIdSet}
                  onSelect={handleSelect}
                  onToggleMultiSelect={handleToggleMultiSelect}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={handleDoubleClick}
                  highlightTerm={searchTerm}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                />
              ))
            )}
          </div>
          {/* Pil/knapp för att visa/dölja kartan */}
          <div className="border-t border-subtle bg-background" style={{ padding: '0.25em 0.5em', display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => setShowMap(v => !v)}>
            <span style={{ fontSize: '1.2em', marginRight: 8 }}>{showMap ? '▼' : '▲'}</span>
            <span style={{ fontSize: 13, color: '#888' }}>Karta</span>
          </div>
          {showMap && (
            <div style={{ height: '16em', borderTop: '1px solid #eee' }}>
              {mapPlaces.length > 0 ? (
                <MapContainer
                  center={selectedCoordinates || mapPlaces[0].coordinates || DEFAULT_MAP_CENTER}
                  zoom={selectedCoordinates ? 9 : 5}
                  className="h-full w-full"
                  scrollWheelZoom={true}
                  whenCreated={mapInstance => { leafletMapRef.current = mapInstance; }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapSelectionSync
                    center={selectedCoordinates}
                    zoom={selectedCoordinates ? 10 : 5}
                  />
                  {mapPlaces.map((place) => {
                    const isSelected = selectedNode && (String(place.id) === String(selectedNode?.metadata?.id || selectedNode?.id));
                    const isUserPlace = (place.source === 'user' || place.metadata?.source === 'user');
                    return (
                      <Marker
                        key={`${place.id}-${place.node.id}`}
                        position={place.coordinates}
                        icon={isSelected ? redIcon : blueIcon}
                        draggable={isUserPlace}
                        eventHandlers={{
                          click: () => handleSelect(place.node),
                          dragend: (e) => {
                            if (!isUserPlace) return;
                            const { lat, lng } = e.target.getLatLng();
                            const targetId = place.metadata?.id || place.id;

                            // 1. Uppdatera dbData för permanent lagring i filen
                            setDbData(prev => {
                              const pList = Array.isArray(prev.places) ? prev.places : [];
                              return {
                                ...prev,
                                places: pList.map(p => {
                                  if (String(p.id) === String(targetId) || String(p.metadata?.id) === String(targetId)) {
                                    return {
                                      ...p,
                                      latitude: lat,
                                      longitude: lng,
                                      metadata: {
                                        ...(p.metadata || {}),
                                        latitude: lat,
                                        longitude: lng
                                      }
                                    };
                                  }
                                  return p;
                                })
                              };
                            });

                            // 2. Uppdatera places för omedelbar respons i trädet
                            setPlaces(prev => prev.map(p => {
                              if (String(p.id) === String(targetId) || String(p.metadata?.id) === String(targetId)) {
                                return {
                                  ...p,
                                  latitude: lat,
                                  longitude: lng,
                                  metadata: {
                                    ...(p.metadata || {}),
                                    latitude: lat,
                                    longitude: lng
                                  }
                                };
                              }
                              return p;
                            }));

                            showStatus && showStatus(`Koordinater uppdaterade för ${place.name}`);
                          },
                        }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <div className="font-semibold">{place.name}</div>
                            <div className="text-slate-600">
                              {place.coordinates[0].toFixed(5)}, {place.coordinates[1].toFixed(5)}
                            </div>
                            {isUserPlace && <div className="mt-2 text-xs text-muted">(Dragga för att ändra position)</div>}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted px-3 text-center">
                  Inga platser med giltiga koordinater att visa på kartan.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Details Panel */}
        <div className="flex-1 bg-surface flex flex-col overflow-hidden">
          {selectedNode ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold text-on-accent mb-1">{selectedNode.name}</h1>
                    <p className="text-muted italic">
                      {PLACE_TYPE_LABELS[selectedNode.type] || 'Platsinformation saknas'}
                    </p>
                  </div>
                </div>

                {/* Tabbar */}
                <div className="flex border-b mt-4 bg-background rounded-t-lg shadow-sm">
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'info' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                    onClick={() => setActiveRightTab('info')}
                    title="Information"
                  >
                    <span className="text-lg" role="img" aria-label="Info">ℹ️</span>
                    Info
                    {activeRightTab === 'info' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'riksarkivet' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                    onClick={() => setActiveRightTab('riksarkivet')}
                    title="Riksarkivet"
                  >
                    <span className="text-lg" role="img" aria-label="Riksarkivet">🏛️</span>
                    Riksarkivet
                    {activeRightTab === 'riksarkivet' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'images' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                    onClick={() => setActiveRightTab('images')}
                    title="Bilder"
                  >
                    <span className="text-lg" role="img" aria-label="Bilder">🖼️</span>
                    Bilder
                    {activeRightTab === 'images' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'notes' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                    onClick={() => setActiveRightTab('notes')}
                    title="Noteringar"
                  >
                    <span className="text-lg" role="img" aria-label="Noteringar">📝</span>
                    Noteringar
                    {activeRightTab === 'notes' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'connections' ? 'border-accent text-accent bg-surface shadow -mb-px' : 'border-transparent text-muted hover:text-accent hover:bg-surface-2'}`}
                    onClick={() => setActiveRightTab('connections')}
                    title="Kopplingar"
                  >
                    <span className="text-lg" role="img" aria-label="Kopplingar">👥</span>
                    Kopplingar
                    {activeRightTab === 'connections' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {activeRightTab === 'info' && selectedNode && (
                  <div className="flex flex-col gap-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Namn på platsen</label>
                      <input
                        className="w-full bg-background border border-subtle rounded px-3 py-2 text-sm text-primary focus:ring-2 focus:ring-accent outline-none transition-all shadow-inner"
                        value={sidePanelForm.name}
                        onChange={(e) => {
                          setSidePanelForm(prev => ({ ...prev, name: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Namn..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Platstyp</label>
                      <select
                        className="w-full bg-background border border-subtle rounded px-3 py-2 text-sm text-primary focus:ring-2 focus:ring-accent outline-none transition-all cursor-pointer shadow-inner"
                        value={sidePanelForm.type}
                        onChange={(e) => {
                          setSidePanelForm(prev => ({ ...prev, type: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                      >
                        {[
                          'Country', 'Province', 'County', 'Municipality', 'Parish', 
                          'Village', 'Farm', 'Cottage', 'Hundred', 'Building', 
                          'Cemetary', 'Address', 'default'
                        ].map(val => (
                          <option key={val} value={val}>
                            {PLACE_TYPE_ICONS[val] || '📍'} {PLACE_TYPE_LABELS[val] || val}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="bg-surface-2 p-4 rounded-lg border border-subtle">
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-3 border-b border-subtle pb-1">Geografisk Position</label>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-[10px] font-medium text-muted mb-1 ml-1 uppercase">Latitud</label>
                          <input
                            type="text"
                            className="w-full bg-background border border-subtle rounded px-3 py-2 text-sm text-primary font-mono focus:ring-2 focus:ring-accent outline-none shadow-inner"
                            value={sidePanelForm.latitude}
                            onChange={(e) => {
                              setSidePanelForm(prev => ({ ...prev, latitude: e.target.value }));
                              setHasUnsavedChanges(true);
                            }}
                            placeholder="T.ex. 55.60"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-medium text-muted mb-1 ml-1 uppercase">Longitud</label>
                          <input
                            type="text"
                            className="w-full bg-background border border-subtle rounded px-3 py-2 text-sm text-primary font-mono focus:ring-2 focus:ring-accent outline-none shadow-inner"
                            value={sidePanelForm.longitude}
                            onChange={(e) => {
                              setSidePanelForm(prev => ({ ...prev, longitude: e.target.value }));
                              setHasUnsavedChanges(true);
                            }}
                            placeholder="T.ex. 13.00"
                          />
                        </div>
                      </div>
                      
                      {selectedNode.metadata?.latitude && selectedNode.metadata?.longitude && (
                        <button
                          className="mt-3 w-full py-1.5 px-3 bg-surface text-accent text-xs rounded border border-accent/30 hover:bg-accent/10 transition-colors flex items-center justify-center gap-2 font-semibold"
                          onClick={() => flyToCoordinates([parseFloat(selectedNode.metadata.latitude), parseFloat(selectedNode.metadata.longitude)])}
                        >
                          🌍 Visa nuvarande position på karta
                        </button>
                      )}
                    </div>

                    {hasUnsavedChanges && (
                      <div className="mt-4 pt-4 border-t border-subtle animate-in slide-in-from-bottom-2 duration-300">
                        <button
                          className="w-full py-3 px-4 bg-accent text-on-accent rounded-lg font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                          onClick={handleSaveSidePanel}
                        >
                          💾 Spara ändringar
                        </button>
                        <p className="text-[10px] text-center text-muted mt-2 uppercase tracking-tighter">
                          Ändringarna sparas i din lokala databas
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {activeRightTab === 'riksarkivet' && (
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-lg font-bold text-primary">Riksarkivet</h3>
                      <button
                        className="px-3 py-1.5 bg-accent text-on-accent rounded hover:bg-accent font-medium disabled:opacity-60"
                        onClick={handleSearchRiksarkivet}
                        disabled={riksarkivetLoading || !selectedNode}
                      >
                        {riksarkivetLoading ? 'Söker...' : 'Sök kyrkoarkiv på Riksarkivet'}
                      </button>
                    </div>
                    {riksarkivetLoading && <div>Laddar från Riksarkivet...</div>}
                    {riksarkivetError && (
                      <div className="text-red-400">
                        {riksarkivetError}
                        <div className="text-muted mt-2 text-sm">
                          Riksarkivets Sök-API verkar vara otillgängligt just nu.<br />
                          Detta är ett problem hos Riksarkivet, inte i din app.<br />
                          Försök igen senare. Om felet kvarstår, kontrollera <a href="https://sok.riksarkivet.se/" target="_blank" rel="noopener noreferrer" className="underline text-accent">Riksarkivets webbsida</a> för driftstatus.
                        </div>
                      </div>
                    )}
                    {riksarkivetResults && riksarkivetResults.length > 0 ? (
                      <div className="space-y-3">
                        {riksarkivetResults.map((group) => (
                          <div key={group.id} className="bg-background border border-subtle rounded p-3">
                            <div className="font-semibold text-primary mb-2">{group.label}</div>
                            <ul className="space-y-1">
                              {(group.children || []).map((rec) => (
                                <li key={rec.id} className="flex items-center justify-between gap-2 text-sm border-b border-subtle/40 py-1 last:border-0">
                                  <div className="min-w-0">
                                    <div className="text-primary truncate">{rec.title}</div>
                                    <div className="text-xs text-muted truncate">
                                      {rec.nad ? `NAD: ${rec.nad}` : 'NAD saknas'}
                                    </div>
                                  </div>
                                  <button
                                    className="shrink-0 px-2 py-1 rounded bg-surface-2 text-accent hover:bg-surface border border-subtle"
                                    title="Skapa master-källa från volym"
                                    onClick={() => handleCreateSourceFromRiksarkivetVolume(rec)}
                                  >
                                    +
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      riksarkivetSearched && !riksarkivetLoading && <div>Inga träffar från Riksarkivet.</div>
                    )}
                  </div>
                )}
                {activeRightTab === 'images' && (
                  <div className="max-w-3xl mx-auto">
                    <h3 className="text-lg font-bold text-primary mb-3">Bilder</h3>
                    <div className="text-sm text-muted italic bg-background border border-subtle rounded p-4">
                      Inga bilder är kopplade till denna plats ännu.
                    </div>
                  </div>
                )}
                {activeRightTab === 'notes' && (
                  <div className="max-w-3xl mx-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-primary">Noteringar</h3>
                      <button
                        className="px-3 py-1 bg-accent text-on-accent rounded hover:bg-accent font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                      >
                        {isSavingNote ? 'Sparar...' : 'Spara'}
                      </button>
                    </div>
                    <Editor
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      containerProps={{ style: { minHeight: '200px' } }}
                    />
                  </div>
                )}
                {activeRightTab === 'connections' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-secondary uppercase">Kopplade Personer</h3>
                      <span className="text-xs text-muted">{linkedPeople.length} {linkedPeople.length === 1 ? 'person' : 'personer'}</span>
                    </div>
                    <div className="bg-background rounded-md border border-subtle overflow-hidden">
                      {linkedPeople.length > 0 ? (
                        linkedPeople.map((link) => {
                          const person = link.person || allPeople.find(p => p.id === link.personId);
                          if (!person) {
                            // Fallback om personen inte hittas
                            return (
                              <div key={`${link.personId}-${link.eventId}`} className="flex items-center justify-between bg-background p-2 rounded border border-subtle text-xs">
                                <div><span className="text-primary font-medium block">Okänd person</span></div>
                              </div>
                            );
                          }
                          
                          // Extrahera födelse- och dödsdata från events (samma format som MediaManager)
                          const birthEvent = person.events?.find(e => e.type === 'Födelse');
                          const deathEvent = person.events?.find(e => e.type === 'Död');
                          
                          const birthDate = birthEvent?.date || '';
                          const birthPlace = birthEvent?.place || '';
                          const deathDate = deathEvent?.date || '';
                          const deathPlace = deathEvent?.place || '';
                          
                          // Formatera kön (samma format som EditPersonModal)
                          const sex = person.gender || person.sex || 'U';
                          const sexLabel = sex === 'M' || sex === 'Man' ? 'M' : sex === 'K' || sex === 'Kvinna' || sex === 'F' ? 'F' : 'U';
                          
                          // Hämta profilbild (samma logik som MediaManager)
                          const primaryMedia = person.media && person.media.length > 0 ? person.media[0] : null;
                          const profileImage = primaryMedia ? (primaryMedia.url || primaryMedia.path) : null;
                          
                          return (
                            <div 
                              key={`${link.personId}-${link.eventId}`} 
                              className="flex items-start gap-2 bg-background p-2 rounded border border-subtle text-xs cursor-pointer hover:bg-surface transition-colors"
                              onClick={() => {
                                if (onOpenEditModal) {
                                  onOpenEditModal(link.personId);
                                }
                              }}
                            >
                              {/* Rund thumbnail (samma som MediaManager) */}
                              <div className="w-10 h-10 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong">
                                {profileImage ? (
                                  <MediaImage 
                                    url={profileImage}
                                    alt={`${person.firstName} ${person.lastName}`} 
                                    className="w-full h-full object-cover"
                                    style={getAvatarImageStyle(primaryMedia, person.id)}
                                  />
                                ) : (
                                  <User className="w-full h-full p-2 text-muted" />
                                )}
                              </div>
                              
                              {/* Personinfo */}
                              <div className="flex-1 min-w-0">
                                {/* Namn */}
                                <div className="text-primary font-medium mb-0.5">
                                  {person.firstName} {person.lastName}
                                </div>
                                
                                {/* Eventtyp och datum */}
                                <div className="text-[10px] text-muted mb-0.5">
                                  {link.eventType}
                                  {link.eventDate && ` (${link.eventDate})`}
                                </div>
                                
                                {/* Födelsedatum och plats */}
                                {(birthDate || birthPlace) && (
                                  <div className="text-[10px] text-muted mb-0.5">
                                    * {birthDate || '????-??-??'} {birthPlace && ` ${birthPlace}`} ({sexLabel})
                                  </div>
                                )}
                                
                                {/* Dödsdatum och plats */}
                                {(deathDate || deathPlace) && (
                                  <div className="text-[10px] text-muted">
                                    + {deathDate || '????-??-??'} {deathPlace && ` ${deathPlace}`} ({sexLabel})
                                  </div>
                                )}
                                
                                {/* Om inga datum finns */}
                                {!birthDate && !deathDate && (
                                  <div className="text-[10px] text-muted italic">
                                    Inga datum registrerade
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 text-sm text-muted italic">
                          Inga personer kopplade till denna plats.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted">
              Välj en plats i listan till vänster för att se detaljer.
            </div>
          )}
        </div>
      </div>

      {/* Footer: Picker actions or Breadcrumbs */}
      {onPick ? (
        <div className="h-10 bg-surface border-t border-subtle flex items-center justify-end gap-2 px-3">
          <button className="px-3 py-1 bg-surface-2 text-primary rounded hover:bg-surface font-medium" onClick={() => onClose && onClose()}>Avbryt</button>
          <button className="px-3 py-1 bg-accent text-on-accent rounded hover:bg-accent font-medium disabled:opacity-50" disabled={!selectedNode} onClick={() => selectedNode && onPick(selectedNode)}>OK</button>
        </div>
      ) : isDrawerMode && onLinkPlace ? (
        <div className="h-10 bg-surface border-t border-subtle flex items-center justify-end gap-2 px-3">
          <button 
            className="px-3 py-1 bg-green-600 text-on-accent rounded hover:bg-green-500 font-medium disabled:opacity-50 disabled:bg-green-900" 
            disabled={!selectedNode} 
            onClick={() => selectedNode && onLinkPlace(selectedNode)}
          >
            ✓ Koppla plats
          </button>
        </div>
      ) : (
        <div className="h-8 bg-background text-secondary flex items-center px-4 text-xs border-t border-subtle">
          {(breadcrumbs || []).length > 0 ? (
            <span>{(breadcrumbs || []).join(' › ')}</span>
          ) : (
            <span>Ingen plats vald</span>
          )}
        </div>
      )}

      {placeToDelete && !isDrawerMode && (
        <div className="fixed inset-0 z-[12000] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface border border-subtle rounded-lg shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">Bekräfta radering</h3>
              <button
                className="text-secondary hover:text-primary"
                onClick={() => setPlaceToDelete(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {linkedPeople && linkedPeople.length > 0 && selectedNode && selectedNode.metadata?.id === placeToDelete.metadata?.id ? (
                <p className="text-sm text-secondary">
                  Det finns {linkedPeople.length} personer kopplade till platsen.<br/>
                  Vill du ändå radera "{placeToDelete.name}"?
                </p>
              ) : (
                <p className="text-sm text-secondary">
                  Vill du verkligen radera "{placeToDelete.name}"?
                </p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-subtle flex items-center justify-end gap-2">
              <button
                className="px-3 py-1 bg-surface-2 text-primary rounded hover:bg-surface"
                onClick={() => setPlaceToDelete(null)}
              >
                Avbryt
              </button>
              <button
                className="px-3 py-1 bg-red-600 text-red-100 rounded hover:bg-red-500 font-medium"
                onClick={async () => {
                  const node = placeToDelete;
                  setPlaceToDelete(null);

                  const originalDbData = dbData;
                  const originalSelectedNode = selectedNode;
                  const originalPlaces = places;

                  const targetDeleteId = node.metadata?.id || node.id;

                  // Hitta förälder för att flytta fokus
                  let parentNode = null;
                  const m = node.metadata || {};
                  if (m.parentid || m.parish_id || m.municipality_id || m.region_id) {
                    const pid = m.parentid || m.parish_id || m.municipality_id || m.region_id;
                    parentNode = flatPlaces.find(p => p.id === pid || p.metadata?.id === pid);
                  }
                  
                  // Om vi inte hittade via metadata, försök via trädstrukturen
                  if (!parentNode && tree) {
                    const findParent = (nodes, targetId, parent = null) => {
                      for (const n of nodes) {
                        if (n.id === targetId) return parent;
                        if (n.children) {
                          const res = findParent(n.children, targetId, n);
                          if (res) return res;
                        }
                      }
                      return null;
                    };
                    parentNode = findParent(tree, node.id);
                  }

                  // Flytta fokus till förälder
                  if (parentNode) {
                    setSelectedNode(parentNode);
                  } else {
                    setSelectedNode(null);
                  }

                  // Utför radering lokalt
                  setDbData(prev => {
                    const pList = Array.isArray(prev.places) ? prev.places : [];
                    return { 
                      ...prev, 
                      places: pList.filter(p => p.id !== targetDeleteId && p.metadata?.id !== targetDeleteId) 
                    };
                  });
                  setPlaces(prev => prev.filter(p => {
                    const pid = p.metadata?.id || p.id;
                    return pid !== targetDeleteId;
                  }));

                  // Visa Undo-toast
                  if (showUndoToast) {
                    showUndoToast(`Platsen "${node.name}" raderad.`, () => {
                      setDbData(originalDbData);
                      setSelectedNode(originalSelectedNode);
                      setPlaces(originalPlaces);
                    });
                  }

                  // Fördröj radering från backend i 10 sekunder (matchar toast-tid)
                  setTimeout(async () => {
                    try {
                      await fetch(`http://127.0.0.1:5005/place/${targetDeleteId}`, { method: 'DELETE' });
                    } catch (err) {
                      console.error('Kunde inte radera plats från backend:', err);
                    }
                  }, 10500);
                }}
              >
                Ja, radera
              </button>
            </div>
          </div>
        </div>
      )}

      {isMergeDialogOpen && !isDrawerMode && (
        <div className="fixed inset-0 z-[12000] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-surface border border-subtle rounded-lg shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary">Slå ihop platser</h3>
              <button
                className="text-secondary hover:text-primary"
                onClick={() => {
                  setIsMergeDialogOpen(false);
                  setIsMergeFinalStep(false);
                  setMergeImpactPreview(null);
                }}
                aria-label="Stäng merge-dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {!isMergeFinalStep ? (
                <>
                  <p className="text-sm text-secondary">
                    Välj vilken plats som ska vara master. Alla referenser i personer och media flyttas till master, och övriga valda platser tas bort.
                  </p>
                  <div className="space-y-2">
                    {selectedPlaceIds.map((id) => {
                      const node = flatPlaces.find((n) => getPlaceNodeId(n) === id);
                      const label = `${getPlaceDisplayName(node)} (${id})`;
                      return (
                        <label key={id} className="flex items-center gap-2 p-2 rounded border border-subtle hover:bg-surface-2 cursor-pointer">
                          <input
                            type="radio"
                            name="merge-master-place"
                            checked={mergeMasterId === id}
                            onChange={() => setMergeMasterId(id)}
                          />
                          <span className="text-sm text-primary">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-secondary">
                    Sista kontroll innan sammanslagning.
                  </p>
                  <div className="p-3 rounded border border-amber-500/40 bg-amber-900/20 text-sm text-amber-100 space-y-1">
                    <p>
                      Sammanslagningen kommer att flytta {mergeImpactPreview?.changedEvents ?? 0} händelser och {mergeImpactPreview?.changedMediaFiles ?? 0} mediefiler till {getPlaceDisplayName(flatPlaces.find((n) => getPlaceNodeId(n) === mergeMasterId))}, och därefter radera {mergeImpactPreview?.removedPlaces ?? Math.max(0, selectedPlaceIds.length - 1)} dubblett-platser.
                    </p>
                    <p>Vill du fortsätta?</p>
                  </div>
                </>
              )}
            </div>

            <div className="px-4 py-3 border-t border-subtle flex items-center justify-end gap-2">
              <button
                className="px-3 py-1 bg-surface-2 text-primary rounded hover:bg-surface"
                onClick={() => {
                  setIsMergeDialogOpen(false);
                  setIsMergeFinalStep(false);
                  setMergeImpactPreview(null);
                }}
              >
                Avbryt
              </button>
              {!isMergeFinalStep ? (
                <button
                  className="px-3 py-1 bg-amber-600 text-amber-100 rounded hover:bg-amber-500 font-medium disabled:opacity-50"
                  onClick={handleContinueToFinalMergeConfirm}
                  disabled={!mergeMasterId || selectedPlaceIds.length < 2}
                >
                  Gå vidare
                </button>
              ) : (
                <>
                  <button
                    className="px-3 py-1 bg-surface-2 text-primary rounded hover:bg-surface"
                    onClick={() => setIsMergeFinalStep(false)}
                  >
                    Tillbaka
                  </button>
                  <button
                    className="px-3 py-1 bg-amber-600 text-amber-100 rounded hover:bg-amber-500 font-medium disabled:opacity-50"
                    onClick={handleConfirmMerge}
                    disabled={!mergeMasterId || selectedPlaceIds.length < 2}
                  >
                    Slutför sammanslagning
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Edit Modal */}
      {editingPlace && (
        <WindowFrame title={`Redigera: ${editingPlace.name}`} onClose={() => setEditingPlace(null)}>
          <PlaceEditModal
            place={editingPlace}
            onClose={() => setEditingPlace(null)}
            onSave={handleSavePlace}
          />
        </WindowFrame>
      )}

      {/* Create Modal */}
      {creatingParent && (
        <WindowFrame 
          title="Skapa ny plats" 
          onClose={() => setCreatingParent(null)}
          subtitle={getPath(tree, creatingParent.id)?.join(' / ')}
        >
          <PlaceCreateModal
            parentNode={creatingParent}
            parentPath={getPath(tree, creatingParent.id)?.join(' / ')}
            onClose={() => setCreatingParent(null)}
            onCreate={async (form) => {
              await handleCreatePlace({ 
                ...form, 
                parentid: creatingParent.id 
              });
            }}
          />
        </WindowFrame>
      )}

      {/* Move Confirmation Modal */}
      {moveConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[11000] p-4 backdrop-blur-sm">
          <div className="bg-surface rounded-lg shadow-2xl border border-subtle w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 text-amber-500 mb-4">
                <span className="text-2xl">🔄</span>
                <h3 className="text-xl font-bold text-primary">Bekräfta flytt</h3>
              </div>
              <p className="text-secondary leading-relaxed mb-6 text-sm">
                Vill du flytta <span className="font-bold text-primary">"{moveConfirmation.source.name}"</span> så att den ligger under <span className="font-bold text-primary">"{moveConfirmation.target.name}"</span>?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 bg-surface-2 text-primary rounded hover:bg-surface-3 transition-colors text-sm font-medium"
                  onClick={() => {
                    setMoveConfirmation(null);
                    setDraggingNode(null);
                  }}
                >
                  Avbryt
                </button>
                <button
                  className="px-6 py-2 bg-amber-600 text-white rounded hover:bg-amber-500 transition-colors text-sm font-bold shadow-lg shadow-amber-900/20"
                  onClick={handleConfirmMove}
                >
                  Ja, flytta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
