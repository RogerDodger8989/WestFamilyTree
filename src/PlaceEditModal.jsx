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
  // Hjälpfunktion för att mappa platsens type till rätt value
  function getTypeValue(place) {
    if (!place) return 'Village';
    if (place.type) return place.type;
    if (place.metadata?.type) return place.metadata.type;
    // Fallback: gissa utifrån namn
    if (place.name && place.name.toLowerCase().includes('län')) return 'County';
    if (place.name && place.name.toLowerCase().includes('kommun')) return 'Municipality';
    return 'Village';
  }
  const [formData, setFormData] = useState({
    name: '',
    type: getTypeValue(place),
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
        type: getTypeValue(place),
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
    <form onSubmit={handleSubmit} className="p-6 space-y-4 flex flex-col h-full">
          {/* Namn */}
          <div>
            <label className="block text-sm font-bold text-secondary mb-1">
              Namn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-subtle rounded bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Typ */}
          <div>
            <label className="block text-sm font-bold text-secondary mb-1">
              Typ
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-subtle rounded bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent"
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
              <label className="block text-sm font-bold text-secondary mb-1">
                Latitud
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="55.6050"
                className="w-full px-3 py-2 border border-subtle rounded bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-secondary mb-1">
                Longitud
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="13.0038"
                className="w-full px-3 py-2 border border-subtle rounded bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>



          {/* Knappar */}
          <div className="flex gap-3 pt-4 border-t border-subtle">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-accent text-on-accent font-semibold rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Sparar...' : '💾 Spara'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-surface-2 text-primary font-semibold rounded hover:bg-surface disabled:opacity-50"
            >
              Avbryt
            </button>
          </div>
    </form>
  );
}
