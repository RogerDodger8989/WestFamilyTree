import React, { useState, useEffect } from 'react';

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

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[2000] bg-red-700 text-white rounded-lg shadow-2xl flex items-center justify-between p-4 min-w-[350px]">
      <span>{message}</span>
      <div className="flex items-center">
        <button onClick={onUndo} className="ml-4 px-3 py-1 bg-slate-200/20 hover:bg-slate-200/40 rounded font-bold text-sm">
          Ångra
        </button>
        <span className="ml-4 font-mono text-lg w-6 text-center">{timeLeft}</span>
      </div>
    </div>
  );
}

export default UndoToast;