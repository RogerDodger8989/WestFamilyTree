import React, { useState, useEffect } from 'react';
import WindowFrame from './WindowFrame.jsx';
import { Trash, RotateCcw, X, AlertCircle, Calendar } from 'lucide-react';

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
        // Försök hitta originalPath från trashFile (kan vara i originalPath eller extraheras från name)
        let originalPath = trashFile.originalPath;
        if (!originalPath && trashFile.name) {
          // Om originalPath inte finns, använd originalName för att gissa sökvägen
          // Filen kan ha varit i persons/, sources/, places/, eller root
          originalPath = trashFile.originalName; // Fallback till filnamn
        }
        
        const result = await window.electronAPI.restoreFileFromTrash(
          trashFile.name,
          originalPath || null
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
                  {filesToBeDeleted.map((file) => (
                    <div
                      key={file.name}
                      className="bg-red-900/20 border border-red-800/50 rounded p-3 mb-2 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{file.originalName}</div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(file.deletedAt)}
                          </span>
                          <span>{formatSize(file.size)}</span>
                          <span className="text-red-400">{file.daysOld} dagar gammal</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
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
                  ))}
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
                  {filesSafe.map((file) => (
                    <div
                      key={file.name}
                      className="bg-slate-800/50 border border-slate-700 rounded p-3 mb-2 flex items-center justify-between hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{file.originalName}</div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(file.deletedAt)}
                          </span>
                          <span>{formatSize(file.size)}</span>
                          <span className="text-slate-500">{file.daysOld} dagar gammal</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
}

