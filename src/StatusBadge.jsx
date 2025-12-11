import React from 'react';

export default function StatusBadge({ label = 'Kopplad', variant = 'success', icon = '✔' }) {
  let bgClass = '';
  let textClass = 'text-white';
  switch (variant) {
    case 'success': bgClass = 'bg-green-600'; textClass = 'text-white'; break;
    case 'warn': bgClass = 'bg-yellow-500'; textClass = 'text-black'; break;
    case 'error': bgClass = 'bg-red-600'; textClass = 'text-white'; break;
    default: bgClass = 'bg-slate-700'; textClass = 'text-slate-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgClass} ${textClass}`}>
      <span className="mr-1">{icon}</span>
      <span>{label}</span>
    </span>
  );
}
