import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import WindowFrame from './WindowFrame';
import Button from './Button';
import LinkPersonModal from './LinkPersonModal';
import MediaImage from './components/MediaImage.jsx';
import { getAvatarImageStyle } from './imageUtils.js';
import { useApp } from './AppContext';
import {
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Sun,
  Contrast,
  Save,
  Move,
  ScanFace
} from 'lucide-react';

function getLifeRange(person) {
  const getDate = (type) => {
    const evt = person.events?.find((e) => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
    const date = evt?.date || '????';
    return date.substring(0, 4) === '????' ? '????' : date.substring(0, 4);
  };
  const b = getDate('BIRT');
  const d = getDate('DEAT');
  if (b === '????' && d === '????') return '';
  return `${b}-${d}`;
}

function decodeMediaUrlToPath(value) {
  if (!value || typeof value !== 'string') return '';
  if (!value.startsWith('media://')) return '';
  const encoded = value.replace('media://', '');
  try {
    return decodeURIComponent(encoded).replace(/%2F/g, '/');
  } catch (error) {
    return encoded.replace(/%2F/g, '/').replace(/%20/g, ' ');
  }
}

function getMimeTypeFromName(fileName = '') {
  const ext = String(fileName).split('.').pop()?.toLowerCase() || 'jpg';
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff'
  };
  return types[ext] || 'image/jpeg';
}

function normalizeFaceTagFromExif(faceTag) {
  const x = Number(faceTag?.x ?? faceTag?.left ?? 0);
  const y = Number(faceTag?.y ?? faceTag?.top ?? 0);
  const w = Number(faceTag?.w ?? faceTag?.width ?? 0);
  const h = Number(faceTag?.h ?? faceTag?.height ?? 0);

  if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h) || w <= 0 || h <= 0) {
    return null;
  }

  const scaled = {
    x: x <= 1 ? x * 100 : x,
    y: y <= 1 ? y * 100 : y,
    w: w <= 1 ? w * 100 : w,
    h: h <= 1 ? h * 100 : h
  };

  return {
    x: Math.max(0, Math.min(100, scaled.x)),
    y: Math.max(0, Math.min(100, scaled.y)),
    w: Math.max(0.5, Math.min(100, scaled.w)),
    h: Math.max(0.5, Math.min(100, scaled.h)),
    label: String(faceTag?.name || '').trim(),
    personId: faceTag?.personId || null
  };
}

function recalcRegionsAfterCrop(regions, cropRectPercent) {
  const cx = cropRectPercent.x;
  const cy = cropRectPercent.y;
  const cw = cropRectPercent.w;
  const ch = cropRectPercent.h;
  if (cw <= 0 || ch <= 0) return [];

  const cropped = [];
  for (const region of regions || []) {
    const rx1 = Number(region.x);
    const ry1 = Number(region.y);
    const rx2 = Number(region.x) + Number(region.w);
    const ry2 = Number(region.y) + Number(region.h);

    const ix1 = Math.max(rx1, cx);
    const iy1 = Math.max(ry1, cy);
    const ix2 = Math.min(rx2, cx + cw);
    const iy2 = Math.min(ry2, cy + ch);

    if (ix2 <= ix1 || iy2 <= iy1) continue;

    cropped.push({
      ...region,
      x: ((ix1 - cx) / cw) * 100,
      y: ((iy1 - cy) / ch) * 100,
      w: ((ix2 - ix1) / cw) * 100,
      h: ((iy2 - iy1) / ch) * 100
    });
  }

  return cropped;
}

