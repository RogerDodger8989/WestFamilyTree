import React from 'react';

export default function StatusBadge({ label = 'Kopplad', variant = 'success', icon = '✔' }) {
  let bgClass = '';
  let textClass = 'text-on-accent';
  switch (variant) {
    case 'success': bgClass = 'bg-success'; textClass = 'text-on-accent'; break;
    case 'warn': bgClass = 'bg-accent'; textClass = 'text-on-accent'; break;
    case 'error': bgClass = 'bg-danger'; textClass = 'text-on-accent'; break;
    default: bgClass = 'bg-surface-2'; textClass = 'text-primary';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bgClass} ${textClass}`}>
      <span className="mr-1">{icon}</span>
      <span>{label}</span>
    </span>
  );
}
