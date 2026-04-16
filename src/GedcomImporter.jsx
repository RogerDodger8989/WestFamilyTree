import React, { useState } from 'react';
import { parsePlaceString } from './parsePlaceString.js';

// =====================================================================
//  DEL 1: PARSER-LOGIKEN (Avancerad "Citation Extractor")
// =====================================================================

const formatDateToISO = (dateStr) => {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{4}$/.test(dateStr)) return dateStr;

  const months = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    OKT: '10', MAJ: '05'
  };

  const parts = dateStr.toUpperCase().split(' ');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = months[parts[1]];
    const y = parts[2];
    if (d && m && y) return `${y}-${m}-${d}`;
  }
  if (parts.length === 2) {
    const m = months[parts[0]];
    const y = parts[1];
    if (m && y) return `${y}-${m}`;
  }
  return dateStr;
};

const parseGedcom = (fileContent) => {
  const lines = fileContent.split(/\r?\n/);
  const rootNodes = [];
  let stack = [];

  // 1. Bygg grundläggande nod-träd
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.match(/^(\d+)\s+(@\w+@|\w+)(\s+(.*))?$/);
    if (!parts) return;

    const level = parseInt(parts[1], 10);
    const tagOrId = parts[2]; 
    const value = parts[4] || "";
    
    let tag = tagOrId;
    let id = null;
    if (tagOrId.startsWith("@")) {
        id = tagOrId;
        tag = value; 
    }

    const node = { tag, value, id, children: [] };

    if (level === 0) {
      rootNodes.push(node);
      stack = [node];
    } else {
      while (stack.length > level) stack.pop();
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
        stack.push(node);
      }
    }
  });

  // Helpers
  const getChild = (node, tag) => node.children.find(c => c.tag === tag);
  const getChildren = (node, tag) => node.children.filter(c => c.tag === tag);
  const getValue = (node, tag) => {
    const child = getChild(node, tag);
    return child ? child.value : "";
  };
  
  const buildHtmlNote = (node) => {
    if (!node) return "";
    let html = node.value || "";
    node.children.forEach(child => {
      if (child.tag === "CONC") html += child.value; 
      if (child.tag === "CONT") html += `\n${child.value}`; 
    });
    return html;
  };

  const buildSimpleString = (node) => {
    if (!node) return "";
    let str = node.value || "";
    node.children.forEach(child => {
      if (child.tag === "CONC") str += child.value; 
      if (child.tag === "CONT") str += " " + child.value; 
    });
    return str.trim();
  };

  // --- DATALAGRING ---
  const individuals = [];
  const families = [];
  const finalSources = []; 
  const repositories = [];
  const sharedNotes = [];
  const sharedMedia = [];
  const submitters = [];
  const uniquePlaces = new Set();
  const placeMap = new Map(); 
  let placeCounter = 1;

  // Helper för platser
  const getOrCreatePlaceId = (placeName) => {
      if (!placeName) return null;
      const normalized = placeName.trim();
      if (placeMap.has(normalized)) return placeMap.get(normalized).id;
      const newId = `p${Date.now()}_${placeCounter++}`;
      placeMap.set(normalized, { id: newId, name: normalized });
      return newId;
  };

  // 2. PRE-PROCESS: Läs in alla MASTER SOURCES (0 SOUR) till en Map först
  const masterSourceMap = new Map();
  rootNodes.filter(n => n.tag === "SOUR").forEach(node => {
      let note = "";
      const dataNode = getChild(node, "DATA");
      if (dataNode) {
          const textNode = getChild(dataNode, "TEXT");
          if (textNode) note = buildHtmlNote(textNode);
      }
      if (!note) note = buildHtmlNote(getChild(node, "NOTE"));

      let title = buildSimpleString(getChild(node, "TITL"));
      if (!title) title = getValue(node, "ABBR");
      if (!title) title = getValue(node, "AUTH");
      if (!title) title = `Namnlös källa (${node.id || '?'})`;

      const masterSrc = {
        id: node.id ? node.id.replace(/@/g, "") : `ms_${Math.random()}`,
        title: title,
        archiveTop: "Övrigt", 
        archive: getValue(node, "REPO").replace(/@/g, ""), 
        note: note,
        publ: getValue(node, "PUBL"),
        author: getValue(node, "AUTH")
      };
      masterSourceMap.set(masterSrc.id, masterSrc);
  });

  const createdSourceCache = new Map();

  const getOrCreateExplodedSource = (masterId, page, noteData, quay) => {
      if (!masterId) return null;
      const cacheKey = `${masterId}|${page || ''}|${noteData || ''}`;
      if (createdSourceCache.has(cacheKey)) return createdSourceCache.get(cacheKey);

      const master = masterSourceMap.get(masterId);
      if (!master) return null; 

      const newId = `src_imp_${finalSources.length + 1}_${Date.now()}`;
      
      let finalNote = master.note || "";
      if (noteData) finalNote += (finalNote ? "\n\n--- Avskrift ---\n" : "") + noteData;

      let aid = "";
      let cleanedPage = page || "";
      
      if (cleanedPage.includes("AID:")) {
          const match = cleanedPage.match(/AID:\s*([a-zA-Z0-9\.]+)/i);
          if (match) aid = match[1];
      } else if (cleanedPage.includes("http") && cleanedPage.includes("arkivdigital")) {
          const match = cleanedPage.match(/aid\/show\/([a-zA-Z0-9\.]+)/);
          if (match) aid = match[1];
      }

      let trust = 0;
      if (quay === "3") trust = 4;
      else if (quay === "2") trust = 3;
      else if (quay === "1") trust = 2;
      else if (quay === "0") trust = 1;

      const newSource = {
          ...master,
          id: newId,
          page: cleanedPage, 
          aid: aid,
          note: finalNote,
          trust: trust,
      };

      finalSources.push(newSource);
      createdSourceCache.set(cacheKey, newId);
      return newId;
  };


  // 3. PARSA INDIVIDER
  rootNodes.forEach(node => {
    if (node.tag === "INDI") {
      const nameNode = getChild(node, "NAME");
      const fullName = nameNode ? nameNode.value.replace(/\//g, "") : "Namnlös";
      
      let sexRaw = getValue(node, "SEX").toUpperCase();
      let genderValue = ['F', 'FEMALE', 'K', 'KVINNA'].includes(sexRaw) ? 'K' : (['M', 'MALE', 'MAN'].includes(sexRaw) ? 'M' : '');
      
      const cleanId = node.id ? node.id.replace(/@/g, "") : "Unknown";
      const refNumber = cleanId.startsWith('I') ? cleanId.substring(1) : cleanId;
      
      const events = [];
      const eventTags = ["BIRT", "DEAT", "CHR", "BURI", "OCCU", "RESI", "PROB", "MARR", "DIV", "BAPM", "EDUC", "CONF"];
      
      node.children.forEach(child => {
        if (eventTags.includes(child.tag)) {
          let rawDate = getValue(child, "DATE");
          let place = getValue(child, "PLAC");
          let note = buildHtmlNote(getChild(child, "NOTE"));
          let type = child.tag;
          
          if ((type === 'OCCU' || type === 'EDUC') && child.value) {
              const title = child.value;
              note = title + (note ? `\n${note}` : "");
          }

          const addr = getValue(child, "ADDR");
          if (place && (/^[\d\s]+$/.test(place) || place.length < 2)) {
             note = (note ? note + "\n" : "") + `Platskod: ${place}`;
             if (addr && addr.length > 2) place = addr;
             else place = "";
          } else if (!place && addr && addr.length > 2) {
             place = addr;
          }

          if (place) uniquePlaces.add(place);
          const placeId = place ? getOrCreatePlaceId(place) : null;

          const eventSources = [];
          getChildren(child, "SOUR").forEach(sourNode => {
              let ref = sourNode.value ? sourNode.value.replace(/@/g, "") : "";
              if (ref) {
                  const page = getValue(sourNode, "PAGE");
                  const quay = getValue(sourNode, "QUAY");
                  let citationDataText = "";
                  const dataNode = getChild(sourNode, "DATA");
                  if (dataNode) {
                      const textNode = getChild(dataNode, "TEXT");
                      if (textNode) citationDataText = buildHtmlNote(textNode);
                  }
                  const citNote = buildHtmlNote(getChild(sourNode, "NOTE"));
                  if (citNote) citationDataText = (citationDataText ? citationDataText + "\n" : "") + citNote;

                  const newSourceId = getOrCreateExplodedSource(ref, page, citationDataText, quay);
                  if (newSourceId) eventSources.push(newSourceId); 
              }
          });

          let evt = {
            id: `evt_${Math.random().toString(36).substr(2, 9)}`,
            type: type,
            date: formatDateToISO(rawDate), 
            place: place,
            placeId: placeId,
            description: (type === 'OCCU' || type === 'EDUC') ? child.value : "",
            note: note,
            sources: eventSources 
          };
          
          if (child.tag === "DEAT") {
             const caus = getChild(child, "CAUS");
             if (caus) evt.cause = caus.value;
          }
          events.push(evt);
        }
      });

      const images = getChildren(node, "OBJE").map(obj => ({
          src: getValue(obj, "FILE"),
          title: getValue(obj, "TITL"),
          format: getValue(obj, "FORM")
      }));
      const fams = getChildren(node, "FAMS").map(c => c.value.replace(/@/g, ""));
      const famc = getChildren(node, "FAMC").map(c => c.value.replace(/@/g, ""));
      const contacts = {
          email: getValue(node, "EMAIL"),
          phone: getValue(node, "PHON"),
          www: getValue(node, "WWW")
      };

      individuals.push({
        id: cleanId,
        refNumber: refNumber,
        name: fullName,
        firstName: getValue(nameNode, "GIVN"),
        lastName: getValue(nameNode, "SURN"),
        gender: genderValue,
        sex: genderValue,
        events,
        images,
        fams,
        famc,
        contacts,
        changeDate: getValue(getChild(node, "CHAN"), "DATE")
      });
    } 
    
    else if (node.tag === "FAM") {
        const events = [];
        ["MARR", "DIV"].forEach(tag => {
            const evtNode = getChild(node, "MARR"); // HÄR VAR FELET I GAMLA KODEN (MISSADE ATT SKICKA IN RÄTT NOD)
            // För att förenkla: Vi loopar barnen istället för att hårdkoda
            // Låt oss göra om denna sektion för att vara robust:
            
            const relevantNodes = getChildren(node, tag); // Hämta alla MARR eller DIV noder
            relevantNodes.forEach(evtNode => {
                let p = getValue(evtNode, "PLAC");
                let pid = p ? getOrCreatePlaceId(p) : null;
                
                const famSources = [];
                getChildren(evtNode, "SOUR").forEach(sourNode => {
                    let ref = sourNode.value.replace(/@/g, "");
                    if(ref) {
                        const page = getValue(sourNode, "PAGE");
                        const quay = getValue(sourNode, "QUAY");
                        let citationDataText = "";
                        const dataNode = getChild(sourNode, "DATA");
                        if (dataNode) {
                            const textNode = getChild(dataNode, "TEXT");
                            if (textNode) citationDataText = buildHtmlNote(textNode);
                        }
                        const citNote = buildHtmlNote(getChild(sourNode, "NOTE"));
                        if (citNote) citationDataText = (citationDataText ? citationDataText + "\n" : "") + citNote;

                        const newSourceId = getOrCreateExplodedSource(ref, page, citationDataText, quay);
                        if (newSourceId) famSources.push(newSourceId);
                    }
                });

                events.push({ 
                    type: tag, 
                    date: formatDateToISO(getValue(evtNode, "DATE")), 
                    place: p, 
                    placeId: pid,
                    note: buildHtmlNote(getChild(evtNode, "NOTE")),
                    sources: famSources
                });
            });
        });

        families.push({
            id: node.id.replace(/@/g, ""),
            husb: getValue(node, "HUSB").replace(/@/g, ""),
            wife: getValue(node, "WIFE").replace(/@/g, ""),
            children: getChildren(node, "CHIL").map(c => c.value.replace(/@/g, "")),
            events: events
        });
    }
    
    else if (node.tag === "REPO") repositories.push({ id: node.id.replace(/@/g, ""), name: getValue(node, "NAME"), addr: buildHtmlNote(getChild(node, "ADDR")) });
    else if (node.tag === "NOTE") sharedNotes.push({ id: node.id.replace(/@/g, ""), text: buildHtmlNote(node) });
    else if (node.tag === "OBJE") sharedMedia.push({ id: node.id.replace(/@/g, ""), file: getValue(node, "FILE"), title: getValue(node, "TITL") });
    else if (node.tag === "SUBM") submitters.push({ id: node.id.replace(/@/g, ""), name: getValue(node, "NAME") });
  });

  masterSourceMap.forEach(master => {
      finalSources.push(master);
  });

  const resolveNote = (noteText) => {
      if (noteText && noteText.startsWith("@") && noteText.endsWith("@")) {
          const noteId = noteText.replace(/@/g, "");
          const found = sharedNotes.find(n => n.id === noteId);
          return found ? found.text : noteText;
      }
      return noteText;
  };

  individuals.forEach(ind => ind.events.forEach(evt => evt.note = resolveNote(evt.note)));
  finalSources.forEach(src => src.note = resolveNote(src.note));

    const places = Array.from(placeMap.values()).map(p => ({
      ...parsePlaceString(p.name),
      id: p.id,
      name: p.name,
      fullString: p.name
    }));

  // --- Bygg relationsfältet för alla personer ---
  // Förbered en map för snabb lookup
  const personMap = new Map(individuals.map(p => [p.id, p]));
  // Initiera relationsfältet på alla
  individuals.forEach(p => {
    p.relations = { parents: [], children: [], spouseId: null };
  });

  // Helper: Hämta relationsstatus för barn–förälder från FAMC/FAMS och eventuella ADOP/FOST/STEP-taggar
  function getParentChildStatus(childNode, famId, parentId) {
    // Default: biologisk
    let status = 'biologisk';
    // Sök FAMC/FAMS-länk på individen
    if (childNode && famId) {
      // Leta efter FAMC/FAMS-nod med ADOP/FOST/STEP
      const famcNodes = getChildren(childNode, 'FAMC').concat(getChildren(childNode, 'FAMS'));
      for (const famc of famcNodes) {
        if (famc.value && famc.value.replace(/@/g, '') === famId) {
          // Leta efter ADOP/FOST/STEP-taggar
          const relNode = getChild(famc, 'PEDI');
          if (relNode) {
            const v = (relNode.value || '').toLowerCase();
            if (v.includes('adopt')) status = 'adopterad';
            else if (v.includes('fost')) status = 'fosterbarn';
            else if (v.includes('step')) status = 'styvbarn';
            else if (v.includes('birth')) status = 'biologisk';
            else status = v;
          }
          // GEDCOM kan även ha ADOP/CHIL/FOST/STEP som egna taggar
          const extra = famc.children.map(c => c.tag.toLowerCase());
          if (extra.includes('adop')) status = 'adopterad';
          if (extra.includes('fost')) status = 'fosterbarn';
          if (extra.includes('step')) status = 'styvbarn';
        }
      }
    }
    return status;
  }

  // Gå igenom alla familjer och koppla ihop
  families.forEach(fam => {
    const { husb, wife, children, id: famId } = fam;
    // Koppla föräldrar till barn
    children.forEach(childId => {
      const child = personMap.get(childId);
      if (child) {
        // Hämta childNode från rootNodes (INDI)
        const childNode = rootNodes.find(n => n.tag === 'INDI' && n.id && n.id.replace(/@/g, '') === childId);
        if (husb && personMap.has(husb) && !child.relations.parents.some(p => p.id === husb)) {
          child.relations.parents.push({ id: husb, status: getParentChildStatus(childNode, famId, husb) });
        }
        if (wife && personMap.has(wife) && !child.relations.parents.some(p => p.id === wife)) {
          child.relations.parents.push({ id: wife, status: getParentChildStatus(childNode, famId, wife) });
        }
      }
    });
    // Koppla barn till föräldrar
    [husb, wife].forEach(parentId => {
      const parent = personMap.get(parentId);
      if (parent) {
        children.forEach(childId => {
          if (personMap.has(childId) && !parent.relations.children.some(c => c.id === childId)) {
            // Hämta childNode från rootNodes (INDI)
            const childNode = rootNodes.find(n => n.tag === 'INDI' && n.id && n.id.replace(/@/g, '') === childId);
            parent.relations.children.push({ id: childId, status: getParentChildStatus(childNode, famId, parentId) });
          }
        });
      }
    });
    // Koppla makar
    if (husb && wife && personMap.has(husb) && personMap.has(wife)) {
      if (!personMap.get(husb).relations.spouseId) personMap.get(husb).relations.spouseId = wife;
      if (!personMap.get(wife).relations.spouseId) personMap.get(wife).relations.spouseId = husb;
    }
  });

  return { individuals, families, sources: finalSources, repositories, sharedNotes, sharedMedia, submitters, places };
};

