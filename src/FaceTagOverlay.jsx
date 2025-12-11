
import React, { useState, useEffect } from 'react';
import PersonContextMenu from "./PersonContextMenu";

// Dummy-data för personnamn (samma som i PersonContextMenu)
const recentPeople = [
  { id: 1, ref: "A1", lastName: "Andersson", firstName: "Anna" },
  { id: 2, ref: "B2", lastName: "Bengtsson", firstName: "Bertil" },
];

export default function FaceTagOverlay({
  tags,
  setTags,
  activeTagId,
  setActiveTagId,
  isTaggingMode,
  containerRef,
  scale = 1,
  rotation = 0,
  position = { x: 0, y: 0 },
  flipH = false,
  flipV = false,
  image = null
}) {
  const [action, setAction] = useState('IDLE'); // IDLE, DRAWING, MOVING, RESIZING
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, tagId }

  // Keyboard delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      console.log('[FaceTagOverlay] handleKeyDown', e.key, { activeTagId });
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeTagId !== null) {
        setTags(tags => tags.filter(b => b.id !== activeTagId));
        setActiveTagId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTagId, setTags, setActiveTagId]);

  // Hjälpfunktion
  // Omvandla container-koordinater till bild-koordinater
  const getImageCoords = (x, y) => {
    if (!containerRef.current || !image) return { x: 0, y: 0 };
    const container = containerRef.current;
    const cx = container.clientWidth / 2 + position.x;
    const cy = container.clientHeight / 2 + position.y;
    // Från container till bildens mitt
    const dx = x - cx;
    const dy = y - cy;
    const rad = -(rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Rotera bakåt
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    // Skala och flip bakåt
    const sx = scale * (flipH ? -1 : 1);
    const sy = scale * (flipV ? -1 : 1);
    const imgX = rx / sx + (image.width / 2);
    const imgY = ry / sy + (image.height / 2);
    return {
      x: imgX,
      y: imgY
    };
  };

  // Hjälpfunktion: container till container-koordinater
  const getMousePos = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Starta ritning
  const handleMouseDownOverlay = (e) => {
    console.log('[FaceTagOverlay] handleMouseDownOverlay', { isTaggingMode, button: e.button, target: e.target === e.currentTarget });
    if (!isTaggingMode || e.button !== 0) return;
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const mouse = getMousePos(e);
    const imgStart = getImageCoords(mouse.x, mouse.y);
    const newTag = {
      id: Date.now() + Math.random(),
      x: imgStart.x,
      y: imgStart.y,
      w: 0,
      h: 0,
      status: 'new',
      note: '',
      personId: null
    };
    setTags(prev => [...prev, newTag]);
    setActiveBoxId(newTag.id);
    setActiveTagId(newTag.id);
    setAction('DRAWING');
    setStartPos(imgStart);
  };

  // Starta flytt
  const handleMouseDownBox = (e, id) => {
    console.log('[FaceTagOverlay] handleMouseDownBox', { isTaggingMode, id, button: e.button });
    if (!isTaggingMode || e.button !== 0) return;
    e.stopPropagation();
    setActiveTagId(id); // Sätt alltid aktiv box till den du klickar på
    setActiveBoxId(id);
    setAction('MOVING');
    const tag = tags.find(t => t.id === id);
    const mouse = getMousePos(e);
    const imgPos = getImageCoords(mouse.x, mouse.y);
    setStartPos({
      x: imgPos.x - tag.x,
      y: imgPos.y - tag.y
    });
  };

  // Starta storleksändring
  const handleMouseDownResize = (e, id) => {
    console.log('[FaceTagOverlay] handleMouseDownResize', { isTaggingMode, id, button: e.button });
    if (!isTaggingMode || e.button !== 0) return;
    e.stopPropagation();
    setActiveBoxId(id);
    setAction('RESIZING');
    setStartPos(getMousePos(e));
  };

  // MouseMove global
  const handleMouseMove = (e) => {
    if (action !== 'IDLE') {
      console.log('[FaceTagOverlay] handleMouseMove', { action, activeBoxId });
    }
    if (action === 'IDLE') return;
    const mouse = getMousePos(e);
    const idx = tags.findIndex(t => t.id === activeBoxId);
    if (idx === -1) return;
    const currentTag = tags[idx];
    const newTags = [...tags];
    if (action === 'DRAWING') {
      // Räkna om till bild-koordinater
      const imgPos = getImageCoords(mouse.x, mouse.y);
      const w = imgPos.x - startPos.x;
      const h = imgPos.y - startPos.y;
      newTags[idx] = {
        ...currentTag,
        x: w > 0 ? startPos.x : imgPos.x,
        y: h > 0 ? startPos.y : imgPos.y,
        w: Math.abs(w),
        h: Math.abs(h)
      };
    } else if (action === 'MOVING') {
      // Flytta i bild-koordinater
      const imgPos = getImageCoords(mouse.x, mouse.y);
      let newX = imgPos.x - startPos.x;
      let newY = imgPos.y - startPos.y;
      // Begränsa inom bild
      if (image) {
        newX = Math.max(0, Math.min(newX, image.width - currentTag.w));
        newY = Math.max(0, Math.min(newY, image.height - currentTag.h));
      }
      newTags[idx] = { ...currentTag, x: newX, y: newY };
    } else if (action === 'RESIZING') {
      // Ändra storlek i bild-koordinater
      const imgPos = getImageCoords(mouse.x, mouse.y);
      const newW = Math.max(10, imgPos.x - currentTag.x);
      const newH = Math.max(10, imgPos.y - currentTag.y);
      newTags[idx] = { ...currentTag, w: newW, h: newH };
    }
    setTags(newTags);
  };

  // MouseUp global
  const handleMouseUp = () => {
    console.log('[FaceTagOverlay] handleMouseUp', { action, activeBoxId });
    if (action === 'DRAWING') {
      const idx = tags.findIndex(t => t.id === activeBoxId);
      if (idx !== -1) {
        const currentTag = tags[idx];
        if (currentTag.w < 5 || currentTag.h < 5) {
          setTags(tags => tags.filter(t => t.id !== currentTag.id));
        }
      }
    }
    setAction('IDLE');
    setActiveBoxId(null);
  };

  // Globala listeners
  useEffect(() => {
    console.log('[FaceTagOverlay] useEffect action', { action });
    if (action !== 'IDLE') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [action, tags, activeBoxId, startPos]);

  // Render
  return (
    <>
      {/* Alla boxar */}
      {tags.map((tag) => {
        const isSelected = tag.id === activeTagId;
        // Transformera taggens position och storlek
        let cx = containerRef.current ? containerRef.current.clientWidth / 2 : 0;
        let cy = containerRef.current ? containerRef.current.clientHeight / 2 : 0;
        let tx = tag.x + tag.w / 2 - (image ? image.width / 2 : 0);
        let ty = tag.y + tag.h / 2 - (image ? image.height / 2 : 0);
        let sx = scale * (flipH ? -1 : 1);
        let sy = scale * (flipV ? -1 : 1);
        let rad = (rotation * Math.PI) / 180;
        let rotX = tx * Math.cos(rad) - ty * Math.sin(rad);
        let rotY = tx * Math.sin(rad) + ty * Math.cos(rad);
        let finalX = cx + position.x + rotX * sx - (tag.w * Math.abs(sx)) / 2;
        let finalY = cy + position.y + rotY * sy - (tag.h * Math.abs(sy)) / 2;
        let finalW = tag.w * Math.abs(sx);
        let finalH = tag.h * Math.abs(sy);
        // Hämta personnamn om personId finns
        let personName = null;
        if (tag.personId) {
          const p = recentPeople.find(p => p.id === tag.personId);
          if (p) personName = `(${p.ref}) ${p.lastName}, ${p.firstName}`;
        }
        return (
          <div
            key={tag.id}
            className={`absolute border-2 ${isSelected ? 'border-amber-400' : 'border-blue-400'} bg-blue-400/10 cursor-move`}
            style={{
              left: finalX,
              top: finalY,
              width: finalW,
              height: finalH,
              zIndex: isSelected ? 10 : 1,
              transform: `rotate(${rotation}deg)`
            }}
            onMouseDown={e => {
              if (isTaggingMode && e.button === 0) {
                handleMouseDownBox(e, tag.id);
              }
            }}
            onContextMenu={e => {
              if (isTaggingMode) {
                e.preventDefault();
                setActiveTagId(tag.id);
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setContextMenu({ x, y, tagId: tag.id });
              }
            }}
          >
            {/* Alltid visa redigera/radera i tagging mode */}
            {isTaggingMode && (
              <>
                <button
                  className="absolute right-0 top-0 bg-red-700 text-white text-xs rounded px-1 py-0.5"
                  style={{ transform: 'translateY(-100%)', pointerEvents: 'auto' }}
                  onClick={e => {
                    e.stopPropagation();
                    setTags(tags => tags.filter(t => t.id !== tag.id));
                    setActiveTagId(null);
                  }}
                  title="Ta bort box"
                >✕</button>
                <div
                  className="absolute w-4 h-4 bg-blue-400 border border-white rounded cursor-nwse-resize"
                  style={{ right: -8, bottom: -8, pointerEvents: 'auto' }}
                  onMouseDown={e => handleMouseDownResize(e, tag.id)}
                />
                <div className="absolute left-0 top-full bg-slate-800 text-xs text-white px-2 py-1 rounded shadow">
                  {personName ? personName : "Ansikte"}
                </div>
              </>
            )}
          </div>
        );
      })}
      {/* ContextMenu för personkoppling */}
      {contextMenu && (
        <PersonContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onPersonSelect={personId => {
            // Uppdatera personId på rätt tag
            setTags(tags => tags.map(tag =>
              tag.id === contextMenu.tagId ? { ...tag, personId } : tag
            ));
            setContextMenu(null);
          }}
        />
      )}
      {/* Overlay för ritning – flyttad till sist! */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: (isTaggingMode && action === 'IDLE') ? 'auto' : 'none',
          background: 'transparent'
        }}
        onMouseDown={handleMouseDownOverlay}
      />
    </>
  );
}
