import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
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
  ScanFace,
  FolderOpen,
  Plus,
  ChevronDown,
  ChevronRight,
  User,
  Tag
} from 'lucide-react';

function splitDateTime(input) {
  const raw = String(input || '').trim();
  if (!raw) return { date: '', time: '' };

  const normalized = raw.replace(/\//g, '-').replace(/\./g, '-').replace(/:/g, '-');
  const dateMatch = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = raw.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);

  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
  const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] || '00'}` : '';
  return { date, time };
}

function mergeDateTime(dateValue, timeValue) {
  const date = String(dateValue || '').trim();
  if (!date) return '';
  const time = String(timeValue || '').trim();
  return time ? `${date} ${time}` : date;
}

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

const FACE_ROOT_LABEL = 'Människor';
const LEGACY_FACE_ROOT_LABEL = 'Faces';

function isFaceTagPath(tagPath) {
  const path = String(tagPath || '').trim();
  return path === FACE_ROOT_LABEL || path === LEGACY_FACE_ROOT_LABEL || path.startsWith(`${FACE_ROOT_LABEL}/`) || path.startsWith(`${LEGACY_FACE_ROOT_LABEL}/`);
}

function resolveMediaPathFromItem(mediaItem) {
  if (!mediaItem) return '';
  if (mediaItem.filePath) return String(mediaItem.filePath);
  if (mediaItem.path) return String(mediaItem.path);
  if (mediaItem.id && String(mediaItem.id).includes('/')) return String(mediaItem.id);

  const url = String(mediaItem.url || '');
  if (url.startsWith('media://')) {
    return decodeMediaUrlToPath(url);
  }
  return '';
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
        isHighlighted
          ? 'border-success bg-success/30 shadow-[0_0_0_3px_rgba(16,185,129,0.65)] animate-pulse'
          : 'border-success hover:bg-success/20'
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
  const [metaDate, setMetaDate] = useState('');
  const [metaTime, setMetaTime] = useState('');

  // Högerpanelens tab-system
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'metadata', 'labels'
  const [photographer, setPhotographer] = useState('');
  const [imageTags, setImageTags] = useState([]);
  const [labelSearchTerm, setLabelSearchTerm] = useState('');
  const [labelFilterMode, setLabelFilterMode] = useState('all');
  const [exifData, setExifData] = useState({ camera: {}, metadata: {}, face_tags: [], keywords: [] });
  const [isEditLabelsModalOpen, setIsEditLabelsModalOpen] = useState(false);
  const [renameLabelTarget, setRenameLabelTarget] = useState(null);
  const [renameLabelValue, setRenameLabelValue] = useState('');
  const [selectedLabelId, setSelectedLabelId] = useState(null);
  const [tagContextMenu, setTagContextMenu] = useState(null);
  const [tagContextMenuIndex, setTagContextMenuIndex] = useState(0);
  const [createLabelParent, setCreateLabelParent] = useState(null);
  const [createLabelValue, setCreateLabelValue] = useState('');
  const [isRenamingLabel, setIsRenamingLabel] = useState(false);
  const [renamingLabelValue, setRenamingLabelValue] = useState('');
  const [dragOverLabelId, setDragOverLabelId] = useState(null);
  const [draggingLabelId, setDraggingLabelId] = useState(null);
  const [treeContextMenu, setTreeContextMenu] = useState(null);
  const [inlineRenameNodeId, setInlineRenameNodeId] = useState(null);
  const [inlineRenameValue, setInlineRenameValue] = useState('');
  const [moveLabelSource, setMoveLabelSource] = useState(null);
  const [moveLabelTarget, setMoveLabelTarget] = useState('');
  const [mergeLabelSource, setMergeLabelSource] = useState(null);
  const [mergeLabelTarget, setMergeLabelTarget] = useState('');
  const [mergeNameChoice, setMergeNameChoice] = useState('target');
  const [mergeCustomName, setMergeCustomName] = useState('');
  const [labelDropMenu, setLabelDropMenu] = useState(null);
  const [tagThumbnailMenu, setTagThumbnailMenu] = useState(null);

  const appContext = useApp();
  const appShowStatus = appContext?.showStatus;
  const appShowUndoToast = appContext?.showUndoToast;
  const createGlobalTag = appContext?.createGlobalTag;
  const setGlobalTagWriteToMetadata = appContext?.setGlobalTagWriteToMetadata;
  const moveGlobalTag = appContext?.moveGlobalTag;
  const mergeGlobalTags = appContext?.mergeGlobalTags;
  const restoreDeletedGlobalTag = appContext?.restoreDeletedGlobalTag;
  const setGlobalTagThumbnail = appContext?.setGlobalTagThumbnail;
  const resetGlobalTagThumbnail = appContext?.resetGlobalTagThumbnail;
  const exportGlobalTagTree = appContext?.exportGlobalTagTree;
  const importGlobalTagTree = appContext?.importGlobalTagTree;
  const renameGlobalTag = appContext?.renameGlobalTag;
  const deleteGlobalTag = appContext?.deleteGlobalTag;

  const [saveStatus, setSaveStatus] = useState('');
  const saveStatusTimeoutRef = useRef(null);

  const objectUrlsRef = useRef([]);
  const tagImportInputRef = useRef(null);
  const imgRef = useRef(null);
  const viewerContainerRef = useRef(null);
  const initialSnapshotRef = useRef(null);
  const tagContextMenuRef = useRef(null);
  const tagThumbnailMenuRef = useRef(null);
  const labelDropMenuRef = useRef(null);

  const samePersonId = useCallback((a, b) => String(a ?? '') === String(b ?? ''), []);

  // Smart menu positioning with edge detection
  useLayoutEffect(() => {
    const adjustMenuPosition = (menuRef, menuState) => {
      if (!menuRef?.current || !menuState) return menuState;

      const rect = menuRef.current.getBoundingClientRect();
      const menuWidth = rect.width;
      const menuHeight = rect.height;
      let adjustedX = menuState.x;
      let adjustedY = menuState.y;

      // If menu extends past right edge, flip to left side of cursor
      if (menuState.x + menuWidth > window.innerWidth) {
        adjustedX = Math.max(8, menuState.x - menuWidth);
      }

      // If menu extends past bottom edge, flip to above cursor
      if (menuState.y + menuHeight > window.innerHeight) {
        adjustedY = Math.max(8, menuState.y - menuHeight);
      }

      return { ...menuState, x: adjustedX, y: adjustedY };
    };

    // Adjust tagContextMenu
    if (tagContextMenu && tagContextMenuRef.current) {
      const adjusted = adjustMenuPosition(tagContextMenuRef, tagContextMenu);
      if (adjusted.x !== tagContextMenu.x || adjusted.y !== tagContextMenu.y) {
        setTagContextMenu(adjusted);
      }
    }

    // Adjust tagThumbnailMenu
    if (tagThumbnailMenu && tagThumbnailMenuRef.current) {
      const adjusted = adjustMenuPosition(tagThumbnailMenuRef, tagThumbnailMenu);
      if (adjusted.x !== tagThumbnailMenu.x || adjusted.y !== tagThumbnailMenu.y) {
        setTagThumbnailMenu(adjusted);
      }
    }

    // Adjust labelDropMenu
    if (labelDropMenu && labelDropMenuRef.current) {
      const adjusted = adjustMenuPosition(labelDropMenuRef, labelDropMenu);
      if (adjusted.x !== labelDropMenu.x || adjusted.y !== labelDropMenu.y) {
        setLabelDropMenu(adjusted);
      }
    }
  }, [tagContextMenu, tagThumbnailMenu, labelDropMenu]);

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

  const hasUnsavedChanges = useMemo(() => {
    const initial = initialSnapshotRef.current;
    if (!initial) return false;

    const current = {
      title: String(metaTitle || ''),
      description: String(metaDescription || ''),
      date: String(metaDate || ''),
      time: String(metaTime || ''),
      tags: Array.from(new Set((Array.isArray(imageTags) ? imageTags : []).map((tag) => String(tag).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv')),
      regions: JSON.stringify((localRegions || []).map((region) => ({
        personId: String(region.personId || ''),
        label: String(region.label || ''),
        x: Number(region.x),
        y: Number(region.y),
        w: Number(region.w),
        h: Number(region.h)
      }))),
      photographer: String(photographer || '')
    };

    return (
      hasDestructiveChanges ||
      current.title !== initial.title ||
      current.description !== initial.description ||
      current.date !== initial.date ||
      current.time !== initial.time ||
      current.photographer !== initial.photographer ||
      JSON.stringify(current.tags) !== JSON.stringify(initial.tags) ||
      current.regions !== initial.regions
    );
  }, [metaTitle, metaDescription, metaDate, metaTime, imageTags, localRegions, photographer, hasDestructiveChanges]);

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

    const parsedDateTime = splitDateTime(imageMeta?.date || imageMeta?.datetime || '');
    setMetaDate(parsedDateTime.date);
    setMetaTime(parsedDateTime.time);

    const incomingTags = Array.isArray(imageMeta?.tags)
      ? imageMeta.tags
      : typeof imageMeta?.tags === 'string'
        ? imageMeta.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];
    const normalizedTags = Array.from(new Set(incomingTags.map((tag) => String(tag).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'sv'));
    setImageTags(normalizedTags);

    initialSnapshotRef.current = {
      title: String(imageMeta?.name || imageTitle || ''),
      description: String(imageMeta?.description || imageMeta?.note || ''),
      date: parsedDateTime.date,
      time: parsedDateTime.time,
      tags: normalizedTags,
      photographer: String(imageMeta?.photographer || imageMeta?.creator || imageMeta?.artist || ''),
      regions: JSON.stringify((Array.isArray(regions) ? regions : []).map((region) => ({
        personId: String(region.personId || ''),
        label: String(region.label || ''),
        x: Number(region.x),
        y: Number(region.y),
        w: Number(region.w),
        h: Number(region.h)
      })))
    };
  }, [isOpen, imageMeta?.id, imageMeta?.name, imageMeta?.description, imageMeta?.note, imageMeta?.photographer, imageMeta?.creator, imageMeta?.artist, imageMeta?.tags, imageMeta?.date, imageMeta?.datetime, imageTitle, regions]);

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
          if (initialSnapshotRef.current) {
            initialSnapshotRef.current.description = String(nextExifData.metadata.description);
          }
        }

        if (!metaTitle && (nextExifData.metadata?.title || nextExifData.metadata?.document_name)) {
          const nextTitle = String(nextExifData.metadata?.title || nextExifData.metadata?.document_name || '');
          setMetaTitle(nextTitle);
          if (initialSnapshotRef.current) {
            initialSnapshotRef.current.title = nextTitle;
          }
        }

        if (!photographer && (nextExifData.metadata?.artist || nextExifData.metadata?.creator || nextExifData.metadata?.photographer)) {
          const nextPhotographer = String(nextExifData.metadata?.artist || nextExifData.metadata?.creator || nextExifData.metadata?.photographer || '');
          setPhotographer(nextPhotographer);
          if (initialSnapshotRef.current) {
            initialSnapshotRef.current.photographer = nextPhotographer;
          }
        }

        if (!metaDate && (nextExifData.metadata?.date_taken || nextExifData.metadata?.date || nextExifData.metadata?.datetime)) {
          const parsed = splitDateTime(nextExifData.metadata?.date_taken || nextExifData.metadata?.date || nextExifData.metadata?.datetime || '');
          setMetaDate(parsed.date);
          setMetaTime((current) => current || parsed.time);
          if (initialSnapshotRef.current) {
            initialSnapshotRef.current.date = parsed.date;
            initialSnapshotRef.current.time = initialSnapshotRef.current.time || parsed.time;
          }
        }
      } catch (exifError) {
        console.warn('[ImageViewer] EXIF read failed:', exifError);
      }
    };

    loadExif();

    return () => {
      cancelled = true;
    };
  }, [isOpen, resolvedFilePath, localRegions, metaDescription, metaTitle, photographer, metaDate]);

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
        if (e.cancelable) e.preventDefault();
        onPrev();
      }
      if (e.key === 'ArrowRight' && hasNext && onNext) {
        if (e.cancelable) e.preventDefault();
        onNext();
      }
      if (e.key === 'Escape') {
        if (e.cancelable) e.preventDefault();
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
    if (e.cancelable) e.preventDefault();
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

  const allLabels = useMemo(() => {
    return (Array.isArray(tagStats) ? tagStats : []).map((stat) => ({
      id: String(stat?.id || stat?.name || ''),
      name: String(stat?.name || '').trim(),
      count: Number(stat?.count || 0),
      applied: Array.isArray(imageTags) && imageTags.includes(String(stat?.name || '').trim()),
      parentId: stat?.parentId ? String(stat.parentId) : null,
      thumbnail: String(stat?.thumbnail || ''),
      writeToMetadata: Boolean(stat?.writeToMetadata),
      displayName: String(stat?.displayName || ''),
      protected: Boolean(stat?.protected)
    }));
  }, [tagStats, imageTags]);

  const labelsById = useMemo(() => {
    return new Map(allLabels.map((label) => [String(label.id), label]));
  }, [allLabels]);

  const childIdsByParent = useMemo(() => {
    const map = new Map();
    allLabels.forEach((label) => {
      const parentId = label.parentId ? String(label.parentId) : '__root__';
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId).push(String(label.id));
    });
    return map;
  }, [allLabels]);

  const labelQuickStats = useMemo(() => {
    const total = allLabels.length;
    const unused = allLabels.filter((label) => Number(label.count || 0) === 0).length;
    const people = allLabels.filter((label) => {
      const id = String(label.id || '');
      return id.startsWith('Människor/') || id.startsWith('Faces/');
    }).length;
    return { total, unused, people };
  }, [allLabels]);

  // Filtrera etiketter baserat på aktuell databasstatistik och bildens taggar
  const filteredLabels = useMemo(() => {
    let items = [...allLabels];

    if (labelFilterMode === 'applied') {
      items = items.filter((label) => label.applied);
    } else if (labelFilterMode === 'unused') {
      items = items.filter((label) => Number(label.count || 0) === 0);
    }

    if (labelSearchTerm.trim()) {
      const query = labelSearchTerm.trim().toLowerCase();
      items = items.filter((label) => label.name.toLowerCase().includes(query));
    }

    return items;
  }, [allLabels, labelFilterMode, labelSearchTerm]);

  const treeSearchQuery = labelSearchTerm.trim().toLowerCase();

  const { treeLabels, treeAutoExpandIds } = useMemo(() => {
    const base = labelFilterMode === 'applied'
      ? allLabels.filter((label) => label.applied)
      : labelFilterMode === 'unused'
        ? allLabels.filter((label) => Number(label.count || 0) === 0)
        : allLabels;

    const matchIds = new Set(
      (treeSearchQuery
        ? base.filter((label) => {
            const fullName = String(label.name || '').toLowerCase();
            const display = String(label.displayName || '').toLowerCase();
            return fullName.includes(treeSearchQuery) || display.includes(treeSearchQuery);
          })
        : base
      ).map((label) => String(label.id))
    );

    const visibleIds = new Set(matchIds);
    const autoExpandIds = new Set();

    const addAncestors = (id) => {
      let current = labelsById.get(String(id));
      while (current?.parentId) {
        const parentId = String(current.parentId);
        visibleIds.add(parentId);
        autoExpandIds.add(parentId);
        current = labelsById.get(parentId);
      }
    };

    const addDescendants = (id) => {
      const children = childIdsByParent.get(String(id)) || [];
      children.forEach((childId) => {
        visibleIds.add(childId);
        addDescendants(childId);
      });
    };

    if (treeSearchQuery) {
      matchIds.forEach((id) => {
        addAncestors(id);
        addDescendants(id);
      });
    }

    if (labelFilterMode !== 'all' && !treeSearchQuery) {
      matchIds.forEach((id) => addAncestors(id));
    }

    const items = Array.from(visibleIds)
      .map((id) => labelsById.get(id))
      .filter(Boolean);

    return { treeLabels: items, treeAutoExpandIds: autoExpandIds };
  }, [allLabels, labelFilterMode, treeSearchQuery, labelsById, childIdsByParent]);

  const labelSuggestions = useMemo(() => {
    const query = labelSearchTerm.trim();
    if (!query) {
      return filteredLabels.slice(0, 40).map((label) => ({
        id: label.id,
        name: label.name,
        isNew: false,
        applied: label.applied,
        count: label.count
      }));
    }

    const lowered = query.toLowerCase();
    const matches = filteredLabels
      .filter((label) => String(label.name || '').toLowerCase().includes(lowered))
      .slice(0, 40)
      .map((label) => ({
        id: label.id,
        name: label.name,
        isNew: false,
        applied: label.applied,
        count: label.count
      }));

    const exists = (Array.isArray(tagStats) ? tagStats : [])
      .some((stat) => String(stat?.name || '').trim().toLowerCase() === lowered);

    if (!exists) {
      matches.unshift({
        id: `new_${query}`,
        name: query,
        isNew: true,
        applied: false,
        count: 0
      });
    }

    return matches;
  }, [filteredLabels, labelSearchTerm, tagStats]);

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
    const nodeMap = new Map();
    const roots = [];

    treeLabels.forEach((label) => {
      const id = String(label.id || '').trim();
      if (!id) return;
      nodeMap.set(id, {
        id,
        name: String(label.displayName || label.name || id.split('/').pop() || '').trim(),
        fullName: String(label.name || id),
        count: Number(label.count || 0),
        applied: Boolean(label.applied),
        writeToMetadata: Boolean(label.writeToMetadata),
        thumbnail: String(label.thumbnail || ''),
        protected: Boolean(label.protected),
        parentId: label.parentId ? String(label.parentId) : null,
        children: [],
        subtreeTagNames: []
      });
    });

    Array.from(nodeMap.values()).forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortTree = (nodes) => {
      nodes.sort((a, b) => String(a.name).localeCompare(String(b.name), 'sv'));
      nodes.forEach((node) => sortTree(node.children));
    };

    const assignSubtreeTags = (node) => {
      const own = node.fullName ? [node.fullName] : [];
      const childTags = node.children.flatMap((child) => assignSubtreeTags(child));
      node.subtreeTagNames = Array.from(new Set([...own, ...childTags]));
      return node.subtreeTagNames;
    };

    sortTree(roots);
    roots.forEach((rootNode) => assignSubtreeTags(rootNode));
    return roots;
  }, [treeLabels]);

  const selectedLabel = useMemo(() => {
    if (!selectedLabelId) return null;

    const findNode = (nodes) => {
      for (const node of nodes) {
        if (node.id === selectedLabelId) return node;
        if (Array.isArray(node.children) && node.children.length > 0) {
          const match = findNode(node.children);
          if (match) return match;
        }
      }
      return null;
    };

    return findNode(labelTree);
  }, [labelTree, selectedLabelId]);

  const selectedTagMediaItems = useMemo(() => {
    const targetTag = String(selectedLabel?.fullName || '').trim();
    const mediaList = Array.isArray(appContext?.dbData?.media) ? appContext.dbData.media : [];
    if (!targetTag || mediaList.length === 0) return [];

    return mediaList.filter((item) => {
      const tags = Array.isArray(item?.tags)
        ? item.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
        : typeof item?.tags === 'string'
          ? item.tags.split(',').map((tag) => String(tag || '').trim()).filter(Boolean)
          : [];
      return tags.includes(targetTag);
    });
  }, [selectedLabel, appContext?.dbData?.media]);

  const moveTargetOptions = useMemo(() => {
    if (!moveLabelSource?.fullName) return [];
    const source = String(moveLabelSource.fullName || '');
    return allLabels
      .map((label) => String(label.name || '').trim())
      .filter((name) => name && name !== source && !name.startsWith(`${source}/`))
      .sort((a, b) => a.localeCompare(b, 'sv'));
  }, [allLabels, moveLabelSource]);

  const mergeTargetOptions = useMemo(() => {
    if (!mergeLabelSource?.fullName) return [];
    const source = String(mergeLabelSource.fullName || '');
    return allLabels
      .map((label) => String(label.name || '').trim())
      .filter((name) => name && name !== source)
      .sort((a, b) => a.localeCompare(b, 'sv'));
  }, [allLabels, mergeLabelSource]);

  useEffect(() => {
    if (!tagContextMenu && !tagThumbnailMenu && !labelDropMenu && !treeContextMenu) return undefined;

    const handleCloseAllMenus = (event) => {
      const target = event?.target;
      const insideMenu = target && target.closest && target.closest('[data-popup-menu="true"]');
      if (insideMenu) return;

      setTagContextMenu(null);
      setTagThumbnailMenu(null);
      setLabelDropMenu(null);
      setTreeContextMenu(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setTagContextMenu(null);
        setTagThumbnailMenu(null);
        setLabelDropMenu(null);
      }
    };

    window.addEventListener('pointerdown', handleCloseAllMenus, true);
    window.addEventListener('contextmenu', handleCloseAllMenus, true);
    window.addEventListener('scroll', handleCloseAllMenus, true);
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      window.removeEventListener('pointerdown', handleCloseAllMenus, true);
      window.removeEventListener('contextmenu', handleCloseAllMenus, true);
      window.removeEventListener('scroll', handleCloseAllMenus, true);
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [tagContextMenu, tagThumbnailMenu, labelDropMenu]);

  useEffect(() => {
    if (tagContextMenu) {
      setTagContextMenuIndex(0);
    }
  }, [tagContextMenu]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof createGlobalTag !== 'function') return;

    const nameByPersonId = new Map(
      (people || []).map((person) => [String(person.id), `${person.firstName || ''} ${person.lastName || ''}`.trim()])
    );

    const faceNames = Array.from(new Set(
      (localRegions || [])
        .map((region) => {
          const byPerson = nameByPersonId.get(String(region.personId || '')) || '';
          return String(byPerson || region.label || '').trim();
        })
        .filter(Boolean)
    ));

    createGlobalTag({ name: FACE_ROOT_LABEL, parentId: null, writeToMetadata: false });

    const faceTagPaths = faceNames.map((name) => {
      createGlobalTag({ name, parentId: FACE_ROOT_LABEL, writeToMetadata: true });
      return `${FACE_ROOT_LABEL}/${name}`;
    });

    if (faceTagPaths.length === 0) return;

    setImageTags((prev) => {
      const merged = Array.from(new Set([...(Array.isArray(prev) ? prev : []), ...faceTagPaths]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'sv'));

      if (merged.length !== prev.length || merged.some((tag, index) => tag !== prev[index])) {
        if (typeof onSaveImageMeta === 'function') {
          onSaveImageMeta({ tags: merged });
        }
      }
      return merged;
    });
  }, [isOpen, localRegions, people, createGlobalTag, onSaveImageMeta]);

  useEffect(() => {
    if (!isEditLabelsModalOpen) return;

    const onKeyDown = (e) => {
      if (e.key !== 'F2') return;
      if (!selectedLabel?.fullName) return;

      const target = e.target;
      const typingInField = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (typingInField) return;

      e.preventDefault();
      setInlineRenameNodeId(selectedLabel.id);
      setInlineRenameValue(String(selectedLabel.fullName || ''));
      setTagContextMenu(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditLabelsModalOpen, selectedLabel]);

  const saveMetaPatch = useCallback((patch) => {
    if (typeof onSaveImageMeta !== 'function') return;
    onSaveImageMeta({
      name: metaTitle,
      description: metaDescription,
      note: metaDescription,
      date: mergeDateTime(metaDate, metaTime),
      tags: imageTags,
      photographer,
      creator: photographer,
      ...patch
    });
  }, [onSaveImageMeta, metaTitle, metaDescription, metaDate, metaTime, imageTags, photographer]);

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

  const handleCreateAndApplyLabel = useCallback((inputValue) => {
    const newLabel = String(inputValue || '').trim();
    if (!newLabel) return;

    if (typeof createGlobalTag === 'function') {
      const parts = newLabel.split('/').map((part) => part.trim()).filter(Boolean);
      let parentId = null;
      for (const part of parts) {
        const result = createGlobalTag({ name: part, parentId, writeToMetadata: Boolean(parentId) });
        if (!result?.success && !String(result?.error || '').toLowerCase().includes('finns redan')) {
          appShowStatus?.(result?.error || 'Kunde inte skapa etikett.', 'error');
          return;
        }
        parentId = parentId ? `${parentId}/${part}` : part;
      }
    }

    toggleImageTag(newLabel, true);
    setLabelSearchTerm('');
  }, [toggleImageTag, createGlobalTag, appShowStatus]);

  const handleCreateChildLabel = useCallback(() => {
    const parentName = String(createLabelParent?.fullName || '').trim();
    const childName = String(createLabelValue || '').trim();
    if (!childName) return;

    if (typeof createGlobalTag === 'function') {
      const createResult = createGlobalTag({
        name: childName,
        parentId: parentName || null,
        writeToMetadata: Boolean(parentName)
      });

      if (!createResult?.success && !String(createResult?.error || '').toLowerCase().includes('finns redan')) {
        appShowStatus?.(createResult?.error || 'Kunde inte skapa etikett.', 'error');
        return;
      }
    }

    const newFullName = parentName ? `${parentName}/${childName}` : childName;
    toggleImageTag(newFullName, true);
    setCreateLabelParent(null);
    setCreateLabelValue('');
    setTagContextMenu(null);
    setSelectedLabelId(newFullName);
  }, [createLabelParent, createLabelValue, toggleImageTag, createGlobalTag, appShowStatus]);

  const handleToggleSelectedLabelWriteToMetadata = useCallback((nextChecked) => {
    if (!selectedLabel?.fullName || typeof setGlobalTagWriteToMetadata !== 'function') return;

    const result = setGlobalTagWriteToMetadata(selectedLabel.fullName, Boolean(nextChecked));
    if (!result?.success) {
      appShowStatus?.(result?.error || 'Kunde inte uppdatera metadata-inställning.', 'error');
      return;
    }

    appShowStatus?.('Metadata-inställningen uppdaterades.', 'success');
  }, [selectedLabel, setGlobalTagWriteToMetadata, appShowStatus]);

  const loadImageForThumbnail = useCallback(async (mediaItem) => {
    const directUrl = String(mediaItem?.url || '').trim();
    let tempUrl = '';
    let finalUrl = directUrl;

    if ((!finalUrl || finalUrl.startsWith('media://')) && window.electronAPI?.readFile) {
      const filePath = resolveMediaPathFromItem(mediaItem);
      if (filePath) {
        const data = await window.electronAPI.readFile(filePath);
        if (data && !data.error) {
          const blob = new Blob([data], { type: getMimeTypeFromName(mediaItem?.name || mediaItem?.filePath || '') });
          tempUrl = URL.createObjectURL(blob);
          finalUrl = tempUrl;
        }
      }
    }

    if (!finalUrl) {
      throw new Error('Kunde inte läsa bild för miniatyr.');
    }

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Kunde inte ladda bild för miniatyr.'));
      image.src = finalUrl;
    });

    return {
      image: img,
      cleanup: () => {
        if (tempUrl) URL.revokeObjectURL(tempUrl);
      }
    };
  }, []);

  const generateFaceTagThumbnailDataUrl = useCallback(async (tagPath, mediaItem) => {
    const leaf = String(tagPath || '').split('/').filter(Boolean).pop()?.trim();
    if (!leaf) return '';

    let regions = Array.isArray(mediaItem?.regions)
      ? mediaItem.regions
      : Array.isArray(mediaItem?.faces)
        ? mediaItem.faces
        : [];

    if ((!regions || regions.length === 0) && localRegions.length > 0) {
      const mediaPath = resolveMediaPathFromItem(mediaItem);
      if (mediaPath && resolvedFilePath && String(mediaPath) === String(resolvedFilePath)) {
        regions = localRegions;
      }
    }

    const matchingRegion = regions.find((region) => String(region?.label || region?.name || '').trim().toLowerCase() === leaf.toLowerCase());
    if (!matchingRegion) return '';

    const { image, cleanup } = await loadImageForThumbnail(mediaItem);
    try {
      const sourceW = image.naturalWidth || image.width;
      const sourceH = image.naturalHeight || image.height;
      const sx = Math.max(0, Math.min(sourceW - 1, (Number(matchingRegion.x || 0) / 100) * sourceW));
      const sy = Math.max(0, Math.min(sourceH - 1, (Number(matchingRegion.y || 0) / 100) * sourceH));
      const sw = Math.max(1, Math.min(sourceW - sx, (Number(matchingRegion.w || 0) / 100) * sourceW));
      const sh = Math.max(1, Math.min(sourceH - sy, (Number(matchingRegion.h || 0) / 100) * sourceH));

      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 96, 96);
      return canvas.toDataURL('image/jpeg', 0.85);
    } finally {
      cleanup?.();
    }
  }, [loadImageForThumbnail, localRegions, resolvedFilePath]);

  const handleSetTagThumbnailFromMedia = useCallback(async (mediaItem, tagPath) => {
    const targetTag = String(tagPath || selectedLabel?.fullName || '').trim();
    if (!targetTag || typeof setGlobalTagThumbnail !== 'function') return;

    try {
      let thumbnailValue = String(mediaItem?.url || resolveMediaPathFromItem(mediaItem) || '').trim();
      if (isFaceTagPath(targetTag)) {
        const faceThumb = await generateFaceTagThumbnailDataUrl(targetTag, mediaItem);
        if (faceThumb) {
          thumbnailValue = faceThumb;
        }
      }

      const result = setGlobalTagThumbnail(targetTag, thumbnailValue);
      if (!result?.success) {
        appShowStatus?.(result?.error || 'Kunde inte spara miniatyr.', 'error');
      } else {
        appShowStatus?.('Miniatyren uppdaterades för taggen.', 'success');
      }
    } catch (error) {
      appShowStatus?.(error?.message || 'Kunde inte skapa miniatyr.', 'error');
    }
  }, [selectedLabel, setGlobalTagThumbnail, appShowStatus, generateFaceTagThumbnailDataUrl]);

  const handleExportTagTree = useCallback(() => {
    if (typeof exportGlobalTagTree !== 'function') return;
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      tags: exportGlobalTagTree()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `taggtrad-backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    appShowStatus?.('Tagg-trädet exporterades.', 'success');
  }, [exportGlobalTagTree, appShowStatus]);

  const handleImportTagTreeFile = useCallback(async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incomingTags = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.tags)
          ? parsed.tags
          : [];

      if (typeof importGlobalTagTree !== 'function') return;
      const result = importGlobalTagTree(incomingTags);
      if (result?.success) {
        appShowStatus?.(`Importerade ${result.importedCount} taggar från backup.`, 'success');
      } else {
        appShowStatus?.(result?.error || 'Kunde inte importera tagg-trädet.', 'error');
      }
    } catch (error) {
      appShowStatus?.(`Import misslyckades: ${error?.message || 'okänt fel'}`, 'error');
    } finally {
      if (event?.target) {
        event.target.value = '';
      }
    }
  }, [importGlobalTagTree, appShowStatus]);

  const handleOpenItemInFolder = useCallback(() => {
    if (!resolvedFilePath || !window.electronAPI?.showItemInFolder) return;
    window.electronAPI.showItemInFolder(resolvedFilePath);
  }, [resolvedFilePath]);

  const handleOpenDirectory = useCallback(() => {
    if (!fileInfo.dirPath || !window.electronAPI?.openFolder) return;
    window.electronAPI.openFolder(fileInfo.dirPath);
  }, [fileInfo.dirPath]);

  const handlePhotographerPicked = useCallback((personId) => {
    const selectedPerson = people.find((person) => samePersonId(person.id, personId));
    if (!selectedPerson) return;
    const fullName = `${selectedPerson.firstName || ''} ${selectedPerson.lastName || ''}`.trim();
    setPhotographer(fullName);
    saveMetaPatch({ photographer: fullName, creator: fullName });
  }, [people, samePersonId, saveMetaPatch]);

  const handleOpenRenameLabel = useCallback((label) => {
    if (label?.protected) {
      appShowStatus?.('Denna huvudgrupp är skyddad och kan inte byta namn.', 'error');
      return;
    }
    setRenameLabelTarget(null);
    setRenameLabelValue('');
    setInlineRenameNodeId(label?.id || null);
    setInlineRenameValue(String(label?.fullName || label?.name || ''));
  }, [appShowStatus]);

  const handleOpenCreateChildLabel = useCallback((label) => {
    setCreateLabelParent(label);
    setCreateLabelValue('');
    setTagContextMenu(null);
  }, []);

  const handleLogRenameLabel = useCallback(async () => {
    if (!renameLabelTarget) return;
    const oldName = String(renameLabelTarget.fullName || renameLabelTarget.name || '').trim();
    const newName = String(renameLabelValue || '').trim();
    if (!newName || newName === oldName) return;

    if (typeof renameGlobalTag === 'function') {
      const result = await renameGlobalTag(oldName, newName);
      if (result?.success) {
        appShowStatus?.(`Bytte namn på etiketten '${oldName}' till '${newName}'.`, 'success');
      } else {
        appShowStatus?.(result?.error || 'Kunde inte byta namn på etikett.', 'error');
      }
    }

    setRenameLabelTarget(null);
    setRenameLabelValue('');
    setInlineRenameNodeId(null);
    setInlineRenameValue('');
  }, [renameLabelTarget, renameLabelValue, renameGlobalTag, appShowStatus]);

  const handleSubmitInlineRename = useCallback(async (node) => {
    const oldName = String(node?.fullName || node?.name || '').trim();
    const newName = String(inlineRenameValue || '').trim();
    if (!oldName) return;

    if (!newName || newName === oldName) {
      setInlineRenameNodeId(null);
      setInlineRenameValue('');
      return;
    }

    if (typeof renameGlobalTag === 'function') {
      const result = await renameGlobalTag(oldName, newName);
      if (result?.success) {
        appShowStatus?.(`Bytte namn på etiketten '${oldName}' till '${newName}'.`, 'success');
        setSelectedLabelId(newName);
      } else {
        appShowStatus?.(result?.error || 'Kunde inte byta namn på etikett.', 'error');
      }
    }

    setInlineRenameNodeId(null);
    setInlineRenameValue('');
  }, [inlineRenameValue, renameGlobalTag, appShowStatus]);

  const handleLogDeleteLabel = useCallback(async (label) => {
    if (!label) return;
    if (label?.protected) {
      appShowStatus?.('Denna huvudgrupp är skyddad och kan inte raderas.', 'error');
      return;
    }
    const labelName = String(label.fullName || label.name || '').trim();
    const count = Number(label.count || 0);
    if (!labelName) return;

    const confirmed = window.confirm(`Denna tagg används på ${count} foton. Tar du bort taggen försvinner den från bilderna. Vill du fortsätta?`);
    if (!confirmed) return;

    if (typeof deleteGlobalTag === 'function') {
      const result = await deleteGlobalTag(labelName);
      if (result?.success) {
        appShowStatus?.(`Raderade etiketten '${labelName}'.`, 'success');
        if (result?.snapshot && typeof appShowUndoToast === 'function') {
          appShowUndoToast('Tagg raderad. Ångra?', async () => {
            if (typeof restoreDeletedGlobalTag === 'function') {
              await restoreDeletedGlobalTag(result.snapshot);
              appShowStatus?.(`Återställde etiketten '${labelName}'.`, 'success');
            }
          });
        }
      } else {
        appShowStatus?.(result?.error || 'Kunde inte radera etikett.', 'error');
      }
    }
  }, [deleteGlobalTag, restoreDeletedGlobalTag, appShowStatus, appShowUndoToast]);

  const handleTagContextMenuAction = useCallback((actionKey) => {
    if (!tagContextMenu?.targetNode) return;

    const targetNode = tagContextMenu.targetNode;
    if (actionKey === 'create-child') {
      handleOpenCreateChildLabel(targetNode);
      return;
    }
    if (actionKey === 'rename') {
      handleOpenRenameLabel(targetNode);
      setTagContextMenu(null);
      return;
    }
    if (actionKey === 'move') {
      if (targetNode?.protected) {
        appShowStatus?.('Denna huvudgrupp är skyddad och kan inte flyttas.', 'error');
        setTagContextMenu(null);
        return;
      }
      setMoveLabelSource(targetNode);
      setMoveLabelTarget('');
      setTagContextMenu(null);
      return;
    }
    if (actionKey === 'merge') {
      if (targetNode?.protected) {
        appShowStatus?.('Denna huvudgrupp är skyddad och kan inte slås ihop.', 'error');
        setTagContextMenu(null);
        return;
      }
      setMergeLabelSource(targetNode);
      setMergeLabelTarget('');
      setMergeNameChoice('target');
      setMergeCustomName('');
      setTagContextMenu(null);
      return;
    }
    if (actionKey === 'reset-thumbnail') {
      if (!targetNode?.fullName || typeof resetGlobalTagThumbnail !== 'function') {
        setTagContextMenu(null);
        return;
      }
      const result = resetGlobalTagThumbnail(targetNode.fullName);
      if (!result?.success) {
        appShowStatus?.(result?.error || 'Kunde inte återställa miniatyr.', 'error');
      } else {
        appShowStatus?.('Miniatyren återställdes till standardikon.', 'success');
      }
      setTagContextMenu(null);
      return;
    }
    if (actionKey === 'delete') {
      handleLogDeleteLabel(targetNode);
      setTagContextMenu(null);
    }
  }, [tagContextMenu, handleOpenCreateChildLabel, handleOpenRenameLabel, handleLogDeleteLabel, appShowStatus, resetGlobalTagThumbnail]);

  const handleTreeSelect = useCallback((labelId) => {
    setSelectedLabelId(labelId);
  }, []);

  const handleTreeContextMenu = useCallback((event, targetNode) => {
    event.preventDefault();
    event.stopPropagation();
    setTagThumbnailMenu(null);
    setLabelDropMenu(null);
    setSelectedLabelId(targetNode.id);
    setTagContextMenu({ x: event.clientX, y: event.clientY, targetNode });
  }, []);

  const handleTreeDragEnd = useCallback(() => {
    setDragOverLabelId(null);
    setDraggingLabelId(null);
  }, []);

  const imageTagSet = useMemo(() => {
    return new Set(
      (Array.isArray(imageTags) ? imageTags : [])
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    );
  }, [imageTags]);

  const handleConfirmMoveFromModal = useCallback(async () => {
    const sourceName = String(moveLabelSource?.fullName || '').trim();
    const targetName = String(moveLabelTarget || '').trim();
    if (!sourceName || !targetName) return;

    const confirmed = window.confirm('Vill du flytta denna tagg till vald målgrupp?');
    if (!confirmed) return;

    if (typeof moveGlobalTag === 'function') {
      const result = await moveGlobalTag(sourceName, targetName);
      if (result?.success) {
        appShowStatus?.(`Flyttade etiketten '${sourceName}' till '${result.newPath}'.`, 'success');
        setSelectedLabelId(result.newPath);
      } else {
        appShowStatus?.(result?.error || 'Kunde inte flytta etiketten.', 'error');
      }
    }

    setMoveLabelSource(null);
    setMoveLabelTarget('');
  }, [moveLabelSource, moveLabelTarget, moveGlobalTag, appShowStatus]);

  const handleConfirmMergeLabels = useCallback(async () => {
    const sourceName = String(mergeLabelSource?.fullName || '').trim();
    const targetName = String(mergeLabelTarget || '').trim();
    if (!sourceName || !targetName) return;

    const finalName = mergeNameChoice === 'source'
      ? sourceName
      : mergeNameChoice === 'custom'
        ? String(mergeCustomName || '').trim()
        : targetName;

    if (!finalName) return;

    if (typeof mergeGlobalTags === 'function') {
      const result = await mergeGlobalTags({
        sourceTagName: sourceName,
        targetTagName: targetName,
        keepName: finalName
      });

      if (result?.success) {
        appShowStatus?.(`Slog ihop '${sourceName}' med '${targetName}' till '${result.finalTag}'.`, 'success');
        setSelectedLabelId(result.finalTag);
      } else {
        appShowStatus?.(result?.error || 'Kunde inte slå ihop etiketter.', 'error');
      }
    }

    setMergeLabelSource(null);
    setMergeLabelTarget('');
    setMergeNameChoice('target');
    setMergeCustomName('');
  }, [mergeLabelSource, mergeLabelTarget, mergeNameChoice, mergeCustomName, mergeGlobalTags, appShowStatus]);

  const handleExecuteMoveLabel = useCallback(async (draggedNode, targetNode) => {
    if (!draggedNode || !targetNode || !draggedNode.fullName || !targetNode.fullName) return;
    if (draggedNode?.protected) {
      appShowStatus?.('Denna huvudgrupp är skyddad och kan inte flyttas.', 'error');
      return;
    }
    if (draggedNode.fullName === targetNode.fullName) return;
    if (targetNode.fullName.startsWith(`${draggedNode.fullName}/`)) return;

    if (typeof moveGlobalTag !== 'function') return;

    const result = await moveGlobalTag(draggedNode.fullName, targetNode.fullName);
    if (result?.success) {
      appShowStatus?.(`Flyttade etiketten '${result.oldPath}' till '${result.newPath}'.`, 'success');
      setSelectedLabelId(result.newPath);
      if (typeof appShowUndoToast === 'function') {
        appShowUndoToast('Etikett flyttad. Ångra?', async () => {
          await renameGlobalTag?.(result.newPath, result.oldPath);
        });
      }
    } else {
      appShowStatus?.(result?.error || 'Kunde inte flytta etiketten.', 'error');
    }
  }, [moveGlobalTag, appShowStatus, appShowUndoToast, renameGlobalTag]);

  const handleMoveLabelInHierarchy = useCallback((draggedNode, targetNode, dropPoint) => {
    if (!draggedNode || !targetNode || !draggedNode.fullName || !targetNode.fullName) return;

    const sameNode = draggedNode.fullName === targetNode.fullName;
    const invalidMove = targetNode.fullName.startsWith(`${draggedNode.fullName}/`);
    if (sameNode || invalidMove) return;

    const canMove = !draggedNode?.protected;
    const canMerge = !draggedNode?.protected && !targetNode?.protected && !sameNode && !invalidMove &&
      !draggedNode.fullName.startsWith(`${targetNode.fullName}/`);

    setTagContextMenu(null);
    setTagThumbnailMenu(null);
    setLabelDropMenu({
      x: Number(dropPoint?.x || 0),
      y: Number(dropPoint?.y || 0),
      draggedNode,
      targetNode,
      canMove,
      canMerge
    });
  }, []);

  const handleDropMenuMove = useCallback(async () => {
    if (!labelDropMenu?.draggedNode || !labelDropMenu?.targetNode) {
      setLabelDropMenu(null);
      return;
    }
    await handleExecuteMoveLabel(labelDropMenu.draggedNode, labelDropMenu.targetNode);
    setLabelDropMenu(null);
  }, [labelDropMenu, handleExecuteMoveLabel]);

  const handleDropMenuMerge = useCallback(() => {
    if (!labelDropMenu?.draggedNode || !labelDropMenu?.targetNode) {
      setLabelDropMenu(null);
      return;
    }

    setMergeLabelSource(labelDropMenu.draggedNode);
    setMergeLabelTarget(String(labelDropMenu.targetNode.fullName || ''));
    setMergeNameChoice('target');
    setMergeCustomName('');
    setLabelDropMenu(null);
  }, [labelDropMenu]);

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

    const metadataEnabledTags = new Set(
      (Array.isArray(tagStats) ? tagStats : [])
        .filter((tag) => Boolean(tag?.writeToMetadata))
        .map((tag) => String(tag?.name || '').trim())
    );

    const mergedKeywords = Array.from(new Set(
      (Array.isArray(imageTags) ? imageTags : [])
        .map((tag) => String(tag || '').trim())
        .filter((tag) => tag && metadataEnabledTags.has(tag))
    ));

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
          date: mergeDateTime(metaDate, metaTime)
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
        date: mergeDateTime(metaDate, metaTime),
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
      date: mergeDateTime(metaDate, metaTime),
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

                  {showFaceBoxes && hoveredRegionIndex !== null && (
                    <div className="absolute inset-0 bg-black/35 pointer-events-none" />
                  )}

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
                      <div className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary truncate flex items-center justify-between gap-2">
                        <span className="truncate">{fileInfo.fileName}</span>
                        <button
                          type="button"
                          onClick={handleOpenItemInFolder}
                          className="inline-flex items-center justify-center w-5 h-5 rounded border border-subtle text-primary hover:text-accent hover:border-strong shrink-0"
                          title="Visa fil i utforskaren"
                        >
                          <FolderOpen size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Katalog/Sökväg */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Katalog</label>
                      <button
                        type="button"
                        onClick={handleOpenDirectory}
                        className="w-full text-left bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary break-all max-h-12 overflow-y-auto hover:border-strong"
                        title="Öppna mapp"
                      >
                        {fileInfo.dirPath}
                      </button>
                    </div>

                    {/* Datum */}
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Datum & Tid</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={metaDate}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMetaDate(value);
                            saveMetaPatch({ date: mergeDateTime(value, metaTime) });
                          }}
                          placeholder="YYYY-MM-DD"
                          className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        />
                        <input
                          type="text"
                          value={metaTime}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMetaTime(value);
                            saveMetaPatch({ date: mergeDateTime(metaDate, value) });
                          }}
                          placeholder="HH:MM:SS"
                          className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        />
                      </div>
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
                              hoveredRegionIndex === tagRegion.index ? 'bg-success/30 border-success shadow-[0_0_0_1px_rgba(16,185,129,0.45)]' : ''
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
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Rubrik</label>
                      <input
                        type="text"
                        value={metaTitle}
                        onChange={(e) => {
                          setMetaTitle(e.target.value);
                          saveMetaPatch({ name: e.target.value });
                        }}
                        className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        placeholder="Ange rubrik..."
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Beskrivning</label>
                      <textarea
                        value={metaDescription}
                        onChange={(e) => {
                          setMetaDescription(e.target.value);
                          saveMetaPatch({ description: e.target.value, note: e.target.value });
                        }}
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
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Sök/skapa etikett</label>
                      <div className="relative">
                        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          type="text"
                          value={labelSearchTerm}
                          onChange={(e) => setLabelSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const firstSuggestion = labelSuggestions[0];
                            if (firstSuggestion?.isNew) {
                              handleCreateAndApplyLabel(firstSuggestion.name);
                              return;
                            }
                            if (firstSuggestion?.name) {
                              toggleImageTag(firstSuggestion.name, true);
                              setLabelSearchTerm('');
                            }
                          }}
                          placeholder="Namn på etikett..."
                          className="w-full bg-background border border-subtle rounded pl-7 pr-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-secondary mb-1">Filter</label>
                      <select
                        value={labelFilterMode}
                        onChange={(e) => setLabelFilterMode(e.target.value)}
                        className="w-full bg-background border border-subtle rounded px-2 py-1 text-xs text-primary focus:outline-none focus:border-strong"
                      >
                        <option value="all">Alla taggar</option>
                        <option value="applied">Taggar på aktuell bild</option>
                        <option value="unused">Oanvända taggar</option>
                      </select>
                    </div>

                    <div className="text-xs text-secondary bg-surface-2 border border-subtle rounded px-2 py-1">
                      Totalt: {labelQuickStats.total} etiketter | {labelQuickStats.unused} oanvända | {labelQuickStats.people} personer
                    </div>

                    {/* Lista över etiketter */}
                    <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar border border-subtle rounded p-2 bg-surface-2">
                      {labelSuggestions.map((label) => (
                        label.isNew ? (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => handleCreateAndApplyLabel(label.name)}
                            className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-3 cursor-pointer group"
                          >
                            <Plus size={12} className="text-accent" />
                            <span className="flex-1 text-xs text-primary">+ {label.name}</span>
                            <span className="text-[10px] text-accent bg-accent-soft rounded px-1.5 py-0.5">Ny</span>
                          </button>
                        ) : (
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
                        )
                      ))}
                      {labelSuggestions.length === 0 && (
                        <p className="text-xs text-muted text-center py-4">Inga etiketter hittades</p>
                      )}
                    </div>

                    {/* Redigera Etiketter knapp */}
                    <button
                      type="button"
                      onClick={() => setIsEditLabelsModalOpen(true)}
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
              <Button onClick={onClose} variant="danger" size="sm" title="Avbryt / Stäng">
                <X size={14} />
              </Button>
              <div className="relative">
                {hasUnsavedChanges && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-warning animate-pulse" />
                )}
                <Button
                  onClick={handleSaveClick}
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  title={hasUnsavedChanges ? 'Spara osparade ändringar' : 'Spara'}
                >
                  <Save size={14} className={hasUnsavedChanges ? 'animate-pulse text-warning' : ''} />
                </Button>
              </div>
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
                    <p className="text-xs text-secondary">Hantera globala etiketter, metadata-export och hierarki.</p>
                  </div>
                    <Button
                      onClick={() => {
                        setIsEditLabelsModalOpen(false);
                        setSelectedLabelId(null);
                        setTagContextMenu(null);
                        setCreateLabelParent(null);
                        setInlineRenameNodeId(null);
                        setInlineRenameValue('');
                        setMoveLabelSource(null);
                        setMoveLabelTarget('');
                        setMergeLabelSource(null);
                        setMergeLabelTarget('');
                        setMergeNameChoice('target');
                        setMergeCustomName('');
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      Stäng
                    </Button>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden p-4">
                  <div className="flex h-full min-h-0 gap-4">
                    <div className="w-[40%] min-w-[280px] min-h-0 overflow-hidden rounded-lg border border-subtle bg-background">
                      <div className="border-b border-subtle bg-surface-2 px-3 py-2 flex justify-between items-center">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Etikett-träd</h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleExportTagTree}
                            className="text-accent hover:text-primary text-[10px] font-semibold"
                            title="Exportera tagg-träd"
                          >
                            Exportera
                          </button>
                          <button
                            onClick={() => tagImportInputRef.current?.click()}
                            className="text-accent hover:text-primary text-[10px] font-semibold"
                            title="Importera tagg-träd"
                          >
                            Importera
                          </button>
                          <input
                            ref={tagImportInputRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={handleImportTagTreeFile}
                          />
                          <button
                            onClick={() => {
                              setCreateLabelParent({ fullName: '', name: 'Rot' });
                              setCreateLabelValue('');
                            }}
                            className="text-accent hover:text-primary text-[10px] flex items-center gap-1 font-semibold"
                            title="Skapa ny huvudetikett"
                          >
                            <Plus size={12} /> Ny huvudetikett
                          </button>
                        </div>
                      </div>
                      <div className="px-3 py-2 border-b border-subtle bg-surface space-y-2">
                        <div className="relative">
                          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                          <input
                            type="text"
                            value={labelSearchTerm}
                            onChange={(e) => setLabelSearchTerm(e.target.value)}
                            placeholder="Sök etiketter..."
                            className="w-full bg-background border border-subtle rounded pl-6 pr-2 py-1 text-xs text-primary focus:outline-none focus:border-strong"
                          />
                        </div>
                        <select
                          value={labelFilterMode}
                          onChange={(e) => setLabelFilterMode(e.target.value)}
                          className="w-full bg-background border border-subtle rounded px-2 py-1 text-xs text-primary focus:outline-none focus:border-strong"
                        >
                          <option value="all">Alla taggar</option>
                          <option value="applied">Taggar på aktuell bild</option>
                          <option value="unused">Oanvända taggar</option>
                        </select>
                      </div>
                      <div
                        className="h-full max-h-[calc(80vh-11rem)] overflow-y-auto custom-scrollbar p-2 space-y-1"
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isEmptyArea = e.target === e.currentTarget;
                          if (isEmptyArea) {
                            setTreeContextMenu({ x: e.clientX, y: e.clientY });
                          }
                        }}
                      >
                        {labelTree.length === 0 ? (
                          <p className="text-sm text-muted p-2">Inga etiketter hittades.</p>
                        ) : (
                          labelTree.map((node) => (
                            <LabelTreeRow
                              key={node.id}
                              node={node}
                              depth={0}
                              selectedLabelId={selectedLabelId}
                              onSelect={handleTreeSelect}
                              dragOverLabelId={dragOverLabelId}
                              draggingLabelId={draggingLabelId}
                              onDragOverLabel={setDragOverLabelId}
                              onDragStartLabel={setDraggingLabelId}
                              onDragEndLabel={handleTreeDragEnd}
                              imageTagSet={imageTagSet}
                              onToggleTag={toggleImageTag}
                              searchQuery={treeSearchQuery}
                              autoExpandIds={treeAutoExpandIds}
                              onContextMenu={handleTreeContextMenu}
                              onRename={handleOpenRenameLabel}
                              onDelete={handleLogDeleteLabel}
                              onMoveLabel={handleMoveLabelInHierarchy}
                              inlineRenameNodeId={inlineRenameNodeId}
                              inlineRenameValue={inlineRenameValue}
                              onInlineRenameValueChange={setInlineRenameValue}
                              onInlineRenameCancel={() => {
                                setInlineRenameNodeId(null);
                                setInlineRenameValue('');
                              }}
                              onInlineRenameSubmit={handleSubmitInlineRename}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 min-h-0 rounded-lg border border-subtle bg-surface-2 overflow-hidden flex flex-col">
                      <div className="border-b border-subtle bg-surface px-3 py-2 shrink-0">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Egenskaper</h4>
                      </div>
                      <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                        {selectedLabel ? (
                          <>
                            <div className="rounded border border-subtle bg-background px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wide text-secondary mb-1">Namn</div>
                              <div className="flex items-center gap-2">
                                {String(selectedLabel.fullName || '').split('/').filter(Boolean)[0]?.match(/^(Person|Faces)$/i)
                                  ? <User size={14} className="text-accent flex-shrink-0" />
                                  : <Tag size={14} className="text-accent flex-shrink-0" />}
                                <input
                                  type="text"
                                  value={isRenamingLabel ? renamingLabelValue : selectedLabel.name}
                                  onChange={(e) => setRenamingLabelValue(e.target.value)}
                                  onFocus={() => { setIsRenamingLabel(true); setRenamingLabelValue(selectedLabel.name); }}
                                  onBlur={async () => {
                                    if (renamingLabelValue && renamingLabelValue !== selectedLabel.name && typeof renameGlobalTag === 'function') {
                                      try {
                                        const oldFullPath = selectedLabel.fullName;
                                        const newName = String(renamingLabelValue || '').trim();
                                        const parentPath = oldFullPath.substring(0, oldFullPath.lastIndexOf('/')) || '';
                                        const newFullPath = parentPath ? `${parentPath}/${newName}` : newName;
                                        const result = await renameGlobalTag(oldFullPath, newFullPath);
                                        if (result?.success) {
                                          appShowStatus?.(`Etikett döptes om till '${newName}'.`, 'success');
                                          setSelectedLabelId(newFullPath);
                                        } else {
                                          appShowStatus?.(result?.error || 'Kunde inte döpa om etiketten.', 'error');
                                          setRenamingLabelValue(selectedLabel.name);
                                        }
                                      } catch (err) {
                                        appShowStatus?.('Ett fel uppstod vid namnändring.', 'error');
                                        setRenamingLabelValue(selectedLabel.name);
                                      }
                                    }
                                    setIsRenamingLabel(false);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    } else if (e.key === 'Escape') {
                                      setRenamingLabelValue(selectedLabel.name);
                                      setIsRenamingLabel(false);
                                    }
                                  }}
                                  className="text-sm font-semibold text-primary break-all flex-1 bg-background border border-subtle rounded px-2 py-1 focus:outline-none focus:border-strong"
                                  placeholder="Namn"
                                />
                              </div>
                            </div>
                            <div className="rounded border border-subtle bg-background px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wide text-secondary mb-1">Fullständig sökväg</div>
                              <div className="text-sm font-semibold text-primary break-all">
                                {String(selectedLabel.fullName || '').split('/').filter(Boolean).join('/')}
                              </div>
                            </div>
                            <div className="rounded border border-subtle bg-background px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wide text-secondary mb-1">Används på</div>
                              <div className="text-sm font-semibold text-primary">{selectedLabel.count} bilder</div>
                            </div>
                            <label className="rounded border border-subtle bg-background px-3 py-2 flex items-center justify-between gap-3 cursor-pointer select-none">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-secondary mb-1">Skriv till metadata</div>
                                <div className="text-xs text-secondary">Om påslagen inkluderas etiketten vid EXIF/XMP-skrivning.</div>
                              </div>
                              <input
                                type="checkbox"
                                checked={Boolean(selectedLabel?.writeToMetadata)}
                                onChange={(e) => handleToggleSelectedLabelWriteToMetadata(e.target.checked)}
                                className="w-4 h-4 rounded border-subtle accent-accent"
                              />
                            </label>

                            <div className="rounded border border-subtle bg-background px-3 py-3 flex flex-col">
                              <div className="text-[10px] uppercase tracking-wide text-secondary mb-2">
                                Kopplade bilder {selectedTagMediaItems.length > 0 && `(${selectedTagMediaItems.length} st)`}
                              </div>
                              {selectedTagMediaItems.length === 0 ? (
                                <div className="text-xs text-muted">Inga bilder har denna tagg ännu.</div>
                              ) : (
                                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                                  <div className="grid grid-cols-3 gap-2 pr-1">
                                  {selectedTagMediaItems.map((mediaItem) => (
                                    <button
                                      key={String(mediaItem.id || mediaItem.url || mediaItem.name)}
                                      type="button"
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setTagContextMenu(null);
                                        setLabelDropMenu(null);
                                        setTagThumbnailMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          mediaItem,
                                          tagPath: String(selectedLabel.fullName || '')
                                        });
                                      }}
                                      className="group relative w-full aspect-square overflow-hidden rounded border border-subtle bg-surface-2 hover:border-strong"
                                      title={String(mediaItem.name || mediaItem.filePath || mediaItem.url || 'Bild')}
                                    >
                                      <MediaImage
                                        url={String(mediaItem.url || '')}
                                        alt={String(mediaItem.name || 'Bild')}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="rounded border border-dashed border-subtle bg-background px-3 py-4 text-sm text-muted">
                            Markera en etikett i trädet för att se dess egenskaper.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {tagContextMenu && (
                  <div
                    ref={tagContextMenuRef}
                    data-popup-menu="true"
                    className="fixed z-[7200] w-72 max-w-[90vw] rounded-xl border border-strong bg-surface shadow-2xl p-1 outline-none"
                    style={{ left: `${tagContextMenu.x}px`, top: `${tagContextMenu.y}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                    tabIndex={-1}
                    onKeyDown={(e) => {
                      const menuItems = ['create-child', 'rename', 'move', 'merge', 'reset-thumbnail', 'delete'];
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setTagContextMenu(null);
                        return;
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setTagContextMenuIndex((current) => (current + 1) % menuItems.length);
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setTagContextMenuIndex((current) => (current + menuItems.length - 1) % menuItems.length);
                        return;
                      }
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTagContextMenuAction(menuItems[tagContextMenuIndex]);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${tagContextMenuIndex === 0 ? 'bg-accent-soft text-primary' : 'text-primary hover:bg-surface-2'}`}
                      onMouseEnter={() => setTagContextMenuIndex(0)}
                      onClick={() => handleTagContextMenuAction('create-child')}
                    >
                      Skapa etikett i {tagContextMenu?.targetNode?.name}
                    </button>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${tagContextMenuIndex === 1 ? 'bg-accent-soft text-primary' : 'text-primary hover:bg-surface-2'}`}
                      onMouseEnter={() => setTagContextMenuIndex(1)}
                      onClick={() => handleTagContextMenuAction('rename')}
                    >
                      Byt namn...
                    </button>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${tagContextMenuIndex === 2 ? 'bg-accent-soft text-primary' : 'text-primary hover:bg-surface-2'}`}
                      onMouseEnter={() => setTagContextMenuIndex(2)}
                      onClick={() => handleTagContextMenuAction('move')}
                    >
                      Flytta...
                    </button>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${tagContextMenuIndex === 3 ? 'bg-accent-soft text-primary' : 'text-primary hover:bg-surface-2'}`}
                      onMouseEnter={() => setTagContextMenuIndex(3)}
                      onClick={() => handleTagContextMenuAction('merge')}
                    >
                      Slå ihop...
                    </button>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${tagContextMenuIndex === 4 ? 'bg-accent-soft text-primary' : 'text-primary hover:bg-surface-2'}`}
                      onMouseEnter={() => setTagContextMenuIndex(4)}
                      onClick={() => handleTagContextMenuAction('reset-thumbnail')}
                    >
                      Återställ miniatyr till standardikon
                    </button>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${tagContextMenuIndex === 5 ? 'bg-warning-soft text-warning' : 'text-warning hover:bg-warning-soft'}`}
                      onMouseEnter={() => setTagContextMenuIndex(5)}
                      onClick={() => handleTagContextMenuAction('delete')}
                    >
                      Radera etikett...
                    </button>
                  </div>
                )}

                {tagThumbnailMenu && (
                  <div
                    ref={tagThumbnailMenuRef}
                    data-popup-menu="true"
                    className="fixed z-[7300] w-64 max-w-[90vw] rounded-xl border border-strong bg-surface shadow-2xl p-1"
                    style={{ left: `${tagThumbnailMenu.x}px`, top: `${tagThumbnailMenu.y}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-primary hover:bg-surface-2"
                      onClick={async () => {
                        await handleSetTagThumbnailFromMedia(tagThumbnailMenu.mediaItem, tagThumbnailMenu.tagPath);
                        setTagThumbnailMenu(null);
                      }}
                    >
                      Sätt som miniatyr för tagg
                    </button>
                  </div>
                )}

                {labelDropMenu && (
                  <div
                    ref={labelDropMenuRef}
                    data-popup-menu="true"
                    className="fixed z-[7250] w-72 max-w-[90vw] rounded-xl border border-strong bg-surface shadow-2xl p-1"
                    style={{ left: `${labelDropMenu.x}px`, top: `${labelDropMenu.y}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-primary hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-normal break-words"
                      disabled={!labelDropMenu.canMove}
                      onClick={handleDropMenuMove}
                    >
                      Flytta in under {labelDropMenu.targetNode?.name}
                    </button>
                    {labelDropMenu.canMerge && (
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg text-sm text-primary hover:bg-surface-2 whitespace-normal break-words"
                        onClick={handleDropMenuMerge}
                      >
                        Slå ihop med {labelDropMenu.targetNode?.name}
                      </button>
                    )}
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-secondary hover:bg-surface-2"
                      onClick={() => setLabelDropMenu(null)}
                    >
                      Avbryt
                    </button>
                  </div>
                )}

                {treeContextMenu && (
                  <div
                    ref={tagContextMenuRef}
                    data-popup-menu="true"
                    className="fixed z-[7200] w-72 max-w-[90vw] rounded-xl border border-strong bg-surface shadow-2xl p-1 outline-none"
                    style={{ left: `${treeContextMenu.x}px`, top: `${treeContextMenu.y}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-primary hover:bg-surface-2 transition-colors"
                      onClick={() => {
                        setCreateLabelParent({ fullName: '', name: 'Rot' });
                        setCreateLabelValue('');
                        setTreeContextMenu(null);
                      }}
                    >
                      Ny Huvudetikett
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-primary hover:bg-surface-2 transition-colors"
                      onClick={() => {
                        setCreateLabelParent({ fullName: '', name: 'Rot' });
                        setCreateLabelValue('');
                        setTreeContextMenu(null);
                      }}
                    >
                      Ny Etikett
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-secondary hover:bg-surface-2 transition-colors"
                      onClick={() => setTreeContextMenu(null)}
                    >
                      Avbryt
                    </button>
                  </div>
                )}

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

                {createLabelParent && (
                  <div className="absolute inset-0 z-[7150] bg-black/35 flex items-center justify-center p-4">
                    <div className="w-full max-w-sm rounded-xl border border-subtle bg-surface shadow-2xl p-4">
                      <h3 className="text-base font-semibold text-primary mb-2">{createLabelParent.fullName ? 'Ny underetikett' : 'Ny huvudetikett'}</h3>
                      {createLabelParent.fullName && <p className="text-xs text-secondary mb-3 break-all">Förälder: {createLabelParent.fullName}</p>}
                      <input
                        type="text"
                        value={createLabelValue}
                        onChange={(e) => setCreateLabelValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateChildLabel();
                          }
                          if (e.key === 'Escape') {
                            setCreateLabelParent(null);
                            setCreateLabelValue('');
                          }
                        }}
                        className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        placeholder="Nytt namn..."
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 mt-4">
                        <Button
                          onClick={() => {
                            setCreateLabelParent(null);
                            setCreateLabelValue('');
                          }}
                          variant="secondary"
                          size="sm"
                        >
                          Avbryt
                        </Button>
                        <Button onClick={handleCreateChildLabel} variant="primary" size="sm">
                          Skapa
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {moveLabelSource && (
                  <div className="absolute inset-0 z-[7150] bg-black/35 flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-xl border border-subtle bg-surface shadow-2xl p-4">
                      <h3 className="text-base font-semibold text-primary mb-2">Flytta etikett</h3>
                      <p className="text-xs text-secondary mb-3 break-all">Etikett: {moveLabelSource.fullName}</p>
                      <label className="text-xs text-secondary block mb-1">Målgrupp</label>
                      <select
                        value={moveLabelTarget}
                        onChange={(e) => setMoveLabelTarget(e.target.value)}
                        className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                      >
                        <option value="">Välj mål...</option>
                        {moveTargetOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button
                          onClick={() => {
                            setMoveLabelSource(null);
                            setMoveLabelTarget('');
                          }}
                          variant="secondary"
                          size="sm"
                        >
                          Avbryt
                        </Button>
                        <Button onClick={handleConfirmMoveFromModal} variant="primary" size="sm" disabled={!moveLabelTarget}>
                          Flytta
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {mergeLabelSource && (
                  <div className="absolute inset-0 z-[7150] bg-black/35 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-xl border border-subtle bg-surface shadow-2xl p-4 space-y-3">
                      <h3 className="text-base font-semibold text-primary">Slå ihop etiketter</h3>
                      <p className="text-xs text-secondary break-all">Källa: {mergeLabelSource.fullName}</p>

                      <div className="rounded border border-subtle bg-surface-2 p-3">
                        <label className="text-xs text-secondary block mb-1">Mål-tagg</label>
                        <select
                          value={mergeLabelTarget}
                          onChange={(e) => setMergeLabelTarget(e.target.value)}
                          className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                        >
                          <option value="">Välj mål...</option>
                          {mergeTargetOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded border border-subtle bg-surface-2 p-3">
                        <label className="text-xs text-secondary block mb-1">Vilket namn vill du behålla?</label>
                        <div className="space-y-1 text-xs text-primary">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="merge-name-choice"
                              checked={mergeNameChoice === 'target'}
                              onChange={() => setMergeNameChoice('target')}
                              className="accent-accent"
                            />
                            Behåll mål-taggens namn
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="merge-name-choice"
                              checked={mergeNameChoice === 'source'}
                              onChange={() => setMergeNameChoice('source')}
                              className="accent-accent"
                            />
                            Behåll källans namn
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="merge-name-choice"
                              checked={mergeNameChoice === 'custom'}
                              onChange={() => setMergeNameChoice('custom')}
                              className="accent-accent"
                            />
                            Ange ett nytt namn
                          </label>
                        </div>
                      </div>

                      {mergeNameChoice === 'custom' && (
                        <div className="rounded border border-subtle bg-surface-2 p-3">
                          <label className="text-xs text-secondary block mb-1">Ange ett nytt namn</label>
                          <input
                            type="text"
                            value={mergeCustomName}
                            onChange={(e) => setMergeCustomName(e.target.value)}
                            className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-xs text-primary focus:outline-none focus:border-strong"
                            placeholder="Nytt namn..."
                          />
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => {
                            setMergeLabelSource(null);
                            setMergeLabelTarget('');
                            setMergeNameChoice('target');
                            setMergeCustomName('');
                            setLabelDropMenu(null);
                          }}
                          variant="secondary"
                          size="sm"
                        >
                          Avbryt
                        </Button>
                        <Button
                          onClick={handleConfirmMergeLabels}
                          variant="primary"
                          size="sm"
                          disabled={!mergeLabelTarget || (mergeNameChoice === 'custom' && !String(mergeCustomName || '').trim())}
                        >
                          Slå ihop
                        </Button>
                      </div>
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

const LabelTreeRow = React.memo(function LabelTreeRow({
  node,
  depth,
  selectedLabelId,
  onSelect,
  onContextMenu,
  onRename,
  onDelete,
  onMoveLabel,
  dragOverLabelId,
  draggingLabelId,
  onDragOverLabel,
  onDragStartLabel,
  onDragEndLabel,
  imageTagSet,
  onToggleTag,
  searchQuery,
  autoExpandIds,
  inlineRenameNodeId,
  inlineRenameValue,
  onInlineRenameValueChange,
  onInlineRenameCancel,
  onInlineRenameSubmit
}) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isSelected = selectedLabelId === node.id;
  const isDropTarget = draggingLabelId && dragOverLabelId === node.id && draggingLabelId !== node.id;
  const pathSegments = String(node.fullName || '').split('/').filter(Boolean);
  const showUserIcon = /^(Personer|Människor|Faces)$/i.test(pathSegments[0] || '');
  const checkboxRef = useRef(null);

  const subtreeTagNames = useMemo(() => {
    return Array.isArray(node?.subtreeTagNames)
      ? node.subtreeTagNames
      : (node?.fullName ? [String(node.fullName)] : []);
  }, [node]);

  const appliedCount = useMemo(() => {
    return subtreeTagNames.reduce((count, tagName) => count + (imageTagSet?.has(tagName) ? 1 : 0), 0);
  }, [subtreeTagNames, imageTagSet]);

  const isTagApplied = subtreeTagNames.length > 0 && appliedCount === subtreeTagNames.length;
  const isIndeterminate = appliedCount > 0 && appliedCount < subtreeTagNames.length;

  useEffect(() => {
    if (!checkboxRef.current) return;
    checkboxRef.current.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  useEffect(() => {
    if (!searchQuery) return;
    if (!hasChildren) return;
    if (autoExpandIds?.has(node.id)) {
      setIsExpanded(true);
    }
  }, [searchQuery, hasChildren, autoExpandIds, node.id]);

  const handleToggleNodeTag = useCallback((checked) => {
    subtreeTagNames.forEach((tagName) => {
      onToggleTag?.(tagName, checked);
    });
  }, [subtreeTagNames, onToggleTag]);

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 rounded border px-2 py-1.5 cursor-pointer transition-colors ${isDropTarget ? 'border-accent bg-accent-soft shadow-[0_0_0_1px_rgba(59,130,246,0.25)]' : isSelected ? 'border-accent bg-accent-soft' : 'border-subtle bg-background hover:bg-surface-2'}`}
        style={{ marginLeft: `${depth * 14}px` }}
        draggable
        onClick={() => onSelect?.(node.id)}
        onContextMenu={(e) => onContextMenu?.(e, node)}
        onDragStart={(e) => {
          onDragStartLabel?.(node.id);
          e.dataTransfer.setData('application/json', JSON.stringify({
            id: node.id,
            name: node.name,
            fullName: node.fullName,
            count: node.count,
            protected: Boolean(node.protected)
          }));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => onDragEndLabel?.()}
        onDragEnter={(e) => {
          e.preventDefault();
          onDragOverLabel?.(node.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOverLabel?.(node.id);
        }}
        onDragLeave={() => {
          onDragOverLabel?.(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDragOverLabel?.(null);
          onDragEndLabel?.();
          try {
            const raw = e.dataTransfer.getData('application/json');
            if (!raw) return;
            const dragged = JSON.parse(raw);
            onMoveLabel?.(dragged, node, { x: e.clientX, y: e.clientY });
          } catch (error) {
            console.warn('[ImageViewer] label drop failed', error);
          }
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setIsExpanded((current) => !current);
          }}
          className="w-5 h-5 flex items-center justify-center rounded text-secondary hover:text-primary hover:bg-surface-3 shrink-0"
          title={hasChildren ? (isExpanded ? 'Fäll ihop' : 'Fäll ut') : 'Ingen underetikett'}
        >
          {hasChildren ? (isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span className="text-[10px] leading-none">•</span>}
        </button>

        <input
          ref={checkboxRef}
          type="checkbox"
          checked={isTagApplied}
          onChange={(e) => handleToggleNodeTag(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-subtle accent-accent shrink-0"
          title={isTagApplied ? 'Ta bort etikett(er) från aktuell bild' : 'Applicera etikett(er) på aktuell bild'}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {node.thumbnail ? (
              <img
                src={node.thumbnail}
                alt={node.name}
                className="w-4 h-4 rounded object-cover shrink-0 border border-subtle"
              />
            ) : showUserIcon ? <User size={13} className="shrink-0 text-accent" /> : <Tag size={13} className="shrink-0 text-accent" />}
            {inlineRenameNodeId === node.id ? (
              <input
                type="text"
                value={inlineRenameValue}
                onChange={(e) => onInlineRenameValueChange?.(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onInlineRenameSubmit?.(node);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onInlineRenameCancel?.();
                  }
                }}
                onBlur={() => onInlineRenameSubmit?.(node)}
                className="w-full bg-surface border border-strong rounded px-1.5 py-0.5 text-xs text-primary focus:outline-none"
                autoFocus
              />
            ) : (
              <div className="text-sm text-primary truncate">{node.name}</div>
            )}
          </div>
          <div className="text-[10px] text-muted">{node.count} bilder</div>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <LabelTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedLabelId={selectedLabelId}
              onSelect={onSelect}
              dragOverLabelId={dragOverLabelId}
              draggingLabelId={draggingLabelId}
              onDragOverLabel={onDragOverLabel}
              onDragStartLabel={onDragStartLabel}
              onDragEndLabel={onDragEndLabel}
              imageTagSet={imageTagSet}
              onToggleTag={onToggleTag}
              searchQuery={searchQuery}
              autoExpandIds={autoExpandIds}
              inlineRenameNodeId={inlineRenameNodeId}
              inlineRenameValue={inlineRenameValue}
              onInlineRenameValueChange={onInlineRenameValueChange}
              onInlineRenameCancel={onInlineRenameCancel}
              onInlineRenameSubmit={onInlineRenameSubmit}
              onContextMenu={onContextMenu}
              onRename={onRename}
              onDelete={onDelete}
              onMoveLabel={onMoveLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  const prevSelected = prev.selectedLabelId === prev.node.id;
  const nextSelected = next.selectedLabelId === next.node.id;
  if (prevSelected !== nextSelected) return false;

  const prevDropTarget = prev.draggingLabelId && prev.dragOverLabelId === prev.node.id && prev.draggingLabelId !== prev.node.id;
  const nextDropTarget = next.draggingLabelId && next.dragOverLabelId === next.node.id && next.draggingLabelId !== next.node.id;
  if (Boolean(prevDropTarget) !== Boolean(nextDropTarget)) return false;

  const prevInline = prev.inlineRenameNodeId === prev.node.id;
  const nextInline = next.inlineRenameNodeId === next.node.id;
  if (prevInline !== nextInline) return false;
  if (nextInline && prev.inlineRenameValue !== next.inlineRenameValue) return false;

  const prevExpandedBySearch = Boolean(prev.searchQuery) && prev.autoExpandIds?.has(prev.node.id);
  const nextExpandedBySearch = Boolean(next.searchQuery) && next.autoExpandIds?.has(next.node.id);
  if (prevExpandedBySearch !== nextExpandedBySearch) return false;

  const prevTags = Array.isArray(prev.node?.subtreeTagNames) ? prev.node.subtreeTagNames : [];
  const nextTags = Array.isArray(next.node?.subtreeTagNames) ? next.node.subtreeTagNames : [];
  const prevApplied = prevTags.reduce((count, tagName) => count + (prev.imageTagSet?.has(tagName) ? 1 : 0), 0);
  const nextApplied = nextTags.reduce((count, tagName) => count + (next.imageTagSet?.has(tagName) ? 1 : 0), 0);
  if (prevApplied !== nextApplied) return false;

  const prevTotal = prevTags.length;
  const nextTotal = nextTags.length;
  if (prevTotal !== nextTotal) return false;

  return (
    prev.node.id === next.node.id &&
    prev.node.name === next.node.name &&
    prev.node.thumbnail === next.node.thumbnail &&
    prev.node.count === next.node.count &&
    prev.node.children.length === next.node.children.length &&
    prev.depth === next.depth
  );
});
