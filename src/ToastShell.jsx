import React from 'react';

const BASE_TOAST_CLASS = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] text-on-accent rounded-lg shadow-2xl flex items-center justify-between p-4 min-w-[350px] font-medium text-sm';

function ToastShell({ isVisible, bgClass = 'bg-accent', children }) {
  if (!isVisible) return null;

  return (
    <div className={`${BASE_TOAST_CLASS} ${bgClass}`}>
      {children}
    </div>
  );
}

export default ToastShell;
