import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, Plus, Trash2, Star, MoreHorizontal,
  Search, X, Grid, List, Eye, UploadCloud, Check, User, FileText, MapPin,
  Edit2, Link as LinkIcon, Folder, FolderPlus, Layers, MoveRight,
  ChevronRight, ChevronDown
} from 'lucide-react';
import ImageViewer from './ImageViewer.jsx';
import WindowFrame from './WindowFrame.jsx';
import Editor from './MaybeEditor.jsx';
import { MediaManager } from './MediaManager.jsx';

/**
 * Återanvändbar komponent för att hantera media (bilder) för personer, källor, platser, etc.
 * 
 * @param {Array} media - Array av media-objekt
 * @param {Function} onMediaChange - Callback när media ändras (newMedia) => void
 * @param {String} entityType - Typ av entitet ('person', 'source', 'place')
 * @param {String} entityId - ID för entiteten
 * @param {Array} allPeople - Alla personer (för ImageViewer)
 * @param {Function} onOpenEditModal - Callback för att öppna person-redigering
 * @param {Array} allMediaItems - Alla media-items från databasen (för MediaManagerModal)
 * @param {Function} onUpdateAllMedia - Callback när alla media uppdateras
 * @param {Array} allSources - Alla källor (för att visa kopplingar)
 * @param {Array} allPlaces - Alla platser (för att visa kopplingar)
 */
