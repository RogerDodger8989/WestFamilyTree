import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ImageViewer from './ImageViewer.jsx';
import LinkPersonModal from './LinkPersonModal.jsx';
import TrashModal from './TrashModal.jsx';
import WindowFrame from './WindowFrame.jsx';
import { useApp } from './AppContext.jsx';
import { createWorker } from 'tesseract.js';
import { env } from '@xenova/transformers';
import Editor from './MaybeEditor.jsx';

// Konfigurera transformers för Electron
// @xenova/transformers behöver ladda modeller från Hugging Face
env.allowLocalModels = true; // Tillåt lokala modeller
env.useBrowserCache = true;
env.useCustomCache = true;
// Använd Hugging Face CDN direkt
env.remoteURL = 'https://huggingface.co/';
env.remotePath = '';

// Custom fetch för Electron (använd IPC för att ladda ner filer)
if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.downloadTrocrModel) {
  // @xenova/transformers använder fetch() internt, men vi kan inte override det direkt
  // Istället laddar vi ner modellerna först via IPC, sedan använder transformers dem från cache
}
import { 
  Search, Image as ImageIcon, Grid, List, Tag, User, 
  MapPin, Calendar, Plus, Trash2, AlertCircle, UploadCloud, 
  RotateCw, ScanFace, ZoomIn, ZoomOut,
  FolderPlus, Folder, CheckSquare, Square, MoveRight,
  Check, Edit2, FileWarning, PenTool, Link,
  X, Layers, FileText, MoreVertical, Save, Camera,
  Download, Upload, RefreshCw, Database, Info, Trash, FolderOpen,
  ArrowUpDown, Filter, SlidersHorizontal
} from 'lucide-react';
import Button from './Button.jsx';
import MediaImage from './components/MediaImage.jsx';
import { getAvatarImageStyle } from './imageUtils.js';

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
      <div className="bg-surface border border-subtle rounded-lg shadow-xl w-80 overflow-hidden">
        <div className="p-3 border-b border-subtle bg-background font-bold text-on-accent flex justify-between items-center">
            <span>Flytta till...</span>
            <button onClick={onClose}><X size={16} className="text-muted hover:text-primary"/></button>
        </div>
        <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar">
          {libraries.filter(l => l.id !== 'all').map(lib => (
            <button
              key={lib.id}
              onClick={() => onMove(lib.id)}
              className="w-full text-left px-3 py-2 hover:bg-surface-2 rounded flex items-center gap-2 text-secondary group transition-colors"
            >
              <lib.icon size={16} className="text-muted group-hover:text-accent"/> 
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
    const [description, setDescription] = useState('');
    const [transcription, setTranscription] = useState('');

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface border border-subtle rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-subtle bg-background font-bold text-on-accent flex justify-between items-center shrink-0">
                    <span>Redigera {count} objekt</span>
                    <button onClick={onClose}><X size={18} className="text-muted hover:text-primary"/></button>
                </div>
                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Sätt gemensamt datum</label>
                        <input 
                            type="text" 
                            placeholder="ÅÅÅÅ-MM-DD" 
                            className="w-full bg-background border border-subtle rounded p-2 text-on-accent text-sm focus:outline-none focus:border-accent"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                        <p className="text-[10px] text-muted mt-1">Lämna tomt för att behålla befintliga datum.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Lägg till taggar</label>
                        <input 
                            type="text" 
                            placeholder="T.ex. Sommar, Semester" 
                            className="w-full bg-background border border-subtle rounded p-2 text-on-accent text-sm focus:outline-none focus:border-accent"
                            value={tagsToAdd}
                            onChange={(e) => setTagsToAdd(e.target.value)}
                        />
                        <p className="text-[10px] text-muted mt-1">Separera med kommatecken. Dessa läggs till på befintliga.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Sätt gemensam bildtext / beskrivning</label>
                        <div className="bg-background border border-subtle rounded p-2 min-h-[100px]">
                            <Editor
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Skriv en beskrivning som ska gälla för alla valda bilder..."
                            />
                </div>
                        <p className="text-[10px] text-muted mt-1">Lämna tomt för att behålla befintliga beskrivningar.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-muted uppercase mb-1">Sätt gemensam transkribering</label>
                        <div className="bg-background border border-subtle rounded p-2 min-h-[150px]">
                            <Editor
                                value={transcription}
                                onChange={(e) => setTranscription(e.target.value)}
                                placeholder="Skriv en transkribering som ska gälla för alla valda bilder..."
                            />
                        </div>
                        <p className="text-[10px] text-muted mt-1">Lämna tomt för att behålla befintliga transkriberingar.</p>
                    </div>
                </div>
                <div className="p-3 border-t border-subtle bg-background flex justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="text-sm text-muted hover:text-primary px-3 py-1.5">Avbryt</button>
                    <button 
                        onClick={() => onSave({ 
                            date: date || undefined, 
                            tags: tagsToAdd || undefined,
                            description: description || undefined,
                            transcription: transcription || undefined
                        })}
                        className="bg-accent hover:bg-accent text-on-accent px-4 py-1.5 rounded text-sm font-medium"
                    >
                        Uppdatera
                    </button>
                </div>
            </div>
        </div>
    );
};

const OcrResultModal = ({ isOpen, image, ocrResult, setOcrResult, onClose, onSave }) => {
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const panStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef(null);

  // Ladda bilden när modalen öppnas
  useEffect(() => {
    if (!isOpen || !image) return;

    let currentBlobUrl = null;

    const loadImage = async () => {
      setLoading(true);
      try {
        const imageUrl = image.url;
        console.log('[OcrResultModal] Loading image:', { imageUrl, filePath: image.filePath });
        
        if (imageUrl && imageUrl.startsWith('media://')) {
          if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
            // Extrahera filvägen från media:// URL
            let filePath = imageUrl.replace('media://', '');
            // Decode URL encoding
            filePath = decodeURIComponent(filePath);
            // Ersätt %2F med / om det behövs
            filePath = filePath.replace(/%2F/g, '/');
            
            console.log('[OcrResultModal] Reading file:', filePath);
            
            const fileData = await window.electronAPI.readFile(filePath);
            console.log('[OcrResultModal] File data received:', { 
              hasData: !!fileData, 
              hasError: !!fileData?.error,
              dataType: fileData?.data ? typeof fileData.data : 'no data',
              isArray: fileData?.data ? Array.isArray(fileData.data) : false
            });
            
            if (fileData && !fileData.error) {
              // readFile returnerar data på olika sätt - hantera alla fall
              let uint8Array;
              
              // Om fileData är direkt en ArrayBuffer eller Uint8Array
              if (fileData instanceof ArrayBuffer) {
                uint8Array = new Uint8Array(fileData);
              } else if (fileData instanceof Uint8Array) {
                uint8Array = fileData;
              } 
              // Om fileData har en data-property
              else if (fileData.data) {
                if (fileData.data instanceof Uint8Array) {
                  uint8Array = fileData.data;
                } else if (fileData.data instanceof ArrayBuffer) {
                  uint8Array = new Uint8Array(fileData.data);
                } else if (Array.isArray(fileData.data)) {
                  uint8Array = new Uint8Array(fileData.data);
                } else {
                  uint8Array = new Uint8Array(fileData.data);
                }
              }
              // Om fileData är en array
              else if (Array.isArray(fileData)) {
                uint8Array = new Uint8Array(fileData);
              }
              // Om fileData är en string (base64)
              else if (typeof fileData === 'string') {
                const binaryString = atob(fileData);
                uint8Array = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  uint8Array[i] = binaryString.charCodeAt(i);
                }
              }
              // Sista fallback
              else {
                try {
                  uint8Array = new Uint8Array(fileData);
                } catch (e) {
                  console.error('[OcrResultModal] Could not convert fileData to Uint8Array:', e);
                  throw new Error('Kunde inte konvertera bilddata');
                }
              }
              
              // Bestäm MIME-typ baserat på filändelse
              const ext = (image.name || filePath).split('.').pop()?.toLowerCase() || 'png';
              const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp'
              };
              const mimeType = mimeTypes[ext] || 'image/png';
              
              const blob = new Blob([uint8Array], { type: mimeType });
              const url = URL.createObjectURL(blob);
              currentBlobUrl = url;
              setBlobUrl(url);
              console.log('[OcrResultModal] Image loaded successfully, size:', uint8Array.length, 'bytes');
            } else {
              console.error('[OcrResultModal] Error reading file:', fileData?.error);
            }
          } else if (image.filePath && window.electronAPI && typeof window.electronAPI.readFile === 'function') {
            // Fallback: använd filePath direkt
            console.log('[OcrResultModal] Using filePath fallback:', image.filePath);
            const fileData = await window.electronAPI.readFile(image.filePath);
            if (fileData && !fileData.error) {
              let uint8Array;
              
              if (fileData instanceof ArrayBuffer) {
                uint8Array = new Uint8Array(fileData);
              } else if (fileData instanceof Uint8Array) {
                uint8Array = fileData;
              } else if (fileData.data) {
                if (fileData.data instanceof Uint8Array) {
                  uint8Array = fileData.data;
                } else if (fileData.data instanceof ArrayBuffer) {
                  uint8Array = new Uint8Array(fileData.data);
                } else if (Array.isArray(fileData.data)) {
                  uint8Array = new Uint8Array(fileData.data);
                } else {
                  uint8Array = new Uint8Array(fileData.data);
                }
              } else if (Array.isArray(fileData)) {
                uint8Array = new Uint8Array(fileData);
              } else if (typeof fileData === 'string') {
                const binaryString = atob(fileData);
                uint8Array = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  uint8Array[i] = binaryString.charCodeAt(i);
                }
              } else {
                uint8Array = new Uint8Array(fileData);
              }
              
              const ext = (image.name || image.filePath).split('.').pop()?.toLowerCase() || 'png';
              const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp'
              };
              const mimeType = mimeTypes[ext] || 'image/png';
              
              const blob = new Blob([uint8Array], { type: mimeType });
              const url = URL.createObjectURL(blob);
              currentBlobUrl = url;
              setBlobUrl(url);
              console.log('[OcrResultModal] Image loaded via filePath fallback');
            }
          }
        } else if (imageUrl && imageUrl.startsWith('blob:')) {
          setBlobUrl(imageUrl);
        } else if (imageUrl) {
          setBlobUrl(imageUrl);
        }
      } catch (error) {
        console.error('[OcrResultModal] Error loading image:', error);
        setError(error.message || 'Kunde inte ladda bilden');
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      if (currentBlobUrl && !currentBlobUrl.startsWith('http') && !currentBlobUrl.startsWith('blob') && !currentBlobUrl.startsWith('data')) {
        URL.revokeObjectURL(currentBlobUrl);
      }
      setBlobUrl(null);
      setZoomLevel(1.0);
      setPanOffset({ x: 0, y: 0 });
      setError(null);
    };
  }, [isOpen, image]);

  const handlePanStart = (e) => {
    if (e.button !== 0 || zoomLevel === 1) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePanMove = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPanOffset(prev => ({ x: prev.x + dx / zoomLevel, y: prev.y + dy / zoomLevel }));
    panStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const handleZoom = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newZoom = Math.min(Math.max(1, zoomLevel + delta), 4);
    setZoomLevel(newZoom);
    if (newZoom === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel * 1.2, 4);
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel / 1.2, 1);
    setZoomLevel(newZoom);
    if (newZoom === 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  return (
    <WindowFrame
      title="OCR-resultat - Redigera text"
      icon={ScanFace}
      onClose={onClose}
      initialWidth={1200}
      initialHeight={700}
      zIndex={5002}
    >
      <div className="h-full flex bg-surface">
        {/* VÄNSTER: BILD MED ZOOM + PAN */}
        <div className="w-1/2 border-r border-subtle flex flex-col bg-background">
          <div className="p-3 border-b border-subtle flex items-center justify-between bg-surface">
            <h3 className="text-sm font-bold text-on-accent truncate flex-1">{image?.name || 'Bild'}</h3>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="p-1.5 bg-surface-2 hover:bg-slate-600 text-on-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zooma ut"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-muted min-w-[50px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 4}
                className="p-1.5 bg-surface-2 hover:bg-slate-600 text-on-accent rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zooma in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1.5 bg-surface-2 hover:bg-slate-600 text-on-accent rounded text-xs"
                title="Återställ zoom"
              >
                Reset
              </button>
            </div>
          </div>
          <div 
            className="flex-1 flex items-center justify-center overflow-hidden relative"
            onWheel={handleZoom}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanEnd}
            onMouseLeave={handlePanEnd}
            style={{ cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
          >
            {loading && <span className="text-on-accent animate-pulse">Laddar bild...</span>}
            {error && !loading && (
              <div className="text-red-400 text-center p-4">
                <p className="font-bold mb-2">Fel vid laddning av bild</p>
                <p className="text-sm">{error}</p>
              </div>
            )}
            {!blobUrl && !loading && !error && (
              <div className="text-muted text-center p-4">
                <p>Ingen bild att visa</p>
              </div>
            )}
            {blobUrl && !loading && !error && (
              <img
                ref={imgRef}
                src={blobUrl}
                alt={image?.name || 'Bild'}
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                  transformOrigin: 'center center'
                }}
                onMouseDown={handlePanStart}
                draggable={false}
                onError={(e) => {
                  console.error('[OcrResultModal] Image load error');
                  setError('Kunde inte visa bilden');
                }}
              />
            )}
          </div>
        </div>

        {/* HÖGER: OCR-REDIGERARE */}
        <div className="w-1/2 flex flex-col bg-surface">
          <div className="p-4 border-b border-subtle bg-surface">
            <h3 className="text-sm font-bold text-on-accent mb-1">OCR-text</h3>
            <p className="text-xs text-muted">Granska och redigera texten nedan</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Editor
              value={ocrResult}
              onChange={(e) => setOcrResult(e.target.value)}
              placeholder="OCR-text kommer att visas här..."
            />
          </div>
          <div className="p-4 border-t border-subtle bg-surface flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-2 hover:bg-slate-600 text-on-accent rounded text-sm"
            >
              Avbryt
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-accent hover:bg-accent text-on-accent rounded text-sm"
            >
              Spara till transkribering
            </button>
          </div>
        </div>
      </div>
    </WindowFrame>
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
                ${isActive ? 'bg-accent-soft text-on-accent' : 'text-muted hover:bg-surface hover:text-primary'}
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
                <lib.icon size={16} className={isOver ? 'text-on-accent animate-bounce' : (isActive ? 'text-accent' : 'text-muted group-hover:text-accent')} /> 
                {lib.label}
            </button>
            
            {onDelete && (
                <button 
                    onClick={(e) => onDelete(lib.id, e)} 
                    className="p-1.5 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Radera album"
                >
                    <Trash2 size={12}/>
                </button>
            )}
        </div>
    );
};

