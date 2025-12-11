const fs = require('fs').promises;
const path = require('path');
let iconv;
try {
  iconv = require('iconv-lite');
} catch (e) {
  console.warn('[gedcom-handler] iconv-lite not installed; falling back to simple decoding:', e && e.message);
  iconv = null;
}
let parseGedcom;
try {
  parseGedcom = require('parse-gedcom');
} catch (e) {
  console.error('[gedcom-handler] parse-gedcom not installed:', e && e.message);
  parseGedcom = null;
}
const { dialog } = require('electron');

async function readGedcom(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    let text = buffer.toString('utf8');

    if (!parseGedcom) {
      dialog.showErrorBox('Missing dependency', 'The package "parse-gedcom" is not installed for the Electron main process.\nPlease run `npm install parse-gedcom` in the electron folder.');
      return { error: 'parse-gedcom not installed' };
    }

    let parsed = null;
    // Helper to invoke the parser whether it exports a function or an object with .parse
    const invokeParser = (p, txt) => {
      if (typeof p === 'function') return p(txt);
      if (p && typeof p.parse === 'function') return p.parse(txt);
      throw new Error('Unsupported parse-gedcom export shape');
    };

    try {
      parsed = invokeParser(parseGedcom, text);
    } catch (parseErr) {
      // Try alternative decoding with iconv if available (common for Windows-1252 encoded GEDCOMs)
      if (iconv) {
        try {
          const alt = iconv.decode(buffer, 'win1252');
          parsed = invokeParser(parseGedcom, alt);
        } catch (reErr) {
          console.error('[gedcom-handler] parse-gedcom failed after recode:', reErr);
          throw reErr;
        }
      } else {
        console.error('[gedcom-handler] parse-gedcom initial parse failed and no iconv available:', parseErr);
        throw parseErr;
      }
    }

    // Fallback normalizer to produce a flat array of nodes
    function collectNodesLocal(root) {
      const out = [];
      const stack = Array.isArray(root) ? [...root] : [root];
      while (stack.length) {
        const n = stack.shift();
        if (!n) continue;
        if (n.tag) out.push(n);
        if (n.children && Array.isArray(n.children)) {
          for (const c of n.children) stack.push(c);
        }
        if (n.records && Array.isArray(n.records)) {
          for (const c of n.records) stack.push(c);
        }
      }
      return out;
    }

    const rootNodes = Array.isArray(parsed) ? parsed : (parsed && parsed.children ? parsed.children : parsed);
    const safeNodes = Array.isArray(rootNodes) ? rootNodes : collectNodesLocal(parsed);

    const individuals = (safeNodes || []).filter(n => n && n.tag === 'INDI').length;
    const families = (safeNodes || []).filter(n => n && n.tag === 'FAM').length;
    const sources = (safeNodes || []).filter(n => n && n.tag === 'SOUR').length;

    return { parsed, summary: { individuals, families, sources } };
  } catch (err) {
    console.error('[gedcom-handler] readGedcom error:', err);
    return { error: err && err.message ? err.message : String(err) };
  }
}

// applyGedcom: use the renderer-side mapper (shared code in src/gedcom/mapper.js)
async function applyGedcom(parsed, options = {}) {
  try {
    // Attempt to load the mapper from the app source tree. Support CJS (require)
    // and ESM (dynamic import) variants so the main process won't fail when
    // the renderer project uses "type": "module".
    let mapper = null;
    try {
      mapper = require('../WestFamilyTree/src/gedcom/mapper.js');
      console.debug('[gedcom-handler] loaded mapper via require (relative)');
    } catch (e) {
      try {
        mapper = require(path.join(__dirname, '..', 'WestFamilyTree', 'src', 'gedcom', 'mapper.js'));
        console.debug('[gedcom-handler] loaded mapper via require (path.join)');
      } catch (e2) {
        try {
          const abs = path.join(__dirname, '..', 'WestFamilyTree', 'src', 'gedcom', 'mapper.js');
          const url = 'file://' + abs;
          console.debug('[gedcom-handler] attempting dynamic import of mapper from', url);
          const imported = await import(url);
          mapper = imported && (imported.default || imported);
          console.debug('[gedcom-handler] loaded mapper via dynamic import');
        } catch (impErr) {
          console.error('[gedcom-handler] Failed to load mapper via require/import:', impErr && impErr.message ? impErr.message : impErr);
          mapper = null;
        }
      }
    }

    if (mapper && typeof mapper.mapParsedGedcom === 'function') {
      try {
        const mapped = mapper.mapParsedGedcom(parsed);
        try {
          const pCount = mapped && mapped.people ? mapped.people.length : 0;
          const fCount = mapped && mapped.families ? mapped.families.length : 0;
          const sCount = mapped && mapped.sources ? mapped.sources.length : 0;
          console.debug('[gedcom-handler] mapper produced mapped counts:', { people: pCount, families: fCount, sources: sCount });
        } catch (logErr) {}
        return { applied: true, mapped, options };
      } catch (mapErr) {
        console.error('[gedcom-handler] mapper.mapParsedGedcom error:', mapErr && mapErr.message ? mapErr.message : mapErr);
        // fall through to the summary fallback below
      }
    }

    // Normalise parsed into an array of nodes before filtering to avoid
    // "(parsed || []).filter is not a function" when parsed is an object.
    function collectNodesLocal(root) {
      const out = [];
      const stack = Array.isArray(root) ? [...root] : [root];
      while (stack.length) {
        const n = stack.shift();
        if (!n) continue;
        if (n.tag) out.push(n);
        if (n.children && Array.isArray(n.children)) {
          for (const c of n.children) stack.push(c);
        }
        if (n.records && Array.isArray(n.records)) {
          for (const c of n.records) stack.push(c);
        }
      }
      return out;
    }

    const rootNodes = Array.isArray(parsed) ? parsed : (parsed && parsed.children ? parsed.children : parsed);
    const safeNodes = Array.isArray(rootNodes) ? rootNodes : collectNodesLocal(parsed);

    const individuals = (safeNodes || []).filter(n => n && n.tag === 'INDI').length;
    const families = (safeNodes || []).filter(n => n && n.tag === 'FAM').length;
    const sources = (safeNodes || []).filter(n => n && n.tag === 'SOUR').length;

    return { applied: true, created: { individuals, families, sources }, parsed, options };
  } catch (err) {
    console.error('[gedcom-handler] applyGedcom error:', err);
    return { error: err && err.message ? err.message : String(err) };
  }
}

async function writeGedcom(dbData, options = {}) {
  // Stub: generating GEDCOM is left for later implementation.
  return { error: 'writeGedcom not implemented yet' };
}

module.exports = { readGedcom, applyGedcom, writeGedcom };
