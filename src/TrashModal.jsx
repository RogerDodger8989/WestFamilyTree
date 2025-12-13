import React, { useState, useEffect } from 'react';
import WindowFrame from './WindowFrame.jsx';
import { Trash, RotateCcw, X, AlertCircle, Calendar, FileText, FolderOpen } from 'lucide-react';

export default function TrashModal({ isOpen, onClose, onRestore, onEmptyTrash }) {
  const [trashFiles, setTrashFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTrashFiles();
    }
  }, [isOpen]);

  const loadTrashFiles = async () => {
    if (window.electronAPI && window.electronAPI.getTrashFiles) {
      setLoading(true);
      try {
        const result = await window.electronAPI.getTrashFiles();
        if (result && result.success) {
          setTrashFiles(result.files || []);
        }
      } catch (error) {
        console.error('[TrashModal] Error loading trash files:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleRestore = async (trashFile) => {
    if (window.electronAPI && window.electronAPI.restoreFileFromTrash) {
      try {
        // Använd originalPath från trashFile om den finns (den extraheras korrekt i get-trash-files)
        const originalPath = trashFile.originalPath || null;
        
        const result = await window.electronAPI.restoreFileFromTrash(
          trashFile.name,
          originalPath
        );
        if (result && result.success) {
          await loadTrashFiles(); // Uppdatera papperskorg-listan
          if (onRestore) {
            // Skicka både filePath och originalName för att MediaManager ska kunna skapa rätt objekt
            onRestore(result.filePath, trashFile.originalName);
          }
        }
      } catch (error) {
        console.error('[TrashModal] Error restoring file:', error);
        alert(`Fel vid återställning: ${error.message}`);
      }
    }
  };

  const handlePermanentDelete = async (trashFile) => {
    if (!confirm(`Är du säker på att du vill permanent radera "${trashFile.originalName}"?`)) {
      return;
    }

    if (window.electronAPI && window.electronAPI.permanentlyDeleteFromTrash) {
      try {
        const result = await window.electronAPI.permanentlyDeleteFromTrash(trashFile.name);
        if (result && result.success) {
          await loadTrashFiles(); // Uppdatera listan
        }
      } catch (error) {
        console.error('[TrashModal] Error deleting file:', error);
        alert(`Fel vid radering: ${error.message}`);
      }
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Är du säker på att du vill tömma papperskorgen? Alla filer äldre än 30 dagar kommer att raderas permanent.')) {
      return;
    }

    if (window.electronAPI && window.electronAPI.emptyTrash) {
      try {
        const result = await window.electronAPI.emptyTrash(30);
        if (result && result.success) {
          await loadTrashFiles(); // Uppdatera listan
          if (onEmptyTrash) onEmptyTrash(result.deletedCount);
        }
      } catch (error) {
        console.error('[TrashModal] Error emptying trash:', error);
        alert(`Fel vid tömning: ${error.message}`);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleOpenInExplorer = (file) => {
    // Öppna mappen där filen ligger i papperskorgen
    // file.path är relativ från media-mappen, t.ex. ".trash/timestamp_filename.jpg"
    if (window.electronAPI && window.electronAPI.openFolder) {
      // Extrahera mapp-sökvägen (ta bort filnamnet)
      const pathParts = file.path.split('/');
      const folderPath = pathParts.slice(0, -1).join('/'); // ".trash"
      
      // Konstruera sökväg till media-mappen + papperskorg
      // openFolder hanterar relativ sökväg från app-root
      const fullPath = `media/${folderPath}`;
      
      // Använd openFolder för att öppna mappen
      window.electronAPI.openFolder(fullPath);
    }
  };

  if (!isOpen) return null;

  const filesToBeDeleted = trashFiles.filter(f => f.willBeDeleted);
  const filesSafe = trashFiles.filter(f => !f.willBeDeleted);

  return (
    <WindowFrame
      title="Papperskorg"
      onClose={onClose}
      initialWidth={800}
      initialHeight={600}
      minWidth={600}
      minHeight={400}
    >
      <div className="flex flex-col h-full bg-slate-900 text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash size={20} className="text-slate-400" />
            <h2 className="text-lg font-semibold">Papperskorg</h2>
            <span className="text-sm text-slate-500">
              ({trashFiles.length} filer)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {filesToBeDeleted.length > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 bg-red-900/30 border border-red-700/50 text-red-300 text-xs rounded hover:bg-red-900/50 hover:border-red-600 transition-colors flex items-center gap-1"
              >
                <X size={14} /> Töm papperskorg ({filesToBeDeleted.length})
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Laddar...</div>
          ) : trashFiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Trash size={48} className="mx-auto mb-4 opacity-50" />
              <p>Papperskorgen är tom</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Filer som kommer att raderas */}
              {filesToBeDeleted.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2 text-sm text-red-400">
                    <AlertCircle size={16} />
                    <span className="font-semibold">
                      Kommer att raderas automatiskt ({filesToBeDeleted.length})
                    </span>
                  </div>
                  {filesToBeDeleted.map((file) => {
                    const isImage = /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i.test(file.originalName);
                    // Använd den faktiska sökvägen till trash-filen
                    const imageUrl = isImage ? `media://${encodeURIComponent(file.path)}` : null;
                    
                    return (
                      <div
                        key={file.name}
                        className="bg-red-900/20 border border-red-800/50 rounded p-3 mb-2 flex items-center gap-3"
                      >
                        {isImage && imageUrl ? (
                          <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-slate-800 border border-slate-700">
                            <img
                              src={imageUrl}
                              alt={file.originalName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-500 text-xs">Ingen bild</div>';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 shrink-0 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <FileText size={24} className="text-slate-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{file.originalName}</div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {formatDate(file.deletedAt)}
                              </span>
                              <span>{formatSize(file.size)}</span>
                              <span className="text-red-400">{file.daysOld} dagar gammal</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInExplorer(file);
                              }}
                              className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-colors group"
                              title="Öppna i Explorer"
                            >
                              <FolderOpen size={12} className="group-hover:text-blue-400" />
                              <span className="truncate max-w-md">media/{file.path}</span>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <button
                            onClick={() => handleRestore(file)}
                            className="px-2 py-1 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs rounded hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                            title="Återställ"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(file)}
                            className="px-2 py-1 bg-red-900/30 border border-red-700/50 text-red-300 text-xs rounded hover:bg-red-900/50 transition-colors flex items-center gap-1"
                            title="Radera permanent"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Filer som är säkra */}
              {filesSafe.length > 0 && (
                <div>
                  {filesToBeDeleted.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
                      <span className="font-semibold">
                        Säker ({filesSafe.length})
                      </span>
                    </div>
                  )}
                  {filesSafe.map((file) => {
                    const isImage = /\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i.test(file.originalName);
                    // Använd den faktiska sökvägen till trash-filen
                    const imageUrl = isImage ? `media://${encodeURIComponent(file.path)}` : null;
                    
                    return (
                      <div
                        key={file.name}
                        className="bg-slate-800/50 border border-slate-700 rounded p-3 mb-2 flex items-center gap-3 hover:bg-slate-800 transition-colors"
                      >
                        {isImage && imageUrl ? (
                          <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-slate-800 border border-slate-700">
                            <img
                              src={imageUrl}
                              alt={file.originalName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-slate-500 text-xs">Ingen bild</div>';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 shrink-0 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <FileText size={24} className="text-slate-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{file.originalName}</div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar size={12} />
                                {formatDate(file.deletedAt)}
                              </span>
                              <span>{formatSize(file.size)}</span>
                              <span className="text-slate-500">{file.daysOld} dagar gammal</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInExplorer(file);
                              }}
                              className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-colors group text-left"
                              title="Öppna i Explorer"
                            >
                              <FolderOpen size={12} className="group-hover:text-blue-400 shrink-0" />
                              <span className="truncate max-w-md">media/{file.path}</span>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4 shrink-0">
                          <button
                            onClick={() => handleRestore(file)}
                            className="px-2 py-1 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs rounded hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                            title="Återställ"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(file)}
                            className="px-2 py-1 bg-red-900/30 border border-red-700/50 text-red-300 text-xs rounded hover:bg-red-900/50 transition-colors flex items-center gap-1"
                            title="Radera permanent"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
}