export default function MediaSelector({
  media = [],
  onMediaChange,
  entityType = 'person',
  entityId = null,
  allPeople = [],
  onOpenEditModal = () => {},
  allMediaItems = [],
  onUpdateAllMedia = () => {},
  allSources = [],
  allPlaces = []
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' eller 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [showConnectionsIndex, setShowConnectionsIndex] = useState(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Bibliotekssystem
  const [activeLibrary, setActiveLibrary] = useState('all');
  const [customLibraries, setCustomLibraries] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [isCreatingLibrary, setIsCreatingLibrary] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState(null);
  
  // Systembibliotek
  const SYSTEM_LIBRARIES = [
    { id: 'all', label: 'Alla bilder', icon: Layers, type: 'system', path: '' },
    { id: 'persons', label: 'Personer', icon: User, type: 'system', path: 'persons/' },
    { id: 'sources', label: 'Källor', icon: FileText, type: 'system', path: 'sources/' },
    { id: 'places', label: 'Platser', icon: MapPin, type: 'system', path: 'places/' },
    { id: 'temp', label: 'Tillfälliga', icon: Folder, type: 'system', path: 'temp/' }
  ];

  // Hjälpfunktion för att få alla bibliotek (system + custom)
  const allLibraries = [...SYSTEM_LIBRARIES, ...customLibraries];
  
  // Hjälpfunktion för att filtrera media baserat på aktivt bibliotek
  const getFilteredMediaByLibrary = (items) => {
    if (activeLibrary === 'all') {
      return items;
    }
    
    const activeLib = allLibraries.find(lib => lib.id === activeLibrary);
    if (!activeLib) return items;
    
    // Filtrera baserat på bibliotekets path eller libraryId
    return items.filter(item => {
      // Om item har libraryId, matcha mot det
      if (item.libraryId === activeLibrary) {
        return true;
      }
      
      // Annars matcha mot URL path
      if (item.url && activeLib.path) {
        // Extrahera path från media:// URL
        let urlPath = item.url;
        if (urlPath.startsWith('media://')) {
          try {
            urlPath = decodeURIComponent(urlPath.replace('media://', ''));
          } catch (e) {
            urlPath = urlPath.replace('media://', '');
          }
        }
        // Kontrollera om path matchar
        if (activeLib.path && urlPath.includes(activeLib.path)) {
          return true;
        }
      }
      
      // För systembibliotek, matcha mot path i URL
      if (activeLib.type === 'system' && activeLib.path) {
        let urlPath = item.url || '';
        if (urlPath.startsWith('media://')) {
          try {
            urlPath = decodeURIComponent(urlPath.replace('media://', ''));
          } catch (e) {
            urlPath = urlPath.replace('media://', '');
          }
        }
        return urlPath.includes(activeLib.path);
      }
      
      return false;
    });
  };
  
  // Filtrera media baserat på sökterm
  const filteredMedia = media.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (item.name || '').toLowerCase().includes(search) ||
           (item.description || '').toLowerCase().includes(search);
  });

  // Hantera drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.target.style.opacity = '0.5';
  };

  // Hantera drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // Hantera drag leave
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Hantera drop för sortering
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newMedia = [...media];
    const [removed] = newMedia.splice(draggedIndex, 1);
    newMedia.splice(dropIndex, 0, removed);
    onMediaChange(newMedia);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Hantera drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Ta bort bild
  const handleRemoveImage = (index) => {
    if (confirm('Vill du ta bort denna bild?')) {
      const newMedia = media.filter((_, i) => i !== index);
      onMediaChange(newMedia);
      if (selectedImageIndex === index) {
        setSelectedImageIndex(null);
      } else if (selectedImageIndex > index) {
        setSelectedImageIndex(selectedImageIndex - 1);
      }
    }
  };

  // Välj som profilbild (första bilden)
  const handleSetAsProfile = (index) => {
    if (index === 0) return; // Redan profilbild
    const newMedia = [...media];
    const [selected] = newMedia.splice(index, 1);
    newMedia.unshift(selected);
    onMediaChange(newMedia);
    setSelectedImageIndex(0);
  };

  // Hantera filuppladdning
  const handleFileSelect = async (files, isPaste = false) => {
    const newImages = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        // Generera namn baserat på datum och tid om det är klistrat in
        let imageName = file.name;
        if (isPaste) {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          const seconds = String(now.getSeconds()).padStart(2, '0');
          // Behåll filändelsen
          const extension = file.name.split('.').pop() || 'png';
          imageName = `${year}${month}${day}-${hours}${minutes}${seconds}.${extension}`;
        }
        
        // Läs filen som ArrayBuffer för att spara till disk
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Array.from(new Uint8Array(arrayBuffer));
        
        // Bestäm undermapp baserat på entityType (Hybrid-struktur)
        let subfolder = 'temp'; // Standard för temporära/klistrade bilder
        if (entityType === 'person') {
          subfolder = 'persons';
        } else if (entityType === 'source') {
          subfolder = 'sources';
        } else if (entityType === 'place') {
          subfolder = 'places';
        }
        
        // Skapa sökväg med undermapp
        const relativePath = `${subfolder}/${imageName}`;
        
        // Spara till media-mappen via Electron
        let savedPath = null;
        let imageUrl = URL.createObjectURL(file); // Temporär blob URL
        
        if (window.electronAPI && window.electronAPI.saveFileBufferToMedia) {
          try {
            console.log('[MediaSelector] Sparar bild:', { relativePath, fileBufferLength: fileBuffer.length, entityType });
            const result = await window.electronAPI.saveFileBufferToMedia(fileBuffer, relativePath);
            console.log('[MediaSelector] Spar-resultat:', result);
            if (result && result.success) {
              // Använd media:// protocol URL istället för blob URL
              savedPath = result.filePath || relativePath;
              imageUrl = `media://${encodeURIComponent(savedPath)}`;
              console.log('[MediaSelector] Bild sparad, URL:', imageUrl);
            } else {
              console.warn('[MediaSelector] Sparning misslyckades:', result);
            }
          } catch (error) {
            console.error('[MediaSelector] Error saving file to media folder:', error);
            // Fallback: använd blob URL om sparning misslyckas
          }
        } else {
          console.warn('[MediaSelector] window.electronAPI.saveFileBufferToMedia finns inte!');
        }
        
        // Bestäm libraryId baserat på entityType
        let libraryId = 'temp';
        if (entityType === 'person') libraryId = 'persons';
        else if (entityType === 'source') libraryId = 'sources';
        else if (entityType === 'place') libraryId = 'places';
        
        const newImage = {
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          url: imageUrl,
          name: imageName,
          file: file, // Behåll filen för senare uppladdning (om sparning misslyckades)
          date: new Date().toISOString().split('T')[0],
          description: '',
          tags: [],
          connections: {},
          libraryId: libraryId // Lägg till libraryId
        };
        
        // Om det är en person, lägg till personen i connections
        if (entityType === 'person' && entityId) {
          const person = allPeople.find(p => p.id === entityId);
          if (person) {
            newImage.connections = {
              people: [{
                id: person.id,
                name: `${person.firstName} ${person.lastName}`,
                ref: person.refNumber || '',
                dates: '' // Kan fyllas i senare
              }]
            };
          }
        }
        
        newImages.push(newImage);
      }
    }
    if (newImages.length > 0) {
      // Uppdatera lokal media
      onMediaChange([...media, ...newImages]);
      
      // Lägg till i global media-lista (dbData.media) så de syns i biblioteket
      // VIKTIGT: Uppdatera connections i global media också
      if (onUpdateAllMedia) {
        const updatedAllMedia = [...(allMediaItems || []), ...newImages];
        onUpdateAllMedia(updatedAllMedia);
      }
    }
  };

  // Hantera drag-and-drop för filer
  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files);
      }
    };

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    return () => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
    };
  }, [media]);

  // Hantera klistra in (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        handleFileSelect(e.clipboardData.files, true); // true = isPaste
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [media]);


  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setIsMediaManagerOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-2 transition-colors"
          >
            <ImageIcon size={16} />
            Välj från bibliotek
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded flex items-center gap-2 transition-colors"
          >
            <UploadCloud size={16} />
            Ladda upp
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>
        
        {filteredMedia.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök bilder..."
                className="pl-8 pr-8 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none w-48"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title={viewMode === 'grid' ? 'Lista' : 'Grid'}
            >
              <Grid size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Media Grid/List */}
      <div 
        ref={dropZoneRef}
        className={`flex-1 overflow-y-auto ${isDragging ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}
      >
        {filteredMedia.length === 0 ? (
          <div 
            className={`h-full border-2 border-dashed rounded-lg flex items-center justify-center text-slate-400 ${
              isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600'
            }`}
          >
            <div className="text-center">
              <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Inga bilder ännu</p>
              <p className="text-xs mt-1">Klicka på "Välj från bibliotek" eller "Ladda upp"</p>
              <p className="text-xs mt-1">Dra och släpp eller klistra in (Ctrl+V)</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {filteredMedia.map((item, idx) => {
              const originalIndex = media.findIndex(m => m.id === item.id);
              const isProfile = entityType === 'person' && originalIndex === 0;
              
              return (
                <div
                  key={item.id || idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                  className={`group relative rounded-lg border-2 overflow-hidden transition-all ${
                    dragOverIndex === originalIndex 
                      ? 'border-blue-500 ring-2 ring-blue-500/50 scale-105' 
                      : selectedImageIndex === originalIndex
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-slate-700 hover:border-slate-600'
                  } ${draggedIndex === originalIndex ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-col">
                    <div 
                      className="aspect-square bg-slate-800 relative cursor-pointer"
                      onClick={() => {
                        setSelectedImageIndex(originalIndex);
                        setIsImageViewerOpen(true);
                      }}
                    >
                      <img 
                        src={item.url} 
                        alt={item.name || 'Bild'} 
                        className="w-full h-full object-cover"
                      />
                      {isProfile && (
                        <div className="absolute top-2 left-2 bg-yellow-500 text-yellow-900 rounded-full p-1">
                          <Star size={14} fill="currentColor" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsImageViewerOpen(true);
                            setSelectedImageIndex(originalIndex);
                          }}
                          className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white"
                          title="Visa"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteIndex(originalIndex);
                          }}
                          className="p-2 bg-blue-600 rounded hover:bg-blue-700 text-white"
                          title="Redigera notiser"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowConnectionsIndex(showConnectionsIndex === originalIndex ? null : originalIndex);
                          }}
                          className={`p-2 rounded text-white ${showConnectionsIndex === originalIndex ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                          title="Kopplingar"
                        >
                          <LinkIcon size={14} />
                        </button>
                        {entityType === 'person' && !isProfile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetAsProfile(originalIndex);
                            }}
                            className="p-2 bg-yellow-600 rounded hover:bg-yellow-700 text-white"
                            title="Sätt som profilbild"
                          >
                            <Star size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(originalIndex);
                          }}
                          className="p-2 bg-red-600 rounded hover:bg-red-700 text-white"
                          title="Ta bort"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-medium truncate">{item.name || 'Namnlös'}</p>
                        {item.date && (
                          <p className="text-white/70 text-[10px]">{item.date}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Förhandsvisning av noteringar under bilden (grid-vy) */}
                    {item.note && (
                      <div 
                        className="mt-2 p-2 bg-slate-900 border border-slate-700 rounded cursor-pointer hover:border-slate-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteIndex(originalIndex);
                        }}
                      >
                        <div className="text-xs text-slate-300 line-clamp-2" dangerouslySetInnerHTML={{ __html: item.note }} />
                        <p className="text-[10px] text-slate-500 mt-1">Klicka för att redigera</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMedia.map((item, idx) => {
              const originalIndex = media.findIndex(m => m.id === item.id);
              const isProfile = entityType === 'person' && originalIndex === 0;
              
              return (
                <div
                  key={item.id || idx}
                  draggable
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-start gap-4 p-3 rounded-lg border-2 transition-all ${
                    dragOverIndex === originalIndex 
                      ? 'border-blue-500 ring-2 ring-blue-500/50' 
                      : selectedImageIndex === originalIndex
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                  } ${draggedIndex === originalIndex ? 'opacity-50' : ''}`}
                >
                  <div 
                    className="w-16 h-16 bg-slate-800 rounded overflow-hidden flex-shrink-0 relative cursor-pointer"
                    onClick={() => {
                      setSelectedImageIndex(originalIndex);
                      setIsImageViewerOpen(true);
                    }}
                  >
                    <img 
                      src={item.url} 
                      alt={item.name || 'Bild'} 
                      className="w-full h-full object-cover"
                    />
                    {isProfile && (
                      <div className="absolute top-1 left-1 bg-yellow-500 text-yellow-900 rounded-full p-0.5">
                        <Star size={10} fill="currentColor" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p 
                        className="text-sm font-medium text-slate-200 truncate cursor-pointer hover:text-blue-400"
                        onClick={() => {
                          setSelectedImageIndex(originalIndex);
                          setIsImageViewerOpen(true);
                        }}
                      >
                        {item.name || 'Namnlös'}
                      </p>
                      {isProfile && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Profilbild</span>
                      )}
                    </div>
                    {item.date && (
                      <p className="text-xs text-slate-400">{item.date}</p>
                    )}
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{item.description}</p>
                    )}
                    
                    {/* Förhandsvisning av noteringar till höger om bilden (list-vy) */}
                    {item.note && (
                      <div 
                        className="mt-3 p-2 bg-slate-900 border border-slate-700 rounded cursor-pointer hover:border-slate-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteIndex(originalIndex);
                        }}
                      >
                        <div className="text-xs text-slate-300 line-clamp-3" dangerouslySetInnerHTML={{ __html: item.note }} />
                        <p className="text-[10px] text-slate-500 mt-1">Klicka för att redigera</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageViewerOpen(true);
                        setSelectedImageIndex(originalIndex);
                      }}
                      className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white"
                      title="Visa"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNoteIndex(originalIndex);
                      }}
                      className="p-2 bg-blue-600 rounded hover:bg-blue-700 text-white"
                      title="Redigera notiser"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConnectionsIndex(showConnectionsIndex === originalIndex ? null : originalIndex);
                      }}
                      className={`p-2 rounded text-white ${showConnectionsIndex === originalIndex ? 'bg-purple-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                      title="Kopplingar"
                    >
                      <LinkIcon size={14} />
                    </button>
                    {entityType === 'person' && !isProfile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetAsProfile(originalIndex);
                        }}
                        className="p-2 bg-yellow-600 rounded hover:bg-yellow-700 text-white"
                        title="Sätt som profilbild"
                      >
                        <Star size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(originalIndex);
                      }}
                      className="p-2 bg-red-600 rounded hover:bg-red-700 text-white"
                      title="Ta bort"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MediaManager som modal för att välja bilder */}
      {isMediaManagerOpen && (
        <WindowFrame
          title="Välj bilder från bibliotek"
          icon={ImageIcon}
          onClose={() => setIsMediaManagerOpen(false)}
          initialWidth={1400}
          initialHeight={800}
          zIndex={5000}
        >
          <div className="h-full w-full bg-slate-900">
            <MediaManager
              allPeople={allPeople}
              onOpenEditModal={onOpenEditModal}
              mediaItems={allMediaItems}
              onUpdateMedia={(updatedMedia) => {
                // Uppdatera global media-lista
                if (onUpdateAllMedia) {
                  onUpdateAllMedia(updatedMedia);
                }
              }}
              setIsSourceDrawerOpen={() => {}}
              setIsPlaceDrawerOpen={() => {}}
              onSelectMedia={(selectedItems) => {
                // Lägg till valda bilder i personens media-lista
                const newItems = selectedItems.filter(item => !media.some(m => m.id === item.id));
                if (newItems.length > 0) {
                  const itemsToAdd = newItems.map(item => {
                    const newItem = {
                      id: item.id,
                      url: item.url,
                      name: item.name,
                      date: item.date || new Date().toISOString().split('T')[0],
                      description: item.description || '',
                      tags: item.tags || [],
                      regions: item.faces || item.regions || [],
                      connections: item.connections || {},
                      libraryId: item.libraryId,
                      note: item.note || ''
                    };
                    
                    // Om det är en person, lägg till personen i connections om den inte redan finns
                    if (entityType === 'person' && entityId) {
                      const person = allPeople.find(p => p.id === entityId);
                      if (person) {
                        const existingPeople = newItem.connections.people || [];
                        const personAlreadyLinked = existingPeople.some(p => p.id === entityId);
                        
                        if (!personAlreadyLinked) {
                          newItem.connections = {
                            ...newItem.connections,
                            people: [
                              ...existingPeople,
                              {
                                id: person.id,
                                name: `${person.firstName} ${person.lastName}`,
                                ref: person.refNumber || '',
                                dates: ''
                              }
                            ]
                          };
                        }
                      }
                    }
                    
                    return newItem;
                  });
                  
                  onMediaChange([...media, ...itemsToAdd]);
                  
                  // Uppdatera även i global media-lista
                  if (onUpdateAllMedia && allMediaItems) {
                    const updatedAllMedia = allMediaItems.map(m => {
                      const addedItem = itemsToAdd.find(item => item.id === m.id);
                      if (addedItem) {
                        return { ...m, connections: addedItem.connections };
                      }
                      return m;
                    });
                    onUpdateAllMedia(updatedAllMedia);
                  }
                } else {
                  // Ta bort bilder som inte längre är valda
                  const currentIds = selectedItems.map(item => item.id);
                  const itemsToRemove = media.filter(m => !currentIds.includes(m.id));
                  if (itemsToRemove.length > 0) {
                    const newMedia = media.filter(m => currentIds.includes(m.id));
                    onMediaChange(newMedia);
                  }
                }
              }}
              selectedMediaIds={media.map(m => m.id)}
            />
          </div>
        </WindowFrame>
      )}
      
      {/* Gammal modal-kod (kommenterad ut) */}
      {false && isMediaManagerOpen && (
        <WindowFrame
          title="Välj bilder från bibliotek"
          icon={ImageIcon}
          onClose={() => setIsMediaManagerOpen(false)}
          initialWidth={1000}
          initialHeight={700}
          zIndex={5000}
        >
          <div className="h-full flex flex-col bg-slate-800">
            <div className="flex flex-1 overflow-hidden">
              {/* Vänster sidebar: Bibliotek */}
              <div className="w-64 bg-slate-800/50 border-r border-slate-700 flex flex-col shrink-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  <div className="space-y-1">
                    <p className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">Bibliotek</p>
                    {SYSTEM_LIBRARIES.map(lib => {
                      const Icon = lib.icon;
                      return (
                        <button
                          key={lib.id}
                          onClick={() => setActiveLibrary(lib.id)}
                          className={`flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors ${
                            activeLibrary === lib.id
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon size={16} />
                          <span className="flex-1 text-left">{lib.label}</span>
                        </button>
                      );
                    })}
                    
                    {/* Custom libraries */}
                    {customLibraries.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase mt-2">Egna mappar</div>
                        {customLibraries.map(lib => {
                          const Icon = lib.icon || Folder;
                          return (
                            <button
                              key={lib.id}
                              onClick={() => setActiveLibrary(lib.id)}
                              className={`flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors ${
                                activeLibrary === lib.id
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              <Icon size={16} />
                              <span className="flex-1 text-left">{lib.label}</span>
                            </button>
                          );
                        })}
                      </>
                    )}
                    
                    {/* Skapa nytt bibliotek */}
                    <div className="border-t border-slate-700/50 mt-2 pt-2">
                      {isCreatingLibrary ? (
                        <div className="px-3 py-2">
                          <input
                            type="text"
                            value={newLibraryName}
                            onChange={(e) => setNewLibraryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newLibraryName.trim()) {
                                const newLib = {
                                  id: `lib_${Date.now()}`,
                                  label: newLibraryName.trim(),
                                  icon: Folder,
                                  type: 'custom',
                                  path: `custom/${newLibraryName.trim().toLowerCase().replace(/\s+/g, '_')}/`
                                };
                                setCustomLibraries([...customLibraries, newLib]);
                                setNewLibraryName('');
                                setIsCreatingLibrary(false);
                                setActiveLibrary(newLib.id);
                              } else if (e.key === 'Escape') {
                                setIsCreatingLibrary(false);
                                setNewLibraryName('');
                              }
                            }}
                            placeholder="Mappnamn..."
                            className="w-full px-2 py-1 bg-slate-700 text-white text-sm rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsCreatingLibrary(true)}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                          <FolderPlus size={16} />
                          <span>Skapa mapp</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Huvudområde: Bilderna */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {/* Sök och filter */}
                <div className="mb-4 flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Sök bilder..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
                    title={viewMode === 'grid' ? 'Listvy' : 'Rutnätsvy'}
                  >
                    {viewMode === 'grid' ? <Grid size={18} /> : <List size={18} />}
                  </button>
                </div>
                
                {/* Filtrera media baserat på aktivt bibliotek och sökterm */}
                {(() => {
                  const libraryFiltered = getFilteredMediaByLibrary(allMediaItems);
                  const searchFiltered = libraryFiltered.filter(item => {
                    if (!searchTerm) return true;
                    const search = searchTerm.toLowerCase();
                    return (item.name || '').toLowerCase().includes(search) ||
                           (item.description || '').toLowerCase().includes(search) ||
                           (item.tags || []).some(tag => tag.toLowerCase().includes(search));
                  });
                  
                  if (searchFiltered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400">
                        <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Inga bilder hittades</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className={viewMode === 'grid' 
                      ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4"
                      : "space-y-2"
                    }>
                      {searchFiltered.map((item) => {
                        const isSelected = media.some(m => m.id === item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (!isSelected) {
                                const newItem = {
                                  id: item.id,
                                  url: item.url,
                                  name: item.name,
                                  date: item.date || new Date().toISOString().split('T')[0],
                                  description: item.description || '',
                                  tags: item.tags || [],
                                  regions: item.faces || item.regions || [],
                                  connections: item.connections || {},
                                  libraryId: item.libraryId,
                                  note: item.note || ''
                                };
                                
                                // Om det är en person, lägg till personen i connections om den inte redan finns
                                if (entityType === 'person' && entityId) {
                                  const person = allPeople.find(p => p.id === entityId);
                                  if (person) {
                                    const existingPeople = newItem.connections.people || [];
                                    const personAlreadyLinked = existingPeople.some(p => p.id === entityId);
                                    
                                    if (!personAlreadyLinked) {
                                      newItem.connections = {
                                        ...newItem.connections,
                                        people: [
                                          ...existingPeople,
                                          {
                                            id: person.id,
                                            name: `${person.firstName} ${person.lastName}`,
                                            ref: person.refNumber || '',
                                            dates: '' // Kan fyllas i senare
                                          }
                                        ]
                                      };
                                      
                                      // Uppdatera även i global media-lista om bilden redan finns där
                                      if (onUpdateAllMedia && allMediaItems) {
                                        const updatedAllMedia = allMediaItems.map(m => 
                                          m.id === item.id ? { ...m, connections: newItem.connections } : m
                                        );
                                        onUpdateAllMedia(updatedAllMedia);
                                      }
                                    }
                                  }
                                }
                                
                                // Lägg till bilden i personens media-lista
                                onMediaChange([...media, newItem]);
                              } else {
                                // Om bilden redan är vald, ta bort den
                                const newMedia = media.filter(m => m.id !== item.id);
                                onMediaChange(newMedia);
                              }
                            }}
                            className={viewMode === 'grid' 
                              ? `relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all group ${
                                  isSelected 
                                    ? 'border-green-500 ring-2 ring-green-500/50' 
                                    : 'border-slate-700 hover:border-blue-500'
                                }`
                              : `flex items-center gap-4 p-2 rounded border cursor-pointer ${
                                  isSelected 
                                    ? 'bg-green-500/20 border-green-500' 
                                    : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800'
                                }`
                            }
                          >
                            {viewMode === 'grid' ? (
                              <>
                                <img 
                                  src={item.url} 
                                  alt={item.name} 
                                  className="w-full h-full object-cover"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                                    <div className="bg-green-500 text-white rounded-full p-2">
                                      <Check size={20} />
                                    </div>
                                  </div>
                                )}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setItemToMove(item);
                                        setIsMoveModalOpen(true);
                                      }}
                                      className="p-1.5 bg-slate-800/90 hover:bg-slate-700 rounded text-white"
                                      title="Flytta till annan mapp"
                                    >
                                      <MoveRight size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="text-white text-xs truncate">{item.name}</p>
                                  {item.date && (
                                    <p className="text-white/70 text-[10px]">{item.date}</p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-16 h-16 bg-slate-900 rounded overflow-hidden shrink-0 border border-slate-600">
                                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-slate-200 font-medium truncate">{item.name}</p>
                                  {item.date && <p className="text-xs text-slate-400">{item.date}</p>}
                                  {item.description && (
                                    <p className="text-xs text-slate-500 truncate mt-1">{item.description}</p>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="shrink-0">
                                    <Check size={20} className="text-green-500" />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </WindowFrame>
      )}

      {/* Flytta bild-modal */}
      {isMoveModalOpen && itemToMove && (
        <WindowFrame
          title="Flytta bild"
          icon={MoveRight}
          onClose={() => {
            setIsMoveModalOpen(false);
            setItemToMove(null);
          }}
          initialWidth={400}
          initialHeight={300}
          zIndex={5001}
        >
          <div className="p-4 bg-slate-800">
            <p className="text-slate-200 mb-4">Välj mapp att flytta bilden till:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {allLibraries.filter(lib => lib.id !== 'all').map(lib => {
                const Icon = lib.icon;
                return (
                  <button
                    key={lib.id}
                    onClick={async () => {
                      await handleMoveImage(itemToMove, lib.id);
                      setIsMoveModalOpen(false);
                      setItemToMove(null);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <Icon size={16} />
                    <span className="flex-1 text-left">{lib.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </WindowFrame>
      )}

      {/* Flytta bild-modal */}
      {isMoveModalOpen && itemToMove && (
        <WindowFrame
          title="Flytta bild"
          icon={MoveRight}
          onClose={() => {
            setIsMoveModalOpen(false);
            setItemToMove(null);
          }}
          initialWidth={400}
          initialHeight={300}
          zIndex={5001}
        >
          <div className="p-4 bg-slate-800">
            <p className="text-slate-200 mb-4">Välj mapp att flytta bilden till:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {allLibraries.filter(lib => lib.id !== 'all').map(lib => {
                const Icon = lib.icon;
                return (
                  <button
                    key={lib.id}
                    onClick={async () => {
                      await handleMoveImage(itemToMove, lib.id);
                      setIsMoveModalOpen(false);
                      setItemToMove(null);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    <Icon size={16} />
                    <span className="flex-1 text-left">{lib.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </WindowFrame>
      )}

      {/* ImageViewer */}
      {isImageViewerOpen && selectedImageIndex !== null && media[selectedImageIndex] && (
        <ImageViewer
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
          imageSrc={media[selectedImageIndex].url}
          imageTitle={media[selectedImageIndex].name}
          regions={media[selectedImageIndex].regions || []}
          onSaveRegions={(newRegions) => {
            const updatedMedia = [...media];
            updatedMedia[selectedImageIndex] = {
              ...updatedMedia[selectedImageIndex],
              regions: newRegions
            };
            onMediaChange(updatedMedia);
          }}
          people={allPeople}
          onOpenEditModal={onOpenEditModal}
          connections={media[selectedImageIndex].connections || {}}
        />
      )}

      {/* Notiser Modal */}
      {editingNoteIndex !== null && media[editingNoteIndex] && (
        <NoteEditorModal
          imageName={media[editingNoteIndex].name || 'Bild'}
          initialNote={media[editingNoteIndex].note || ''}
          onSave={(noteContent) => {
            const updatedMedia = [...media];
            updatedMedia[editingNoteIndex] = {
              ...updatedMedia[editingNoteIndex],
              note: noteContent
            };
            onMediaChange(updatedMedia);
          }}
          onClose={() => setEditingNoteIndex(null)}
        />
      )}

      {/* Kopplingar Modal */}
      {showConnectionsIndex !== null && media[showConnectionsIndex] && (
        <WindowFrame
          title="Kopplingar"
          icon={LinkIcon}
          onClose={() => setShowConnectionsIndex(null)}
          initialWidth={600}
          initialHeight={500}
          zIndex={5001}
        >
          <div className="h-full flex flex-col bg-slate-800 p-4">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white mb-2">{media[showConnectionsIndex].name || 'Bild'}</h3>
              <p className="text-sm text-slate-400">Personer, källor och platser kopplade till denna bild</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Personer kopplade via regions (ansiktstagging) */}
              {media[showConnectionsIndex].regions && media[showConnectionsIndex].regions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <User size={16} />
                    Personer (ansiktstagging)
                  </h4>
                  <div className="space-y-2">
                    {media[showConnectionsIndex].regions.map((region, idx) => {
                      const person = allPeople.find(p => p.id === region.personId);
                      if (!person) return null;
                      return (
                        <div
                          key={idx}
                          className="p-2 bg-slate-700 rounded hover:bg-slate-600 cursor-pointer transition-colors"
                          onClick={() => {
                            onOpenEditModal(person.id);
                            setShowConnectionsIndex(null);
                          }}
                        >
                          <p className="text-sm text-white font-medium">
                            {person.firstName} {person.lastName}
                            {person.refNumber && ` (Ref: ${person.refNumber})`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Personer kopplade via connections */}
              {media[showConnectionsIndex].connections?.people && media[showConnectionsIndex].connections.people.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <User size={16} />
                    Personer
                  </h4>
                  <div className="space-y-2">
                    {media[showConnectionsIndex].connections.people.map((conn, idx) => {
                      const person = allPeople.find(p => p.id === conn.id);
                      if (!person) return null;
                      return (
                        <div
                          key={idx}
                          className="p-2 bg-slate-700 rounded hover:bg-slate-600 cursor-pointer transition-colors"
                          onClick={() => {
                            onOpenEditModal(person.id);
                            setShowConnectionsIndex(null);
                          }}
                        >
                          <p className="text-sm text-white font-medium">
                            {person.firstName} {person.lastName}
                            {person.refNumber && ` (Ref: ${person.refNumber})`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Källor */}
              {media[showConnectionsIndex].connections?.sources && media[showConnectionsIndex].connections.sources.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <FileText size={16} />
                    Källor
                  </h4>
                  <div className="space-y-2">
                    {media[showConnectionsIndex].connections.sources.map((source, idx) => (
                      <div key={idx} className="p-2 bg-slate-700 rounded">
                        <p className="text-sm text-white font-medium">{source.name || source.id}</p>
                        {source.ref && <p className="text-xs text-slate-400 mt-1">Ref: {source.ref}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Platser */}
              {media[showConnectionsIndex].connections?.places && media[showConnectionsIndex].connections.places.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                    <MapPin size={16} />
                    Platser
                  </h4>
                  <div className="space-y-2">
                    {media[showConnectionsIndex].connections.places.map((place, idx) => (
                      <div key={idx} className="p-2 bg-slate-700 rounded">
                        <p className="text-sm text-white font-medium">{place.name || place.id}</p>
                        {place.type && <p className="text-xs text-slate-400 mt-1">Typ: {place.type}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Om inga kopplingar finns */}
              {(!media[showConnectionsIndex].regions || media[showConnectionsIndex].regions.length === 0) &&
               (!media[showConnectionsIndex].connections?.people || media[showConnectionsIndex].connections.people.length === 0) &&
               (!media[showConnectionsIndex].connections?.sources || media[showConnectionsIndex].connections.sources.length === 0) &&
               (!media[showConnectionsIndex].connections?.places || media[showConnectionsIndex].connections.places.length === 0) && (
                <div className="text-center py-8 text-slate-400">
                  <LinkIcon size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Inga kopplingar ännu</p>
                  <p className="text-xs mt-1">Använd ansiktstagging eller koppla till källor/platser</p>
                </div>
              )}
            </div>
          </div>
        </WindowFrame>
      )}
    </div>
  );
}

// Separat komponent för notis-redigering
function NoteEditorModal({ imageName, initialNote, onSave, onClose }) {
  const [noteContent, setNoteContent] = useState(initialNote);

  // Uppdatera när initialNote ändras (om användaren öppnar en annan bild)
  useEffect(() => {
    setNoteContent(initialNote);
  }, [initialNote]);

  const handleSave = () => {
    onSave(noteContent);
    onClose();
  };

  return (
    <WindowFrame
      title="Notiser"
      icon={Edit2}
      onClose={handleSave}
      initialWidth={800}
      initialHeight={600}
      zIndex={5001}
    >
      <div className="h-full flex flex-col bg-slate-800 p-4">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white mb-2">{imageName}</h3>
          <p className="text-sm text-slate-400">Lägg till notiser om denna bild</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Editor
            value={noteContent}
            onChange={(e) => {
              setNoteContent(e.target.value);
            }}
            placeholder="Skriv notiser om denna bild..."
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded"
          >
            Stäng
          </button>
        </div>
      </div>
    </WindowFrame>
  );
}

