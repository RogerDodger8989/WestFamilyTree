import React from 'react';

function readStoredConfig() {
  try {
    const raw = window.localStorage.getItem('relationEngineConfig');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveStoredConfig(cfg) {
  try {
    window.localStorage.setItem('relationEngineConfig', JSON.stringify(cfg));
    return true;
  } catch (e) {
    console.error('Failed to save relationEngineConfig', e);
    return false;
  }
}

export default function RelationSettings({ onClose, inline = false }) {
  const defaults = {
    PARENT_MIN_YEARS: 15,
    PARENT_MAX_YEARS: 60,
    PARENT_LOOSE_MIN: 11,
    LARGE_AGE_GAP: 50,
    SIBLING_LARGE_GAP: 10,
    SPOUSAL_LARGE_GAP: 30,
    POSTHUMOUS_TOLERANCE: 1
  };

  const stored = readStoredConfig();
  const initial = { ...defaults, ...(stored || {}) };
  const [cfg, setCfg] = React.useState(initial);

  function setNum(key, value) {
    setCfg(c => ({ ...c, [key]: Number(value || 0) }));
  }

  function handleSave() {
    saveStoredConfig(cfg);
    if (onClose) onClose();
  }

  const content = (
    <div className={inline ? '' : 'bg-slate-800 border border-slate-700 rounded p-6 w-[520px] max-h-[80vh] overflow-y-auto'}>
      <h3 className="text-lg font-bold mb-4">Inställningar för relationsförslag</h3>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <label>Min åldersdiff (förälder)</label>
          <input value={cfg.PARENT_MIN_YEARS ?? ''} onChange={e => setNum('PARENT_MIN_YEARS', e.target.value)} className="border p-1 rounded" />
          <label>Max åldersdiff (förälder)</label>
          <input value={cfg.PARENT_MAX_YEARS ?? ''} onChange={e => setNum('PARENT_MAX_YEARS', e.target.value)} className="border p-1 rounded" />
          <label>Loose min (lågförtroende, år)</label>
          <input value={cfg.PARENT_LOOSE_MIN ?? ''} onChange={e => setNum('PARENT_LOOSE_MIN', e.target.value)} className="border p-1 rounded" />
          <label>Stor föräldra-gap (flagga)</label>
          <input value={cfg.LARGE_AGE_GAP ?? ''} onChange={e => setNum('LARGE_AGE_GAP', e.target.value)} className="border p-1 rounded" />
          <label>Stor syskon-gap (flagga)</label>
          <input value={cfg.SIBLING_LARGE_GAP ?? ''} onChange={e => setNum('SIBLING_LARGE_GAP', e.target.value)} className="border p-1 rounded" />
          <label>Stor makal-gap (flagga)</label>
          <input value={cfg.SPOUSAL_LARGE_GAP ?? ''} onChange={e => setNum('SPOUSAL_LARGE_GAP', e.target.value)} className="border p-1 rounded" />
          <label>Posthumous tolerance (år)</label>
          <input value={cfg.POSTHUMOUS_TOLERANCE ?? ''} onChange={e => setNum('POSTHUMOUS_TOLERANCE', e.target.value)} className="border p-1 rounded" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1 border rounded">Avbryt</button>
        <button onClick={handleSave} className="px-4 py-1 bg-blue-600 text-white rounded">Spara</button>
      </div>
    </div>
  );

  if (inline) return content;
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-40">
      {content}
    </div>
  );
}
