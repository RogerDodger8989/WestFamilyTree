import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, Plus, Trash2, Star, MoreHorizontal,
  Search, X, Grid, Eye, UploadCloud, Check
} from 'lucide-react';
import ImageViewer from './ImageViewer.jsx';
import WindowFrame from './WindowFrame.jsx';

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
 */
export default function MediaSelector({
  media = [],
  onMediaChange,
  entityType = 'person',
  entityId = null,
  allPeople = [],
  onOpenEditModal = () => {},
  allMediaItems = [],
  onUpdateAllMedia = () => {}
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' eller 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

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
  const handleFileSelect = async (files) => {
    const newImages = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        const newImage = {
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          url,
          name: file.name,
          file: file, // Behåll filen för senare uppladdning
          date: new Date().toISOString().split('T')[0],
          description: '',
          tags: []
        };
        newImages.push(newImage);
      }
    }
    if (newImages.length > 0) {
      onMediaChange([...media, ...newImages]);
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
        handleFileSelect(e.clipboardData.files);
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                  className={`group relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                    dragOverIndex === originalIndex 
                      ? 'border-blue-500 ring-2 ring-blue-500/50 scale-105' 
                      : selectedImageIndex === originalIndex
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-slate-700 hover:border-slate-600'
                  } ${draggedIndex === originalIndex ? 'opacity-50' : ''}`}
                  onClick={() => {
                    setSelectedImageIndex(originalIndex);
                    setIsImageViewerOpen(true);
                  }}
                >
                  <div className="aspect-square bg-slate-800 relative">
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
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsImageViewerOpen(true);
                          setSelectedImageIndex(originalIndex);
                        }}
                        className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white"
                        title="Visa"
                      >
                        <Eye size={16} />
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
                          <Star size={16} />
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
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs font-medium truncate">{item.name || 'Namnlös'}</p>
                      {item.date && (
                        <p className="text-white/70 text-[10px]">{item.date}</p>
                      )}
                    </div>
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
                  className={`group flex items-center gap-4 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    dragOverIndex === originalIndex 
                      ? 'border-blue-500 ring-2 ring-blue-500/50' 
                      : selectedImageIndex === originalIndex
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                  } ${draggedIndex === originalIndex ? 'opacity-50' : ''}`}
                  onClick={() => {
                    setSelectedImageIndex(originalIndex);
                    setIsImageViewerOpen(true);
                  }}
                >
                  <div className="w-16 h-16 bg-slate-800 rounded overflow-hidden flex-shrink-0 relative">
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-200 truncate">{item.name || 'Namnlös'}</p>
                      {isProfile && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Profilbild</span>
                      )}
                    </div>
                    {item.date && (
                      <p className="text-xs text-slate-400 mt-1">{item.date}</p>
                    )}
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{item.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsImageViewerOpen(true);
                        setSelectedImageIndex(originalIndex);
                      }}
                      className="p-2 bg-slate-700 rounded hover:bg-slate-600 text-white"
                      title="Visa"
                    >
                      <Eye size={16} />
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
                        <Star size={16} />
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
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MediaManagerModal - Använder WindowFrame */}
      {isMediaManagerOpen && (
        <WindowFrame
          title="Välj bilder från bibliotek"
          icon={ImageIcon}
          onClose={() => setIsMediaManagerOpen(false)}
          initialWidth={1000}
          initialHeight={700}
          zIndex={5000}
        >
          <div className="h-full flex flex-col bg-slate-800">
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {allMediaItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Inga bilder i biblioteket ännu</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {allMediaItems.map((item) => {
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
                              regions: item.faces || []
                            };
                            onMediaChange([...media, newItem]);
                          }
                        }}
                        className={`relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all group ${
                          isSelected 
                            ? 'border-green-500 ring-2 ring-green-500/50' 
                            : 'border-slate-700 hover:border-blue-500'
                        }`}
                      >
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
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs truncate">{item.name}</p>
                          {item.date && (
                            <p className="text-white/70 text-[10px]">{item.date}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
        />
      )}
    </div>
  );
}

