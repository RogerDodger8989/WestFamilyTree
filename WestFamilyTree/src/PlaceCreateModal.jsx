import React, { useState } from 'react';

const PLACE_TYPE_OPTIONS = [
  { value: 'Village', label: 'By/Ort', icon: '🏘️' },
  { value: 'Parish', label: 'Församling/socken', icon: '⛪' },
  { value: 'Municipality', label: 'Kommun', icon: '🏛️' },
  { value: 'County', label: 'Län', icon: '🗺️' },
  { value: 'Building', label: 'Byggnad', icon: '🏠' },
  { value: 'Cemetary', label: 'Kyrkogård', icon: '🪦' },
];

export default function PlaceCreateModal({ parentNode, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '',
    type: 'Village',
    latitude: '',
    longitude: '',
    note: ''
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({ ...form, parentid: parentNode?.metadata?.id || null });
      onClose();
    } catch (err) {
      alert('Kunde inte skapa plats: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200">Ny plats</h2>
          <button className="text-2xl leading-none text-slate-400 hover:text-slate-300" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300">Namn</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required autoComplete="off" className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300">Typ</label>
            <select name="type" value={form.type} onChange={handleChange} className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-3 py-2">
              {PLACE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300">Latitud</label>
              <input type="text" name="latitude" value={form.latitude} onChange={handleChange} autoComplete="off" className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300">Longitud</label>
              <input type="text" name="longitude" value={form.longitude} onChange={handleChange} autoComplete="off" className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300">Notering</label>
            <textarea name="note" value={form.note} onChange={handleChange} rows={3} className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-3 py-2" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">{saving ? 'Skapar...' : 'Skapa'}</button>
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-700 text-slate-200 rounded">Avbryt</button>
          </div>
        </form>
      </div>
    </div>
  );
}
