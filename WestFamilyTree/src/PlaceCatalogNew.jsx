import React, { useState, useEffect, useRef } from 'react';
import { useApp } from './AppContext.jsx';
import PlaceEditModal from './PlaceEditModal.jsx';
import PlaceCreateModal from './PlaceCreateModal.jsx';

// Ikoner för varje platstyp
const PLACE_TYPE_ICONS = {
  'Country': '🌍',
  'Landscape': '🏞️',
  'County': '🗺️',
  'Municipality': '🏛️',
  'Parish': '⛪',
  'Village': '🏘️',
  'Building': '🏠',
  'Cemetary': '🪦',
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
        <mark key={i} className="bg-yellow-200">{part}</mark> : part
    );
  };

  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 cursor-pointer select-none hover:bg-gray-200 ${
          isSelected ? 'bg-blue-100 border-l-4 border-blue-600' : ''
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect(node)}
        onDoubleClick={() => onDoubleClick(node)}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <div 
          className="mr-1 text-gray-500 hover:text-gray-800"
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
        
        <span className="text-sm text-gray-800">{highlightText(node.name)}</span>
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
      className="fixed bg-white border border-gray-300 rounded shadow-lg py-1 z-50"
      style={{ top: y, left: x }}
    >
      {menuItems.map((item, idx) => 
        item.action === 'separator' ? (
          <div key={idx} className="border-t border-gray-200 my-1" />
        ) : (
          <button
            key={idx}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
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

export default function PlaceCatalog({ catalogState, setCatalogState }) {
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
  const fileInputRef = useRef(null);

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
  useEffect(() => {
    if (selectedNode && selectedNode.metadata?.id) {
      loadLinkedPeople(selectedNode.metadata.id);
    } else {
      setLinkedPeople([]);
    }
  }, [selectedNode]);

  const loadPlaces = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5005/official_places/full_tree');
      const data = await res.json();
      
      // Konvertera backend-format till vårt trädformat
      const convertedTree = convertBackendToTree(data);
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
    
    const convertNode = (node, type = 'lan') => {
      if (!node) return null;
      
      let children = [];
      let nodeName = '';
      let nodeId = '';
      
      if (type === 'lan') {
        nodeName = node.lansnamn || 'Okänt län';
        nodeId = `lan-${node.lanskod || node.lansnamn}`;
        
        if (Array.isArray(node.children)) {
          children = node.children.map(child => convertNode(child, 'kommun')).filter(Boolean);
        } else if (node.children && typeof node.children === 'object') {
          children = Object.values(node.children).flat().map(child => convertNode(child, 'kommun')).filter(Boolean);
        }
      } else if (type === 'kommun') {
        nodeName = node.kommunnamn || 'Okänd kommun';
        nodeId = `kommun-${node.ommunkod || node.kommunnamn}`;
        
        if (Array.isArray(node.children)) {
          children = node.children.map(child => convertNode(child, 'forsamling')).filter(Boolean);
        } else if (node.children && typeof node.children === 'object') {
          children = Object.values(node.children).flat().map(child => convertNode(child, 'forsamling')).filter(Boolean);
        }
      } else if (type === 'forsamling') {
        nodeName = node.sockenstadnamn || 'Okänd församling';
        nodeId = `forsamling-${node.sockenstadkod || node.sockenstadnamn}`;
        
        if (Array.isArray(node.children)) {
          children = node.children.map(child => convertNode(child, 'ort')).filter(Boolean);
        } else if (node.children && typeof node.children === 'object') {
          children = Object.values(node.children).flat().map(child => convertNode(child, 'ort')).filter(Boolean);
        }
      } else if (type === 'ort') {
        nodeName = node.ortnamn || 'Okänd ort';
        nodeId = `ort-${node.id || node.ortnamn}`;
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

  // Platta ut trädet för sökning
  const flattenTree = (nodes) => {
    const result = [];
    const traverse = (node) => {
      result.push(node);
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    nodes.forEach(traverse);
    return result;
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
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-300 px-4 py-2 flex items-center gap-2 shadow-sm">
        <button 
          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          onClick={() => setCreatingParent(selectedNode || tree[0])}
        >
          ➕ Ny
        </button>
        <button 
          className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
          onClick={() => editingPlace ? setEditingPlace(null) : (selectedNode && setEditingPlace(selectedNode))}
          disabled={!selectedNode}
        >
          ✏️ Redigera
        </button>
        <button 
          className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200"
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
          className="border border-gray-300 rounded px-3 py-1 text-sm w-64"
        />
        
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1 text-sm"
        >
          <option value="name-asc">Namn (A-Ö)</option>
          <option value="name-desc">Namn (Ö-A)</option>
          <option value="type">Typ</option>
        </select>
        
        <button 
          className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200"
          onClick={() => fileInputRef.current?.click()}
        >
          📥 Importera
        </button>
        <button 
          className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200"
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
        <div className="w-1/3 min-w-[300px] border-r border-gray-300 flex flex-col bg-white">
          <div className="p-2 bg-gray-100 border-b border-gray-200 text-xs font-bold uppercase text-gray-600">
            Platsstruktur
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="text-center text-gray-500 mt-8">Laddar platser...</div>
            ) : error ? (
              <div className="text-center text-red-500 mt-8">Fel: {error}</div>
            ) : displayTree.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">Inga platser funna</div>
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
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          {selectedNode ? (
            <div className="flex-1 overflow-y-auto p-6">
              <h1 className="text-2xl font-semibold text-gray-800 mb-1">{selectedNode.name}</h1>
              <p className="text-gray-500 italic mb-6">
                {PLACE_TYPE_LABELS[selectedNode.type] || 'Platsinformation saknas'}
              </p>

              {selectedNode.metadata?.latitude && selectedNode.metadata?.longitude && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-600 uppercase mb-1">WGS 84 decimal (lat, lon)</h3>
                  <p className="font-mono text-gray-800 bg-gray-100 inline-block px-2 py-1 rounded">
                    {selectedNode.metadata.latitude}, {selectedNode.metadata.longitude}
                  </p>
                </div>
              )}

              {selectedNode.metadata?.note && (
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-gray-600 uppercase mb-1">Notering</h3>
                  <p className="text-gray-700 leading-relaxed text-sm">
                    {selectedNode.metadata.note}
                  </p>
                </div>
              )}

              {/* Kopplade Personer */}
              <div className="mt-8 border-t border-gray-300 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-600 uppercase">Kopplade Personer</h3>
                  <span className="text-xs text-gray-500">{linkedPeople.length} {linkedPeople.length === 1 ? 'person' : 'personer'}</span>
                </div>
                
                <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
                  {linkedPeople.length > 0 ? (
                    linkedPeople.map((link, idx) => (
                      <div key={`${link.personId}-${link.eventId}`} className="flex items-center p-3 border-b border-gray-200 last:border-0 hover:bg-gray-100 transition-colors cursor-pointer">
                        <span className="mr-3 text-gray-400">👤</span>
                        <div className="flex-1">
                          <div className="text-sm text-gray-800 font-medium">{link.personName}</div>
                          <div className="text-xs text-gray-500">
                            {link.eventType}
                            {link.eventDate && ` (${link.eventDate})`}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-gray-500 italic">
                      Inga personer kopplade till denna plats.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Välj en plats i listan till vänster för att se detaljer.
            </div>
          )}
        </div>
      </div>

      {/* Footer: Breadcrumbs */}
      <div className="h-8 bg-gray-800 text-white flex items-center px-4 text-xs border-t border-gray-700">
        {breadcrumbs.length > 0 ? (
          <span>{breadcrumbs.join(' › ')}</span>
        ) : (
          <span>Ingen plats vald</span>
        )}
      </div>

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
        <PlaceEditModal
          place={editingPlace}
          onClose={() => setEditingPlace(null)}
          onSave={handleSavePlace}
        />
      )}

      {/* Create Modal */}
      {creatingParent && (
        <PlaceCreateModal
          parentNode={creatingParent}
          onClose={() => setCreatingParent(null)}
          onCreate={async (form) => {
            await handleCreatePlace({ name: form.name, type: form.type, latitude: form.latitude, longitude: form.longitude, note: form.note });
          }}
        />
      )}
    </div>
  );
}
