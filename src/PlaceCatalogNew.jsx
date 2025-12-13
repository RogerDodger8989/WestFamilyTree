// Hjälpfunktion för att formatera namn och kod
function formatPlaceName(node) {
  // Hjälpfunktion för att rensa K-xxxx kod ur namn
  function cleanName(name) {
    if (!name) return '';
    // Ta bort (K-xxxx) och extra whitespace
    return name.replace(/\s*\(K-\d{4}\)/g, '').replace(/\s+/g, ' ').trim();
  }
  function onlyOneKod(name, kod) {
    if (!kod) return name;
    // Om koden redan finns i namnet, lägg inte till igen
    if (name.includes(`(${kod})`)) return name;
    // Ta bort alla (K), (O), (N), (B), (M), (D), (G), (S), (T), (U), (W), (C), (F), (H), (E), (A), (P), (R), (L), (I), (Z), (Y), (X) – alla möjliga länsbokstäver
    let n = name.replace(/\s*\([A-ZÅÄÖ]{1}\)/g, '').trim();
    // Ta även bort eventuella dubbla kod på slutet
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
    // Lägg bara till 'församling' om det inte redan slutar på 'församling' eller 'socken'
    if (!namn.toLowerCase().endsWith('församling') && !namn.toLowerCase().endsWith('socken')) {
      namn += ' församling';
    }
    return onlyOneKod(namn, kod);
  }
  return onlyOneKod(cleanName(node.metadata.ortnamn || node.name), node.metadata.lanskod);
}
import React, { useState, useEffect, useRef } from 'react';
// För Riksarkivet-integration
const RIKSARKIVET_API = 'https://sok.riksarkivet.se/en/data-api/api';
import { useApp } from './AppContext.jsx';
import WindowFrame from './WindowFrame.jsx';
import PlaceEditModal from './PlaceEditModal.jsx';
import PlaceCreateModal from './PlaceCreateModal.jsx';
import Editor from './MaybeEditor.jsx';

// Ikoner för varje platstyp
const PLACE_TYPE_ICONS = {
  'Country': '🌍',
  'County': '🗺️',
  'Municipality': '🏛️',
  'Parish': '⛪',
  'Village': '📍',
  'default': '📍'
};