// =====================================================================
//  DEL 2: REACT KOMPONENTEN
// =====================================================================

const GedcomImporter = (props) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8"); 
    reader.onload = (event) => {
      const text = event.target.result;
      const parsedData = parseGedcom(text);
      setData(parsedData);
      setLoading(false);
    };
  };

  const handleSave = async () => {
    if (!data) return;
    try {
      setLoading(true);
      let enrichedPlaces = Array.isArray(data.places) ? [...data.places] : [];
      if (window.electronAPI && typeof window.electronAPI.mapPlacReference === 'function') {
        enrichedPlaces = await Promise.all(enrichedPlaces.map(async (place) => {
          try {
            const sourceText = place.fullString || place.name || '';
            const mapped = await window.electronAPI.mapPlacReference(sourceText);
            const mappedPlace = mapped?.mapped?.place;
            if (!mappedPlace) return place;
            return {
              ...place,
              country: mappedPlace.country || place.country || '',
              region: mappedPlace.region || place.region || '',
              municipality: mappedPlace.municipality || place.municipality || '',
              parish: mappedPlace.parish || place.parish || '',
              village: mappedPlace.village || place.village || '',
              specific: mappedPlace.specific || place.specific || '',
              matched_place_id: mappedPlace.source || place.matched_place_id || 'reference'
            };
          } catch (e) {
            return place;
          }
        }));
      }

      const dataToImport = {
        ...data,
        places: enrichedPlaces
      };

      // Spara platser till backend
      if (dataToImport.places && dataToImport.places.length > 0) {
        for (const place of dataToImport.places) {
          try {
            await fetch('http://127.0.0.1:5005/place', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(place)
            });
          } catch (e) {
            console.error('Kunde inte spara plats:', place, e);
          }
        }
      }
      // Spara personer/källor på samma sätt som tidigare
      console.log("Skickar data till Electron...", dataToImport);
      const result = await window.electronAPI.importGedcom(dataToImport);
      if (result.success) {
        alert(`✅ Importen lyckades!\n${dataToImport.individuals.length} personer tillagda.`);
        if (props.onImport) {
          props.onImport(dataToImport);
        } else {
          window.location.reload();
        }
        setData(null);
      } else {
        alert("❌ Fel vid sparning: " + result.message);
      }
    } catch (error) {
      console.error(error);
      alert("Ett fel uppstod: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="p-10 border-2 border-dashed text-center rounded-lg bg-surface-2 border-subtle m-4">
        <h2 className="text-xl font-bold mb-4">Ladda upp GEDCOM</h2>
        <input type="file" accept=".ged" onChange={handleFileUpload} className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent-soft file:text-accent hover:file:bg-accent-soft/80" />
        {loading && <p className="mt-2 text-accent">Bearbetar...</p>}
      </div>
    );
  }

  return (
    <div className="p-4 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-4 border-b pb-4">
         <div>
            <h2 className="text-2xl font-bold">Import-granskning</h2>
            <div className="text-sm text-muted flex gap-4">
                <span>👤 {data.individuals.length} Personer</span>
                <span>🌍 {data.places.length} Platser</span>
                <span>📚 {data.sources.length} Källor</span>
            </div>
         </div>
         <div className="flex gap-3">
             <button onClick={() => setData(null)} className="px-4 py-2 border border-subtle rounded text-secondary hover:bg-surface">Ny fil</button>
             <button onClick={handleSave} className="px-6 py-2 bg-success text-on-accent font-bold rounded shadow hover:bg-success/90 flex items-center gap-2">
               <span>Importera Allt</span>
             </button>
         </div>
      </div>
      <div className="flex gap-4 flex-1 overflow-hidden">
        <div className="w-1/3 bg-surface-2 shadow rounded p-4 overflow-y-auto">
          <h3 className="font-bold border-b border-subtle pb-2 sticky top-0 bg-surface-2 text-primary">Personer</h3>
          <ul className="mt-2">
            {data.individuals.slice(0, 50).map(indi => (
              <li key={indi.id} className="py-2 border-b hover:bg-surface text-sm border-subtle">
                <div className="font-semibold text-primary">{indi.name}</div>
                <div className="flex justify-between text-xs text-muted">
                    <span>{indi.gender === 'K' ? 'Kvinna' : 'Man'}</span>
                    <span>Ref: {indi.refNumber}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="w-2/3 bg-background p-4 text-center text-muted">
            Förhandsgranskning av platser och källor döljs här.
        </div>
      </div>
    </div>
  );
};

export default GedcomImporter;