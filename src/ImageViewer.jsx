import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import WindowFrame from './WindowFrame';
import Button from './Button';
import LinkPersonModal from './LinkPersonModal';
import MediaImage from './components/MediaImage.jsx';
import { getAvatarImageStyle } from './imageUtils.js';
import { Search, Pencil, Trash2, Eye, EyeOff, UserPlus, X } from 'lucide-react';

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
const RegionComponent = React.memo(({ region, idx, people, isHighlighted, onStartEdit, onStopEdit, onRegionChange, onDelete }) => {
    const [isResizing, setIsResizing] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const startPoint = useRef({ x: 0, y: 0 });
    const startRegion = useRef(null);
    const containerRef = useRef(null);
    
    // Hitta personinfo för visning
    const person = people?.find(p => p.id === region.personId);
    const lifeSpan = person ? getLifeRange(person) : '';
    const personName = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : String(region.label || '').trim();
    const refText = person?.refNumber ? `Ref ${person.refNumber}` : '';
    const labelText = [refText, personName, lifeSpan].filter(Boolean).join(' ').trim() || 'Okänd person';

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
            className={`absolute border-2 group transition-colors ${isHighlighted ? 'border-success bg-success/20 shadow-[0_0_0_2px_rgba(16,185,129,0.4)]' : 'border-success hover:bg-success/20'}`}
            style={{ 
                left: `${region.x}%`, top: `${region.y}%`, 
                width: `${region.w}%`, height: `${region.h}%`,
                cursor: (isMoving || isResizing) ? 'grabbing' : 'move',
                zIndex: (isMoving || isResizing) ? 2 : 1
            }}
            onMouseDown={(e) => handleMouseDown(e, 'move')}
        >
            <div className={`absolute top-full left-0 mt-1 text-[9px] px-1.5 py-0.5 rounded text-primary pointer-events-none ${isHighlighted ? 'bg-success/95' : 'bg-background/70'}`}>
                {labelText}
            </div>
            
            {/* RESIZE HANDLES (Dragpunkter) */}
            {['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'].map(side => (
                <div
                    key={side}
                    className="absolute bg-success w-2 h-2 rounded-full border border-strong opacity-0 group-hover:opacity-100"
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
    connections = {},
    imageMeta = null,
    onSaveImageMeta = null
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
    const [editingTagIndex, setEditingTagIndex] = useState(null);
    const [hoveredRegionIndex, setHoveredRegionIndex] = useState(null);
    const [personSearchTerm, setPersonSearchTerm] = useState('');
    const [showFaceBoxes, setShowFaceBoxes] = useState(true);
    const [metaTitle, setMetaTitle] = useState('');
    const [metaDescription, setMetaDescription] = useState('');
    const [minZoom, setMinZoom] = useState(0.1);
    const [baseImageSize, setBaseImageSize] = useState({ w: 0, h: 0 });
    const [saveStatus, setSaveStatus] = useState('');
    const isInteracting = isDragging || isPanning || editingRegion !== null;
    const imgRef = useRef(null);
    const viewerContainerRef = useRef(null);
    const pendingBoxRef = useRef(null);
    const saveStatusTimeoutRef = useRef(null);

    const samePersonId = useCallback((a, b) => String(a ?? '') === String(b ?? ''), []);

    const getPersonDisplayName = useCallback((person) => {
        if (!person) return '';
        return `${person.lastName || ''}, ${person.firstName || ''}`.replace(/^,\s*/, '').trim();
    }, []);

    const getPersonLifeYears = useCallback((person) => {
        if (!person) return '';
        const getYear = (type) => {
            const evt = person.events?.find(e => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
            const date = evt?.date || '';
            return date ? String(date).substring(0, 4) : '?';
        };
        const birthYear = getYear('BIRT');
        const deathYear = getYear('DEAT');
        if (birthYear === '?' && deathYear === '?') return '';
        return `${birthYear}-${deathYear}`;
    }, []);

    const applyFitToScreen = useCallback(() => {
        if (!imgRef.current) return;
        const img = imgRef.current;
        const container = viewerContainerRef.current || img.parentElement;
        if (!container) return;

        const imgW = img.naturalWidth || 0;
        const imgH = img.naturalHeight || 0;
        const contW = container.clientWidth || 0;
        const contH = container.clientHeight || 0;
        if (!imgW || !imgH || !contW || !contH) return;

        const scaleW = contW / imgW;
        const scaleH = contH / imgH;
        const fitScale = Math.max(0.05, Math.min(scaleW, scaleH));
        setBaseImageSize({ w: imgW * fitScale, h: imgH * fitScale });
        setZoomLevel(1);
        setMinZoom(0.25);
        setPanOffset({ x: 0, y: 0 });
    }, []);

    const normalizeImageKey = useCallback((value) => {
        if (!value) return '';
        return String(value)
            .replace(/^media:\/\//, '')
            .replace(/^file:\/\//, '')
            .replace(/\\/g, '/')
            .toLowerCase();
    }, []);

    const activeImageKeys = useMemo(() => {
        const keys = [
            imageSrc,
            imageMeta?.id,
            imageMeta?.filePath,
            imageMeta?.path,
            imageMeta?.url,
            imageMeta?.name,
            imageTitle
        ]
            .map(normalizeImageKey)
            .filter(Boolean);
        return new Set(keys);
    }, [imageSrc, imageMeta?.id, imageMeta?.filePath, imageMeta?.path, imageMeta?.url, imageMeta?.name, imageTitle, normalizeImageKey]);

    const personHasCurrentImage = useCallback((person) => {
        if (!person || !Array.isArray(person.media) || !person.media.length) return false;
        return person.media.some((m) => {
            const candidateKeys = [m?.id, m?.filePath, m?.path, m?.url, m?.name]
                .map(normalizeImageKey)
                .filter(Boolean);
            return candidateKeys.some((k) => activeImageKeys.has(k));
        });
    }, [activeImageKeys, normalizeImageKey]);

    const getRenderedImageRect = useCallback(() => {
        if (!imgRef.current) return null;
        const rect = imgRef.current.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return rect;
    }, []);

    const getPointerPositionPercent = useCallback((clientX, clientY) => {
        const rect = getRenderedImageRect();
        if (!rect) return null;
        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;
        return {
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y))
        };
    }, [getRenderedImageRect]);
    
    useEffect(() => {
        if (isOpen && imageSrc) {
            setLoading(true); setError(null);
            setZoomLevel(1.0); setPanOffset({ x: 0, y: 0 }); // Återställ zoom och pan
            setCurrentBox(null);
            setStartPos(null);
            setIsDrawing(false);
            setShowFaceBoxes(true);
            
            // Check if it's an HTTP URL, blob URL, or data URL
            if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://') || 
                imageSrc.startsWith('blob:') || imageSrc.startsWith('data:')) {
                // For HTTP URLs, blob URLs, or data URLs, use directly
                setBlobUrl(imageSrc);
                setLoading(false);
            } else {
                // For local files, use Electron API (om den finns)
                if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
                    window.electronAPI.readFile(imageSrc)
                        .then(data => {
                            if (data && !data.error) {
                                const blob = new Blob([data]);
                                const url = URL.createObjectURL(blob);
                                setBlobUrl(url);
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

    useEffect(() => {
        if (!isOpen || !blobUrl) return;
        const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(() => {
                applyFitToScreen();
            });
            return () => cancelAnimationFrame(raf2);
        });
        return () => cancelAnimationFrame(raf1);
    }, [blobUrl, isOpen, applyFitToScreen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleResize = () => applyFitToScreen();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isOpen, applyFitToScreen]);

    useEffect(() => {
        if (!isOpen) return;
        setMetaTitle(String(imageMeta?.name || imageTitle || ''));
        setMetaDescription(String(imageMeta?.description || imageMeta?.note || ''));
    }, [isOpen, imageMeta?.id, imageMeta?.name, imageMeta?.description, imageMeta?.note, imageTitle]);

    useEffect(() => {
        if (!isOpen || typeof onSaveImageMeta !== 'function') return;
        const timer = setTimeout(() => {
            onSaveImageMeta({
                name: metaTitle,
                description: metaDescription,
                note: metaDescription
            });
            setSaveStatus('saved');
            if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus('');
            }, 2000);
        }, 220);
        return () => {
            clearTimeout(timer);
            if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
        };
    }, [metaTitle, metaDescription, onSaveImageMeta, isOpen]);

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
        if (showLinkModal || e.button !== 0 || isDrawing || editingRegion !== null) return;
        e.preventDefault();
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY };
    };

    const handleZoom = (e) => {
        if (showLinkModal) return;
        e.preventDefault();
        const zoomFactor = Math.exp(-e.deltaY * 0.002);
        const newZoom = Math.min(Math.max(minZoom, zoomLevel * zoomFactor), 8);
        setZoomLevel(newZoom);
    };

    const handleMouseDown = (e) => {
        if (showLinkModal || isPanning || editingRegion !== null || !isDrawing || e.target !== imgRef.current) return;
        e.preventDefault();
        const pointer = getPointerPositionPercent(e.clientX, e.clientY);
        if (!pointer) return;
        const { x, y } = pointer;
        setStartPos({ x, y });
        setCurrentBox({ x, y, w: 0, h: 0 });
        pendingBoxRef.current = { x, y, w: 0, h: 0 };
        setIsDragging(true);
    };

    const handleMouseMove = (e) => {
        if (showLinkModal) return;
        if (isPanning) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;
            setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            panStart.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (!isDrawing || !startPos || !imgRef.current || !isDragging) return;
        const pointer = getPointerPositionPercent(e.clientX, e.clientY);
        if (!pointer) return;
        const currentX = pointer.x;
        const currentY = pointer.y;

        const x = Math.max(0, Math.min(100, Math.min(startPos.x, currentX)));
        const y = Math.max(0, Math.min(100, Math.min(startPos.y, currentY)));
        const w = Math.abs(currentX - startPos.x);
        const h = Math.abs(currentY - startPos.y);

        setCurrentBox({ x, y, w, h });
        pendingBoxRef.current = { x, y, w, h };
    };

    const handleMouseUp = useCallback(() => {
        if (showLinkModal) return;
        if (isPanning) { setIsPanning(false); return; }
        if (editingRegion !== null) { setEditingRegion(null); return; }

        if (!isDrawing || !isDragging) return;
        setIsDragging(false);

        if (!currentBox || currentBox.w < 1 || currentBox.h < 1) {
            setStartPos(null);
            setCurrentBox(null);
            pendingBoxRef.current = null;
            return;
        }
    }, [showLinkModal, isPanning, editingRegion, isDrawing, isDragging, currentBox]);

    useEffect(() => {
        if (!isDragging && !isPanning) return;
        const onGlobalMouseUp = () => {
            handleMouseUp();
        };
        window.addEventListener('mouseup', onGlobalMouseUp);
        return () => window.removeEventListener('mouseup', onGlobalMouseUp);
    }, [isDragging, isPanning, handleMouseUp]);

    const handlePersonSelected = (personId, eventId) => {
        // For face tagging, we only care about personId, ignore eventId
        const selectedPersonId = String(personId ?? '');

        const draftBox = currentBox || pendingBoxRef.current;
        if (editingTagIndex === null && (!draftBox || draftBox.w < 1 || draftBox.h < 1)) {
            return;
        }

        // Check if person is already tagged
        if (editingTagIndex === null && regions.some(r => samePersonId(r.personId, selectedPersonId))) {
            alert('Denna person är redan taggad på bilden!');
            setShowLinkModal(false);
            setCurrentBox(null);
            setStartPos(null);
            pendingBoxRef.current = null;
            return;
        }
        
        const person = people.find(p => samePersonId(p.id, selectedPersonId));
        if (!person) return;

        if (editingTagIndex !== null) {
            const updatedRegions = regions.map((region, index) => {
                if (index !== editingTagIndex) return region;
                return {
                    ...region,
                    personId: person.id,
                    label: `${person.firstName} ${person.lastName}`.trim() || region.label,
                    refNumber: person.refNumber
                };
            });
            onSaveRegions(updatedRegions);
            setEditingTagIndex(null);
            setShowLinkModal(false);
            return;
        }

        const newRegion = {
            ...draftBox,
            personId: person.id,
            label: `${person.firstName} ${person.lastName}`,
            refNumber: person.refNumber
        };
        const updatedRegions = [...regions, newRegion];
        onSaveRegions(updatedRegions);
        setShowLinkModal(false);
        setCurrentBox(null);
        setStartPos(null);
        pendingBoxRef.current = null;
    };
    
    const handleDeleteRegion = (index) => {
        if(confirm("Ta bort tagg?")) {
            const updated = regions.filter((_, i) => i !== index);
            onSaveRegions(updated);
        }
    };

    const handleReassignRegionPerson = (regionIndex, personId) => {
        const person = people.find(p => samePersonId(p.id, personId));
        if (!person) return;
        const updatedRegions = regions.map((region, idx) => {
            if (idx !== regionIndex) return region;
            return {
                ...region,
                personId: person.id,
                label: `${person.firstName} ${person.lastName}`.trim() || region.label,
                refNumber: person.refNumber
            };
        });
        onSaveRegions(updatedRegions);
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

    const regionsWithDetails = regions.map((region, index) => {
        const person = people.find(p => p.id === region.personId);
        return {
            ...region,
            index,
            person,
            personName: person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : String(region.label || 'Okänd person').trim(),
            refNumber: person?.refNumber || region.refNumber || '',
            lifeRange: person ? getLifeRange(person) : ''
        };
    });

    const filteredPeople = useMemo(() => {
        const query = personSearchTerm.trim().toLowerCase();
        const base = people.filter((p) => {
            if (!query) return true;
            const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
            const revName = `${p.lastName || ''}, ${p.firstName || ''}`.toLowerCase();
            const ref = String(p.refNumber || '').toLowerCase();
            return fullName.includes(query) || revName.includes(query) || ref.includes(query);
        });

        return [...base].sort((a, b) => {
            const aHas = personHasCurrentImage(a) ? 1 : 0;
            const bHas = personHasCurrentImage(b) ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
            return getPersonDisplayName(a).localeCompare(getPersonDisplayName(b), 'sv');
        });
    }, [people, personSearchTerm, personHasCurrentImage, getPersonDisplayName]);


    if (!isOpen) return null;

    return (
        <>
            <LinkPersonModal 
                isOpen={showLinkModal}
                onClose={() => {
                    setShowLinkModal(false);
                    setEditingTagIndex(null);
                    if (editingTagIndex === null) {
                        setCurrentBox(null);
                    }
                }}
                people={people}
                onLink={handlePersonSelected}
                skipEventSelection={true}
                excludePersonIds={editingTagIndex !== null ? [] : regions.map(r => r.personId).filter(Boolean)}
                zIndex={6000}
            />

            <WindowFrame
                title={imageTitle || "Bildvisare"}
                onClose={onClose}
                initialWidth={1000}
                initialHeight={800}
            >
                <div className="flex flex-col h-full bg-background relative">
                    <div 
                        className="flex-1 flex overflow-hidden relative" 
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                    >
                        {/* VÄNSTER: BILDOMRÅDE (Flex-1) */}
                        <div 
                            ref={viewerContainerRef}
                            className={`flex-1 flex items-center justify-center overflow-hidden p-4 relative ${isInteracting ? 'cursor-grabbing' : ''}`}
                            onWheel={handleZoom}
                        >
                            {loading && <span className="text-primary animate-pulse">Laddar bild...</span>}
                            {error && (<div className="text-warning font-bold">Fel: {error}</div>)}

                            {blobUrl && !loading && (
                                <div className="relative inline-block"
                                    style={{
                                        width: baseImageSize.w > 0 ? `${baseImageSize.w}px` : 'auto',
                                        height: baseImageSize.h > 0 ? `${baseImageSize.h}px` : 'auto',
                                        cursor: isDrawing ? 'crosshair' : (editingRegion === null ? (isPanning ? 'grabbing' : 'grab') : 'default'),
                                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                                        transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                                        transformOrigin: 'center center',
                                        willChange: 'transform'
                                    }}
                                    onMouseDown={handlePanStart}
                                >
                                    <img 
                                        ref={imgRef}
                                        src={blobUrl} 
                                        alt={imageTitle} 
                                        className="block select-none pointer-events-auto w-full h-full"
                                        onLoad={applyFitToScreen}
                                        onMouseDown={handleMouseDown} 
                                        onDragStart={(e) => e.preventDefault()}
                                    />
                                    
                                    {/* RENDERAR REDIGERBARA BOXAR */}
                                    {showFaceBoxes && regions.map((r, idx) => (
                                        <RegionComponent
                                            key={r.personId + idx}
                                            region={r}
                                            idx={idx}
                                            people={people}
                                            isHighlighted={hoveredRegionIndex === idx}
                                            onStartEdit={handleStartRegionEdit}
                                            onStopEdit={handleStopRegionEdit}
                                            onRegionChange={handleRegionChange}
                                            onDelete={handleDeleteRegion}
                                        />
                                    ))}

                                    {/* RITAD BOX (UNDER CREATION) */}
                                    {currentBox && (
                                        <div 
                                            className="absolute border-2 border-strong bg-accent-soft"
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
                        <div className="w-72 bg-surface p-4 shrink-0 overflow-y-auto custom-scrollbar text-primary border-l border-subtle">
                                <div className="mb-4 pb-3 border-b border-subtle">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-bold text-primary">Bildinformation</h4>
                                        <span className="text-[10px] text-secondary italic transition-opacity">
                                            {saveStatus === 'saving' ? 'Sparar...' : saveStatus === 'saved' ? 'Sparat ✓' : ''}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Rubrik</label>
                                            <input
                                                type="text"
                                                value={metaTitle}
                                                onChange={(e) => { setSaveStatus('saving'); setMetaTitle(e.target.value); }}
                                                className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                                                placeholder="Ange rubrik..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Beskrivning / Notis</label>
                                            <textarea
                                                value={metaDescription}
                                                onChange={(e) => { setSaveStatus('saving'); setMetaDescription(e.target.value); }}
                                                className="w-full h-20 bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary resize-none focus:outline-none focus:border-strong"
                                                placeholder="Skriv notis..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <h4 className="text-sm font-bold border-b border-subtle pb-2 mb-2">
                                    Personregister (för ny tagg)
                                </h4>
                                <div className="mb-3">
                                    <label className="block text-[11px] uppercase tracking-wide text-secondary mb-1">Sök person</label>
                                    <div className="relative">
                                        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                                        <input
                                            type="text"
                                            value={personSearchTerm}
                                            onChange={(e) => setPersonSearchTerm(e.target.value)}
                                            placeholder="Namn eller ref..."
                                            className="w-full bg-background border border-subtle rounded pl-7 pr-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                                        />
                                    </div>
                                </div>
                                {currentBox ? (
                                    <div className="mb-3 p-2 rounded border border-success bg-success/20 text-[10px] text-secondary flex items-center justify-between gap-2">
                                        <span>Ny ruta ritad. Välj person nedan.</span>
                                        <button
                                            type="button"
                                            onClick={() => { setCurrentBox(null); setStartPos(null); }}
                                            className="inline-flex items-center justify-center w-5 h-5 rounded border border-success hover:border-success hover:bg-success/40"
                                            title="Avbryt ny tagg"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="mb-3 text-[10px] text-muted">Rita först en ruta på bilden för att skapa ny tagg.</p>
                                )}
                                <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 mb-4 border border-subtle rounded p-1.5 bg-surface-2">
                                    {filteredPeople.slice(0, 60).map((candidate) => {
                                        const candidateName = getPersonDisplayName(candidate) || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
                                        const candidateYears = getPersonLifeYears(candidate);
                                        const candidatePrimaryMedia = Array.isArray(candidate.media) ? candidate.media[0] : null;
                                        const candidateImageUrl = candidatePrimaryMedia ? (candidatePrimaryMedia.url || candidatePrimaryMedia.path) : '';
                                        const hasThisImage = personHasCurrentImage(candidate);
                                        return (
                                            <button
                                                key={candidate.id}
                                                type="button"
                                                disabled={!currentBox}
                                                onClick={() => handlePersonSelected(candidate.id)}
                                                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded border border-subtle hover:border-strong hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed"
                                                title={currentBox ? 'Lägg till som ny tagg' : 'Rita först en ruta på bilden'}
                                            >
                                                <div className="w-7 h-7 rounded-full overflow-hidden border border-subtle bg-surface shrink-0">
                                                    {candidateImageUrl ? (
                                                        <MediaImage
                                                            url={candidateImageUrl}
                                                            alt={candidateName}
                                                            className="w-full h-full object-cover"
                                                            style={getAvatarImageStyle(candidatePrimaryMedia, candidate.id)}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted">?</div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-[10px] text-secondary">Ref {candidate.refNumber || '-'}</div>
                                                    <div className="text-[11px] text-primary truncate">{candidateName}</div>
                                                    {candidateYears && <div className="text-[10px] text-muted">{candidateYears}</div>}
                                                    {hasThisImage && <div className="text-[10px] text-secondary">Har redan denna bild</div>}
                                                </div>
                                                <UserPlus size={12} className="ml-auto text-accent" />
                                            </button>
                                        );
                                    })}
                                </div>

                                <h4 className="text-sm font-bold border-b border-subtle pb-2 mb-2">
                                    Taggade personer ({regionsWithDetails.length})
                                </h4>
                                <ul className="space-y-3 text-xs">
                                    {regionsWithDetails.map((tagRegion) => (
                                        <li
                                            key={`${tagRegion.personId || 'unknown'}_${tagRegion.index}`}
                                            className={`pb-3 border-b border-subtle rounded ${hoveredRegionIndex === tagRegion.index ? 'bg-success/20 border-success' : ''}`}
                                            onMouseEnter={() => setHoveredRegionIndex(tagRegion.index)}
                                            onMouseLeave={() => setHoveredRegionIndex(null)}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className="w-7 h-7 rounded-full overflow-hidden border border-subtle bg-surface shrink-0 mt-0.5">
                                                    {tagRegion.person?.media?.[0] ? (
                                                        <MediaImage
                                                            url={tagRegion.person.media[0].url || tagRegion.person.media[0].path}
                                                            alt={tagRegion.personName}
                                                            className="w-full h-full object-cover"
                                                            style={getAvatarImageStyle(tagRegion.person.media[0], tagRegion.person.id)}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-muted">?</div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-secondary">{tagRegion.refNumber ? `Ref ${tagRegion.refNumber}` : 'Ref saknas'}</div>
                                                    <button 
                                                        className="text-accent hover:text-primary hover:underline font-bold text-left block truncate"
                                                        onClick={() => tagRegion.person && onOpenEditModal && onOpenEditModal(tagRegion.person.id)}
                                                        title={`Öppna redigering för ${tagRegion.personName}`}
                                                    >
                                                        {tagRegion.personName}
                                                    </button>
                                                    {tagRegion.lifeRange && <div className="text-secondary">{tagRegion.lifeRange}</div>}
                                                </div>
                                            </div>
                                            <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-1 items-center">
                                                <select
                                                    value={tagRegion.personId || ''}
                                                    onChange={(e) => handleReassignRegionPerson(tagRegion.index, e.target.value)}
                                                    className="bg-background border border-subtle rounded px-2 py-1 text-[11px] text-primary"
                                                >
                                                    <option value="">Välj person...</option>
                                                    {filteredPeople.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            Ref {p.refNumber || '-'} - {`${p.firstName || ''} ${p.lastName || ''}`.trim() || p.id}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingTagIndex(tagRegion.index);
                                                        setShowLinkModal(true);
                                                    }}
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-subtle text-primary hover:text-accent hover:border-strong"
                                                    title="Byt person med sökdialog"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRegion(tagRegion.index)}
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded border border-strong bg-warning-soft text-warning hover:text-warning hover:border-strong hover:bg-warning-soft/80"
                                                    title="Ta bort tagg"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                    </div>

                    {/* VERKTYGSFÄLT */}
                    <div className="bg-surface p-3 border-t border-subtle flex justify-between items-center shrink-0">
                        <div className="text-secondary text-xs flex gap-4">
                            {isDrawing ? "Klicka och dra en ruta för att tagga en person." : `${regionsWithDetails.length} ansiktstaggar.`}
                            {zoomLevel > 0 && <span className="text-sm text-primary">Zoom: {Math.round(zoomLevel * 100)}%</span>}
                        </div>
                        <div className="flex gap-2 items-center">
                            <Button
                                onClick={() => setShowFaceBoxes((prev) => !prev)}
                                variant="secondary"
                                size="sm"
                                title={showFaceBoxes ? 'Dölj ansiktsboxar' : 'Visa ansiktsboxar'}
                            >
                                {showFaceBoxes ? <EyeOff size={14} /> : <Eye size={14} />}
                            </Button>
                            <Button onClick={() => setIsDrawing(s => !s)} variant={isDrawing ? "danger" : "primary"} size="sm" disabled={editingRegion !== null}>
                                {isDrawing ? "Avbryt Taggning" : "🔍 Tagga ansikten"}
                            </Button>
                            <Button onClick={applyFitToScreen} variant="secondary" size="sm">Anpassa till vy</Button>
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