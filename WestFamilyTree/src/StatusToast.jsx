import React from 'react';

function StatusToast({ isVisible, message, severity = 'info' }) {
  if (!isVisible) return null;

  let bgClass = 'bg-blue-600';
  if (severity === 'success') bgClass = 'bg-green-600';
  if (severity === 'warn') bgClass = 'bg-yellow-600';
  if (severity === 'error') bgClass = 'bg-red-600';

  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[1900] ${bgClass} text-white rounded-lg shadow-xl flex items-center p-3`}>
      <span>{message}</span>
    </div>
  );
}

export default StatusToast;