import React from 'react';

function StatusToast({ isVisible, message, severity = 'info' }) {
  if (!isVisible) return null;

  let bgClass = 'bg-accent';
  if (severity === 'success') bgClass = 'bg-success';
  if (severity === 'warn') bgClass = 'bg-warning';
  if (severity === 'error') bgClass = 'bg-danger';

  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] ${bgClass} text-on-accent rounded-lg shadow-xl flex items-center p-3`}>
      <span>{message}</span>
    </div>
  );
}

export default StatusToast;