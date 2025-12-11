import React, { useState, useEffect, useRef } from 'react';
import ImageViewer from './ImageViewer.jsx';
import { 
  X, Save, Image as ImageIcon, Grid, List, Tag, User, 
  MapPin, Calendar, Search, Plus, Trash2, MoreVertical, 
  Crop, RotateCw, Star, Eye, EyeOff, FileText, Layers, 
  ScanFace, UploadCloud, ZoomIn, ZoomOut, Maximize,
  FolderPlus, Folder, CheckSquare, Square, MoveRight,
  ArrowRightLeft, Check, Edit2, MoreHorizontal, FileWarning,
  PenTool, AlertCircle, CornerDownRight, Link, Mic,
  Minus, Maximize2, Minimize2, Move
} from 'lucide-react';

// --- KONSTANTER ---

const SYSTEM_LIBRARIES = [
  { id: 'all', label: 'Alla bilder', icon: Layers, type: 'system' },
  { id: 'gallery', label: 'Personligt Galleri', icon: ImageIcon, type: 'system' },
  { id: 'places', label: 'Platsregister', icon: MapPin, type: 'system' },
  { id: 'sources', label: 'Källmaterial', icon: FileText, type: 'system' },
];

const INITIAL_MEDIA = [
  { 
    id: 1, 
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop', 
    name: 'Porträtt 1910.jpg', 
    date: '1910-05-20', 
    libraryId: 'gallery',
    isProfile: true,
    description: 'Porträtt taget hos fotografen i stan. Anders har på sig sin finkostym.',
    connections: {
        people: [{ id: 'I1', name: 'Anders Nilsson', ref: 'I1234', dates: '1885-1962' }],
        places: [{ id: 'P1', name: 'Västra Vram', type: 'Socken' }],
        sources: []
    },
    tags: ['Porträtt', 'Ateljé'],
    faces: [{ x: 40, y: 30, width: 20, height: 20, personId: 'I1' }],
    transcription: '' 
  },
  { 
    id: 2, 
    url: 'https://images.unsplash.com/photo-1583324113626-70df0f4deaab?w=400&h=300&fit=crop', 
    name: 'Husförhörslängd 1890.jpg', 
    date: '1890', 
    libraryId: 'sources',
    isProfile: false,
    description: 'Sida 14 i husförhörslängden.',
    connections: {
        people: [
            { id: 'I1', name: 'Anders Nilsson', ref: 'I1234', dates: '1885-1962' },
            { id: 'I2', name: 'Anna Persdotter', ref: 'I1235', dates: '1890-1970' }
        ],
        places: [{ id: 'P1', name: 'Västra Vram', type: 'Socken' }],
        sources: [{ id: 'S1', name: 'Västra Vram AI:14 (1885-1894) Bild 18 / sid 14', ref: 'AD' }]
    },
    tags: ['Kyrkbok', 'Källa'],
    faces: [],
    transcription: 'Född d. 12 April, döpt d. 14. Fader: Torpare Nils...'
  },
  { 
    id: 3, 
    url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=300&fit=crop', 
    name: 'Gården i dimma.jpg', 
    date: '1950-11-02', 
    libraryId: 'places',
    isProfile: false,
    description: '',
    connections: {
        people: [],
        places: [{ id: 'P2', name: 'Norra Vram 4:2', type: 'Gård' }],
        sources: []
    },
    tags: ['Landskap', 'Gård'],
    faces: [],
    transcription: ''
  }
];

// --- KOMPONENTER ---

const FaceOverlay = ({ faces }) => (
  <div className="absolute inset-0 pointer-events-none">
    {faces.map((face, idx) => (
      <div 
        key={idx}
        className="absolute border-2 border-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 cursor-pointer transition-colors pointer-events-auto"
        style={{
          left: `${face.x}%`,
          top: `${face.y}%`,
          width: `${face.width}%`,
          height: `${face.height}%`
        }}
        title="Kopplad person"
        onClick={(e) => {
            e.stopPropagation();
            alert("Här öppnas redigering för personkoppling (ID: " + face.personId + ")");
        }}
      />
    ))}
  </div>
);

