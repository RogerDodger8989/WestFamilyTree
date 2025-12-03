import React, { useState, useEffect, useRef } from 'react';

// Ikoner för varje platstyp
const PLACE_TYPE_ICONS = {
  'Country': '🌍',
  'Landscape': '🏞️',
  'County': '🗺️',
  'Municipality': '🏛️',
  'Parish': '⛪',
  'Village': '🏘️',
  'Building': '🏠',
  'Cemetary': '🪦',
  'default': '📍'
};

const PLACE_TYPE_LABELS = {
  'Country': 'Land',
  'Landscape': 'Landskap',
  'County': 'Län',
  'Municipality': 'Kommun',
  'Parish': 'Församling/socken',
  'Village': 'By/Ort',
  'Building': 'Byggnad',
  'Cemetary': 'Kyrkogård',
  'default': 'Plats'
};

// Lazy loading hooks för platsträd
function useLazyPlaceTree() {
    const [lan, setLan] = useState([]); // [{ lanskod, lansnamn }]
    const [children, setChildren] = useState({}); // key: kod, value: { kommuner, församlingar, orter }
    const [loading, setLoading] = useState({}); // key: kod, value: true/false
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('http://127.0.0.1:5005/official_places/lan')
            .then(res => res.json())
            .then(setLan)
            .catch(e => setError(e.message));
    }, []);

    // Ladda barn till en nod (län, kommun, församling)
    const loadChildren = async (type, code) => {
        setLoading(l => ({ ...l, [code]: true }));
        let url = '';
        if (type === 'lan') url = `http://127.0.0.1:5005/official_places/kommuner/${code}`;
        else if (type === 'kommun') url = `http://127.0.0.1:5005/official_places/forsamlingar/${code}`;
        else if (type === 'forsamling') url = `http://127.0.0.1:5005/official_places/orter/${encodeURIComponent(code)}`;
        else return;
        try {
            const res = await fetch(url);
            const data = await res.json();
            setChildren(prev => ({ ...prev, [code]: data }));
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(l => ({ ...l, [code]: false }));
        }
    };

    return { lan, children, loading, error, loadChildren };
}
        const setActiveTab = (tab) => setCatalogState(prev => ({ ...prev, activeTab: tab }));
import UndoToast from './UndoToast.jsx';
import PlaceCreateModal from './PlaceCreateModal.jsx';
import PlaceLinkModal from './PlaceLinkModal.jsx';

