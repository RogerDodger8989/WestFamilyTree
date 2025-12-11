import React, { useState, useEffect, useRef } from 'react';
import ImageViewer from './ImageViewer.jsx';
import ImageEditorModal from './ImageEditorModal.jsx';
import { useApp } from './AppContext.jsx';
import { 
  Search, Image as ImageIcon, Grid, List, Tag, User, 
  MapPin, Calendar, Plus, Trash2, AlertCircle, UploadCloud, 
  Crop, RotateCw, ScanFace, ZoomIn, ZoomOut, Maximize,
  FolderPlus, Folder, CheckSquare, Square, MoveRight,
  Check, Edit2, FileWarning, PenTool, Mic, Link,
  X, Layers, FileText, MoreVertical, Save, Camera,
  Download, Upload, RefreshCw, Database, Info
} from 'lucide-react';

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
    filePath: 'kallor/porträtt_1910.jpg', // Exempel-sökväg
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

const MoveFilesModal = ({ isOpen, onClose, onMove, libraries }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-80 overflow-hidden">
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
            <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-96 overflow-hidden">
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
        </div>
    );
};

export function MediaManager({ allPeople = [], onOpenEditModal = () => {}, mediaItems: initialMedia = [], onUpdateMedia = () => {}, setIsSourceDrawerOpen = () => {}, setIsPlaceDrawerOpen = () => {} }) {
  const { showUndoToast, showStatus } = useApp();

  // UI State
  const [viewMode, setViewMode] = useState('grid'); 
  const [activeLib, setActiveLib] = useState('all');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [search, setSearch] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [filterUnlinked, setFilterUnlinked] = useState(false);
  
  // Context Menu State
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuItemId, setContextMenuItemId] = useState(null);
  
  // Image Editor State
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  
  // EXIF State - moved to selection state
  const [editingImage, setEditingImage] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const pendingDeleteTimeout = useRef(null);
  
  // Data State - Use media from database, fallback to INITIAL_MEDIA for demo
  const [mediaItems, setMediaItems] = useState(initialMedia.length > 0 ? initialMedia : INITIAL_MEDIA);
  
  // Synka mediaItems med initialMedia prop när den ändras
  useEffect(() => {
    setMediaItems(initialMedia.length > 0 ? initialMedia : INITIAL_MEDIA);
  }, [initialMedia]);
  
  // Get all available sources and places (after mediaItems is defined)
  const allSources = mediaItems
    .flatMap(m => m.connections.sources || [])
    .filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i); // Unique by id
  
  const allPlaces = mediaItems
    .flatMap(m => m.connections.places || [])
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i); // Unique by id
  
  // Helper to update media and notify parent
  const updateMedia = (newMediaOrUpdater) => {
    setMediaItems(prev => {
      const newMedia = typeof newMediaOrUpdater === 'function' ? newMediaOrUpdater(prev) : newMediaOrUpdater;
      onUpdateMedia(newMedia);
      return newMedia;
    });
  };
  
  // Context Menu Handlers
  const handleContextMenu = (e, itemId) => {
    e.preventDefault();
    e.stopPropagation();
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
        // Open image editor for rotation
        const rotateItem = mediaItems.find(m => m.id === contextMenuItemId);
        if (rotateItem) {
          setEditingImage(rotateItem);
          setIsImageEditorOpen(true);
        }
        break;
      case 'delete':
        if (confirm(`Radera "${item.name}" permanent?`)) {
          updateMedia(mediaItems.filter(m => m.id !== item.id));
        }
        break;
    }
    setContextMenuOpen(false);
  };

  // Open image editor on double click
  const handleImageDoubleClick = (item, e) => {
    e.stopPropagation();
    setEditingImage(item);
    setIsImageEditorOpen(true);
  };

  // Handle saving edited image
  const handleSaveEditedImage = (blob, createCopy) => {
    if (!editingImage) return;

    // Convert blob to data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const newImageUrl = reader.result;

      if (createCopy) {
        // Create new copy with new ID
        const newId = Date.now();
        const newImage = {
          ...editingImage,
          id: newId,
          url: newImageUrl,
          name: `${editingImage.name.replace(/\.[^/.]+$/, '')}_redigerad.jpg`
        };
        updateMedia([...mediaItems, newImage]);
      } else {
        // Overwrite original
        updateMedia(mediaItems.map(m => 
          m.id === editingImage.id 
            ? { ...m, url: newImageUrl }
            : m
        ));
      }

      setEditingImage(null);
      setIsImageEditorOpen(false);
    };
    reader.readAsDataURL(blob);
  };

  const handleRequestDeleteEditingImage = () => {
    if (!editingImage) return;

    // First click: ask for confirmation via status toast
    if (pendingDeleteId !== editingImage.id) {
      setPendingDeleteId(editingImage.id);
      if (pendingDeleteTimeout.current) clearTimeout(pendingDeleteTimeout.current);
      pendingDeleteTimeout.current = setTimeout(() => setPendingDeleteId(null), 4000);
      if (typeof showStatus === 'function') showStatus('Klicka "Ta bort" igen för att bekräfta.', 'warn');
      return;
    }

    // Confirmed: remove image and offer undo
    if (pendingDeleteTimeout.current) {
      clearTimeout(pendingDeleteTimeout.current);
      pendingDeleteTimeout.current = null;
    }
    setPendingDeleteId(null);

    const removedImage = editingImage;
    const deletionIndex = filteredMedia.findIndex(m => m.id === removedImage.id);

    updateMedia(prev => prev.filter(m => m.id !== removedImage.id));
    setIsImageEditorOpen(false);
    setEditingImage(null);
    setSelectedImage(current => (current && current.id === removedImage.id ? null : current));

    if (typeof showStatus === 'function') showStatus(`"${removedImage.name}" har raderats.`, 'success');

    if (typeof showUndoToast === 'function') {
      showUndoToast(`"${removedImage.name}" har raderats. Ångra?`, () => {
        updateMedia(prev => {
          if (prev.some(m => m.id === removedImage.id)) return prev;
          const newMedia = [...prev];
          const insertAt = deletionIndex >= 0 ? Math.min(deletionIndex, newMedia.length) : newMedia.length;
          newMedia.splice(insertAt, 0, removedImage);
          return newMedia;
        });
        setSelectedImage(removedImage);
      });
    }
  };
  
  const [customLibraries, setCustomLibraries] = useState([
    { id: 'album1', label: 'Okända soldater', icon: Folder, type: 'custom' }
  ]);
  
  // Helper function: Synka face tags med personer i databasen
  const syncFaceTagsWithPeople = () => {
    if (!exifData || !exifData.face_tags || exifData.face_tags.length === 0) {
      alert('Inga face tags att synka');
      return;
    }

    const matchedPeople = [];
    const unmatchedTags = [];

    exifData.face_tags.forEach(faceTag => {
      const faceName = faceTag.name.toLowerCase().trim();
      
      // Försök matcha med befintliga personer
      const match = allPeople.find(person => {
        const personName = person.name.toLowerCase().trim();
        // Exakt matchning först
        if (personName === faceName) return true;
        
        // Dela upp namn och försök matcha delar
        const faceNameParts = faceName.split(/\s+/);
        const personNameParts = personName.split(/\s+/);
        
        // Matcha om alla delar av face tag finns i personnamn
        return faceNameParts.every(part => 
          personNameParts.some(pPart => pPart.includes(part) || part.includes(pPart))
        );
      });

      if (match) {
        matchedPeople.push({ ...match, faceName: faceTag.name });
      } else {
        unmatchedTags.push(faceTag.name);
      }
    });

    // Lägg till matchade personer till bildens connections
    if (matchedPeople.length > 0) {
      const newPeople = matchedPeople.map(p => ({
        id: p.id,
        name: p.name,
        ref: p.ref || p.id,
        dates: `${p.birth_year || '?'}–${p.death_year || '?'}`
      }));

      // Filtrera bort dubbletter
      const existingIds = new Set(selectedImage.connections.people.map(p => p.id));
      const peopleToAdd = newPeople.filter(p => !existingIds.has(p.id));

      if (peopleToAdd.length > 0) {
        updateMedia(mediaItems.map(item => 
          item.id === selectedImage.id 
            ? { 
                ...item, 
                connections: { 
                  ...item.connections, 
                  people: [...item.connections.people, ...peopleToAdd] 
                }
              }
            : item
        ));
        setSelectedImage({
          ...selectedImage,
          connections: {
            ...selectedImage.connections,
            people: [...selectedImage.connections.people, ...peopleToAdd]
          }
        });
      }

      const message = `
Synkning klar!
✓ ${matchedPeople.length} personer matchade
${peopleToAdd.length > 0 ? `  └─ ${peopleToAdd.length} nya kopplingar tillagda` : '  └─ Alla fanns redan kopplade'}
${unmatchedTags.length > 0 ? `\n✗ ${unmatchedTags.length} omatchade: ${unmatchedTags.join(', ')}` : ''}
      `.trim();
      
      alert(message);
    } else {
      alert(`Inga personer kunde matchas automatiskt.\n\nOmatchade: ${unmatchedTags.join(', ')}`);
    }
  };
  
  // Selection & Interaction State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState(null); 
  const [showTranscription, setShowTranscription] = useState(false);
  
  // EXIF State - läs automatiskt när bilden väljs
  const [exifData, setExifData] = useState(null);
  const [exifExpanded, setExifExpanded] = useState(true);
  const [loadingExif, setLoadingExif] = useState(false);

  // Library Management State
  const [editingLibId, setEditingLibId] = useState(null); 
  const [tempLibName, setTempLibName] = useState(''); 

  // Modals State
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);

  // Zoom & Transform State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1, rotate: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  
  const fileInputRef = useRef(null);
  const libInputRef = useRef(null); 

  const allLibraries = [...SYSTEM_LIBRARIES, ...customLibraries];

  // Läs alltid fresh data från mediaItems - använd selectedImage bara för att hitta ID
  const displayImage = selectedImage ? (mediaItems.find(m => m.id === selectedImage.id) || selectedImage) : null;

  const filteredMedia = mediaItems.filter(m => {
    const matchesLib = activeLib === 'all' || m.libraryId === activeLib;
    const q = search.toLowerCase();
    const matchesSearch = !q || (
        m.name.toLowerCase().includes(q) || 
        m.date.includes(q) || 
        m.tags.some(t => t.toLowerCase().includes(q)) || 
        m.connections.people.some(c => c.name.toLowerCase().includes(q) || c.ref.toLowerCase().includes(q)) || 
        (m.transcription && m.transcription.toLowerCase().includes(q))
    );
    const matchesUnlinked = filterUnlinked ? (m.connections.people.length === 0 && m.connections.places.length === 0 && m.connections.sources.length === 0) : true; 
    return matchesLib && matchesSearch && matchesUnlinked;
  });

  const editingIndex = editingImage ? filteredMedia.findIndex(m => m.id === editingImage.id) : -1;
  const prevEditingImage = editingIndex > 0 ? filteredMedia[editingIndex - 1] : null;
  const nextEditingImage = editingIndex >= 0 && editingIndex < filteredMedia.length - 1 ? filteredMedia[editingIndex + 1] : null;

  const handlePrevEditing = () => {
    if (!prevEditingImage) return;
    setEditingImage(prevEditingImage);
    setSelectedImage(prevEditingImage);
  };

  const handleNextEditing = () => {
    if (!nextEditingImage) return;
    setEditingImage(nextEditingImage);
    setSelectedImage(nextEditingImage);
  };

  // Context menu close handlers
  useEffect(() => {
    if (!contextMenuOpen) return;

    const handleClickOutside = (e) => {
      setContextMenuOpen(false);
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuOpen]);

  // Cleanup pending delete timer
  useEffect(() => () => {
    if (pendingDeleteTimeout.current) {
      clearTimeout(pendingDeleteTimeout.current);
    }
  }, []);

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
      updateMedia(mediaItems.map(m => m.libraryId === id ? { ...m, libraryId: 'gallery' } : m));
      if (activeLib === id) setActiveLib('all');
    }
  };

  const handleImageClick = (item, e) => {
      console.log('🖱️ Image clicked:', { itemId: item.id, itemName: item.name, mediaItemsCount: mediaItems.length });
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

      if (newSelected.size === 1) {
          const found = mediaItems.find(m => m.id === Array.from(newSelected)[0]);
          console.log('✅ Setting selectedImage:', { found, findId: Array.from(newSelected)[0] });
          setSelectedImage(found);
      } else {
          console.log('⚠️ Multiple selected, setting to item or null:', newSelected.has(item.id));
          setSelectedImage(newSelected.has(item.id) ? item : null);
      }
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
      updateMedia(mediaItems.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setSelectedImage(null);
    }
  };

  const handleBatchMove = (targetLibId) => {
    updateMedia(mediaItems.map(m => selectedIds.has(m.id) ? { ...m, libraryId: targetLibId } : m));
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
      updateMedia(mediaItems.map(m => ids.includes(m.id) ? { ...m, libraryId: targetLibId } : m));
  };

  const handleBatchEditSave = ({ date, tags }) => {
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      updateMedia(mediaItems.map(m => {
          if (selectedIds.has(m.id)) return { ...m, date: date || m.date, tags: [...new Set([...m.tags, ...tagArray])] };
          return m;
      }));
      setIsBatchEditOpen(false);
      setSelectedIds(new Set());
      setIsSelectMode(false);
  };

  const handleFiles = async (files) => {
    const newItems = [];
    
    for (const file of Array.from(files)) {
      let finalFilePath = file.name;
      let success = false;
      let thumbnail = null;
      let fileSize = file.size;
      let dimensions = { width: 0, height: 0 };
      
      // Om vi kör i Electron, kopiera filen till media-mappen
      if (window.electronAPI) {
        try {
          // Försök först med file.path om det finns (från file dialog)
          if (file.path && window.electronAPI.copyFileToMedia) {
            console.log('[MediaManager] Copying file from path:', file.path, '->', file.name);
            const result = await window.electronAPI.copyFileToMedia(file.path, file.name);
            if (result.success) {
              finalFilePath = result.filePath;
              console.log('[MediaManager] File copied to media folder:', finalFilePath);
              success = true;
            }
          }
          
          // Om file.path inte finns (drag-and-drop, paste), läs som buffer
          if (!success && window.electronAPI.saveFileBufferToMedia) {
            console.log('[MediaManager] Reading file as buffer:', file.name);
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            console.log('[MediaManager] Saving buffer to media folder:', file.name, 'Size:', uint8Array.length);
            const result = await window.electronAPI.saveFileBufferToMedia(uint8Array, file.name);
            
            if (result.success) {
              finalFilePath = result.filePath;
              console.log('[MediaManager] File buffer saved to media folder:', finalFilePath);
              success = true;
            } else {
              console.error('[MediaManager] Failed to save buffer:', result.error);
              alert(`Kunde inte spara fil ${file.name}: ${result.error}`);
              continue;
            }
          }
        } catch (error) {
          console.error('[MediaManager] Error handling file:', error);
          alert(`Fel vid hantering av ${file.name}: ${error.message}`);
          continue;
        }
      }
      
      // Generera thumbnail och läs bilddimensioner
      // Använd media:// URL (URL-encoded) om filen sparades, annars blob
      const safeFileName = finalFilePath ? finalFilePath.split(/[/\\]/).pop() : file.name;
      const mediaUrl = success ? `media://${encodeURIComponent(safeFileName)}` : URL.createObjectURL(file);
      try {
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            dimensions = { width: img.width, height: img.height };
            
            // Skapa canvas för thumbnail
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 200;
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            
            // Rensa bara blob URLs, inte media://
            if (!success && mediaUrl.startsWith('blob:')) {
              URL.revokeObjectURL(mediaUrl);
            }
            resolve();
          };
          img.onerror = reject;
          img.src = mediaUrl;
        });
      } catch (error) {
        console.error('[MediaManager] Error generating thumbnail:', error);
      }
      
      const newItem = {
        id: Date.now() + Math.random(),
        url: mediaUrl,
        filePath: safeFileName,
        name: file.name,
        date: new Date().toISOString().split('T')[0],
        libraryId: activeLib === 'all' ? 'gallery' : activeLib,
        isProfile: false,
        connections: { people: [], places: [], sources: [] },
        tags: ['Ny uppladdning'],
        faces: [],
        transcription: '',
        description: '',
        thumbnail: thumbnail,
        fileSize: fileSize,
        dimensions: dimensions
      };
      
      newItems.push(newItem);
      
      // Läs EXIF data i bakgrunden (om Electron)
      if (success && window.electronAPI && window.electronAPI.readExif) {
        console.log('[MediaManager] Reading EXIF for:', finalFilePath);
        window.electronAPI.readExif(safeFileName)
          .then(exifResult => {
            console.log('[MediaManager] EXIF loaded for', finalFilePath, ':', exifResult);
            
            // Kolla om det blev ett fel (servern kör inte?)
            if (exifResult.error) {
              console.warn('[MediaManager] EXIF error:', exifResult.error);
              return; // Skippa uppdatering om fel
            }
            
            // Uppdatera item med EXIF data
            updateMedia(prevItems => prevItems.map(item => {
              if (item.filePath === finalFilePath) {
                // Behåll ALLA befintliga fält, lägg bara till EXIF-data
                const updatedItem = {
                  ...item,
                  // Bevara connections explicit
                  connections: item.connections || { people: [], places: [], sources: [] }
                };
                
                // Lägg till keywords som tags (behåll befintliga)
                if (exifResult.keywords && exifResult.keywords.length > 0) {
                  updatedItem.tags = [...new Set([...(item.tags || []), ...exifResult.keywords])];
                }

                // Sätt beskrivning om tom och EXIF har titel/beskrivning
                if (!updatedItem.description) {
                  const md = exifResult.metadata || {};
                  if (md.title) updatedItem.description = md.title;
                  else if (md.description) updatedItem.description = md.description;
                }
                
                // Lägg till GPS om det finns (behåll befintligt om det finns)
                if (exifResult.gps && !updatedItem.gps) {
                  updatedItem.gps = exifResult.gps;
                }
                
                // Lägg till kameradadata (behåll befintligt om det finns)
                if (exifResult.camera && !updatedItem.camera) {
                  updatedItem.camera = exifResult.camera;
                }
                
                // Använd EXIF datum om det finns OCH nuvarande datum är dagens datum (dvs. inte ändrat)
                if (exifResult.metadata && (exifResult.metadata.datetime || exifResult.metadata.date_taken)) {
                  const today = new Date().toISOString().split('T')[0];
                  if (updatedItem.date === today) {
                    const raw = exifResult.metadata.datetime || exifResult.metadata.date_taken;
                    updatedItem.date = raw.split(' ')[0].replace(/:/g, '-');
                  }
                }
                
                return updatedItem;
              }
              return item;
            }));
          })
          .catch(error => {
            console.error('[MediaManager] Failed to read EXIF (kör Python API-servern?):', error);
          });
      }
    }
    
    if (newItems.length > 0) {
      updateMedia([...newItems, ...mediaItems]);
    }
  };

  useEffect(() => {
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
  }, [activeLib]);

  // Automatisk EXIF-läsning när bilden väljs
  useEffect(() => {
    if (!selectedImage) {
      setExifData(null);
      return;
    }

    setLoadingExif(true);
    setExifData(null);
    
    const loadExif = async () => {
      try {
        let pathToUse = selectedImage.filePath || selectedImage.name;
        
        // Rensa upp path-strängen
        if (pathToUse.startsWith('blob:') || pathToUse.startsWith('http') || pathToUse.startsWith('media://')) {
          pathToUse = selectedImage.name;
        }
        if (pathToUse.includes('/') || pathToUse.includes('\\')) {
          const parts = pathToUse.replace(/\\/g, '/').split('/');
          pathToUse = parts[parts.length - 1];
        }
        
        console.log('[MediaManager] Auto-loading EXIF for:', pathToUse);
        
        let data;
        if (window.electronAPI && window.electronAPI.readExif) {
          data = await window.electronAPI.readExif(pathToUse);
        } else {
          const response = await fetch('http://localhost:5005/exif/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_path: pathToUse })
          });
          data = await response.json();
        }
        
        if (!data.error) {
          console.log('[MediaManager] EXIF loaded:', data);
          setExifData(data);
          // Uppdatera item med EXIF info (keywords -> tags, faces -> faces, date, description)
          if (data.keywords || data.face_tags || data.metadata) {
            updateMedia(prev => prev.map(item => {
              if (item.id !== selectedImage.id) return item;
              const updated = { ...item };
              
              // Keywords -> tags
              if (data.keywords && data.keywords.length) {
                updated.tags = [...new Set([...(item.tags || []), ...data.keywords])];
              }
              
              // Face tags
              if (data.face_tags && data.face_tags.length) {
                updated.faces = data.face_tags;
              }
              
              // Metadata (datum och beskrivning)
              if (data.metadata) {
                // Fyll i datum från EXIF om tomt
                if (!updated.date && data.metadata.date_taken) {
                  updated.date = data.metadata.date_taken;
                }
                
                // Fyll i beskrivning från EXIF titel eller beskrivning om tomt
                if (!updated.description) {
                  if (data.metadata.title) {
                    updated.description = data.metadata.title;
                  } else if (data.metadata.description) {
                    updated.description = data.metadata.description;
                  }
                }
              }
              
              return updated;
            }));
          }
        }
      } catch (error) {
        console.warn('[MediaManager] Auto EXIF load failed:', error);
      } finally {
        setLoadingExif(false);
      }
    };
    
    loadExif();
  }, [selectedImage]);

  // Synka selectedImage med mediaItems när connections uppdateras
  useEffect(() => {
    if (selectedImage && selectedImage.id) {
      const updatedImage = mediaItems.find(m => m.id === selectedImage.id);
      if (updatedImage && JSON.stringify(updatedImage) !== JSON.stringify(selectedImage)) {
        setSelectedImage(updatedImage);
      }
    }
  }, [mediaItems]);

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

  return (
    <div className="flex flex-1 overflow-hidden w-full h-full bg-slate-900">
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
          <button 
            onClick={async () => {
              // Använd Electron-dialog om tillgänglig
              if (window.electronAPI && window.electronAPI.importImages) {
                try {
                  const result = await window.electronAPI.importImages();
                  if (!result.canceled && result.success && result.files) {
                    // Skapa media items från importerade filer
                    const newItems = result.files.map(file => ({
                      id: Date.now() + Math.random(),
                      url: `media://${encodeURIComponent(file.fileName)}`, // Speciell protokoll för media-bilder
                      filePath: file.filePath,
                      name: file.fileName,
                      date: new Date().toISOString().split('T')[0],
                      libraryId: activeLib === 'all' ? 'gallery' : activeLib,
                      isProfile: false,
                      connections: { people: [], places: [], sources: [] },
                      tags: ['Ny uppladdning'],
                      faces: [],
                      transcription: '',
                      description: ''
                    }));
                    updateMedia([...newItems, ...mediaItems]);
                  }
                } catch (error) {
                  console.error('[MediaManager] Import error:', error);
                  alert(`Fel vid import: ${error.message}`);
                }
              } else {
                // Fallback till vanlig file input
                fileInputRef.current.click();
              }
            }}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm transition-colors font-medium"
          >
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
                  onDoubleClick={(e) => handleImageDoubleClick(item, e)}
                  onContextMenu={(e) => handleContextMenu(e, item.id)}
                  draggable
                  onDragStart={(e) => handleItemDragStart(e, item.id)}
                  className={`group relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${selectedIds.has(item.id) ? 'border-blue-500 ring-2 ring-blue-500/30' : (selectedImage?.id === item.id ? 'border-blue-500' : 'border-slate-700 hover:border-slate-500')}`}
              >
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" onContextMenu={(e) => handleContextMenu(e, item.id)} /> 
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
                      onDoubleClick={(e) => handleImageDoubleClick(item, e)}
                      draggable 
                      onDragStart={(e) => handleItemDragStart(e, item.id)} 
                      className={`flex items-center gap-4 p-2 rounded border cursor-pointer ${selectedIds.has(item.id) ? 'bg-blue-900/30 border-blue-500' : (selectedImage?.id === item.id ? 'bg-slate-800 border-blue-500' : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800')}`}>
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

      {selectedIds.size > 0 && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 text-white px-2 py-1.5 rounded-full shadow-2xl flex gap-2 items-center z-50">
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
      {displayImage ? (
      <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 z-20 shadow-xl">
          <div className="p-4 border-b border-slate-700 flex justify-between bg-slate-800">
              <h3 className="text-sm font-bold text-white truncate w-64">{displayImage.name}</h3>
              <button onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-white"><X size={18}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-800">
              <div className="space-y-3">
                  <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Datering</label>
                      <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2 py-1.5">
                          <Calendar size={14} className="text-slate-500 mr-2"/>
                          <input type="text" defaultValue={displayImage.date} className="bg-transparent text-sm text-white w-full focus:outline-none" />
                      </div>
                  </div>
                  <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Bibliotek / Kategori</label>
                      <select 
                          defaultValue={displayImage.libraryId}
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
                      <textarea className="w-full bg-transparent text-sm text-white focus:outline-none resize-y min-h-[60px]" placeholder="Skriv en beskrivning..." defaultValue={displayImage.description} />
                  </div>
              </div>

              {displayImage.libraryId === 'sources' && (
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Transkribering</label>
                          <button onClick={() => setShowTranscription(!showTranscription)} className="text-xs flex items-center gap-1 text-blue-400 hover:text-white">
                              <PenTool size={12}/> {showTranscription ? 'Dölj' : 'Visa / Redigera'}
                          </button>
                      </div>
                      {showTranscription && (
                          <textarea className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" placeholder="Skriv av texten här..." defaultValue={displayImage.transcription} />
                      )}
                  </div>
              )}
              
              <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-700 pb-1">Kopplingar</h4>
                  
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400">Personer</label>
                      </div>
                      {displayImage.connections.people.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                              <div><span className="text-slate-200 font-medium block">{p.name}</span><span className="text-[10px] text-slate-500">{p.dates}</span></div>
                              <button className="text-slate-500 hover:text-red-400"><X size={12}/></button>
                          </div>
                      ))}
                      <button className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"><Plus size={12}/> Koppla person</button>
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400">Källor</label>
                      </div>
                      {displayImage.connections.sources.map((s, idx) => (
                          <div key={s.id || idx} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                              <div>
                                  <span className="text-slate-200 font-medium block">{s.name || s.title || 'Ingen titel'}</span>
                                  <span className="text-[10px] text-slate-500">{s.ref || s.reference || 'Ingen ref'}</span>
                              </div>
                              <button className="text-slate-500 hover:text-red-400"><X size={12}/></button>
                          </div>
                      ))}
                        <button 
                          onClick={() => setIsSourceDrawerOpen(displayImage)}
                          className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                          <Link size={12}/> Koppla källa
                      </button>
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400">Platser</label>
                      </div>
                      {displayImage.connections.places.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                              <div><span className="text-slate-200 font-medium block">{p.name}</span><span className="text-[10px] text-slate-500">{p.type}</span></div>
                              <button 
                                onClick={() => {
                                  updateMedia(prev => prev.map(item => {
                                    if (item.id !== displayImage.id) return item;
                                    return {
                                      ...item,
                                      connections: {
                                        ...item.connections,
                                        places: item.connections.places.filter(place => place.id !== p.id)
                                      }
                                    };
                                  }));
                                }}
                                className="text-slate-500 hover:text-red-400"
                              >
                                <X size={12}/>
                              </button>
                          </div>
                      ))}
                        <button 
                          onClick={() => setIsPlaceDrawerOpen(displayImage)}
                          className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                          <MapPin size={12}/> Koppla plats
                      </button>
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

              {/* EXIF & METADATA SEKTION */}
              <div className="space-y-3 border-t border-slate-700 pt-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                      <Camera size={12}/> EXIF & Metadata
                  </h4>

                  {exifData ? (
                      <div className="space-y-3">
                          {/* Face Tags */}
                          {exifData.face_tags && exifData.face_tags.length > 0 ? (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <ScanFace size={12}/> Face Tags
                              </label>
                              {exifData.face_tags.map((face, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                                  <div>
                                    <span className="text-slate-200 font-medium block">{face.name}</span>
                                    <span className="text-[10px] text-slate-500">{face.source}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button className="text-green-400 hover:text-green-300 p-1" title="Länka till person">
                                      <Link size={12}/>
                                    </button>
                                    <button className="text-slate-500 hover:text-red-400 p-1">
                                      <X size={12}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500">Inga face tags hittades i EXIF.</p>
                          )}

                          {/* Keywords - dölj om taggar redan finns */}
                          {(!mediaItems.find(m => m.id === selectedImage?.id)?.tags?.length) && exifData.keywords && exifData.keywords.length > 0 ? (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <Tag size={12}/> Keywords (EXIF)
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {exifData.keywords.map((keyword, idx) => (
                                  <span key={idx} className="bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                                    {keyword}
                                    <button className="hover:text-white">
                                      <X size={10}/>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500">Inga keywords hittades i EXIF.</p>
                          )}

                          {/* Metadata */}
                          {exifData.metadata && Object.keys(exifData.metadata).length > 0 && (
                              <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                      <Info size={12}/> Metadata
                                  </label>
                                  <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs space-y-1">
                                      {exifData.metadata.date_taken && (
                                          <div><span className="text-slate-500">Datum:</span> <span className="text-slate-300">{exifData.metadata.date_taken}</span></div>
                                      )}
                                      {exifData.metadata.title && (
                                          <div><span className="text-slate-500">Titel:</span> <span className="text-slate-300">{exifData.metadata.title}</span></div>
                                      )}
                                      {exifData.metadata.description && (
                                          <div><span className="text-slate-500">Beskrivning:</span> <span className="text-slate-300">{exifData.metadata.description}</span></div>
                                      )}
                                      {exifData.metadata.artist && (
                                          <div><span className="text-slate-500">Artist:</span> <span className="text-slate-300">{exifData.metadata.artist}</span></div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {/* GPS */}
                          {exifData.gps && (
                              <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                      <MapPin size={12}/> GPS-koordinater
                                  </label>
                                  <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
                                      <div className="text-slate-300 font-mono">
                                          {exifData.gps.latitude.toFixed(6)}, {exifData.gps.longitude.toFixed(6)}
                                      </div>
                                      {exifData.gps.altitude && (
                                          <div className="text-slate-400 text-[10px] mt-1">
                                              Höjd: {exifData.gps.altitude.toFixed(0)}m
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="text-center py-4 text-slate-500 text-xs">
                          Laddar EXIF-data automatiskt...
                      </div>
                  )}
              </div>
          </div>
          
          <div className="p-4 border-t border-slate-700 bg-slate-900 flex justify-between items-center">
              <button 
                  onClick={() => {
                      if (selectedImage && confirm(`Är du säker på att du vill ta bort "${selectedImage.name}"?`)) {
                          updateMedia(prev => prev.filter(item => item.id !== selectedImage.id));
                          setSelectedImage(null);
                      }
                  }}
                  className="px-3 py-1.5 bg-red-900/30 border border-red-700/50 text-red-300 text-xs rounded hover:bg-red-900/50 hover:border-red-600 transition-colors flex items-center gap-1 font-medium"
              >
                  <Trash2 size={14}/> Ta bort fil
              </button>
              <button 
                  onClick={() => {
                      if (selectedImage) {
                          // Samla all data från formuläret
                          const dateInput = document.querySelector('input[type="text"][value*="' + (selectedImage.date || '') + '"]')?.value || selectedImage.date;
                          const descriptionInput = document.querySelector('textarea[placeholder="Skriv en beskrivning..."]')?.value || selectedImage.description;
                          
                          // Uppdatera media item
                          updateMedia(prev => prev.map(item => {
                              if (item.id !== selectedImage.id) return item;
                              return {
                                  ...item,
                                  date: dateInput,
                                  description: descriptionInput
                              };
                          }));
                          
                          console.log('[MediaManager] Sparade:', {
                              name: selectedImage.name,
                              date: dateInput,
                              description: descriptionInput,
                              tags: selectedImage.tags,
                              faces: selectedImage.faces
                          });
                          
                          alert('Bilden sparad!');
                      }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02]"
              >
                  <Save size={14}/> Spara
              </button>
          </div>
      </div>
      ) : (
          <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 z-20 shadow-xl p-4">
              <p className="text-slate-400 text-sm">Välj en bild</p>
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
            updateMedia(mediaItems.map(item => 
              item.id === selectedImage.id 
                ? { ...item, faces: newRegions }
                : item
            ));
            setSelectedImage({ ...selectedImage, faces: newRegions });
          }
        }}
        people={allPeople}
        onOpenEditModal={onOpenEditModal}
      />

      {/* IMAGE EDITOR MODAL */}
      <ImageEditorModal
        isOpen={isImageEditorOpen}
        onClose={() => {
          setIsImageEditorOpen(false);
          setEditingImage(null);
          setPendingDeleteId(null);
        }}
        imageUrl={editingImage?.url}
        imageName={editingImage?.name}
        onSave={handleSaveEditedImage}
        onPrev={handlePrevEditing}
        onNext={handleNextEditing}
        hasPrev={!!prevEditingImage}
        hasNext={!!nextEditingImage}
        onDelete={handleRequestDeleteEditingImage}
        isConfirmingDelete={pendingDeleteId === editingImage?.id}
      />

      {/* Context Menu */}
      {contextMenuOpen && (
        <div 
          className="fixed bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 z-[10000]"
          style={{ 
            left: `${contextMenuPos.x}px`, 
            top: `${contextMenuPos.y}px` 
          }}
        >
          <button
            onClick={() => performAction('tag')}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
          >
            <ScanFace size={16} />
            Tagga
          </button>
          <button
            onClick={() => performAction('rotate')}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
          >
            <RotateCw size={16} />
            Rotera
          </button>
          <button
            onClick={() => performAction('delete')}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
          >
            <Trash2 size={16} />
            Radera
          </button>
        </div>
      )}

    </div>
  );
}