// Översätt plats-typer till svenska
const translatePlaceType = (type) => {
  if (!type) return '';
  const typeMap = {
    'Country': 'Land',
    'Landscape': 'Landskap',
    'County': 'Län',
    'Municipality': 'Kommun',
    'Parish': 'Församling/socken',
    'Village': 'By/Ort',
    'Building': 'Byggnad',
    'Cemetary': 'Kyrkogård',
    'village': 'By/Ort',
    'parish': 'Församling/socken',
    'municipality': 'Kommun',
    'county': 'Län',
    'country': 'Land',
    'building': 'Byggnad',
    'cemetary': 'Kyrkogård',
    'default': 'Plats'
  };
  return typeMap[type] || type;
};

export function MediaManager({ allPeople = [], allSources = [], onOpenEditModal = () => {}, onNavigateToSource = () => {}, onNavigateToPlace = () => {}, mediaItems: initialMedia = [], onUpdateMedia = () => {}, setIsSourceDrawerOpen = () => {}, setIsPlaceDrawerOpen = () => {}, onSelectMedia = null, selectedMediaIds = [] }) {
  const { showUndoToast, showStatus, getAllTags, dbData } = useApp();
  const activeMediaFolderPath = String(dbData?.meta?.mediaFolderPath || '').trim();

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
  
  // EXIF State - moved to selection state
  
  // Data State - Use media from database, fallback to INITIAL_MEDIA for demo
  const [mediaItems, setMediaItems] = useState(initialMedia.length > 0 ? initialMedia : INITIAL_MEDIA);
  const mediaItemsRef = useRef(mediaItems);
  
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

  useEffect(() => {
    mediaItemsRef.current = mediaItems;
  }, [mediaItems]);
  
  
  // Get all available places (after mediaItems is defined)
  // Note: allSources now comes from props, not extracted from mediaItems
  const allPlaces = mediaItems
    .flatMap(m => m.connections.places || [])
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i); // Unique by id
  
  // Helper to update media and notify parent
  const updateMedia = (newMediaOrUpdater) => {
    const base = mediaItemsRef.current;
    const newMedia = typeof newMediaOrUpdater === 'function' ? newMediaOrUpdater(base) : newMediaOrUpdater;
    mediaItemsRef.current = newMedia;
    setMediaItems(newMedia);
    onUpdateMedia(newMedia);
  };

  const refreshMediaFromDisk = useCallback(async ({ silent = false } = {}) => {
    if (!window.electronAPI || !window.electronAPI.scanMediaFolder) return;

    try {
      if (!silent && typeof showStatus === 'function') {
        showStatus('Skannar media-mappen...', 'info');
      }

      const result = await window.electronAPI.scanMediaFolder();
      if (!(result && result.success && result.media)) return;

      const filesOnDisk = new Map();
      result.media.forEach((m) => {
        const key = m.filePath || m.url?.replace('media://', '').replace(/%2F/g, '/');
        if (key) filesOnDisk.set(key, m);
      });

      updateMedia((prev) => {
        const existingById = new Map(prev.map((m) => [m.id, m]));
        const existingByPath = new Map(prev.map((m) => {
          const path = m.filePath || m.url?.replace('media://', '').replace(/%2F/g, '/');
          return [path, m];
        }));

        const merged = result.media.map((fileMedia) => {
          const path = fileMedia.filePath || fileMedia.url?.replace('media://', '').replace(/%2F/g, '/');
          const existing = existingById.get(fileMedia.id) || existingByPath.get(path);
          if (existing) {
            return {
              ...existing,
              fileSize: fileMedia.fileSize,
              url: fileMedia.url,
              filePath: fileMedia.filePath
            };
          }
          return fileMedia;
        });

        const removed = [];
        const finalMedia = merged.filter((m) => {
          const path = m.filePath || m.url?.replace('media://', '').replace(/%2F/g, '/');
          const existsOnDisk = filesOnDisk.has(path);
          if (!existsOnDisk) removed.push(m.name || m.id);
          return existsOnDisk;
        });

        const prevCount = prev.length;
        const newCount = finalMedia.length - prevCount;
        const removedCount = removed.length;

        if (!silent && typeof showStatus === 'function') {
          if (newCount > 0 && removedCount > 0) {
            showStatus(`${newCount} nya bilder hittade, ${removedCount} bilder borttagna.`, 'info');
          } else if (newCount > 0) {
            showStatus(`${newCount} nya bilder hittade!`, 'success');
          } else if (removedCount > 0) {
            showStatus(`${removedCount} bilder borttagna från filsystemet.`, 'info');
          } else {
            showStatus('Inga ändringar hittades.', 'info');
          }
        }

        return finalMedia;
      });
    } catch (error) {
      console.error('[MediaManager] Error scanning media folder:', error);
      if (!silent && typeof showStatus === 'function') {
        showStatus(`Fel vid skanning: ${error.message}`, 'error');
      }
    }
  }, [showStatus, updateMedia]);

  useEffect(() => {
    const handleExternalRefresh = () => {
      refreshMediaFromDisk({ silent: true });
    };

    window.addEventListener('WFT:mediaRefreshRequested', handleExternalRefresh);
    return () => window.removeEventListener('WFT:mediaRefreshRequested', handleExternalRefresh);
  }, [refreshMediaFromDisk]);
  
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
      case 'edit':
        setSelectedImage(item);
        setImageViewerOpen(true);
        break;
      case 'rotate':
        const rotateItem = mediaItems.find(m => m.id === contextMenuItemId);
        if (rotateItem) {
          setSelectedImage(rotateItem);
          setImageViewerOpen(true);
        }
        break;
      case 'delete':
        if (window.confirm('Är du säker på att du vill ta bort bilden?')) {
          handleDeleteImage(item);
        }
        break;
    }
    setContextMenuOpen(false);
  };

  // Open unified image viewer on double click
  const handleImageDoubleClick = (item, e) => {
    e.stopPropagation();
    setSelectedImage(item);
    setImageViewerOpen(true);
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
      const deletionIndex = mediaItems.findIndex(m => m.id === item.id);

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
  const [isRunningOCR, setIsRunningOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  // OCR-typ: Endast Tesseract (TrOCR fungerar inte i Electron)
  const [transcriptionContent, setTranscriptionContent] = useState('');
  const [descriptionContent, setDescriptionContent] = useState('');
  
  // Uppdatera selectedImage när mediaItems ändras, så att connections alltid är aktuella
  useEffect(() => {
    if (selectedImage && mediaItems.length > 0) {
      const updatedSelected = mediaItems.find(m => m.id === selectedImage.id);
      if (updatedSelected) {
        const oldSnapshot = JSON.stringify({
          connections: selectedImage.connections || {},
          faces: selectedImage.faces || [],
          name: selectedImage.name || '',
          description: selectedImage.description || '',
          note: selectedImage.note || ''
        });
        const newSnapshot = JSON.stringify({
          connections: updatedSelected.connections || {},
          faces: updatedSelected.faces || [],
          name: updatedSelected.name || '',
          description: updatedSelected.description || '',
          note: updatedSelected.note || ''
        });
        if (oldSnapshot !== newSnapshot) {
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
  
  // Säkerställ att displayImage.connections alltid har people, places, och sources arrays
  const safeDisplayImage = displayImage ? (() => {
    // Parse connections om det är en sträng (JSON)
    let connections = displayImage.connections;
    if (typeof connections === 'string') {
      try {
        connections = JSON.parse(connections);
      } catch (e) {
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

    return {
      ...displayImage,
      connections: safeConnections
    };
  })() : null;

  const selectedMediaItems = useMemo(() => {
    if (!(selectedIds instanceof Set) || selectedIds.size === 0) return [];
    return mediaItems.filter((item) => selectedIds.has(item.id));
  }, [mediaItems, selectedIds]);

  const isMultiEdit = selectedMediaItems.length > 1;

  const visibleTagEntries = useMemo(() => {
    if (isMultiEdit) {
      const counter = new Map();
      selectedMediaItems.forEach((item) => {
        const uniqueTags = new Set(
          (Array.isArray(item?.tags) ? item.tags : [])
            .map((tag) => String(tag || '').trim())
            .filter(Boolean)
        );

        uniqueTags.forEach((tag) => {
          counter.set(tag, (counter.get(tag) || 0) + 1);
        });
      });

      return Array.from(counter.entries())
        .map(([name, count]) => ({
          name,
          count,
          partial: count < selectedMediaItems.length
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    }

    const singleTags = Array.isArray(safeDisplayImage?.tags) ? safeDisplayImage.tags : [];
    return singleTags.map((tag) => ({
      name: String(tag || '').trim(),
      count: 1,
      partial: false
    })).filter((entry) => entry.name);
  }, [isMultiEdit, safeDisplayImage?.tags, selectedMediaItems]);

  // Uppdatera transcription och description när bilden ändras
  useEffect(() => {
    if (safeDisplayImage) {
      // Uppdatera transcriptionContent till den valda bildens transcription
      setTranscriptionContent(safeDisplayImage.transcription || '');
      // Uppdatera descriptionContent till den valda bildens description
      setDescriptionContent(safeDisplayImage.description || '');
    } else {
      // Rensa om ingen bild är vald
      setTranscriptionContent('');
      setDescriptionContent('');
    }
  }, [safeDisplayImage?.id]);

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

  // Använd centraliserad tag-lista från AppContext (alla taggar i appen)
  // getAllTags kommer från useApp() och inkluderar taggar från personer, källor och media

  // Få förslag baserat på input (använder centraliserad tag-lista)
  const getTagSuggestions = (input) => {
    if (!input || input.trim().length === 0) return [];
    const allTags = getAllTags ? getAllTags() : [];
    const lowerInput = input.toLowerCase();
    const currentTags = Array.isArray(safeDisplayImage?.tags) ? safeDisplayImage.tags : [];
    return allTags.filter(tag => 
      tag.toLowerCase().includes(lowerInput) && 
      !currentTags.includes(tag)
    ).slice(0, 5);
  };

  // Lägg till tagg
  const handleAddTag = (tagText) => {
    if (!tagText || tagText.trim().length === 0) {
      console.log('[MediaManager] handleAddTag: tom tagg');
      return;
    }
    if (!safeDisplayImage) {
      console.log('[MediaManager] handleAddTag: safeDisplayImage saknas');
      return;
    }
    
    const tag = tagText.trim();
    const currentTags = Array.isArray(safeDisplayImage.tags) ? safeDisplayImage.tags : [];
    
    console.log('[MediaManager] handleAddTag:', {
      tag,
      currentTags,
      imageId: safeDisplayImage.id,
      imageName: safeDisplayImage.name
    });
    
    // Kontrollera om taggen redan finns
    if (currentTags.includes(tag)) {
      console.log('[MediaManager] handleAddTag: tagg finns redan');
      setTagInput('');
      setTagSuggestions([]);
      return;
    }
    
    // Lägg till taggen
    updateMedia(prev => {
      const updated = prev.map(item => {
        if (item.id !== safeDisplayImage.id) return item;
        const newTags = [...currentTags, tag];
        console.log('[MediaManager] handleAddTag: uppdaterar media:', {
          itemId: item.id,
          oldTags: currentTags,
          newTags: newTags
        });
        return {
          ...item,
          tags: newTags
        };
      });
      console.log('[MediaManager] handleAddTag: media uppdaterad, antal items:', updated.length);
      return updated;
    });
    
    setTagInput('');
    setTagSuggestions([]);
    
    // Fokusera tagg-input igen efter att taggen lagts till
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }, 50);
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
      // Om onSelectMedia finns, använd select mode för MediaSelector
      if (onSelectMedia) {
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

      // Normal MediaManager-funktionalitet
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
    setSelectedIds(new Set(sortedMedia.map(m => m.id)));
    setIsSelectMode(sortedMedia.length > 0);
  };

  const handleToggleSelect = (itemId, e) => {
    const newSelected = new Set(selectedIds);

    if (e?.shiftKey && lastSelectedId) {
      const ids = sortedMedia.map((m) => m.id);
      const lastIdx = ids.indexOf(lastSelectedId);
      const currIdx = ids.indexOf(itemId);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        ids.slice(start, end + 1).forEach((id) => newSelected.add(id));
      } else if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
    } else if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
      setLastSelectedId(itemId);
    }

    setSelectedIds(newSelected);
    setIsSelectMode(newSelected.size > 0);
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Radera ${selectedIds.size} bilder? Filerna flyttas till papperskorgen och raderas automatiskt efter 30 dagar.`)) {
      return;
    }
    
    const itemsToDelete = mediaItems
      .map((m, index) => ({ item: m, index }))
      .filter(({ item }) => selectedIds.has(item.id));
    const deletedIds = new Set();
    const deletedItems = [];
    const failedItems = [];
    
    // Flytta alla valda bilder till papperskorgen
    for (const entry of itemsToDelete) {
      const { item, index } = entry;
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
            deletedItems.push({ ...item, __originalIndex: index });
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

      if (typeof showUndoToast === 'function' && deletedItems.length > 0) {
        showUndoToast(`${deletedItems.length} bilder flyttades till papperskorgen. Ångra?`, async () => {
          for (const deletedItem of deletedItems) {
            try {
              if (deletedItem.filePath && window.electronAPI && window.electronAPI.restoreFileFromTrash) {
                const trashFilesResult = await window.electronAPI.getTrashFiles();
                if (trashFilesResult && trashFilesResult.success) {
                  const trashFile = trashFilesResult.files.find(f =>
                    f.originalName === deletedItem.name || f.path.includes(deletedItem.name)
                  );
                  if (trashFile) {
                    await window.electronAPI.restoreFileFromTrash(trashFile.name, deletedItem.filePath);
                  }
                }
              }
            } catch (restoreError) {
              console.warn('[MediaManager] Kunde inte återställa från papperskorgen:', deletedItem.name, restoreError);
            }
          }

          updateMedia(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const toRestore = deletedItems
              .filter(m => !existingIds.has(m.id))
              .sort((a, b) => (a.__originalIndex || 0) - (b.__originalIndex || 0));
            if (toRestore.length === 0) return prev;

            const merged = [...prev];
            toRestore.forEach((restored) => {
              const copy = { ...restored };
              delete copy.__originalIndex;
              const insertAt = typeof restored.__originalIndex === 'number'
                ? Math.min(restored.__originalIndex, merged.length)
                : merged.length;
              merged.splice(insertAt, 0, copy);
            });
            return merged;
          });

          if (typeof showStatus === 'function') {
            showStatus(`${deletedItems.length} bilder återställda.`, 'success');
          }
        });
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

    const handleBatchEditSave = async ({ date, tags, description, transcription }) => {
      const tagArray = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const selectedCount = selectedIds.size;
      const selectedMediaItems = mediaItems.filter(m => selectedIds.has(m.id));
      const updatedMediaItems = selectedMediaItems.map((item) => {
        const updated = { ...item };
        if (date) updated.date = date;
        if (tagArray.length > 0) updated.tags = [...new Set([...(item.tags || []), ...tagArray])];
        if (description !== undefined && description !== '') updated.description = description;
        if (transcription !== undefined && transcription !== '') updated.transcription = transcription;
        return updated;
      });

      updateMedia(mediaItems.map(m => {
        const updatedItem = updatedMediaItems.find(item => item.id === m.id);
        return updatedItem || m;
      }));

      if (window.electronAPI && typeof window.electronAPI.writeExifMetadata === 'function') {
        await Promise.all(updatedMediaItems.map(async (item) => {
          const filePath = item.filePath || item.path || '';
          if (!filePath) return null;
          try {
            return await window.electronAPI.writeExifMetadata(filePath, {
              keywords: Array.isArray(item.tags) ? item.tags : [],
              date: item.date || '',
              description: item.description || ''
            }, true);
          } catch (error) {
            console.warn('[MediaManager] Kunde inte skriva EXIF för', filePath, error);
            return null;
          }
        }));
      }

      setIsBatchEditOpen(false);
      setSelectedIds(new Set());
      setIsSelectMode(false);
      
      if (typeof showStatus === 'function') {
          showStatus(`${selectedCount} bilder uppdaterade!`, 'success');
      }
  };

  // Hjälpfunktion för att ladda bild som Image för TrOCR
  const loadImageForTrOCR = async (imageData) => {
    return new Promise((resolve, reject) => {
      try {
        // Konvertera bilddata till Uint8Array om det behövs
        let uint8Array;
        if (imageData instanceof ArrayBuffer) {
          uint8Array = new Uint8Array(imageData);
        } else if (imageData instanceof Uint8Array) {
          uint8Array = imageData;
        } else if (imageData.data) {
          if (imageData.data instanceof Uint8Array) {
            uint8Array = imageData.data;
          } else if (imageData.data instanceof ArrayBuffer) {
            uint8Array = new Uint8Array(imageData.data);
          } else {
            uint8Array = new Uint8Array(imageData.data);
          }
        } else {
          uint8Array = new Uint8Array(imageData);
        }
        
        // Skapa en blob från bilddata
        const blob = new Blob([uint8Array]);
        const url = URL.createObjectURL(blob);
        const img = new Image();
        
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(new Error('Kunde inte ladda bilden för TrOCR'));
        };
        
        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  };

  // OCR-funktion
  const handleRunOCR = async () => {
    if (!safeDisplayImage) return;
    
    setIsRunningOCR(true);
    setOcrProgress(0);
    
    let progressInterval = null;
    
    try {
      // Ladda bilden (samma för båda OCR-typer)
      const imageUrl = safeDisplayImage.url;
      let imageData;
      
      if (imageUrl.startsWith('media://')) {
        // För media:// URLs, använd Electron IPC för att läsa filen
        if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
          // Extrahera filvägen från media:// URL
          // media:// kan vara antingen encoded (20251212-175415.png) eller med path (persons/20251212-175415.png)
          let filePath = imageUrl.replace('media://', '');
          // Decode URL encoding
          filePath = decodeURIComponent(filePath);
          // Om det inte finns någon slash, använd filePath direkt (filen ligger i root)
          // Annars använd filePath som den är (med subfolder)
          console.log('[MediaManager] Läser fil för OCR:', filePath);
          
          // Läs filen via Electron IPC
          const fileData = await window.electronAPI.readFile(filePath);
          
          if (fileData && !fileData.error) {
            // readFile returnerar direkt data (Uint8Array eller ArrayBuffer)
            if (fileData instanceof ArrayBuffer) {
              imageData = fileData;
            } else if (fileData instanceof Uint8Array) {
              imageData = fileData.buffer;
            } else if (typeof fileData === 'string') {
              // Base64 string - konvertera till ArrayBuffer
              const binaryString = atob(fileData);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              imageData = bytes.buffer;
            } else {
              // Försök använda direkt om det är något annat
              imageData = fileData;
            }
          } else {
            throw new Error(fileData?.error || 'Kunde inte läsa filen via Electron IPC');
          }
        } else {
          // Fallback: använd filePath om det finns
          if (safeDisplayImage.filePath) {
            console.log('[MediaManager] Använder filePath som fallback:', safeDisplayImage.filePath);
            if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
              const fileData = await window.electronAPI.readFile(safeDisplayImage.filePath);
              if (fileData && !fileData.error) {
                if (fileData instanceof ArrayBuffer) {
                  imageData = fileData;
                } else if (fileData instanceof Uint8Array) {
                  imageData = fileData.buffer;
                } else {
                  imageData = fileData;
                }
              } else {
                throw new Error(fileData?.error || 'Kunde inte läsa filen via Electron IPC');
              }
            } else {
              throw new Error('Electron IPC readFile är inte tillgänglig och filePath saknas');
            }
          } else {
            throw new Error('Electron IPC readFile är inte tillgänglig och filePath saknas');
          }
        }
      } else if (imageUrl.startsWith('blob:')) {
        // För blob URLs, använd fetch
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        imageData = await blob.arrayBuffer();
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // För HTTP/HTTPS URLs, använd fetch
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        imageData = await blob.arrayBuffer();
      } else {
        throw new Error(`Okänt URL-format: ${imageUrl}`);
      }
      
      let text = '';
      
      // Använd endast Tesseract (TrOCR fungerar inte i Electron)
      {
        // Använd Tesseract (standard)
        // För svenska kyrkböcker: Använd svenska + engelska språk
        // Notera: Tesseract är bättre för tryckt text än handskriven text
        // För handskriven text skulle TrOCR vara bättre, men fungerar inte i Electron
        console.log('[MediaManager] Använder Tesseract för OCR (svenska + engelska)...');
        const worker = await createWorker('swe+eng'); // Svenska och engelska
        
        // Förbättra OCR för kyrkböcker:
        // - Använd högre DPI (300+ ger bättre resultat)
        // - Försök med olika PSM (Page Segmentation Mode) för bättre resultat
        // PSM 6 = Uniform text block (bra för kyrkböcker)
        await worker.setParameters({
          tessedit_pageseg_mode: '6', // Uniform text block
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖabcdefghijklmnopqrstuvwxyzåäö0123456789.,;:!?()[]{}\'"- ', // Tillåt svenska tecken
        });
        
        // Kör OCR
        // Notera: Vi kan inte använda logger med React state setters i Web Workers
        // Så vi simulerar progress med en interval
        let simulatedProgress = 10;
        setOcrProgress(simulatedProgress);
        
        progressInterval = setInterval(() => {
          simulatedProgress = Math.min(90, simulatedProgress + 5);
          setOcrProgress(simulatedProgress);
        }, 500); // Uppdatera var 500ms
        
        const { data: { text: tesseractText } } = await worker.recognize(imageData);
        text = tesseractText;
        
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        setOcrProgress(100); // Visa 100% när klar
        
        await worker.terminate();
      }
      
      // Visa resultatet i modal för redigering
      setOcrResult(text);
      setShowOcrModal(true);
      
      if (typeof showStatus === 'function') {
        showStatus('OCR klar! Redigera texten nedan.', 'success');
      }
    } catch (error) {
      console.error('[MediaManager] OCR error:', error);
      
      // Om TrOCR misslyckade, försök med Tesseract som fallback
      // TrOCR-kod borttagen - använder endast Tesseract
      if (false) { // TrOCR fungerar inte i Electron
        console.log('[MediaManager] TrOCR misslyckades, försöker med Tesseract som fallback...');
        try {
          const worker = await createWorker('swe+eng');
          
          let simulatedProgress = 10;
          setOcrProgress(simulatedProgress);
          
          progressInterval = setInterval(() => {
            simulatedProgress = Math.min(90, simulatedProgress + 5);
            setOcrProgress(simulatedProgress);
          }, 500);
          
          const { data: { text: tesseractText } } = await worker.recognize(imageData);
          text = tesseractText;
          
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          setOcrProgress(100);
          
          await worker.terminate();
          
          setOcrResult(text);
          setShowOcrModal(true);
          
          if (typeof showStatus === 'function') {
            showStatus('TrOCR misslyckades, men Tesseract fungerade!', 'warn');
          }
        } catch (fallbackError) {
          console.error('[MediaManager] Tesseract fallback failed:', fallbackError);
          if (typeof showStatus === 'function') {
            showStatus(`OCR-fel: ${error.message}`, 'error');
          }
        }
      } else {
        if (typeof showStatus === 'function') {
          showStatus(`OCR-fel: ${error.message}`, 'error');
        }
      }
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setIsRunningOCR(false);
      setOcrProgress(0);
    }
  };

  // Spara OCR-resultat till transcription
  const handleSaveOCRResult = () => {
    if (!safeDisplayImage) return;
    
    updateMedia(prev => prev.map(item => {
      if (item.id !== safeDisplayImage.id) return item;
      return {
        ...item,
        transcription: ocrResult
      };
    }));
    
    setTranscriptionContent(ocrResult);
    setShowOcrModal(false);
    setOcrResult('');
    setShowTranscription(true);
    
    if (typeof showStatus === 'function') {
      showStatus('OCR-text sparad!', 'success');
    }
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
    if (!selectedImage?.id) {
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
            updateMedia(prev => {
              let didChange = false;
              const next = prev.map(item => {
                if (item.id !== selectedImage.id) return item;

                const updated = { ...item };

                // Keywords -> tags
                if (data.keywords && data.keywords.length) {
                  const mergedTags = [...new Set([...(item.tags || []), ...data.keywords])];
                  if (JSON.stringify(mergedTags) !== JSON.stringify(item.tags || [])) {
                    updated.tags = mergedTags;
                    didChange = true;
                  }
                }

                // Face tags
                if (data.face_tags && data.face_tags.length) {
                  if (JSON.stringify(data.face_tags) !== JSON.stringify(item.faces || [])) {
                    updated.faces = data.face_tags;
                    didChange = true;
                  }
                }

                // Metadata (datum och beskrivning)
                if (data.metadata) {
                  if (!item.date && data.metadata.date_taken) {
                    updated.date = data.metadata.date_taken;
                    didChange = true;
                  }

                  if (!item.description) {
                    if (data.metadata.title) {
                      updated.description = data.metadata.title;
                      didChange = true;
                    } else if (data.metadata.description) {
                      updated.description = data.metadata.description;
                      didChange = true;
                    }
                  }
                }

                return didChange ? updated : item;
              });

              return didChange ? next : prev;
            });
          }
        }
      } catch (error) {
        console.warn('[MediaManager] Auto EXIF load failed:', error);
      } finally {
        setLoadingExif(false);
      }
    };
    
    loadExif();
  }, [selectedImage?.id]);

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
    <div className="flex flex-1 overflow-hidden w-full h-full bg-background">
      {/* VÄNSTER: Bibliotek */}
      <div className="w-64 bg-surface border-r border-subtle flex flex-col shrink-0">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-2 space-y-1">
              <p className="px-3 py-1 text-[10px] font-bold text-muted uppercase">Bibliotek</p>
              {SYSTEM_LIBRARIES.map(lib => (
              <LibraryButton key={lib.id} lib={lib} isActive={activeLib === lib.id} onClick={() => { setActiveLib(lib.id); setSelectedImage(null); setIsSelectMode(false); setFilterUnlinked(false); }} onDrop={handleLibraryDrop}/>
              ))}
              <button onClick={() => { setFilterUnlinked(!filterUnlinked); setActiveLib('all'); setSearch(''); }} className={`flex items-center gap-3 w-full px-3 py-2 rounded text-sm transition-colors ${filterUnlinked ? 'bg-yellow-600/20 text-yellow-400 border border-yellow-600/50' : 'text-muted hover:bg-surface hover:text-primary'}`}>
                  <AlertCircle size={16} /> Okopplade ({mediaItems.filter(m => (!m.connections?.people || m.connections.people.length === 0) && (!m.connections?.places || m.connections.places.length === 0) && (!m.connections?.sources || m.connections.sources.length === 0)).length})
              </button>
          </div>
          <div className="p-2 space-y-1 border-t border-subtle">
              <div className="flex justify-between items-center px-3 py-1">
                  <p className="text-[10px] font-bold text-muted uppercase">Mina Album</p>
                  <button onClick={handleStartCreateLibrary} className="text-muted hover:text-primary bg-surface p-1 rounded hover:bg-surface-2 transition-colors"><Plus size={12}/></button>
              </div>
              {customLibraries.map(lib => (
                  <div key={lib.id}>
                  {editingLibId === lib.id ? (
                      <div className="flex items-center gap-2 w-full px-2 py-1">
                          <Folder size={16} className="text-accent shrink-0"/>
                          <input ref={libInputRef} type="text" value={tempLibName} onChange={(e) => setTempLibName(e.target.value)} onBlur={handleSaveLibraryName} onKeyDown={handleKeyDownLibrary} className="w-full bg-background text-on-accent text-sm px-1 py-0.5 rounded border border-accent focus:outline-none"/>
                      </div>
                  ) : (
                      <LibraryButton lib={lib} isActive={activeLib === lib.id} onClick={() => { setActiveLib(lib.id); setIsSelectMode(false); setFilterUnlinked(false); }} onDelete={handleDeleteLibrary} onDrop={handleLibraryDrop}/>
                  )}
                  </div>
              ))}
          </div>
      </div>
      <div className="p-4 border-t border-subtle">
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
            className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent text-on-accent py-2 rounded text-sm transition-colors font-medium"
          >
          <UploadCloud size={16}/> Ladda upp
          </button>
          
          {/* Papperskorg-knapp */}
          <button
            onClick={() => setShowTrashModal(true)}
            className="flex items-center justify-center gap-2 w-full bg-surface hover:bg-surface-2 text-secondary py-2 rounded text-sm transition-colors font-medium border border-subtle mt-2"
          >
            <Trash size={16}/> Papperskorg
          </button>
      </div>
      </div>

      {/* MITTEN: Galleri */}
      <div className="flex-1 flex flex-col bg-background min-w-0 relative">
      
      <div className="min-h-14 border-b border-subtle flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-surface-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshMediaFromDisk({ silent: false })}
              className="px-3 py-1.5 bg-surface-2 border border-subtle hover:bg-surface text-primary text-xs rounded transition-colors flex items-center gap-1.5"
              title="Skanna media-mappen för nya bilder"
            >
              <RefreshCw size={14} /> Uppdatera
            </button>
            <div
              className="px-2.5 py-1.5 rounded border border-subtle bg-background text-[11px] text-muted max-w-[420px] truncate"
              title={activeMediaFolderPath || 'Standard media-mapp används'}
            >
              Media-mapp: {activeMediaFolderPath || 'Standard (../media)'}
            </div>
          </div>
          <div className="flex gap-2 items-center">
              <button
                onClick={() => {
                  setSelectedIds(new Set());
                  setSelectedImage(null);
                  setIsSelectMode(false);
                }}
                className="px-3 py-1.5 rounded text-sm border border-subtle bg-surface-2 hover:bg-surface text-primary whitespace-nowrap transition-colors"
              >
                  Avmarkera alla
              </button>
              <button onClick={handleSelectAll} className="px-3 py-1.5 rounded text-sm border border-subtle bg-surface-2 hover:bg-surface text-primary whitespace-nowrap transition-colors">
                  Markera alla
              </button>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
              {/* Thumbnail Size Slider */}
              <div className="flex items-center gap-1.5 w-24 flex-shrink-0">
                  <SlidersHorizontal size={12} className="text-muted flex-shrink-0"/>
                  <input 
                      type="range" 
                      min="2" 
                      max="8" 
                      value={thumbnailSize} 
                      onChange={(e) => setThumbnailSize(parseInt(e.target.value))}
                      className="flex-1 slider min-w-[60px]"
                      title={`${thumbnailSize} kolumner`}
                  />
                  <span className="text-xs text-muted w-4 text-right flex-shrink-0">{thumbnailSize}</span>
              </div>
              
              {/* Sortering Dropdown */}
              <div className="relative flex-shrink-0">
                  <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-background border border-subtle rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent appearance-none pr-8 cursor-pointer min-w-[140px]"
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
                  <ArrowUpDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
              </div>
              
              {/* Filtrering Dropdown */}
              <div className="relative flex-shrink-0">
                  <select 
                      value={filterBy} 
                      onChange={(e) => setFilterBy(e.target.value)}
                      className="bg-background border border-subtle rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent appearance-none pr-8 cursor-pointer min-w-[120px]"
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
                  <Filter size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
              </div>
              
              {/* Sök */}
              <div className="relative w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
                  <input type="text" placeholder="Sök..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-background border border-subtle rounded-full pl-9 pr-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"/>
              </div>
              
              {/* Grid/List View Toggle */}
              <div className="flex items-center bg-background rounded-lg p-1 border border-subtle">
                  <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-surface-2 text-on-accent' : 'text-muted hover:text-primary'}`}><Grid size={16}/></button>
                  <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-surface-2 text-on-accent' : 'text-muted hover:text-primary'}`}><List size={16}/></button>
              </div>
          </div>
      </div>

      <div 
          className="flex-1 overflow-y-auto p-4 custom-scrollbar relative"
          onDragOver={(e) => {
            e.preventDefault();
            const internalData = e.dataTransfer.getData('application/json');
            if (!internalData) setIsDraggingFile(true);
          }}
          onDragLeave={(e) => {e.preventDefault(); setIsDraggingFile(false);}}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFile(false);

            const internalData = e.dataTransfer.getData('application/json');
            if (internalData) {
              // Intern drag används endast för att flytta till bibliotek i sidopanelen.
              return;
            }

            if (e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files);
            }
          }}
      >
          {isDraggingFile && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-900/20 backdrop-blur-sm border-2 border-accent border-dashed m-4 rounded-xl pointer-events-none">
                  <div className="text-center text-accent"><UploadCloud size={64} className="mx-auto mb-2"/><h3 className="font-bold">Släpp filerna här</h3></div>
              </div>
          )}
          {sortedMedia.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted">
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
                    className={`group relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${(onSelectMedia && selectedMediaIds.includes(item.id)) ? 'border-green-500 ring-2 ring-green-500/50' : selectedIds.has(item.id) ? 'border-accent bg-accent-soft ring-2 ring-accent/50' : (selectedImage?.id === item.id ? 'border-accent' : 'border-subtle hover:border-strong')}`}
              >
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" onContextMenu={(e) => handleContextMenu(e, item.id)} /> 
                  {(onSelectMedia && selectedMediaIds.includes(item.id)) && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center z-10">
                          <div className="bg-green-500 text-on-accent rounded-full p-2 shadow-lg">
                              <CheckSquare size={24} fill="currentColor" className="text-on-accent" />
                          </div>
                      </div>
                  )}
                    {!onSelectMedia && (
                      <button
                      type="button"
                      className="absolute top-2 right-2 z-20 rounded bg-background/95 border border-strong p-0.5 shadow-lg"
                      onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id, e); }}
                      title={selectedIds.has(item.id) ? 'Avmarkera' : 'Markera'}
                      >
                      {selectedIds.has(item.id)
                        ? <CheckSquare size={22} className="text-accent" />
                        : <Square size={22} className="text-muted" />}
                      </button>
                    )}
                  {item.connections.people.length === 0 && item.connections.places.length === 0 && item.connections.sources.length === 0 && (
                      <div className="absolute top-2 left-2 bg-yellow-600 text-on-accent p-1 rounded-full shadow-md" title="Okopplad">
                      <AlertCircle size={10}/>
                      </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                  <p className="text-on-accent text-xs font-medium truncate">{item.name}</p>
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
                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                      draggable 
                      onDragStart={(e) => handleItemDragStart(e, item.id)} 
                      className={`flex items-center gap-4 p-2 rounded border cursor-pointer ${selectedIds.has(item.id) ? 'bg-accent-soft border-accent ring-1 ring-accent/40' : (selectedImage?.id === item.id ? 'bg-surface border-accent' : 'bg-surface-2 border-subtle hover:bg-surface')}`}>
                      <button
                        type="button"
                        className="w-8 flex justify-center"
                        onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id, e); }}
                        title={selectedIds.has(item.id) ? 'Avmarkera' : 'Markera'}
                      >
                        {selectedIds.has(item.id)
                          ? <CheckSquare size={18} className="text-accent"/>
                          : <Square size={18} className="text-muted"/>}
                      </button>
                      <div className="w-10 h-10 bg-background rounded overflow-hidden shrink-0 border border-subtle">
                          <img src={item.url} className="w-full h-full object-cover pointer-events-none"/>
                      </div>
                      <span className="text-sm text-primary flex-1 truncate font-medium">{item.name}</span>
                      <span className="text-xs text-muted">{item.date}</span>
                      <span className="text-xs text-muted bg-surface px-2 py-0.5 rounded border border-subtle">
                              {allLibraries.find(l => l.id === item.libraryId)?.label || 'Okänt'}
                      </span>
                      {item.connections.people.length === 0 && <AlertCircle size={14} className="text-yellow-500" title="Okopplad"/>}
                  </div>
              ))}
          </div>
          )}
      </div>

        {selectedIds.size > 0 && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-background border border-strong text-primary px-2 py-1.5 rounded-full shadow-2xl flex gap-2 items-center z-50">
              <span className="text-xs font-bold text-secondary px-2 border-r border-subtle">{selectedIds.size} valda</span>
            <button onClick={() => setIsBatchEditOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary hover:bg-surface rounded-full transition-colors">
                  <Edit2 size={14}/> Redigera
              </button>
            <button onClick={() => setIsMoveModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary hover:bg-surface rounded-full transition-colors">
                  <MoveRight size={14}/> Flytta
              </button>
            <button onClick={handleBatchDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger-soft rounded-full transition-colors">
                  <Trash2 size={14}/> Radera
              </button>
          </div>
      )}
      
      <MoveFilesModal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} onMove={handleBatchMove} libraries={allLibraries} />
      <BatchEditModal isOpen={isBatchEditOpen} onClose={() => setIsBatchEditOpen(false)} onSave={handleBatchEditSave} count={selectedIds.size} />
      </div>

      {/* HÖGER: Detaljpanel */}
      {safeDisplayImage ? (
      <div className="w-96 bg-surface border-l border-subtle flex flex-col shrink-0 z-20 shadow-xl">
          <div className="p-4 border-b border-subtle bg-surface">
              <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-bold text-on-accent truncate flex-1">{safeDisplayImage.name}</h3>
                  <button onClick={() => setSelectedImage(null)} className="text-muted hover:text-primary shrink-0 ml-2"><X size={18}/></button>
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
                      className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors group"
                      title="Öppna i Explorer"
                  >
                      <FolderOpen size={12} className="group-hover:text-accent shrink-0" />
                      <span className="truncate">media/{safeDisplayImage.filePath}</span>
                  </button>
              )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-surface min-h-0">
              <div className="space-y-3">
                  <div>
                      <label className="text-[10px] uppercase font-bold text-muted block mb-1">Datering</label>
                      <div className="flex items-center bg-background border border-subtle rounded px-2 py-1.5">
                          <Calendar size={14} className="text-muted mr-2"/>
                          <input type="text" defaultValue={safeDisplayImage.date} className="bg-transparent text-sm text-on-accent w-full focus:outline-none" />
                      </div>
                  </div>
                  <div>
                      <label className="text-[10px] uppercase font-bold text-muted block mb-1">Bibliotek / Kategori</label>
                      <select 
                          defaultValue={safeDisplayImage.libraryId}
                          className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-sm text-on-accent focus:outline-none focus:border-accent"
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
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Bildtext / Beskrivning</label>
                  <div className="bg-background border border-subtle rounded p-2 min-h-[100px]">
                      <Editor
                          value={descriptionContent || safeDisplayImage.description || ''}
                          onChange={(e) => {
                              const newValue = e.target.value;
                              setDescriptionContent(newValue);
                              // Auto-spara
                              updateMedia(prev => prev.map(item => {
                                  if (item.id !== safeDisplayImage.id) return item;
                                  return { ...item, description: newValue };
                              }));
                          }}
                          placeholder="Skriv en beskrivning..."
                      />
                  </div>
              </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-muted uppercase">Transkribering / OCR</label>
                      <div className="flex items-center gap-2 flex-wrap">
                          {/* OCR-typ: Endast Tesseract (TrOCR fungerar inte i Electron) */}
                          <span className="text-xs text-muted">Tesseract OCR</span>
                          <button 
                              onClick={handleRunOCR} 
                              disabled={isRunningOCR}
                              className="text-xs flex items-center gap-1 text-accent hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Läs av text från bilden med OCR"
                          >
                              {isRunningOCR ? (
                                  <>
                                      <RefreshCw size={12} className="animate-spin"/> OCR: {ocrProgress}%
                                  </>
                              ) : (
                                  <>
                                      <ScanFace size={12}/> OCR
                                  </>
                              )}
                          </button>
                          <button onClick={() => setShowTranscription(!showTranscription)} className="text-xs flex items-center gap-1 text-accent hover:text-primary">
                              <PenTool size={12}/> {showTranscription ? 'Dölj' : 'Visa / Redigera'}
                          </button>
                      </div>
                      </div>
                      {showTranscription && (
                      <div className="bg-background border border-subtle rounded p-2 min-h-[150px]">
                          <Editor
                              value={transcriptionContent || safeDisplayImage.transcription || ''}
                              onChange={(e) => {
                                  const newValue = e.target.value;
                                  setTranscriptionContent(newValue);
                                  // Auto-spara
                                  updateMedia(prev => prev.map(item => {
                                      if (item.id !== safeDisplayImage.id) return item;
                                      return { ...item, transcription: newValue };
                                  }));
                              }}
                              placeholder="Skriv av texten här eller använd OCR..."
                          />
                  </div>
              )}
              </div>
              
              <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-muted uppercase border-b border-subtle pb-1">Kopplingar</h4>
                  
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-muted">Personer</label>
                      </div>
                      {(() => {
                        const people = safeDisplayImage?.connections?.people;
                        const isArray = Array.isArray(people);
                        const hasPeople = isArray && people.length > 0;
                        
                        if (!safeDisplayImage) {
                          return <div className="text-xs text-muted italic py-2">Ingen bild vald</div>;
                        }
                        
                        if (!isArray) {
                          return <div className="text-xs text-red-500 italic py-2">Fel: people är inte en array (typ: {typeof people})</div>;
                        }
                        
                        if (!hasPeople) {
                          return <div className="text-xs text-muted italic py-2">Inga personer kopplade</div>;
                        }
                        
                        return people.map((p, idx) => {
                          const personId = typeof p === 'object' ? p.id : p;
                          
                          // Hitta personobjektet från allPeople för att få full information
                          const person = allPeople.find(pp => pp.id === personId);
                          
                          if (!person) {
                            // Fallback om personen inte hittas
                            const personName = typeof p === 'object' ? p.name : p;
                            return (
                              <div key={personId || idx} className="flex items-center justify-between bg-background p-2 rounded border border-subtle text-xs">
                                <div><span className="text-primary font-medium block">{personName}</span></div>
                              <button className="text-muted hover:text-red-400"><X size={12}/></button>
                          </div>
                            );
                          }
                          
                          // Extrahera födelse- och dödsdata från events (samma format som EditPersonModal)
                          const birthEvent = person.events?.find(e => e.type === 'Födelse');
                          const deathEvent = person.events?.find(e => e.type === 'Död');
                          
                          const birthDate = birthEvent?.date || '';
                          const birthPlace = birthEvent?.place || '';
                          const deathDate = deathEvent?.date || '';
                          const deathPlace = deathEvent?.place || '';
                          
                          // Formatera kön (samma format som EditPersonModal)
                          const sex = person.sex || 'U';
                          const sexLabel = sex === 'M' ? 'M' : sex === 'K' ? 'F' : 'U';
                          
                          // Hämta profilbild (samma logik som EditPersonModal)
                          const primaryMedia = person.media && person.media.length > 0 ? person.media[0] : null;
                          const profileImage = primaryMedia ? (primaryMedia.url || primaryMedia.path) : null;
                          
                          return (
                            <div 
                              key={personId || idx} 
                              className="flex items-start gap-2 bg-background p-2 rounded border border-subtle text-xs cursor-pointer hover:bg-surface transition-colors"
                              onClick={() => {
                                if (onOpenEditModal) {
                                  onOpenEditModal(personId);
                                }
                              }}
                            >
                              {/* Rund thumbnail (samma som EditPersonModal) */}
                              <div className="w-10 h-10 rounded-full bg-slate-600 flex-shrink-0 overflow-hidden border-2 border-strong">
                                {profileImage ? (
                                  <MediaImage
                                    url={profileImage}
                                    alt={`${person.firstName} ${person.lastName}`} 
                                    className="w-full h-full object-cover"
                                    style={getAvatarImageStyle(primaryMedia, person.id)}
                                  />
                                ) : (
                                  <User className="w-full h-full p-2 text-muted" />
                                )}
                              </div>
                              
                              {/* Personinfo */}
                              <div className="flex-1 min-w-0">
                                {/* Namn */}
                                <div className="text-primary font-medium mb-0.5">
                                  {person.firstName} {person.lastName}
                                </div>
                                
                                {/* Födelsedatum och plats */}
                                {(birthDate || birthPlace) && (
                                  <div className="text-[10px] text-muted mb-0.5">
                                    * {birthDate || '????-??-??'} {birthPlace && ` ${birthPlace}`} ({sexLabel})
                                  </div>
                                )}
                                
                                {/* Dödsdatum och plats */}
                                {(deathDate || deathPlace) && (
                                  <div className="text-[10px] text-muted">
                                    + {deathDate || '????-??-??'} {deathPlace && ` ${deathPlace}`} ({sexLabel})
                                  </div>
                                )}
                                
                                {/* Om inga datum finns */}
                                {!birthDate && !deathDate && (
                                  <div className="text-[10px] text-muted italic">
                                    Inga datum registrerade
                                  </div>
                                )}
                              </div>
                              
                              <button 
                                className="text-muted hover:text-red-400 ml-2 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Ta bort koppling
                                }}
                                title="Ta bort koppling"
                              >
                                <X size={12}/>
                              </button>
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
                        className="w-full py-1.5 border border-dashed border-subtle text-muted text-xs rounded hover:text-primary hover:border-strong hover:bg-surface-2 transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus size={12}/> Koppla person
                      </button>
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-muted">Källor</label>
                      </div>
                      {Array.isArray(safeDisplayImage?.connections?.sources) && safeDisplayImage.connections.sources.length > 0 ? (
                        safeDisplayImage.connections.sources.map((s, idx) => {
                          // Hitta källobjektet från allSources
                          const sourceId = typeof s === 'object' ? s.id : s;
                          const source = allSources.find(src => src.id === sourceId);
                          
                          if (!source) {
                            // Fallback om källan inte hittas
                            return (
                              <div key={sourceId || idx} className="flex items-center justify-between bg-background p-2 rounded border border-subtle text-xs">
                              <div>
                                  <span className="text-primary font-medium block">{typeof s === 'object' ? (s.name || s.title) : s}</span>
                              </div>
                              <button className="text-muted hover:text-red-400"><X size={12}/></button>
                          </div>
                            );
                          }
                          
                          // Bygg hierarki-titel (samma format som källträdet)
                          // Format: "Löderup (L, M) AI:6 (182-1826)"
                          const title = source.title || 'Okänd Titel';
                          const volume = source.volume || '';
                          const date = source.date ? ` (${source.date})` : '';
                          const hierarchyTitle = volume ? `${title} ${volume}${date}` : `${title}${date}`;
                          
                          // Bygg bild/sida-label (samma logik som SourceCatalog)
                          const pageParts = [];
                          if (source.imagePage) {
                            const isJustNumbers = /^\d+$/.test(source.imagePage);
                            pageParts.push(isJustNumbers ? `Bild ${source.imagePage}` : source.imagePage);
                          }
                          if (source.page) {
                            const isJustNumbers = /^\d+$/.test(source.page);
                            pageParts.push(isJustNumbers ? `sid ${source.page}` : source.page);
                          }
                          const pageLabel = pageParts.length > 0 ? pageParts.join(' / ') : '';
                          
                          return (
                            <div key={sourceId || idx} className="bg-background p-2 rounded border border-subtle text-xs">
                              {/* Hierarki-titel (klickbar för att öppna i källträdet) */}
                              <div 
                                className="text-primary font-medium mb-1 cursor-pointer hover:text-accent transition-colors"
                                onClick={() => {
                                  if (onNavigateToSource) {
                                    onNavigateToSource(sourceId);
                                  }
                                }}
                                title="Klicka för att öppna i källträdet"
                              >
                                {hierarchyTitle}
                              </div>
                              
                              {/* Bild / Sid med AD RA NAD-knappar på samma rad */}
                              <div className="flex items-center gap-2 mb-1.5">
                                {pageLabel && (
                                  <div className="text-[10px] text-muted">
                                    {pageLabel}
                                  </div>
                                )}
                                
                                {/* AD RA NAD-knappar (samma som SourceCatalog) */}
                                <div className="flex gap-1 items-center">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (source.aid) {
                                      window.open(`http://www.arkivdigital.se/aid/show/${source.aid}`, '_blank');
                                    }
                                  }}
                                  variant={source.aid ? "success" : "ghost"}
                                  size="xs"
                                  title={source.aid ? `Öppna AID: ${source.aid}` : "Ingen AID"}
                                  className={source.aid ? "" : "opacity-50 border border-subtle"}
                                  disabled={!source.aid}
                                >
                                  AD
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (source.bildid) {
                                      window.open(`https://sok.riksarkivet.se/bildvisning/${source.bildid}`, '_blank');
                                    }
                                  }}
                                  variant={source.bildid ? "success" : "ghost"}
                                  size="xs"
                                  title={source.bildid ? `Öppna RA: ${source.bildid}` : "Ingen RA-länk"}
                                  className={source.bildid ? "" : "opacity-50 border border-subtle"}
                                  disabled={!source.bildid}
                                >
                                  RA
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (source.nad) {
                                      window.open(`https://sok.riksarkivet.se/?postid=ArkisRef%20${source.nad}`, '_blank');
                                    }
                                  }}
                                  variant={source.nad ? "success" : "ghost"}
                                  size="xs"
                                  title={source.nad ? `Öppna NAD: ${source.nad}` : "Ingen NAD-länk"}
                                  className={source.nad ? "" : "opacity-50 border border-subtle"}
                                  disabled={!source.nad}
                                >
                                  NAD
                                </Button>
                                </div>
                              </div>
                              
                              {/* Ta bort-knapp */}
                              <div className="flex justify-end">
                        <button 
                                  className="text-muted hover:text-red-400"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Ta bort koppling
                                  }}
                                  title="Ta bort koppling"
                                >
                                  <X size={12}/>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-muted italic py-2">Inga källor kopplade</div>
                      )}
                        <button 
                          onClick={() => setIsSourceDrawerOpen(safeDisplayImage)}
                          className="w-full py-1.5 border border-dashed border-subtle text-muted text-xs rounded hover:text-primary hover:border-strong hover:bg-surface-2 transition-colors flex items-center justify-center gap-1"
                      >
                          <Link size={12}/> Koppla källa
                      </button>
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-muted">Platser</label>
                      </div>
                      {Array.isArray(safeDisplayImage?.connections?.places) && safeDisplayImage.connections.places.length > 0 ? (
                        safeDisplayImage.connections.places.map(p => (
                          <div key={p.id} className="bg-background p-2 rounded border border-subtle text-xs">
                              {/* Platsnamn (klickbar för att öppna i platsregistret) */}
                              <div 
                                className="text-primary font-medium mb-1 cursor-pointer hover:text-accent transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('[MediaManager] Klickade på plats:', p.id, p.name, 'onNavigateToPlace:', typeof onNavigateToPlace);
                                  if (onNavigateToPlace && p.id) {
                                    onNavigateToPlace(p.id);
                                  } else {
                                    console.warn('[MediaManager] onNavigateToPlace saknas eller p.id saknas');
                                  }
                                }}
                                title="Klicka för att öppna i platsregistret"
                              >
                                {p.name}
                              </div>
                              
                              {/* Plats-typ (på svenska) */}
                              {p.type && (
                                <div className="text-[10px] text-muted mb-1">
                                  {translatePlaceType(p.type)}
                                </div>
                              )}
                              
                              {/* Ta bort-knapp */}
                              <div className="flex justify-end">
                              <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
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
                                className="text-muted hover:text-red-400"
                                  title="Ta bort koppling"
                              >
                                <X size={12}/>
                              </button>
                          </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted italic py-2">Inga platser kopplade</div>
                      )}
                        <button 
                          onClick={() => setIsPlaceDrawerOpen(safeDisplayImage)}
                          className="w-full py-1.5 border border-dashed border-subtle text-muted text-xs rounded hover:text-primary hover:border-strong hover:bg-surface-2 transition-colors flex items-center justify-center gap-1"
                      >
                          <MapPin size={12}/> Koppla plats
                      </button>
                  </div>

                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-muted">Händelser</label>
              </div>
                      {(() => {
                        // Hitta alla händelser som är kopplade till denna bild
                        // Gå igenom alla personer och deras händelser
                        const eventConnections = [];
                        
                        if (allPeople && safeDisplayImage) {
                          allPeople.forEach(person => {
                            if (person.events && Array.isArray(person.events)) {
                              person.events.forEach(event => {
                                // Kontrollera om bilden finns i event.images
                                const eventImages = Array.isArray(event.images) ? event.images : [];
                                if (eventImages.includes(safeDisplayImage.id)) {
                                  eventConnections.push({
                                    personId: person.id,
                                    personName: `${person.firstName} ${person.lastName}`,
                                    eventId: event.id,
                                    eventType: event.type,
                                    eventDate: event.date || '',
                                    eventPlace: event.place || ''
                                  });
                                }
                              });
                            }
                          });
                        }
                        
                        if (eventConnections.length === 0) {
                          return <div className="text-xs text-muted italic py-2">Inga händelser kopplade</div>;
                        }
                        
                        return eventConnections.map((conn, idx) => (
                          <div 
                            key={`${conn.personId}-${conn.eventId}-${idx}`} 
                            className="bg-background p-2 rounded border border-subtle text-xs cursor-pointer hover:bg-surface transition-colors"
                            onClick={() => {
                              if (onOpenEditModal) {
                                onOpenEditModal(conn.personId);
                              }
                            }}
                          >
                            {/* Personnamn */}
                            <div className="text-primary font-medium mb-1">
                              {conn.personName}
                            </div>
                            
                            {/* Händelsetyp och datum */}
                            <div className="text-[10px] text-muted">
                              {conn.eventType}
                              {conn.eventDate && ` - ${conn.eventDate}`}
                              {conn.eventPlace && ` (${conn.eventPlace})`}
                            </div>
                          </div>
                        ));
                      })()}
                  </div>
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted uppercase mb-2 block">Taggar</label>
                  
                  {/* Visade taggar */}
                  {visibleTagEntries.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                      {visibleTagEntries.map((entry, idx) => (
                              <span 
                                  key={idx} 
                                  className="bg-green-600/20 border border-green-500/50 text-green-300 text-xs px-2 py-1 rounded-full flex items-center gap-1.5 group hover:bg-green-600/30 transition-colors"
                          title={isMultiEdit ? `${entry.count}/${selectedMediaItems.length} markerade bilder har denna tagg` : entry.name}
                              >
                          <span>{entry.partial ? `*${entry.name}` : entry.name}</span>
                                  <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          updateMedia(prev => prev.map(item => {
                                const shouldUpdate = isMultiEdit
                                ? selectedIds.has(item.id)
                                : item.id === safeDisplayImage?.id;
                                if (!shouldUpdate) return item;
                                const newTags = Array.isArray(item.tags)
                                ? item.tags.filter(t => String(t) !== entry.name)
                                : [];
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
                          className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-sm text-on-accent focus:outline-none focus:border-accent"
                          value={tagInput}
                          onChange={(e) => {
                              setTagInput(e.target.value);
                              setTagSuggestions(getTagSuggestions(e.target.value));
                          }}
                          onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  e.stopPropagation(); // Förhindra att TipTap-editor fångar upp eventet
                                  const trimmed = tagInput.trim();
                                  if (trimmed) {
                                      handleAddTag(trimmed);
                                  }
                              }
                          }}
                          onClick={(e) => {
                              e.stopPropagation(); // Förhindra event bubbling
                          }}
                          onFocus={(e) => {
                              e.stopPropagation(); // Förhindra event bubbling
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
                          <div className="absolute z-50 w-full mt-1 bg-surface border border-subtle rounded shadow-lg max-h-40 overflow-y-auto">
                              {tagSuggestions.map((suggestion, idx) => (
                                  <button
                                      key={idx}
                                      onClick={(e) => {
                                          e.preventDefault();
                                          handleAddTag(suggestion);
                                          setTagInput('');
                                          setTagSuggestions([]);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-surface-2 transition-colors flex items-center gap-2"
                                  >
                                      <Tag size={12} className="text-muted" />
                                      <span>{suggestion}</span>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
                  
                  <p className="text-[10px] text-muted">Tryck Enter eller "," för att lägga till tagg</p>
                  {isMultiEdit && (
                    <p className="text-[10px] text-muted">* före tagg betyder att den bara finns på vissa av de markerade bilderna.</p>
                  )}
              </div>

              {/* EXIF & METADATA SEKTION */}
              <div className="space-y-3 border-t border-subtle pt-4">
                  <h4 className="text-[10px] font-bold text-muted uppercase flex items-center gap-2">
                      <Camera size={12}/> EXIF & Metadata
                  </h4>

                  {exifData ? (
                      <div className="space-y-3">
                          {/* Face Tags */}
                          {exifData.face_tags && exifData.face_tags.length > 0 ? (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted flex items-center gap-1">
                                <ScanFace size={12}/> Face Tags
                              </label>
                              {exifData.face_tags.map((face, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-background p-2 rounded border border-subtle text-xs">
                                  <div>
                                    <span className="text-primary font-medium block">{face.name}</span>
                                    <span className="text-[10px] text-muted">{face.source}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button className="text-green-400 hover:text-green-300 p-1" title="Länka till person">
                                      <Link size={12}/>
                                    </button>
                                    <button className="text-muted hover:text-red-400 p-1">
                                      <X size={12}/>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted">Inga face tags hittades i EXIF.</p>
                          )}

                          {/* Keywords - dölj om taggar redan finns */}
                          {(!mediaItems.find(m => m.id === selectedImage?.id)?.tags?.length) && exifData.keywords && exifData.keywords.length > 0 ? (
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted flex items-center gap-1">
                                <Tag size={12}/> Keywords (EXIF)
                              </label>
                              <div className="flex flex-wrap gap-1">
                                {exifData.keywords.map((keyword, idx) => (
                                  <span key={idx} className="bg-accent-soft border border-blue-700/50 text-accent text-xs px-2 py-0.5 rounded flex items-center gap-1">
                                    {keyword}
                                    <button className="hover:text-primary">
                                      <X size={10}/>
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted">Inga keywords hittades i EXIF.</p>
                          )}

                          {/* Metadata */}
                          {exifData.metadata && Object.keys(exifData.metadata).length > 0 && (
                              <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-muted flex items-center gap-1">
                                      <Info size={12}/> Metadata
                                  </label>
                                  <div className="bg-background border border-subtle rounded p-2 text-xs space-y-1">
                                      {exifData.metadata.date_taken && (
                                          <div><span className="text-muted">Datum:</span> <span className="text-secondary">{exifData.metadata.date_taken}</span></div>
                                      )}
                                      {exifData.metadata.title && (
                                          <div><span className="text-muted">Titel:</span> <span className="text-secondary">{exifData.metadata.title}</span></div>
                                      )}
                                      {exifData.metadata.description && (
                                          <div><span className="text-muted">Beskrivning:</span> <span className="text-secondary">{exifData.metadata.description}</span></div>
                                      )}
                                      {exifData.metadata.artist && (
                                          <div><span className="text-muted">Artist:</span> <span className="text-secondary">{exifData.metadata.artist}</span></div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {/* GPS */}
                          {exifData.gps && (
                              <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-muted flex items-center gap-1">
                                      <MapPin size={12}/> GPS-koordinater
                                  </label>
                                  <div className="bg-background border border-subtle rounded p-2 text-xs">
                                      <div className="text-secondary font-mono">
                                          {exifData.gps.latitude.toFixed(6)}, {exifData.gps.longitude.toFixed(6)}
                                      </div>
                                      {exifData.gps.altitude && (
                                          <div className="text-muted text-[10px] mt-1">
                                              Höjd: {exifData.gps.altitude.toFixed(0)}m
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="text-center py-4 text-muted text-xs">
                          Laddar EXIF-data automatiskt...
                      </div>
                  )}
              </div>
          </div>
          
          <div className="p-4 border-t border-subtle bg-background flex justify-between items-center">
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
                  className="bg-accent hover:bg-accent text-on-accent px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02]"
              >
                  <Save size={14}/> Spara
              </button>
          </div>
      </div>
      ) : (
          <div className="w-96 bg-surface border-l border-subtle flex flex-col shrink-0 z-20 shadow-xl p-4">
              <p className="text-muted text-sm">Välj en bild</p>
          </div>
      )}

      {/* OCR RESULT MODAL */}
      {showOcrModal && <OcrResultModal 
        isOpen={showOcrModal}
        image={safeDisplayImage}
        ocrResult={ocrResult}
        setOcrResult={setOcrResult}
        onClose={() => {
          setShowOcrModal(false);
          setOcrResult('');
        }}
        onSave={handleSaveOCRResult}
      />}

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
        imageMeta={selectedImage}
        regions={selectedImage?.faces || []}
        onSaveRegions={(newRegions) => {
          if (selectedImage) {
              updateMedia((prev) => prev.map(item => 
                item.id === selectedImage.id 
                  ? { ...item, faces: newRegions }
                  : item
              ));
              setSelectedImage((prev) => prev ? { ...prev, faces: newRegions } : prev);
          }
        }}
        onSaveImageMeta={(metaPatch) => {
          if (!selectedImage || !metaPatch) return;
          updateMedia(prev => prev.map(item =>
            item.id === selectedImage.id
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
          ));
          setSelectedImage(prev => prev ? {
            ...prev,
            name: metaPatch.name ?? prev.name,
            description: metaPatch.description ?? prev.description,
            note: metaPatch.note ?? prev.note,
            tags: metaPatch.tags ?? prev.tags,
            photographer: metaPatch.photographer ?? prev.photographer,
            creator: metaPatch.creator ?? prev.creator
          } : prev);
        }}
        people={allPeople}
        onOpenEditModal={onOpenEditModal}
        onSaveEditedImage={({ mode, url, name, filePath }) => {
          if (!selectedImage) return;

          if (mode === 'overwrite') {
            updateMedia((prev) => prev.map((item) =>
              item.id === selectedImage.id
                ? {
                    ...item,
                    ...(url ? { url } : {}),
                    ...(name ? { name } : {}),
                    ...(filePath ? { filePath } : {})
                  }
                : item
            ));

            setSelectedImage((prev) => prev ? {
              ...prev,
              ...(url ? { url } : {}),
              ...(name ? { name } : {}),
              ...(filePath ? { filePath } : {})
            } : prev);
            return;
          }

          const newId = Date.now();
          const copied = {
            ...selectedImage,
            id: newId,
            url: url || selectedImage.url,
            name: name || `${selectedImage.name || 'bild'}_redigerad.jpg`,
            filePath: filePath || selectedImage.filePath,
            date: new Date().toISOString().split('T')[0]
          };
          updateMedia((prev) => [...prev, copied]);
        }}
      />

      {/* Context Menu */}
      {contextMenuOpen && (
        <div 
          className="fixed bg-background border border-strong rounded-lg shadow-2xl py-1 z-[10000]"
          style={{ 
            left: `${contextMenuPos.x}px`, 
            top: `${contextMenuPos.y}px` 
          }}
        >
          <button
            onClick={() => performAction('tag')}
            className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
          >
            <ScanFace size={16} />
            Tagga
          </button>
          <button
            onClick={() => performAction('edit')}
            className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
          >
            <Edit2 size={16} />
            Redigera bild
          </button>
          <button
            onClick={() => performAction('rotate')}
            className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-surface flex items-center gap-2"
          >
            <RotateCw size={16} />
            Rotera
          </button>
          <button
            onClick={() => performAction('delete')}
            className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2"
          >
            <Trash2 size={16} />
            Ta bort
          </button>
        </div>
      )}
    </div>
    </>
  );
}