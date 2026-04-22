import React, { useState, useMemo, useEffect } from 'react';
import { parsePlaceString } from './parsePlaceString.js';
import { useApp } from './AppContext';
import { Settings, User, AlertTriangle, CheckCircle, HelpCircle, X, ArrowLeftRight, Save, FileText, Users, MapPin, Loader2, Sparkles, Check, Image as ImageIcon } from 'lucide-react';
import { auditGedcomImport } from './gedcom/audit';

// =====================================================================
//  TAG MAPPING & HELPERS
// =====================================================================

const TAG_MAP = {
  BIRT: 'Födelse',
  CHR: 'Dop',
  DEAT: 'Död',
  BURI: 'Begravning',
  MARR: 'Vigsel',
  DIV: 'Skilsmässa',
  RESI: 'Bosatt',
  OCCU: 'Yrke',
  EDUC: 'Utbildning',
  BAPM: 'Dop som vuxen',
  CONF: 'Konfirmation',
  NATU: 'Naturalisering',
  EMIG: 'Emigration',
  IMMI: 'Immigration',
  CENS: 'Folkräkning',
  PROB: 'Bouppteckning',
  ADOP: 'Adoption',
  WILL: 'Testamente',
  GRAD: 'Examen',
  EVEN: 'Egen händelse',
  RELI: 'Religionstillhörighet',
  TITL: 'Titel',
  PROP: 'Egendom',
  SSN: 'Socialförsäkringsnummer',
  IDNO: 'Nationalitet'
};

const formatDateToISO = (dateStr) => {
  if (!dateStr || !dateStr.trim()) return "";
  const original = dateStr.trim();
  let prefix = "";
  let dStr = original;
  const prefixMatch = original.match(/^(ABT|CAL|EST|FROM|TO|BEF|AFT|BET|OMKRING|CA|C|TILL|FÖRE|EFTER|MELLAN)\s+/i);
  if (prefixMatch) {
    const p = prefixMatch[1].toUpperCase();
    if (p === "FROM" || p === "FRÅN") prefix = "från ";
    else if (["ABT", "CAL", "EST", "OMKRING", "CA", "C"].includes(p)) prefix = "ca ";
    else if (p === "TO" || p === "BEF" || p === "TILL" || p === "FÖRE") prefix = "före ";
    else if (p === "AFT" || p === "EFTER") prefix = "efter ";
    else if (p === "BET" || p === "MELLAN") prefix = "mellan ";
    dStr = original.substring(prefixMatch[0].length);
  }
  const months = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12', OKT: '10', MAJ: '05' };
  const parseSingle = (s) => {
    const parts = s.toUpperCase().split(' ');
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
    if (/^\d{4}$/.test(s)) return s;
    return s;
  };
  if (dStr.includes(' - ') || dStr.includes(' AND ')) {
      const parts = dStr.split(/ - | AND /);
      return prefix + parts.map(p => parseSingle(p.trim())).join(' - ');
  }
  return prefix + parseSingle(dStr);
};

