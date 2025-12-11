import React, { useState, useEffect } from 'react';
import { parsePlaceString } from './parsePlaceString.js';
import Button from './Button.jsx';

// NYTT: Lägg till onCreateNewPlace prop
export default function PlaceLinkModal({ place, onClose, onLink, onCreateNewPlace }) {

  const [country, setCountry] = useState('Sverige');
  const [lan, setLan] = useState('');
  const [lanList, setLanList] = useState([]);
  const [lanSearch, setLanSearch] = useState('');
  const [kommun, setKommun] = useState('');
  const [kommunList, setKommunList] = useState([]);
  const [kommunSearch, setKommunSearch] = useState('');
  const [forsamling, setForsamling] = useState('');
  const [forsamlingList, setForsamlingList] = useState([]);
  const [forsamlingSearch, setForsamlingSearch] = useState('');
  const [ort, setOrt] = useState('');
  const [ortList, setOrtList] = useState([]);
  const [ortSearch, setOrtSearch] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const parsed = parsePlaceString(place?.name || '');

  // Ladda län vid mount
  useEffect(() => {
    fetch('http://127.0.0.1:5005/official_places/lan')
      .then(res => res.json())
      .then(setLanList);
  }, []);

  // Ladda kommuner när län väljs
  useEffect(() => {
    if (lan) {
      setLoading(true);
      fetch(`http://127.0.0.1:5005/official_places/kommuner/${lan}`)
        .then(res => res.json())
        .then(data => setKommunList(data))
        .finally(() => setLoading(false));
    } else {
      setKommunList([]);
      setKommun('');
    }
    setForsamling(''); setForsamlingList([]); setOrt(''); setOrtList([]); setSelectedPlace(null);
  }, [lan]);

  // Ladda församlingar när kommun väljs
  useEffect(() => {
    if (kommun) {
      setLoading(true);
      fetch(`http://127.0.0.1:5005/official_places/forsamlingar/${kommun}`)
        .then(res => res.json())
        .then(data => setForsamlingList(data))
        .finally(() => setLoading(false));
    } else {
      setForsamlingList([]);
      setForsamling('');
    }
    setOrt(''); setOrtList([]); setSelectedPlace(null);
  }, [kommun]);

  // Ladda orter när församling väljs
  useEffect(() => {
    if (forsamling) {
      setLoading(true);
      fetch(`http://127.0.0.1:5005/official_places/orter/${forsamling}`)
        .then(res => res.json())
        .then(data => setOrtList(data))
        .finally(() => setLoading(false));
    } else {
      setOrtList([]);
      setOrt('');
    }
    setSelectedPlace(null);
  }, [forsamling]);


  // Sätt vald plats när ort, församling, kommun eller län väljs
  useEffect(() => {
    if (ort) {
      const found = ortList.find(o => o.id === ort);
      setSelectedPlace(found || null);
    } else if (forsamling) {
      const found = forsamlingList.find(f => f.sockenstadkod === forsamling);
      setSelectedPlace(found ? { ...found, level: 'forsamling' } : null);
    } else if (kommun) {
      const found = kommunList.find(k => k.kommunkod === kommun);
      setSelectedPlace(found ? { ...found, level: 'kommun' } : null);
    } else if (lan) {
      const found = lanList.find(l => l.lanskod === lan);
      setSelectedPlace(found ? { ...found, level: 'lan' } : null);
    } else {
      setSelectedPlace(null);
    }
  }, [ort, ortList, forsamling, forsamlingList, kommun, kommunList, lan, lanList]);

  const copyToClipboard = (val, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(val);
  };

  const codeFields = selectedPlace ? [
      { label: 'Länskod', value: selectedPlace.lanskod },
      { label: 'Kommunkod', value: selectedPlace.kommunkod },
      { label: 'Församlingskod', value: selectedPlace.sockenstadkod },
      { label: 'Ort-ID', value: selectedPlace.id && selectedPlace.level === 'ort' ? selectedPlace.id : null },
  ] : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded shadow-lg p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-slate-400 hover:text-slate-300">✕</button>
        <h2 className="text-lg font-bold mb-2">Koppla plats: {place?.name}</h2>
        <div className="mb-4 text-xs text-slate-400">
          <b>Parser:</b> {parsed.type || 'okänd'} {parsed.countryCode && `(${parsed.countryCode})`} {parsed.usedHeuristics && <span className="text-orange-600">(heuristik)</span>}
          {parsed.parts && parsed.parts.length > 0 && (
            <span className="ml-2">[
              {parsed.parts.map((part, idx) => (
                <span key={idx} className="bg-slate-700 rounded px-2 py-0.5 mx-0.5 text-slate-200">{part}</span>
              ))}
            ]</span>
          )}
        </div>

        {/* 2-kolumn grid för valen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="mb-2">
            <label className="block text-xs mb-1 font-bold">Land:</label>
            <select className="w-full border rounded p-1 text-sm bg-slate-900 border-slate-700 text-slate-200" value={country} onChange={e => setCountry(e.target.value)} disabled>
                <option value="Sverige">Sverige</option>
            </select>
            </div>
            
            <div className="mb-2">
            <label className="block text-xs mb-1 font-bold">Län:</label>
            <div className="flex flex-col gap-1">
                <input
                    type="text"
                    className="w-full border rounded p-1 text-sm placeholder-gray-400"
                    placeholder="Filtrera län..."
                    value={lanSearch}
                    onChange={e => setLanSearch(e.target.value)}
                />
                <select
                    className="w-full border rounded p-1 text-sm"
                    value={lan}
                    onChange={e => { setLan(e.target.value); setLanSearch(''); }}
                >
                    <option value="">-- Välj län --</option>
                    {lanList.filter(l => l.lansnamn.toLowerCase().includes(lanSearch.toLowerCase())).map(l => (
                    <option key={l.lanskod} value={l.lanskod}>{l.lansnamn}</option>
                    ))}
                </select>
            </div>
            </div>

            {lan && (
            <div className="mb-2">
                <label className="block text-xs mb-1 font-bold">Kommun:</label>
                <div className="flex flex-col gap-1">
                    <input
                    type="text"
                    className="w-full border rounded p-1 text-sm placeholder-gray-400"
                    placeholder="Filtrera kommun..."
                    value={kommunSearch}
                    onChange={e => setKommunSearch(e.target.value)}
                    />
                    <select
                    className="w-full border rounded p-1 text-sm"
                    value={kommun}
                    onChange={e => { setKommun(e.target.value); setKommunSearch(''); }}
                    >
                    <option value="">-- Välj kommun --</option>
                    {kommunList.filter(k => k.kommunnamn.toLowerCase().includes(kommunSearch.toLowerCase())).map(k => (
                        <option key={k.kommunkod} value={k.kommunkod}>{k.kommunnamn}</option>
                    ))}
                    </select>
                </div>
            </div>
            )}

            {kommun && (
            <div className="mb-2">
                <label className="block text-xs mb-1 font-bold">Församling:</label>
                <div className="flex flex-col gap-1">
                    <input
                    type="text"
                    className="w-full border rounded p-1 text-sm placeholder-gray-400"
                    placeholder="Filtrera församling..."
                    value={forsamlingSearch}
                    onChange={e => setForsamlingSearch(e.target.value)}
                    />
                    <select
                    className="w-full border rounded p-1 text-sm"
                    value={forsamling}
                    onChange={e => { setForsamling(e.target.value); setForsamlingSearch(''); }}
                    >
                    <option value="">-- Välj församling --</option>
                    {forsamlingList.filter(f => f.sockenstadnamn.toLowerCase().includes(forsamlingSearch.toLowerCase())).map(f => (
                        <option key={f.sockenstadkod} value={f.sockenstadkod}>{f.sockenstadnamn}</option>
                    ))}
                    </select>
                </div>
            </div>
            )}

            {forsamling && (
            <div className="mb-2 md:col-span-2">
                <label className="block text-xs mb-1 font-bold">Ort (frivilligt):</label>
                <div className="flex flex-col gap-1">
                    <input
                    type="text"
                    className="w-full border rounded p-1 text-sm placeholder-gray-400"
                    placeholder="Filtrera ort..."
                    value={ortSearch}
                    onChange={e => setOrtSearch(e.target.value)}
                    />
                    <select
                    className="w-full border rounded p-1 text-sm"
                    value={ort}
                    onChange={e => { setOrt(e.target.value); setOrtSearch(''); }}
                    >
                    <option value="">-- Välj ort --</option>
                    {ortList.filter(o => o.ortnamn.toLowerCase().includes(ortSearch.toLowerCase())).map(o => (
                        <option key={o.id} value={o.id}>{o.ortnamn}</option>
                    ))}
                    </select>
                </div>
            </div>
            )}
        </div>


        {/* Vald platsinformation - Stylad likt OfficialPlaceEditPanel */}
        {selectedPlace && (
          <div className="mt-6 p-4 bg-slate-800 border border-slate-700 rounded">
            <h4 className="text-sm font-bold mb-3 border-b pb-1">Vald platsinformation</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {codeFields.map(field => field.value && (
                <div key={field.label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 font-medium">{field.label}:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono bg-slate-900 border border-slate-600 px-2 py-0.5 rounded text-slate-200 min-w-[3rem] text-center">
                      {field.value}
                    </span>
                    <button
                      onClick={(e) => copyToClipboard(field.value, e)}
                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors"
                      title="Kopiera"
                    >
                      Kopiera
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NYTT: Visa knapp för att skapa officiell plats om ingen match finns */}
        {!selectedPlace && (
          <div className="mt-6 flex flex-col items-center">
            <div className="text-sm text-slate-400 mb-2">Ingen officiell plats hittades.</div>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded font-bold shadow hover:bg-blue-700"
              onClick={() => onCreateNewPlace && onCreateNewPlace()}
            >
              Skapa officiell plats
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6 border-t pt-4">
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 text-slate-200 hover:bg-slate-600 rounded text-sm font-medium">Avbryt</button>
          <button
            onClick={() => selectedPlace && onLink(selectedPlace)}
            className={`px-4 py-2 rounded text-white text-sm font-bold shadow-sm ${selectedPlace ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 cursor-not-allowed'}`}
            disabled={!selectedPlace}
          >
            Koppla vald plats
          </button>
        </div>
        {loading && <div className="text-xs text-slate-400 mt-2 text-center">Laddar...</div>}
      </div>
    </div>
  );
}