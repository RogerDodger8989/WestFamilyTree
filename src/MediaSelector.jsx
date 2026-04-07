import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  Image as ImageIcon, Plus, Trash2, Star, MoreHorizontal,
  Search, X, Grid, List, Eye, UploadCloud, Check, User, FileText, MapPin,
  Edit2, Link as LinkIcon, Folder, FolderPlus, Layers, MoveRight, Download,
  ChevronRight, ChevronDown
} from 'lucide-react';
import ImageViewer from './ImageViewer.jsx';
import WindowFrame from './WindowFrame.jsx';
import Editor from './MaybeEditor.jsx';
import { MediaManager } from './MediaManager.jsx';
import MediaImage from './components/MediaImage.jsx';
import { getAvatarImageStyle } from './imageUtils.js';
import { useApp } from './AppContext.jsx';

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
  mediaSortConfig = { sortBy: 'custom', imageSize: 0.62 },
  onMediaSortChange = () => {},
  entityType = 'person',
  entityId = null,
  allPeople = [],
  onOpenEditModal = () => {},
  allMediaItems = [],
  onUpdateAllMedia = () => {},
  allSources = [],
  allPlaces = []
}) {
  const { showUndoToast } = useApp();
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
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const imageSizeMultiplier = Number(mediaSortConfig?.imageSize ?? 0.62);
  const sortBy = mediaSortConfig?.sortBy || 'custom';
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, itemIndex: null });
  
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

  const sortedFilteredMedia = [...filteredMedia].sort((a, b) => {
    if (sortBy === 'custom') return 0;

    if (sortBy === 'name-asc') {
      return String(a?.name || '').localeCompare(String(b?.name || ''), 'sv');
    }
    if (sortBy === 'name-desc') {
      return String(b?.name || '').localeCompare(String(a?.name || ''), 'sv');
    }

    const dateA = new Date(a?.date || 0).getTime();
    const dateB = new Date(b?.date || 0).getTime();
    if (sortBy === 'date-asc') {
      return dateA - dateB;
    }
    if (sortBy === 'date-desc') {
      return dateB - dateA;
    }

    return 0;
  });

  const updateMediaSortConfig = (partial) => {
    onMediaSortChange({
      ...(mediaSortConfig || {}),
      ...partial
    });
  };

  const stripHtmlTags = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

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
    clearSelectedIndices();
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Hantera drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const clearSelectedIndices = () => {
    setSelectedIndices(new Set());
  };

  const toggleSelectedIndex = (index) => {
    setSelectedIndices((currentSelectedIndices) => {
      const nextSelectedIndices = new Set(currentSelectedIndices);
      if (nextSelectedIndices.has(index)) {
        nextSelectedIndices.delete(index);
      } else {
        nextSelectedIndices.add(index);
      }
      return nextSelectedIndices;
    });
  };

  const getDownloadFileName = (item, index) => {
    if (item?.name) {
      return item.name;
    }

    const rawUrl = String(item?.url || '');
    const fileNameFromUrl = rawUrl.split('/').pop()?.split('?')[0];
    if (fileNameFromUrl) {
      try {
        return decodeURIComponent(fileNameFromUrl);
      } catch (error) {
        return fileNameFromUrl;
      }
    }

    return `bild_${index + 1}.jpg`;
  };

  const getMimeTypeFromName = (fileName = '') => {
    const extension = String(fileName).split('.').pop()?.toLowerCase() || '';
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      tif: 'image/tiff',
      tiff: 'image/tiff'
    };

    return mimeTypes[extension] || 'application/octet-stream';
  };

  const readMediaBlob = async (item) => {
    const imageUrl = item?.url || '';

    if (imageUrl.startsWith('media://')) {
      if (!window.electronAPI || typeof window.electronAPI.readFile !== 'function') {
        throw new Error('Electron API finns inte tillgänglig för media://-nedladdning');
      }

      let filePath = imageUrl.replace('media://', '');
      try {
        filePath = decodeURIComponent(filePath);
      } catch (error) {
        filePath = filePath.replace(/%2F/g, '/').replace(/%20/g, ' ');
      }
      filePath = filePath.replace(/%2F/g, '/');

      const fileData = await window.electronAPI.readFile(filePath);
      if (fileData && fileData.error) {
        throw new Error(fileData.error);
      }

      let uint8Array = null;
      if (fileData instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(fileData);
      } else if (fileData instanceof Uint8Array) {
        uint8Array = fileData;
      } else if (Array.isArray(fileData)) {
        uint8Array = new Uint8Array(fileData);
      } else if (fileData?.data instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(fileData.data);
      } else if (fileData?.data instanceof Uint8Array) {
        uint8Array = fileData.data;
      } else if (Array.isArray(fileData?.data)) {
        uint8Array = new Uint8Array(fileData.data);
      } else if (typeof fileData === 'string') {
        const binaryString = atob(fileData);
        uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i += 1) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
      } else if (fileData?.data) {
        uint8Array = new Uint8Array(fileData.data);
      } else if (fileData) {
        uint8Array = new Uint8Array(fileData);
      }

      if (!uint8Array) {
        throw new Error('Kunde inte läsa media-filen');
      }

      return new Blob([uint8Array], { type: getMimeTypeFromName(getDownloadFileName(item, 0)) });
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Kunde inte hämta bilden (${response.status})`);
    }

    return await response.blob();
  };

  const handleDownload = async (indices, downloadAsZip = true) => {
    try {
      // Convert to array
      const indexList = Array.isArray(indices) ? indices : Array.from(indices || []);
      
      // If no indices provided, download all media
      const indicesToDownload = indexList.length > 0 ? indexList : Array.from(Array(media.length).keys());
      
      if (indicesToDownload.length === 0) {
        return;
      }

      // Single image without explicit zip request - download directly
      if (indicesToDownload.length === 1 && !downloadAsZip) {
        const index = indicesToDownload[0];
        const item = media[index];
        
        if (!item || !item.url) {
          return;
        }

        const blob = await readMediaBlob(item);
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = getDownloadFileName(item, index);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        return;
      }

      // Multiple images: ALWAYS use Electron backend for zip creation (NO DIALOGS!)
      // Extract file paths for media:// URLs
      const filePaths = [];
      const fileNames = [];
      const fileNameMap = {};
      
      for (const index of indicesToDownload) {
        const item = media[index];
        if (!item || !item.url) {
          continue;
        }

        const url = item.url;
        if (url.startsWith('media://')) {
          let filePath = url.replace('media://', '');
          try {
            filePath = decodeURIComponent(filePath);
          } catch (error) {
            filePath = filePath.replace(/%2F/g, '/').replace(/%20/g, ' ');
          }
          filePath = filePath.replace(/%2F/g, '/');
          
          let fileName = getDownloadFileName(item, index);
          
          // Handle duplicate file names by adding a counter
          if (fileNameMap[fileName]) {
            fileNameMap[fileName] += 1;
            const nameParts = fileName.split('.');
            const ext = nameParts.pop();
            const baseName = nameParts.join('.');
            fileName = `${baseName}_${fileNameMap[fileName]}.${ext}`;
          } else {
            fileNameMap[fileName] = 1;
          }
          
          filePaths.push(filePath);
          fileNames.push(fileName);
        }
      }

      // Use Electron backend to create zip - this is the ONLY method for multiple files
      if (!window.electronAPI || typeof window.electronAPI.createZipFromFiles !== 'function') {
        throw new Error('Electron API är inte tillgänglig för zip-nedladdning. Starta om appen.');
      }

      const result = await window.electronAPI.createZipFromFiles(filePaths, fileNames);
      if (!result || !result.success) {
        throw new Error(result?.error || 'Okänt fel vid skapande av zip-fil');
      }

      console.log('✓ Zip-fil skapad och sparad: ' + result.path);
    } catch (error) {
      console.error('Fel vid nedladdning av bilder:', error);
      alert('Kunde inte ladda ner bilder: ' + error.message);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIndices.size === 0) {
      return;
    }

    const selectedCount = selectedIndices.size;
    if (!window.confirm(`Är du säker på att du vill ta bort ${selectedCount} valda bilder?`)) {
      return;
    }

    const indicesToRemove = new Set(selectedIndices);
    const removedBeforeSelectedImage = selectedImageIndex === null
      ? 0
      : Array.from(indicesToRemove).filter((index) => index < selectedImageIndex).length;
    const selectedImageWasRemoved = selectedImageIndex !== null && indicesToRemove.has(selectedImageIndex);

    const newMedia = media.filter((_, index) => !indicesToRemove.has(index));
    onMediaChange(newMedia);

    if (selectedImageWasRemoved) {
      setSelectedImageIndex(null);
    } else if (selectedImageIndex !== null) {
      setSelectedImageIndex(Math.max(0, selectedImageIndex - removedBeforeSelectedImage));
    }

    clearSelectedIndices();
  };

  // Ta bort bild
  const handleRemoveImage = (index) => {
    if (!window.confirm('Är du säker på att du vill ta bort bilden?')) return;

    const removedItem = media[index];
    const newMedia = media.filter((_, i) => i !== index);
    onMediaChange(newMedia);
    clearSelectedIndices();

    if (selectedImageIndex === index) {
      setSelectedImageIndex(null);
    } else if (selectedImageIndex > index) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }

    if (typeof showUndoToast === 'function' && removedItem) {
      showUndoToast(`"${removedItem.name || 'Bilden'}" togs bort. Ångra?`, () => {
        const restoredMedia = [...newMedia];
        restoredMedia.splice(index, 0, removedItem);
        onMediaChange(restoredMedia);
        if (selectedImageIndex !== null && selectedImageIndex >= index) {
          setSelectedImageIndex(selectedImageIndex + 1);
        }
      });
    }
  };

  // Välj som profilbild (första bilden)
  const handleSetAsProfile = (index) => {
    if (index === 0) return; // Redan profilbild
    const newMedia = [...media];
    const [selected] = newMedia.splice(index, 1);
    const selectedWithoutProfileCrop = {
      ...selected,
      crop: null,
      cropData: null,
      croppedArea: null,
      avatarCrop: null,
      faces: [],
      regions: []
    };
    newMedia.unshift(selectedWithoutProfileCrop);
    onMediaChange(newMedia);
    setSelectedImageIndex(0);
    clearSelectedIndices();
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
      clearSelectedIndices();
      
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

  // Hantera högerklick för context menu
  const handleContextMenu = (e, itemIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      itemIndex
    });
  };

  // Stäng context menu när man klickar utanför
  useEffect(() => {
    if (!contextMenu.open) return;
    
    const handleClickOutside = () => {
      setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
    };
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
      }
    };
    
    // Använd setTimeout för att inte stänga direkt när menyn öppnas
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.open]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setIsMediaManagerOpen(true)}
            className="p-1.5 bg-accent hover:bg-accent text-on-accent rounded transition-colors"
            title="Välj från bibliotek"
            aria-label="Välj från bibliotek"
          >
            <ImageIcon size={14} />
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
        
        {media.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök bilder..."
                className="pl-8 pr-8 py-1.5 bg-background border border-subtle rounded text-sm text-on-accent focus:border-accent focus:outline-none w-48"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted hover:text-primary"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-1.5 bg-surface-2 hover:bg-slate-600 text-on-accent rounded transition-colors"
              title={viewMode === 'grid' ? 'Lista' : 'Grid'}
            >
              <Grid size={16} />
            </button>
            <select
              value={sortBy}
              onChange={(e) => updateMediaSortConfig({ sortBy: e.target.value })}
              className="bg-background border border-subtle rounded text-xs text-primary px-2 py-1.5"
              title="Sortering"
            >
              <option value="custom">Sortering: Anpassad</option>
              <option value="date-desc">Sortering: Datum (nyast)</option>
              <option value="date-asc">Sortering: Datum (äldst)</option>
              <option value="name-asc">Sortering: Namn (A-Ö)</option>
              <option value="name-desc">Sortering: Namn (Ö-A)</option>
            </select>
            <button
              onClick={() => handleDownload(null, true)}
              className="p-1.5 bg-surface-2 hover:bg-slate-600 text-on-accent rounded transition-colors"
              title="Ladda ner alla bilder som zip"
              aria-label="Ladda ner alla"
            >
              <Download size={16} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={dropZoneRef}
        onClick={() => fileInputRef.current?.click()}
        className={`mb-3 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-accent bg-accent-soft text-accent' : 'border-subtle text-muted hover:border-strong'
        }`}
        title="Klistra in / Släpp bild / Ladda upp bild"
      >
        <p className="text-sm font-medium">Klistra in / Släpp bild / Ladda upp bild</p>
      </div>

      {/* Media Grid/List */}
      <div 
        className={`flex-1 overflow-y-auto ${isDragging ? 'ring-2 ring-blue-500 bg-accent-soft' : ''}`}
      >
        {media.length === 0 ? (
          <div 
            className={`h-full border-2 border-dashed rounded-lg flex items-center justify-center text-muted ${
              isDragging ? 'border-accent bg-accent-soft' : 'border-subtle'
            }`}
          >
            <div className="text-center">
              <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Inga bilder ännu</p>
              <p className="text-xs mt-1">Klicka på "Välj från bibliotek" eller använd rutan ovan</p>
              <p className="text-xs mt-1">Dra och släpp eller klistra in (Ctrl+V)</p>
            </div>
          </div>
        ) : sortedFilteredMedia.length === 0 ? (
          <div className="h-full border border-subtle rounded-lg flex items-center justify-center text-muted p-8">
            <div className="text-center">
              <Search size={40} className="mx-auto mb-3 opacity-60" />
              <p className="text-sm">Inga bilder matchar din sökning</p>
              <p className="text-xs mt-1">Rensa sökningen för att visa alla bilder igen</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div 
            className="grid gap-3 p-4"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(60, 180 * imageSizeMultiplier)}px, 1fr))`
            }}
          >
            {sortedFilteredMedia.map((item, idx) => {
              const originalIndex = media.findIndex(m => m.id === item.id);
              const isProfile = entityType === 'person' && originalIndex === 0;
              const isSelected = selectedIndices.has(originalIndex);
              const latestItem = Array.isArray(allMediaItems)
                ? allMediaItems.find((entry) => String(entry?.id) === String(item?.id)) || item
                : item;
              
              return (
                <div
                  key={item.id || idx}
                  draggable={sortBy === 'custom'}
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                  onContextMenu={(e) => handleContextMenu(e, originalIndex)}
                  className={`group relative rounded-lg border-2 overflow-hidden transition-all ${
                    dragOverIndex === originalIndex 
                      ? 'border-accent ring-2 ring-blue-500/50 scale-105' 
                      : isSelected || selectedImageIndex === originalIndex
                      ? 'border-accent ring-2 ring-blue-500/50'
                      : 'border-subtle hover:border-subtle'
                  } ${draggedIndex === originalIndex ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-col">
                    <div 
                      className="aspect-square bg-surface relative cursor-pointer"
                      onClick={() => {
                        setSelectedImageIndex(originalIndex);
                        setIsImageViewerOpen(true);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageIndex(originalIndex);
                        setIsImageViewerOpen(true);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, originalIndex)}
                    >
                      <MediaImage 
                        url={item.url} 
                        alt={item.name || 'Bild'} 
                        className="w-full h-full object-cover"
                      />
                      {isProfile && (
                        <div className="absolute top-2 left-2 bg-yellow-500 text-yellow-900 rounded-full p-1">
                          <Star size={14} fill="currentColor" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 z-20">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelectedIndex(originalIndex)}
                          className="h-5 w-5 cursor-pointer rounded border-strong bg-background accent-blue-500 shadow-lg shadow-slate-950/40"
                          aria-label={`Markera ${item.name || 'bild'}`}
                        />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-on-accent text-xs font-medium truncate">{item.name || 'Namnlös'}</p>
                        {item.date && (
                          <p className="text-on-accent/70 text-[10px]">{item.date}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Förhandsvisning av noteringar under bilden (grid-vy) */}
                    {item.note && (
                      <div 
                        className="mt-2 p-2 bg-background border border-subtle rounded cursor-pointer hover:border-subtle transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteIndex(originalIndex);
                        }}
                      >
                        <div className="text-xs text-secondary line-clamp-2" dangerouslySetInnerHTML={{ __html: item.note }} />
                        <p className="text-[10px] text-muted mt-1">Klicka för att redigera</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedFilteredMedia.map((item, idx) => {
              const originalIndex = media.findIndex(m => m.id === item.id);
              const isProfile = entityType === 'person' && originalIndex === 0;
              const isSelected = selectedIndices.has(originalIndex);
              const latestItem = Array.isArray(allMediaItems)
                ? allMediaItems.find((entry) => String(entry?.id) === String(item?.id)) || item
                : item;
              
              return (
                <div
                  key={item.id || idx}
                  draggable={sortBy === 'custom'}
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                  onContextMenu={(e) => handleContextMenu(e, originalIndex)}
                  className={`group relative flex items-start gap-4 p-3 pr-12 rounded-lg border-2 transition-all ${
                    dragOverIndex === originalIndex 
                      ? 'border-accent ring-2 ring-blue-500/50' 
                      : isSelected || selectedImageIndex === originalIndex
                      ? 'border-accent bg-accent-soft'
                      : 'border-subtle hover:border-subtle hover:bg-surface'
                  } ${draggedIndex === originalIndex ? 'opacity-50' : ''}`}
                >
                  <div 
                    className="bg-surface rounded overflow-hidden flex-shrink-0 relative cursor-pointer"
                    style={{
                      width: `${Math.max(44, Math.round(96 * imageSizeMultiplier))}px`,
                      height: `${Math.max(44, Math.round(96 * imageSizeMultiplier))}px`
                    }}
                    onClick={() => {
                      setSelectedImageIndex(originalIndex);
                      setIsImageViewerOpen(true);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageIndex(originalIndex);
                      setIsImageViewerOpen(true);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, originalIndex)}
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
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <p className="text-on-accent text-[11px] font-medium truncate">{item.name || 'Namnlös'}</p>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 z-20">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelectedIndex(originalIndex)}
                      className="h-5 w-5 cursor-pointer rounded border-strong bg-background accent-blue-500 shadow-lg shadow-slate-950/40"
                      aria-label={`Markera ${item.name || 'bild'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p 
                        className="text-sm font-medium text-primary truncate cursor-pointer hover:text-accent"
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
                      <p className="text-xs text-muted">{item.date}</p>
                    )}
                    <p
                      className="text-xs text-muted mt-1 truncate"
                      title={Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : 'Inga nyckelord'}
                    >
                      Nyckelord: {Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : 'Inga nyckelord'}
                    </p>
                    <p
                      className="text-xs text-muted mt-1 truncate"
                      title={item.description || 'Ingen beskrivning'}
                    >
                      Beskrivning: {item.description || 'Ingen beskrivning'}
                    </p>
                    <p
                      className="text-xs text-muted mt-1 truncate"
                      title={stripHtmlTags(item.note) || 'Inga notiser'}
                    >
                      Notis: {stripHtmlTags(item.note) || 'Inga notiser'}
                    </p>
                    
                    {/* Förhandsvisning av noteringar till höger om bilden (list-vy) */}
                    {item.note && (
                      <div 
                        className="mt-3 p-2 bg-background border border-subtle rounded cursor-pointer hover:border-subtle transition-colors"
                        title={stripHtmlTags(item.note)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNoteIndex(originalIndex);
                        }}
                      >
                        <div className="text-xs text-secondary line-clamp-3" dangerouslySetInnerHTML={{ __html: item.note }} />
                        <p className="text-[10px] text-muted mt-1">Klicka för att redigera</p>
                      </div>
                    )}
                  </div>
                  <div 
                    className="flex items-center gap-1 flex-shrink-0"
                    onContextMenu={(e) => handleContextMenu(e, originalIndex)}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageViewerOpen(true);
                        setSelectedImageIndex(originalIndex);
                      }}
                      className="p-2 bg-surface-2 rounded hover:bg-slate-600 text-on-accent opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Visa"
                    >
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedIndices.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-[9999] w-[min(92vw,720px)] -translate-x-1/2 rounded-2xl border border-subtle bg-background px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-primary">
              <span className="font-semibold">{selectedIndices.size}</span> valda bilder
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20"
              >
                <Trash2 size={16} />
                Radera
              </button>
              <button
                type="button"
                onClick={() => handleDownload(Array.from(selectedIndices))}
                className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent/20"
              >
                <Download size={16} />
                Ladda ner
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div className="h-full w-full bg-background">
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
          <div className="h-full flex flex-col bg-surface">
            <div className="flex flex-1 overflow-hidden">
              {/* Vänster sidebar: Bibliotek */}
              <div className="w-64 bg-surface border-r border-subtle flex flex-col shrink-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  <div className="space-y-1">
                    <p className="px-3 py-1 text-[10px] font-bold text-muted uppercase">Bibliotek</p>
                    {SYSTEM_LIBRARIES.map(lib => {
                      const Icon = lib.icon;
                      return (
                        <button
                          key={lib.id}
                          onClick={() => setActiveLibrary(lib.id)}
                          className={`flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors ${
                            activeLibrary === lib.id
                              ? 'bg-accent text-on-accent'
                              : 'text-muted hover:bg-surface hover:text-primary'
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
                        <div className="px-3 py-1 text-[10px] font-bold text-muted uppercase mt-2">Egna mappar</div>
                        {customLibraries.map(lib => {
                          const Icon = lib.icon || Folder;
                          return (
                            <button
                              key={lib.id}
                              onClick={() => setActiveLibrary(lib.id)}
                              className={`flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors ${
                                activeLibrary === lib.id
                                  ? 'bg-accent text-on-accent'
                                  : 'text-muted hover:bg-surface hover:text-primary'
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
                    <div className="border-t border-subtle mt-2 pt-2">
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
                            className="w-full px-2 py-1 bg-surface-2 text-on-accent text-sm rounded border border-subtle focus:outline-none focus:border-accent"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsCreatingLibrary(true)}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded text-sm text-muted hover:bg-surface hover:text-primary transition-colors"
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
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Sök bilder..."
                      className="w-full pl-10 pr-4 py-2 bg-surface-2 text-on-accent rounded border border-subtle focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="p-2 bg-surface-2 hover:bg-slate-600 rounded text-on-accent"
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
                      <div className="text-center py-12 text-muted">
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
                                    : 'border-subtle hover:border-accent'
                                }`
                              : `flex items-center gap-4 p-2 rounded border cursor-pointer ${
                                  isSelected 
                                    ? 'bg-green-500/20 border-green-500' 
                                    : 'bg-surface-2 border-subtle hover:bg-surface'
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
                                    <div className="bg-green-500 text-on-accent rounded-full p-2">
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
                                      className="p-1.5 bg-surface hover:bg-surface-2 rounded text-on-accent"
                                      title="Flytta till annan mapp"
                                    >
                                      <MoveRight size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <p className="text-on-accent text-xs truncate">{item.name}</p>
                                  {item.date && (
                                    <p className="text-on-accent/70 text-[10px]">{item.date}</p>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-16 h-16 bg-background rounded overflow-hidden shrink-0 border border-subtle">
                                  <MediaImage url={item.url} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-primary font-medium truncate">{item.name}</p>
                                  {item.date && <p className="text-xs text-muted">{item.date}</p>}
                                  {item.description && (
                                    <p className="text-xs text-muted truncate mt-1">{item.description}</p>
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
          <div className="p-4 bg-surface">
            <p className="text-primary mb-4">Välj mapp att flytta bilden till:</p>
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
                    className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-secondary hover:bg-surface-2 transition-colors"
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
          <div className="p-4 bg-surface">
            <p className="text-primary mb-4">Välj mapp att flytta bilden till:</p>
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
                    className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-secondary hover:bg-surface-2 transition-colors"
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
          imageMeta={media[selectedImageIndex]}
          regions={media[selectedImageIndex].regions || []}
          onSaveRegions={(newRegions) => {
            const updatedMedia = [...media];
            updatedMedia[selectedImageIndex] = {
              ...updatedMedia[selectedImageIndex],
              regions: newRegions,
              faces: newRegions
            };
            onMediaChange(updatedMedia);

            if (typeof onUpdateAllMedia === 'function') {
              const selectedItemId = updatedMedia[selectedImageIndex]?.id;
              const nextAllMedia = (allMediaItems || []).map((item) =>
                String(item?.id) === String(selectedItemId)
                  ? { ...item, regions: newRegions, faces: newRegions }
                  : item
              );
              onUpdateAllMedia(nextAllMedia);
            }
          }}
          onSaveImageMeta={(metaPatch) => {
            if (!metaPatch) return;

            const updatedMedia = [...media];
            const current = updatedMedia[selectedImageIndex];
            if (!current) return;

            updatedMedia[selectedImageIndex] = {
              ...current,
              name: metaPatch.name ?? current.name,
              description: metaPatch.description ?? current.description,
              note: metaPatch.note ?? current.note,
              tags: metaPatch.tags ?? current.tags,
              photographer: metaPatch.photographer ?? current.photographer,
              creator: metaPatch.creator ?? current.creator
            };

            onMediaChange(updatedMedia);

            if (typeof onUpdateAllMedia === 'function') {
              const selectedItemId = updatedMedia[selectedImageIndex]?.id;
              const nextAllMedia = (allMediaItems || []).map((item) =>
                String(item?.id) === String(selectedItemId)
                  ? {
                      ...item,
                      name: metaPatch.name ?? item.name,
                      description: metaPatch.description ?? item.description,
                      note: metaPatch.note ?? item.note,
                      tags: metaPatch.tags ?? item.tags,
                      photographer: metaPatch.photographer ?? item.photographer,
                      creator: metaPatch.creator ?? item.creator
                    }
                  : item
              );
              onUpdateAllMedia(nextAllMedia);
            }
          }}
          people={allPeople}
          onOpenEditModal={onOpenEditModal}
          connections={media[selectedImageIndex].connections || {}}
          onSaveEditedImage={({ mode, url, name, filePath }) => {
            if (!url && mode !== 'overwrite') return;

            if (mode === 'overwrite') {
              const updatedMedia = [...media];
              updatedMedia[selectedImageIndex] = {
                ...updatedMedia[selectedImageIndex],
                ...(url ? { url } : {}),
                ...(name ? { name } : {}),
                ...(filePath ? { filePath } : {})
              };
              onMediaChange(updatedMedia);

              if (typeof onUpdateAllMedia === 'function') {
                const selectedItemId = updatedMedia[selectedImageIndex]?.id;
                const nextAllMedia = (allMediaItems || []).map((item) =>
                  String(item?.id) === String(selectedItemId)
                    ? {
                        ...item,
                        ...(url ? { url } : {}),
                        ...(name ? { name } : {}),
                        ...(filePath ? { filePath } : {})
                      }
                    : item
                );
                onUpdateAllMedia(nextAllMedia);
              }
              return;
            }

            const copiedItem = {
              ...media[selectedImageIndex],
              id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              url: url || media[selectedImageIndex].url,
              name: name || `${media[selectedImageIndex].name || 'bild'}_redigerad`,
              filePath: filePath || media[selectedImageIndex].filePath,
              date: new Date().toISOString().split('T')[0]
            };

            const updatedMedia = [...media, copiedItem];
            onMediaChange(updatedMedia);

            if (typeof onUpdateAllMedia === 'function') {
              onUpdateAllMedia([...(allMediaItems || []), copiedItem]);
            }
          }}
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

            if (typeof onUpdateAllMedia === 'function') {
              const updatedItemId = updatedMedia[editingNoteIndex]?.id;
              const nextAllMedia = (allMediaItems || []).map((item) =>
                String(item?.id) === String(updatedItemId)
                  ? { ...item, note: noteContent }
                  : item
              );
              onUpdateAllMedia(nextAllMedia);
            }
          }}
          onClose={() => setEditingNoteIndex(null)}
        />
      )}

      {/* Context Menu */}
      {contextMenu.open && contextMenu.itemIndex !== null && (
        <div
          className="fixed z-[10000] bg-background border border-strong rounded-lg shadow-2xl py-1 min-w-[180px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsImageViewerOpen(true);
              setSelectedImageIndex(contextMenu.itemIndex);
              setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
            }}
            className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
          >
            <Eye size={16} />
            <span>Öppna</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImageIndex(contextMenu.itemIndex);
              setIsImageViewerOpen(true);
              setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
            }}
            className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
          >
            <Edit2 size={16} />
            <span>Redigera</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingNoteIndex(contextMenu.itemIndex);
              setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
            }}
            className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
          >
            <Edit2 size={16} />
            <span>Notiser</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowConnectionsIndex(showConnectionsIndex === contextMenu.itemIndex ? null : contextMenu.itemIndex);
              setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
            }}
            className={`w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2 ${
              showConnectionsIndex === contextMenu.itemIndex ? 'bg-accent-soft' : ''
            }`}
          >
            <LinkIcon size={16} />
            <span>Kopplingar</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload([contextMenu.itemIndex], false);
              setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
            }}
            className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
          >
            <Download size={16} />
            <span>Ladda ner</span>
          </button>
          {entityType === 'person' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (contextMenu.itemIndex === 0) {
                  setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
                  return;
                }
                handleSetAsProfile(contextMenu.itemIndex);
                setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
              }}
              className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                contextMenu.itemIndex === 0
                  ? 'text-muted cursor-not-allowed'
                  : 'text-primary hover:bg-surface'
              }`}
              disabled={contextMenu.itemIndex === 0}
            >
              <Star size={16} />
              <span>Gör till profilbild</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveImage(contextMenu.itemIndex);
              setContextMenu({ open: false, x: 0, y: 0, itemIndex: null });
            }}
            className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2"
          >
            <Trash2 size={16} />
            <span>Ta bort</span>
          </button>
        </div>
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
          <div className="h-full flex flex-col bg-surface p-4">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-on-accent mb-2">{media[showConnectionsIndex].name || 'Bild'}</h3>
              <p className="text-sm text-muted">Personer, källor och platser kopplade till denna bild</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Personer kopplade via regions (ansiktstagging) */}
              {media[showConnectionsIndex].regions && media[showConnectionsIndex].regions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
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
                          className="p-2 bg-surface-2 rounded hover:bg-slate-600 cursor-pointer transition-colors"
                          onClick={() => {
                            onOpenEditModal(person.id);
                            setShowConnectionsIndex(null);
                          }}
                        >
                          <p className="text-sm text-on-accent font-medium">
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
                  <h4 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
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
                          className="p-2 bg-surface-2 rounded hover:bg-slate-600 cursor-pointer transition-colors"
                          onClick={() => {
                            onOpenEditModal(person.id);
                            setShowConnectionsIndex(null);
                          }}
                        >
                          <p className="text-sm text-on-accent font-medium">
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
                  <h4 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
                    <FileText size={16} />
                    Källor
                  </h4>
                  <div className="space-y-2">
                    {media[showConnectionsIndex].connections.sources.map((source, idx) => (
                      <div key={idx} className="p-2 bg-surface-2 rounded">
                        <p className="text-sm text-on-accent font-medium">{source.name || source.id}</p>
                        {source.ref && <p className="text-xs text-muted mt-1">Ref: {source.ref}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Platser */}
              {media[showConnectionsIndex].connections?.places && media[showConnectionsIndex].connections.places.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
                    <MapPin size={16} />
                    Platser
                  </h4>
                  <div className="space-y-2">
                    {media[showConnectionsIndex].connections.places.map((place, idx) => (
                      <div key={idx} className="p-2 bg-surface-2 rounded">
                        <p className="text-sm text-on-accent font-medium">{place.name || place.id}</p>
                        {place.type && <p className="text-xs text-muted mt-1">Typ: {place.type}</p>}
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
                <div className="text-center py-8 text-muted">
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
      <div className="h-full flex flex-col bg-surface p-4">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-on-accent mb-2">{imageName}</h3>
          <p className="text-sm text-muted">Lägg till notiser om denna bild</p>
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
            className="px-4 py-2 bg-surface-2 hover:bg-slate-600 text-on-accent rounded"
          >
            Stäng
          </button>
        </div>
      </div>
      </WindowFrame>
    );
  }

