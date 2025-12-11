import React, { useState, useEffect, useRef } from 'react';
import Button from './Button.jsx';
import ImageViewer from './ImageViewer.jsx';
import TagInput from './TagInput.jsx';

// Helper: Konvertera till säkert datum (Robust fix för DD MON YYYY eller YYYY-MM-DD)
const toISODate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const cleanStr = dateStr.trim().toUpperCase().replace(/[\/\.]/g, ' ');

    const monthMap = { 
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAJ': '05', 'JUN': '06', 
        'JUL': '07', 'MÅN': '07', 'AUG': '08', 'SEP': '09', 'OKT': '10', 'NOV': '11', 'DEC': '12' 
    };

    const dmYMatch = cleanStr.match(/^(\d{1,2})\s+(\w{3,4})\s+(\d{4})$/);
    if (dmYMatch) {
        const day = dmYMatch[1];
        const monthKey = dmYMatch[2].substring(0, 3);
        const year = dmYMatch[3];
        const month = monthMap[monthKey] || null;

        if (day && month && year) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
        }
    }
    
    const isoMatch = dateStr.match(/^(\d{4})[-\/\s]?(\d{1,2})[-\/\/\s]?(\d{1,2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    return dateStr;
};


export default function ImageGallery({ source, onEditSource, people, onOpenEditModal }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [previews, setPreviews] = useState({});
  const [viewerOpen, setViewerOpen] = useState(false);

  const images = source?.images || []; 

  // --- LADDA TUMNAGLAR (Oförändrad) ---
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
                } catch (err) { console.warn("Kunde inte ladda preview:", img.src); }
            }
        }
    };
    if (images.length > 0) loadPreviews();
    return () => { isMounted = false; };
  }, [images]);

  // --- UPPLADDNING (Dubblett-kontroll borttagen) ---
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
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
            src: relativePath, title: file.name.split('.')[0],
            date: '', note: '', tags: '', format: file.type.split('/')[1] || 'jpg',
            regions: []
          });
        } else { 
            alert(`Kunde inte spara ${file.name}: ${result?.error}`); 
        }
      } catch (err) { console.error("Fel vid filhantering:", err); }
    }
    if (newImages.length > 0) {
      const updatedImages = [...(source.images || []), ...newImages]; 
      onEditSource({ images: updatedImages });
      setSelectedImageIndex((source.images || []).length); 
    }
    setUploading(false);
  };

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  };
  
  // FIX: Förbättrad onPaste hantering (ShareX/Clipboard)
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

  // --- REDIGERING & DATUMFIX (Oförändrad) ---
  const handleImageUpdate = (field, value) => {
    if (selectedImageIndex === null || selectedImageIndex >= images.length) return;
    
    const updatedImages = [...images];
    updatedImages[selectedImageIndex] = { ...updatedImages[selectedImageIndex], [field]: value };
    onEditSource({ images: updatedImages });
  };
  
  const handleDateBlur = (e) => {
      if (selectedImageIndex === null || selectedImageIndex >= images.length) return;
      const dateString = e.target.value;
      const standardizedDate = toISODate(dateString);
      
      if (standardizedDate !== dateString) {
          handleImageUpdate('date', standardizedDate); 
      }
  };

  const handleDeleteImage = () => {
    if (selectedImageIndex === null) return;
    if (confirm('Ta bort bildlänken?')) {
      const updatedImages = images.filter((_, i) => i !== selectedImageIndex);
      onEditSource({ images: updatedImages });
      setSelectedImageIndex(null);
    }
  };

  const openInternalViewer = () => { if (selectedImageIndex !== null) setViewerOpen(true); };
  const handlePrev = () => {
    setSelectedImageIndex((idx) => {
      if (idx === null) return idx;
      return Math.max(0, idx - 1);
    });
  };
  const handleNext = () => {
    setSelectedImageIndex((idx) => {
      if (idx === null) return idx;
      return Math.min(images.length - 1, idx + 1);
    });
  };
  const selectedImg = selectedImageIndex !== null ? images[selectedImageIndex] : null;

  return (
    <div className="flex h-full gap-4 outline-none" onPaste={onPaste} tabIndex="0"> 
      
      <ImageViewer 
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        imageSrc={selectedImg?.src}
        imageTitle={selectedImg?.title}
        regions={selectedImg?.regions || []}
        onSaveRegions={(newRegions) => handleImageUpdate('regions', newRegions)}
        people={people}
        onOpenEditModal={onOpenEditModal}
        onPrev={handlePrev}
        onNext={handleNext}
        hasPrev={selectedImageIndex > 0}
        hasNext={selectedImageIndex !== null && selectedImageIndex < images.length - 1}
      />

      {/* VÄNSTER: BILDLISTA (Oförändrad) */}
      <div className={`flex-1 border-2 border-dashed rounded-lg overflow-y-auto p-4 transition-colors relative min-h-[300px] ${isDragging ? 'border-blue-500 bg-blue-900' : 'border-slate-600 bg-slate-800'}`}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      >
          {images.length === 0 && !uploading && (<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none"><p className="text-lg font-semibold">Dra och släpp bilder här</p><p className="text-sm">eller klistra in (Ctrl+V)</p></div>)}
          {uploading && (<div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10"><p className="text-blue-400 font-bold animate-pulse">Sparar bilder...</p></div>)}
          <div className="flex flex-col gap-3">
            {images.map((img, idx) => {
              // Hämta kopplade personer för denna bild
              const linkedPeople = Array.isArray(img.regions) && people ? img.regions.map(region => {
                const p = people.find(pp => pp.id === region.personId);
                if (!p) return null;
                // Hämta födelse/död
                const getYear = (type) => {
                  const evt = p.events?.find(e => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
                  return evt?.date ? evt.date.substring(0, 10) : '';
                };
                const b = getYear('BIRT');
                const d = getYear('DEAT');
                const life = (b || d) ? `(${b}-${d})` : '';
                return { ...p, life };
              }).filter(Boolean) : [];
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div onClick={() => setSelectedImageIndex(idx)} onDoubleClick={openInternalViewer} className={`cursor-pointer rounded border-2 overflow-hidden relative group bg-slate-900 shadow-sm aspect-square w-32 h-32 flex-shrink-0 flex items-center justify-center ${selectedImageIndex === idx ? 'border-blue-600 ring-2 ring-blue-600' : 'border-transparent hover:border-slate-600'}`}>
                    {previews[img.src] ? (
                      <img src={previews[img.src]} alt={typeof img.title === 'string' ? img.title : ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-400 text-xs p-2 text-center break-all">
                        <span className="text-2xl block mb-1">🖼️</span>{typeof img.src === 'string' ? img.src.split('/').pop() : ''}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">{typeof img.title === 'string' ? img.title : 'Namnlös'}</div>
                  </div>
                  {/* Kopplade personer till höger */}
                  <div className="flex flex-wrap gap-1 items-center min-h-[2rem]">
                    {linkedPeople.length > 0 ? linkedPeople.map(person => (
                      <span key={person.id} className="bg-green-600 hover:bg-green-700 text-white text-xs rounded-full px-3 py-0.5 font-semibold shadow flex items-center" title={`REF: ${person.refNumber} ${person.firstName} ${person.lastName} ${person.life}`}
                        style={{pointerEvents:'none'}}>
                        REF: {person.refNumber} {person.firstName} {person.lastName} {person.life}
                      </span>
                    )) : <span className="text-slate-400 text-xs italic">Ingen person taggad</span>}
                  </div>
                </div>
              );
            })}
            <label className="cursor-pointer border-2 border-dashed border-slate-600 rounded flex flex-col items-center justify-center aspect-square w-32 h-32 hover:bg-slate-700 hover:border-blue-400 transition-colors bg-slate-800 mt-2">
              <span className="text-3xl text-slate-300 mb-1">+</span>
              <span className="text-xs text-slate-400 font-medium">+ lägg till</span>
              <span className="text-xs text-slate-400 mt-1">ctrl+v</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e.target.files)} />
            </label>
          </div>
      </div>

      {/* HÖGER: METADATA (Oförändrad) */}
      {selectedImg ? (
          <div className="w-1/3 bg-slate-800 border-l border-slate-700 pl-4 flex flex-col gap-3 overflow-y-auto">
              <h3 className="font-bold text-slate-300 text-sm border-b border-slate-700 pb-2">Bildinformation</h3>
              <div><label className="block text-xs font-bold text-slate-300 uppercase mb-1">Titel</label><input className="w-full border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200" value={selectedImg.title || ''} onChange={(e) => handleImageUpdate('title', e.target.value)} /></div>
              <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Datum</label>
                  <input className="w-full border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200" placeholder="ÅÅÅÅ-MM-DD" value={selectedImg.date || ''} 
                    onChange={(e) => handleImageUpdate('date', e.target.value)}
                    onBlur={handleDateBlur} 
                  />
              </div>
              <div><label className="block text-xs font-bold text-slate-300 uppercase mb-1">Taggar</label><TagInput value={selectedImg.tags || ''} onChange={(newValue) => handleImageUpdate('tags', newValue)} placeholder="Semester, Bröllop..." /></div>
              <div className="flex-1 min-h-[100px]"><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notering</label><textarea className="w-full border rounded px-2 py-1 text-sm h-full resize-none bg-slate-900 border-slate-700 text-slate-200 focus:bg-slate-800" value={selectedImg.note || ''} onChange={(e) => handleImageUpdate('note', e.target.value)} /></div>
              {/* Visa taggade personer */}
              {Array.isArray(selectedImg.regions) && selectedImg.regions.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-bold text-slate-300 uppercase mb-1">Taggade personer</div>
                  <ul className="space-y-1">
                    {selectedImg.regions.map((region, idx) => {
                      const person = people?.find(p => p.id === region.personId);
                      return person ? (
                        <li key={region.personId + '-' + idx} className="text-sm text-slate-300 flex items-center gap-2">
                          <span className="font-semibold">{person.firstName} {person.lastName}</span>
                          <span className="text-xs text-slate-400">(REF: {person.refNumber})</span>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              )}
              <div className="pt-2 border-t flex flex-col gap-2">
                  <Button onClick={openInternalViewer} variant="primary" size="sm" className="w-full">Öppna & Tagga</Button>
                  <Button onClick={handleDeleteImage} variant="ghost_danger" size="sm" className="w-full">Ta bort bild</Button>
              </div>
          </div>
      ) : (<div className="w-1/3 flex items-center justify-center text-slate-400 text-xs italic border-l border-slate-700 bg-slate-800">Välj en bild för att redigera detaljer</div>)}
    </div>
  );
}