const PLACE_TYPE_LABELS = {
  'Country': 'Land',
  'Landscape': 'Landskap',
  'County': 'Län',
  'Municipality': 'Kommun',
  'Parish': 'Församling/socken',
  'Village': 'By/Ort',
  'Building': 'Byggnad',
  'Cemetary': 'Kyrkogård',
  'default': 'Plats'
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
  onSelect,
  onContextMenu,
  onDoubleClick,
  highlightTerm
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  
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
        className={`flex items-center py-1 px-2 cursor-pointer select-none hover:bg-slate-700 transition-colors ${
          isSelected ? 'bg-blue-600 border-l-4 border-blue-400' : ''
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect(node)}
        onDoubleClick={() => onDoubleClick(node)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <div 
          className="mr-1 text-slate-500 hover:text-slate-300 transition-colors"
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
        
        <LocationIcon 
          type={node.type}
          className="mr-2 text-base"
        />
        <span className="text-sm text-slate-200">
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
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onDoubleClick={onDoubleClick}
              highlightTerm={highlightTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
      className="fixed bg-slate-800 border border-slate-700 rounded shadow-lg py-1 z-50"
      style={{ top: y, left: x }}
    >
      {menuItems.map((item, idx) => 
        item.action === 'separator' ? (
          <div key={idx} className="border-t border-slate-700 my-1" />
        ) : (
          <button
            key={idx}
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 text-slate-200 transition-colors"
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

export default function PlaceCatalog({ catalogState, setCatalogState, onPick, onClose, isDrawerMode = false, onLinkPlace }) {
  // Riksarkivet state
  const [riksarkivetResults, setRiksarkivetResults] = useState(null);
  const [riksarkivetLoading, setRiksarkivetLoading] = useState(false);
  const [riksarkivetError, setRiksarkivetError] = useState(null);
  // Ingen set-hantering behövs för Riksarkivet OAI-PMH
  const { recordAudit, showStatus } = useApp();
  const [tree, setTree] = useState([]);
  const [flatPlaces, setFlatPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));
  const [selectedNode, setSelectedNode] = useState(null);
  const [linkedPeople, setLinkedPeople] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('name-asc');
  const [contextMenu, setContextMenu] = useState(null);
  const [editingPlace, setEditingPlace] = useState(null);
  const [creatingParent, setCreatingParent] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState('info');
  const [noteDraft, setNoteDraft] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const fileInputRef = useRef(null);
  // Stäng med ESC när i pick-läge
  useEffect(() => {
    if (!onPick) return;
    const handler = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onPick, onClose]);

  // Hjälpfunktion: lägg till ny nod under parentId i trädet
  const addNodeToTree = (nodes, parentId, newNode) => {
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
  };

  // Ladda platser från backend (full tree)
  useEffect(() => {
    loadPlaces();
  }, []);

  // Ladda kopplade personer när en plats väljs
  // Hämta tillgängliga set när fliken öppnas första gången
  // Ingen set-hämtning behövs

  // Hämta poster när plats eller set ändras
  useEffect(() => {
    if (selectedNode && selectedNode.metadata?.id) {
      loadLinkedPeople(selectedNode.metadata.id);
    } else {
      setLinkedPeople([]);
    }
    if (selectedNode && selectedNode.name) {
      const placeName = selectedNode.name.replace(/\s*\([^)]+\)/g, '').trim();
      setRiksarkivetLoading(true);
      setRiksarkivetError(null);
      // Använd Riksarkivets Sök-API (REST)
      const url = `/riksarkivet_search?query=${encodeURIComponent(placeName)}&rows=10`;
      fetch(url)
        .then(res => res.json())
        .then(data => {
          // Anpassa efter API-svar: records eller hits
          const hits = (data.records || data.hits || []).map(rec => ({
            title: rec.title || rec.displayString || '',
            description: rec.description || '',
            identifier: rec.url || rec.id || ''
          })).filter(r => r.title && r.title.toLowerCase().includes(placeName.toLowerCase()));
          setRiksarkivetResults(hits);
          setRiksarkivetLoading(false);
        })
        .catch(err => {
          setRiksarkivetError('Kunde inte hämta data från Riksarkivet (Sök-API).');
          setRiksarkivetLoading(false);
        });
    } else {
      setRiksarkivetResults(null);
    }
  }, [selectedNode]);

  // Uppdatera noteringsutkast när plats byts
  useEffect(() => {
    setNoteDraft(selectedNode?.metadata?.note || '');
  }, [selectedNode]);

  const loadPlaces = async () => {
          if (typeof data !== 'undefined' && data && data.tree && data.tree.length > 0) {
            console.log('DEBUG: Första noden i tree (JSON):', JSON.stringify(data.tree[0], null, 2));
            if (data.tree[0] && data.tree[0].children) {
              console.log('DEBUG: Children till första noden:', JSON.stringify(data.tree[0].children, null, 2));
            }
          }
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5005/official_places/full_tree');
      const data = await res.json();
      console.log('DEBUG: Data från backend /official_places/full_tree:', data);
      // Om data.list finns, bygg träd från listan istället för tree
      let convertedTree = [];
      if (data && Array.isArray(data.list) && data.list.length > 0) {
        // Bygg hierarkiskt träd: län > kommun > församling > ort
        const länMap = {};
        for (const place of data.list) {
          // Filtrera bort platser där namnet börjar med 'Okänd'
          if (
            (place.lansnamn && place.lansnamn.trim().toLowerCase().startsWith('okänd')) ||
            (place.kommunnamn && place.kommunnamn.trim().toLowerCase().startsWith('okänd')) ||
            (place.sockenstadnamn && place.sockenstadnamn.trim().toLowerCase().startsWith('okänd')) ||
            (place.ortnamn && place.ortnamn.trim().toLowerCase().startsWith('okänd'))
          ) {
            continue;
          }
          const län = place.lansnamn;
          const länKod = place.lanskod;
          const kommun = place.kommunnamn;
          const kommunKod = place.kommunkod;
          const församling = place.sockenstadnamn;
          const församlingKod = place.sockenstadkod;
          const ort = place.ortnamn;
          // Typ-mappning svensk -> engelsk
          const typeMap = {
            'Län': 'County',
            'Kommun': 'Municipality',
            'Församling': 'Parish',
            'Ort': 'Village',
            'Land': 'Country',
            'root': 'Country'
          };
          // Län
          if (!länMap[län]) {
            länMap[län] = {
              id: `lan-${län}`,
              name: `${län ? län.replace(/\s*\(K-\d{4}\)/g, '').replace(/\s*\(K\)/gi, '').trim() : ''} län${länKod ? ` (${länKod})` : ''}`,
              type: typeMap['Län'],
              children: {},
              metadata: { lansnamn: län, lanskod: länKod }
            };
          }
          // Kommun
          if (!länMap[län].children[kommun]) {
            länMap[län].children[kommun] = {
              id: `kommun-${kommun}`,
              name: `${kommun ? kommun.replace(/\s*\(K-\d{4}\)/g, '').replace(/\s*\(K\)/gi, '').trim() : ''} kommun${länKod ? ` (${länKod})` : ''}`,
              type: typeMap['Kommun'],
              children: {},
              metadata: { kommunnamn: kommun, kommunkod: kommunKod, lansnamn: län, lanskod: länKod }
            };
          }
          // Församling
          if (!länMap[län].children[kommun].children[församling]) {
            länMap[län].children[kommun].children[församling] = {
              id: `forsamling-${församling}`,
              name: (() => {
                let namn = församling ? församling.replace(/\s*\(K-\d{4}\)/g, '').replace(/\s*\(K\)/gi, '').trim() : '';
                if (namn && !namn.toLowerCase().endsWith('församling') && !namn.toLowerCase().endsWith('socken')) {
                  namn += ' församling';
                }
                return namn;
              })(),
              type: typeMap['Församling'],
              children: {},
              metadata: { sockenstadnamn: församling, sockenstadkod: församlingKod, kommunnamn: kommun, kommunkod: kommunKod, lansnamn: län, lanskod: länKod }
            };
          }
          // Ort
          länMap[län].children[kommun].children[församling].children[ort + '-' + place.id] = {
            id: place.id,
            name: ort,
            type: typeMap['Ort'],
            children: [],
            metadata: place
          };
        }
        // Konvertera till arraystruktur
        // Filtrera bort noder med tomt/generiskt namn
        function isValidName(name, type) {
          if (!name) return false;
          const n = name.trim().toLowerCase();
          if (type === 'Län' && (n === 'län' || n === '')) return false;
          if (type === 'Kommun' && (n === 'kommun' || n === '')) return false;
          if (type === 'Församling' && (n === 'församling' || n === '')) return false;
          if (type === 'Ort' && (n === 'ort' || n === '')) return false;
          return true;
        }
        const länArr = Object.values(länMap)
          .filter(länNode => isValidName(länNode.metadata.lansnamn, 'Län'))
          .map(länNode => {
            länNode.children = Object.values(länNode.children)
              .filter(kommunNode => isValidName(kommunNode.metadata.kommunnamn, 'Kommun'))
              .map(kommunNode => {
                kommunNode.children = Object.values(kommunNode.children)
                  .filter(forsamlingNode => isValidName(forsamlingNode.metadata.sockenstadnamn, 'Församling'))
                  .map(forsamlingNode => {
                    forsamlingNode.children = Object.values(forsamlingNode.children)
                      .filter(ortNode => isValidName(ortNode.metadata.ortnamn, 'Ort'));
                    return forsamlingNode;
                  });
                return kommunNode;
              });
            return länNode;
          });
        convertedTree = [{ id: 'root', name: 'Sverige', type: 'Country', children: länArr, metadata: {} }];
      } else {
        // Fallback till gamla tree om det finns
        convertedTree = convertBackendToTree(data);
      }
      console.log('DEBUG: Träd efter konvertering:', convertedTree);
      setTree(convertedTree);
      // Spara även platt lista för sökning
      const flat = flattenTree(convertedTree);
      setFlatPlaces(flat);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Ladda personer kopplade till en plats
  const loadLinkedPeople = async (placeId) => {
    try {
      // Hämta alla personer
      const peopleRes = await fetch('http://127.0.0.1:5005/people');
      const people = await peopleRes.json();
      
      // Hitta personer vars events har denna placeId
      const linked = [];
      for (const person of people) {
        if (person.events && Array.isArray(person.events)) {
          for (const event of person.events) {
            if (event.placeId == placeId || event.place_id == placeId) {
              linked.push({
                personId: person.id,
                personName: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
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

  // Konvertera backend-data till trädstruktur
  const convertBackendToTree = (data) => {
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
  };

  const typeToPlaceType = (type) => {
    const map = {
      'lan': 'County',
      'kommun': 'Municipality',
      'forsamling': 'Parish',
      'ort': 'Village'
    };
    return map[type] || 'default';
  };

  // Platta ut trädet för sökning och ta bort dubletter baserat på namn + koordinater
  const flattenTree = (nodes) => {
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
  };

  // Filtrera trädet baserat på sökning (returnerar både filtered tree och nodes to expand)
  const filterTree = (nodes, term) => {
    if (!term) return { filtered: nodes, nodesToExpand: new Set() };
    
    const filtered = [];
    const lowerTerm = term.toLowerCase();
    const nodesToExpand = new Set();
    
    const matchesSearch = (node) => {
      return node.name.toLowerCase().includes(lowerTerm);
    };
    
    const filterNode = (node, ancestorIds = []) => {
      const matches = matchesSearch(node);
      const filteredChildren = node.children ? node.children.map(child => filterNode(child, [...ancestorIds, node.id])).filter(Boolean) : [];
      
      if (matches || filteredChildren.length > 0) {
        // Samla noder att expandera
        if (matches) {
          ancestorIds.forEach(id => nodesToExpand.add(id));
          nodesToExpand.add(node.id);
        }
        
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
  };
  
  // Auto-expandera noder vid sökning (använd useEffect för att undvika infinite loop)
  useEffect(() => {
    if (searchTerm && tree.length > 0) {
      const { nodesToExpand } = filterTree(tree, searchTerm);
      if (nodesToExpand.size > 0) {
        setExpandedNodes(prev => new Set([...prev, ...nodesToExpand]));
      }
    }
  }, [searchTerm, tree]);

  // Hitta en nod i trädet rekursivt
  const findNodeById = (nodes, targetId, parentIds = []) => {
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
  };

  // Auto-välj och expandera plats när selectedPlaceId sätts från props
  useEffect(() => {
    const selectedPlaceId = catalogState?.selectedPlaceId;
    if (!selectedPlaceId || !tree.length || loading) return;

    const result = findNodeById(tree, selectedPlaceId);
    if (result) {
      const { node, parentIds } = result;
      
      // Expanderar alla föräldranoder så att noden är synlig
      const newExpanded = new Set(expandedNodes);
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
  const handleSelect = (node) => {
    setSelectedNode(node);
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
    switch (action) {
      case 'new':
        setCreatingParent(node);
        break;
      case 'edit':
        setEditingPlace(node);
        break;
      case 'delete':
        if (window.confirm(`Vill du verkligen radera "${node.name}"?`)) {
          try {
            const id = node.metadata?.id;
            if (!id) {
              showStatus && showStatus('Kan inte radera: saknar ID.', 'error');
              break;
            }
            const res = await fetch(`http://127.0.0.1:5005/official_places/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete misslyckades');
            await loadPlaces();
            try { recordAudit && recordAudit({ type: 'delete', entityType: 'place', entityId: id, details: { name: node.name } }); } catch (e) {}
            showStatus && showStatus('Plats raderad.');
          } catch (err) {
            showStatus && showStatus('Kunde inte radera plats.', 'error');
          }
        }
        break;
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
  const handleSavePlace = async (formData) => {
    if (!editingPlace || !editingPlace.metadata?.id) {
      throw new Error('Ingen plats vald för redigering');
    }
    
    const placeId = editingPlace.metadata.id;
    
    const response = await fetch(`http://127.0.0.1:5005/official_places/${placeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ortnamn: formData.ortnamn,
        sockenstadnamn: formData.sockenstadnamn,
        sockenstadkod: formData.sockenstadkod,
        kommunkod: formData.kommunkod,
        kommunnamn: formData.kommunnamn,
        lanskod: formData.lanskod,
        lansnamn: formData.lansnamn,
        detaljtyp: editingPlace.type,
        latitude: formData.latitude,
        longitude: formData.longitude,
        note: formData.note
      })
    });
    
    if (!response.ok) {
      throw new Error('Kunde inte spara plats');
    }
    
    // Ladda om platser
    await loadPlaces();
  };

  // Skapa ny plats
  const handleCreatePlace = async (formData) => {
    // 1) Lokal uppdatering för direkt feedback
    const parent = creatingParent || selectedNode || tree[0];
    const parentId = parent?.id || 'root';
    const tempId = 'new_' + Date.now();
    const tempNode = {
      id: tempId,
      name: formData.name || 'Ny plats',
      type: formData.type || 'default',
      children: [],
      metadata: {
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        note: formData.note || ''
      }
    };
    setTree(prev => addNodeToTree(prev, parentId, tempNode));
    setExpandedNodes(prev => new Set([...prev, parentId]));

    // 2) Persistens till backend
    const payload = { name: formData.name, type: formData.type, latitude: formData.latitude || null, longitude: formData.longitude || null };
    // Mappa hierarkin från föräldern
    if (parent) {
      const meta = parent.metadata || {};
      if (parent.type === 'Parish') {
        payload.sockenstadkod = meta.sockenstadkod || meta.sockenstadnamn || null;
        payload.sockenstadnamn = meta.sockenstadnamn || null;
        payload.kommunkod = meta.kommunkod || null;
        payload.kommunnamn = meta.kommunnamn || null;
        payload.lanskod = meta.lanskod || null;
        payload.lansnamn = meta.lansnamn || null;
      } else if (parent.type === 'Municipality') {
        payload.kommunkod = meta.kommunkod || meta.kommunnamn || null;
        payload.kommunnamn = meta.kommunnamn || null;
        payload.lanskod = meta.lanskod || null;
        payload.lansnamn = meta.lansnamn || null;
      } else if (parent.type === 'County') {
        payload.lanskod = meta.lanskod || meta.lansnamn || null;
        payload.lansnamn = meta.lansnamn || null;
      }
    }

    try {
      const response = await fetch('http://127.0.0.1:5005/official_places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || 'Kunde inte skapa plats');
      }
      // Uppdatera trädet från backend (ersätter temp-node med riktig data)
      await loadPlaces();
      setExpandedNodes(prev => new Set([...prev, parentId]));
    } catch (e) {
      // Vid fel: lämna temp-noden kvar eller visa fel
      console.error('Skapa plats misslyckades:', e);
    }
  };

  // Importera XML-fil
  const handleImportXML = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    
    try {
      setLoading(true);
      
      // Parsa XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');
      
      // Extrahera platser från Genney-format
      const places = xmlDoc.getElementsByTagName('place');
      const parsedPlaces = [];
      
      for (let i = 0; i < places.length; i++) {
        const place = places[i];
        
        // Extrahera abbreviation om det finns
        const abbrevElement = place.getElementsByTagName('abbreviation')[0];
        const abbreviation = abbrevElement ? abbrevElement.textContent : '';
        
        const placeData = {
          id: place.getAttribute('id'),
          parentid: place.getAttribute('parentid'),
          name: place.getElementsByTagName('placename')[0]?.textContent || '',
          type: place.getElementsByTagName('placetype')[0]?.textContent || '',
          hierarchy: place.getElementsByTagName('hierarchy')[0]?.textContent || '',
          latitude: place.getElementsByTagName('latitude')[0]?.textContent || '',
          longitude: place.getElementsByTagName('longitude')[0]?.textContent || '',
          abbreviation: abbreviation
        };
        parsedPlaces.push(placeData);
      }
      
      if (parsedPlaces.length === 0) {
        alert('Inga platser hittades i XML-filen.');
        setLoading(false);
        e.target.value = '';
        return;
      }
      
      // Skicka till backend
      const response = await fetch('http://127.0.0.1:5005/official_places/import_xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places: parsedPlaces })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Kunde inte importera platser');
      }
      
      const result = await response.json();
      alert(`Importerade ${result.imported} platser från XML!\nLaddar om platsregister...`);
      
      // Ladda om platser
      await loadPlaces();
      
    } catch (err) {
      alert('Kunde inte importera XML-fil: ' + err.message);
      console.error('Import error:', err);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // Bygg breadcrumbs (sökväg)
  const getPath = (nodes, targetId, path = []) => {
    for (const node of nodes) {
      if (node.id === targetId) return [...path, node.name];
      if (node.children) {
        const result = getPath(node.children, targetId, [...path, node.name]);
        if (result) return result;
      }
    }
    return null;
  };

  const breadcrumbs = selectedNode ? getPath(tree, selectedNode.id) : [];
  
  // Sortera och filtrera trädet
  const sortTree = (nodes) => {
    if (!nodes || nodes.length === 0) return nodes;
    
    const sorted = [...nodes].sort((a, b) => {
      if (sortOrder === 'name-asc') return a.name.localeCompare(b.name, 'sv');
      if (sortOrder === 'name-desc') return b.name.localeCompare(a.name, 'sv');
      if (sortOrder === 'type') return a.type.localeCompare(b.type);
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
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-2 shadow-sm">
        <button 
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 font-medium"
          onClick={() => setCreatingParent(selectedNode || tree[0])}
        >
          ➕ Ny
        </button>
        <button 
          className="px-3 py-1 bg-slate-700 text-slate-300 text-sm rounded hover:bg-slate-600 font-medium"
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
        
        <div className="flex-1" />
        
        <input
          type="text"
          placeholder="Sök plats..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-slate-700 bg-slate-900 text-white rounded px-3 py-1 text-sm w-64 focus:border-blue-500 focus:outline-none"
        />
        
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border border-slate-700 bg-slate-900 text-white rounded px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
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
          className="px-3 py-1 bg-blue-600 text-blue-100 text-sm rounded hover:bg-blue-500 font-medium"
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
        <div className="w-1/3 min-w-[300px] border-r border-slate-700 flex flex-col bg-slate-850">
          <div className="p-2 bg-slate-800 border-b border-slate-700 text-xs font-bold uppercase text-slate-300">
            Platsstruktur
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="text-center text-slate-500 mt-8">Laddar platser...</div>
            ) : error ? (
              <div className="text-center text-red-500 mt-8">Fel: {error}</div>
            ) : displayTree.length === 0 ? (
              <div className="text-center text-slate-500 mt-8">Inga platser funna</div>
            ) : (
              displayTree.map(node => (
                <TreeNode 
                  key={node.id} 
                  node={node} 
                  level={0} 
                  expandedNodes={expandedNodes}
                  toggleExpand={toggleExpand}
                  selectedNodeId={selectedNode?.id}
                  onSelect={handleSelect}
                  onContextMenu={handleContextMenu}
                  onDoubleClick={handleDoubleClick}
                  highlightTerm={searchTerm}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Details Panel */}
        <div className="flex-1 bg-slate-800 flex flex-col overflow-hidden">
          {selectedNode ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold text-white mb-1">{selectedNode.name}</h1>
                    <p className="text-slate-400 italic">
                      {PLACE_TYPE_LABELS[selectedNode.type] || 'Platsinformation saknas'}
                    </p>
                  </div>
                </div>

                {/* Tabbar */}
                <div className="flex border-b mt-4 bg-slate-900 rounded-t-lg shadow-sm">
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'info' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                    onClick={() => setActiveRightTab('info')}
                    title="Information"
                  >
                    <span className="text-lg" role="img" aria-label="Info">ℹ️</span>
                    Info
                    {activeRightTab === 'info' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'riksarkivet' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                    onClick={() => setActiveRightTab('riksarkivet')}
                    title="Riksarkivet"
                  >
                    <span className="text-lg" role="img" aria-label="Riksarkivet">🏛️</span>
                    Riksarkivet
                    {activeRightTab === 'riksarkivet' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'images' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                    onClick={() => setActiveRightTab('images')}
                    title="Bilder"
                  >
                    <span className="text-lg" role="img" aria-label="Bilder">🖼️</span>
                    Bilder
                    {activeRightTab === 'images' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'notes' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
                    onClick={() => setActiveRightTab('notes')}
                    title="Noteringar"
                  >
                    <span className="text-lg" role="img" aria-label="Noteringar">📝</span>
                    Noteringar
                    {activeRightTab === 'notes' && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />}
                  </button>
                  <button
                    className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors duration-150 focus:outline-none ${activeRightTab === 'connections' ? 'border-blue-500 text-blue-300 bg-slate-800 shadow -mb-px' : 'border-transparent text-slate-400 hover:text-blue-400 hover:bg-slate-700'}`}
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
                {activeRightTab === 'info' && (
                  <PlaceEditModal
                    place={selectedNode}
                    onClose={() => setSelectedPlaceId(null)}
                    onSave={handleSavePlace}
                  />
                )}
                {activeRightTab === 'riksarkivet' && (
                  <div className="max-w-3xl mx-auto">
                    <h3 className="text-lg font-bold text-slate-200 mb-3">Riksarkivet</h3>
                    {riksarkivetLoading && <div>Laddar från Riksarkivet...</div>}
                    {riksarkivetError && (
                      <div className="text-red-400">
                        {riksarkivetError}
                        <div className="text-slate-400 mt-2 text-sm">
                          Riksarkivets Sök-API verkar vara otillgängligt just nu.<br />
                          Detta är ett problem hos Riksarkivet, inte i din app.<br />
                          Försök igen senare. Om felet kvarstår, kontrollera <a href="https://sok.riksarkivet.se/" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">Riksarkivets webbsida</a> för driftstatus.
                        </div>
                      </div>
                    )}
                    {riksarkivetResults && riksarkivetResults.length > 0 ? (
                      <ul className="space-y-2">
                        {riksarkivetResults.map((rec, i) => (
                          <li key={i} className="border-b border-slate-700 pb-2">
                            <div className="font-semibold">{rec.title}</div>
                            {rec.description && <div className="text-sm mb-1">{rec.description}</div>}
                            {rec.identifier && (
                              <a href={rec.identifier} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Visa arkivpost</a>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      !riksarkivetLoading && <div>Inga träffar från Riksarkivet.</div>
                    )}
                  </div>
                )}
                {activeRightTab === 'images' && (
                  <div className="max-w-3xl mx-auto">
                    <h3 className="text-lg font-bold text-slate-200 mb-3">Bilder</h3>
                    <div className="text-sm text-slate-400 italic bg-slate-900 border border-slate-700 rounded p-4">
                      Inga bilder är kopplade till denna plats ännu.
                    </div>
                  </div>
                )}
                {activeRightTab === 'notes' && (
                  <div className="max-w-3xl mx-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-200">Noteringar</h3>
                      <button
                        className="px-3 py-1 bg-blue-600 text-blue-100 rounded hover:bg-blue-500 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
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
                      <h3 className="text-sm font-bold text-slate-300 uppercase">Kopplade Personer</h3>
                      <span className="text-xs text-slate-400">{linkedPeople.length} {linkedPeople.length === 1 ? 'person' : 'personer'}</span>
                    </div>
                    <div className="bg-slate-900 rounded-md border border-slate-700 overflow-hidden">
                      {linkedPeople.length > 0 ? (
                        linkedPeople.map((link) => (
                          <div key={`${link.personId}-${link.eventId}`} className="flex items-center p-3 border-b border-slate-700 last:border-0 hover:bg-slate-800 transition-colors cursor-pointer">
                            <span className="mr-3 text-slate-500">👤</span>
                            <div className="flex-1">
                              <div className="text-sm text-slate-100 font-medium">{link.personName}</div>
                              <div className="text-xs text-slate-400">
                                {link.eventType}
                                {link.eventDate && ` (${link.eventDate})`}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-sm text-slate-400 italic">
                          Inga personer kopplade till denna plats.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Välj en plats i listan till vänster för att se detaljer.
            </div>
          )}
        </div>
      </div>

      {/* Footer: Picker actions or Breadcrumbs */}
      {onPick ? (
        <div className="h-10 bg-slate-800 border-t border-slate-700 flex items-center justify-end gap-2 px-3">
          <button className="px-3 py-1 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 font-medium" onClick={() => onClose && onClose()}>Avbryt</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 font-medium disabled:opacity-50" disabled={!selectedNode} onClick={() => selectedNode && onPick(selectedNode)}>OK</button>
        </div>
      ) : isDrawerMode && onLinkPlace ? (
        <div className="h-10 bg-slate-800 border-t border-slate-700 flex items-center justify-end gap-2 px-3">
          <button 
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500 font-medium disabled:opacity-50 disabled:bg-green-900" 
            disabled={!selectedNode} 
            onClick={() => selectedNode && onLinkPlace(selectedNode)}
          >
            ✓ Koppla plats
          </button>
        </div>
      ) : (
        <div className="h-8 bg-slate-900 text-slate-300 flex items-center px-4 text-xs border-t border-slate-700">
          {breadcrumbs.length > 0 ? (
            <span>{breadcrumbs.join(' › ')}</span>
          ) : (
            <span>Ingen plats vald</span>
          )}
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
        <WindowFrame title="Skapa ny plats" onClose={() => setCreatingParent(null)}>
          <PlaceCreateModal
            parentNode={creatingParent}
            onClose={() => setCreatingParent(null)}
            onCreate={async (form) => {
              await handleCreatePlace({ name: form.name, type: form.type, latitude: form.latitude, longitude: form.longitude, note: form.note });
            }}
          />
        </WindowFrame>
      )}
    </div>
  );
}
