import React from 'react';
import ToastShell from './ToastShell.jsx';

function StatusToast({ isVisible, message, severity = 'info' }) {
  const sev = String(severity || 'info').toLowerCase();
  let bgClass = 'bg-accent';
  if (sev === 'success') bgClass = 'bg-success';
  if (sev === 'warn' || sev === 'warning') bgClass = 'bg-warning';
  if (sev === 'error') bgClass = 'bg-danger';

  return (
    <ToastShell isVisible={isVisible} bgClass={bgClass}>
      <span>{message}</span>
    </ToastShell>
  );
}

export default StatusToast;