import React, { useEffect, useRef } from 'react';

export default function ContextMenu({ visible, x = 0, y = 0, items = [], onClose }) {
  const rootRef = useRef(null);
  const ignoreUntilRef = useRef(0);

  const clampToViewport = () => {
    if (!rootRef.current) return;

    const rect = rootRef.current.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const nextLeft = Math.min(Math.max(x, margin), maxLeft);
    const nextTop = Math.min(Math.max(y, margin), maxTop);

    rootRef.current.style.left = `${nextLeft}px`;
    rootRef.current.style.top = `${nextTop}px`;
  };

  useEffect(() => {
    if (!visible) return;
    const mountTime = performance.now();
    // ignore clicks that happen immediately after opening (opening click)
    ignoreUntilRef.current = mountTime + 80;

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onClick = (e) => {
      try {
        const now = performance.now();
        if (now < ignoreUntilRef.current) return;
        if (rootRef.current && rootRef.current.contains(e.target)) return;
      } catch (err) {
        // ignore errors in containment check
      }
      onClose();
    };

    const onResize = () => clampToViewport();

    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, { capture: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    // Clamp right after render so the menu starts inside viewport.
    requestAnimationFrame(clampToViewport);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [visible, onClose, x, y]);

  if (!visible) return null;

  return (
    <div ref={rootRef} role="menu" aria-hidden={!visible} className="fixed z-[9999] min-w-40 bg-surface-2 border border-subtle rounded-md shadow-lg p-1.5 text-primary" style={{ left: x, top: y }}>
      {items.map((it, i) => (
        <div
          key={i}
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); try { it.onClick && it.onClick(); } catch (err) { console.error('ContextMenu item error', err); } onClose(); }}
          className="px-2.5 py-2 cursor-pointer rounded whitespace-nowrap hover:bg-surface"
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
