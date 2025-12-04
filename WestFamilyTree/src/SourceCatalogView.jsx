import React, { useState } from 'react';
import Editor from './MaybeEditor.jsx';

// Enkel stjärn-komponent för trovärdighet
function StarRating({ value, onChange }) {
  return (
    <div className="flex items-center space-x-1">
      {[0, 1, 2, 3].map(i => (
        <button
          key={i}
          type="button"
          className={
            'text-2xl ' + (i < value ? 'text-yellow-400' : 'text-slate-600')
          }
          onClick={() => onChange(i + 1)}
          aria-label={`Sätt trovärdighet till ${i + 1}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function SourceCatalogView({
  tree,
  selectedNode,
  onSelectNode,
  onEditNode,
  onAddSource,
  onSave,
  onFieldChange,
  onAddImage,
  onRemoveImage,
  onAIDClick,
  onNADClick,
  onRefClick,
  ...props
}) {
  // Layout: vänster träd, höger detaljpanel
  return (
    <div className="flex h-full w-full bg-slate-800">
      {/* Vänster: Trädstruktur */}
      <aside className="w-80 border-r border-slate-700 bg-slate-800 overflow-y-auto p-2 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-lg text-slate-200">Central Källkatalog</h2>
          <button
            className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-sm font-semibold"
            onClick={onAddSource}
          >
            Arkiv Digital
          </button>
        </div>
        {/* Trädstruktur ska renderas här (du kopplar in din data/komponent) */}
        <div className="flex-1">
          {/* ...trädstruktur... */}
        </div>
      </aside>
      {/* Höger: Detaljer för vald nod */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Parsningsknapp */}
        <div className="flex justify-end mb-4">
          <button className="px-4 py-2 bg-green-600 text-white rounded font-semibold">Parsa källa</button>
        </div>
        {/* Fält för källa */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Arkiv</label>
            <input className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="archive" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Bok</label>
            <input className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="volume" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Bild</label>
            <input className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="imagePage" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Sida</label>
            <input className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="page" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">AID</label>
            <input className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="aid" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">NAD</label>
            <input className="w-full border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="nad" />
          </div>
        </div>
        {/* Bild och notering */}
        <div className="flex gap-6 mb-4">
          <div className="flex flex-col items-center">
            <div className="w-48 h-48 border-2 border-dashed border-slate-600 flex items-center justify-center mb-2 bg-slate-900 cursor-pointer">
              <span className="text-slate-400 text-center">Klicka eller Klistra in bild (Ctrl+V)</span>
            </div>
            <button className="text-xs text-red-600 mt-1">Ta bort bild</button>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300">Notering</label>
            <Editor
              value={selectedNode?.note || ''}
              onChange={(e) => {
                // update locally; call onSave with updated node on blur
                // immediate change isn't wired in this view; we store in selectedNode prop normally
                // If onSave is provided, save on blur
              }}
              onBlur={(e) => { if (onSave && selectedNode) onSave({ ...selectedNode, note: e.target.value }); }}
              containerProps={{ style: { minHeight: '80px', overflow: 'auto' } }}
              spellCheck={true}
              lang="sv"
            />
            <div className="mt-4 flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Trovärdighet</label>
                <StarRating value={0} onChange={() => {}} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Taggar</label>
                <input className="w-48 border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="tags" placeholder="tagg1, tagg2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">Datum</label>
                <input className="w-32 border border-slate-600 bg-slate-900 text-slate-200 rounded px-2 py-1" name="date" type="date" />
              </div>
            </div>
          </div>
        </div>
        {/* Kopplade personer */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1">Kopplade personer</label>
          <table className="w-full border border-slate-700 text-sm bg-slate-900">
            <thead>
              <tr className="bg-slate-700">
                <th className="border px-2 py-1">Händelse</th>
                <th className="border px-2 py-1">Ref</th>
                <th className="border px-2 py-1">Förnamn</th>
                <th className="border px-2 py-1">Efternamn</th>
                <th className="border px-2 py-1">(Född-Död)</th>
              </tr>
            </thead>
            <tbody>
              {/* Koppla in dina personer här */}
            </tbody>
          </table>
        </div>
        <hr className="my-6" />
        {/* Spara-knapp */}
        <div className="flex justify-end">
          <button className="px-6 py-2 bg-green-600 text-white rounded font-bold">Spara</button>
        </div>
      </main>
    </div>
  );
}
