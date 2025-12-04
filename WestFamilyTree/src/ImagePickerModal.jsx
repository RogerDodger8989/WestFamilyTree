import React, { useState, useRef, useEffect } from 'react';
import { useApp } from './AppContext';

// Modal for picking images to link to an event

export default function ImagePickerModal({ isOpen, allSources, alreadyLinkedImageIds = [], onSelectImages, onClose }) {
  const { setDbData } = useApp();
  const [selected, setSelected] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  // Always show latest images from allSources
  const images = allSources.flatMap(src =>
    (src.images || []).map(img => ({ ...img, sourceId: src.id, sourceTitle: src.title }))
  );

  // Load previews (like ImageGallery)
  useEffect(() => {
    let isMounted = true;
    const loadPreviews = async () => {
      for (const img of images) {
        if (!previews[img.src]) {
          try {
            const data = await window.electronAPI.readFile(img.src);
            if (data && !data.error && isMounted) {
              const blob = new Blob([data]);
              const url = URL.createObjectURL(blob);
              setPreviews(prev => ({ ...prev, [img.src]: url }));
            }
          } catch (err) { /* ignore */ }
        }
      }
    };
    if (images.length > 0) loadPreviews();
    return () => { isMounted = false; };
    // eslint-disable-next-line
  }, [images.length]);

  if (!isOpen) return null;

  const handleToggle = (imgId) => {
    setSelected(sel => sel.includes(imgId) ? sel.filter(id => id !== imgId) : [...sel, imgId]);
  };

  const handleConfirm = () => {
    onSelectImages(selected);
    onClose();
  };

  // --- Upload logic (like ImageGallery) ---
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let targetSource = allSources.find(s => s.archiveTop === 'Övrigt') || allSources[0];
    if (!targetSource) {
      alert('Ingen källa att spara bilder i. Skapa en källa först.');
      setUploading(false);
      return;
    }
    const newImages = [];
    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const relativePath = `diverse/${Date.now()}_${safeName}`;
        const result = await window.electronAPI.saveFile(relativePath, uint8Array);
        if (result && result.success) {
          newImages.push({
            src: relativePath,
            title: file.name.split('.')[0],
            date: '', note: '', tags: '', format: file.type.split('/')[1] || 'jpg',
            regions: []
          });
        } else {
          alert(`Kunde inte spara ${file.name}: ${result?.error}`);
        }
      } catch (err) { /* ignore */ }
    }
    if (newImages.length > 0) {
      setDbData(prev => ({
        ...prev,
        sources: prev.sources.map(src =>
          src.id === targetSource.id ? { ...src, images: [...(src.images || []), ...newImages] } : src
        )
      }));
    }
    setUploading(false);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  };
  const onPaste = (e) => {
    if (e.clipboardData && e.clipboardData.files.length > 0) {
      handleFileUpload(e.clipboardData.files);
    } else if (e.clipboardData && e.clipboardData.items) {
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find(item => item.type.indexOf('image') !== -1);
      if (imageItem) {
        const blob = imageItem.getAsFile();
        if (blob) {
          const file = new File([blob], `clipboard_image_${Date.now()}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
          handleFileUpload([file]);
        }
      }
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40`} tabIndex={0}>
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-6 max-w-2xl w-full">
        <h2 className="text-lg font-bold mb-4">Välj bilder att koppla</h2>
        <div
          className={`border-2 border-dashed rounded-lg overflow-y-auto p-4 transition-colors relative min-h-[300px] ${isDragging ? 'border-blue-500 bg-blue-900' : 'border-slate-600 bg-slate-800'}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onPaste={onPaste}
        >
          {images.length === 0 && !uploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none select-none">
              <div className="flex flex-col items-center mb-4">
                <span className="text-3xl">+</span>
                <span className="text-base font-medium">+ lägg till</span>
                <span className="text-xs text-slate-400 mt-1">ctrl+v</span>
              </div>
              <div className="text-lg font-semibold">Dra och släpp bilder här</div>
              <div className="text-sm">eller klistra in (Ctrl+V)</div>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
              <p className="text-blue-600 font-bold animate-pulse">Sparar bilder...</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {/* Add button always visible */}
            <label className="cursor-pointer border-2 border-dashed border-slate-600 rounded flex flex-col items-center justify-center aspect-square w-32 h-32 hover:bg-slate-700 hover:border-blue-400 transition-colors bg-slate-800 mb-2">
              <span className="text-3xl text-slate-300 mb-1">+</span>
              <span className="text-xs text-slate-400 font-medium">+ lägg till</span>
              <span className="text-xs text-slate-400 mt-1">ctrl+v</span>
              <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={e => handleFileUpload(e.target.files)} />
            </label>
            {images.map(img => (
              <div key={img.id || img.src} className={`border rounded p-2 flex flex-col items-center w-32 ${selected.includes(img.id || img.src) ? 'border-blue-500 bg-blue-900' : 'border-slate-700 bg-slate-900'} cursor-pointer relative`}
                   onClick={() => handleToggle(img.id || img.src)}>
                {previews[img.src] ? (
                  <img src={previews[img.src]} alt={img.title || ''} className="w-24 h-24 object-cover rounded mb-2" />
                ) : (
                  <div className="w-24 h-24 flex items-center justify-center text-slate-400 bg-slate-700 rounded mb-2">🖼️</div>
                )}
                <div className="text-xs text-slate-300 truncate w-full text-center">{img.title || img.src.split('/').pop()}</div>
                <div className="text-[10px] text-slate-400">{img.sourceTitle}</div>
                {alreadyLinkedImageIds.includes(img.id || img.src) && <div className="text-green-600 text-xs font-bold mt-1">Redan kopplad</div>}
                {selected.includes(img.id || img.src) && <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">✓</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-slate-200 rounded hover:bg-slate-600">Avbryt</button>
          <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={selected.length === 0}>Koppla valda</button>
        </div>
      </div>
    </div>
  );
}
