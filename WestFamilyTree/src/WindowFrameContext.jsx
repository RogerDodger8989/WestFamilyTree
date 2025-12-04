import React, { createContext, useState, useCallback } from 'react';
import WindowFrame from './WindowFrame';

export const WindowFrameContext = createContext();

let globalZIndex = 5000;

export function WindowFrameProvider({ children }) {
  const [windows, setWindows] = useState([]);
  const [activeWindowId, setActiveWindowId] = useState(null);

  const openWindow = useCallback((config) => {
    const {
      id = `window-${Date.now()}`,
      title,
      icon,
      children: windowChildren,
      initialWidth = 1000,
      initialHeight = 700,
      onClose,
    } = config;

    globalZIndex += 100;
    const windowZIndex = globalZIndex;

    setWindows(prev => [...prev, {
      id,
      title,
      icon,
      children: windowChildren,
      initialWidth,
      initialHeight,
      onClose,
      zIndex: windowZIndex,
    }]);

    setActiveWindowId(id);
    return id;
  }, []);

  const closeWindow = useCallback((windowId) => {
    setWindows(prev => prev.filter(w => w.id !== windowId));
  }, []);

  const closeAll = useCallback(() => {
    setWindows([]);
  }, []);

  return (
    <WindowFrameContext.Provider value={{ openWindow, closeWindow, closeAll, activeWindowId, setActiveWindowId }}>
      {children}
      {windows.map(window => (
        <WindowFrame
          key={window.id}
          windowId={window.id}
          title={window.title}
          icon={window.icon}
          initialWidth={window.initialWidth}
          initialHeight={window.initialHeight}
          zIndex={window.zIndex}
          isActive={window.id === activeWindowId}
          onActivate={() => setActiveWindowId(window.id)}
          onClose={() => {
            if (window.onClose) window.onClose();
            closeWindow(window.id);
          }}
        >
          {window.children}
        </WindowFrame>
      ))}
    </WindowFrameContext.Provider>
  );
}

export function useWindowFrame() {
  const context = React.useContext(WindowFrameContext);
  if (!context) {
    throw new Error('useWindowFrame must be used within WindowFrameProvider');
  }
  return context;
}
