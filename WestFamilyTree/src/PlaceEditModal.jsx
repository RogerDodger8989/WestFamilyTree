import React, { useState, useEffect } from 'react';

const PLACE_TYPE_OPTIONS = [
  { value: 'Country', label: 'Land', icon: '🌍' },
  { value: 'Landscape', label: 'Landskap', icon: '🏞️' },
  { value: 'County', label: 'Län', icon: '🗺️' },
  { value: 'Municipality', label: 'Kommun', icon: '🏛️' },
  { value: 'Parish', label: 'Församling/socken', icon: '⛪' },
  { value: 'Village', label: 'By/Ort', icon: '🏘️' },
  { value: 'Building', label: 'Byggnad', icon: '🏠' },
  { value: 'Cemetary', label: 'Kyrkogård', icon: '🪦' },
];

export default function PlaceEditModal({ place, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Village',
    latitude: '',
    longitude: '',
    note: '',
    ...place?.metadata
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (place) {
      setFormData({
        name: place.name || '',
        type: place.type || 'Village',
        latitude: place.metadata?.latitude || '',
        longitude: place.metadata?.longitude || '',
        note: place.metadata?.note || '',
        ...place.metadata
      });
    }
  }, [place]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      alert('Kunde inte spara plats: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!place) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Redigera Plats</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Namn */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Namn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Typ */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Typ
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLACE_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Koordinater */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Latitud
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="55.6050"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Longitud
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="13.0038"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notering */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Notering
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Info om typ-specifika fält */}
          {formData.ortnamn && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
              <div className="font-semibold text-blue-800 mb-1">Ortinformation</div>
              <div className="text-blue-700">
                {formData.ortnamn && <div>Ort: {formData.ortnamn}</div>}
                {formData.kommunnamn && <div>Kommun: {formData.kommunnamn}</div>}
                {formData.lansnamn && <div>Län: {formData.lansnamn}</div>}
              </div>
            </div>
          )}

          {/* Knappar */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Sparar...' : '💾 Spara'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded hover:bg-gray-300 disabled:opacity-50"
            >
              Avbryt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