const parseGedcom = (fileContent) => {
  const lines = fileContent.split(/\r?\n/);
  const rootNodes = [];
  let stack = [];

  // Industriell ID-normalisering: gemener och endast alfanumeriska tecken
  const normId = (id) => (id || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.match(/^(\d+)\s+(@\w+@|\w+)(\s+(.*))?$/);
    if (!parts) return;
    const level = parseInt(parts[1], 10);
    const tagOrId = parts[2]; 
    let value = parts[4] || "";
    let tag = tagOrId;
    let id = null;

    if (tagOrId.startsWith("@")) { 
        id = tagOrId; 
        const vTrim = value.trim();
        const tagSplit = vTrim.split(/\s+/);
        tag = tagSplit[0];
        value = vTrim.substring(tag.length).trim();
    }

    const node = { tag, value, id: normId(id), children: [] };
    if (level === 0) { rootNodes.push(node); stack = [node]; } 
    else {
      while (stack.length > level) stack.pop();
      if (stack.length > 0) { stack[stack.length - 1].children.push(node); stack.push(node); }
    }
  });

  const getChild = (node, tag) => node.children.find(c => c.tag === tag);
  const getChildren = (node, tag) => node.children.filter(c => c.tag === tag);
  const getValue = (node, tag) => { const child = getChild(node, tag); return child ? child.value : ""; };
  
  const buildHtmlNote = (node) => {
    if (!node) return "";
    let content = (node.value || "").trim();
    node.children.forEach(child => { 
        if (child.tag === "CONC") content += (child.value || ""); 
        if (child.tag === "CONT") content += "\n" + (child.value || ""); 
    });
    return content.trim();
  };

  const sharedNotesMap = new Map();
  rootNodes.filter(n => n.tag === "NOTE" && n.id).forEach(n => {
      sharedNotesMap.set(n.id, buildHtmlNote(n));
  });

  const resolveNote = (noteTag) => {
      if (!noteTag) return "";
      const val = (noteTag.value || "").trim();
      const nId = normId(val);
      if (val.startsWith("@") && val.endsWith("@")) return sharedNotesMap.get(nId) || "";
      return buildHtmlNote(noteTag);
  };

  const allMediaMap = new Map();
  const parseMedia = (parent, returnIdsOnly = false) => {
    return getChildren(parent, "OBJE").map(obj => {
        let file = getValue(obj, "FILE");
        let title = getValue(obj, "TITL");
        let note = resolveNote(getChild(obj, "NOTE"));
        if (!file) {
            const fileNode = getChild(obj, "FILE");
            if (fileNode) file = fileNode.value;
        }
        if (!file) return null;
        
        // Stabil ID-generering baserat på filnamn för att undvika brott i filtrering
        const stableId = `med_${file.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let existing = allMediaMap.get(stableId);
        if (!existing) {
          existing = { 
            id: stableId, 
            url: file, 
            name: title || file.split(/[\\/]/).pop(), 
            note: note || title, 
            format: getValue(obj, "FORM") 
          };
          allMediaMap.set(stableId, existing);
        }
        return returnIdsOnly ? existing.id : existing;
    }).filter(Boolean);
  };

  // Pass 1: Skapa nameMap för att lösa vittnen senare
  const personNameMap = new Map();
  rootNodes.filter(n => n.tag === "INDI").forEach(node => {
      const nameNode = getChild(node, "NAME");
      const name = (nameNode ? nameNode.value : "").replace(/\//g, "").trim();
      const cleanId = normId(node.id);
      if (cleanId) personNameMap.set(cleanId, name);
  });

  // Pass 1b: Förbered platser och generera ID:n för hierarkisk länkning
  const foundPlaceStrings = new Set();
  rootNodes.forEach(node => {
    if (node.tag === "INDI") {
      node.children.forEach(child => {
        if (TAG_MAP[child.tag]) {
          const p = getValue(child, "PLAC").trim();
          if (p) foundPlaceStrings.add(p);
        }
      });
    }
  });
  const placeMap = new Map();
  const finalPlaces = Array.from(foundPlaceStrings).map(str => {
    const pId = `p_${str.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 32)}`;
    placeMap.set(str, pId);
    return { name: str, id: pId };
  });

  const individuals = [];
  const families = [];
  const finalSources = [];

  const masterSourceMap = new Map();
  rootNodes.filter(n => n.tag === "SOUR" && n.id).forEach(node => {
      let title = getValue(node, "TITL") || getValue(node, "ABBR") || getValue(node, "AUTH") || `Källa ${node.id}`;
      masterSourceMap.set(node.id, { 
        id: node.id, 
        title, 
        author: getValue(node, "AUTH"), 
        publisher: getValue(node, "PUBL"),
        note: resolveNote(getChild(node, "NOTE")) 
      });
  });

  const sourceCache = new Map();
  const getOrCreateSource = (masterId, page, note, quay) => {
      const mId = normId(masterId);
      const key = `${mId}-${page}-${note}`;
      if (sourceCache.has(key)) return sourceCache.get(key);
      const master = masterSourceMap.get(mId);
      if (!master) return null;
      const sid = `src_${Date.now()}_${Math.random()}`;
      const src = { ...master, id: sid, page: (page||'').trim(), note: (note||'').trim() || master.note, trust: (quay?parseInt(quay):0) };
      finalSources.push(src); sourceCache.set(key, sid); return sid;
  };

  rootNodes.forEach(node => {
    if (node.tag === "INDI") {
      const nameNode = getChild(node, "NAME");
      const cleanId = node.id || "Unknown";
      
      let refNumber = getValue(node, "REFN") || getValue(node, "RIN") || cleanId.replace(/\D/g, "");
      
      const events = [];
      node.children.forEach(child => {
        const mappedType = TAG_MAP[child.tag];
        if (mappedType) {
          const placeText = getValue(child, "PLAC").trim();
          const placeId = placeMap.get(placeText) || null; // <--- KRITISK FIX FÖR HIERARKI

          const linkedPersons = getChildren(child, "ASSO").map(asso => {
             const personId = normId(asso.value);
             if (!personId) return null;
             
             let role = getValue(asso, "ROLE").trim();
             if (/godp|godparent|fadder/i.test(role)) role = "Fadder";

             let name = personNameMap.get(personId) || personId;
             const inlineName = getValue(asso, "NAME").trim();
             if (inlineName) name = inlineName;

             return { 
               id: `wit_${Math.random().toString(36).substr(2, 9)}`, 
               personId: personId || null, 
               name: name || "Okänt vittne", 
               role: role || "Vittne",
               originalId: asso.value
             };
          }).filter(Boolean);

          const evSources = getChildren(child, "SOUR").map(srcNode => {
              const ref = normId(srcNode.value);
              if (!ref) return null;
              return getOrCreateSource(ref, getValue(srcNode, "PAGE"), resolveNote(getChild(srcNode, "NOTE")), getValue(srcNode, "QUAY"));
          }).filter(Boolean);

          events.push({
            id: `evt_${Math.random()}`,
            type: mappedType,
            date: formatDateToISO(getValue(child, "DATE")),
            place: placeText,
            placeId: placeId, // Koppla till strukturerad plats-post
            note: resolveNote(getChild(child, "NOTE")),
            sources: evSources,
            linkedPersons, 
            images: parseMedia(child, true)
          });
        }
      });

      const sexNode = getChild(node, "SEX");
      const sexValue = (sexNode ? sexNode.value : "").trim().toUpperCase().replace(/@/g, "");
      const isFemale = ['F','K','KVINNA','FEMALE','2'].includes(sexValue);

      const personalNotes = getChildren(node, "NOTE").map((n, i) => ({
          id: `note_${cleanId}_${i}`, title: 'Notering', content: resolveNote(n), createdAt: new Date().toISOString()
      })).filter(n => n.content);

      individuals.push({
        id: cleanId,
        refNumber: refNumber || null,
        name: (nameNode ? nameNode.value : "").replace(/\//g, "").trim(),
        firstName: getValue(nameNode, "GIVN"),
        lastName: getValue(nameNode, "SURN"),
        gender: isFemale ? 'K' : 'M',
        sex: isFemale ? 'K' : 'M',
        events,
        notes: personalNotes,
        media: parseMedia(node, false),
        relations: { parents: [], children: [], spouseId: null }
      });
    } else if (node.tag === "FAM") {
      families.push({ id: normId(node.id), husb: normId(getValue(node, "HUSB")), wife: normId(getValue(node, "WIFE")), children: getChildren(node, "CHIL").map(c => normId(c.value)) });
    }
  });

  const personMap = new Map(individuals.map(p => [p.id, p]));
  families.forEach(fam => {
    const h = personMap.get(fam.husb); const w = personMap.get(fam.wife);
    if (h && w) { h.relations.spouseId = w.id; w.relations.spouseId = h.id; }
    fam.children.forEach(cid => {
        const c = personMap.get(cid);
        if (c) {
            if (h) c.relations.parents.push({ id: h.id, status: 'biologisk' });
            if (w) c.relations.parents.push({ id: w.id, status: 'biologisk' });
        }
    });
  });

  return { individuals, sources: finalSources, places: finalPlaces, mediaFiles: Array.from(allMediaMap.values()) };
};

// =====================================================================
//  REACT COMPONENT
// =====================================================================

const GedcomImporter = (props) => {
  const { dbData } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [auditResults, setAuditResults] = useState([]);
  const [userChoices, setUserChoices] = useState({});
  const [reviewPerson, setReviewPerson] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8"); 
    reader.onload = (event) => {
      const parsed = parseGedcom(event.target.result);
      setData(parsed);
      const results = auditGedcomImport(parsed, dbData.people || []);
      setAuditResults(results);
      const initial = {};
      results.forEach(res => { initial[res.id] = res.status === 'IDENTICAL' ? 'skip' : (res.status === 'DUPLICATE' ? 'review' : 'import'); });
      setUserChoices(initial);
      setLoading(false);
    };
  };

  const handleSave = async () => {
    if (!data) return;
    try {
      setLoading(true);
      const beneficiaries = data.individuals.filter(ind => ind && ['import', 'overwrite', 'merge'].includes(userChoices[ind.id]));
      
      // Skicka med databassökvägen så att backenden vet var den ska spara
      const importData = { 
        ...data, 
        individuals: beneficiaries,
        // data.mediaFiles innehåller redan Map-värdena från parseGedcom
        dbPath: props.dbPath || (window.electronAPI.getCurrentDbPath ? await window.electronAPI.getCurrentDbPath() : null)
      };
      
      console.log("[GedcomImporter] Sparar importData:", {
        indCount: importData.individuals.length,
        mediaCount: importData.mediaFiles.length,
        placeCount: (importData.places || []).length
      });

      const result = await window.electronAPI.importGedcom(importData);
      
      if (result.success) {
        setImportSummary({ 
           people: beneficiaries.length, 
           sources: (data.sources || []).length, 
           places: (data.places || []).length, 
           media: (importData.mediaFiles || []).length,
           time: new Date().toLocaleTimeString() 
        });
        if (props.onImport) props.onImport({ ...data, individuals: beneficiaries, enriched: result.enriched });
      } else alert("Fel: " + result.message);
    } catch (e) { alert("Fel: " + e.message); } finally { setLoading(false); }
  };

  if (importSummary) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in">
          <div className="w-20 h-20 bg-success-soft text-success rounded-full flex items-center justify-center mb-6 border border-success/20"><Check size={40} /></div>
          <h2 className="text-3xl font-black text-primary mb-2">Import Slutförd!</h2>
          <p className="text-secondary mb-8">{importSummary.people} personer, {importSummary.sources} källor, {importSummary.media} media och {importSummary.places} platser har importerats.</p>
          <button onClick={() => { if(props.onImport) props.onImport(null); }} className="px-10 py-4 bg-accent text-on-accent font-black rounded-2xl shadow-xl hover:scale-105 transition-all">Stäng</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-20 border-4 border-dashed rounded-3xl bg-surface-2 border-subtle m-4 flex flex-col items-center">
        <div className="w-16 h-16 bg-accent-soft text-accent rounded-2xl flex items-center justify-center mb-6"><FileText size={32}/></div>
        <h2 className="text-2xl font-black text-primary mb-2">Ladda upp GEDCOM</h2>
        <input type="file" accept=".ged" onChange={handleFileUpload} className="block w-full max-w-xs text-sm text-muted file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-accent file:text-on-accent" />
        {loading && <div className="mt-6 text-accent font-bold animate-pulse">Bearbetar...</div>}
      </div>
    );
  }

  return (
    <div className="h-[75vh] flex flex-col bg-surface overflow-hidden">
      <div className="p-6 border-b border-subtle bg-surface-2 flex justify-between items-center shadow-sm">
          <div>
              <h2 className="text-2xl font-black text-primary tracking-tight">Import-granskning</h2>
              <div className="flex gap-4 mt-1 text-[10px] font-bold uppercase text-secondary tracking-widest">
                  <span><Users size={12} className="inline mr-1"/> {data.individuals.length} Individer</span>
                  <span><ImageIcon size={12} className="inline mr-1"/> {data.individuals.reduce((acc, ind) => acc + (ind.media?.length || 0), 0)} Media</span>
                  <span><MapPin size={12} className="inline mr-1"/> {data.places.length} Platser</span>
              </div>
          </div>
          <div className="flex gap-4">
              <button onClick={() => setData(null)} className="px-5 py-2.5 text-sm font-bold border border-subtle rounded-xl text-secondary hover:bg-surface-3">Avbryt</button>
              <button onClick={handleSave} disabled={loading} className="px-8 py-2.5 bg-accent text-on-accent font-black rounded-xl shadow-lg hover:after:opacity-95 active:scale-95 transition-all">
                {loading ? 'Sparar...' : 'Genomför Import'}
              </button>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/30">
          {auditResults.map(res => (
              <div key={res.id} className="bg-surface rounded-2xl border border-subtle p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${res.status==='NEW'?'bg-success-soft text-success':'bg-accent-soft text-accent'}`}>
                          {(res.person.firstName?.[0] || res.person.name?.[0] || '?')}
                      </div>
                      <div>
                          <div className="font-black text-primary">{res.person.firstName} {res.person.lastName}</div>
                          <div className="text-[10px] text-muted font-bold uppercase tracking-wider">
                              Ref: {res.person.refNumber} · {res.person.gender==='K'?'Kvinna':'Man'} · {res.person.events?.length || 0} händelser
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      <select 
                        value={userChoices[res.id]} 
                        onChange={(e) => setUserChoices(c => ({ ...c, [res.id]: e.target.value }))}
                        className="p-2.5 rounded-xl border border-subtle text-xs font-bold bg-surface-2"
                      >
                          <option value="import">Importera som ny</option>
                          <option value="overwrite">Skriv över befintlig</option>
                          <option value="skip">Hoppa över</option>
                      </select>
                      {res.status !== 'NEW' && <button onClick={() => setReviewPerson({ gedcom: res.person, existing: res.match, resId: res.id })} className="p-2.5 text-secondary hover:bg-surface-3 rounded-xl border border-subtle"><ArrowLeftRight size={20}/></button>}
                  </div>
              </div>
          ))}
      </div>

      {reviewPerson && (
          <div className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setReviewPerson(null)}>
              <div className="bg-surface rounded-3xl border border-subtle shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
                  <div className="p-6 border-b border-subtle flex justify-between items-center bg-surface-2">
                      <h3 className="text-2xl font-black text-primary">Jämför Data</h3>
                      <button onClick={()=>setReviewPerson(null)}><X/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 grid grid-cols-2 gap-12">
                      <div className="space-y-6">
                          <label className="text-[10px] font-black uppercase text-secondary tracking-widest pl-2">Befintlig i databas</label>
                          <div className="p-8 bg-surface-2 rounded-3xl border border-subtle">
                             <div className="text-3xl font-black text-primary">{reviewPerson.existing.firstName} {reviewPerson.existing.lastName}</div>
                             <div className="mt-8 space-y-4">
                                 {reviewPerson.existing.events?.map((e,i)=>(
                                     <div key={i} className="p-4 bg-surface rounded-2xl border border-subtle shadow-sm">
                                         <div className="text-[10px] font-black uppercase text-secondary">{e.type}</div>
                                         <div className="text-sm font-bold">{e.date || '—'}</div>
                                         <div className="text-xs text-secondary mt-1">{e.place || '—'}</div>
                                     </div>
                                 ))}
                             </div>
                          </div>
                      </div>
                      <div className="space-y-6">
                          <label className="text-[10px] font-black uppercase text-accent tracking-widest pl-2">Ny från GEDCOM (Översatt)</label>
                          <div className="p-8 bg-accent-soft/20 rounded-3xl border border-accent/20 border-dashed">
                             <div className="text-3xl font-black text-primary">{reviewPerson.gedcom.firstName} {reviewPerson.gedcom.lastName}</div>
                             <div className="mt-8 space-y-4">
                                 {reviewPerson.gedcom.events?.map((e,i)=>(
                                     <div key={i} className="p-4 bg-surface rounded-2xl border border-accent/10 shadow-sm">
                                         <div className="text-[10px] font-black uppercase text-accent">{e.type}</div>
                                         <div className="text-sm font-bold">{e.date || '—'}</div>
                                         <div className="text-xs text-secondary mt-1">{e.place || '—'}</div>
                                     </div>
                                 ))}
                             </div>
                          </div>
                      </div>
                  </div>
                  <div className="p-6 border-t border-subtle bg-surface-2 flex justify-end gap-4">
                      <button onClick={()=>setReviewPerson(null)} className="px-6 py-3 font-bold text-secondary">Stäng</button>
                      <button onClick={()=>{setUserChoices(c=>({...c,[reviewPerson.resId]:'overwrite'}));setReviewPerson(null)}} className="px-10 py-3 bg-accent text-on-accent font-black rounded-2xl shadow-xl">Använd GEDCOM Data</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default GedcomImporter;