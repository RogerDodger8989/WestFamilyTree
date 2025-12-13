import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Minus, Maximize2, Minimize2, Layers, 
  MapPin, Search, Image as ImageIcon, CheckSquare, 
  Trash2, User as UserIcon, AlertCircle, Calendar,
  Monitor, Settings, UploadCloud
} from 'lucide-react';

// Global tracker för vilket WindowFrame som är aktivt
let activeWindowFrameId = null;
const windowFrameListeners = new Set();

// Knapp för bibliotek som kan ta emot drops (Förenklad för fixen)
const LibraryButton = ({ lib, isActive, onClick }) => {
    const LibraryIcon = lib.icon; 
    return (
        <div 
            className={`group flex items-center gap-1 rounded px-2 py-1 transition-colors relative 
                ${isActive ? 'bg-blue-600/20 text-blue-100' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
            `}
            onClick={onClick}
        >
            <button className="flex-1 flex items-center gap-3 text-sm truncate w-full text-left py-1.5">
                <LibraryIcon size={16} className={isActive ? 'text-blue-400' : 'text-slate-500'} /> 
                {lib.label}
            </button>
        </div>
    );
};

// --- HUVUDKOMPONENT: WindowFrame ---

export function WindowFrame({ windowId, children, title, icon: Icon = Layers, initialWidth = 1000, initialHeight = 700, onClose, zIndex = null, isActive = true, onActivate }) {
  
  // Generera unikt ID för detta WindowFrame om inget windowId ges
  const internalIdRef = useRef(windowId || `wf-${Date.now()}-${Math.random()}`);
  const internalId = internalIdRef.current;
  
  // Fönsterhanteringslogik (Local Storage, drag, resize, maximize/minimize)
  const localStorageKey = `windowState:${title.replace(/\s/g, '')}`; 
  const getInitialState = () => {
    try {
      const savedState = JSON.parse(localStorage.getItem(localStorageKey));
      if (savedState) {
        return {
          x: savedState.x || 100, y: savedState.y || 50,
          width: Math.max(600, savedState.width || initialWidth),
          height: Math.max(400, savedState.height || initialHeight),
          isMaximized: false, isMinimized: false
        };
      }
    } catch (e) { /* Ignorera fel vid läsning av localStorage */ }
    return { x: 100, y: 50, width: initialWidth, height: initialHeight, isMaximized: false, isMinimized: false };
  };

  const [winState, setWinState] = useState(getInitialState);

  const isDraggingWindow = useRef(false);
  const isResizingWindow = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const startSize = useRef({ w: 0, h: 0, x: 0, y: 0 });
  const dragTimeout = useRef(null);
  
  // --- FOOTER STATE MANAGEMENT ---
  const [footerContent, setFooterContent] = useState(null);
  const setDynamicFooter = (content) => {
    setFooterContent(content);
  };

  const saveState = (state) => {
    if (!state.isMaximized && !state.isMinimized) {
        const stateToSave = { x: state.x, y: state.y, width: state.width, height: state.height };
        localStorage.setItem(localStorageKey, JSON.stringify(stateToSave));
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingWindow.current && !winState.isMaximized) {
        setWinState(prev => {
            const newState = { ...prev, x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y };
            clearTimeout(dragTimeout.current);
            dragTimeout.current = setTimeout(() => saveState(newState), 50);
            return newState;
        });
      }
      if (isResizingWindow.current && !winState.isMaximized) {
        setWinState(prev => {
            const newState = { ...prev, width: Math.max(600, startSize.current.w + (e.clientX - startSize.current.x)), height: Math.max(400, startSize.current.h + (e.clientY - startSize.current.y)) };
            clearTimeout(dragTimeout.current);
            dragTimeout.current = setTimeout(() => saveState(newState), 50);
            return newState;
        });
      }
    };
    
    const handleMouseUp = () => {
      if (isDraggingWindow.current || isResizingWindow.current) {
        isDraggingWindow.current = false;
        isResizingWindow.current = false;
        saveState(winState);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      clearTimeout(dragTimeout.current);
    };
  }, [winState.isMaximized, winState.x, winState.y, winState.width, winState.height]);

  // Sätt detta WindowFrame som aktivt när det monteras
  useEffect(() => {
    activeWindowFrameId = internalId;
    if (onActivate) onActivate();
    
    return () => {
      if (activeWindowFrameId === internalId) {
        activeWindowFrameId = null;
      }
    };
  }, []);

  // ESC-tangent stänger fönstret (bara om detta är det aktiva fönstret)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeWindowFrameId === internalId) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    
    // Använd capture phase för att fånga eventet före andra listeners
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose, internalId]);

  const startDrag = (e) => {
    if (winState.isMaximized || winState.isMinimized) return;
    isDraggingWindow.current = true;
    dragOffset.current = { x: e.clientX - winState.x, y: e.clientY - winState.y };
  };

  const startResize = (e) => {
    e.stopPropagation(); 
    if (winState.isMaximized || winState.isMinimized) return;
    isResizingWindow.current = true;
    startSize.current = { w: winState.width, h: winState.height, x: e.clientX, y: e.clientY };
  };

  const toggleMaximize = () => {
    setWinState(prev => {
        const newState = { ...prev, isMaximized: !prev.isMaximized, isMinimized: false };
        saveState(newState); 
        return newState;
    });
  };

  const toggleMinimize = () => {
    setWinState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  };
  
  const handleOverlayClick = (e) => {
      if (e.target === e.currentTarget && !winState.isMaximized) {
          onClose();
      }
  };

  const windowStyle = winState.isMaximized 
    ? { top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0 }
    : winState.isMinimized 
        ? { bottom: 10, left: 10, width: 250, height: 40, overflow: 'hidden' } 
        : { top: winState.y, left: winState.x, width: winState.width, height: winState.height };

  const effectiveZIndex = zIndex !== null ? zIndex : 5000;

  return (
    <div className={`fixed z-[5000] inset-0`} style={{ zIndex: effectiveZIndex }} onMouseDown={handleOverlayClick} >
        
        {/* WINDOW CONTAINER */}
        <div className={`bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ease-out 
             ${winState.isMaximized ? '' : 'rounded-xl'}`}
             style={{ ...windowStyle, position: 'fixed' }}
             onMouseDown={(e) => {
               e.stopPropagation();
               activeWindowFrameId = internalId;
               if (onActivate) onActivate();
             }} 
        >
        
            {/* WINDOW HEADER */}
            <div 
                className="bg-slate-900 border-b border-slate-800 p-2 flex justify-between items-center select-none cursor-grab active:cursor-grabbing"
                onMouseDown={startDrag}
                onDoubleClick={toggleMaximize} 
            >
                <div className="flex items-center gap-2 text-slate-300 text-sm font-bold pl-2">
                    <Icon size={16}/> {title}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={toggleMinimize} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Minimera"><Minus size={16}/></button>
                    <button onClick={toggleMaximize} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title={winState.isMaximized ? "Återställ" : "Maximera"}>
                        {winState.isMaximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                    </button>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400" title="Stäng"><X size={16}/></button>
                </div>
            </div>

            {/* CONTENT */}
            {!winState.isMinimized && (
                <>
                    <div className="flex-1 overflow-hidden">
                        {/* children klonas för att injicera setDynamicFooter funktionen */}
                        {React.isValidElement(children) && typeof children.type === 'function'
                            ? React.cloneElement(children, { setDynamicFooter: setDynamicFooter })
                            : children
                        }
                    </div>

                    {/* FOOTER - DYNAMISKT BLOCK */}
                    <div className="h-8 bg-slate-900 border-t border-slate-700 flex items-center px-4 text-xs text-slate-400 justify-between shrink-0">
                        {footerContent ? (
                            footerContent
                        ) : (
                            <span className="flex items-center gap-2">
                                <Settings size={12} className="text-slate-500"/>
                                Redo.
                            </span>
                        )}
                        <span className="text-slate-600">
                             {winState.width} x {winState.height} px
                        </span>
                    </div>
                </>
            )}
            
            {/* RESIZE HANDLE */}
            {!winState.isMaximized && !winState.isMinimized && (
                <div 
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center"
                  onMouseDown={startResize}
                >
                  <div className="w-2 h-2 bg-slate-500 rounded-full"/>
                </div>
            )}
        </div>
        
        {/* Scrollbar CSS FIX */}
        <style dangerouslySetInnerHTML={{__html: `
            .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; border: 2px solid #0f172a; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        `}} />
    </div>
  );
}

export default WindowFrame;