// Slask-vy för omatchade platser (nu som egen flik)
function UnmatchedPlacesPanel() {
        const [undoData, setUndoData] = useState(null); // { placeId, prevMatchedPlaceId }
        const [showUndo, setShowUndo] = useState(false);
    const [unmatched, setUnmatched] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [prefillFields, setPrefillFields] = useState({});
    const [status, setStatus] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setLoading(true);
        fetch('http://127.0.0.1:5005/places/unmatched')
            .then(res => res.json())
            .then(data => setUnmatched(data))
            .finally(() => setLoading(false));
    }, [status]);


    const [officialPlaces, setOfficialPlaces] = useState([]);
    useEffect(() => {
        fetch('http://127.0.0.1:5005/official_places')
            .then(res => res.json())
            .then(data => setOfficialPlaces(data || []));
    }, []);

    const [showLinkModal, setShowLinkModal] = useState(false);
    const [selectedOfficialPlace, setSelectedOfficialPlace] = useState(null);

    const handleLinkModal = (placeId) => {
        const p = unmatched.find(p => p.id === placeId);
        // Sök efter officiell plats med samma ortnamn
        const match = officialPlaces.find(op => op.ort === p?.name || op.name === p?.name);
        if (match) {
            setSelectedOfficialPlace(match);
            setShowLinkModal(true);
            setEditId(placeId);
        } else {
            setPrefillFields({ name: p?.name || '', ort: p?.name || '' });
            setShowCreateModal(true);
            setEditId(null);
        }
    };

    const handleLink = async (officialPlace) => {
        if (!editId || !officialPlace) return;
        setStatus("Sparar...");
        const prev = unmatched.find(p => p.id === editId)?.matched_place_id || null;
        await fetch(`http://127.0.0.1:5005/place/${editId}/match`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matched_place_id: officialPlace.id })
        });
        setUndoData({ placeId: editId, prevMatchedPlaceId: prev });
        setShowUndo(true);
        setStatus("Uppdaterad!");
        setEditId(null);
        setTimeout(() => setStatus("") , 1000);
    };

    const handleUndo = async () => {
        if (!undoData) return;
        setStatus("Ångrar...");
        await fetch(`http://127.0.0.1:5005/place/${undoData.placeId}/match`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matched_place_id: undoData.prevMatchedPlaceId })
        });
        setShowUndo(false);
        setUndoData(null);
        setStatus("Rättning ångrad!");
        setTimeout(() => setStatus("") , 1000);
    };

    const handleSuggestionClick = (suggestion) => {
        setNewMatch(suggestion.id);
        setShowSuggestions(false);
    };

    // Fritextsökning (alla fält, redan bra)
    const filteredUnmatched = searchTerm
        ? unmatched.filter(place =>
            Object.values(place).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : unmatched;

    // Parser-funktion för platssträng
    function getParsedInfo(place) {
        // Använd name + ev. land/region om de finns
        let str = place.name;
        if (place.country) str += ', ' + place.country;
        if (place.region) str += ', ' + place.region;
        // Importera parsePlaceString
        try {
            // eslint-disable-next-line
            const parsed = require('./parsePlaceString.js').parsePlaceString(str);
            return parsed;
        } catch {
            return null;
        }
    }

    // Radera plats
    const handleDelete = async (placeId) => {
        const place = unmatched.find(p => p.id === placeId);
        let warning = '';
        if (place && place.linkCount > 0) {
            warning = `OBS! Platsen är kopplad till ${place.linkCount} person${place.linkCount > 1 ? 'er/händelser' : '/händelse'} och bör inte raderas om du vill behålla dessa kopplingar.\n\n`;
        }
        if (!window.confirm(warning + 'Vill du verkligen radera denna plats? Detta kan inte ångras.')) return;
        setStatus('Raderar...');
        await fetch(`http://127.0.0.1:5005/place/${placeId}`, { method: 'DELETE' });
        setStatus('Plats raderad!');
        setTimeout(() => setStatus(''), 1000);
    };

    const [showLinksFor, setShowLinksFor] = useState(null);
    return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded mb-6 flex flex-col h-[60vh] min-h-[300px] max-h-[80vh]">
            <h3 className="font-bold text-lg mb-2 text-yellow-800">
                Platser att rätta (slask)
                {filteredUnmatched.length > 0 && (
                    <span className="ml-2 bg-red-200 text-red-800 rounded-full px-2 py-0.5 text-xs align-middle">{filteredUnmatched.length}</span>
                )}
            </h3>
            <div className="mb-2">
                <label className="text-xs text-gray-500">Sök i platser:</label>
                <input
                    type="text"
                    placeholder="Fritextsökning..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full text-xs border rounded p-1"
                />
            </div>
            <div className="flex-1 min-h-0">
                {loading ? <div>Laddar...</div> : (
                    <ul className="space-y-2 h-full max-h-full overflow-y-auto pr-2">
                        {filteredUnmatched.length === 0 && <li className="text-gray-500">Inga omatchade platser 🎉</li>}
                        {filteredUnmatched.map(place => {
                            const parsed = getParsedInfo(place);
                            const hasLinks = Array.isArray(place.links) && place.links.length > 0;
                            return (
                            <li key={place.id} className="flex flex-col gap-1 relative group border-b pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="flex-1">
                                        {place.name} {place.country && `(${place.country})`}
                                        {/* Kopplingsinfo: visa antal kopplingar ALLTID */}
                                        {typeof place.linkCount === 'number' && (
                                            <button
                                                className="ml-2 text-xs text-blue-700 bg-blue-100 rounded px-2 py-0.5 hover:bg-blue-200 focus:outline-none"
                                                onClick={() => setShowLinksFor(showLinksFor === place.id ? null : place.id)}
                                                title="Visa kopplade personer/händelser"
                                            >
                                                {place.linkCount} koppling{place.linkCount === 1 ? '' : 'ar'}
                                            </button>
                                        )}
                                    </span>
                                    <button onClick={() => handleLinkModal(place.id)} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">Rätta</button>
                                    <button onClick={() => handleDelete(place.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded ml-1 opacity-80 group-hover:opacity-100 transition-opacity" title="Radera plats">Radera</button>
                                </div>
                                {/* Visa kopplade personer/händelser i en liten lista vid klick */}
                                {hasLinks && showLinksFor === place.id && (
                                    <div className="ml-2 mt-1 text-xs text-gray-700 bg-blue-50 border border-blue-200 rounded p-2 max-w-md">
                                        <div className="font-semibold text-blue-900 mb-1">Kopplade personer/händelser:</div>
                                        <ul className="list-disc ml-4">
                                            {place.links.map(link => (
                                                <li key={link.personId + '_' + link.eventId}>
                                                    <span className="font-bold">{link.personName}</span>
                                                    {link.eventType && <span> – {link.eventType}</span>}
                                                    {link.eventDate && <span> ({link.eventDate})</span>}
                                                </li>
                                            ))}
                                        </ul>
                                        <button onClick={() => setShowLinksFor(null)} className="mt-2 px-2 py-1 text-xs bg-gray-200 rounded">Stäng</button>
                                    </div>
                                )}
                                {/* Visa parser-info för platsen */}
                                {parsed && (
                                    <div className="ml-2 mt-1 text-xs text-gray-600">
                                        <span className="font-semibold">Parser:</span> {parsed.type || 'okänd'} {parsed.countryCode && `(${parsed.countryCode})`} {parsed.usedHeuristics && <span className="text-orange-600">(heuristik)</span>}
                                        {parsed.parts && parsed.parts.length > 0 && (
                                            <span className="ml-2">[
                                                {parsed.parts.map((part, idx) => (
                                                    <span key={idx} className="bg-gray-100 rounded px-2 py-0.5 mx-0.5">{part}</span>
                                                ))}
                                            ]</span>
                                        )}
                                    </div>
                                )}
                                {/* Visa kopplade personer/händelser */}
                                {Array.isArray(place.links) && place.links.length > 0 && (
                                    <div className="ml-2 mt-1 text-xs text-gray-700">
                                        <span className="font-semibold text-blue-900">Kopplingar:</span>
                                        <ul className="list-disc ml-4">
                                            {place.links.map(link => (
                                                <li key={link.personId + '_' + link.eventId}>
                                                    <span className="font-bold">{link.personName}</span>
                                                    {link.eventType && <span> – {link.eventType}</span>}
                                                    {link.eventDate && <span> ({link.eventDate})</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </li>
                        );})}
                    </ul>
                )}
            </div>
            {status && <div className="text-green-700 mt-2">{status}</div>}
            <UndoToast
                isVisible={showUndo}
                message="Plats rättad. Ångra?"
                onUndo={handleUndo}
                duration={10000}
            />
            {showLinkModal && selectedOfficialPlace && (
                <PlaceLinkModal
                    place={selectedOfficialPlace}
                    onClose={() => { setShowLinkModal(false); setSelectedOfficialPlace(null); setEditId(null); }}
                    onLink={handleLink}
                    disableEdit={true}
                />
            )}
            {showCreateModal && (
                <PlaceCreateModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onCreate={fields => {
                        setShowCreateModal(false);
                        setPrefillFields({});
                        // Du kan lägga till logik för att skapa plats här, t.ex. via props eller context
                    }}
                    prefillFields={prefillFields}
                    onFoundExistingPlace={(match, payload) => {
                        setShowCreateModal(false);
                        setSelectedOfficialPlace(match);
                        setShowLinkModal(true);
                        // Om du vill kan du spara payload för att visa info i PlaceLinkModal
                    }}
                />
            )}
        </div>
    );
}
import Editor from './MaybeEditor.jsx';
import PlaceConnections from './PlaceConnections.jsx'; // NY: Importera den nya komponenten
import PlaceSourceConnections from './PlaceSourceConnections.jsx'; // NYTT: Importera källkopplingskomponenten
import StatusBadge from './StatusBadge.jsx';
import { parsePlaceString } from './parsePlaceString.js';

// NYTT: Ett "bibliotek" med alla platstyper för att göra koden ren och underhållbar.
export const PLACE_TYPES = {
    'default':      { icon: '📍', label: 'Landområde / övrig plats' },
    'industry':     { icon: '🏭', label: 'Bruk / fabrik / kvarn / gruva' },
    'village_town': { icon: '🏘️', label: 'By / samhälle' },
    'court_district': { icon: '⚖️', label: 'Domsaga' },
    'prison':       { icon: '🏢', label: 'Fängelse / anstalt' },
    'parish_church':{ icon: '⛪', label: 'Församling / socken / kyrka' },
    'street_block': { icon: '🏙️', label: 'Gata / kvarter / stadsdel' },
    'estate':       { icon: '🏰', label: 'Gods / säteri' },
    'farm_manor':   { icon: '🏡', label: 'Gård / herrgård / hemman' },
    'harbor':       { icon: '⚓', label: 'Hamn' },
    'hundred':      { icon: '⚖️', label: 'Härad / tingslag' },
    'municipality': { icon: '🏛️', label: 'Kommun' },
    'cemetery':     { icon: '🪦', label: 'Kyrkogård / gravplats' },
    'country':      { icon: '👑', label: 'Land' },
    'landscape':    { icon: '🏞️', label: 'Landskap' },
    'county':       { icon: '🗺️', label: 'Län / fylke / amt' },
    'military':     { icon: '⚔️', label: 'Militärförläggning' },
    'pastorate':    { icon: '⛪', label: 'Pastorat' },
    'province':     { icon: '🌍', label: 'Provins / region' },
    'rote':         { icon: '📍', label: 'Rote' },
    'hospital':     { icon: '🏥', label: 'Sjukhus / behandlingshem' },
    'lake_river':   { icon: '🌊', label: 'Sjö / vattendrag' },
    'castle':       { icon: '🏯', label: 'Slott' },
    'city':         { icon: '🏙️', label: 'Stad' },
    'state':        { icon: '🏛️', label: 'Stat' },
    'diocese':      { icon: '⛪', label: 'Stift' },
    'cottage':      { icon: '🏡', label: 'Stuga / torp' },
    'university':   { icon: '🏫', label: 'Universitet / läroverk' },
};

const HIERARCHY_LEVELS = ['country', 'region', 'municipality', 'parish', 'village', 'specific'];

const SWEDISH_LABELS = {
    country: 'Land',
    region: 'Region/Län/Delstat',
    municipality: 'Kommun/Stad',
    parish: 'Socken/Församling',
    village: 'By/Ort/Adress',
    specific: 'Specifik plats',
};

// --- Ikoner för varje nivå ---
function PlaceIcon({ level, className = '' }) {
    const icons = {
        country: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h8a2 2 0 002-2v-1a2 2 0 012-2h1.945M7.737 16.525l-.01-.01M16.263 16.525l-.01-.01M12 20.055V21m0-18v.945" /></svg>,
        region: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m-6 3l6-3" /></svg>,
        municipality: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
        parish: <svg className={className} fill="currentColor" viewBox="0 0 20 20"><path d="M10 2L.5 6.11l.9 1.79L2 7.58V18h16V7.58l.6.32.9-1.79L10 2zm4 14h-2v-4a2 2 0 00-4 0v4H6V7.88l4-2.12 4 2.12V16z"></path></svg>,
        village: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        specific: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    };
    return icons[level] || null;
}

// --- Bygg hierarkiskt träd från en platt lista ---
// --- Normaliseringshjälp för trädnycklar ---
function normalizeTreeKey(val) {
    if (typeof val !== 'string') return '';
    return val.trim().toLowerCase();
}

function buildPlaceTree(places) {
    const root = { _children: {}, _places: [] };
    if (!places) return root._children;

    for (const place of places) {
        let currentNode = root;
        let lastValidNode = root;
        let lastValidValue = null;

        // Hitta den djupaste noden baserat på platsens hierarki
        for (const level of HIERARCHY_LEVELS) {
            const value = place[level];
            if (!value) continue; // Hoppa över tomma nivåer
            const normKey = normalizeTreeKey(value);

            // Spara originalvärdet för visning, men gruppera på normaliserad nyckel
            if (!currentNode._children[normKey]) {
                currentNode._children[normKey] = { _children: {}, _places: [], _displayName: value };
            }
            currentNode = currentNode._children[normKey];
            // Om displayName är tom, uppdatera till första icke-tomma
            if (!currentNode._displayName) currentNode._displayName = value;
            lastValidNode = currentNode;
            lastValidValue = value;
        }

        // Lägg till platsen i den sista giltiga noden som hittades
        lastValidNode._places.push(place);
    }
    return root._children;
}

// --- Komponent för att rendera träd-vyn ---
// Lazy tree view för officiella platser
function LazyPlaceTreeView({ lan, children, loading, expanded, setExpanded, loadChildren, setSelectedPlaceId }) {
    // Helper: fallback for missing names
    const safeName = (val, fallback) => (val && String(val).trim().length > 0 ? val : fallback);
    // Swedish labels for each level
    const LEVEL_LABELS = {
        sverige: 'Land',
        lan: 'Län',
        kommun: 'Kommun',
        forsamling: 'Församling',
        ort: 'Ort',
    };
    // Icons for each level
    const LEVEL_ICONS = {
        sverige: '🇸🇪',
        lan: '🗺️',
        kommun: '🏛️',
        forsamling: '⛪',
        ort: '📍',
    };
    return (
        <div>
            {/* Sverige som toppnod, nu som riktig nod */}
            <div key="sverige-root">
                <div
                    className="flex items-center gap-2 font-bold cursor-pointer bg-gray-100 rounded p-1 mb-1"
                    style={{ fontSize: '1.1em' }}
                >
                    <span>{LEVEL_ICONS.sverige}</span>
                    <span className="font-semibold">Sverige</span>
                    <span className="text-xs text-gray-500">({LEVEL_LABELS.sverige})</span>
                </div>
                <div className="ml-4">
                    {lan.length === 0 && <div className="text-xs text-gray-400">Inga län funna</div>}
                    {lan.filter(lanObj => lanObj.lansnamn && lanObj.lansnamn.trim() !== '').map(lanObj => (
                        <div key={`lan-${lanObj.lanskod}-${lanObj.lansnamn}`}> 
                            <div
                                className="flex items-center gap-2 font-semibold cursor-pointer hover:bg-gray-100 rounded p-1"
                                onClick={() => {
                                    setExpanded(lanObj.lanskod);
                                    if (!children[lanObj.lanskod]) loadChildren('lan', lanObj.lanskod);
                                }}
                            >
                                {expanded[lanObj.lanskod] ? (
                                    <span>▼</span>
                                ) : (
                                    <span>▶</span>
                                )}
                                <span>{LEVEL_ICONS.lan}</span>
                                <span className="font-semibold">{lanObj.lansnamn}</span>
                                {lanObj.lanskod && (
                                    <span className="text-xs text-gray-500">({lanObj.lanskod})</span>
                                )}
                                <span className="text-xs text-gray-500">({LEVEL_LABELS.lan})</span>
                            </div>
                            {expanded[lanObj.lanskod] && (
                                <div className="ml-4">
                                    {loading[lanObj.lanskod] ? <div className="text-xs text-gray-400">Laddar kommuner...</div> : (
                                        (children[lanObj.lanskod] && children[lanObj.lanskod].length > 0) ? (
                                            children[lanObj.lanskod].filter(kommun => kommun.kommunnamn && kommun.kommunnamn.trim() !== '').map(kommun => (
                                                <div key={`kommun-${kommun.ommunkod}-${kommun.kommunnamn}-${lanObj.lanskod}`}> 
                                                    <div
                                                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1"
                                                        onClick={() => {
                                                            setExpanded(kommun.ommunkod);
                                                            if (!children[kommun.ommunkod]) loadChildren('kommun', kommun.ommunkod);
                                                        }}
                                                    >
                                                        {expanded[kommun.ommunkod] ? <span>▼</span> : <span>▶</span>}
                                                        <span>{LEVEL_ICONS.kommun}</span>
                                                        <span>{kommun.kommunnamn} {lanObj.lanskod ? `(${lanObj.lanskod})` : ''}</span>
                                                        <span className="text-xs text-gray-500">({LEVEL_LABELS.kommun})</span>
                                                    </div>
                                                    {expanded[kommun.ommunkod] && (
                                                        <div className="ml-4">
                                                            {loading[kommun.ommunkod] ? <div className="text-xs text-gray-400">Laddar församlingar...</div> : (
                                                                (children[kommun.ommunkod] && children[kommun.ommunkod].length > 0) ? (
                                                                    children[kommun.ommunkod].filter(forsamling => forsamling.sockenstadnamn && forsamling.sockenstadnamn.trim() !== '').map(forsamling => (
                                                                        <div key={`forsamling-${forsamling.sockenstadkod}-${forsamling.sockenstadnamn}-${kommun.ommunkod}-${lanObj.lanskod}`}> 
                                                                            <div
                                                                                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded p-1"
                                                                                onClick={() => {
                                                                                    setExpanded(forsamling.sockenstadkod);
                                                                                    if (!children[forsamling.sockenstadkod]) loadChildren('forsamling', forsamling.sockenstadkod);
                                                                                }}
                                                                            >
                                                                                {expanded[forsamling.sockenstadkod] ? <span>▼</span> : <span>▶</span>}
                                                                                <span>{LEVEL_ICONS.forsamling}</span>
                                                                                <span>{forsamling.sockenstadnamn} {lanObj.lanskod ? `(${lanObj.lanskod})` : ''}</span>
                                                                            </div>
                                                                            {expanded[forsamling.sockenstadkod] && (
                                                                                <div className="ml-4">
                                                                                    {loading[forsamling.sockenstadkod] ? <div className="text-xs text-gray-400">Laddar orter...</div> : (
                                                                                        (children[forsamling.sockenstadkod] && children[forsamling.sockenstadkod].length > 0) ? (
                                                                                            children[forsamling.sockenstadkod].filter(ort => ort.ortnamn && ort.ortnamn.trim() !== '').map(ort => (
                                                                                                <div key={`ort-${ort.id}-${ort.ortnamn}-${forsamling.sockenstadkod}-${kommun.ommunkod}-${lanObj.lanskod}`} className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 p-1 rounded" onClick={() => setSelectedPlaceId(ort.id)}>
                                                                                                    <span>{LEVEL_ICONS.ort}</span>
                                                                                                    <span>{ort.ortnamn} {lanObj.lanskod ? `(${lanObj.lanskod})` : ''}</span>
                                                                                                </div>
                                                                                            ))
                                                                                        ) : (
                                                                                            <div className="text-xs text-gray-400 italic">Inga orter funna</div>
                                                                                        )
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div className="text-xs text-gray-400 italic">Inga församlingar funna</div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-gray-400 italic">Inga kommuner funna</div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// --- Komponent för redigeringspanelen ---
function PlaceEditPanel({ place, onSave, allPeople, allSources, onPersonClick, onNavigateToSource, onAttachSource, onSavePlace, editingPerson, onLinkPlaceToEvent = () => {}, onUnlinkPlaceFromEvent = () => {} }) {
    const [fields, setFields] = useState(() => {
        if (place && !place.country && (place.name || place.plac)) {
            return { ...place, ...parsePlaceString(place.name || place.plac) };
        }
        return place || {};
    });

    useEffect(() => {
        let norm = place;
        if (place && !place.country && (place.name || place.plac)) {
            norm = { ...place, ...parsePlaceString(place.name || place.plac) };
        }
        setFields(norm || {});
    }, [place?.id]); // KÖR BARA NÄR PLATSENS ID ÄNDRAS

    const handleChange = (e) => {
        setFields(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">Redigera Plats</h3>
            {place?.id && (
                <div className="text-xs text-gray-500 mb-2 select-all">Plats-ID: <span className="font-mono">{place.id}</span></div>
            )}
            {/* NYTT: Dropdown för att välja platstyp */}
            <div>
                <label className="block text-sm font-bold text-gray-700">Typ av plats</label>
                <select name="placeType" value={fields.placeType || 'default'} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                    {Object.entries(PLACE_TYPES).map(([key, { icon, label }]) => (
                        <option key={key} value={key}>
                            {icon} {label}
                        </option>
                    ))}
                </select>
            </div>
            {HIERARCHY_LEVELS.map(level => (
                <div key={level}>
                    <label className="block text-sm font-bold text-gray-700 capitalize">{SWEDISH_LABELS[level] || level}</label>
                    <input type="text" name={level} value={fields[level] || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                </div>
            ))}
            <div>
                <label className="block text-sm font-bold text-gray-700">Länsbokstav</label>
                <input type="text" name="countyLetter" value={fields.countyLetter || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700">Koordinater (Lat, Long)</label>
                <input type="text" name="coordinates" value={fields.coordinates || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" placeholder="t.ex. 55.99, 13.50" />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700">Notering</label>
                <Editor
                    value={fields.note || ''}
                    onChange={(e) => handleChange({ target: { name: 'note', value: e.target.value } })}
                    containerProps={{ style: { minHeight: '120px', maxHeight: '30vh', overflow: 'auto' } }}
                    spellCheck={true}
                    lang="sv"
                />
            </div>
            <button onClick={() => onSave(fields)} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700">Spara ändringar</button>

            {/* KOPPLA TILL HÄNDELSE PÅ REDIGERAD PERSON */}
            {editingPerson && Array.isArray(editingPerson.events) && editingPerson.events.length > 0 && (
                <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="font-bold mb-2 text-blue-900">Koppla denna plats till en händelse på <span className='underline'>{editingPerson.firstName} {editingPerson.lastName}</span>:</div>
                    <ul className="space-y-1">
                        {editingPerson.events.map(ev => (
                            <li key={ev.id} className="flex items-center gap-2">
                                <span className="flex-1 text-sm">{ev.type} {ev.date ? '(' + ev.date + ')' : ''}</span>
                                <button
                                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    onClick={() => { if (process.env.NODE_ENV !== 'production') console.debug('[PlaceEditPanel] Koppla clicked', { placeId: place.id, eventId: ev.id }); onLinkPlaceToEvent(place.id, ev.id); }}
                                >Koppla</button>
                                {ev.placeId === place.id && (
                                    <>
                                        <button
                                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 ml-2"
                                            onClick={() => {
                                                if (process.env.NODE_ENV !== 'production') console.debug('[PlaceEditPanel] Ta bort clicked', { placeId: place.id, eventId: ev.id });
                                                try { onUnlinkPlaceFromEvent(place.id, ev.id); } catch (err) { if (process.env.NODE_ENV !== 'production') console.debug('[PlaceEditPanel] onUnlink threw', err); }
                                                // Dispatch a global fallback event so App can handle unlinking
                                                try {
                                                    const evnt = new CustomEvent('WFT:unlinkPlaceFromEvent', { detail: { placeId: place.id, eventId: ev.id } });
                                                    window.dispatchEvent(evnt);
                                                    if (process.env.NODE_ENV !== 'production') console.debug('[PlaceEditPanel] dispatched WFT:unlinkPlaceFromEvent', { placeId: place.id, eventId: ev.id });
                                                } catch (e) { if (process.env.NODE_ENV !== 'production') console.debug('[PlaceEditPanel] failed to dispatch global unlink event', e); }
                                            }}
                                        >Ta bort</button>
                                        <StatusBadge label="Kopplad" variant="success" icon="✔" />
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Visa bara kopplingskomponenten om det finns en vald plats och persondata */}
            {place && allPeople && (
                <PlaceConnections place={place} allPeople={allPeople} onPersonClick={onPersonClick} />
            )}

            {/* NYTT: Visa källkopplingar */}
            {place && allSources && (
                <PlaceSourceConnections place={place} allSources={allSources} onNavigateToSource={onNavigateToSource} onAttachSource={onAttachSource} onSavePlace={onSavePlace} />
            )}
        </div>
    );
}

export default function PlaceCatalog({ catalogState, setCatalogState }) {
    // All loggning och rendering sker nu efter att filteredTree är korrekt satt och skyddad
        // Lägg till state för filterpanel så att den inte kraschar
        const [showFilterPanel, setShowFilterPanel] = React.useState(false);
    // Fullträdsmodell
    const [tree, setTree] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const { expanded = {}, selectedPlaceId = null, activeTab = 'register', showCreateModal = false } = catalogState || {};
    const [searchTerm, setSearchTerm] = React.useState("");
    useEffect(() => {
        setLoading(true);
        fetch('http://127.0.0.1:5005/official_places/full_tree')
            .then(res => res.json())
            .then(data => {
                // Använd tree-strukturen från backend
                const treeData = data && data.tree ? data.tree : [];
                console.log('API tree data:', treeData);
                setTree(treeData);
                setLoading(false);
            })
            .catch(e => { setError(e.message); setLoading(false); });
    }, []);

    // Ren rekursiv rendering av hela trädet
    function renderTree(nodes, level = 'lan', expanded, handleToggle, setSelectedPlaceId) {
        // Om nodes är ett objekt, konvertera till array
        if (!Array.isArray(nodes)) {
            if (nodes && typeof nodes === 'object') {
                nodes = Object.values(nodes);
            } else {
                nodes = [];
            }
        }
        if (!nodes || nodes.length === 0) return <div className="text-xs text-gray-400">Inga platser funna</div>;
        // Filtrera bort noder med '(okänd)' eller tomma namn
        const filteredNodes = nodes.filter(node => {
            if (level === 'lan') return node.lansnamn && !node.lansnamn.toLowerCase().includes('okänd');
            if (level === 'kommun') return node.kommunnamn && !node.kommunnamn.toLowerCase().includes('okänd');
            if (level === 'forsamling') return node.sockenstadnamn && !node.sockenstadnamn.toLowerCase().includes('okänd');
            if (level === 'ort') return node.ortnamn && !node.ortnamn.toLowerCase().includes('okänd');
            return true;
        });
        // Hjälpfunktion för att gissa nästa nivå
        function nextLevel(current) {
            if (current === 'lan') return 'kommun';
            if (current === 'kommun') return 'forsamling';
            if (current === 'forsamling') return 'ort';
            return 'ort';
        }
        return (
            <ul className="ml-2">
                {filteredNodes.map(node => {
                    node.level = level;
                    // Build unique key for each node
                    let key = `${level}-${node.id || ''}-${node.lanskod || ''}-${node.ommunkod || ''}-${node.sockenstadkod || ''}-${node.ortnamn || ''}-${node.namn || ''}`;
                    let label = '(okänd)';
                    // Only show länskod ONCE for kommun, församling, ort
                    let parentLanskod = node.lanskod || '';
                    if (level === 'lan') {
                        label = node.lansnamn ? `${node.lansnamn} (${node.lanskod || ''})` : `(okänt län ${node.lanskod || ''})`;
                    } else if (level === 'kommun') {
                        label = node.kommunnamn ? `${node.kommunnamn}${parentLanskod ? ` (${parentLanskod})` : ''}` : `(okänd kommun${parentLanskod ? ` (${parentLanskod})` : ''})`;
                    } else if (level === 'forsamling') {
                        // Remove any extra länskod in församling label
                        let cleanName = node.sockenstadnamn;
                        if (cleanName && parentLanskod) {
                            cleanName = cleanName.replace(new RegExp(`\\s*\\(${parentLanskod}\\)`, 'g'), '').trim();
                        }
                        label = cleanName ? `${cleanName}${parentLanskod ? ` (${parentLanskod})` : ''}` : `(okänd församling${parentLanskod ? ` (${parentLanskod})` : ''})`;
                    } else if (level === 'ort') {
                        // Remove any extra länskod in ort label
                        let cleanName = node.ortnamn;
                        if (cleanName && parentLanskod) {
                            cleanName = cleanName.replace(new RegExp(`\\s*\\(${parentLanskod}\\)`, 'g'), '').trim();
                        }
                        label = cleanName ? `${cleanName}${parentLanskod ? ` (${parentLanskod})` : ''}` : `(okänd ort${parentLanskod ? ` (${parentLanskod})` : ''})`;
                    } else {
                        label = node.namn || node.lansnamn || node.kommunnamn || node.sockenstadnamn || node.ortnamn || '(okänd)';
                    }
                    const hasChildren = node.children && Object.keys(node.children).length > 0;
                    const isExpanded = !!expanded[key];
                    // Only pass down länskod from parent, not duplicate
                    let childrenWithLanskod;
                    if (Array.isArray(node.children)) {
                        childrenWithLanskod = node.children.map(child => ({ ...child, lanskod: node.lanskod }));
                    } else if (node.children && typeof node.children === 'object') {
                        childrenWithLanskod = Object.fromEntries(
                            Object.entries(node.children).map(([childLevel, childNodes]) => [
                                childLevel,
                                Array.isArray(childNodes)
                                    ? childNodes.map(child => ({ ...child, lanskod: node.lanskod }))
                                    : childNodes
                            ])
                        );
                    } else {
                        childrenWithLanskod = Array.isArray(node.children) ? node.children : [];
                    }
                    return (
                        <li key={key}>
                            <div className="flex items-center gap-2">
                                {hasChildren ? (
                                    <span
                                        className="cursor-pointer select-none text-lg"
                                        onClick={e => { e.stopPropagation(); handleToggle(key); }}
                                        title={isExpanded ? 'Fäll in' : 'Fäll ut'}
                                    >{isExpanded ? '−' : '+'}</span>
                                ) : (
                                    <span style={{ width: '1em', display: 'inline-block' }}></span>
                                )}
                                <span
                                    className={`font-semibold cursor-pointer hover:bg-blue-50 rounded px-1 ${node.id ? '' : 'opacity-70 cursor-default'}`}
                                    onClick={() => node.id && setSelectedPlaceId(node.id)}
                                    title={node.id ? 'Visa/Redigera plats' : ''}
                                >{label}</span>
                                <span className="text-xs text-gray-500">({level})</span>
                            </div>
                            {hasChildren && isExpanded && (
                                <div className="ml-4">
                                    {Array.isArray(node.children)
                                        ? renderTree(childrenWithLanskod, nextLevel(level), expanded, handleToggle, setSelectedPlaceId)
                                        : Object.entries(childrenWithLanskod).map(([childLevel, childNodes]) => (
                                            <div key={childLevel}>
                                                {renderTree(childNodes, childLevel, expanded, handleToggle, setSelectedPlaceId)}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }

    const [searchResults, setSearchResults] = React.useState([]);

    React.useEffect(() => {
        if (searchTerm.trim() === '') {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            fetch(`http://127.0.0.1:5005/official_places/search?q=${searchTerm}`)
                .then(res => res.json())
                .then(data => {
                    setSearchResults(data);
                })
                .catch(e => {
                    console.error("Search error:", e);
                    setError(e.message);
                });
        }, 300); // Debounce to avoid excessive API calls

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);
        // Hantera plats-skapande
        const handleCreatePlace = async (fields) => {
            try {
                const resp = await fetch('http://127.0.0.1:5005/place', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fields)
                });
                if (!resp.ok) {
                    alert('Kunde inte skapa plats');
                } else {
                    // Uppdatera katalogen, t.ex. ladda om platser eller visa meddelande
                }
            } catch (e) {
                alert('Fel vid skapande av plats: ' + e.message);
            }
            setCatalogState(prev => ({ ...prev, showCreateModal: false }));
        };
    const setExpanded = (key) => setCatalogState(prev => ({ ...prev, expanded: { ...prev.expanded, [key]: !prev.expanded[key] } }));
    const setSelectedPlaceId = (id) => setCatalogState(prev => ({ ...prev, selectedPlaceId: id }));
    const setActiveTab = (tab) => setCatalogState(prev => ({ ...prev, activeTab: tab, selectedPlaceId: null }));

    // Hämta platsdata när en plats väljs
    const [selectedPlace, setSelectedPlace] = React.useState(null);
    React.useEffect(() => {
        if (selectedPlaceId) {
            fetch(`http://127.0.0.1:5005/official_places/${selectedPlaceId}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => setSelectedPlace(data || { id: selectedPlaceId }))
                .catch(() => setSelectedPlace({ id: selectedPlaceId }));
        } else {
            setSelectedPlace(null);
        }
    }, [selectedPlaceId]);

    // --- UI ---
    return (
        <div className="flex flex-col w-full h-full bg-gray-50">
            {/* Modal för att skapa ny plats */}
            <PlaceCreateModal
                isOpen={showCreateModal}
                onClose={() => setCatalogState(prev => ({ ...prev, showCreateModal: false }))}
                onCreate={handleCreatePlace}
            />
            <div className="flex flex-col w-full h-full max-w-full mx-auto bg-white rounded-lg shadow-lg border border-gray-200" style={{marginBottom: 32, marginTop: 8, marginLeft: 8, marginRight: 8, minHeight: 0}}>
                <div className="flex border-b bg-white rounded-t-lg shadow-sm mb-2">
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 ${activeTab === 'register' ? 'border-blue-600 text-blue-700 bg-white shadow -mb-px' : 'border-transparent text-gray-600 bg-gray-100'} focus:outline-none`}
                        onClick={() => setActiveTab('register')}
                    >
                        <span className="text-lg" role="img" aria-label="Platsregister">📍</span>
                        Platsregister
                    </button>
                    <button
                        className={`relative px-5 py-2 text-sm font-semibold flex items-center gap-2 border-b-2 ${activeTab === 'unmatched' ? 'border-yellow-500 text-yellow-800 bg-white shadow -mb-px' : 'border-transparent text-gray-600 bg-gray-100'} focus:outline-none`}
                        onClick={() => setActiveTab('unmatched')}
                    >
                        <span className="text-lg" role="img" aria-label="Rätta">🛠️</span>
                        Rätta
                    </button>
                </div>
                <div className="flex w-full h-full" style={{minHeight: 0}}>
                    {activeTab === 'register' ? (
                        <div style={{display: 'flex', width: '100%', height: '100%'}}>
                            <aside className="w-96 border-r bg-white p-2 flex flex-col" style={{overflow: 'hidden'}}>
                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h2 className="font-bold text-lg">Platsregister</h2>
                                        <button
                                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded shadow hover:bg-blue-700 font-semibold ml-2"
                                            style={{ minWidth: 0 }}
                                            onClick={() => setCatalogState(prev => ({ ...prev, showCreateModal: true }))}
                                        >
                                            + Skapa ny
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="text"
                                            className="border rounded px-2 py-1 text-sm flex-1"
                                            placeholder="Sök plats..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                        <button
                                            className="px-2 py-1 bg-gray-200 rounded text-gray-700 hover:bg-gray-300 flex items-center"
                                            title="Filter"
                                            onClick={() => setShowFilterPanel(true)}
                                        >
                                            <span className="material-icons" style={{fontSize: '20px'}}>filter_list</span>
                                        </button>
                                    </div>
                                    {showFilterPanel && (
                                        <div className="absolute z-10 bg-white border rounded shadow p-4 top-16 left-4 w-80">
                                            <div className="font-bold mb-2">Filter (kommer snart)</div>
                                            <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={() => setShowFilterPanel(false)}>Stäng</button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-grow overflow-y-auto">
                                    {error && <div className="text-red-500">Fel: {error}</div>}
                                    {loading ? (
                                        <div className="text-gray-400 text-center mt-8">Laddar platser...</div>
                                    ) : searchTerm.trim() !== '' ? (
                                        <ul className="space-y-1">
                                            {searchResults.length > 0 ? (
                                                (() => {
                                                    const searchLower = searchTerm.trim().toLowerCase();
                                                    const uniqueRows = new Map();
                                                    searchResults.forEach(place => {
                                                        // Nyckel: typ|namn (strippad och lowercased)
                                                        if (place.kommunnamn && place.kommunnamn.toLowerCase().includes(searchLower)) {
                                                            const key = `kommun|${place.kommunnamn.trim().toLowerCase()}`;
                                                            if (!uniqueRows.has(key)) {
                                                                uniqueRows.set(key, {
                                                                    key,
                                                                    label: 'Kommun',
                                                                    value: place.kommunnamn,
                                                                    icon: '🏛️',
                                                                    onClick: () => setSelectedPlaceId(place.id)
                                                                });
                                                            }
                                                        }
                                                        const forsamlingnamn = place.sockenstadnamn || place.forsamlingnamn;
                                                        if (forsamlingnamn && forsamlingnamn.toLowerCase().includes(searchLower)) {
                                                            const key = `forsamling|${forsamlingnamn.trim().toLowerCase()}`;
                                                            if (!uniqueRows.has(key)) {
                                                                uniqueRows.set(key, {
                                                                    key,
                                                                    label: 'Församling',
                                                                    value: forsamlingnamn,
                                                                    icon: '⛪',
                                                                    onClick: () => setSelectedPlaceId(place.id)
                                                                });
                                                            }
                                                        }
                                                        if (place.ortnamn && place.ortnamn.toLowerCase().includes(searchLower)) {
                                                            const key = `ort|${place.ortnamn.trim().toLowerCase()}`;
                                                            if (!uniqueRows.has(key)) {
                                                                uniqueRows.set(key, {
                                                                    key,
                                                                    label: 'Ort',
                                                                    value: place.ortnamn,
                                                                    icon: '📍',
                                                                    onClick: () => setSelectedPlaceId(place.id)
                                                                });
                                                            }
                                                        }
                                                    });
                                                    // Om inget matchar, visa okänd
                                                    if (uniqueRows.size === 0) {
                                                        uniqueRows.set('okänd', {
                                                            key: 'okänd',
                                                            label: 'Okänd',
                                                            value: '',
                                                            icon: '❓',
                                                            onClick: () => {}
                                                        });
                                                    }
                                                    return Array.from(uniqueRows.values()).map(row => (
                                                        <li key={row.key}
                                                            className="p-1 rounded cursor-pointer hover:bg-blue-100 flex items-center gap-2"
                                                            onClick={row.onClick}
                                                        >
                                                            <span className="text-lg" title={row.label}>{row.icon}</span>
                                                            <span className="font-semibold">{row.value}</span>
                                                            <span className="text-xs text-gray-600">{row.label}</span>
                                                        </li>
                                                    ));
                                                })()
                                            ) : (
                                                <div className="text-gray-400 text-center mt-8">Inga träffar.</div>
                                            )}
                                        </ul>
                                    ) : (
                                        <div>
                                            <div className="flex items-center gap-2 font-bold cursor-pointer bg-gray-100 rounded p-1 mb-1" style={{ fontSize: '1.1em' }}>
                                                <span>{LEVEL_ICONS.sverige}</span>
                                                <span className="font-semibold">Sverige</span>
                                                <span className="text-xs text-gray-500">(Land)</span>
                                            </div>
                                            <div className="ml-4">
                                                        {error ? (
                                                            <div className="text-red-500">Fel vid laddning av platsregister: {error}</div>
                                                ) : Array.isArray(tree) && tree.length > 0 ? (
                                                    renderTree(tree, 'lan', expanded, setExpanded, setSelectedPlaceId)
                                                ) : (
                                                    <div className="text-gray-400">Inga platser funna eller datan är trasig.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </aside>
                            <main className="flex-1 p-6 h-full overflow-y-auto bg-white rounded-b-lg shadow-lg" style={{marginBottom: 24}}>
                                {selectedPlaceId ? (
                                    <OfficialPlaceEditPanel
                                        place={selectedPlace}
                                        onSave={async (fields) => {
                                            const resp = await fetch(`http://127.0.0.1:5005/official_places/${selectedPlaceId}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(fields)
                                            });
                                            if (!resp.ok) {
                                                alert('Kunde inte spara ändringar');
                                            }
                                            // Annars: stanna kvar och visa uppdaterad data (ingen reload)
                                        }}
                                    />
                                ) : (
                                    <div className="text-gray-400 italic text-center mt-32">Välj en plats i listan för att visa detaljer.</div>
                                )}
                            </main>
                        </div>
                    ) : (
                        <main className="flex-1 p-6 h-full overflow-y-auto">
                            <UnmatchedPlacesPanel />
                        </main>
                    )}
                </div>
            </div>
        </div>
    );
}

// Enkel redigeringspanel för officiella platser
function OfficialPlaceEditPanel({ place, onSave }) {
    const [fields, setFields] = React.useState(place || {});
    const [editingFields, setEditingFields] = React.useState(place || {});
    React.useEffect(() => {
        setFields(place || {});
        setEditingFields(place || {});
    }, [place?.id]);
    const handleChange = (e) => setEditingFields(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (!place) return null;
    // Helper för att kopiera till urklipp
    const copyToClipboard = (val, e) => {
        if (e) e.stopPropagation();
        navigator.clipboard.writeText(val);
    };
    // Dynamisk typdetektering
    let type = '';
    let typeLabel = '';
    let typeIcon = '';
    if (editingFields.forsamlingkod || editingFields.sockenstadkod || editingFields.forsamlingnamn || editingFields.sockenstadnamn) {
        type = 'forsamling'; typeLabel = 'Församling'; typeIcon = '⛪';
    } else if (editingFields.ortnamn || editingFields.id || editingFields.ortid) {
        type = 'ort'; typeLabel = 'Ort'; typeIcon = '📍';
    } else if (editingFields.kommunnamn) {
        type = 'kommun'; typeLabel = 'Kommun'; typeIcon = '🏛️';
    } else if (editingFields.lansnamn) {
        type = 'lan'; typeLabel = 'Län'; typeIcon = '🗺️';
    } else {
        type = 'okänd'; typeLabel = 'Okänd'; typeIcon = '❓';
    }

    // Visa rätt kod beroende på typ
    const codeRows = [];
    if (editingFields.lanskod) codeRows.push({ label: 'Länskod', value: editingFields.lanskod });
    if (editingFields.kommunkod) codeRows.push({ label: 'Kommunkod', value: editingFields.kommunkod });
    if (editingFields.forsamlingkod) codeRows.push({ label: 'Församlingskod', value: editingFields.forsamlingkod });
    if (editingFields.id) codeRows.push({ label: 'Ortid', value: editingFields.id });
    const handleCancel = (e) => {
        e.preventDefault();
        setEditingFields(fields); // Återställ till ursprungliga värden
    };
    // Platstyper och ikoner
    // Bygg om till en array för select, men använd objektet PLACE_TYPES som källa
    // Change label 'Stad' to 'Ort' in dropdown
    const PLACE_TYPE_OPTIONS = [
        { value: '', label: 'Välj typ...', icon: '❓' },
        ...Object.entries(PLACE_TYPES).map(([value, { label, icon }]) => ({ value, label: label === 'Stad' ? 'Ort' : label, icon }))
    ];
    // Dynamisk fältvisning och sparlogik
    function getFieldsToSave(fields, type) {
        if (type === 'ort') {
            return {
                ortnamn: fields.ortnamn,
                kommunnamn: fields.kommunnamn,
                lansnamn: fields.lansnamn,
                detaljtyp: fields.detaljtyp,
                latitude: fields.latitude,
                longitude: fields.longitude,
                id: fields.id,
                ortid: fields.ortid
            };
        } else if (type === 'forsamling') {
            return {
                forsamlingnamn: fields.forsamlingnamn || fields.sockenstadnamn,
                kommunnamn: fields.kommunnamn,
                lansnamn: fields.lansnamn,
                detaljtyp: fields.detaljtyp,
                latitude: fields.latitude,
                longitude: fields.longitude,
                forsamlingkod: fields.forsamlingkod,
                sockenstadkod: fields.sockenstadkod
            };
        } else if (type === 'kommun') {
            return {
                kommunnamn: fields.kommunnamn,
                lansnamn: fields.lansnamn,
                detaljtyp: fields.detaljtyp
            };
        } else if (type === 'lan') {
            return {
                lansnamn: fields.lansnamn
            };
        }
        return fields;
    }
    return (
        <form className="space-y-4" onSubmit={e => {
            e.preventDefault();
            onSave(getFieldsToSave(editingFields, type));
            setFields(editingFields);
        }}>
            <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl" title={typeLabel}>{typeIcon}</span>
                Redigera Officiell Plats
                <span className="text-xs text-gray-500">({typeLabel})</span>
            </h3>
            <div className="text-xs text-gray-500 mb-2">
                <div className="flex flex-col gap-1">
                    {codeRows.map(row => (
                        <div key={row.label} className="flex flex-row items-center gap-2">
                            <span>{row.label}:</span>
                            <span className="font-mono bg-gray-100 px-1 rounded">{row.value}</span>
                            <button
                                type="button"
                                className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-semibold ml-1"
                                title="Kopiera"
                                tabIndex={0}
                                onClick={e => copyToClipboard(row.value, e)}
                            >Kopiera</button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visa fält beroende på typ */}
                {type === 'ort' && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Ortnamn</label>
                            <input type="text" name="ortnamn" value={editingFields.ortnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Kommun</label>
                            <input type="text" name="kommunnamn" value={editingFields.kommunnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Län</label>
                            <input type="text" name="lansnamn" value={editingFields.lansnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Typ</label>
                            <select
                                name="detaljtyp"
                                value={editingFields.detaljtyp || (place && place.ortnamn ? 'city' : '')}
                                onChange={handleChange}
                                className="w-full p-2 border rounded mt-1 bg-white"
                            >
                                {PLACE_TYPE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.icon} {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Latitud</label>
                            <input type="number" step="any" name="latitude" value={editingFields.latitude || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Longitud</label>
                            <input type="number" step="any" name="longitude" value={editingFields.longitude || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                    </>
                )}
                {type === 'forsamling' && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Församlingsnamn</label>
                            <input type="text" name="forsamlingnamn" value={editingFields.forsamlingnamn || editingFields.sockenstadnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Kommun</label>
                            <input type="text" name="kommunnamn" value={editingFields.kommunnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Län</label>
                            <input type="text" name="lansnamn" value={editingFields.lansnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Typ</label>
                            <select
                                name="detaljtyp"
                                value={editingFields.detaljtyp || ''}
                                onChange={handleChange}
                                className="w-full p-2 border rounded mt-1 bg-white"
                            >
                                {PLACE_TYPE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.icon} {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Latitud</label>
                            <input type="number" step="any" name="latitude" value={editingFields.latitude || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Longitud</label>
                            <input type="number" step="any" name="longitude" value={editingFields.longitude || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                    </>
                )}
                {type === 'kommun' && (
                    <>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Kommunnamn</label>
                            <input type="text" name="kommunnamn" value={editingFields.kommunnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700">Län</label>
                            <input type="text" name="lansnamn" value={editingFields.lansnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                        </div>
                    </>
                )}
                {type === 'lan' && (
                    <div>
                        <label className="block text-sm font-bold text-gray-700">Län</label>
                        <input type="text" name="lansnamn" value={editingFields.lansnamn || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                    </div>
                )}
            </div>
            <div className="flex gap-2 mt-4">
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Spara ändringar</button>
                <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-200 text-gray-800 font-bold rounded hover:bg-gray-300 border border-gray-300">Avbryt</button>
            </div>
        </form>
    );
}