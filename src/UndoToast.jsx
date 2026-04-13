import React, { useState, useEffect } from 'react';
import ToastShell from './ToastShell.jsx';

function UndoToast({ isVisible, message, onUndo, duration = 10000 }) {
  const [timeLeft, setTimeLeft] = useState(duration / 1000);

  useEffect(() => {
    if (isVisible) {
      // Återställ timern varje gång notisen blir synlig
      setTimeLeft(duration / 1000);

      const timerId = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerId);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);

      // Städa upp intervallet när komponenten försvinner
      return () => clearInterval(timerId);
    }
  }, [isVisible, duration]);

  return (
    <ToastShell isVisible={isVisible} bgClass="bg-danger">
      <span>{message}</span>
      <div className="flex items-center">
        <button onClick={onUndo} className="ml-4 px-3 py-1 bg-surface/20 hover:bg-surface/40 rounded font-bold text-sm">
          Ångra
        </button>
        <span className="ml-4 font-mono text-lg w-6 text-center">{timeLeft}</span>
      </div>
    </ToastShell>
  );
}

export default UndoToast;