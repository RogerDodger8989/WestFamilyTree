import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import Editor from './MaybeEditor.jsx';

function NoteEditorModal({ isOpen, initialHtml = '', onClose, onSave }) {
  const [value, setValue] = useState('');
  const lastSavedRef = useRef('');
  const autosaveIntervalRef = useRef(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setValue(initialHtml || '');
    }
  }, [initialHtml, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    const sanitized = DOMPurify.sanitize(value);
    lastSavedRef.current = sanitized;
    onSave(sanitized);
  };

  // Save only if changed
  const saveIfChanged = () => {
    const sanitized = DOMPurify.sanitize(value);
    if (sanitized !== lastSavedRef.current) {
      lastSavedRef.current = sanitized;
      onSave(sanitized);
    }
  };

  // keyboard shortcuts handler (Ctrl/Cmd + B for bold)
  const handleKeyDown = (e) => {
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      document.execCommand('bold');
    }
  };

  // Handle potential drag/resize so overlay clicks that happen after a drag are ignored
  const handleEditorPointerDown = (e) => {
    // mark as no-drag yet
    isDraggingRef.current = false;

    const onMove = () => {
      isDraggingRef.current = true;
    };

    const onUp = () => {
      // small timeout to allow click event to be handled correctly
      setTimeout(() => {
        // keep flag for overlay click to check, then reset
        isDraggingRef.current = false;
      }, 0);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Only close when clicking the background overlay (not when interacting with children)
  const handleOverlayClick = (e) => {
    // If a drag/resize just happened, ignore this click (it comes from mouseup after dragging)
    if (isDraggingRef.current) {
      // reset and ignore
      isDraggingRef.current = false;
      return;
    }

    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      // start autosave every 8 seconds
      autosaveIntervalRef.current = setInterval(() => {
        saveIfChanged();
      }, 8000);
    }
    return () => {
      if (autosaveIntervalRef.current) {
        clearInterval(autosaveIntervalRef.current);
        autosaveIntervalRef.current = null;
      }
    };
  }, [isOpen, value]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleOverlayClick}>
      <div className="w-[90%] max-w-3xl bg-slate-800 border border-slate-700 rounded shadow-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900">
          <div className="font-semibold text-slate-200">Redigera notering</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600">Avbryt</button>
            <button onClick={handleSave} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 font-medium">Spara</button>
          </div>
        </div>
        <div className="p-3">
          <Editor
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => saveIfChanged()}
            onKeyDown={handleKeyDown}
            spellCheck={true}
            lang="sv"
            containerProps={{
              style: {
                resize: 'vertical',
                minHeight: '150px',
                maxHeight: '60vh',
                overflow: 'auto',
                // ensure the resize handle is inside the modal so clicks don't reach the overlay
                zIndex: 1,
              },
              onMouseDown: (e) => {
                // prevent clicks during resize from bubbling to overlay
                e.stopPropagation();
                // start tracking drag/resize so we can ignore the overlay click that follows
                handleEditorPointerDown(e);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default NoteEditorModal;