const RegionComponent = React.memo(function RegionComponent({
  region,
  idx,
  people,
  isHighlighted,
  editable,
  onStartEdit,
  onStopEdit,
  onRegionChange,
  onDelete
}) {
  const [isResizing, setIsResizing] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const startRegion = useRef(null);
  const containerRef = useRef(null);

  const person = people?.find((p) => String(p.id) === String(region.personId));
  const lifeSpan = person ? getLifeRange(person) : '';
  const personName = person ? `${person.firstName || ''} ${person.lastName || ''}`.trim() : String(region.label || '').trim();
  const refText = person?.refNumber ? `Ref ${person.refNumber}` : '';
  const labelText = [refText, personName, lifeSpan].filter(Boolean).join(' ').trim() || 'Okänd person';

  const handleMouseUp = useCallback(() => {
    if (isMoving || isResizing) {
      onStopEdit();
      setIsMoving(false);
      setIsResizing(false);
    }
  }, [isMoving, isResizing, onStopEdit]);

  const handleMouseMove = useCallback(
    (e) => {
      if (!isMoving && !isResizing) return;
      const parent = containerRef.current?.parentElement;
      if (!parent) return;

      const dx = e.clientX - startPoint.current.x;
      const dy = e.clientY - startPoint.current.y;
      const rect = parent.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const dxPct = (dx / rect.width) * 100;
      const dyPct = (dy / rect.height) * 100;
      const base = startRegion.current;
      let updated = { ...base };

      if (isMoving) {
        updated.x = Math.max(0, Math.min(100 - base.w, base.x + dxPct));
        updated.y = Math.max(0, Math.min(100 - base.h, base.y + dyPct));
      } else {
        let { x, y, w, h } = base;
        if (isResizing.includes('r')) w = Math.max(1, w + dxPct);
        if (isResizing.includes('b')) h = Math.max(1, h + dyPct);
        if (isResizing.includes('l')) {
          const nx = x + dxPct;
          const nw = w - dxPct;
          if (nw > 1 && nx >= 0) {
            x = nx;
            w = nw;
          }
        }
        if (isResizing.includes('t')) {
          const ny = y + dyPct;
          const nh = h - dyPct;
          if (nh > 1 && ny >= 0) {
            y = ny;
            h = nh;
          }
        }

        updated = {
          ...base,
          x,
          y,
          w: Math.min(100 - x, w),
          h: Math.min(100 - y, h)
        };
      }

      onRegionChange(idx, updated);
    },
    [isMoving, isResizing, idx, onRegionChange]
  );

  useEffect(() => {
    if (isMoving || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMoving, isResizing, handleMouseMove, handleMouseUp]);

  const handleMouseDown = (e, type) => {
    if (!editable) return;
    e.stopPropagation();
    onStartEdit(idx);
    startPoint.current = { x: e.clientX, y: e.clientY };
    startRegion.current = { ...region };
    if (type === 'move') {
      setIsMoving(true);
      return;
    }
    setIsResizing(type);
  };

  return (
    <div
      ref={containerRef}
      className={`absolute border-2 group transition-colors ${
        isHighlighted ? 'border-success bg-success/20 shadow-[0_0_0_2px_rgba(16,185,129,0.4)]' : 'border-success hover:bg-success/20'
      }`}
      style={{
        left: `${region.x}%`,
        top: `${region.y}%`,
        width: `${region.w}%`,
        height: `${region.h}%`,
        cursor: editable ? ((isMoving || isResizing) ? 'grabbing' : 'move') : 'default',
        zIndex: (isMoving || isResizing) ? 3 : 2
      }}
      onMouseDown={(e) => handleMouseDown(e, 'move')}
    >
      <div className={`absolute top-full left-0 mt-1 text-[9px] px-1.5 py-0.5 rounded text-primary pointer-events-none ${isHighlighted ? 'bg-success/95' : 'bg-background/70'}`}>
        {labelText}
      </div>

      {editable &&
        ['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'].map((side) => (
          <div
            key={side}
            className="absolute bg-success w-2 h-2 rounded-full border border-strong opacity-0 group-hover:opacity-100"
            style={{
              top: side.includes('t') ? '-4px' : side.includes('b') ? 'calc(100% - 4px)' : '50%',
              left: side.includes('l') ? '-4px' : side.includes('r') ? 'calc(100% - 4px)' : '50%',
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

export default function ImageViewer({
  isOpen,
  onClose,
  imageSrc,
  imageTitle,
  regions = [],
  onSaveRegions,
  people = [],
  onOpenEditModal,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  connections = {},
  imageMeta = null,
  onSaveImageMeta = null,
  onSaveEditedImage = null,
  initialMode = 'pan'
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [localRegions, setLocalRegions] = useState(regions || []);
  const [showFaceBoxes, setShowFaceBoxes] = useState(true);
  const [hoveredRegionIndex, setHoveredRegionIndex] = useState(null);
  const [editingRegion, setEditingRegion] = useState(null);
  const [editingTagIndex, setEditingTagIndex] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalMode, setLinkModalMode] = useState('tag');

  const [mode, setMode] = useState(initialMode);
  const isCropMode = mode === 'crop';
  const isTagMode = mode === 'tag';
  const isPanMode = mode === 'pan';

  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const [rotation, setRotation] = useState(0);
  const [fineRotation, setFineRotation] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [contrastLevel, setContrastLevel] = useState(1);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);
  const pendingBoxRef = useRef(null);

  const [cropStart, setCropStart] = useState(null);
  const [cropRect, setCropRect] = useState(null);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPixelChanges, setHasPixelChanges] = useState(false);

  const [personSearchTerm, setPersonSearchTerm] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // Högerpanelens tab-system
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'metadata', 'labels'
  const [photographer, setPhotographer] = useState('');
  const [imageTags, setImageTags] = useState([]);
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  const [showAllLabels, setShowAllLabels] = useState(true);
  const [exifData, setExifData] = useState({ camera: {}, metadata: {}, face_tags: [], keywords: [] });
  const [isEditLabelsModalOpen, setIsEditLabelsModalOpen] = useState(false);
  const [renameLabelTarget, setRenameLabelTarget] = useState(null);
  const [renameLabelValue, setRenameLabelValue] = useState('');

  const appContext = useApp();
  const appShowStatus = appContext?.showStatus;

  const [saveStatus, setSaveStatus] = useState('');
  const saveStatusTimeoutRef = useRef(null);

  const objectUrlsRef = useRef([]);
  const imgRef = useRef(null);
  const viewerContainerRef = useRef(null);

  const samePersonId = useCallback((a, b) => String(a ?? '') === String(b ?? ''), []);

  const resolvedFilePath = useMemo(() => {
    if (imageMeta?.filePath) return imageMeta.filePath;
    if (imageMeta?.path) return imageMeta.path;
    if (imageMeta?.id && String(imageMeta.id).includes('/')) return imageMeta.id;
    const fromMedia = decodeMediaUrlToPath(imageSrc);
    if (fromMedia) return fromMedia;
    return '';
  }, [imageMeta?.filePath, imageMeta?.path, imageMeta?.id, imageSrc]);

  const hasDestructiveChanges = useMemo(() => {
    return (
      hasPixelChanges ||
      rotation !== 0 ||
      fineRotation !== 0 ||
      brightness !== 1 ||
      contrastLevel !== 1 ||
      flipH ||
      flipV
    );
  }, [hasPixelChanges, rotation, fineRotation, brightness, contrastLevel, flipH, flipV]);

  const getPersonDisplayName = useCallback((person) => {
    if (!person) return '';
    return `${person.lastName || ''}, ${person.firstName || ''}`.replace(/^,\s*/, '').trim();
  }, []);

  const getPersonLifeYears = useCallback((person) => {
    if (!person) return '';
    const getYear = (type) => {
      const evt = person.events?.find((e) => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
      const date = evt?.date || '';
      return date ? String(date).substring(0, 4) : '?';
    };
    const birthYear = getYear('BIRT');
    const deathYear = getYear('DEAT');
    if (birthYear === '?' && deathYear === '?') return '';
    return `${birthYear}-${deathYear}`;
  }, []);

  const persistRegions = useCallback(
    (newRegions) => {
      setLocalRegions(newRegions);
      if (typeof onSaveRegions === 'function') onSaveRegions(newRegions);
    },
    [onSaveRegions]
  );

  const getRenderedImageRect = useCallback(() => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return rect;
  }, []);

  const getPointerPositionPercent = useCallback(
    (clientX, clientY) => {
      const rect = getRenderedImageRect();
      if (!rect) return null;
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y))
      };
    },
    [getRenderedImageRect]
  );

  const applyFitToScreen = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    setLocalRegions(Array.isArray(regions) ? regions : []);
  }, [regions, imageSrc, isOpen]);

  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    let cancelled = false;

    const loadImage = async () => {
      setLoading(true);
      setError(null);
      setMode(initialMode || 'pan');
      setRotation(0);
      setFineRotation(0);
      setBrightness(1);
      setContrastLevel(1);
      setFlipH(false);
      setFlipV(false);
      setHasPixelChanges(false);
      setCropRect(null);
      setCropStart(null);
      setCurrentBox(null);
      setStartPos(null);
      setIsDragging(false);
      applyFitToScreen();

      try {
        if (
          imageSrc.startsWith('http://') ||
          imageSrc.startsWith('https://') ||
          imageSrc.startsWith('blob:') ||
          imageSrc.startsWith('data:')
        ) {
          if (!cancelled) setBlobUrl(imageSrc);
          return;
        }

        if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
          const data = await window.electronAPI.readFile(decodeMediaUrlToPath(imageSrc) || imageSrc);
          if (cancelled) return;
          if (!data || data.error) {
            setError(data?.error || 'Kunde inte läsa in bilden.');
            return;
          }
          const blob = new Blob([data]);
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);
          setBlobUrl(url);
          return;
        }

        if (!cancelled) setBlobUrl(imageSrc);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Kunde inte läsa bilden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [isOpen, imageSrc, initialMode, applyFitToScreen]);

  useEffect(() => {
    if (!isOpen) return;
    setMetaTitle(String(imageMeta?.name || imageTitle || ''));
    setMetaDescription(String(imageMeta?.description || imageMeta?.note || ''));
    setPhotographer(String(imageMeta?.photographer || imageMeta?.creator || imageMeta?.artist || ''));

    const incomingTags = Array.isArray(imageMeta?.tags)
      ? imageMeta.tags
      : typeof imageMeta?.tags === 'string'
        ? imageMeta.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];
    setImageTags(Array.from(new Set(incomingTags.map((tag) => String(tag).trim()).filter(Boolean))));
  }, [isOpen, imageMeta?.id, imageMeta?.name, imageMeta?.description, imageMeta?.note, imageMeta?.photographer, imageMeta?.creator, imageMeta?.artist, imageMeta?.tags, imageTitle]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
      objectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !resolvedFilePath || !window.electronAPI?.readExif) return;

    let cancelled = false;

    const loadExif = async () => {
      try {
        const nextExifData = await window.electronAPI.readExif(resolvedFilePath);
        if (cancelled || !nextExifData || nextExifData.error) return;
        setExifData(nextExifData);

        if (Array.isArray(nextExifData.face_tags) && nextExifData.face_tags.length && (!localRegions || localRegions.length === 0)) {
          const parsed = nextExifData.face_tags
            .map(normalizeFaceTagFromExif)
            .filter(Boolean);
          if (parsed.length) persistRegions(parsed);
        }

        if (!metaDescription && nextExifData.metadata?.description) {
          setMetaDescription(String(nextExifData.metadata.description));
        }

        if (!metaTitle && (nextExifData.metadata?.title || nextExifData.metadata?.document_name)) {
          setMetaTitle(String(nextExifData.metadata?.title || nextExifData.metadata?.document_name || ''));
        }

        if (!photographer && (nextExifData.metadata?.artist || nextExifData.metadata?.creator || nextExifData.metadata?.photographer)) {
          setPhotographer(String(nextExifData.metadata?.artist || nextExifData.metadata?.creator || nextExifData.metadata?.photographer || ''));
        }
      } catch (exifError) {
        console.warn('[ImageViewer] EXIF read failed:', exifError);
      }
    };

    loadExif();

    return () => {
      cancelled = true;
    };
  }, [isOpen, resolvedFilePath, localRegions, metaDescription, metaTitle, photographer]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => applyFitToScreen();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, applyFitToScreen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      }
      if (e.key === 'ArrowRight' && hasNext && onNext) {
        e.preventDefault();
        onNext();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showSaveDialog) {
          setShowSaveDialog(false);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, hasPrev, hasNext, onPrev, onNext, onClose, showSaveDialog]);

  const handleZoom = (e) => {
    e.preventDefault();
    const zoomFactor = Math.exp(-e.deltaY * 0.002);
    setZoomLevel((currentZoom) => Math.min(Math.max(0.1, currentZoom * zoomFactor), 8));
  };

  const handleMouseDown = (e) => {
    if (showLinkModal || editingRegion !== null || e.button !== 0 || !imgRef.current) return;
    const pointer = getPointerPositionPercent(e.clientX, e.clientY);
    if (!pointer) return;

    if (isPanMode) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (isTagMode) {
      setIsDragging(true);
      setStartPos(pointer);
      setCurrentBox({ x: pointer.x, y: pointer.y, w: 0, h: 0 });
      pendingBoxRef.current = { x: pointer.x, y: pointer.y, w: 0, h: 0 };
      return;
    }

    if (isCropMode) {
      setCropStart(pointer);
      setCropRect({ x: pointer.x, y: pointer.y, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e) => {
    if (showLinkModal || !imgRef.current) return;

    if (isPanMode && isPanning) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPanOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      panStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const pointer = getPointerPositionPercent(e.clientX, e.clientY);
    if (!pointer) return;

    if (isTagMode && isDragging && startPos) {
      const x = Math.max(0, Math.min(100, Math.min(startPos.x, pointer.x)));
      const y = Math.max(0, Math.min(100, Math.min(startPos.y, pointer.y)));
      const w = Math.abs(pointer.x - startPos.x);
      const h = Math.abs(pointer.y - startPos.y);
      const next = { x, y, w, h };
      setCurrentBox(next);
      pendingBoxRef.current = next;
      return;
    }

    if (isCropMode && cropStart) {
      const x = Math.max(0, Math.min(cropStart.x, pointer.x));
      const y = Math.max(0, Math.min(cropStart.y, pointer.y));
      const w = Math.max(0, Math.abs(pointer.x - cropStart.x));
      const h = Math.max(0, Math.abs(pointer.y - cropStart.y));
      setCropRect({ x, y, w, h });
    }
  };

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (editingRegion !== null) {
      setEditingRegion(null);
      return;
    }

    if (isTagMode && isDragging) {
      setIsDragging(false);
      if (!currentBox || currentBox.w < 1 || currentBox.h < 1) {
        setCurrentBox(null);
        setStartPos(null);
        pendingBoxRef.current = null;
      }
      return;
    }

    if (isCropMode && cropRect && (cropRect.w < 1 || cropRect.h < 1)) {
      setCropRect(null);
      setCropStart(null);
    }
  }, [isPanning, editingRegion, isTagMode, isDragging, currentBox, isCropMode, cropRect]);

  useEffect(() => {
    if (!isDragging && !isPanning && !cropStart) return;
    const onGlobalMouseUp = () => handleMouseUp();
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, [isDragging, isPanning, cropStart, handleMouseUp]);

  const handlePersonSelected = (personId) => {
    const selectedPersonId = String(personId ?? '');
    const draftBox = currentBox || pendingBoxRef.current;

    if (editingTagIndex === null && (!draftBox || draftBox.w < 1 || draftBox.h < 1)) return;

    if (editingTagIndex === null && localRegions.some((r) => samePersonId(r.personId, selectedPersonId))) {
      alert('Denna person ar redan taggad pa bilden.');
      setShowLinkModal(false);
      setCurrentBox(null);
      setStartPos(null);
      pendingBoxRef.current = null;
      return;
    }

    const person = people.find((p) => samePersonId(p.id, selectedPersonId));
    if (!person) return;

    if (editingTagIndex !== null) {
      persistRegions(
        localRegions.map((region, index) => {
          if (index !== editingTagIndex) return region;
          return {
            ...region,
            personId: person.id,
            label: `${person.firstName || ''} ${person.lastName || ''}`.trim() || region.label,
            refNumber: person.refNumber
          };
        })
      );
      setEditingTagIndex(null);
      setShowLinkModal(false);
      return;
    }

    const newRegion = {
      ...draftBox,
      personId: person.id,
      label: `${person.firstName || ''} ${person.lastName || ''}`.trim(),
      refNumber: person.refNumber
    };

    persistRegions([...localRegions, newRegion]);
    setShowLinkModal(false);
    setCurrentBox(null);
    setStartPos(null);
    pendingBoxRef.current = null;
  };

  const handleDeleteRegion = (index) => {
    if (!window.confirm('Ta bort tagg?')) return;
    persistRegions(localRegions.filter((_, i) => i !== index));
  };

  const handleReassignRegionPerson = (regionIndex, personId) => {
    const person = people.find((p) => samePersonId(p.id, personId));
    if (!person) return;
    persistRegions(
      localRegions.map((region, idx) => {
        if (idx !== regionIndex) return region;
        return {
          ...region,
          personId: person.id,
          label: `${person.firstName || ''} ${person.lastName || ''}`.trim() || region.label,
          refNumber: person.refNumber
        };
      })
    );
  };

  const handleRegionChange = (index, newRegion) => {
    persistRegions(localRegions.map((r, i) => (i === index ? newRegion : r)));
  };

  const regionsWithDetails = useMemo(() => {
    return (localRegions || []).map((region, index) => {
      const person = people.find((p) => samePersonId(p.id, region.personId));
      return {
        ...region,
        index,
        person,
        personName: person
          ? `${person.firstName || ''} ${person.lastName || ''}`.trim()
          : String(region.label || 'Okänd person').trim(),
        refNumber: person?.refNumber || region.refNumber || '',
        lifeRange: person ? getLifeRange(person) : ''
      };
    });
  }, [localRegions, people, samePersonId]);

  // Extrahera filnamn och sökväg från resolvedFilePath
  const fileInfo = useMemo(() => {
    if (!resolvedFilePath) {
      return { fileName: 'Okänd', dirPath: '' };
    }
    const normalizedPath = String(resolvedFilePath).replace(/\\/g, '/');
    const parts = normalizedPath.split('/');
    const fileName = parts[parts.length - 1] || 'Okänd';
    const dirPath = parts.slice(0, -1).join('/') || '/';
    return { fileName, dirPath };
  }, [resolvedFilePath]);

  const tagStats = useMemo(() => {
    if (typeof appContext?.getTagStats !== 'function') return [];
    return appContext.getTagStats() || [];
  }, [appContext?.getTagStats]);

  // Filtrera etiketter baserat på aktuell databasstatistik och bildens taggar
  const filteredLabels = useMemo(() => {
    let items = (Array.isArray(tagStats) ? tagStats : []).map((stat) => ({
      id: String(stat?.id || stat?.name || ''),
      name: String(stat?.name || '').trim(),
      count: Number(stat?.count || 0),
      applied: Array.isArray(imageTags) && imageTags.includes(String(stat?.name || '').trim())
    }));

    if (!showAllLabels) {
      items = items.filter((label) => label.applied);
    }
    if (labelSearchTerm.trim()) {
      const query = labelSearchTerm.trim().toLowerCase();
      items = items.filter((label) => label.name.toLowerCase().includes(query));
    }
    return items;
  }, [tagStats, imageTags, showAllLabels, labelSearchTerm]);

  const cameraInfo = useMemo(() => {
    const camera = exifData?.camera || {};
    return {
      makeModel: [camera.make, camera.model].filter(Boolean).join(' ').trim(),
      lens: camera.lens || '',
      aperture: camera.aperture || '',
      shutterSpeed: camera.shutter_speed || '',
      iso: camera.iso ?? '',
      focalLength: camera.focal_length || ''
    };
  }, [exifData?.camera]);

  const gpsInfo = useMemo(() => {
    const gps = exifData?.gps || null;
    const latitude = Number(gps?.latitude);
    const longitude = Number(gps?.longitude);
    const altitude = Number(gps?.altitude);

    return {
      hasCoordinates: Number.isFinite(latitude) && Number.isFinite(longitude),
      latitude,
      longitude,
      altitude: Number.isFinite(altitude) ? altitude : null
    };
  }, [exifData?.gps]);

  const labelTree = useMemo(() => {
    const root = [];
    const byPath = new Map();

    filteredLabels.forEach((label) => {
      const parts = String(label.name || '').split(/[\/|]/).map((part) => part.trim()).filter(Boolean);
      if (parts.length === 0) return;

      let siblings = root;
      let pathParts = [];

      parts.forEach((part, index) => {
        pathParts = [...pathParts, part];
        const path = pathParts.join('/');
        let node = byPath.get(path);

        if (!node) {
          node = {
            id: path,
            name: part,
            fullName: pathParts.join('/'),
            count: index === parts.length - 1 ? label.count : 0,
            applied: index === parts.length - 1 ? label.applied : false,
            children: []
          };
          byPath.set(path, node);
          siblings.push(node);
        }

        if (index === parts.length - 1) {
          node.count = label.count;
          node.applied = label.applied;
          node.fullName = label.name;
        }

        siblings = node.children;
      });
    });

    return root;
  }, [filteredLabels]);

  const saveMetaPatch = useCallback((patch) => {
    if (typeof onSaveImageMeta !== 'function') return;
    onSaveImageMeta({
      name: metaTitle,
      description: metaDescription,
      note: metaDescription,
      tags: imageTags,
      photographer,
      creator: photographer,
      ...patch
    });
  }, [onSaveImageMeta, metaTitle, metaDescription, imageTags, photographer]);

  const toggleImageTag = useCallback((tagName, checked) => {
    const normalizedTag = String(tagName || '').trim();
    if (!normalizedTag) return;

    setImageTags((prev) => {
      const next = checked
        ? Array.from(new Set([...prev, normalizedTag]))
        : prev.filter((tag) => tag !== normalizedTag);
      saveMetaPatch({ tags: next });
      return next;
    });
  }, [saveMetaPatch]);

  const handlePhotographerPicked = useCallback((personId) => {
    const selectedPerson = people.find((person) => samePersonId(person.id, personId));
    if (!selectedPerson) return;
    const fullName = `${selectedPerson.firstName || ''} ${selectedPerson.lastName || ''}`.trim();
    setPhotographer(fullName);
    saveMetaPatch({ photographer: fullName, creator: fullName });
  }, [people, samePersonId, saveMetaPatch]);

  const handleOpenRenameLabel = useCallback((label) => {
    setRenameLabelTarget(label);
    setRenameLabelValue(String(label?.fullName || label?.name || ''));
  }, []);

  const handleLogRenameLabel = useCallback(async () => {
    if (!renameLabelTarget) return;
    const oldName = String(renameLabelTarget.fullName || renameLabelTarget.name || '').trim();
    const newName = String(renameLabelValue || '').trim();
    if (!newName || newName === oldName) return;

    console.log(`Ska döpa om '${oldName}' till '${newName}'`);

    setRenameLabelTarget(null);
    setRenameLabelValue('');
  }, [renameLabelTarget, renameLabelValue]);

  const handleLogDeleteLabel = useCallback(async (label) => {
    if (!label) return;
    const labelName = String(label.fullName || label.name || '').trim();
    const count = Number(label.count || 0);
    if (!labelName) return;

    const confirmed = window.confirm(`Vill du verkligen ta bort etiketten '${labelName}' från ${count} bilder?`);
    if (!confirmed) return;

    console.log(`Ska radera '${labelName}' från ${count} bilder`);
  }, []);

  const filteredPeople = useMemo(() => {
    const query = personSearchTerm.trim().toLowerCase();
    const base = people.filter((p) => {
      if (!query) return true;
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      const revName = `${p.lastName || ''}, ${p.firstName || ''}`.toLowerCase();
      const ref = String(p.refNumber || '').toLowerCase();
      return fullName.includes(query) || revName.includes(query) || ref.includes(query);
    });

    return [...base].sort((a, b) => getPersonDisplayName(a).localeCompare(getPersonDisplayName(b), 'sv'));
  }, [people, personSearchTerm, getPersonDisplayName]);

  const createCurrentImageSnapshotBlob = async () => {
    if (!imgRef.current) throw new Error('Ingen bild laddad.');

    const sourceImage = imgRef.current;
    const sourceW = sourceImage.naturalWidth || sourceImage.width;
    const sourceH = sourceImage.naturalHeight || sourceImage.height;

    if (!sourceW || !sourceH) throw new Error('Bilden kunde inte läsas.');

    const angle = ((rotation + fineRotation) * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(angle));
    const absSin = Math.abs(Math.sin(angle));
    const exportW = Math.ceil(sourceW * absCos + sourceH * absSin);
    const exportH = Math.ceil(sourceW * absSin + sourceH * absCos);

    const canvas = document.createElement('canvas');
    canvas.width = exportW;
    canvas.height = exportH;

    const ctx = canvas.getContext('2d');
    ctx.translate(exportW / 2, exportH / 2);
    ctx.rotate(angle);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.filter = `brightness(${brightness}) contrast(${contrastLevel})`;
    ctx.drawImage(sourceImage, -sourceW / 2, -sourceH / 2, sourceW, sourceH);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Kunde inte skapa bilddata.'));
          return;
        }
        resolve(blob);
      }, getMimeTypeFromName(imageTitle || imageMeta?.name || 'image.jpg'), 0.95);
    });
  };

  const applyCrop = async () => {
    if (!cropRect || cropRect.w < 1 || cropRect.h < 1 || !imgRef.current) return;

    const img = imgRef.current;
    const sourceW = img.naturalWidth || img.width;
    const sourceH = img.naturalHeight || img.height;

    const sx = Math.max(0, Math.min(sourceW, (cropRect.x / 100) * sourceW));
    const sy = Math.max(0, Math.min(sourceH, (cropRect.y / 100) * sourceH));
    const sw = Math.max(1, Math.min(sourceW - sx, (cropRect.w / 100) * sourceW));
    const sh = Math.max(1, Math.min(sourceH - sy, (cropRect.h / 100) * sourceH));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const croppedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Kunde inte beskära bilden.'));
          return;
        }
        resolve(blob);
      }, getMimeTypeFromName(imageTitle || imageMeta?.name || 'image.jpg'), 0.95);
    });

    const url = URL.createObjectURL(croppedBlob);
    objectUrlsRef.current.push(url);
    setBlobUrl(url);

    const recalculated = recalcRegionsAfterCrop(localRegions, cropRect);
    persistRegions(recalculated);

    setCropRect(null);
    setCropStart(null);
    setMode('pan');
    setHasPixelChanges(true);
  };

  const persistExifMetadata = async (targetPath) => {
    const pathToWrite = targetPath || resolvedFilePath;
    const electron = window.electronAPI;
    if (!pathToWrite || !electron) return;

    const nameByPersonId = new Map(
      (people || []).map((person) => [
        String(person.id),
        `${person.firstName || ''} ${person.lastName || ''}`.trim()
      ])
    );

    const faceTags = (localRegions || []).map((region) => ({
      name: nameByPersonId.get(String(region.personId)) || String(region.label || 'Okänd person').trim(),
      x: Number(region.x),
      y: Number(region.y),
      width: Number(region.w),
      height: Number(region.h)
    }));

    const faceNames = faceTags
      .map((tag) => tag.name)
      .filter(Boolean)
      .slice(0, 500);

    const existingKeywords = Array.isArray(imageMeta?.tags) ? imageMeta.tags : [];
    const mergedKeywords = [...new Set([...existingKeywords, ...imageTags, ...faceNames])].filter(Boolean);

    try {
      if (typeof electron.writeExifFaceTags === 'function') {
        await electron.writeExifFaceTags(pathToWrite, faceTags, true);
      }
      if (typeof electron.writeExifMetadata === 'function') {
        await electron.writeExifMetadata(pathToWrite, {
          keywords: mergedKeywords,
          photographer: photographer || '',
          title: metaTitle,
          description: metaDescription,
          date: imageMeta?.date || ''
        }, true);
      } else if (typeof electron.writeExifKeywords === 'function') {
        await electron.writeExifKeywords(pathToWrite, mergedKeywords, true, photographer || '');
      }
    } catch (writeError) {
      console.warn('[ImageViewer] EXIF write failed:', writeError);
    }
  };

  const handleSaveAs = async (saveMode) => {
    setShowSaveDialog(false);
    setIsSaving(true);

    try {
      const editedBlob = await createCurrentImageSnapshotBlob();
      const bytes = new Uint8Array(await editedBlob.arrayBuffer());
      const dataArray = Array.from(bytes);

      const originalName = imageMeta?.name || imageTitle || 'bild.jpg';
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      const ext = originalName.split('.').pop() || 'jpg';

      let savedPath = resolvedFilePath;
      let savedUrl = blobUrl;
      let savedName = originalName;

      if (saveMode === 'overwrite') {
        if (savedPath && window.electronAPI?.saveFile) {
          await window.electronAPI.saveFile(savedPath, dataArray);
          setHasPixelChanges(false);
        } else {
          const fallbackUrl = URL.createObjectURL(editedBlob);
          objectUrlsRef.current.push(fallbackUrl);
          savedUrl = fallbackUrl;
          setBlobUrl(fallbackUrl);
          setHasPixelChanges(true);
        }
      }

      if (saveMode === 'copy') {
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const copyName = `${baseName}_redigerad_${timestamp}.${ext}`;

        if (window.electronAPI?.saveFileBufferToMedia) {
          const folderPrefix = savedPath && savedPath.includes('/') ? `${savedPath.substring(0, savedPath.lastIndexOf('/') + 1)}` : '';
          const relativeTarget = `${folderPrefix}${copyName}`;
          const result = await window.electronAPI.saveFileBufferToMedia(dataArray, relativeTarget);
          if (result?.success) {
            savedPath = result.filePath || relativeTarget;
            savedUrl = `media://${encodeURIComponent(savedPath)}`;
            savedName = copyName;
          }
        } else {
          const fallbackUrl = URL.createObjectURL(editedBlob);
          objectUrlsRef.current.push(fallbackUrl);
          savedUrl = fallbackUrl;
          savedName = copyName;
        }
      }

      saveMetaPatch({
        name: saveMode === 'copy' ? savedName : metaTitle,
        description: metaDescription,
        note: metaDescription,
        tags: imageTags,
        photographer,
        creator: photographer
      });

      await persistExifMetadata(savedPath);

      if (typeof onSaveEditedImage === 'function') {
        onSaveEditedImage({
          mode: saveMode,
          url: savedUrl,
          name: savedName,
          filePath: savedPath,
          blob: editedBlob
        });
      }

      setSaveStatus('saved');
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus(''), 2000);

      if (saveMode === 'overwrite' && savedUrl && savedUrl !== blobUrl) {
        setBlobUrl(savedUrl);
      }
    } catch (saveError) {
      console.error('[ImageViewer] save failed:', saveError);
      alert(`Kunde inte spara bilden: ${saveError.message || saveError}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = async () => {
    if (hasDestructiveChanges) {
      setShowSaveDialog(true);
      return;
    }

    saveMetaPatch({
      name: metaTitle,
      description: metaDescription,
      note: metaDescription,
      tags: imageTags,
      photographer,
      creator: photographer
    });

    await persistExifMetadata();
    setSaveStatus('saved');
    if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
    saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus(''), 1500);
  };

  const rotateRight = () => setRotation((r) => (r + 90) % 360);

  if (!isOpen) return null;

  return (
    <>
      <LinkPersonModal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false);
          setEditingTagIndex(null);
          setLinkModalMode('tag');
          if (editingTagIndex === null) setCurrentBox(null);
        }}
        people={people}
        onLink={(personId) => {
          if (linkModalMode === 'photographer') {
            handlePhotographerPicked(personId);
            setShowLinkModal(false);
            setLinkModalMode('tag');
            return;
          }
          handlePersonSelected(personId);
        }}
        skipEventSelection={true}
        excludePersonIds={editingTagIndex !== null ? [] : localRegions.map((r) => r.personId).filter(Boolean)}
        zIndex={6000}
      />

      <WindowFrame title={imageTitle || 'Bildvisare'} onClose={onClose} initialWidth={1260} initialHeight={860}>
        <div className="flex flex-col h-full bg-background relative">
          <div className="px-3 py-2 border-b border-subtle bg-surface flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() => setMode('pan')}
                variant={isPanMode ? 'primary' : 'secondary'}
                size="sm"
                title="Panoreringsläge"
              >
                <Move size={14} />
              </Button>
              <Button
                onClick={() => setMode('tag')}
                variant={isTagMode ? 'primary' : 'secondary'}
                size="sm"
                disabled={editingRegion !== null}
                title="Taggningsläge"
              >
                <ScanFace size={14} />
              </Button>
              <Button
                onClick={() => setMode('crop')}
                variant={isCropMode ? 'primary' : 'secondary'}
                size="sm"
                title="Beskärningsläge"
              >
                <Crop size={14} />
              </Button>

              <div className="w-px h-6 bg-subtle mx-1" />

              <Button onClick={() => setZoomLevel((z) => Math.min(8, z * 1.15))} variant="secondary" size="sm" title="Zooma in">
                <ZoomIn size={14} />
              </Button>
              <Button onClick={() => setZoomLevel((z) => Math.max(0.1, z / 1.15))} variant="secondary" size="sm" title="Zooma ut">
                <ZoomOut size={14} />
              </Button>
              <Button onClick={applyFitToScreen} variant="secondary" size="sm" title="Anpassa till vy">
                <Maximize2 size={14} />
              </Button>
              <Button onClick={rotateRight} variant="secondary" size="sm" title="Rotera 90 grader">
                <RotateCw size={14} />
              </Button>
              <Button onClick={() => setFlipH((v) => !v)} variant="secondary" size="sm" title="Spegla horisontellt">
                <FlipHorizontal size={14} />
              </Button>
              <Button onClick={() => setFlipV((v) => !v)} variant="secondary" size="sm" title="Spegla vertikalt">
                <FlipVertical size={14} />
              </Button>
              <Button
                onClick={() => setShowFaceBoxes((prev) => !prev)}
                variant="secondary"
                size="sm"
                title={showFaceBoxes ? 'Dölj ansiktsboxar' : 'Visa ansiktsboxar'}
              >
                {showFaceBoxes ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs text-secondary">
              <span>{isPanMode ? 'Mode: Pan' : isTagMode ? 'Mode: Tagga' : 'Mode: Beskär'}</span>
              <span>Zoom {Math.round(zoomLevel * 100)}%</span>
              <span>{saveStatus === 'saved' ? 'Sparat' : isSaving ? 'Sparar...' : ''}</span>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-subtle bg-surface flex items-center gap-4 text-xs text-primary">
            <label className="flex items-center gap-2">
              <Sun size={14} />
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-24"
              />
              <span>{Math.round(brightness * 100)}%</span>
            </label>
            <label className="flex items-center gap-2">
              <Contrast size={14} />
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={contrastLevel}
                onChange={(e) => setContrastLevel(parseFloat(e.target.value))}
                className="w-24"
              />
              <span>{Math.round(contrastLevel * 100)}%</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-secondary">Finrotation</span>
              <input
                type="range"
                min={-8}
                max={8}
                step={0.1}
                value={fineRotation}
                onChange={(e) => setFineRotation(parseFloat(e.target.value))}
                className="w-28"
              />
              <span>{fineRotation.toFixed(1)}°</span>
            </label>

            {isCropMode && cropRect && cropRect.w >= 1 && cropRect.h >= 1 && (
              <Button onClick={applyCrop} variant="primary" size="sm">
                Tillämpa beskärning
              </Button>
            )}
          </div>

          <div className="flex-1 flex overflow-hidden relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <div
              ref={viewerContainerRef}
              className={`flex-1 flex items-center justify-center overflow-hidden p-4 relative ${isPanning ? 'cursor-grabbing' : ''}`}
              onWheel={handleZoom}
            >
              {loading && <span className="text-primary animate-pulse">Laddar bild...</span>}
              {error && <div className="text-warning font-bold">Fel: {error}</div>}

              {blobUrl && !loading && (
                <div
                  className="relative inline-block"
                  style={{
                    cursor: isTagMode || isCropMode ? 'crosshair' : isPanMode ? (isPanning ? 'grabbing' : 'grab') : 'default',
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transition: isPanning ? 'none' : 'transform 0.06s ease-out',
                    transformOrigin: 'center center',
                    willChange: 'transform'
                  }}
                  onMouseDown={handleMouseDown}
                >
                  <img
                    ref={imgRef}
                    src={blobUrl}
                    alt={imageTitle}
                    className="block select-none pointer-events-auto max-h-[72vh] max-w-[72vw]"
                    style={{
                      transform: `rotate(${rotation + fineRotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                      filter: `brightness(${brightness}) contrast(${contrastLevel})`,
                      transformOrigin: 'center center'
                    }}
                    onDragStart={(e) => e.preventDefault()}
                  />

                  {showFaceBoxes &&
                    localRegions.map((region, idx) => (
                      <RegionComponent
                        key={`${region.personId || region.label || 'region'}_${idx}`}
                        region={region}
                        idx={idx}
                        people={people}
                        isHighlighted={hoveredRegionIndex === idx}
                        editable={isTagMode}
                        onStartEdit={setEditingRegion}
                        onStopEdit={() => setEditingRegion(null)}
                        onRegionChange={handleRegionChange}
                        onDelete={handleDeleteRegion}
                      />
                    ))}

                  {currentBox && (
                    <div
                      className="absolute border-2 border-strong bg-accent-soft"
                      style={{
                        left: `${currentBox.x}%`,
                        top: `${currentBox.y}%`,
                        width: `${currentBox.w}%`,
                        height: `${currentBox.h}%`
                      }}
                    />
                  )}

                  {isCropMode && cropRect && (
                    <div
                      className="absolute border-2 border-warning bg-warning-soft/40"
                      style={{
                        left: `${cropRect.x}%`,
                        top: `${cropRect.y}%`,
                        width: `${cropRect.w}%`,
                        height: `${cropRect.h}%`
                      }}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="w-80 bg-surface p-0 shrink-0 overflow-hidden custom-scrollbar text-primary border-l border-subtle flex flex-col">
              {/* ===== TAB NAVIGATION ===== */}
              <div className="flex border-b border-subtle bg-surface">
                {[
                  { id: 'info', label: 'Info' },
                  { id: 'metadata', label: 'Metadata' },
                  { id: 'labels', label: 'Etiketter' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'text-primary border-b-accent bg-surface-2'
                        : 'text-secondary border-b-transparent hover:text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ===== TAB CONTENT ===== */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                
                {/* TAB 1: INFO */}
                {activeTab === 'info' && (
                  <div className="space-y-4">
                    {/* Filnamn */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Filnamn</label>
                      <div className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary truncate">
                        {fileInfo.fileName}
                      </div>
                    </div>

                    {/* Katalog/Sökväg */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Katalog</label>
                      <div className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary break-all max-h-12 overflow-y-auto">
                        {fileInfo.dirPath}
                      </div>
                    </div>

                    {/* Datum */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Datum</label>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD"
                        className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                      />
                    </div>

                    {/* Fotograf / Ägare */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1 flex items-center gap-1">
                        Fotograf / Ägare
                        <button
                          type="button"
                          onClick={() => {
                            setLinkModalMode('photographer');
                            setShowLinkModal(true);
                          }}
                          className="inline-flex items-center justify-center w-5 h-5 rounded border border-subtle text-primary hover:text-accent hover:border-strong"
                          title="Koppla person"
                        >
                          <UserPlus size={11} />
                        </button>
                      </label>
                      <input
                        type="text"
                        value={photographer}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPhotographer(value);
                          saveMetaPatch({ photographer: value, creator: value });
                        }}
                        placeholder="T.ex. Anders Nilsson..."
                        className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                      />
                    </div>

                    <div className="border-t border-subtle pt-3 mt-3">
                      <h4 className="text-sm font-bold border-b border-subtle pb-2 mb-3">Sök & Koppla Person (ny tagg)</h4>
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
                            onClick={() => {
                              setCurrentBox(null);
                              setStartPos(null);
                            }}
                            className="inline-flex items-center justify-center w-5 h-5 rounded border border-success hover:border-success hover:bg-success/40"
                            title="Avbryt ny tagg"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <p className="mb-3 text-[10px] text-muted">Sätt mode till Tagga och rita en ruta på bilden för att skapa ny tagg.</p>
                      )}

                      <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 mb-3 border border-subtle rounded p-1.5 bg-surface-2">
                        {filteredPeople.slice(0, 60).map((candidate) => {
                          const candidateName = getPersonDisplayName(candidate) || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
                          const candidateYears = getPersonLifeYears(candidate);
                          const candidatePrimaryMedia = Array.isArray(candidate.media) ? candidate.media[0] : null;
                          const candidateImageUrl = candidatePrimaryMedia ? candidatePrimaryMedia.url || candidatePrimaryMedia.path : '';
                          return (
                            <button
                              key={candidate.id}
                              type="button"
                              disabled={!currentBox}
                              onClick={() => handlePersonSelected(candidate.id)}
                              className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded border border-subtle hover:border-strong hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                              title={currentBox ? 'Lägg till som ny tagg' : 'Rita först en ruta på bilden'}
                            >
                              <div className="w-6 h-6 rounded-full overflow-hidden border border-subtle bg-surface shrink-0">
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
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-secondary">Ref {candidate.refNumber || '-'}</div>
                                <div className="text-[10px] text-primary truncate">{candidateName}</div>
                                {candidateYears && <div className="text-[9px] text-muted">{candidateYears}</div>}
                              </div>
                              <UserPlus size={11} className="text-accent shrink-0" />
                            </button>
                          );
                        })}
                      </div>

                      <h4 className="text-sm font-bold border-b border-subtle pb-2 mb-2">Taggade personer ({regionsWithDetails.length})</h4>
                      <ul className="space-y-2 text-xs">
                        {regionsWithDetails.map((tagRegion) => (
                          <li
                            key={`${tagRegion.personId || 'unknown'}_${tagRegion.index}`}
                            className={`pb-2 border-b border-subtle rounded transition-colors ${
                              hoveredRegionIndex === tagRegion.index ? 'bg-success/20 border-success' : ''
                            }`}
                            onMouseEnter={() => setHoveredRegionIndex(tagRegion.index)}
                            onMouseLeave={() => setHoveredRegionIndex(null)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="w-6 h-6 rounded-full overflow-hidden border border-subtle bg-surface shrink-0 mt-0.5">
                                {tagRegion.person?.media?.[0] ? (
                                  <MediaImage
                                    url={tagRegion.person.media[0].url || tagRegion.person.media[0].path}
                                    alt={tagRegion.personName}
                                    className="w-full h-full object-cover"
                                    style={getAvatarImageStyle(tagRegion.person.media[0], tagRegion.person.id)}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-muted">?</div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[9px] text-secondary">{tagRegion.refNumber ? `Ref ${tagRegion.refNumber}` : 'Ref saknas'}</div>
                                <button
                                  className="text-accent hover:text-primary hover:underline font-bold text-left block truncate text-[10px]"
                                  onClick={() => tagRegion.person && onOpenEditModal?.(tagRegion.person.id)}
                                  title={`Öppna redigering för ${tagRegion.personName}`}
                                >
                                  {tagRegion.personName}
                                </button>
                                {tagRegion.lifeRange && <div className="text-[9px] text-secondary">{tagRegion.lifeRange}</div>}
                              </div>
                            </div>
                            <div className="mt-1.5 grid grid-cols-[1fr_auto_auto] gap-0.5 items-center">
                              <select
                                value={tagRegion.personId || ''}
                                onChange={(e) => handleReassignRegionPerson(tagRegion.index, e.target.value)}
                                className="bg-background border border-subtle rounded px-1.5 py-0.5 text-[10px] text-primary"
                              >
                                <option value="">Välj person...</option>
                                {filteredPeople.map((person) => (
                                  <option key={person.id} value={person.id}>
                                    Ref {person.refNumber || '-'} - {`${person.firstName || ''} ${person.lastName || ''}`.trim() || person.id}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTagIndex(tagRegion.index);
                                  setShowLinkModal(true);
                                }}
                                className="inline-flex items-center justify-center w-6 h-6 rounded border border-subtle text-primary hover:text-accent hover:border-strong"
                                title="Byt person med sökdialog"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRegion(tagRegion.index)}
                                className="inline-flex items-center justify-center w-6 h-6 rounded border border-strong bg-warning-soft text-warning hover:text-warning hover:border-strong"
                                title="Ta bort tagg"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* TAB 2: METADATA */}
                {activeTab === 'metadata' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Titel</label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => setMetaTitle(e.target.value)}
                        className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        placeholder="Ange titel..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Beskrivning / Rubrik</label>
                      <textarea
                        value={metaDescription}
                        onChange={(e) => setMetaDescription(e.target.value)}
                        className="w-full h-32 bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary resize-none focus:outline-none focus:border-strong"
                        placeholder="Skriv beskrivning..."
                      />
                    </div>

                    <div className="p-3 rounded border border-subtle bg-surface-2 text-[11px] text-secondary">
                      <p className="font-semibold text-primary mb-3">Kamerauppgifter</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-subtle bg-background px-2 py-1.5">
                          <div className="text-[10px] uppercase text-muted">Kameramodell</div>
                          <div className="text-primary truncate">{cameraInfo.makeModel || 'Saknas'}</div>
                        </div>
                        <div className="rounded border border-subtle bg-background px-2 py-1.5">
                          <div className="text-[10px] uppercase text-muted">Objektiv</div>
                          <div className="text-primary truncate">{cameraInfo.lens || 'Saknas'}</div>
                        </div>
                        <div className="rounded border border-subtle bg-background px-2 py-1.5">
                          <div className="text-[10px] uppercase text-muted">Bländare</div>
                          <div className="text-primary">{cameraInfo.aperture || 'Saknas'}</div>
                        </div>
                        <div className="rounded border border-subtle bg-background px-2 py-1.5">
                          <div className="text-[10px] uppercase text-muted">Slutartid</div>
                          <div className="text-primary">{cameraInfo.shutterSpeed || 'Saknas'}</div>
                        </div>
                        <div className="rounded border border-subtle bg-background px-2 py-1.5">
                          <div className="text-[10px] uppercase text-muted">ISO</div>
                          <div className="text-primary">{cameraInfo.iso || 'Saknas'}</div>
                        </div>
                        <div className="rounded border border-subtle bg-background px-2 py-1.5">
                          <div className="text-[10px] uppercase text-muted">Brännvidd</div>
                          <div className="text-primary">{cameraInfo.focalLength || 'Saknas'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded border border-subtle bg-surface-2 text-[11px] text-secondary">
                      <p className="font-semibold text-primary mb-2">GPS</p>
                      {gpsInfo.hasCoordinates ? (
                        <div className="space-y-1 text-xs">
                          <div className="text-primary">Latitud: {gpsInfo.latitude.toFixed(6)}</div>
                          <div className="text-primary">Longitud: {gpsInfo.longitude.toFixed(6)}</div>
                          {gpsInfo.altitude !== null && (
                            <div className="text-secondary">Höjd: {gpsInfo.altitude.toFixed(1)} m</div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted">Ingen GPS-data hittades i EXIF-metadata.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: ETIKETTER */}
                {activeTab === 'labels' && (
                  <div className="space-y-3">
                    {/* Sökfält för etiketter */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Sök etikett</label>
                      <div className="relative">
                        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          type="text"
                          value={labelSearchTerm}
                          onChange={(e) => setLabelSearchTerm(e.target.value)}
                          placeholder="Namn på etikett..."
                          className="w-full bg-background border border-subtle rounded pl-7 pr-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        />
                      </div>
                    </div>

                    {/* Toggle: Visa alla / Endast applicerade */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showAllLabels}
                        onChange={(e) => setShowAllLabels(e.target.checked)}
                        className="w-4 h-4 rounded border-subtle"
                      />
                      <span className="text-xs text-secondary">{showAllLabels ? 'Visa alla' : 'Endast applicerade'}</span>
                    </label>

                    {/* Lista över etiketter */}
                    <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar border border-subtle rounded p-2 bg-surface-2">
                      {filteredLabels.map(label => (
                        <label
                          key={label.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={label.applied}
                            onChange={(e) => {
                              toggleImageTag(label.name, e.target.checked);
                            }}
                            className="w-4 h-4 rounded border-subtle accent-accent"
                          />
                          <span className="flex-1 text-xs text-primary">{label.name}</span>
                          <span className="text-[10px] text-muted bg-subtle rounded px-1.5 py-0.5 group-hover:bg-background">
                            {label.count}
                          </span>
                        </label>
                      ))}
                      {filteredLabels.length === 0 && (
                        <p className="text-xs text-muted text-center py-4">Inga etiketter hittades</p>
                      )}
                    </div>

                    {/* Redigera Etiketter knapp */}
                    <button
                      type="button"
                      onClick={() => console.log('Öppna redigera etiketter')}
                      className="w-full py-2 px-3 rounded border border-subtle text-primary hover:text-accent hover:border-strong text-xs font-medium transition-colors"
                    >
                      ⚙️ Redigera Etiketter
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>

          <div className="bg-surface p-3 border-t border-subtle flex justify-between items-center shrink-0">
            <div className="text-secondary text-xs flex gap-4 items-center">
              <span>{isTagMode ? 'Dra för att skapa ansiktstagg.' : isCropMode ? 'Dra för att skapa beskärningsruta.' : 'Panorera med dra.'}</span>
              <span>{regionsWithDetails.length} ansiktstaggar</span>
            </div>
            <div className="flex gap-2 items-center">
              <Button onClick={onPrev} disabled={!hasPrev} variant="secondary" size="sm">
                ◀
              </Button>
              <Button onClick={onNext} disabled={!hasNext} variant="secondary" size="sm">
                ▶
              </Button>
              <Button onClick={onClose} variant="danger" size="sm">
                Stäng
              </Button>
              <Button onClick={handleSaveClick} variant="primary" size="sm" disabled={isSaving}>
                <Save size={14} />
                Spara
              </Button>
            </div>
          </div>

          {showSaveDialog && (
            <div className="absolute inset-0 z-[7000] bg-black/55 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-surface border border-subtle rounded-xl p-4 shadow-2xl">
                <h3 className="text-base font-semibold text-primary mb-2">Spara bildandringar</h3>
                <p className="text-sm text-secondary mb-4">
                  Du har destruktiva ändringar (beskärning, rotation eller filter). Hur vill du spara?
                </p>
                <div className="flex gap-2 justify-end">
                  <Button onClick={() => setShowSaveDialog(false)} variant="secondary" size="sm">
                    Avbryt
                  </Button>
                  <Button onClick={() => handleSaveAs('copy')} variant="secondary" size="sm" disabled={isSaving}>
                    Spara som ny kopia
                  </Button>
                  <Button onClick={() => handleSaveAs('overwrite')} variant="primary" size="sm" disabled={isSaving}>
                    Skriv över original
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isEditLabelsModalOpen && (
            <div className="absolute inset-0 z-[7100] bg-black/60 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[80vh] bg-surface border border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-subtle flex items-center justify-between bg-surface-2">
                  <div>
                    <h3 className="text-base font-semibold text-primary">Redigera Etiketter</h3>
                    <p className="text-xs text-secondary">Byt namn eller markera för radering. Åtgärderna loggas tills global ersättningslogik byggs.</p>
                  </div>
                  <Button onClick={() => setIsEditLabelsModalOpen(false)} variant="secondary" size="sm">Stäng</Button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                  {labelTree.length === 0 ? (
                    <p className="text-sm text-muted">Inga etiketter hittades.</p>
                  ) : (
                    labelTree.map((node) => (
                      <LabelTreeRow
                        key={node.id}
                        node={node}
                        depth={0}
                        onRename={handleOpenRenameLabel}
                        onDelete={handleLogDeleteLabel}
                      />
                    ))
                  )}
                </div>

                {renameLabelTarget && (
                  <div className="px-4 py-3 border-t border-subtle bg-surface-2 flex flex-col gap-2">
                    <div className="text-xs text-secondary">
                      Ska byta namn på <span className="text-primary font-semibold">{renameLabelTarget.fullName}</span> på {renameLabelTarget.count} bilder.
                    </div>
                    <input
                      type="text"
                      value={renameLabelValue}
                      onChange={(e) => setRenameLabelValue(e.target.value)}
                      className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                      placeholder="Nytt namn..."
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() => {
                          setRenameLabelTarget(null);
                          setRenameLabelValue('');
                        }}
                        variant="secondary"
                        size="sm"
                      >
                        Avbryt
                      </Button>
                      <Button onClick={handleLogRenameLabel} variant="primary" size="sm">
                        Spara namnändring
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </WindowFrame>
    </>
  );
}

function LabelTreeRow({ node, depth, onRename, onDelete }) {
  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 rounded border border-subtle bg-background px-2 py-1.5"
        style={{ marginLeft: `${depth * 14}px` }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm text-primary truncate">{node.name}</div>
          <div className="text-[10px] text-muted">{node.count} bilder</div>
        </div>
        <Button onClick={() => onRename(node)} variant="secondary" size="sm">
          Byt namn
        </Button>
        <Button onClick={() => onDelete(node)} variant="danger" size="sm">
          Radera
        </Button>
      </div>
      {Array.isArray(node.children) && node.children.length > 0 && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <LabelTreeRow key={child.id} node={child} depth={depth + 1} onRename={onRename} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
