
import React, { useState } from "react";
import GedcomImportV2Panel from "./gedcomImportV2/GedcomImportV2Panel";
import { useApp } from "./AppContext";


export default function GedcomImportV2Modal({ open, onClose }) {
  const [importResult, setImportResult] = useState(null);
  const { dbData, setDbData, showStatus } = useApp();

  function handleImport(data) {
    setImportResult(data);
    // Undvik dubbletter: bygg index på REF och sourRef
    setDbData(prev => {
      // Personer
      const peopleByRef = new Map((prev.people || []).map(p => [p.refNumber, p]));
      const newPeople = [];
      for (const ind of data.individuals || []) {
        const ref = ind.REF || '';
        if (ref && peopleByRef.has(ref)) continue; // hoppa över dubblett

        // Hämta förnamn och efternamn robust
        let firstName = ind.GIVN || '';
        let lastName = ind.SURN || '';
        if ((!firstName || !lastName) && ind.NAME) {
          // Försök splitta NAME om GIVN/SURN saknas
          const parts = ind.NAME.split('/');
          if (!firstName && parts[0]) firstName = parts[0].trim();
          if (!lastName && parts[1]) lastName = parts[1].trim();
        }

        // Hämta födelse/död ur events
        let birthDate = '', birthPlace = '', deathDate = '', deathPlace = '';
        // Mappning GEDCOM → svenska händelsetyper
        const eventTypeMap = {
          BIRT: 'Födelse',
          CHR: 'Dop',
          DEAT: 'Död',
          BURI: 'Begravning',
          RESI: 'Bosatt',
          OCCU: 'Yrke'
        };
        const events = (ind.EVENTS || []).map(ev => {
          const mappedType = eventTypeMap[ev.type] || ev.type;
          if (ev.type === 'BIRT' || ev.type === 'CHR') {
            if (ev.date) birthDate = ev.date;
            if (ev.place) birthPlace = ev.place;
          }
          if (ev.type === 'DEAT') {
            if (ev.date) deathDate = ev.date;
            if (ev.place) deathPlace = ev.place;
          }
          return {
            type: mappedType,
            date: ev.date,
            place: ev.place,
            lat: ev.lat,
            long: ev.long,
            sources: (ev.sources || []).map(s => s.sourRef).filter(Boolean)
          };
        });

        newPeople.push({
          id: ref ? `gedcom_${ref}` : `gedcom_${Date.now()}_${Math.random()}`,
          refNumber: ref,
          firstName,
          lastName,
          gender: ind.SEX || '',
          birthDate,
          birthPlace,
          deathDate,
          deathPlace,
          events,
          notes: (ind.NOTES || []).map(n => n.html).join('\n'),
          _importType: 'gedcomV2'
        });
      }
      // Källor
      const sourcesByRef = new Map((prev.sources || []).map(s => [s.id, s]));
      const newSources = [];
      for (const src of data.sources || []) {
        const sid = src.sourRef || src.page || '';
        if (sid && sourcesByRef.has(sid)) continue; // hoppa över dubblett
        newSources.push({
          id: sid ? sid : `gedcomsrc_${Date.now()}_${Math.random()}`,
          sourceString: src.page || '',
          trust: src.quay || '',
          note: src.obj && src.obj.titl ? src.obj.titl : '',
          file: src.obj && src.obj.file ? src.obj.file : '',
          _importType: 'gedcomV2'
        });
      }
      return {
        ...prev,
        people: [...prev.people, ...newPeople],
        sources: [...prev.sources, ...newSources]
      };
    });
    showStatus('GEDCOM-importen är klar! Personer och källor har lagts till.');
  }

  if (!open) return null;

  return (
    <div className="modal" style={{ display: 'block' }}>
      <div className="modal-content card bg-slate-800 shadow-2xl rounded-xl border border-slate-700 max-w-3xl">
        <div className="flex justify-between items-center border-b p-4 bg-slate-700 border-slate-600 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-200">GEDCOM Import V2</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-300 text-2xl">&times;</button>
        </div>
        <div className="p-6">
          <GedcomImportV2Panel onImport={handleImport} />
          {importResult && (
            <div className="mt-6">
              <h4 className="font-bold mb-2">Importresultat (sammanfattning):</h4>
              <pre style={{ maxHeight: 300, overflow: 'auto', background: '#0f172a', color: '#e2e8f0', padding: 8, borderRadius: 4 }}>
                {JSON.stringify(importResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
