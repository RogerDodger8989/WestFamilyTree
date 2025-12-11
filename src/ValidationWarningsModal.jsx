import React from 'react';
import { useApp } from './AppContext';

export default function ValidationWarningsModal({ isOpen, warnings = [], onClose }) {
  const { handleTabChange, showStatus } = useApp();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40">
      <div className="w-11/12 max-w-2xl bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold">Varningar från automatisk import</h4>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); }} className="px-3 py-1 text-sm border rounded">Stäng</button>
          </div>
        </div>
        <div className="mb-3 text-sm text-slate-200">Följande varningar upptäcktes när relationer föreslogs från källor. Dessa relationer har inte lagts till.</div>
        <ul className="list-disc pl-5 mb-4 max-h-64 overflow-auto text-sm">
          {warnings.map((w, i) => (
            <li key={i} className="mb-2 text-red-700">{w}</li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button onClick={() => { try { handleTabChange('audit'); onClose(); } catch (e) { showStatus('Kunde inte öppna historiken.'); } }} className="px-3 py-2 bg-blue-600 text-white rounded">Öppna historiken</button>
          <button onClick={() => { onClose(); }} className="px-3 py-2 border rounded">Stäng</button>
        </div>
      </div>
    </div>
  );
}