// Modal för att flytta filer
const MoveFilesModal = ({ isOpen, onClose, onMove, libraries }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-3 border-b border-slate-700 bg-slate-900 font-bold text-white flex justify-between items-center">
            <span>Flytta till...</span>
            <button onClick={onClose}><X size={16} className="text-slate-400 hover:text-white"/></button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
          {libraries.filter(l => l.id !== 'all').map(lib => (
            <button
              key={lib.id}
              onClick={() => onMove(lib.id)}
              className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded flex items-center gap-2 text-slate-300 group transition-colors"
            >
              <lib.icon size={16} className="text-slate-500 group-hover:text-blue-400"/> 
              {lib.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const BatchEditModal = ({ isOpen, onClose, onSave, count }) => {
    const [date, setDate] = useState('');
    const [tagsToAdd, setTagsToAdd] = useState('');

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-96 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-700 bg-slate-900 font-bold text-white flex justify-between items-center">
                    <span>Redigera {count} objekt</span>
                    <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-white"/></button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Sätt gemensamt datum</label>
                        <input 
                            type="text" 
                            placeholder="ÅÅÅÅ-MM-DD" 
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Lämna tomt för att behålla befintliga datum.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Lägg till taggar</label>
                        <input 
                            type="text" 
                            placeholder="T.ex. Sommar, Semester" 
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500"
                            value={tagsToAdd}
                            onChange={(e) => setTagsToAdd(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Separera med kommatecken. Dessa läggs till på befintliga.</p>
                    </div>
                </div>
                <div className="p-3 border-t border-slate-700 bg-slate-900 flex justify-end gap-2">
                    <button onClick={onClose} className="text-sm text-slate-400 hover:text-white px-3 py-1.5">Avbryt</button>
                    <button 
                        onClick={() => onSave({ date, tags: tagsToAdd })}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-sm font-medium"
                    >
                        Uppdatera
                    </button>
                </div>
            </div>
        </div>
    );
};

// Knapp för bibliotek som kan ta emot drops
const LibraryButton = ({ lib, isActive, onClick, onDrop, onDelete }) => {
    const [isOver, setIsOver] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsOver(true);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsOver(false);
        const internalData = e.dataTransfer.getData('application/json');
        if (internalData) {
            try {
                const { ids } = JSON.parse(internalData);
                if (ids && ids.length > 0) {
                    onDrop(lib.id, ids);
                }
            } catch (err) {
                console.error("Drop error", err);
            }
        }
    };

    return (
        <div 
            className={`group flex items-center gap-1 rounded px-2 py-1 transition-colors relative 
                ${isActive ? 'bg-blue-600/20 text-blue-100' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                ${isOver ? 'bg-blue-500/40 ring-2 ring-blue-500 scale-[1.02]' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <button
                onClick={onClick}
                className="flex-1 flex items-center gap-3 text-sm truncate w-full text-left py-1.5"
            >
                <lib.icon size={16} className={isOver ? 'text-white animate-bounce' : (isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400')} /> 
                {lib.label}
            </button>
            
            {onDelete && (
                <button 
                    onClick={(e) => onDelete(lib.id, e)} 
                    className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Radera album"
                >
                    <Trash2 size={12}/>
                </button>
            )}
            
            {isOver && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-xs font-bold flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded pointer-events-none">
                    <CornerDownRight size={12}/> Flytta hit
                </div>
            )}
        </div>
    );
};

export function MediaManager({ allPeople = [], onOpenEditModal = () => {} }) {
  // UI State (simplified - no window management for tab mode)
  const [viewMode, setViewMode] = useState('grid'); 
  const [activeLib, setActiveLib] = useState('all');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [search, setSearch] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [filterUnlinked, setFilterUnlinked] = useState(false);
  
  // Data State
  const [mediaItems, setMediaItems] = useState(INITIAL_MEDIA);
  const [customLibraries, setCustomLibraries] = useState([
    { id: 'album1', label: 'Okända soldater', icon: Folder, type: 'custom' }
  ]);
  
  // Selection & Interaction State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState(null); 
  const [showTranscription, setShowTranscription] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuItemId, setContextMenuItemId] = useState(null);

  // Library Management State
  const [editingLibId, setEditingLibId] = useState(null); 
  const [tempLibName, setTempLibName] = useState(''); 

  // Modals State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);

  // Zoom & Transform State (Image Viewer)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1, rotate: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  
  const fileInputRef = useRef(null);
  const libInputRef = useRef(null); 

  // Window Management State
  const [winState, setWinState] = useState({ x: 100, y: 50, width: 1000, height: 700, isMaximized: false, isMinimized: false });
  const isDraggingWindow = useRef(false);
  const isResizingWindow = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: 0, h: 0, x: 0, y: 0 });

  const allLibraries = [...SYSTEM_LIBRARIES, ...customLibraries];

  // --- WINDOW LOGIC ---

  useEffect(() => {
    const handleClick = (e) => {
      // Close menu on any click
      if (contextMenuOpen) {
        setContextMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenuOpen(false);
      }
    };
    
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingWindow.current && !winState.isMaximized) {
        setWinState(prev => ({
          ...prev,
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        }));
      }
      if (isResizingWindow.current && !winState.isMaximized) {
        setWinState(prev => ({
          ...prev,
          width: Math.max(600, startSize.current.w + (e.clientX - startSize.current.x)),
          height: Math.max(400, startSize.current.h + (e.clientY - startSize.current.y))
        }));
      }
    };
    const handleMouseUp = () => {
      isDraggingWindow.current = false;
      isResizingWindow.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [winState.isMaximized]);

  const startDrag = (e) => {
    if (winState.isMaximized) return;
    isDraggingWindow.current = true;
    dragOffset.current = { x: e.clientX - winState.x, y: e.clientY - winState.y };
  };

  const startResize = (e) => {
    e.stopPropagation();
    if (winState.isMaximized) return;
    isResizingWindow.current = true;
    startSize.current = { w: winState.width, h: winState.height, x: e.clientX, y: e.clientY };
  };

  const toggleMaximize = () => {
    setWinState(prev => ({ ...prev, isMaximized: !prev.isMaximized, isMinimized: false }));
  };

  const toggleMinimize = () => {
    setWinState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  };

  const handleContextMenu = (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('CONTEXT MENU TRIGGERED!', itemId); // DEBUG
    setContextMenuItemId(itemId);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const performAction = (action) => {
    if (!contextMenuItemId) return;
    const item = mediaItems.find(m => m.id === contextMenuItemId);
    if (!item) return;

    switch(action) {
      case 'tag':
        setSelectedImage(item);
        setImageViewerOpen(true);
        break;
      case 'rotate':
        setSelectedImage(item);
        setTransform(prev => ({ ...prev, rotate: prev.rotate + 90 }));
        break;
      case 'delete':
        if (confirm(`Radera "${item.name}" permanent?`)) {
          setMediaItems(prev => prev.filter(m => m.id !== item.id));
        }
        break;
    }
    setContextMenuOpen(false);
  };

  const filteredMedia = mediaItems.filter(m => {
    const matchesLib = activeLib === 'all' || m.libraryId === activeLib;
    const q = search.toLowerCase();
    const matchesSearch = !q || (
        m.name.toLowerCase().includes(q) || 
        m.date.includes(q) || 
        m.tags.some(t => t.toLowerCase().includes(q)) || 
        m.connections.people.some(c => c.name.toLowerCase().includes(q) || c.ref.toLowerCase().includes(q)) || 
        (m.event && (m.event.type.toLowerCase().includes(q) || m.event.place.toLowerCase().includes(q))) || 
        (m.transcription && m.transcription.toLowerCase().includes(q))
    );
    const matchesUnlinked = filterUnlinked ? (m.connections.people.length === 0 && m.connections.places.length === 0 && m.connections.sources.length === 0) : true; 
    return matchesLib && matchesSearch && matchesUnlinked;
  });

  // --- ACTIONS ---

  const handleStartCreateLibrary = () => {
    const newId = `lib_${Date.now()}`;
    const newLib = { id: newId, label: 'Nytt Album', icon: Folder, type: 'custom' };
    setCustomLibraries([...customLibraries, newLib]);
    setEditingLibId(newId); 
    setTempLibName('Nytt Album');
    setTimeout(() => libInputRef.current?.select(), 50); 
  };

  const handleStartRenameLibrary = (lib, e) => {
    e.stopPropagation();
    setEditingLibId(lib.id);
    setTempLibName(lib.label);
    setTimeout(() => libInputRef.current?.focus(), 50);
  };

  const handleSaveLibraryName = () => {
    if (editingLibId && tempLibName.trim()) {
        setCustomLibraries(prev => prev.map(l => l.id === editingLibId ? { ...l, label: tempLibName } : l));
    } 
    setEditingLibId(null);
  };

  const handleKeyDownLibrary = (e) => {
      if (e.key === 'Enter') handleSaveLibraryName();
      if (e.key === 'Escape') setEditingLibId(null); 
  };

  const handleDeleteLibrary = (id, e) => {
    e.stopPropagation();
    if (confirm("Vill du radera detta album? Bilder inuti raderas inte utan hamnar i 'Alla bilder'.")) {
      setCustomLibraries(prev => prev.filter(l => l.id !== id));
      setMediaItems(prev => prev.map(m => m.libraryId === id ? { ...m, libraryId: 'gallery' } : m));
      if (activeLib === id) setActiveLib('all');
    }
  };

  const handleImageClick = (item, e) => {
      let newSelected = new Set(selectedIds);
      if (e.ctrlKey || e.metaKey) {
          if (newSelected.has(item.id)) newSelected.delete(item.id);
          else newSelected.add(item.id);
          setLastSelectedId(item.id);
      } else if (e.shiftKey && lastSelectedId) {
          const ids = filteredMedia.map(m => m.id);
          const lastIdx = ids.indexOf(lastSelectedId);
          const currIdx = ids.indexOf(item.id);
          if (lastIdx !== -1 && currIdx !== -1) {
              const start = Math.min(lastIdx, currIdx);
              const end = Math.max(lastIdx, currIdx);
              const range = ids.slice(start, end + 1);
              range.forEach(id => newSelected.add(id));
          } else newSelected = new Set([item.id]);
      } else {
          newSelected = new Set([item.id]);
          setLastSelectedId(item.id);
      }

      setSelectedIds(newSelected);
      
      setTransform({ x: 0, y: 0, scale: 1, rotate: 0 });

      if (newSelected.size === 1) setSelectedImage(mediaItems.find(m => m.id === Array.from(newSelected)[0]));
      else setSelectedImage(newSelected.has(item.id) ? item : null);
      setIsSelectMode(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredMedia.length) { setSelectedIds(new Set()); setIsSelectMode(false); }
    else { setSelectedIds(new Set(filteredMedia.map(m => m.id))); setIsSelectMode(true); }
  };

  const handleToggleSelect = (itemId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(itemId)) newSelected.delete(itemId);
    else newSelected.add(itemId);
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = () => {
    if (confirm(`Radera ${selectedIds.size} bilder permanent?`)) {
      setMediaItems(prev => prev.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setSelectedImage(null);
    }
  };

  const handleBatchMove = (targetLibId) => {
    setMediaItems(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, libraryId: targetLibId } : m));
    setSelectedIds(new Set());
    setIsSelectMode(false);
    setIsMoveModalOpen(false);
  };

  const handleItemDragStart = (e, itemId) => {
      let idsToDrag = [];
      if (selectedIds.has(itemId)) idsToDrag = Array.from(selectedIds);
      else { idsToDrag = [itemId]; setSelectedIds(new Set([itemId])); setSelectedImage(mediaItems.find(m => m.id === itemId)); }
      e.dataTransfer.setData('application/json', JSON.stringify({ ids: idsToDrag }));
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleLibraryDrop = (targetLibId, ids) => {
      setMediaItems(prev => prev.map(m => ids.includes(m.id) ? { ...m, libraryId: targetLibId } : m));
  };

  const handleBatchEditSave = ({ date, tags }) => {
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      setMediaItems(prev => prev.map(m => {
          if (selectedIds.has(m.id)) return { ...m, date: date || m.date, tags: [...new Set([...m.tags, ...tagArray])] };
          return m;
      }));
      setIsBatchEditOpen(false);
      setSelectedIds(new Set());
      setIsSelectMode(false);
  };

  const handleFiles = (files) => {
    const newItems = Array.from(files).map(file => ({
      id: Date.now() + Math.random(),
      url: URL.createObjectURL(file),
      name: file.name,
      date: new Date().toISOString().split('T')[0],
      libraryId: activeLib === 'all' ? 'gallery' : activeLib,
      isProfile: false,
      connections: { people: [], places: [], sources: [] },
      event: null,
      tags: ['Ny uppladdning'],
      faces: [],
      transcription: '',
      description: ''
    }));
    setMediaItems(prev => [...newItems, ...prev]);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e) => {
      const items = e.clipboardData.items;
      const files = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) files.push(items[i].getAsFile());
      }
      if (files.length > 0) { e.preventDefault(); handleFiles(files); }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, activeLib]);

  useEffect(() => setTransform({ x: 0, y: 0, scale: 1, rotate: 0 }), [selectedImage]);
  const handleWheel = (e) => { e.preventDefault(); const s = -e.deltaY * 0.001; setTransform(p => ({ ...p, scale: Math.min(Math.max(0.5, p.scale + s), 5) })); };
  const handleMouseDown = (e) => { e.preventDefault(); setIsPanning(true); panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }; };
  const handleMouseMove = (e) => { if (!isPanning) return; e.preventDefault(); setTransform(p => ({ ...p, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })); };
  const handleMouseUp = () => setIsPanning(false);
  
  const handleRotate = () => setTransform(prev => ({ ...prev, rotate: prev.rotate + 90 }));
  const handleCrop = () => alert("Öppna beskärningsverktyg...");
  const handleTagFace = () => {
    if (selectedImage) {
      setImageViewerOpen(true);
    }
  };
  const handleDelete = () => {
    if (selectedImage && confirm(`Radera "${selectedImage.name}" permanent?`)) {
      setMediaItems(prev => prev.filter(m => m.id !== selectedImage.id));
      setSelectedImage(null);
      setContextMenuOpen(false);
    }
  };

  if (!isOpen) return null;

  const windowStyle = winState.isMaximized 
    ? { top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0 }
    : winState.isMinimized 
        ? { bottom: 10, left: 10, width: 250, height: 40, overflow: 'hidden' } 
        : { top: winState.y, left: winState.x, width: winState.width, height: winState.height };

  return (
    <div className={`fixed z-[70] ${!winState.isMaximized ? 'inset-0' : ''}`}>
        
        {/* WINDOW CONTAINER */}
        <div className={`bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ease-out 
             ${winState.isMaximized ? '' : 'rounded-xl'}`}
             style={{ ...windowStyle, position: 'fixed' }}
        >
        
        {/* WINDOW HEADER */}
        <div 
            className="bg-slate-900 border-b border-slate-800 p-2 flex justify-between items-center select-none cursor-grab active:cursor-grabbing"
            onMouseDown={startDrag}
        >
            <div className="flex items-center gap-2 text-slate-300 text-sm font-bold pl-2">
                <Layers size={16}/> Mediahanterare
            </div>
            <div className="flex items-center gap-1">
                <button onClick={toggleMinimize} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Minimera"><Minus size={16}/></button>
                <button onClick={toggleMaximize} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title={winState.isMaximized ? "Återställ" : "Maximera"}>
                    {winState.isMaximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                </button>
                <button onClick={onClose} className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400" title="Stäng"><X size={16}/></button>
            </div>
        </div>

        {/* CONTENT (Hidden if minimized) */}
        {!winState.isMinimized && (
            <div className="flex-1 flex overflow-hidden">
                
                {/* VÄNSTER: Bibliotek */}
                <div className="w-64 bg-slate-800/50 border-r border-slate-700 flex flex-col shrink-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-2 space-y-1">
                        <p className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">Bibliotek</p>
                        {SYSTEM_LIBRARIES.map(lib => (
                        <LibraryButton key={lib.id} lib={lib} isActive={activeLib === lib.id} onClick={() => { setActiveLib(lib.id); setSelectedImage(null); setIsSelectMode(false); setFilterUnlinked(false); }} onDrop={handleLibraryDrop}/>
                        ))}
                        <button onClick={() => { setFilterUnlinked(!filterUnlinked); setActiveLib('all'); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors ${filterUnlinked ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                            <AlertCircle size={16} /> Okopplade ({mediaItems.filter(m => m.connections.people.length === 0 && m.connections.places.length === 0 && m.connections.sources.length === 0).length})
                        </button>
                    </div>
                    <div className="p-2 space-y-1 border-t border-slate-700/50">
                        <div className="flex justify-between items-center px-3 py-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase">Mina Album</p>
                            <button onClick={handleStartCreateLibrary} className="text-slate-500 hover:text-white bg-slate-800 p-1 rounded hover:bg-slate-700 transition-colors"><Plus size={12}/></button>
                        </div>
                        {customLibraries.map(lib => (
                            <div key={lib.id}>
                            {editingLibId === lib.id ? (
                                <div className="flex items-center gap-2 w-full px-2 py-1">
                                    <Folder size={16} className="text-blue-400 shrink-0"/>
                                    <input ref={libInputRef} type="text" value={tempLibName} onChange={(e) => setTempLibName(e.target.value)} onBlur={handleSaveLibraryName} onKeyDown={handleKeyDownLibrary} className="w-full bg-slate-900 text-white text-sm px-1 py-0.5 rounded border border-blue-500 focus:outline-none"/>
                                </div>
                            ) : (
                                <LibraryButton lib={lib} isActive={activeLib === lib.id} onClick={() => { setActiveLib(lib.id); setIsSelectMode(false); setFilterUnlinked(false); }} onDelete={handleDeleteLibrary} onDrop={handleLibraryDrop}/>
                            )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700">
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)}/>
                    <button onClick={() => fileInputRef.current.click()} className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm transition-colors font-medium">
                    <UploadCloud size={16}/> Ladda upp
                    </button>
                </div>
                </div>

                {/* MITTEN: Galleri */}
                <div className="flex-1 flex flex-col bg-slate-900 min-w-0 relative">
                
                <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-800/30">
                    <div className="flex gap-2 items-center">
                        <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds(new Set()); setSelectedImage(null); }} className={`px-3 py-1.5 rounded text-sm border transition-colors ${isSelectMode ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white'}`}>
                            {isSelectMode ? 'Klar' : 'Välj'}
                        </button>
                        <button onClick={handleSelectAll} className="text-xs text-slate-400 hover:text-white px-2">
                            {selectedIds.size === filteredMedia.length ? 'Avmarkera alla' : 'Markera alla'}
                        </button>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="relative w-48">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                            <input type="text" placeholder="Sök..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-full pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"/>
                        </div>
                        <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-700">
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><Grid size={16}/></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><List size={16}/></button>
                        </div>
                    </div>
                </div>

                <div 
                    className="flex-1 overflow-y-auto p-4 custom-scrollbar relative"
                    onDragOver={(e) => {e.preventDefault(); setIsDraggingFile(true);}}
                    onDragLeave={(e) => {e.preventDefault(); setIsDraggingFile(false);}}
                    onDrop={(e) => {e.preventDefault(); setIsDraggingFile(false); if(e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);}}
                >
                    {isDraggingFile && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-900/20 backdrop-blur-sm border-2 border-blue-500 border-dashed m-4 rounded-xl pointer-events-none">
                            <div className="text-center text-blue-400"><UploadCloud size={64} className="mx-auto mb-2"/><h3 className="font-bold">Släpp filerna här</h3></div>
                        </div>
                    )}
                    {filteredMedia.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <FileWarning size={48} className="mb-2 opacity-20"/>
                            <p className="text-sm">Inga bilder hittades.</p>
                        </div>
                    )}
                    {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredMedia.map(item => (
                        <div key={item.id} 
                            onClick={(e) => handleImageClick(item, e)}
                            onContextMenu={(e) => handleContextMenu(e, item.id)}
                            draggable
                            onDragStart={(e) => handleItemDragStart(e, item.id)}
                            className={`group relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${selectedIds.has(item.id) ? 'border-blue-500 ring-2 ring-blue-500/30' : (selectedImage?.id === item.id ? 'border-blue-500' : 'border-slate-700 hover:border-slate-500')}`}
                        >
                            <img 
                                src={item.url} 
                                alt={item.name} 
                                className="w-full h-full object-cover" 
                                onContextMenu={(e) => handleContextMenu(e, item.id)}
                            /> 
                            {(isSelectMode || selectedIds.has(item.id)) && (
                                <div className="absolute top-2 right-2 z-20" onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id); }}>
                                    {selectedIds.has(item.id) 
                                        ? <div className="bg-blue-600 rounded text-white shadow-lg"><CheckSquare size={24} fill="currentColor" className="text-white" /></div>
                                        : <div className="bg-black/40 rounded hover:bg-black/70 shadow-lg"><Square size={24} className="text-white"/></div>
                                    }
                                </div>
                            )}
                            {item.connections.people.length === 0 && item.connections.places.length === 0 && item.connections.sources.length === 0 && (
                                <div className="absolute top-2 left-2 bg-yellow-600 text-white p-1 rounded-full shadow-md" title="Okopplad">
                                <AlertCircle size={10}/>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                            <p className="text-white text-xs font-medium truncate">{item.name}</p>
                            </div>
                        </div>
                        ))}
                    </div>
                    ) : (
                    <div className="flex flex-col gap-1">
                        {filteredMedia.map(item => (
                            <div key={item.id} 
                                onClick={(e) => handleImageClick(item, e)} 
                                onContextMenu={(e) => handleContextMenu(e, item.id)}
                                draggable 
                                onDragStart={(e) => handleItemDragStart(e, item.id)} 
                                className={`flex items-center gap-4 p-2 rounded border cursor-pointer ${selectedIds.has(item.id) ? 'bg-blue-900/30 border-blue-500' : (selectedImage?.id === item.id ? 'bg-slate-800 border-blue-500' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800')}`}
                            >
                                <div className="w-8 flex justify-center">
                                    {(isSelectMode || selectedIds.has(item.id)) && (selectedIds.has(item.id) ? <CheckSquare size={18} className="text-blue-500"/> : <Square size={18} className="text-slate-500"/>)}
                                </div>
                                <div className="w-10 h-10 bg-slate-900 rounded overflow-hidden shrink-0 border border-slate-600">
                                    <img src={item.url} className="w-full h-full object-cover pointer-events-none"/>
                                </div>
                                <span className="text-sm text-slate-200 flex-1 truncate font-medium">{item.name}</span>
                                <span className="text-xs text-slate-500">{item.date}</span>
                                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                        {allLibraries.find(l => l.id === item.libraryId)?.label || 'Okänt'}
                                </span>
                                {item.connections.people.length === 0 && <AlertCircle size={14} className="text-yellow-500" title="Okopplad"/>}
                            </div>
                        ))}
                    </div>
                    )}
                </div>

                {/* Context Menu */}
                {contextMenuOpen && (
                    <div 
                        className="fixed bg-slate-900 border border-slate-600 rounded-lg shadow-2xl z-[9999] py-1 animate-in fade-in zoom-in-95 duration-100 w-40"
                        style={{ top: `${contextMenuPos.y}px`, left: `${contextMenuPos.x}px` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); performAction('tag'); }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 whitespace-nowrap"
                        >
                            <ScanFace size={16}/> Tagga
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); performAction('rotate'); }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 whitespace-nowrap"
                        >
                            <RotateCw size={16}/> Rotera
                        </button>
                        <div className="border-t border-slate-700 my-1"></div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); performAction('delete'); }}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2 whitespace-nowrap"
                        >
                            <Trash2 size={16}/> Radera
                        </button>
                    </div>
                )}

                {selectedIds.size > 0 && (
                    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 text-white px-2 py-1.5 rounded-full shadow-2xl flex gap-2 items-center animate-in slide-in-from-bottom-4 z-50">
                        <span className="text-xs font-bold text-slate-300 px-2 border-r border-slate-600">{selectedIds.size} valda</span>
                        <button onClick={() => setIsBatchEditOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-slate-700 rounded-full transition-colors">
                            <Edit2 size={14}/> Redigera
                        </button>
                        <button onClick={() => setIsMoveModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-slate-700 rounded-full transition-colors">
                            <MoveRight size={14}/> Flytta
                        </button>
                        <button onClick={handleBatchDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-full transition-colors">
                            <Trash2 size={14}/> Radera
                        </button>
                    </div>
                )}
                
                <MoveFilesModal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} onMove={handleBatchMove} libraries={allLibraries} />
                <BatchEditModal isOpen={isBatchEditOpen} onClose={() => setIsBatchEditOpen(false)} onSave={handleBatchEditSave} count={selectedIds.size} />
                </div>

                {/* HÖGER: Detaljpanel */}
                {selectedImage ? (
                <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-200 z-20 shadow-xl">
                    <div className="p-4 border-b border-slate-700 flex justify-between bg-slate-800">
                        <h3 className="text-sm font-bold text-white truncate w-64">{selectedImage.name}</h3>
                        <div className="flex items-center gap-2">
                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setContextMenuOpen(!contextMenuOpen); }} 
                                    className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
                                >
                                    <MoreVertical size={18}/>
                                </button>
                                {contextMenuOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl z-[9999] py-1 animate-in fade-in zoom-in-95 duration-100" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                            onClick={() => { handleTagFace(); setContextMenuOpen(false); }}
                                            className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                                        >
                                            <ScanFace size={16}/> Tagga
                                        </button>
                                        <button 
                                            onClick={() => { handleRotate(); setContextMenuOpen(false); }}
                                            className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                                        >
                                            <RotateCw size={16}/> Rotera
                                        </button>
                                        <div className="border-t border-slate-700 my-1"></div>
                                        <button 
                                            onClick={() => { handleDelete(); }}
                                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2"
                                        >
                                            <Trash2 size={16}/> Radera
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-white"><X size={18}/></button>
                        </div>
                    </div>
                    <div 
                        className="aspect-video bg-black/50 relative overflow-hidden cursor-grab active:cursor-grabbing border-b border-slate-700 group"
                        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                        onDoubleClick={() => setTransform({x:0, y:0, scale:1, rotate:0})}
                    >
                        <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotate}deg)`, transition: isPanning ? 'none' : 'transform 0.1s', transformOrigin: 'center', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={selectedImage.url} className="max-w-full max-h-full object-contain pointer-events-none" />
                            <FaceOverlay faces={selectedImage.faces} />
                        </div>
                        
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button className="flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur rounded text-xs text-white hover:bg-blue-600 transition-colors" onClick={(e) => { e.stopPropagation(); handleTagFace(); }} title="Tagga ansikte">
                                <ScanFace size={14}/> <span className="font-medium">Tagga</span>
                            </button>
                        </div>

                        <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setTransform(p => ({...p, scale: Math.max(0.5, p.scale - 0.5)}))} className="p-1.5 bg-black/60 rounded text-white hover:bg-blue-600 transition-colors"><ZoomOut size={14}/></button>
                        <button onClick={() => setTransform({x:0, y:0, scale:1, rotate: 0})} className="p-1.5 bg-black/60 rounded text-white hover:bg-blue-600 transition-colors"><Maximize size={14}/></button>
                        <button onClick={() => setTransform(p => ({...p, scale: Math.min(5, p.scale + 0.5)}))} className="p-1.5 bg-black/60 rounded text-white hover:bg-blue-600 transition-colors"><ZoomIn size={14}/></button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 p-2 border-b border-slate-700 bg-slate-800/50">
                        <button onClick={handleTagFace} className="flex flex-col items-center justify-center p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] gap-1 transition-colors">
                            <ScanFace size={16}/> Tagga
                        </button>
                        <button onClick={handleRotate} className="flex flex-col items-center justify-center p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] gap-1 transition-colors">
                            <RotateCw size={16}/> Rotera
                        </button>
                        <button onClick={handleCrop} className="flex flex-col items-center justify-center p-2 rounded hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] gap-1 transition-colors">
                            <Crop size={16}/> Beskär
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-800">
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Datering</label>
                                <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2 py-1.5">
                                    <Calendar size={14} className="text-slate-500 mr-2"/>
                                    <input type="text" defaultValue={selectedImage.date} className="bg-transparent text-sm text-white w-full focus:outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Bibliotek / Kategori</label>
                                <select 
                                    defaultValue={selectedImage.libraryId}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                >
                                    {SYSTEM_LIBRARIES.filter(l => l.id !== 'all').map(l => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                    {customLibraries.map(l => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Bildtext / Beskrivning</label>
                            <div className="bg-slate-900 border border-slate-600 rounded p-2">
                                <textarea className="w-full bg-transparent text-sm text-white focus:outline-none resize-y min-h-[60px]" placeholder="Skriv en beskrivning..." defaultValue={selectedImage.description} />
                                <div className="flex justify-end mt-1">
                                    <button className="text-slate-500 hover:text-white" title="Tala in memo"><Mic size={14}/></button>
                                </div>
                            </div>
                        </div>

                        {selectedImage.libraryId === 'sources' && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Transkribering</label>
                                    <button onClick={() => setShowTranscription(!showTranscription)} className="text-xs flex items-center gap-1 text-blue-400 hover:text-white">
                                        <PenTool size={12}/> {showTranscription ? 'Dölj' : 'Visa / Redigera'}
                                    </button>
                                </div>
                                {showTranscription && (
                                    <textarea className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" placeholder="Skriv av texten här..." defaultValue={selectedImage.transcription} />
                                )}
                            </div>
                        )}
                        
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-700 pb-1">Kopplingar</h4>
                            
                            {/* Personer */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-400">Personer</label>
                                </div>
                                {selectedImage.connections.people.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                                        <div><span className="text-slate-200 font-medium block">{p.name}</span><span className="text-[10px] text-slate-500">{p.dates}</span></div>
                                        <button className="text-slate-500 hover:text-red-400"><X size={12}/></button>
                                    </div>
                                ))}
                                <button className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"><Plus size={12}/> Koppla person</button>
                            </div>

                            {/* Källor */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-400">Källor</label>
                                </div>
                                {selectedImage.connections.sources.map(s => (
                                    <div key={s.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                                        <div><span className="text-slate-200 font-medium block">{s.name}</span><span className="text-[10px] text-slate-500">{s.ref}</span></div>
                                        <button className="text-slate-500 hover:text-red-400"><X size={12}/></button>
                                    </div>
                                ))}
                                <button className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"><Link size={12}/> Koppla källa</button>
                            </div>

                            {/* Platser */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10px] font-bold text-slate-400">Platser</label>
                                </div>
                                {selectedImage.connections.places.map(p => (
                                    <div key={p.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                                        <div><span className="text-slate-200 font-medium block">{p.name}</span><span className="text-[10px] text-slate-500">{p.type}</span></div>
                                        <button className="text-slate-500 hover:text-red-400"><X size={12}/></button>
                                    </div>
                                ))}
                                <button className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"><MapPin size={12}/> Koppla plats</button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Taggar</label>
                            <div className="flex flex-wrap gap-2">
                                {selectedImage.tags.map(t => (
                                    <span key={t} className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">{t} <button className="hover:text-white"><X size={10}/></button></span>
                                ))}
                                <button className="text-xs text-slate-400 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-full hover:text-white hover:border-slate-500">+ Tagg</button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-between items-center">
                        <button className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors"><Trash2 size={14}/> Ta bort fil</button>
                        <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02]"><Save size={14}/> Spara</button>
                    </div>
                </div>
                ) : null}

            </div>
        )}
        
        {/* RESIZE HANDLE */}
        {!winState.isMaximized && !winState.isMinimized && (
            <div 
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center"
              onMouseDown={startResize}
            >
              <div className="w-2 h-2 bg-slate-500 rounded-full"/>
            </div>
        )}

        {/* IMAGE VIEWER FOR FACE TAGGING */}
        <ImageViewer
          isOpen={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
          imageSrc={selectedImage?.url}
          imageTitle={selectedImage?.name}
          regions={selectedImage?.faces || []}
          onSaveRegions={(newRegions) => {
            if (selectedImage) {
              setMediaItems(prev => prev.map(item => 
                item.id === selectedImage.id 
                  ? { ...item, faces: newRegions }
                  : item
              ));
              setSelectedImage({ ...selectedImage, faces: newRegions });
            }
          }}
          people={allPeople || []}
          onOpenEditModal={onOpenEditModal}
        />
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; border: 2px solid #0f172a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}

export default function DemoWrapper() {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      {!isOpen && <button onClick={() => setIsOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium">Öppna Mediahanterare</button>}
      <MediaManagerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
