import React, { useEffect, useRef } from 'react';

export default function ContextMenu({ visible, x = 0, y = 0, items = [], onClose }) {
  const rootRef = useRef(null);
  const ignoreUntilRef = useRef(0);

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

    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick, { capture: true });
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const style = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 9999,
    minWidth: 160,
    background: '#1e293b',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 6,
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    padding: 6,
  };

  return (
    <div ref={rootRef} style={style} role="menu" aria-hidden={!visible}>
      {items.map((it, i) => (
        <div
          key={i}
          role="menuitem"
          onClick={(e) => { e.stopPropagation(); try { it.onClick && it.onClick(); } catch (err) { console.error('ContextMenu item error', err); } onClose(); }}
          style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 4, whiteSpace: 'nowrap' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
