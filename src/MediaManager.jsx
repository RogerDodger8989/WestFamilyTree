import React, { useState, useEffect, useRef } from 'react';
import ImageViewer from './ImageViewer.jsx';
import ImageEditorModal from './ImageEditorModal.jsx';
import LinkPersonModal from './LinkPersonModal.jsx';
import TrashModal from './TrashModal.jsx';
import { useApp } from './AppContext.jsx';
import { 
  Search, Image as ImageIcon, Grid, List, Tag, User, 
  MapPin, Calendar, Plus, Trash2, AlertCircle, UploadCloud, 
  Crop, RotateCw, ScanFace, ZoomIn, ZoomOut, Maximize,
  FolderPlus, Folder, CheckSquare, Square, MoveRight,
  Check, Edit2, FileWarning, PenTool, Mic, Link,
  X, Layers, FileText, MoreVertical, Save, Camera,
  Download, Upload, RefreshCw, Database, Info, Trash, FolderOpen,
  ArrowUpDown, Filter, SlidersHorizontal
} from 'lucide-react';

const SYSTEM_LIBRARIES = [
  { id: 'all', label: 'Alla bilder', icon: Layers, type: 'system', path: '' },
  { id: 'persons', label: 'Personer', icon: User, type: 'system', path: 'persons/' },
  { id: 'sources', label: 'Källor', icon: FileText, type: 'system', path: 'sources/' },
  { id: 'places', label: 'Platser', icon: MapPin, type: 'system', path: 'places/' },
  { id: 'temp', label: 'Tillfälliga', icon: Folder, type: 'system', path: 'temp/' },
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

export function MediaManager({ allPeople = [], onOpenEditModal = () => {}, mediaItems: initialMedia = [], onUpdateMedia = () => {}, setIsSourceDrawerOpen = () => {}, setIsPlaceDrawerOpen = () => {}, onSelectMedia = null, selectedMediaIds = [] }) {
  const { showUndoToast, showStatus } = useApp();

  // UI State
  const [viewMode, setViewMode] = useState('grid'); 
  const [activeLib, setActiveLib] = useState('all');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [search, setSearch] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [filterUnlinked, setFilterUnlinked] = useState(false);
  
  // Sortering & Filtrering State
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, name-az, name-za, date-newest, date-oldest, size-largest, size-smallest, most-connections, most-tags
  const [filterBy, setFilterBy] = useState('all'); // all, with-tags, without-tags, with-date, without-date, with-transcription, without-transcription, with-people, with-places, with-sources, images-only, large-files, medium-files, small-files
  const [thumbnailSize, setThumbnailSize] = useState(4); // Antal kolumner i grid (2-8)
  
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
    // Parse connections om de är strängar
    const parsedMedia = (initialMedia.length > 0 ? initialMedia : INITIAL_MEDIA).map(m => {
      if (typeof m.connections === 'string') {
        try {
          return { ...m, connections: JSON.parse(m.connections) };
        } catch (e) {
          console.error('[MediaManager] Error parsing connections for', m.id, ':', e);
          return { ...m, connections: { people: [], places: [], sources: [] } };
        }
      }
      // Säkerställ att connections alltid är ett objekt med arrays
      return {
        ...m,
        connections: {
          people: Array.isArray(m.connections?.people) ? m.connections.people : [],
          places: Array.isArray(m.connections?.places) ? m.connections.places : [],
          sources: Array.isArray(m.connections?.sources) ? m.connections.sources : [],
          ...(m.connections || {})
        }
      };
    });
    
    const mediaMedKopplingar = parsedMedia.filter(m => {
      const conn = m.connections;
      return conn && (conn.people?.length > 0 || conn.places?.length > 0 || conn.sources?.length > 0);
    });
    const exempel = mediaMedKopplingar[0];
    console.log('[MediaManager] Synkar mediaItems:', {
      antal: parsedMedia.length,
      medKopplingar: mediaMedKopplingar.length,
      exempel: exempel ? {
        id: exempel.id,
        name: exempel.name,
        connections: exempel.connections,
        peopleCount: exempel.connections?.people?.length || 0,
        people: exempel.connections?.people,
        peopleType: typeof exempel.connections?.people,
        isArray: Array.isArray(exempel.connections?.people)
      } : null
    });
    
    setMediaItems(parsedMedia);
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
        handleDeleteImage(item);
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
    handleDeleteImage(removedImage);
    setIsImageEditorOpen(false);
    setEditingImage(null);
    setSelectedImage(current => (current && current.id === removedImage.id ? null : current));
  };
  
  // Hantera radering av bild (flytta till papperskorg)
  const handleDeleteImage = async (item) => {
    if (!item) {
      console.warn('[MediaManager] handleDeleteImage: item är null');
      return;
    }
    
    console.log('[MediaManager] handleDeleteImage anropad:', {
      id: item.id,
      name: item.name,
      filePath: item.filePath,
      url: item.url,
      hasElectronAPI: !!window.electronAPI,
      hasMoveFileToTrash: !!(window.electronAPI && window.electronAPI.moveFileToTrash)
    });
    
    if (!confirm(`Radera "${item.name}"? Filen flyttas till papperskorgen och raderas automatiskt efter 30 dagar.`)) {
      return;
    }
    
    try {
      // Försök hitta filePath från olika källor
      let filePathToDelete = item.filePath;
      
      // Om filePath inte finns, försök extrahera från url
      if (!filePathToDelete && item.url) {
        // Ta bort media:// prefix och decode URL
        const urlPath = item.url.replace('media://', '').replace(/%2F/g, '/');
        filePathToDelete = urlPath;
        console.log('[MediaManager] Extraherade filePath från url:', filePathToDelete);
      }
      
      // Flytta filen till papperskorgen om den finns på disk
      let moveSuccess = false;
      if (filePathToDelete && window.electronAPI && window.electronAPI.moveFileToTrash) {
        console.log('[MediaManager] Försöker flytta fil till papperskorg:', filePathToDelete);
        const result = await window.electronAPI.moveFileToTrash(filePathToDelete);
        console.log('[MediaManager] moveFileToTrash resultat:', result);
        if (result && result.success) {
          console.log('[MediaManager] ✅ Fil flyttad till papperskorg:', filePathToDelete);
          moveSuccess = true;
        } else {
          console.warn('[MediaManager] ⚠️ Kunde inte flytta fil till papperskorg:', result?.error || 'Okänt fel');
          if (typeof showStatus === 'function') {
            showStatus(`Kunde inte flytta "${item.name}" till papperskorg: ${result?.error || 'Okänt fel'}`, 'error');
          }
          return; // Avbryt om vi inte kunde flytta filen
        }
      } else {
        console.warn('[MediaManager] ⚠️ Kan inte flytta fil till papperskorg:', {
          filePathToDelete,
          hasElectronAPI: !!window.electronAPI,
          hasMoveFileToTrash: !!(window.electronAPI && window.electronAPI.moveFileToTrash)
        });
        if (typeof showStatus === 'function') {
          showStatus(`Kunde inte flytta "${item.name}" till papperskorg: Filen hittades inte.`, 'error');
        }
        return; // Avbryt om vi inte har rätt API eller filePath
      }
      
      // Ta bort från media-listan (bara om filen flyttades framgångsrikt)
      if (moveSuccess) {
        updateMedia(prev => prev.filter(m => m.id !== item.id));
        setSelectedImage(current => (current && current.id === item.id ? null : current));
        
        if (typeof showStatus === 'function') {
          showStatus(`"${item.name}" har flyttats till papperskorgen.`, 'success');
        }
      }
      
      if (typeof showUndoToast === 'function') {
        showUndoToast(`"${item.name}" har flyttats till papperskorgen. Ångra?`, async () => {
          // Återställ från papperskorg om möjligt
          if (item.filePath && window.electronAPI && window.electronAPI.restoreFileFromTrash) {
            // Hitta trash-filen (den har timestamp prefix)
            const trashFilesResult = await window.electronAPI.getTrashFiles();
            if (trashFilesResult && trashFilesResult.success) {
              const trashFile = trashFilesResult.files.find(f => 
                f.originalName === item.name || f.path.includes(item.name)
              );
              if (trashFile) {
                const restoreResult = await window.electronAPI.restoreFileFromTrash(
                  trashFile.name,
                  item.filePath
                );
                if (restoreResult && restoreResult.success) {
                  // Lägg tillbaka i media-listan
                  updateMedia(prev => {
                    if (prev.some(m => m.id === item.id)) return prev;
                    const newMedia = [...prev];
                    const insertAt = deletionIndex >= 0 ? Math.min(deletionIndex, newMedia.length) : newMedia.length;
                    newMedia.splice(insertAt, 0, item);
                    return newMedia;
                  });
                  setSelectedImage(item);
                  if (typeof showStatus === 'function') {
                    showStatus(`"${item.name}" har återställts.`, 'success');
                  }
                  return;
                }
              }
            }
          }
          
          // Fallback: lägg tillbaka i listan även om återställning misslyckades
          updateMedia(prev => {
            if (prev.some(m => m.id === item.id)) return prev;
            const newMedia = [...prev];
            const insertAt = deletionIndex >= 0 ? Math.min(deletionIndex, newMedia.length) : newMedia.length;
            newMedia.splice(insertAt, 0, item);
            return newMedia;
          });
          setSelectedImage(item);
        });
      }
    } catch (error) {
      console.error('[MediaManager] Error deleting image:', error);
      if (typeof showStatus === 'function') {
        showStatus(`Fel vid radering: ${error.message}`, 'error');
      }
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
  const [showLinkPersonModal, setShowLinkPersonModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  
  // Uppdatera selectedImage när mediaItems ändras, så att connections alltid är aktuella
  useEffect(() => {
    if (selectedImage && mediaItems.length > 0) {
      const updatedSelected = mediaItems.find(m => m.id === selectedImage.id);
      if (updatedSelected) {
        // Jämför connections för att se om de har ändrats
        const oldConnections = JSON.stringify(selectedImage.connections || {});
        const newConnections = JSON.stringify(updatedSelected.connections || {});
        if (oldConnections !== newConnections) {
          console.log('[MediaManager] Uppdaterar selectedImage med nya connections:', {
            id: updatedSelected.id,
            name: updatedSelected.name,
            connections: updatedSelected.connections,
            peopleCount: updatedSelected.connections?.people?.length || 0
          });
          setSelectedImage(updatedSelected);
        }
      }
    }
  }, [mediaItems, selectedImage?.id]);
  
  // EXIF State - läs automatiskt när bilden väljs
  const [exifData, setExifData] = useState(null);
  const [exifExpanded, setExifExpanded] = useState(true);
  const [loadingExif, setLoadingExif] = useState(false);

  // Tag State
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);

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
  const tagInputRef = useRef(null);

  const allLibraries = [...SYSTEM_LIBRARIES, ...customLibraries];

  // Läs alltid fresh data från mediaItems - använd selectedImage bara för att hitta ID
  const displayImage = selectedImage ? (mediaItems.find(m => m.id === selectedImage.id) || selectedImage) : null;
  
  // Debug: logga när displayImage ändras
  useEffect(() => {
    if (displayImage) {
      console.log('[MediaManager] displayImage uppdaterad:', {
        id: displayImage.id,
        name: displayImage.name,
        connections: displayImage.connections,
        connectionsType: typeof displayImage.connections,
        peopleCount: displayImage.connections?.people?.length || 0,
        people: displayImage.connections?.people
      });
    }
  }, [displayImage?.id, displayImage?.connections]);
  
  // Säkerställ att displayImage.connections alltid har people, places, och sources arrays
  const safeDisplayImage = displayImage ? (() => {
    console.log('[MediaManager] 🔧 Skapar safeDisplayImage från displayImage:', {
      id: displayImage.id,
      name: displayImage.name,
      connections: displayImage.connections,
      connectionsType: typeof displayImage.connections
    });
    
    // Parse connections om det är en sträng (JSON)
    let connections = displayImage.connections;
    if (typeof connections === 'string') {
      console.log('[MediaManager] Parsar connections från sträng:', connections);
      try {
        connections = JSON.parse(connections);
        console.log('[MediaManager] ✅ Parsad connections:', connections);
      } catch (e) {
        console.error('[MediaManager] ❌ Error parsing connections:', e, connections);
        connections = {};
      }
    }
    
    // Säkerställ att connections är ett objekt med arrays
    const safeConnections = {
      people: Array.isArray(connections?.people) ? connections.people : [],
      places: Array.isArray(connections?.places) ? connections.places : [],
      sources: Array.isArray(connections?.sources) ? connections.sources : [],
      ...(connections || {})
    };
    
    console.log('[MediaManager] ✅ safeConnections skapad:', {
      people: safeConnections.people,
      peopleType: typeof safeConnections.people,
      peopleIsArray: Array.isArray(safeConnections.people),
      peopleLength: safeConnections.people.length,
      peopleContent: safeConnections.people.map((p, idx) => ({
        index: idx,
        p,
        pType: typeof p,
        pId: typeof p === 'object' ? p.id : p,
        pName: typeof p === 'object' ? p.name : p
      }))
    });
    
    const result = {
      ...displayImage,
      connections: safeConnections
    };
    
    console.log('[MediaManager] ✅ safeDisplayImage skapad:', {
      id: result.id,
      name: result.name,
      connections: result.connections,
      peopleCount: result.connections.people.length
    });
    
    return result;
  })() : null;

  // Rensa tagg-input när bilden ändras och fokusera input-fältet
  useEffect(() => {
    setTagInput('');
    setTagSuggestions([]);
    // Fokusera input-fältet när bilden ändras (om det finns)
    if (tagInputRef.current && safeDisplayImage) {
      // Vänta lite så att DOM:en hinner uppdateras
      setTimeout(() => {
        tagInputRef.current?.focus();
      }, 100);
    }
  }, [safeDisplayImage?.id]);

  // Hämta alla befintliga taggar från alla media items
  const getAllTags = () => {
    const allTags = new Set();
    mediaItems.forEach(item => {
      if (Array.isArray(item.tags)) {
        item.tags.forEach(tag => allTags.add(tag));
      }
    });
    return Array.from(allTags).sort();
  };

  // Få förslag baserat på input
  const getTagSuggestions = (input) => {
    if (!input || input.trim().length === 0) return [];
    const allTags = getAllTags();
    const lowerInput = input.toLowerCase();
    return allTags.filter(tag => 
      tag.toLowerCase().includes(lowerInput) && 
      !safeDisplayImage?.tags?.includes(tag)
    ).slice(0, 5);
  };

  // Lägg till tagg
  const handleAddTag = (tagText) => {
    if (!tagText || tagText.trim().length === 0) return;
    if (!safeDisplayImage) return;
    
    const tag = tagText.trim();
    const currentTags = Array.isArray(safeDisplayImage.tags) ? safeDisplayImage.tags : [];
    
    // Kontrollera om taggen redan finns
    if (currentTags.includes(tag)) {
      setTagInput('');
      setTagSuggestions([]);
      return;
    }
    
    // Lägg till taggen
    updateMedia(prev => prev.map(item => {
      if (item.id !== safeDisplayImage.id) return item;
      return {
        ...item,
        tags: [...currentTags, tag]
      };
    }));
    
    setTagInput('');
    setTagSuggestions([]);
  };

  const filteredMedia = mediaItems.filter(m => {
    // Filtrera baserat på bibliotek (matcha mot filePath för systembibliotek)
    let matchesLib = true;
    if (activeLib !== 'all') {
      const activeLibrary = SYSTEM_LIBRARIES.find(lib => lib.id === activeLib);
      if (activeLibrary && activeLibrary.path) {
        // För systembibliotek, matcha mot filePath
        const filePath = m.filePath || m.url?.replace('media://', '').replace(/%2F/g, '/') || '';
        matchesLib = filePath.startsWith(activeLibrary.path);
      } else {
        // För custom bibliotek, använd libraryId
        matchesLib = m.libraryId === activeLib;
      }
    }
    
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
        (m.name && String(m.name).toLowerCase().includes(q)) || 
        (m.date && String(m.date).includes(q)) || 
        (m.description && String(m.description).toLowerCase().includes(q)) ||
        (m.tags && Array.isArray(m.tags) && m.tags.some(t => String(t || '').toLowerCase().includes(q))) || 
        (m.connections?.people && Array.isArray(m.connections.people) && m.connections.people.some(c => {
          const name = typeof c === 'object' ? String(c.name || '') : String(c || '');
          const ref = typeof c === 'object' ? String(c.ref || '') : '';
          return name.toLowerCase().includes(q) || (ref && ref.toLowerCase().includes(q));
        })) || 
        (m.connections?.places && Array.isArray(m.connections.places) && m.connections.places.some(p => {
          const placeName = typeof p === 'object' ? String(p.name || '') : String(p || '');
          return placeName.toLowerCase().includes(q);
        })) ||
        (m.connections?.sources && Array.isArray(m.connections.sources) && m.connections.sources.some(s => {
          const sourceName = typeof s === 'object' ? String(s.name || s.title || '') : String(s || '');
          const sourceRef = typeof s === 'object' ? String(s.ref || s.reference || '') : '';
          return sourceName.toLowerCase().includes(q) || (sourceRef && sourceRef.toLowerCase().includes(q));
        })) ||
        (m.transcription && String(m.transcription).toLowerCase().includes(q)) ||
        (m.filePath && String(m.filePath).toLowerCase().includes(q))
    );
    const matchesUnlinked = filterUnlinked ? (
      (!m.connections?.people || m.connections.people.length === 0) && 
      (!m.connections?.places || m.connections.places.length === 0) && 
      (!m.connections?.sources || m.connections.sources.length === 0)
    ) : true;
    
    // Ytterligare filtrering baserat på filterBy
    let matchesFilter = true;
    if (filterBy !== 'all') {
      switch(filterBy) {
        case 'with-tags':
          matchesFilter = m.tags && Array.isArray(m.tags) && m.tags.length > 0;
          break;
        case 'without-tags':
          matchesFilter = !m.tags || !Array.isArray(m.tags) || m.tags.length === 0;
          break;
        case 'with-date':
          matchesFilter = !!m.date;
          break;
        case 'without-date':
          matchesFilter = !m.date;
          break;
        case 'with-transcription':
          matchesFilter = !!m.transcription;
          break;
        case 'without-transcription':
          matchesFilter = !m.transcription;
          break;
        case 'with-people':
          matchesFilter = m.connections?.people && Array.isArray(m.connections.people) && m.connections.people.length > 0;
          break;
        case 'with-places':
          matchesFilter = m.connections?.places && Array.isArray(m.connections.places) && m.connections.places.length > 0;
          break;
        case 'with-sources':
          matchesFilter = m.connections?.sources && Array.isArray(m.connections.sources) && m.connections.sources.length > 0;
          break;
        case 'images-only':
          const ext = (m.name || '').split('.').pop()?.toLowerCase() || '';
          matchesFilter = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
          break;
        case 'large-files':
          matchesFilter = m.fileSize && m.fileSize > 5 * 1024 * 1024; // >5MB
          break;
        case 'medium-files':
          matchesFilter = m.fileSize && m.fileSize >= 1024 * 1024 && m.fileSize <= 5 * 1024 * 1024; // 1-5MB
          break;
        case 'small-files':
          matchesFilter = m.fileSize && m.fileSize < 1024 * 1024; // <1MB
          break;
        default:
          matchesFilter = true;
      }
    }
    
    return matchesLib && matchesSearch && matchesUnlinked && matchesFilter;
  });
  
  // Sortera filtrerad media
  const sortedMedia = [...filteredMedia].sort((a, b) => {
    switch(sortBy) {
      case 'newest':
        // Antag att id innehåller timestamp eller använd createdAt om det finns
        const aTime = a.createdAt || (a.id && typeof a.id === 'string' && a.id.includes('_') ? parseInt(a.id.split('_').pop()) : 0) || 0;
        const bTime = b.createdAt || (b.id && typeof b.id === 'string' && b.id.includes('_') ? parseInt(b.id.split('_').pop()) : 0) || 0;
        return bTime - aTime;
      case 'oldest':
        const aTime2 = a.createdAt || (a.id && typeof a.id === 'string' && a.id.includes('_') ? parseInt(a.id.split('_').pop()) : 0) || 0;
        const bTime2 = b.createdAt || (b.id && typeof b.id === 'string' && b.id.includes('_') ? parseInt(b.id.split('_').pop()) : 0) || 0;
        return aTime2 - bTime2;
      case 'name-az':
        return (a.name || '').localeCompare(b.name || '', 'sv');
      case 'name-za':
        return (b.name || '').localeCompare(a.name || '', 'sv');
      case 'date-newest':
        return (b.date || '').localeCompare(a.date || '', 'sv');
      case 'date-oldest':
        return (a.date || '').localeCompare(b.date || '', 'sv');
      case 'size-largest':
        return (b.fileSize || 0) - (a.fileSize || 0);
      case 'size-smallest':
        return (a.fileSize || 0) - (b.fileSize || 0);
      case 'most-connections':
        const aConn = (a.connections?.people?.length || 0) + (a.connections?.places?.length || 0) + (a.connections?.sources?.length || 0);
        const bConn = (b.connections?.people?.length || 0) + (b.connections?.places?.length || 0) + (b.connections?.sources?.length || 0);
        return bConn - aConn;
      case 'most-tags':
        return (b.tags?.length || 0) - (a.tags?.length || 0);
      default:
        return 0;
    }
  });

  const editingIndex = editingImage ? sortedMedia.findIndex(m => m.id === editingImage.id) : -1;
  const prevEditingImage = editingIndex > 0 ? sortedMedia[editingIndex - 1] : null;
  const nextEditingImage = editingIndex >= 0 && editingIndex < sortedMedia.length - 1 ? sortedMedia[editingIndex + 1] : null;

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
      console.log('[MediaManager] 🖱️ handleImageClick anropad:', {
        itemId: item.id,
        itemName: item.name,
        itemConnections: item.connections,
        itemConnectionsType: typeof item.connections,
        itemPeople: item.connections?.people,
        itemPeopleType: typeof item.connections?.people,
        itemPeopleIsArray: Array.isArray(item.connections?.people),
        itemPeopleLength: Array.isArray(item.connections?.people) ? item.connections?.people.length : 'ej array',
        onSelectMediaExists: !!onSelectMedia,
        selectedMediaIds: selectedMediaIds
      });
      
      // Om onSelectMedia finns, använd select mode för MediaSelector
      if (onSelectMedia) {
        console.log('[MediaManager] onSelectMedia mode - hoppar över normal hantering');
        const isCurrentlySelected = selectedMediaIds.includes(item.id);
        if (isCurrentlySelected) {
          // Ta bort från valda
          const newSelected = selectedMediaIds.filter(id => id !== item.id);
          onSelectMedia(mediaItems.filter(m => newSelected.includes(m.id)));
        } else {
          // Lägg till i valda
          const newSelected = [...selectedMediaIds, item.id];
          onSelectMedia(mediaItems.filter(m => newSelected.includes(m.id)));
        }
        return;
      }
      
      console.log('[MediaManager] Normal MediaManager-funktionalitet - sätter selectedImage');
      // Normal MediaManager-funktionalitet
      console.log('🖱️ Image clicked:', { itemId: item.id, itemName: item.name, mediaItemsCount: mediaItems.length });
      let newSelected = new Set(selectedIds);
      if (e.ctrlKey || e.metaKey) {
          if (newSelected.has(item.id)) newSelected.delete(item.id);
          else newSelected.add(item.id);
          setLastSelectedId(item.id);
      } else if (e.shiftKey && lastSelectedId) {
          const ids = sortedMedia.map(m => m.id);
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
          const findId = Array.from(newSelected)[0];
          const found = mediaItems.find(m => m.id === findId);
          console.log('[MediaManager] ✅ Setting selectedImage (single selection):', {
            findId,
            found: found ? {
              id: found.id,
              name: found.name,
              connections: found.connections,
              connectionsType: typeof found.connections,
              people: found.connections?.people,
              peopleType: typeof found.connections?.people,
              peopleIsArray: Array.isArray(found.connections?.people),
              peopleLength: Array.isArray(found.connections?.people) ? found.connections?.people.length : 'ej array'
            } : null,
            foundInMediaItems: !!found
          });
          setSelectedImage(found);
      } else {
          console.log('[MediaManager] ⚠️ Multiple selected, setting to item or null:', {
            newSelectedSize: newSelected.size,
            hasItem: newSelected.has(item.id),
            willSetToItem: newSelected.has(item.id),
            item: newSelected.has(item.id) ? {
              id: item.id,
              name: item.name,
              connections: item.connections,
              connectionsType: typeof item.connections,
              people: item.connections?.people,
              peopleType: typeof item.connections?.people,
              peopleIsArray: Array.isArray(item.connections?.people),
              peopleLength: Array.isArray(item.connections?.people) ? item.connections?.people.length : 'ej array'
            } : null
          });
          setSelectedImage(newSelected.has(item.id) ? item : null);
      }
      setIsSelectMode(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedMedia.length) { setSelectedIds(new Set()); setIsSelectMode(false); }
    else { setSelectedIds(new Set(sortedMedia.map(m => m.id))); setIsSelectMode(true); }
  };

  const handleToggleSelect = (itemId) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(itemId)) newSelected.delete(itemId);
    else newSelected.add(itemId);
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Radera ${selectedIds.size} bilder? Filerna flyttas till papperskorgen och raderas automatiskt efter 30 dagar.`)) {
      return;
    }
    
    const itemsToDelete = mediaItems.filter(m => selectedIds.has(m.id));
    const deletedIds = new Set();
    const failedItems = [];
    
    // Flytta alla valda bilder till papperskorgen
    for (const item of itemsToDelete) {
      try {
        let filePathToDelete = item.filePath;
        
        // Om filePath inte finns, försök extrahera från url
        if (!filePathToDelete && item.url) {
          const urlPath = item.url.replace('media://', '').replace(/%2F/g, '/');
          filePathToDelete = urlPath;
        }
        
        if (filePathToDelete && window.electronAPI && window.electronAPI.moveFileToTrash) {
          const result = await window.electronAPI.moveFileToTrash(filePathToDelete);
          if (result && result.success) {
            deletedIds.add(item.id);
          } else {
            failedItems.push(item.name);
          }
        } else {
          failedItems.push(item.name);
        }
      } catch (error) {
        console.error('[MediaManager] Error deleting item:', item, error);
        failedItems.push(item.name);
      }
    }
    
    // Ta bort endast de som flyttades framgångsrikt
    if (deletedIds.size > 0) {
      updateMedia(prev => prev.filter(m => !deletedIds.has(m.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      setSelectedImage(current => (current && deletedIds.has(current.id) ? null : current));
      
      if (typeof showStatus === 'function') {
        if (failedItems.length > 0) {
          showStatus(`${deletedIds.size} bilder flyttade till papperskorg. ${failedItems.length} misslyckades.`, 'warn');
        } else {
          showStatus(`${deletedIds.size} bilder flyttade till papperskorgen.`, 'success');
        }
      }
    } else {
      if (typeof showStatus === 'function') {
        showStatus(`Kunde inte flytta bilderna till papperskorg.`, 'error');
      }
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
    <>
      <style>{`
        .slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: #334155;
          border-radius: 2px;
          outline: none;
        }
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.2s;
        }
        .slider::-webkit-slider-thumb:hover {
          background: #2563eb;
        }
        .slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          transition: background 0.2s;
        }
        .slider::-moz-range-thumb:hover {
          background: #2563eb;
        }
      `}</style>
    <div className="flex flex-1 overflow-hidden w-full h-full bg-slate-900">
      {/* VÄNSTER: Bibliotek */}
      <div className="w-64 bg-slate-800/50 border-r border-slate-700 flex flex-col shrink-0">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-2 space-y-1">
              <p className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">Bibliotek</p>
              {SYSTEM_LIBRARIES.map(lib => (
              <LibraryButton key={lib.id} lib={lib} isActive={activeLib === lib.id} onClick={() => { setActiveLib(lib.id); setSelectedImage(null); setIsSelectMode(false); setFilterUnlinked(false); }} onDrop={handleLibraryDrop}/>
              ))}
              <button onClick={() => { setFilterUnlinked(!filterUnlinked); setActiveLib('all'); setSearch(''); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors ${filterUnlinked ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                  <AlertCircle size={16} /> Okopplade ({mediaItems.filter(m => (!m.connections?.people || m.connections.people.length === 0) && (!m.connections?.places || m.connections.places.length === 0) && (!m.connections?.sources || m.connections.sources.length === 0)).length})
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
          
          {/* Papperskorg-knapp */}
          <button
            onClick={() => setShowTrashModal(true)}
            className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded text-sm transition-colors font-medium border border-slate-700 mt-2"
          >
            <Trash size={16}/> Papperskorg
          </button>
      </div>
      </div>

      {/* MITTEN: Galleri */}
      <div className="flex-1 flex flex-col bg-slate-900 min-w-0 relative">
      
      <div className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-800/30">
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                if (window.electronAPI && window.electronAPI.scanMediaFolder) {
                  try {
                    if (typeof showStatus === 'function') {
                      showStatus('Skannar media-mappen...', 'info');
                    }
                    const result = await window.electronAPI.scanMediaFolder();
                    if (result && result.success && result.media) {
                      // Skapa en map av filer som finns på disk (keyed by filePath)
                      const filesOnDisk = new Map();
                      result.media.forEach(m => {
                        const key = m.filePath || m.url?.replace('media://', '').replace(/%2F/g, '/');
                        if (key) filesOnDisk.set(key, m);
                      });
                      
                      // Merga med befintlig media - använd metadata från databasen om den finns
                      updateMedia(prev => {
                        const existingById = new Map(prev.map(m => [m.id, m]));
                        const existingByPath = new Map(prev.map(m => {
                          const path = m.filePath || m.url?.replace('media://', '').replace(/%2F/g, '/');
                          return [path, m];
                        }));
                        
                        // Lägg till/uppdatera bilder som finns på disk
                        const merged = result.media.map(fileMedia => {
                          const path = fileMedia.filePath || fileMedia.url?.replace('media://', '').replace(/%2F/g, '/');
                          // Försök hitta befintlig media via ID eller filePath
                          const existing = existingById.get(fileMedia.id) || existingByPath.get(path);
                          if (existing) {
                            // Merga: behåll metadata från databasen, uppdatera fileSize
                            return {
                              ...existing,
                              fileSize: fileMedia.fileSize,
                              url: fileMedia.url, // Uppdatera URL om den ändrats
                              filePath: fileMedia.filePath // Uppdatera filePath om den ändrats
                            };
                          } else {
                            // Ny bild från filsystemet
                            return fileMedia;
                          }
                        });
                        
                        // Ta bort bilder som inte längre finns på disk
                        const removed = [];
                        
                        // Filtrera bort de som inte finns på disk
                        const finalMedia = merged.filter(m => {
                          const path = m.filePath || m.url?.replace('media://', '').replace(/%2F/g, '/');
                          const existsOnDisk = filesOnDisk.has(path);
                          if (!existsOnDisk) {
                            removed.push(m.name || m.id);
                          }
                          return existsOnDisk;
                        });
                        
                        const prevCount = prev.length;
                        const newCount = finalMedia.length - prevCount;
                        const removedCount = removed.length;
                        
                        if (newCount > 0 && removedCount > 0) {
                          if (typeof showStatus === 'function') {
                            showStatus(`${newCount} nya bilder hittade, ${removedCount} bilder borttagna.`, 'info');
                          }
                        } else if (newCount > 0) {
                          if (typeof showStatus === 'function') {
                            showStatus(`${newCount} nya bilder hittade!`, 'success');
                          }
                        } else if (removedCount > 0) {
                          if (typeof showStatus === 'function') {
                            showStatus(`${removedCount} bilder borttagna från filsystemet.`, 'info');
                          }
                        } else {
                          if (typeof showStatus === 'function') {
                            showStatus('Inga ändringar hittades.', 'info');
                          }
                        }
                        
                        return finalMedia;
                      });
                    }
                  } catch (error) {
                    console.error('[MediaManager] Error scanning media folder:', error);
                    if (typeof showStatus === 'function') {
                      showStatus(`Fel vid skanning: ${error.message}`, 'error');
                    }
                  }
                }
              }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors flex items-center gap-1.5"
              title="Skanna media-mappen för nya bilder"
            >
              <RefreshCw size={14} /> Uppdatera
            </button>
          </div>
          <div className="flex gap-2 items-center">
              <button onClick={() => { setIsSelectMode(!isSelectMode); setSelectedIds(new Set()); setSelectedImage(null); }} className={`px-3 py-1.5 rounded text-sm border transition-colors ${isSelectMode ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white'}`}>
                  {isSelectMode ? 'Klar' : 'Välj'}
              </button>
              <button onClick={handleSelectAll} className="text-xs text-slate-400 hover:text-white px-2">
                  {selectedIds.size === sortedMedia.length ? 'Avmarkera alla' : 'Markera alla'}
              </button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
              {/* Thumbnail Size Slider */}
              <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                  <SlidersHorizontal size={12} className="text-slate-400 flex-shrink-0"/>
                  <input 
                      type="range" 
                      min="2" 
                      max="8" 
                      value={thumbnailSize} 
                      onChange={(e) => setThumbnailSize(parseInt(e.target.value))}
                      className="flex-1 slider min-w-[60px]"
                      title={`${thumbnailSize} kolumner`}
                  />
                  <span className="text-xs text-slate-400 w-4 text-right flex-shrink-0">{thumbnailSize}</span>
              </div>
              
              {/* Sortering Dropdown */}
              <div className="relative flex-shrink-0">
                  <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer min-w-[140px]"
                  >
                      <option value="newest">Senast tillagd</option>
                      <option value="oldest">Äldst först</option>
                      <option value="name-az">Namn (A-Z)</option>
                      <option value="name-za">Namn (Z-A)</option>
                      <option value="date-newest">Datum (nyast)</option>
                      <option value="date-oldest">Datum (äldst)</option>
                      <option value="size-largest">Storlek (störst)</option>
                      <option value="size-smallest">Storlek (minst)</option>
                      <option value="most-connections">Mest kopplade</option>
                      <option value="most-tags">Mest taggar</option>
                  </select>
                  <ArrowUpDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
              
              {/* Filtrering Dropdown */}
              <div className="relative flex-shrink-0">
                  <select 
                      value={filterBy} 
                      onChange={(e) => setFilterBy(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer min-w-[120px]"
                  >
                      <option value="all">Alla</option>
                      <option value="with-tags">Med taggar</option>
                      <option value="without-tags">Utan taggar</option>
                      <option value="with-date">Med datum</option>
                      <option value="without-date">Utan datum</option>
                      <option value="with-transcription">Med transkription</option>
                      <option value="without-transcription">Utan transkription</option>
                      <option value="with-people">Med kopplade personer</option>
                      <option value="with-places">Med kopplade platser</option>
                      <option value="with-sources">Med kopplade källor</option>
                      <option value="images-only">Endast bilder</option>
                      <option value="large-files">Stora filer (&gt;5MB)</option>
                      <option value="medium-files">Medelstora filer (1-5MB)</option>
                      <option value="small-files">Små filer (&lt;1MB)</option>
                  </select>
                  <Filter size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              </div>
              
              {/* Sök */}
              <div className="relative w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input type="text" placeholder="Sök..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-full pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"/>
              </div>
              
              {/* Grid/List View Toggle */}
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
          {sortedMedia.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <FileWarning size={48} className="mb-2 opacity-20"/>
                  <p className="text-sm">Inga bilder hittades.</p>
              </div>
          )}
          {viewMode === 'grid' ? (
          <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${thumbnailSize}, minmax(0, 1fr))` }}>
              {sortedMedia.map(item => (
              <div key={item.id} 
                  onClick={(e) => handleImageClick(item, e)}
                  onDoubleClick={(e) => handleImageDoubleClick(item, e)}
                  onContextMenu={(e) => handleContextMenu(e, item.id)}
                  draggable
                  onDragStart={(e) => handleItemDragStart(e, item.id)}
                  className={`group relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${(onSelectMedia && selectedMediaIds.includes(item.id)) ? 'border-green-500 ring-2 ring-green-500/50' : selectedIds.has(item.id) ? 'border-blue-500 ring-2 ring-blue-500/30' : (selectedImage?.id === item.id ? 'border-blue-500' : 'border-slate-700 hover:border-slate-500')}`}
              >
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" onContextMenu={(e) => handleContextMenu(e, item.id)} /> 
                  {(onSelectMedia && selectedMediaIds.includes(item.id)) && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10">
                          <div className="bg-green-500 text-white rounded-full p-2 shadow-lg">
                              <CheckSquare size={24} fill="currentColor" className="text-white" />
                          </div>
                      </div>
                  )}
                  {(isSelectMode || selectedIds.has(item.id)) && !onSelectMedia && (
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
              {sortedMedia.map(item => (
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
      {safeDisplayImage ? (
      <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 z-20 shadow-xl">
          <div className="p-4 border-b border-slate-700 bg-slate-800">
              <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-bold text-white truncate flex-1">{safeDisplayImage.name}</h3>
                  <button onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-white shrink-0 ml-2"><X size={18}/></button>
              </div>
              {safeDisplayImage.filePath && (
                  <button
                      onClick={(e) => {
                          e.stopPropagation();
                          // Extrahera mapp-sökvägen (ta bort filnamnet)
                          const pathParts = safeDisplayImage.filePath.split('/');
                          const folderPath = pathParts.slice(0, -1).join('/');
                          const fullPath = folderPath ? `media/${folderPath}` : 'media';
                          
                          if (window.electronAPI && window.electronAPI.openFolder) {
                              window.electronAPI.openFolder(fullPath);
                          }
                      }}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors group"
                      title="Öppna i Explorer"
                  >
                      <FolderOpen size={12} className="group-hover:text-blue-400 shrink-0" />
                      <span className="truncate">media/{safeDisplayImage.filePath}</span>
                  </button>
              )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-slate-800">
              <div className="space-y-3">
                  <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Datering</label>
                      <div className="flex items-center bg-slate-900 border border-slate-600 rounded px-2 py-1.5">
                          <Calendar size={14} className="text-slate-500 mr-2"/>
                          <input type="text" defaultValue={safeDisplayImage.date} className="bg-transparent text-sm text-white w-full focus:outline-none" />
                      </div>
                  </div>
                  <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Bibliotek / Kategori</label>
                      <select 
                          defaultValue={safeDisplayImage.libraryId}
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
                      <textarea className="w-full bg-transparent text-sm text-white focus:outline-none resize-y min-h-[60px]" placeholder="Skriv en beskrivning..." defaultValue={safeDisplayImage.description} />
                  </div>
              </div>

              {safeDisplayImage.libraryId === 'sources' && (
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Transkribering</label>
                          <button onClick={() => setShowTranscription(!showTranscription)} className="text-xs flex items-center gap-1 text-blue-400 hover:text-white">
                              <PenTool size={12}/> {showTranscription ? 'Dölj' : 'Visa / Redigera'}
                          </button>
                      </div>
                      {showTranscription && (
                          <textarea className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500" placeholder="Skriv av texten här..." defaultValue={safeDisplayImage.transcription} />
                      )}
                  </div>
              )}
              
              <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase border-b border-slate-700 pb-1">Kopplingar</h4>
                  
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400">Personer</label>
                      </div>
                      {(() => {
                        const people = safeDisplayImage?.connections?.people;
                        const isArray = Array.isArray(people);
                        const hasPeople = isArray && people.length > 0;
                        
                        console.log('[MediaManager] Renderar personer-sektion:', {
                          safeDisplayImageExists: !!safeDisplayImage,
                          imageId: safeDisplayImage?.id,
                          imageName: safeDisplayImage?.name,
                          connections: safeDisplayImage?.connections,
                          people: people,
                          peopleType: typeof people,
                          isArray: isArray,
                          hasPeople: hasPeople,
                          peopleLength: isArray ? people.length : 'ej array',
                          peopleContent: isArray ? people : 'ej array'
                        });
                        
                        if (!safeDisplayImage) {
                          return <div className="text-xs text-slate-500 italic py-2">Ingen bild vald</div>;
                        }
                        
                        if (!isArray) {
                          return <div className="text-xs text-red-500 italic py-2">Fel: people är inte en array (typ: {typeof people})</div>;
                        }
                        
                        if (!hasPeople) {
                          return <div className="text-xs text-slate-500 italic py-2">Inga personer kopplade</div>;
                        }
                        
                        return people.map((p, idx) => {
                          const personId = typeof p === 'object' ? p.id : p;
                          const personName = typeof p === 'object' ? p.name : p;
                          const personDates = typeof p === 'object' ? p.dates : '';
                          
                          return (
                            <div key={personId || idx} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                                <div><span className="text-slate-200 font-medium block">{personName}</span><span className="text-[10px] text-slate-500">{personDates}</span></div>
                                <button className="text-slate-500 hover:text-red-400"><X size={12}/></button>
                            </div>
                          );
                        });
                      })()}
                      <button 
                        onClick={() => {
                          if (safeDisplayImage) {
                            setShowLinkPersonModal(true);
                          }
                        }}
                        className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={12}/> Koppla person
                      </button>
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400">Källor</label>
                      </div>
                      {Array.isArray(safeDisplayImage?.connections?.sources) && safeDisplayImage.connections.sources.length > 0 ? (
                        safeDisplayImage.connections.sources.map((s, idx) => (
                          <div key={s.id || idx} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                              <div>
                                  <span className="text-slate-200 font-medium block">{s.name || s.title || 'Ingen titel'}</span>
                                  <span className="text-[10px] text-slate-500">{s.ref || s.reference || 'Ingen ref'}</span>
                              </div>
                              <button className="text-slate-500 hover:text-red-400"><X size={12}/></button>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic py-2">Inga källor kopplade</div>
                      )}
                        <button 
                          onClick={() => setIsSourceDrawerOpen(safeDisplayImage)}
                          className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                          <Link size={12}/> Koppla källa
                      </button>
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400">Platser</label>
                      </div>
                      {Array.isArray(safeDisplayImage?.connections?.places) && safeDisplayImage.connections.places.length > 0 ? (
                        safeDisplayImage.connections.places.map(p => (
                          <div key={p.id} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700 text-xs">
                              <div><span className="text-slate-200 font-medium block">{p.name}</span><span className="text-[10px] text-slate-500">{p.type}</span></div>
                              <button 
                                onClick={() => {
                                  updateMedia(prev => prev.map(item => {
                                    if (item.id !== safeDisplayImage?.id) return item;
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
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic py-2">Inga platser kopplade</div>
                      )}
                        <button 
                          onClick={() => setIsPlaceDrawerOpen(safeDisplayImage)}
                          className="w-full py-1.5 border border-dashed border-slate-600 text-slate-400 text-xs rounded hover:text-white hover:border-slate-500 hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                          <MapPin size={12}/> Koppla plats
                      </button>
                  </div>
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Taggar</label>
                  
                  {/* Visade taggar */}
                  {Array.isArray(safeDisplayImage?.tags) && safeDisplayImage.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                          {safeDisplayImage.tags.map((tag, idx) => (
                              <span 
                                  key={idx} 
                                  className="bg-green-600/20 border border-green-500/50 text-green-300 text-xs px-2 py-1 rounded-full flex items-center gap-1.5 group hover:bg-green-600/30 transition-colors"
                              >
                                  <span>{tag}</span>
                                  <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          updateMedia(prev => prev.map(item => {
                                              if (item.id !== safeDisplayImage?.id) return item;
                                              const newTags = Array.isArray(item.tags) ? item.tags.filter(t => t !== tag) : [];
                                              return { ...item, tags: newTags };
                                          }));
                                      }}
                                      className="text-green-400 hover:text-red-400 transition-colors ml-0.5"
                                      title="Ta bort tagg"
                                  >
                                      <X size={12}/>
                                  </button>
                              </span>
                          ))}
                      </div>
                  )}
                  
                  {/* Input för nya taggar */}
                  <div className="relative">
                      <input
                          ref={tagInputRef}
                          type="text"
                          placeholder="Skriv eller välj tagg..."
                          className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          value={tagInput}
                          onChange={(e) => {
                              setTagInput(e.target.value);
                              setTagSuggestions(getTagSuggestions(e.target.value));
                          }}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  const trimmed = tagInput.trim();
                                  if (trimmed) {
                                      handleAddTag(trimmed);
                                  }
                              }
                          }}
                          onFocus={(e) => {
                              e.target.select();
                              if (tagInput) {
                                  setTagSuggestions(getTagSuggestions(tagInput));
                              }
                          }}
                          onBlur={() => {
                              // Vänta lite innan vi stänger dropdown så att klick på förslag fungerar
                              setTimeout(() => setTagSuggestions([]), 200);
                          }}
                          autoComplete="off"
                      />
                      
                      {/* Autocomplete dropdown */}
                      {tagSuggestions.length > 0 && tagInput && (
                          <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-40 overflow-y-auto">
                              {tagSuggestions.map((suggestion, idx) => (
                                  <button
                                      key={idx}
                                      onClick={(e) => {
                                          e.preventDefault();
                                          handleAddTag(suggestion);
                                          setTagInput('');
                                          setTagSuggestions([]);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                                  >
                                      <Tag size={12} className="text-slate-500" />
                                      <span>{suggestion}</span>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <p className="text-[10px] text-slate-500">Tryck Enter eller "," för att lägga till tagg</p>
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
                      if (selectedImage) {
                          handleDeleteImage(selectedImage);
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

      {/* TRASH MODAL */}
      <TrashModal
        isOpen={showTrashModal}
        onClose={() => setShowTrashModal(false)}
        onRestore={async (filePath, originalName) => {
          console.log('[MediaManager] Fil återställd:', filePath, 'originalName:', originalName);
          
          // Skapa ett media-objekt från den återställda filen
          const fileName = originalName || filePath.split('/').pop();
          const url = `media://${filePath.replace(/\//g, '%2F')}`;
          
          // Generera ett stabilt ID baserat på filePath (samma logik som i Electron - MD5 hash)
          // Använd enkel hash-funktion eftersom Web Crypto kan vara långsam
          let hash = 0;
          for (let i = 0; i < filePath.length; i++) {
            const char = filePath.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          const hashHex = Math.abs(hash).toString(16).padStart(12, '0').slice(0, 12);
          const mediaId = `img_${hashHex}`;
          
          // Skapa media-objekt (samma struktur som i Electron)
          const restoredMediaItem = {
            id: mediaId,
            name: fileName,
            filePath: filePath,
            url: url,
            date: new Date().toISOString().split('T')[0],
            description: '',
            tags: [],
            connections: {
              people: [],
              places: [],
              sources: []
            },
            faces: [],
            libraryId: filePath.startsWith('persons/') ? 'persons' : 
                      filePath.startsWith('sources/') ? 'sources' : 
                      filePath.startsWith('places/') ? 'places' : 'temp',
            fileSize: 0, // Kommer att uppdateras vid nästa scan
            note: ''
          };
          
          // Lägg till den återställda filen i media-listan om den inte redan finns
          updateMedia(prev => {
            const exists = prev.some(m => m.id === mediaId || m.filePath === filePath);
            if (exists) {
              // Uppdatera befintlig
              return prev.map(m => 
                (m.id === mediaId || m.filePath === filePath) ? restoredMediaItem : m
              );
            } else {
              // Lägg till ny
              return [...prev, restoredMediaItem];
            }
          });
          
          if (typeof showStatus === 'function') {
            showStatus(`"${fileName}" har återställts och lagts till i biblioteket.`, 'success');
          }
        }}
        onEmptyTrash={(deletedCount) => {
          if (typeof showStatus === 'function') {
            showStatus(`${deletedCount} filer raderade från papperskorgen.`, 'success');
          }
        }}
      />

      {/* LINK PERSON MODAL */}
      <LinkPersonModal
        isOpen={showLinkPersonModal}
        onClose={() => setShowLinkPersonModal(false)}
        people={allPeople}
        onLink={(personId) => {
          console.log('[MediaManager] LinkPersonModal onLink anropad:', {
            personId,
            safeDisplayImageExists: !!safeDisplayImage,
            safeDisplayImageId: safeDisplayImage?.id,
            safeDisplayImageName: safeDisplayImage?.name,
            safeDisplayImageConnections: safeDisplayImage?.connections,
            mediaItemsCount: mediaItems.length
          });
          
          if (safeDisplayImage && personId) {
            const person = allPeople.find(p => p.id === personId);
            console.log('[MediaManager] Person hittad:', {
              personFound: !!person,
              personId,
              personName: person ? `${person.firstName} ${person.lastName}` : null
            });
            
            if (person) {
              const existingPeople = safeDisplayImage.connections?.people || [];
              console.log('[MediaManager] Befintliga personer:', {
                existingPeople,
                existingPeopleType: typeof existingPeople,
                isArray: Array.isArray(existingPeople),
                length: Array.isArray(existingPeople) ? existingPeople.length : 'ej array'
              });
              
              const personAlreadyLinked = existingPeople.some(p => (typeof p === 'string' ? p : p.id) === personId);
              console.log('[MediaManager] Person redan kopplad?', personAlreadyLinked);
              
              if (!personAlreadyLinked) {
                const personToAdd = {
                  id: person.id,
                  name: `${person.firstName} ${person.lastName}`,
                  ref: person.refNumber || '',
                  dates: '' // Kan fyllas i senare
                };
                console.log('[MediaManager] Lägger till person:', personToAdd);
                
                const updatedMedia = mediaItems.map(item => {
                  if (item.id === safeDisplayImage.id) {
                    const oldConnections = item.connections || {};
                    const newConnections = {
                      ...oldConnections,
                      people: [...(Array.isArray(oldConnections.people) ? oldConnections.people : []), personToAdd],
                      places: Array.isArray(oldConnections.places) ? oldConnections.places : [],
                      sources: Array.isArray(oldConnections.sources) ? oldConnections.sources : []
                    };
                    console.log('[MediaManager] Uppdaterar item:', {
                      itemId: item.id,
                      oldConnections,
                      newConnections,
                      peopleCount: newConnections.people.length
                    });
                    return {
                      ...item,
                      connections: newConnections
                    };
                  }
                  return item;
                });
                
                const updatedItem = updatedMedia.find(m => m.id === safeDisplayImage.id);
                console.log('[MediaManager] ✅ Uppdaterad media:', {
                  imageId: safeDisplayImage.id,
                  imageName: safeDisplayImage.name,
                  personToAdd,
                  updatedItem,
                  updatedItemConnections: updatedItem?.connections,
                  updatedItemPeople: updatedItem?.connections?.people,
                  updatedItemPeopleType: typeof updatedItem?.connections?.people,
                  updatedItemPeopleIsArray: Array.isArray(updatedItem?.connections?.people),
                  updatedItemPeopleLength: Array.isArray(updatedItem?.connections?.people) ? updatedItem?.connections?.people.length : 'ej array'
                });
                
                updateMedia(updatedMedia);
                
                setSelectedImage({
                  ...safeDisplayImage,
                  connections: {
                    ...safeDisplayImage.connections,
                    people: [...existingPeople, personToAdd]
                  }
                });
                
                showStatus(`Person kopplad till ${safeDisplayImage.name}`);
              } else {
                showStatus('Personen är redan kopplad till bilden');
              }
            }
          }
          setShowLinkPersonModal(false);
        }}
        skipEventSelection={true}
        excludePersonIds={(safeDisplayImage?.connections?.people || []).map(p => typeof p === 'string' ? p : p.id).filter(Boolean)}
        zIndex={6000}
      />

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
    </>
  );
}