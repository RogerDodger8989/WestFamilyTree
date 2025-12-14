import React, { useState, useRef, useEffect } from 'react';
// Cleanup faceMenu when image, isFaceTagMode, or isCropMode changes
// useEffect(() => {
//   setFaceMenu(null);
// }, [image, isFaceTagMode, isCropMode]);
import FaceTagOverlay from './FaceTagOverlay';
import { WindowFrame } from './WindowFrame';
import { RotateCw, ZoomIn, ZoomOut, Maximize2, Save, Image as ImageIcon, ArrowLeft, ArrowRight, XCircle, Trash2, Crop, Repeat, Sun, Contrast, FlipHorizontal, FlipVertical, Grid, RotateCcw, ScanFace } from 'lucide-react';

const ImageEditorModal = ({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  onSave,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onDelete,
  isConfirmingDelete = false,
  enableSaveCopy = true,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [image, setImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Transform state
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fineRotation, setFineRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(1);
  const [contrastLevel, setContrastLevel] = useState(1);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropRect, setCropRect] = useState(null); // {x1,y1,x2,y2} in container coords
  const [isCropping, setIsCropping] = useState(false);
  const cropStartRef = useRef(null);

  // Face tagging state (robust tags)
  const [isFaceTagMode, setIsFaceTagMode] = useState(false);
  const [faceTags, setFaceTags] = useState([]); // {id, x, y, w, h, status, note, personId}
  const [activeTagId, setActiveTagId] = useState(null);
  const [saveAsCopy, setSaveAsCopy] = useState(false);

  // Undo/redo stack
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Helpers for undo/redo
  const captureState = () => ({
    scale,
    rotation,
    fineRotation,
    position,
    brightness,
    contrastLevel,
    flipH,
    flipV
  });

  const applyState = (state) => {
    if (!state) return;
    setScale(state.scale);
    setRotation(state.rotation);
    setFineRotation(state.fineRotation);
    setPosition(state.position);
    setBrightness(state.brightness);
    setContrastLevel(state.contrastLevel);
    setFlipH(state.flipH);
    setFlipV(state.flipV);
  };

  const pushHistory = (nextState = captureState()) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndexRef.current + 1);
      const updated = [...trimmed, nextState];
      const newIndex = updated.length - 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      return updated;
    });
  };

  const initHistory = () => {
    const snap = captureState();
    setHistory([snap]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
  };

  const handleUndo = () => {
    setHistory((prev) => {
      if (historyIndexRef.current <= 0) return prev;
      const newIndex = historyIndexRef.current - 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      applyState(prev[newIndex]);
      return prev;
    });
  };

  const handleRedo = () => {
    setHistory((prev) => {
      if (historyIndexRef.current < 0 || historyIndexRef.current >= prev.length - 1) return prev;
      const newIndex = historyIndexRef.current + 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      applyState(prev[newIndex]);
      return prev;
    });
  };

  // Refit vid fönsterstorleksändring för att behålla proportioner i viewporten
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => fitToWindow();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Rita canvas när transform eller image ändras
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    drawCanvas();
  }, [image, scale, rotation, fineRotation, position, brightness, contrastLevel, flipH, flipV, showGrid]);

  const fitToWindow = (img = image) => {
    if (!img || !containerRef.current) return;
    
    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    
    // Beräkna scale för att passa bilden i containern
    const scaleX = containerW / img.width;
    const scaleY = containerH / img.height;
    const newScale = Math.min(scaleX, scaleY, 1) * 0.9; // 90% av max för padding
    
    setScale(newScale);
    setPosition({ x: 0, y: 0 });
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    // Sätt canvas-storlek till container-storlek
    canvas.width = containerRef.current.clientWidth;
    canvas.height = containerRef.current.clientHeight;
    if (canvas.width === 0 || canvas.height === 0) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Centrera transformationen
    const centerX = canvas.width / 2 + position.x;
    const centerY = canvas.height / 2 + position.y;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(((rotation + fineRotation) * Math.PI) / 180);
    const scaleX = scale * (flipH ? -1 : 1);
    const scaleY = scale * (flipV ? -1 : 1);
    ctx.scale(scaleX, scaleY);
    ctx.filter = `brightness(${brightness}) contrast(${contrastLevel})`;
    
    // Rita bilden centrerad
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    
    if (showGrid) {
      const step = 100;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      for (let x = -image.width; x <= image.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, -image.height);
        ctx.lineTo(x, image.height);
        ctx.stroke();
      }
      for (let y = -image.height; y <= image.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(-image.width, y);
        ctx.lineTo(image.width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,255,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(-image.width, 0);
      ctx.lineTo(image.width, 0);
      ctx.moveTo(0, -image.height);
      ctx.lineTo(0, image.height);
      ctx.stroke();
    }

    ctx.restore();
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    pushHistory();
    setScale(s => Math.max(0.1, Math.min(10, s * delta)));
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (isCropMode) {
      setIsCropping(true);
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cropStartRef.current = { x, y };
      setCropRect({ x1: x, y1: y, x2: x, y2: y });
    } else {
      setIsPanning(true);
      panStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleMouseMove = (e) => {
    if (isCropping) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setCropRect(prev => prev ? { ...prev, x2: x, y2: y } : { x1: x, y1: y, x2: x, y2: y });
      return;
    }
    if (!isPanning) return;
    setPosition({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y
    });
  };

  const handleMouseUp = () => {
    if (isCropping) {
      setIsCropping(false);
      return;
    }
    setIsPanning(false);
  };

  const handleDoubleClick = (e) => {
    // Dubbelklick: zoom in på musposition
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    
    pushHistory();
    setScale(s => Math.min(10, s * 1.5));
    setPosition(p => ({
      x: p.x - mouseX * 0.2,
      y: p.y - mouseY * 0.2
    }));
  };

  const applyRotation = (delta) => {
    pushHistory();
    setRotation(r => (r + delta) % 360);
  };

  const handleRotate = () => applyRotation(90);

  const handleZoomIn = () => {
    pushHistory();
    setScale(s => Math.min(10, s * 1.2));
  };

  const handleZoomOut = () => {
    pushHistory();
    setScale(s => Math.max(0.1, s / 1.2));
  };

  const handleFitToWindow = () => {
    fitToWindow();
  };

  const resetTransforms = () => {
    pushHistory();
    fitToWindow();
    setRotation(0);
    setFineRotation(0);
    setPosition({ x: 0, y: 0 });
    setBrightness(1);
    setContrastLevel(1);
    setFlipH(false);
    setFlipV(false);
  };

  // Load image när modal öppnas
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    
    let currentBlobUrl = null;
    
    const loadImage = async () => {
      try {
        let finalImageUrl = imageUrl;
        
        // Hantera media:// URLs (Electron)
        if (imageUrl && imageUrl.startsWith('media://')) {
          if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
            // Extrahera filvägen från media:// URL
            let filePath = imageUrl.replace('media://', '');
            // Decode URL encoding FÖRST (innan vi gör något annat)
            try {
              filePath = decodeURIComponent(filePath);
            } catch (e) {
              // Om decodeURIComponent misslyckas, försök manuellt
              filePath = filePath.replace(/%2F/g, '/').replace(/%20/g, ' ');
            }
            // Ersätt %2F med / om det fortfarande finns kvar (extra säkerhet)
            filePath = filePath.replace(/%2F/g, '/');
            
            console.log('[ImageEditorModal] Reading file:', filePath, 'from URL:', imageUrl);
            
            const fileData = await window.electronAPI.readFile(filePath);
            
            if (fileData && !fileData.error) {
              // readFile returnerar data på olika sätt - hantera alla fall
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
                try {
                  uint8Array = new Uint8Array(fileData);
                } catch (e) {
                  console.error('[ImageEditorModal] Could not convert fileData to Uint8Array:', e);
                  throw new Error('Kunde inte konvertera bilddata');
                }
              }
              
              // Bestäm MIME-typ baserat på filändelse
              const ext = (imageName || filePath).split('.').pop()?.toLowerCase() || 'png';
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
              finalImageUrl = url;
              console.log('[ImageEditorModal] Image loaded successfully from media://');
            } else {
              console.error('[ImageEditorModal] Error reading file:', fileData?.error);
              throw new Error(fileData?.error || 'Kunde inte läsa filen');
            }
          } else {
            throw new Error('Electron API är inte tillgänglig');
          }
        }
        
        // Ladda bilden
        const img = new Image();
        img.onload = () => {
          setImage(img);
          fitToWindow(img);
          resetTransforms();
          initHistory();
        };
        img.onerror = (e) => {
          console.error('[ImageEditorModal] Error loading image:', e);
          throw new Error('Kunde inte ladda bilden');
        };
        img.src = finalImageUrl;
      } catch (error) {
        console.error('[ImageEditorModal] Error loading image:', error);
        // Visa felmeddelande i UI (kan läggas till senare om behövs)
      }
    };
    
    loadImage();
    
    return () => {
      // Rensa blob URL om den skapades
      if (currentBlobUrl && currentBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [isOpen, imageUrl, imageName]);

  const toggleCropMode = () => {
    setIsCropMode(v => !v);
    setCropRect(null);
  };

  const convertToImageCoords = (x, y) => {
    if (!canvasRef.current || !image) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const centerX = canvas.width / 2 + position.x;
    const centerY = canvas.height / 2 + position.y;
    const dx = x - centerX;
    const dy = y - centerY;
    const angle = -((rotation + fineRotation) * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const sx = scale * (flipH ? -1 : 1);
    const sy = scale * (flipV ? -1 : 1);
    const imgX = rx / sx + image.width / 2;
    const imgY = ry / sy + image.height / 2;
    return {
      x: Math.max(0, Math.min(image.width, imgX)),
      y: Math.max(0, Math.min(image.height, imgY))
    };
  };

  const applyCrop = () => {
    if (!cropRect || !image) return;
    const start = convertToImageCoords(cropRect.x1, cropRect.y1);
    const end = convertToImageCoords(cropRect.x2, cropRect.y2);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.max(10, Math.abs(end.x - start.x));
    const h = Math.max(10, Math.abs(end.y - start.y));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    ctx.drawImage(image, -x, -y);

    const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.95);
    const newImg = new Image();
    newImg.onload = () => {
      pushHistory({
        scale: 1,
        rotation: 0,
        fineRotation: 0,
        position: { x: 0, y: 0 },
        brightness: 1,
        contrastLevel: 1,
        flipH: false,
        flipV: false
      });
      setImage(newImg);
      setCropRect(null);
      setIsCropMode(false);
      setScale(1);
      setRotation(0);
      setFineRotation(0);
      setPosition({ x: 0, y: 0 });
      setBrightness(1);
      setContrastLevel(1);
      setFlipH(false);
      setFlipV(false);
      fitToWindow(newImg);
      initHistory();
    };
    newImg.src = dataUrl;
  };

  const handleSave = async () => {
    if (!canvasRef.current || !image) return;
    
    setIsSaving(true);
    try {
      const angle = (rotation + fineRotation) * Math.PI / 180;
      const absCos = Math.abs(Math.cos(angle));
      const absSin = Math.abs(Math.sin(angle));
      const exportW = Math.ceil(image.width * absCos + image.height * absSin);
      const exportH = Math.ceil(image.width * absSin + image.height * absCos);

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = exportW;
      exportCanvas.height = exportH;
      
      const ctx = exportCanvas.getContext('2d');
      ctx.translate(exportW / 2, exportH / 2);
      ctx.rotate(angle);
      const scaleX = flipH ? -1 : 1;
      const scaleY = flipV ? -1 : 1;
      ctx.scale(scaleX, scaleY);
      ctx.filter = `brightness(${brightness}) contrast(${contrastLevel})`;
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      
      exportCanvas.toBlob((blob) => {
        onSave(blob, saveAsCopy);
        onClose();
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Kunde inte spara bilden: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Tangentbordsnavigering och genvägar
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowRight' && hasNext && onNext) { e.preventDefault(); onNext(); }
      if (e.key === 'Escape' && onClose) { e.preventDefault(); onClose(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'r') { e.preventDefault(); applyRotation(90); }
      if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); handleFitToWindow(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); handleZoomIn(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'x') { e.preventDefault(); handleZoomOut(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'c') { e.preventDefault(); toggleCropMode(); }
      if (e.key === 'Delete' && onDelete) { e.preventDefault(); onDelete(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'h') { e.preventDefault(); resetTransforms(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <WindowFrame
      title={`Redigera: ${imageName}`}
      icon={ImageIcon}
      onClose={onClose}
      initialWidth={Math.min(1400, window.innerWidth * 0.9)}
      initialHeight={Math.min(900, window.innerHeight * 0.9)}
    >
      <div className="flex flex-col h-full bg-slate-900 select-none">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800 shrink-0 select-none">
          <div className="flex items-center gap-2 flex-wrap">
                        <button
                          className={`p-2 ${isFaceTagMode ? 'bg-amber-700 hover:bg-amber-800' : 'bg-slate-700 hover:bg-slate-600'} text-white rounded transition-colors flex items-center gap-1`}
                          title="Face-tagging"
                          onClick={() => setIsFaceTagMode(v => !v)}
                        >
                          <ScanFace size={18} />
                        </button>
            <button onClick={handleZoomIn} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Zooma in (Z)"><ZoomIn size={18} /></button>
            <button onClick={handleZoomOut} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Zooma ut (X)"><ZoomOut size={18} /></button>
            <button onClick={handleFitToWindow} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Anpassa till fönster (F)"><Maximize2 size={18} /></button>
            <button onClick={handleRotate} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Rotera 90° (R)"><RotateCw size={18} /></button>
            <button onClick={() => { pushHistory(); setFlipH(f => !f); }} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Spegla horisontellt"><FlipHorizontal size={18} /></button>
            <button onClick={() => { pushHistory(); setFlipV(f => !f); }} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Spegla vertikalt"><FlipVertical size={18} /></button>
            <button onClick={toggleCropMode} className={`p-2 rounded transition-colors text-white ${isCropMode ? 'bg-amber-700 hover:bg-amber-800' : 'bg-slate-700 hover:bg-slate-600'}`} title="Beskär (C)"><Crop size={18} /></button>
            <button onClick={() => setShowGrid(g => !g)} className={`p-2 rounded transition-colors text-white ${showGrid ? 'bg-green-700 hover:bg-green-800' : 'bg-slate-700 hover:bg-slate-600'}`} title="Rutnät"><Grid size={18} /></button>
            <button onClick={resetTransforms} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Återställ (H)"><Repeat size={18} /></button>
            <button onClick={handleUndo} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Ångra (Ctrl+Z)"><RotateCcw size={18} /></button>
            <button onClick={handleRedo} className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors" title="Gör om (Ctrl+Y)"><RotateCw size={18} /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <span>Finvinkel</span>
              <input type="range" min={-5} max={5} step={0.1} value={fineRotation} onChange={(e) => { pushHistory(); setFineRotation(parseFloat(e.target.value)); }} className="w-32" />
              <span className="w-10 text-right">{fineRotation.toFixed(1)}°</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <Sun size={14} />
              <input type="range" min={0.5} max={1.5} step={0.05} value={brightness} onChange={(e) => { pushHistory(); setBrightness(parseFloat(e.target.value)); }} className="w-24" />
              <span className="w-10 text-right">{Math.round(brightness * 100)}%</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300 text-xs">
              <Contrast size={14} />
              <input type="range" min={0.5} max={1.5} step={0.05} value={contrastLevel} onChange={(e) => { pushHistory(); setContrastLevel(parseFloat(e.target.value)); }} className="w-24" />
              <span className="w-10 text-right">{Math.round(contrastLevel * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Secondary toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800 shrink-0 select-none text-slate-300 text-sm">
          <div className="flex items-center gap-4">
            <span>Zoom: {Math.round(scale * 100)}%</span>
            <span>Rotation: {(rotation + fineRotation).toFixed(1)}°</span>
            {isCropMode && <button onClick={applyCrop} className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded transition-colors text-sm flex items-center gap-1"><Crop size={14}/> Tillämpa beskärning</button>}
            {cropRect && !isCropMode && <span className="text-amber-400">Beskärningsruta finns – aktivera beskärning för att redigera</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPrev && onPrev()}
              disabled={!hasPrev}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded transition-colors font-medium"
              title="Föregående (vänsterpil)"
            >
              <ArrowLeft size={16} />
            </button>
            {/* ...existing code for next, delete, cancel, save... */}
          </div>
        </div>
        {/* (DUPLICATE CANVAS/OVERLAY BLOCK REMOVED) */}
        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden bg-slate-950 relative cursor-move flex items-center justify-center select-none"
          style={{ cursor: isCropMode ? 'crosshair' : isFaceTagMode ? 'crosshair' : 'move' }}
          onWheel={handleWheel}
          onMouseDown={isFaceTagMode ? undefined : handleMouseDown}
          onMouseMove={isFaceTagMode ? undefined : handleMouseMove}
          onMouseUp={isFaceTagMode ? undefined : handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full"
          />
          {isCropMode && cropRect && (
            <div
              className="absolute border-2 border-amber-400 bg-amber-400/10 pointer-events-none"
              style={{
                left: Math.min(cropRect.x1, cropRect.x2),
                top: Math.min(cropRect.y1, cropRect.y2),
                width: Math.abs(cropRect.x2 - cropRect.x1),
                height: Math.abs(cropRect.y2 - cropRect.y1)
              }}
            />
          )}
          {isFaceTagMode && (
            <FaceTagOverlay
              tags={faceTags}
              setTags={setFaceTags}
              activeTagId={activeTagId}
              setActiveTagId={setActiveTagId}
              isTaggingMode={isFaceTagMode}
              containerRef={containerRef}
              scale={scale}
              rotation={rotation + fineRotation}
              position={position}
              flipH={flipH}
              flipV={flipV}
              image={image}
            />
          )}
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 border-t border-slate-700 bg-slate-800 text-slate-400 text-xs shrink-0">
          Tips: Scrolla för zoom, dubbelklick för zoom in, dra för att flytta. Kortkommandon: Z/X zoom, R 90°, F fit, C beskär, H reset, Del ta bort, Ctrl+Z/Y ångra/gör om.
        </div>
      </div>
    </WindowFrame>
  );
};

export default ImageEditorModal;
