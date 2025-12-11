import React, { useState, useRef, useEffect } from 'react';

let globalModalZ = 5000;

const DraggableModal = ({ 
  title, 
  onClose, 
  children, 
  initialX, 
  initialY, 
  initialWidth, 
  initialHeight,
  onCancel,
  onConfirm,
  onLink,
  showLinkButton = false,
  showConfirm = true,
  zIndex,
}) => {
  const getStored = (key, def) => {
      const val = localStorage.getItem(key);
      return val ? parseInt(val, 10) : def;
  };

  const startW = initialWidth || getStored('wft_modal_w', 1000);
  const startH = initialHeight || getStored('wft_modal_h', 700);
  const startX = initialX || getStored('wft_modal_x', (window.innerWidth - startW) / 2);
  const startY = initialY || getStored('wft_modal_y', (window.innerHeight - startH) / 2);

  const safeX = Math.max(0, Math.min(startX, window.innerWidth - 100));
  const safeY = Math.max(0, Math.min(startY, window.innerHeight - 100));

  const [bounds, setBounds] = useState({ x: safeX, y: safeY, w: startW, h: startH });
  const [modalZ, setModalZ] = useState(zIndex || globalModalZ);
    // Se till att denna modal alltid får högst z-index när den mountas
    useEffect(() => {
      globalModalZ += 2;
      setModalZ(globalModalZ);
      // Fokusera modalen (t.ex. för screen readers eller tabbning)
      if (modalRef.current) {
        modalRef.current.focus?.();
      }
    }, []);
  
  const modalRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isResizing = useRef(false);

  const saveBounds = () => {
      localStorage.setItem('wft_modal_x', bounds.x);
      localStorage.setItem('wft_modal_y', bounds.y);
      localStorage.setItem('wft_modal_w', bounds.w);
      localStorage.setItem('wft_modal_h', bounds.h);
  };

  const handleMouseDownHeader = (e) => {
    if (e.target.closest('button')) return;
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - bounds.x, y: e.clientY - bounds.y };
    document.body.style.userSelect = 'none';
  };

  const handleMouseDownResize = (e) => {
    e.stopPropagation();
    isResizing.current = true;
    dragOffset.current = { x: e.clientX, y: e.clientY, originalW: bounds.w, originalH: bounds.h };
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging.current) {
        setBounds(prev => ({ ...prev, x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }));
      } else if (isResizing.current) {
        const deltaX = e.clientX - dragOffset.current.x;
        const deltaY = e.clientY - dragOffset.current.y;
        setBounds(prev => ({ ...prev, w: Math.max(500, dragOffset.current.originalW + deltaX), h: Math.max(400, dragOffset.current.originalH + deltaY) }));
      }
    };
    const handleMouseUp = () => {
      if (isDragging.current || isResizing.current) {
          isDragging.current = false;
          isResizing.current = false;
          document.body.style.userSelect = '';
          saveBounds();
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [bounds]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (onCancel) onCancel();
        else if (onClose) onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, onClose]);

  const doClose = (e) => { e.stopPropagation(); if(onClose) onClose(); };
  const doCancel = (e) => { e.stopPropagation(); if(onCancel) onCancel(); else if(onClose) onClose(); };
  const doConfirm = (e) => { e.stopPropagation(); if(onConfirm) onConfirm(); else if(onClose) onClose(); };
  const doLink = (e) => { e.stopPropagation(); if(onLink) onLink(); };

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: modalZ }}>
      <div 
        ref={modalRef}
        className="absolute bg-slate-800 shadow-2xl border border-slate-700 rounded-lg flex flex-col pointer-events-auto overflow-hidden"
        style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h, maxWidth: '100vw', maxHeight: '100vh' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-700 border-b border-slate-600 p-2 flex justify-between items-center cursor-move select-none h-10 shrink-0" onMouseDown={handleMouseDownHeader}>
          <h3 className="font-bold text-slate-200 pl-2 text-sm">{title}</h3>
          <button onClick={doClose} className="text-slate-400 hover:text-red-600 font-bold px-3 py-1 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-hidden relative bg-slate-900">{children}</div>
        <div className="bg-slate-700 border-t border-slate-600 p-3 flex justify-end items-center select-none shrink-0 h-14 relative">
          {/* EditPersonModal-knappar */}
          {title === 'Dennis Persson' || title === 'Redigera person' || title === 'Person' || (typeof title === 'string' && title.toLowerCase().includes('person')) ? (
            <>
              <button onClick={doCancel} className="px-3 py-1 text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 font-semibold mr-2">Avbryt</button>
              <button onClick={(e) => { e.stopPropagation(); if (window.handleSaveChanges) window.handleSaveChanges(); }} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-semibold mr-2">Spara</button>
              <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Ta bort?')) { if (window.handleDeletePerson) window.handleDeletePerson(); doCancel(e); } }} className="px-3 py-1 text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 font-semibold">Ta bort</button>
            </>
          ) : (
            <>
              <button onClick={doCancel} className="px-4 py-1 border border-slate-600 bg-slate-700 text-slate-200 rounded hover:bg-slate-600 text-sm font-medium shadow-sm">Avbryt</button>
              <div className="flex gap-3 mr-4">
                {showLinkButton && (<button onClick={doLink} className="px-5 py-1.5 bg-blue-700 text-white rounded hover:bg-blue-800 text-sm font-bold shadow">Koppla vald källa</button>)}
                {showConfirm && (<button onClick={doConfirm} className="px-5 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold shadow">Bekräfta</button>)}
              </div>
            </>
          )}
          <div className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize" style={{ background: 'linear-gradient(135deg, transparent 50%, #999 50%)', zIndex: 20 }} onMouseDown={handleMouseDownResize} />
        </div>
      </div>
    </div>
  );
};
export default DraggableModal;