
// GEDCOM Import V2 - UI-ingång
// Här kan du bygga ett enkelt gränssnitt för att ladda upp och importera en GEDCOM-fil
import React, { useRef, useState } from "react";

import { parseGedcomV2 } from "./parser";

// Spara senaste importen i minnet (kan bytas mot persistent lagring vid behov)
let lastImport = {
  individuals: [],
  sources: [],
  media: [],
  events: [],
  notes: []
};


function mergeByKey(arr, newArr, key, fallbackKey) {
  const map = new Map(arr.map(item => [item[key] || (fallbackKey ? item[fallbackKey] : undefined) || arr.indexOf(item), item]));
  for (const n of newArr || []) {
    const mapKey = n[key] || (fallbackKey ? n[fallbackKey] : undefined) || newArr.indexOf(n);
    if (map.has(mapKey)) {
      // Merge: skriv över fält, men behåll gamla om nya är tomma
      const old = map.get(mapKey);
      Object.assign(old, { ...old, ...n });
    } else {
      arr.push(n);
    }
  }
  return arr;
}




export default function GedcomImportV2Panel({ onImport }) {
  const fileInput = useRef();
  const [file, setFile] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e) {
    const f = e.target.files[0];
    setFile(f || null);
    setIsReady(!!f);
    setError("");
  }

  function handleImportClick() {
    if (!file) return;
    setIsLoading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const gedcomText = evt.target.result;
        const {
          individuals = [],
          sources = [],
          media = [],
          notes = []
        } = parseGedcomV2(gedcomText) || {};
        if (individuals && individuals.length > 0) {
          console.log('GEDCOM DEBUG: Första individen från parsern:', individuals[0]);
        } else {
          console.log('GEDCOM DEBUG: Inga individer hittades av parsern!');
        }
        // Merge individuals by REF
        lastImport.individuals = mergeByKey(lastImport.individuals, individuals, 'REF');
        // Merge sources by sourRef (eller page om sourRef saknas)
        lastImport.sources = mergeByKey(lastImport.sources, sources, 'sourRef', 'page');
        // Merge media by file
        lastImport.media = mergeByKey(lastImport.media, media, 'file');
        // Merge notes by ref+html
        lastImport.notes = mergeByKey(lastImport.notes, notes, 'html');
        // Events kan hanteras liknande om de får unika nycklar
        if (onImport) onImport({ ...lastImport });
        setIsLoading(false);
      } catch (err) {
        setError("Fel vid import: " + err.message);
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Kunde inte läsa filen.");
      setIsLoading(false);
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>GEDCOM Import V2</h2>
      <input type="file" accept=".ged,.gedcom,.txt" ref={fileInput} onChange={handleFileChange} />
      <p>Välj en GEDCOM-fil enligt nya importregler.</p>
      <button
        onClick={handleImportClick}
        disabled={!isReady || isLoading}
        style={{ marginTop: 12, padding: '8px 20px', background: isReady ? '#2563eb' : '#475569', color: 'white', border: 'none', borderRadius: 4, cursor: isReady ? 'pointer' : 'not-allowed' }}
      >
        {isLoading ? 'Importerar...' : 'Importera'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
