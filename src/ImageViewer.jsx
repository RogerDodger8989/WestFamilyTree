import React, { useState, useEffect, useRef, useCallback } from 'react';
import WindowFrame from './WindowFrame';
import Button from './Button';
import LinkPersonModal from './LinkPersonModal';

// --- HJÄLPFUNKTIONER ---
function getLifeRange(person) {
    const getDate = (type) => {
        const evt = person.events?.find(e => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
        const date = evt?.date || '????'; 
        return date.substring(0, 4) === '????' ? '????' : date.substring(0, 4);
    };
    const b = getDate('BIRT');
    const d = getDate('DEAT');
    if (b === '????' && d === '????') return '';
    return `${b}-${d}`;
}

// --- UNDERKOMPONENT FÖR RESIZE/DRAG (Fixad med useCallback) ---
const RegionComponent = React.memo(({ region, idx, people, onStartEdit, onStopEdit, onRegionChange, onDelete, onOpenPerson }) => {
    const [isResizing, setIsResizing] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const startPoint = useRef({ x: 0, y: 0 });
    const startRegion = useRef(null);
    const containerRef = useRef(null);
    
    // Hitta personinfo för visning
    const person = people?.find(p => p.id === region.personId);
    const lifeSpan = person ? getLifeRange(person) : '';
    const labelText = person ? `Ref ${person.refNumber} ${person.firstName} ${person.lastName} ${lifeSpan}`.trim() : region.label;

    // Fix: Använd useCallback för att stabilisera funktionerna som används som globala event listeners
    const handleMouseUp = useCallback(() => {
        if (isMoving || isResizing) {
            onStopEdit();
            setIsMoving(false);
            setIsResizing(false);
        }
    }, [isMoving, isResizing, onStopEdit]);

    const handleMouseMove = useCallback((e) => {
        if (!isMoving && !isResizing) return;

        const dx = e.clientX - startPoint.current.x;
        const dy = e.clientY - startPoint.current.y;
        
        const rect = containerRef.current.parentElement.getBoundingClientRect(); 

        const dxPct = (dx / rect.width) * 100;
        const dyPct = (dy / rect.height) * 100;

        let newRegion = { ...startRegion.current };
        let { x, y, w, h } = startRegion.current;

        if (isMoving) {
            newRegion.x = Math.max(0, Math.min(100 - w, x + dxPct));
            newRegion.y = Math.max(0, Math.min(100 - h, y + dyPct));
        } else if (isResizing) {
            
            let newX = x, newY = y, newW = w, newH = h;
            
            // Hantera skalning
            if (isResizing.includes('r')) { newW = Math.max(1, w + dxPct); }
            if (isResizing.includes('b')) { newH = Math.max(1, h + dyPct); }
            
            if (isResizing.includes('l')) { 
                const attemptX = x + dxPct;
                const attemptW = w - dxPct;
                if (attemptW > 1 && attemptX >= 0) {
                    newX = attemptX;
                    newW = attemptW;
                } else if (attemptW <= 1) {
                    newW = 1;
                }
            }
            if (isResizing.includes('t')) { 
                const attemptY = y + dyPct;
                const attemptH = h - dyPct;
                if (attemptH > 1 && attemptY >= 0) {
                    newY = attemptY;
                    newH = attemptH;
                } else if (attemptH <= 1) {
                    newH = 1;
                }
            }

            // Preserve all region properties (personId, label, etc.)
            newRegion = { ...startRegion.current, x: newX, y: newY, w: newW, h: newH };
        }
        
        onRegionChange(idx, newRegion);
    }, [isMoving, isResizing, onRegionChange, idx]); // Inkludera alla beroenden

    const handleMouseDown = (e, type) => {
        e.stopPropagation();
        onStartEdit(idx);
        startPoint.current = { x: e.clientX, y: e.clientY };
        startRegion.current = { ...region };

        if (type === 'move') {
            setIsMoving(true);
        } else {
            setIsResizing(type);
        }
    };
    
    // Använder globala lyssnare för att inte tappa draget utanför regionen
    useEffect(() => {
        if (isMoving || isResizing) {
            // FIX: Använder stabila referenser från useCallback
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isMoving, isResizing, handleMouseMove, handleMouseUp]);


    return (
        <div 
            ref={containerRef}
            className="absolute border-2 border-green-400 group hover:bg-green-400/20 transition-colors"
            style={{ 
                left: `${region.x}%`, top: `${region.y}%`, 
                width: `${region.w}%`, height: `${region.h}%`,
                cursor: (isMoving || isResizing) ? 'grabbing' : 'move',
                zIndex: (isMoving || isResizing) ? 2 : 1
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
            title={labelText}
        >
            <div className="absolute bottom-full left-0 bg-green-600 text-white text-xs px-2 py-0.5 whitespace-nowrap rounded-t opacity-0 group-hover:opacity-100 flex items-center transition-opacity pointer-events-none group-hover:pointer-events-auto">
                <span className="pointer-events-none">{labelText}</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(idx); }}
                    className="ml-2 text-red-200 hover:text-white font-bold leading-none pointer-events-auto"
                    title="Ta bort tagg"
                >
                    ×
                </button>
            </div>
            
            {/* RESIZE HANDLES (Dragpunkter) */}
            {['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'].map(side => (
                <div
                    key={side}
                    className="absolute bg-green-500 w-2 h-2 rounded-full border border-white opacity-0 group-hover:opacity-100"
                    style={{
                        top: side.includes('t') ? '-4px' : (side.includes('b') ? 'calc(100% - 4px)' : '50%'),
                        left: side.includes('l') ? '-4px' : (side.includes('r') ? 'calc(100% - 4px)' : '50%'),
                        cursor: `${side.replace('t', 'n').replace('b', 's').replace('l', 'w').replace('r', 'e')}-resize`,
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, side)}
                />
            ))}
        </div>
    );
});


// --- HUVUDKOMPONENT: ImageViewer ---

export default function ImageViewer({ 
    isOpen, 
    onClose, 
    imageSrc, 
    imageTitle, 
    regions = [],
    onSaveRegions,
    people,
    onOpenEditModal,
    onPrev,
    onNext,
    hasPrev = false,
    hasNext = false,
    connections = {}
}) {
    // ... (resten av koden är oförändrad)
    const [blobUrl, setBlobUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState(null);
    const [currentBox, setCurrentBox] = useState(null);
    const [showLinkModal, setShowLinkModal] = useState(false); 
    const [editingRegion, setEditingRegion] = useState(null); 
    const isInteracting = isDragging || isPanning || editingRegion !== null;
    const imgRef = useRef(null);
    
    useEffect(() => {
        if (isOpen && imageSrc) {
            setLoading(true); setError(null);
            setZoomLevel(1.0); setPanOffset({ x: 0, y: 0 }); // Återställ zoom och pan
            
            // Check if it's an HTTP URL, blob URL, or data URL
            if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://') || 
                imageSrc.startsWith('blob:') || imageSrc.startsWith('data:')) {
                // For HTTP URLs, blob URLs, or data URLs, use directly
                setBlobUrl(imageSrc);
                setLoading(false);
                // Vänta tills bilden laddats och mät storlek
                setTimeout(() => {
                    if (imgRef.current) {
                        const img = imgRef.current;
                        const container = img.parentElement;
                        if (container) {
                            const imgW = img.naturalWidth;
                            const imgH = img.naturalHeight;
                            const contW = container.clientWidth;
                            const contH = container.clientHeight;
                            if (imgW && imgH && contW && contH) {
                                const scaleW = contW / imgW;
                                const scaleH = contH / imgH;
                                const fitZoom = Math.min(scaleW, scaleH, 1);
                                setZoomLevel(fitZoom);
                                setPanOffset({ x: 0, y: 0 });
                            }
                        }
                    }
                }, 50);
            } else {
                // For local files, use Electron API (om den finns)
                if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
                    window.electronAPI.readFile(imageSrc)
                        .then(data => {
                            if (data && !data.error) {
                                const blob = new Blob([data]);
                                const url = URL.createObjectURL(blob);
                                setBlobUrl(url);
                            // Vänta tills bilden laddats och mät storlek
                            setTimeout(() => {
                                if (imgRef.current) {
                                    const img = imgRef.current;
                                    const container = img.parentElement;
                                    if (container) {
                                        const imgW = img.naturalWidth;
                                        const imgH = img.naturalHeight;
                                        const contW = container.clientWidth;
                                        const contH = container.clientHeight;
                                        if (imgW && imgH && contW && contH) {
                                            const scaleW = contW / imgW;
                                            const scaleH = contH / imgH;
                                            const fitZoom = Math.min(scaleW, scaleH, 1);
                                            setZoomLevel(fitZoom);
                                            setPanOffset({ x: 0, y: 0 });
                                        }
                                    }
                                }
                            }, 50);
                            } else { setError("Kunde inte läsa in bilden."); }
                        })
                        .catch(err => setError(err.message))
                        .finally(() => setLoading(false));
                } else {
                    // Fallback: försök använda direkt om Electron API inte finns
                    setBlobUrl(imageSrc);
                    setLoading(false);
                }
            }
        }
        return () => {
            if (blobUrl && !blobUrl.startsWith('http') && !blobUrl.startsWith('blob') && !blobUrl.startsWith('data')) {
                URL.revokeObjectURL(blobUrl);
            }
            setBlobUrl(null);
            setIsDrawing(false);
            setEditingRegion(null);
        };
    }, [isOpen, imageSrc]);

    // Tangentbordsnavigering: vänster/höger
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'ArrowLeft' && hasPrev && onPrev) { e.preventDefault(); onPrev(); }
            if (e.key === 'ArrowRight' && hasNext && onNext) { e.preventDefault(); onNext(); }
            if (e.key === 'Escape') { onClose && onClose(); }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, hasPrev, hasNext, onPrev, onNext, onClose]);

    const handlePanStart = (e) => {
        if (showLinkModal || e.button !== 0 || isDrawing || editingRegion !== null || zoomLevel === 1) return;
        e.preventDefault();
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleZoom = (e) => {
        if (showLinkModal) return;
        e.preventDefault();
        const delta = e.deltaY * -0.01;
        const newZoom = Math.min(Math.max(1, zoomLevel + delta), 4);
        setZoomLevel(newZoom);
    };

    const handleMouseDown = (e) => {
        if (showLinkModal || isPanning || editingRegion !== null || !isDrawing || e.target !== imgRef.current) return;
        e.preventDefault();
        const rect = imgRef.current.getBoundingClientRect();
        // Ta hänsyn till zoom och pan
        const container = imgRef.current.parentElement;
        const contRect = container.getBoundingClientRect();
        const offsetX = (e.clientX - contRect.left - panOffset.x * zoomLevel) / (rect.width * zoomLevel) * 100;
        const offsetY = (e.clientY - contRect.top - panOffset.y * zoomLevel) / (rect.height * zoomLevel) * 100;
        const x = Math.max(0, Math.min(100, offsetX));
        const y = Math.max(0, Math.min(100, offsetY));
        setStartPos({ x, y });
        setCurrentBox({ x, y, w: 0, h: 0 });
        setIsDragging(true);
    };

    const handleMouseMove = (e) => {
        if (showLinkModal) return;
        if (isPanning) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            setPanOffset(prev => ({ x: prev.x + dx / zoomLevel, y: prev.y + dy / zoomLevel }));
            panStart.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (!isDrawing || !startPos || !imgRef.current || !isDragging) return;
        const rect = imgRef.current.getBoundingClientRect();
        const container = imgRef.current.parentElement;
        const contRect = container.getBoundingClientRect();
        const currentX = (e.clientX - contRect.left - panOffset.x * zoomLevel) / (rect.width * zoomLevel) * 100;
        const currentY = (e.clientY - contRect.top - panOffset.y * zoomLevel) / (rect.height * zoomLevel) * 100;

        const x = Math.max(0, Math.min(100, Math.min(startPos.x, currentX)));
        const y = Math.max(0, Math.min(100, Math.min(startPos.y, currentY)));
        const w = Math.abs(currentX - startPos.x);
        const h = Math.abs(currentY - startPos.y);

        setCurrentBox({ x, y, w, h });
    };

    const handleMouseUp = () => {
        if (showLinkModal) return;
        if (isPanning) { setIsPanning(false); return; }
        if (editingRegion !== null) { setEditingRegion(null); return; }

        if (!isDrawing || !isDragging) return;
        setIsDragging(false);

        if (!currentBox || currentBox.w < 1 || currentBox.h < 1) {
            setStartPos(null);
            setCurrentBox(null);
            return;
        }
        
        setShowLinkModal(true);
    };

    const handlePersonSelected = (personId, eventId) => {
        // For face tagging, we only care about personId, ignore eventId
        // Check if person is already tagged
        if (regions.some(r => r.personId === personId)) {
            alert('Denna person är redan taggad på bilden!');
            setShowLinkModal(false);
            setCurrentBox(null);
            setStartPos(null);
            return;
        }
        
        const person = people.find(p => p.id === personId);
        if (!person) return;
        const newRegion = {
            ...currentBox,
            personId: person.id,
            label: `${person.firstName} ${person.lastName}`,
            refNumber: person.refNumber
        };
        const updatedRegions = [...regions, newRegion];
        onSaveRegions(updatedRegions);
        setShowLinkModal(false);
        setCurrentBox(null);
        setStartPos(null);
    };
    
    const handleDeleteRegion = (index) => {
        if(confirm("Ta bort tagg?")) {
            const updated = regions.filter((_, i) => i !== index);
            onSaveRegions(updated);
        }
    };
    
    // --- REDIGERING AV REGION ---
    const handleRegionChange = (index, newRegion) => {
        const updatedRegions = regions.map((r, i) => i === index ? newRegion : r);
        onSaveRegions(updatedRegions);
    };

    const handleStartRegionEdit = (index) => {
        setEditingRegion(index);
        setIsDrawing(false); 
    };
    
    const handleStopRegionEdit = () => {
        setEditingRegion(null);
    };

    // --- Sidopanel data ---
    // Kombinera personer från regions (ansiktstagging) och connections.people
    const allConnectedPeople = new Map();
    
    // Lägg till personer från regions (ansiktstagging)
    regions.forEach(region => {
        const person = people.find(p => p.id === region.personId);
        if (person && !allConnectedPeople.has(person.id)) {
            allConnectedPeople.set(person.id, {
                ...person,
                lifeRange: getLifeRange(person),
                region,
                source: 'tagged' // Ansiktstagging
            });
        }
    });
    
    // Lägg till personer från connections.people
    if (connections.people && Array.isArray(connections.people)) {
        connections.people.forEach(conn => {
            // Hantera både objekt ({id, name, ...}) och strängar (bara id)
            const personId = typeof conn === 'string' ? conn : (conn?.id || conn);
            const person = people.find(p => p.id === personId);
            if (person && !allConnectedPeople.has(person.id)) {
                allConnectedPeople.set(person.id, {
                    ...person,
                    lifeRange: getLifeRange(person),
                    source: 'connected' // Kopplad via connections
                });
            }
        });
    }
    
    const taggedPeopleWithDetails = Array.from(allConnectedPeople.values());


    if (!isOpen) return null;

    return (
        <>
            <LinkPersonModal 
                isOpen={showLinkModal}
                onClose={() => { setShowLinkModal(false); setCurrentBox(null); }}
                people={people}
                onLink={handlePersonSelected}
                skipEventSelection={true}
                excludePersonIds={regions.map(r => r.personId).filter(Boolean)}
                zIndex={6000}
            />

            <WindowFrame
                title={imageTitle || "Bildvisare"}
                onClose={onClose}
                initialWidth={1000}
                initialHeight={800}
            >
                <div className="flex flex-col h-full bg-slate-900 relative">
                    <div 
                        className="flex-1 flex overflow-hidden relative" 
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                    >
                        {/* VÄNSTER: BILDOMRÅDE (Flex-1) */}
                        <div 
                            className={`flex-1 flex items-center justify-center overflow-hidden p-4 relative ${isInteracting ? 'cursor-grabbing' : ''}`}
                            onWheel={handleZoom}
                        >
                            {loading && <span className="text-white animate-pulse">Laddar bild...</span>}
                            {error && (<div className="text-red-400 font-bold">Fel: {error}</div>)}

                            {blobUrl && !loading && (
                                <div className="relative inline-block"
                                    style={{
                                        cursor: isDrawing ? 'crosshair' : (zoomLevel > 1 && editingRegion === null ? (isPanning ? 'grabbing' : 'grab') : 'default'),
                                        transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                                        transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                                        transformOrigin: 'center center',
                                        maxWidth: '100%', maxHeight: '100%' 
                                    }}
                                    onMouseDown={handlePanStart}
                                >
                                    <img 
                                        ref={imgRef}
                                        src={blobUrl} 
                                        alt={imageTitle} 
                                        className="max-w-full max-h-full block select-none pointer-events-auto"
                                        onMouseDown={handleMouseDown} 
                                        onDragStart={(e) => e.preventDefault()}
                                    />
                                    
                                    {/* RENDERAR REDIGERBARA BOXAR */}
                                    {regions.map((r, idx) => (
                                        <RegionComponent
                                            key={r.personId + idx}
                                            region={r}
                                            idx={idx}
                                            people={people}
                                            onStartEdit={handleStartRegionEdit}
                                            onStopEdit={handleStopRegionEdit}
                                            onRegionChange={handleRegionChange}
                                            onDelete={handleDeleteRegion}
                                            onOpenPerson={onOpenEditModal}
                                        />
                                    ))}

                                    {/* RITAD BOX (UNDER CREATION) */}
                                    {currentBox && (
                                        <div 
                                            className="absolute border-2 border-blue-400 bg-blue-400/20"
                                            style={{ 
                                                left: `${currentBox.x}%`, top: `${currentBox.y}%`, 
                                                width: `${currentBox.w}%`, height: `${currentBox.h}%` 
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* HÖGER: SIDOPANEL MED TAGGAR */}
                        {taggedPeopleWithDetails.length > 0 && (
                            <div className="w-64 bg-slate-800 p-4 shrink-0 overflow-y-auto text-white border-l border-slate-700">
                                <h4 className="text-sm font-bold border-b border-slate-700 pb-2 mb-2">
                                    Taggade personer ({taggedPeopleWithDetails.length})
                                </h4>
                                <ul className="space-y-3 text-xs">
                                    {taggedPeopleWithDetails.map((person, idx) => (
                                        <li key={idx} className="pb-3 border-b border-slate-700">
                                            <div className="text-slate-400">Ref {person.refNumber}</div>
                                            <button 
                                                className="text-blue-300 hover:text-blue-100 hover:underline font-bold text-left block"
                                                onClick={() => onOpenEditModal && onOpenEditModal(person.id)}
                                                title={`Öppna redigering för ${person.firstName} ${person.lastName}`}
                                            >
                                                {person.firstName} {person.lastName}
                                            </button>
                                            <div className="text-slate-400">{person.lifeRange}</div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* VERKTYGSFÄLT */}
                    <div className="bg-slate-800 p-3 border-t border-slate-700 flex justify-between items-center shrink-0">
                        <div className="text-slate-400 text-xs flex gap-4">
                            {isDrawing ? "Klicka och dra en ruta för att tagga en person." : `${taggedPeopleWithDetails.length} personer kopplade.`}
                            {zoomLevel > 1 && <span className="text-sm text-white">Zoom: {Math.round(zoomLevel * 100)}%</span>}
                        </div>
                        <div className="flex gap-2 items-center">
                            <Button onClick={() => setIsDrawing(s => !s)} variant={isDrawing ? "danger" : "primary"} size="sm" disabled={editingRegion !== null}>
                                {isDrawing ? "Avbryt Taggning" : "🔍 Tagga ansikten"}
                            </Button>
                            <Button onClick={() => setZoomLevel(1.0)} disabled={zoomLevel === 1.0} variant="secondary" size="sm">Återställ zoom</Button>
                            <Button onClick={onPrev} disabled={!hasPrev} variant="secondary" size="sm">◀</Button>
                            <Button onClick={onNext} disabled={!hasNext} variant="secondary" size="sm">▶</Button>
                            <Button onClick={onClose} variant="danger" size="sm">Avbryt</Button>
                            <Button onClick={onClose} variant="primary" size="sm">OK</Button>
                        </div>
                    </div>
                </div>
            </WindowFrame>
        </>
    );
}