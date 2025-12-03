import React, { useState, useEffect, useRef } from 'react';
import AsyncCreatableSelect from 'react-select/async-creatable';

// Lägg till onFoundExistingPlace-prop
export default function PlaceCreateModal({ isOpen, onClose, onCreate, prefillFields = {}, onFoundExistingPlace }) {
  const [fields, setFields] = useState({});
  const [options, setOptions] = useState({ lan: [], kommun: [], forsamling: [], ort: [] });
  const [loading, setLoading] = useState({ lan: false, kommun: false, forsamling: false, ort: false });
  const modalRef = useRef(null);

  // Prefill fields when modal opens
  useEffect(() => {
    if (isOpen && prefillFields && Object.keys(prefillFields).length > 0) {
      setFields(f => ({ ...f, ...prefillFields }));
    }
  }, [isOpen, prefillFields]);

  // ESC stänger modalen
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Klick utanför stänger modalen
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Async loader för react-select/async
  const loadLanOptions = async (inputValue) => {
    return fetch('http://127.0.0.1:5005/official_places/lan')
      .then(res => res.json())
      .then(data => {
        // Deduplicera på lanskod
        const seen = new Set();
        const allOptions = (data || [])
          .map(o => ({ value: o.lanskod || o.id || o.namn, label: o.lansnamn || o.namn }))
          .filter(opt => {
            if (seen.has(opt.value)) return false;
            seen.add(opt.value);
            return true;
          });
        if (!inputValue) return allOptions;
        const lower = inputValue.toLowerCase();
        return allOptions.filter(opt => opt.label && opt.label.toLowerCase().includes(lower));
      });
  };
  const loadKommunOptions = async (inputValue) => {
    return fetch('http://127.0.0.1:5005/official_places/kommuner')
      .then(res => res.json())
      .then(data => {
        // Deduplicera på kommunkod
        // Filtrera bort dubbletter baserat på namn+lanskod
        const filtered = [];
        const seen = new Set();
        for (const o of data || []) {
          const key = `${o.kommunnamn}_${o.lanskod}`;
          if (!seen.has(key)) {
            const label = o.lanskod ? `${o.kommunnamn} (${o.lanskod})` : o.kommunnamn;
            filtered.push({ value: key, label });
            seen.add(key);
          }
        }
        if (!inputValue) return filtered;
        return filtered.filter(opt => opt.label && opt.label.toLowerCase().includes(inputValue.toLowerCase()));
        if (!inputValue) return allOptions;
        const lower = inputValue.toLowerCase();
        return allOptions.filter(opt => opt.label && opt.label.toLowerCase().includes(lower));
      });
  };
  const loadForsamlingOptions = async (inputValue) => {
    return fetch('http://127.0.0.1:5005/official_places/forsamlingar')
      .then(res => res.json())
      .then(data => {
        // Deduplicera på sockenstadkod
        // Filtrera bort dubbletter baserat på namn+lanskod
        const filtered = [];
        const seen = new Set();
        for (const o of data || []) {
          const key = `${o.sockenstadnamn}_${o.lanskod}`;
          if (!seen.has(key)) {
            const label = o.lanskod ? `${o.sockenstadnamn} (${o.lanskod})` : o.sockenstadnamn;
            filtered.push({ value: key, label });
            seen.add(key);
          }
        }
        if (!inputValue) return filtered;
        return filtered.filter(opt => opt.label && opt.label.toLowerCase().includes(inputValue.toLowerCase()));
        if (!inputValue) return allOptions;
        const lower = inputValue.toLowerCase();
        return allOptions.filter(opt => opt.label && opt.label.toLowerCase().includes(lower));
      });
  };
  const loadOrtOptions = async (inputValue) => {
    return fetch('http://127.0.0.1:5005/official_places/orter')
      .then(res => res.json())
      .then(data => {
        // Deduplicera på id
        // Filtrera bort dubbletter baserat på namn+lanskod
        const filtered = [];
        const seen = new Set();
        for (const o of data || []) {
          const key = `${o.ortnamn}_${o.lanskod}`;
          if (!seen.has(key)) {
            const label = o.lanskod ? `${o.ortnamn} (${o.lanskod})` : o.ortnamn;
            filtered.push({ value: key, label });
            seen.add(key);
          }
        }
        if (!inputValue) return filtered;
        return filtered.filter(opt => opt.label && opt.label.toLowerCase().includes(inputValue.toLowerCase()));
        if (!inputValue) return allOptions;
        const lower = inputValue.toLowerCase();
        return allOptions.filter(opt => opt.label && opt.label.toLowerCase().includes(lower));
      });
  };

  // Hantera val och skapa nytt
  const handleSelect = (type, selected) => {
    setFields(f => ({ ...f, [type]: selected }));
  };
  const handleCreateNew = (type, inputValue) => {
    const newOpt = { value: inputValue, label: inputValue };
    setOptions(prev => ({ ...prev, [type]: [...prev[type], newOpt] }));
    setFields(f => ({ ...f, [type]: newOpt }));
  };

  // Spara plats
  // Kontrollera om platsen redan finns innan skapande
  const handleSave = async () => {
    const name = fields.ort?.label || fields.forsamling?.label || fields.kommun?.label || fields.lan?.label || '';
    const payload = {
      name,
      lan: fields.lan?.label || null,
      kommun: fields.kommun?.label || null,
      forsamling: fields.forsamling?.label || null,
      ort: fields.ort?.label || null,
    };
    // Sök efter matchande officiell plats
    const queryParams = new URLSearchParams({
      lan: payload.lan || '',
      kommun: payload.kommun || '',
      forsamling: payload.forsamling || '',
      ort: payload.ort || '',
    }).toString();
    const res = await fetch(`http://127.0.0.1:5005/official_places/search?${queryParams}`);
    const matches = await res.json();
    if (matches && matches.length > 0) {
      // Om match finns, trigga callback till förälder att öppna PlaceLinkModal med matchen
      if (onFoundExistingPlace) {
        onFoundExistingPlace(matches[0], payload);
      }
      onClose();
      return;
    }
    // Om ingen match, skapa plats som vanligt
    onCreate(payload);
    onClose();
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div ref={modalRef} className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl relative">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl font-bold"
          onClick={onClose}
          aria-label="Stäng"
        >×</button>
        <h2 className="text-xl font-bold mb-4">Skapa ny plats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Län</label>
            <AsyncCreatableSelect
              value={fields.lan}
              onChange={opt => handleSelect('lan', opt)}
              loadOptions={loadLanOptions}
              defaultOptions
              placeholder="Sök eller välj län..."
              isClearable
              onCreateOption={val => handleCreateNew('lan', val)}
              formatCreateLabel={val => `+ Skapa ny: ${val}`}
              isValidNewOption={inputValue => !!inputValue}
              isSearchable
              menuPlacement="auto"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Kommun</label>
            <AsyncCreatableSelect
              value={fields.kommun}
              onChange={opt => handleSelect('kommun', opt)}
              loadOptions={loadKommunOptions}
              defaultOptions
              placeholder="Sök eller välj kommun..."
              isClearable
              onCreateOption={val => handleCreateNew('kommun', val)}
              formatCreateLabel={val => `+ Skapa ny: ${val}`}
              isValidNewOption={inputValue => !!inputValue}
              isSearchable
              menuPlacement="auto"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Församling</label>
            <AsyncCreatableSelect
              value={fields.forsamling}
              onChange={opt => handleSelect('forsamling', opt)}
              loadOptions={loadForsamlingOptions}
              defaultOptions
              placeholder="Sök eller välj församling..."
              isClearable
              onCreateOption={val => handleCreateNew('forsamling', val)}
              formatCreateLabel={val => `+ Skapa ny: ${val}`}
              isValidNewOption={inputValue => !!inputValue}
              isSearchable
              menuPlacement="auto"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Ort</label>
            <AsyncCreatableSelect
              value={fields.ort}
              onChange={opt => handleSelect('ort', opt)}
              loadOptions={loadOrtOptions}
              defaultOptions
              placeholder="Sök eller välj ort..."
              isClearable
              onCreateOption={val => handleCreateNew('ort', val)}
              formatCreateLabel={val => `+ Skapa ny: ${val}`}
              isValidNewOption={inputValue => !!inputValue}
              isSearchable
              menuPlacement="auto"
              isDisabled={false}
            />
            <div className="text-xs text-gray-500 mt-1">Du kan skapa en ort direkt när du har valt församling. Kommun och län är frivilliga.</div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700"
            onClick={handleSave}
          >Spara</button>
          <button
            className="px-6 py-2 bg-gray-200 text-gray-800 font-bold rounded hover:bg-gray-300 border border-gray-300"
            onClick={onClose}
          >Avbryt</button>
        </div>
      </div>
    </div>
  );
}
