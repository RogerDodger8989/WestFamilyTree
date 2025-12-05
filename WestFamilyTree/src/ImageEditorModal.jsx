import React, { useState, useRef, useEffect } from 'react';
import DraggableModal from './DraggableModal';
import { RotateCw, ZoomIn, ZoomOut, Maximize2, Save } from 'lucide-react';

const ImageEditorModal = ({ isOpen, onClose, imageUrl, imageName, onSave }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [image, setImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Transform state
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Load image när modal öppnas
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    
    const img = new Image();
    img.onload = () => {
      setImage(img);
      // Anpassa initial scale så bilden passar i fönstret
      fitToWindow(img);
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Rita canvas när transform eller image ändras
  useEffect(() => {
    if (!image || !canvasRef.current) return;
    drawCanvas();
  }, [image, scale, rotation, position]);

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
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Centrera transformationen
    const centerX = canvas.width / 2 + position.x;
    const centerY = canvas.height / 2 + position.y;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    
    // Rita bilden centrerad
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    
    ctx.restore();
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.max(0.1, Math.min(10, s * delta)));
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click
      setIsPanning(true);
      panStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPosition({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleDoubleClick = (e) => {
    // Dubbelklick: zoom in på musposition
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    
    setScale(s => Math.min(10, s * 1.5));
    setPosition(p => ({
      x: p.x - mouseX * 0.2,
      y: p.y - mouseY * 0.2
    }));
  };

  const handleRotate = () => {
    setRotation(r => (r + 90) % 360);
  };

  const handleZoomIn = () => {
    setScale(s => Math.min(10, s * 1.2));
  };

  const handleZoomOut = () => {
    setScale(s => Math.max(0.1, s / 1.2));
  };

  const handleFitToWindow = () => {
    fitToWindow();
  };

  const handleSave = async () => {
    if (!canvasRef.current || !image) return;
    
    setIsSaving(true);
    try {
      // Skapa en ny canvas med bildens ursprungliga dimensioner (efter rotation)
      const exportCanvas = document.createElement('canvas');
      const isRotated = rotation === 90 || rotation === 270;
      exportCanvas.width = isRotated ? image.height : image.width;
      exportCanvas.height = isRotated ? image.width : image.height;
      
      const ctx = exportCanvas.getContext('2d');
      
      // Rita bilden med rotation
      ctx.translate(exportCanvas.width / 2, exportCanvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      
      // Konvertera till blob
      exportCanvas.toBlob((blob) => {
        onSave(blob, false); // Spara över original
        onClose();
      }, 'image/jpeg', 0.95);
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Kunde inte spara bilden: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <DraggableModal
      title={`Redigera: ${imageName}`}
      onClose={onClose}
      initialWidth={Math.min(1400, window.innerWidth * 0.9)}
      initialHeight={Math.min(900, window.innerHeight * 0.9)}
      showConfirm={false}
    >
      <div className="flex flex-col h-full bg-slate-900">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomIn}
              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title="Zooma in"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title="Zooma ut"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={handleFitToWindow}
              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title="Anpassa till fönster"
            >
              <Maximize2 size={18} />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title="Rotera 90°"
            >
              <RotateCw size={18} />
            </button>
            <div className="text-slate-400 text-sm ml-4">
              Zoom: {Math.round(scale * 100)}% | Rotation: {rotation}°
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded transition-colors font-medium"
          >
            <Save size={18} />
            {isSaving ? 'Sparar...' : 'Spara'}
          </button>
        </div>

        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden bg-slate-950 relative cursor-move"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full"
          />
        </div>

        {/* Info bar */}
        <div className="px-4 py-2 border-t border-slate-700 bg-slate-800 text-slate-400 text-xs shrink-0">
          Tips: Scrolla för zoom, dubbelklick för zoom in, dra för att flytta bilden
        </div>
      </div>
    </DraggableModal>
  );
};

export default ImageEditorModal;
