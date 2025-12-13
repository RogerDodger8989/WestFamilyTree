import { useState, useEffect, useCallback, useRef } from 'react';
import { createNewDatabase, openFile, saveFile, saveFileAs, openDatabaseDialog, getLastOpenedFile } from './database.js';
import { parseSourceString, generateImagePath, buildSourceString } from './parsing.js';
import { simulateMerge } from './mergeUtils.js';
import { remapAndDedupeRelations, transferEventsAndLinks } from './mergeHelpers.js';

export default function useAppContext() {
    // ...state hooks och refs deklareras här...
    // ==========================================
    // 1. REACT STATE (Applikationens minne)
    // ==========================================
    const [dbData, setDbData] = useState(null);
    const [fileHandle, setFileHandle] = useState(null);
    const [isDirty, setIsDirty] = useState(false);

    // Initiera databas asynkront vid mount
    useEffect(() => {
        async function initDb() {
            try {
                console.log('[useAppContext] Anropar getLastOpenedFile...');
                const lastFile = await getLastOpenedFile();
                console.log('[useAppContext] getLastOpenedFile svar:', lastFile);
                if (lastFile) {
                    const result = await openFile(lastFile);
                    const mediaMedKopplingar = (result?.media || []).filter(m => {
                        const conn = typeof m.connections === 'string' ? JSON.parse(m.connections) : m.connections;
                        return conn && (conn.people?.length > 0 || conn.places?.length > 0 || conn.sources?.length > 0);
                    });
                    console.log('[useAppContext] openFile svar:', {
                        antalPersoner: Array.isArray(result?.people) ? result.people.length : 0,
                        antalMedia: Array.isArray(result?.media) ? result.media.length : 0,
                        mediaMedKopplingar: mediaMedKopplingar.length,
                        kopplingar: mediaMedKopplingar.map(m => {
                            const conn = typeof m.connections === 'string' ? JSON.parse(m.connections) : m.connections;
                            return { 
                                id: m.id, 
                                name: m.name, 
                                connections: conn,
                                connectionsType: typeof m.connections,
                                connectionsString: JSON.stringify(m.connections),
                                peopleCount: conn?.people?.length || 0,
                                people: conn?.people
                            };
                        }),
                        allaMedia: result?.media?.map(m => ({
                            id: m.id,
                            name: m.name,
                            connectionsType: typeof m.connections,
                            connections: m.connections
                        }))
                    });
                    if (result && result.people) {
                        // Parse connections om de är strängar (från databasen)
                        const parsedMedia = (result.media || []).map(m => {
                            if (typeof m.connections === 'string') {
                                try {
                                    const parsed = JSON.parse(m.connections);
                                    return { ...m, connections: parsed };
                                } catch (e) {
                                    console.error('[useAppContext] Error parsing connections for', m.id, ':', e, m.connections);
                                    return { ...m, connections: { people: [], places: [], sources: [] } };
                                }
                            }
                            // Säkerställ att connections alltid är ett objekt med arrays
                            return {
                                ...m,
                                connections: {
                                    people: Array.isArray(m.connections?.people) ? m.connections.people : [],
                                    places: Array.isArray(m.connections?.places) ? m.connections.places : [],
                                    sources: Array.isArray(m.connections?.sources) ? m.connections.sources : [],
                                    ...(m.connections || {})
                                }
                            };
                        });
                        
                        const mediaMedKopplingar = parsedMedia.filter(m => {
                            const conn = m.connections;
                            return conn && (conn.people?.length > 0 || conn.places?.length > 0 || conn.sources?.length > 0);
                        });
                        console.log('[useAppContext] Parsar media connections:', {
                            antal: parsedMedia.length,
                            medKopplingar: mediaMedKopplingar.length,
                            exempel: mediaMedKopplingar[0] ? {
                                id: mediaMedKopplingar[0].id,
                                name: mediaMedKopplingar[0].name,
                                connections: mediaMedKopplingar[0].connections,
                                peopleCount: mediaMedKopplingar[0].connections?.people?.length || 0,
                                people: mediaMedKopplingar[0].connections?.people,
                                peopleType: typeof mediaMedKopplingar[0].connections?.people,
                                isArray: Array.isArray(mediaMedKopplingar[0].connections?.people)
                            } : null
                        });
                        
                        setDbData({ 
                            ...result, 
                            meta: result.meta || {},
                            media: parsedMedia // Använd parsade media med korrekt connections-format
                        });
                        setFileHandle({ name: lastFile.split(/[\\/]/).pop(), path: lastFile });
                        return;
                    }
                }
                // Om ingen fil, skapa ny
                const db = await createNewDatabase();
                setDbData(db);
                setFileHandle(null);
            } catch (err) {
                console.error('[useAppContext] FEL vid initDb:', err);
                setDbData(null);
                window.dbInitError = err;
                if (typeof showStatus === 'function') {
                    showStatus('Fel vid laddning av databas: ' + (err.message || err), 'error');
                }
            }
        }
        initDb();
    }, []);

    // API-anropet är borttaget – nu får du alltid en tom databas vid 'Ny databas'.

    // State för snabbregistrerings-formuläret
    const [newFirstName, setNewFirstName] = useState("");
    const [newLastName, setNewLastName] = useState("");

    const [showSettings, setShowSettings] = useState(false);
    // State för redigerings-modalen
    const [editingPerson, setEditingPerson] = useState(null); // Håller personen som redigeras
    const [editingPersonOriginal, setEditingPersonOriginal] = useState(null); // Snapshot före redigering

    // State för flikar
    const [activeTab, setActiveTab] = useState('people'); // 'people', 'sources', 'places', 'familyTree'

    const [focusPair, setFocusPair] = useState({ primary: null, secondary: null });
    const [bookmarks, setBookmarks] = useState([]);
    
    // Refs för auto-save
    const dbDataRef = useRef(null);
    const focusPairRef = useRef({ primary: null, secondary: null });
    const bookmarksRef = useRef([]);
    
    // Uppdatera refs när state ändras
    useEffect(() => {
        dbDataRef.current = dbData;
    }, [dbData]);
    useEffect(() => {
        focusPairRef.current = focusPair;
    }, [focusPair]);
    useEffect(() => {
        bookmarksRef.current = bookmarks;
    }, [bookmarks]);
    
    // State för att komma ihåg vyn i källkatalogen
    const [sourceCatalogState, setSourceCatalogState] = useState({
        selectedSourceId: null,
        sortOrder: 'name_asc',
        searchTerm: '',
        expanded: {}
    });
    // NYTT: State för att komma ihåg vyn i PLATS-katalogen
    const [placeCatalogState, setPlaceCatalogState] = useState({
        selectedPlaceId: null,
        sortOrder: 'country_asc',
        searchTerm: '',
        expanded: {}
    });

    // State för relations-vyn (både modal och flik)
    const [familyTreeFocusPersonId, setFamilyTreeFocusPersonId] = useState(null);
    const [editingRelationsForPerson, setEditingRelationsForPerson] = useState(null);

    // State för käll-modalen
    const [sourcingEventInfo, setSourcingEventInfo] = useState(null);
    const [linkingMediaInfo, setLinkingMediaInfo] = useState(null); // För att länka källor/platser till media
    const [isAttachingSource, setIsAttachingSource] = useState(false);
    const [isSourceDrawerOpen, setSourceDrawerOpen] = useState(false);
    // NYTT: State för plats-drawer
    const [isPlaceDrawerOpen, setPlaceDrawerOpen] = useState(false);
    // NYTT: State för relations-drawer
    const [isRelationshipDrawerOpen, setRelationshipDrawerOpen] = useState(false);
    const [relationshipCatalogState, setRelationshipCatalogState] = useState({ selectedPersonId: null, searchTerm: '', expanded: {} });
    const [isCreatingSource, setIsCreatingSource] = useState(false);
    const [sourceState, setSourceState] = useState({
        sourceString: '', archive: '', volume: '', imagePage: '', otherInfo: '',
        imagePreview: null, imageFile: null, imageFilename: '', imagePath: ''
    });

    // State för Ångra-funktionen
    const [undoState, setUndoState] = useState({ isVisible: false, message: '', onUndo: null });

    // State för den vanliga status-toasten
    // { isVisible: bool, message: string, severity: 'info'|'success'|'warn'|'error' }
    const [statusToast, setStatusToast] = useState({ isVisible: false, message: '', severity: 'info' });
    // State för bulk-varningsmodal (visas efter automatisk import om varningar uppstod)
    const [bulkWarningsModal, setBulkWarningsModal] = useState({ isOpen: false, warnings: [] });

    const openBulkWarningsModal = (warnings = []) => {
        setBulkWarningsModal({ isOpen: true, warnings: Array.isArray(warnings) ? warnings.slice() : [] });
    };
    const closeBulkWarningsModal = () => setBulkWarningsModal({ isOpen: false, warnings: [] });

    // Simple navigation history (past/present/future) for back/forward
    const [historyState, setHistoryState] = useState({ past: [], present: { tab: activeTab, editingPersonId: null }, future: [] });
    const [isHistoryOpen, setHistoryOpen] = useState(false);
    // Pending inline edits (debounced commits) — stored in a ref to avoid re-renders
    const pendingEditsRef = useRef({});

    // Helper: commit pending edit for a personId (compare before/after and record audit)
    const commitPendingEdit = (personId) => {
        try {
            const pending = pendingEditsRef.current[personId];
            if (!pending) return;
            const before = pending.before;
            const currentPerson = (dbData && dbData.people ? dbData.people : []).find(p => p.id === personId);
            if (!currentPerson) {
                delete pendingEditsRef.current[personId];
                return;
            }
            const after = { firstName: currentPerson.firstName, lastName: currentPerson.lastName, refNumber: currentPerson.refNumber };
            const changed = {};
            if (before.firstName !== after.firstName) changed.firstName = { before: before.firstName, after: after.firstName };
            if (before.lastName !== after.lastName) changed.lastName = { before: before.lastName, after: after.lastName };
            if (before.refNumber !== after.refNumber) changed.refNumber = { before: before.refNumber, after: after.refNumber };
            if (Object.keys(changed).length > 0) {
                try { recordAudit({ type: 'edit', entityType: 'person', entityId: personId, details: { before, after, changes: changed } }); } catch (e) {}
            }
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.debug('commitPendingEdit failed', err);
        } finally {
            // cleanup
            const p = pendingEditsRef.current[personId];
            if (p && p.timer) clearTimeout(p.timer);
            delete pendingEditsRef.current[personId];
        }
    };

    // ==========================================
    // 2. HANDLER-FUNKTIONER (Logiken)
    // ==========================================

    const showStatus = (msg, severity = 'success') => {
        if (window.statusTimeout) clearTimeout(window.statusTimeout);
        setStatusToast({ isVisible: true, message: msg, severity });
        window.statusTimeout = setTimeout(() => {
            setStatusToast({ isVisible: false, message: '', severity: 'info' });
        }, 4000);
    };

    const handleCloseEditModal = useCallback(() => {
        // Close edit modal without asking for confirmation. The app keeps
        // editingPerson state separate and changes are saved explicitly.
        try { pushHistory({ tab: activeTab, editingPersonId: null }); } catch (e) {}
        setEditingPerson(null);
        setEditingPersonOriginal(null);
        setSourceDrawerOpen(false);
        setPlaceDrawerOpen(false);
    }, [activeTab]);

    const pushHistory = (newPresent) => {
        // Normalize fields
        const entry = {
            tab: newPresent.tab || activeTab,
            editingPersonId: newPresent.editingPersonId || null,
            selectedSourceId: newPresent.selectedSourceId || null,
            selectedPlaceId: newPresent.selectedPlaceId || null
        };
        setHistoryState(prev => ({ past: [...prev.past, prev.present], present: entry, future: [] }));
    };

    const handleBack = () => {
        setHistoryState(prev => {
            const { past, present, future } = prev;
            if (past.length === 0) return prev;
            const previous = past[past.length - 1];
            const newPast = past.slice(0, -1);
            const newFuture = [present, ...future];
            // Apply previous
            if (previous.editingPersonId) {
                const p = (dbData && dbData.people ? dbData.people : []).find(x => x.id === previous.editingPersonId);
                setEditingPerson(p ? JSON.parse(JSON.stringify(p)) : null);
            } else {
                setEditingPerson(null);
            }
            setActiveTab(previous.tab || 'people');
            return { past: newPast, present: previous, future: newFuture };
        });
    };

    const handleForward = () => {
        setHistoryState(prev => {
            const { past, present, future } = prev;
            if (future.length === 0) return prev;
            const next = future[0];
            const newFuture = future.slice(1);
            const newPast = [...past, present];
            // Apply next
            if (next.editingPersonId) {
                const p = (dbData && dbData.people ? dbData.people : []).find(x => x.id === next.editingPersonId);
                setEditingPerson(p ? JSON.parse(JSON.stringify(p)) : null);
            } else {
                setEditingPerson(null);
            }
            setActiveTab(next.tab || 'people');
            return { past: newPast, present: next, future: newFuture };
        });
    };

    const handleShowHistory = () => setHistoryOpen(s => !s);

    const applyHistoryEntry = (entry) => {
        if (!entry) return;
        const { tab, editingPersonId, selectedSourceId, selectedPlaceId } = entry;
        // Apply editing person
        if (editingPersonId) {
            const p = dbData.people.find(x => x.id === editingPersonId);
            setEditingPerson(p ? JSON.parse(JSON.stringify(p)) : null);
        } else {
            setEditingPerson(null);
        }
        // Apply tab
        setActiveTab(tab || 'people');
        // Apply catalog selections
        setSourceCatalogState(prev => ({ ...prev, selectedSourceId: selectedSourceId || null }));
        setPlaceCatalogState(prev => ({ ...prev, selectedPlaceId: selectedPlaceId || null }));

        // Open/close drawers based on whether the entry had an editingPersonId
        const hadEditing = !!editingPersonId;
        if (selectedSourceId) {
            if (hadEditing) {
                setSourceDrawerOpen(true);
                setPlaceDrawerOpen(false);
            } else {
                setSourceDrawerOpen(false);
            }
        } else {
            setSourceDrawerOpen(false);
        }
        if (selectedPlaceId) {
            if (hadEditing) {
                setPlaceDrawerOpen(true);
                setSourceDrawerOpen(false);
            } else {
                setPlaceDrawerOpen(false);
            }
        } else {
            setPlaceDrawerOpen(false);
        }

        setHistoryOpen(false);
    };

    // NYTT: Hantera plats-drawer
    function handleTogglePlaceDrawer(placeId = null, linkInfo = null) {
        // linkInfo: optional { personId, eventId } meaning the caller wants the
        // next place selection to be applied to that person's event.
        if (isPlaceDrawerOpen && placeCatalogState.selectedPlaceId === placeId) {
            setPlaceDrawerOpen(false);
            setPlaceCatalogState(prev => ({ ...prev, selectedPlaceId: null, pendingLink: null }));
            try { pushHistory({ tab: activeTab, editingPersonId: editingPerson?.id || null, selectedPlaceId: null }); } catch (e) {}
        } else {
            setPlaceDrawerOpen(true);
            setSourceDrawerOpen(false);
            setPlaceCatalogState(prev => ({ ...prev, selectedPlaceId: placeId, pendingLink: linkInfo || null }));
            try { pushHistory({ tab: activeTab, editingPersonId: editingPerson?.id || null, selectedPlaceId: placeId }); } catch (e) {}
        }
    }

    // Öppna platsDrawern utan att länka till en specifik event (för MediaManager)
    const openPlaceDrawerForSelection = (mediaItem = null) => {
        setPlaceDrawerOpen(true);
        setSourceDrawerOpen(false);
        setPlaceCatalogState(prev => ({ ...prev, selectedPlaceId: null, pendingLink: null }));
        if (mediaItem && typeof mediaItem === 'object') {
            setLinkingMediaInfo({ mediaId: mediaItem.id, mediaItem, type: 'place' });
        } else if (mediaItem) {
            setLinkingMediaInfo({ mediaId: mediaItem, type: 'place' });
        } else {
            setLinkingMediaInfo(null);
        }
    };

    // NYTT: Hantera relations-drawer
    function handleToggleRelationshipDrawer(personId = null) {
        if (isRelationshipDrawerOpen && relationshipCatalogState.selectedPersonId === personId) {
            setRelationshipDrawerOpen(false);
            setRelationshipCatalogState(prev => ({ ...prev, selectedPersonId: null }));
            try { pushHistory({ tab: activeTab, editingPersonId: editingPerson?.id || null, selectedPlaceId: null }); } catch (e) {}
        } else {
            setRelationshipDrawerOpen(true);
            setSourceDrawerOpen(false);
            setPlaceDrawerOpen(false);
            setRelationshipCatalogState(prev => ({ ...prev, selectedPersonId: personId }));
            try { pushHistory({ tab: activeTab, editingPersonId: editingPerson?.id || null, selectedPlaceId: null }); } catch (e) {}
        }
    }

    const handleNavigateToPlace = (placeId) => {
        setPlaceCatalogState(prev => ({ ...prev, selectedPlaceId: placeId }));
        if (editingPerson) {
            setPlaceDrawerOpen(true);
        } else {
            setActiveTab('places');
        }
        try { pushHistory({ tab: editingPerson ? activeTab : 'places', editingPersonId: editingPerson?.id || null, selectedPlaceId: placeId }); } catch (e) {}
    };

    useEffect(() => {
        if (window.electronAPI && window.electronAPI.onInitialData) {
            window.electronAPI.onInitialData(({ data, filePath }) => {
                console.log("Mottog initial data från senast öppnade fil:", filePath);
                setDbData(data);
                setBookmarks(data.meta?.bookmarks || []);
                setFocusPair(data.meta?.focusPair || { primary: null, secondary: null });
                showStatus(`Öppnade senast använda fil: ${filePath.split(/[\\/]/).pop()}`);
            });
        }
    }, []);

    // Audit backup via localStorage is removed; all persistence is now SQLite-only

    // ESC-hantering för editingPerson sköts nu av WindowFrame.jsx

    const handleSaveSettings = () => {
        setShowSettings(false);
        showStatus('Inställningar sparade.');
    };

    // Allow configuring the audit backup directory via settings UI
    const setAuditBackupDir = (dirPath) => {
        setDbData(prev => ({ ...prev, meta: { ...(prev.meta || {}), auditBackupDir: dirPath } }));
        setIsDirty(true);
        showStatus(dirPath ? `Audit-backup-mapp satt: ${dirPath}` : 'Audit-backup-mapp rensad.');
    };

    const handleNewFile = async () => {
        if (isDirty && !confirm("Du har osparade ändringar. Vill du verkligen skapa en ny fil?")) return;
        const result = await createNewDatabase();
        if (!result) {
            showStatus("Skapande avbrutet.");
            return;
        }
        setDbData({ people: [], relations: [] });
        setFileHandle({ name: result.dbPath ? result.dbPath.split(/[\\/]/).pop() : 'namnlös.db', path: result.dbPath });
        setIsDirty(false);
        showStatus(`Ny databas skapad: ${result.dbPath}`);
    };

    const handleOpenFile = async () => {
        if (isDirty && !confirm("Du har osparade ändringar. Vill du kasta dem och öppna en ny fil?")) return;
        let filePath = null;
        try {
            filePath = await openDatabaseDialog();
        } catch (err) {
            showStatus('Kunde inte öppna dialog: ' + (err.message || err), 'error');
            return;
        }
        if (!filePath) return;
        const result = await openFile(filePath);
        if (result) {
            setDbData(result.people ? { 
                ...result, 
                meta: result.meta || {},
                media: result.media || [] // Lägg till media från filsystemet
            } : result.data);
            setBookmarks(result.meta?.bookmarks || []);
            setFocusPair(result.meta?.focusPair || { primary: null, secondary: null });
            setFileHandle({ name: filePath.split(/[\\/]/).pop(), path: filePath });
            setIsDirty(false);
            showStatus(`Filen '${filePath.split(/[\\/]/).pop()}' öppnades. ${result.media?.length || 0} bilder hittades i media-mappen.`);
        }
    };

    // UseRef to persist saveAsInProgress across renders
    const saveAsInProgressRef = useRef(false);

    const isElectron = !!(window && window.electronAPI && typeof window.electronAPI.saveFileAs === 'function');

    const handleSaveFileAs = async (source = 'button') => {
        // Only allow menu-triggered save in Electron
        if (isElectron && source !== 'menu') {
            showStatus('Använd menyn för Spara som i desktop-läge!');
            return;
        }
        if (saveAsInProgressRef.current) return;
        saveAsInProgressRef.current = true;
        try {
            const dataToSave = { 
            ...dbData, 
            meta: { ...dbData.meta, focusPair, bookmarks },
            media: dbData.media || [] // Säkerställ att media alltid är en array
        };
            const newHandle = await saveFileAs(dataToSave);
            if (newHandle) {
                setFileHandle(newHandle);
                setIsDirty(false);
                if (window.electronAPI && newHandle.path) {
                    // window.electronAPI.setLastOpenedFile is not implemented
                }
                showStatus(`Sparad som '${newHandle.name || newHandle.path || 'fil'}'.`);
            }
            return newHandle;
        } finally {
            setTimeout(() => { saveAsInProgressRef.current = false; }, 500);
        }
    };

    const handleSaveFile = async () => {
        let handle = fileHandle;
        if (!handle) {
            handle = await handleSaveFileAs();
            if (!handle) return;
        }
        const dataToSave = { 
            ...dbData, 
            meta: { ...dbData.meta, focusPair, bookmarks },
            media: dbData.media || [] // Säkerställ att media alltid är en array
        };
        // DEBUG: Logga vad som försöker sparas
        console.log('[DEBUG] Sparar till backend:', {
            fileHandle: handle,
            antalPersoner: Array.isArray(dataToSave.people) ? dataToSave.people.length : 'ej array',
            antalMedia: Array.isArray(dataToSave.media) ? dataToSave.media.length : 'ej array',
            personer: (Array.isArray(dataToSave.people) && dataToSave.people.length > 0) ? dataToSave.people.map(p => ({ id: p.id, firstName: p.firstName, lastName: p.lastName })) : dataToSave.people
        });
        const success = await saveFile(handle, dataToSave);
        if (success) {
            setIsDirty(false);
            showStatus("Sparad!");
        }
    };
    
    // Auto-save när isDirty blir true (debounced)
    const autoSaveTimeoutRef = useRef(null);
    const isSavingRef = useRef(false);
    useEffect(() => {
        if (isDirty && fileHandle && !isSavingRef.current) {
            // Rensa tidigare timeout
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
            // Spara efter 500ms av inaktivitet (snabbare än manuell save)
            autoSaveTimeoutRef.current = setTimeout(async () => {
                if (isSavingRef.current) return; // Redan sparar
                isSavingRef.current = true;
                
                const currentDbData = dbDataRef.current;
                const currentFocusPair = focusPairRef.current;
                const currentBookmarks = bookmarksRef.current;
                
                if (currentDbData && fileHandle) {
                    const dataToSave = { 
                        ...currentDbData, 
                        meta: { ...currentDbData.meta, focusPair: currentFocusPair, bookmarks: currentBookmarks },
                        media: currentDbData.media || [] // Säkerställ att media alltid är en array
                    };
                    try {
                        // Debug: kontrollera connections i media
                        const mediaWithConnections = (dataToSave.media || []).filter(m => m.connections && (m.connections.people?.length > 0 || m.connections.places?.length > 0 || m.connections.sources?.length > 0));
                        console.log('[auto-save] Sparar automatiskt:', {
                            antalPersoner: Array.isArray(dataToSave.people) ? dataToSave.people.length : 0,
                            antalMedia: Array.isArray(dataToSave.media) ? dataToSave.media.length : 0,
                            mediaMedKopplingar: mediaWithConnections.length,
                            kopplingar: mediaWithConnections.map(m => ({ id: m.id, name: m.name, connections: m.connections }))
                        });
                        const success = await saveFile(fileHandle, dataToSave);
                        if (success) {
                            setIsDirty(false);
                            console.log('[auto-save] Sparat automatiskt!');
                        }
                    } catch (err) {
                        console.error('[auto-save] Error:', err);
                    } finally {
                        isSavingRef.current = false;
                    }
                } else {
                    isSavingRef.current = false;
                }
            }, 500);
        }
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [isDirty, fileHandle]);

    const handleSetFocusPair = (type, personId) => {
        setFocusPair(prev => {
            if (type === 'primary' && personId === prev.secondary) return { primary: personId, secondary: prev.primary };
            if (type === 'secondary' && personId === prev.primary) return { primary: prev.secondary, secondary: personId };
            return { ...prev, [type]: personId };
        });
        setIsDirty(true);
        const typeText = type === 'primary' ? 'Primär' : 'Sekundär';
        showStatus(`Ny ${typeText} Fokusperson vald.`);
    };

    // Normalisera platsfält (första bokstav versal, resten gemener, trimma)
    function normalizePlaceFields(fields) {
        const norm = { ...fields };
        const keys = ['country', 'region', 'municipality', 'parish', 'village', 'specific'];
        for (const key of keys) {
            if (typeof norm[key] === 'string') {
                let val = norm[key].trim();
                if (val.length > 0) val = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
                norm[key] = val;
            }
        }
        return norm;
    }

    const handleAddNewPlace = async (fields) => {
        const newPlace = {
            ...normalizePlaceFields(fields),
            matched_place_id: 'user' // Gör att platsen alltid hamnar i huvudregistret
        };
        try {
            const response = await fetch('http://127.0.0.1:5005/place', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPlace)
            });
            if (!response.ok) throw new Error('Kunde inte spara platsen i backend');
            const savedPlace = await response.json();
            // Hämta om hela platslistan från backend för att vara säker på att allt är synkat
            const allResp = await fetch('http://127.0.0.1:5005/places');
            const allPlaces = allResp.ok ? await allResp.json() : [];
            setDbData(prev => ({ ...prev, places: allPlaces }));
            setIsDirty(true);
            setPlaceCatalogState(prev => ({ ...prev, selectedPlaceId: savedPlace.id }));
            try { recordAudit({ type: 'create', entityType: 'place', entityId: savedPlace.id, details: { label: savedPlace.specific || '' } }); } catch (e) {}
            showStatus('Ny plats skapad och sparad!');
        } catch (err) {
            showStatus('Kunde inte spara platsen i backend.', 'error');
        }
    };

    const handleSavePlace = async (updatedPlace) => {
        const normPlace = normalizePlaceFields(updatedPlace);
        if (process.env.NODE_ENV !== 'production') console.debug('[handleSavePlace] saving place', normPlace && normPlace.id);
        // Spara till backend om platsen har ett id (dvs redan finns)
        if (normPlace.id) {
            try {
                const response = await fetch(`http://127.0.0.1:5005/place/${normPlace.id}/match`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...normPlace,
                        matched_place_id: normPlace.matched_place_id || 'user'
                    })
                });
                if (!response.ok) throw new Error('Kunde inte spara platsen i backend');
            } catch (err) {
                showStatus('Kunde inte spara platsen i backend.', 'error');
                return;
            }
        }
        setDbData(prev => ({
            ...prev,
            places: prev.places.map(p => p.id === normPlace.id ? normPlace : p)
        }));
        setIsDirty(true);
        showStatus("Platsen har sparats.");
        if (process.env.NODE_ENV !== 'production') console.debug('[handleSavePlace] dbData.places now has', (Array.isArray(dbData.places) ? dbData.places.length : 'no-places'));
        // If a person is currently open in the editor/drawer, force a shallow
        // refresh of that object so components reading `dbData.places` will
        // re-evaluate and show updated place strings immediately.
        // This avoids edge-cases where the editor displays derived place text
        // and doesn't pick up the replaced place object in `dbData.places`.
        if (editingPerson) {
            setEditingPerson(prev => prev ? JSON.parse(JSON.stringify(prev)) : prev);
        }
        try { recordAudit({ type: 'edit', entityType: 'place', entityId: normPlace.id, details: { label: [normPlace.specific, normPlace.village].filter(Boolean).join(', ') } }); } catch (e) {}
    };

    const handleToggleBookmark = (personId) => {
        setBookmarks(prev => {
            const isBookmarked = prev.includes(personId);
            return isBookmarked ? prev.filter(id => id !== personId) : [...prev, personId];
        });
        setIsDirty(true);
    };

    const handleSwapFocus = () => setFocusPair(prev => ({ primary: prev.secondary, secondary: prev.primary }));
    const handleClearFocus = () => setFocusPair({ primary: null, secondary: null });

    const handleAddPerson = (e) => {
        e.preventDefault();
        if (!newFirstName.trim() || !newLastName.trim()) return alert("Förnamn och efternamn får inte vara tomma.");
        const maxRef = (dbData && dbData.people ? dbData.people : []).reduce((max, p) => p.refNumber > max ? p.refNumber : max, 0);
        const newPerson = {
            id: `p_${Date.now()}`, refNumber: maxRef + 1, firstName: newFirstName.trim(), lastName: newLastName.trim(),
            gender: "", events: [], notes: "", links: {}, relations: { parents: [], children: [] }
        };
        setDbData({
            ...dbData,
            people: dbData && dbData.people ? [...dbData.people, newPerson] : [newPerson]
        });
        setIsDirty(true);
        showStatus(`Personen '${newPerson.firstName} ${newPerson.lastName}' lades till.`);
        try { recordAudit({ type: 'create', entityType: 'person', entityId: newPerson.id, details: { refNumber: newPerson.refNumber, name: `${newPerson.firstName} ${newPerson.lastName}` } }); } catch (e) {}
        setNewFirstName("");
        setNewLastName("");
    };

    const showUndoToast = (message, undoAction) => {
        if (window.undoTimeout) clearTimeout(window.undoTimeout);
        setUndoState({ isVisible: true, message, onUndo: undoAction });
        window.undoTimeout = setTimeout(() => {
            setUndoState({ isVisible: false, message: '', onUndo: null });
        }, 10000);
    };

    const handleDeletePerson = (personIdToDelete) => {
        const personToDelete = (dbData && dbData.people ? dbData.people : []).find(p => p.id === personIdToDelete);
        if (!personToDelete) return;
        const originalDbData = dbData;
        // Remove person and archive any relation objects that reference them
        const remainingPeople = (dbData && dbData.people ? dbData.people : []).filter(p => p.id !== personIdToDelete);
        const newRelations = (dbData.relations || []).map(r => {
            if (r.fromPersonId === personIdToDelete || r.toPersonId === personIdToDelete) {
                return { ...r, _archived: true, modifiedAt: new Date().toISOString() };
            }
            return r;
        });
        // Reconcile relations into people so relations fields stay consistent
        const reconciledPeople = reconcileRelationsToPeople(newRelations, remainingPeople || []);
        setDbData({ ...dbData, people: reconciledPeople, relations: newRelations });
        setIsDirty(true);
        showUndoToast(`Personen '${personToDelete.firstName} ${personToDelete.lastName}' har raderats.`, () => setDbData(originalDbData));
        try { recordAudit({ type: 'archive', entityType: 'person', entityId: personToDelete.id, details: { name: `${personToDelete.firstName} ${personToDelete.lastName}` } }); } catch (e) {}
    };

    const handleOpenEditModal = useCallback((personId) => {
        if (!personId) {
            setEditingPerson(null);
            setEditingPersonOriginal(null);
            return;
        }
        const personToEdit = (dbData && dbData.people ? dbData.people : []).find(p => p.id === personId);
        if (!personToEdit) {
            if (typeof showStatus === 'function') showStatus('Fel: Person hittades inte.', 'error');
            setEditingPerson(null);
            setEditingPersonOriginal(null);
            return;
        }
        // push history before opening
        try { pushHistory({ tab: activeTab, editingPersonId: personId }); } catch (e) {}
        // Alltid skapa en djup kopia för att undvika reaktivitetsproblem
        setEditingPerson(JSON.parse(JSON.stringify(personToEdit)));
        setEditingPersonOriginal(JSON.parse(JSON.stringify(personToEdit)));
    }, [dbData && dbData.people ? dbData.people : [], showStatus, activeTab, pushHistory]);

    const handleSavePersonDetails = () => {
        setIsDirty(false); // Markera som sparad
        if (!editingPerson) return;
        // Compare with original snapshot and record audit if something changed
        try {
            const orig = editingPersonOriginal;
            const updated = editingPerson;
            if (orig && updated && orig.id === updated.id) {
                const before = { firstName: orig.firstName, lastName: orig.lastName, refNumber: orig.refNumber };
                const after = { firstName: updated.firstName, lastName: updated.lastName, refNumber: updated.refNumber };
                const changed = {};
                if (before.firstName !== after.firstName) changed.firstName = { before: before.firstName, after: after.firstName };
                if (before.lastName !== after.lastName) changed.lastName = { before: before.lastName, after: after.lastName };
                if (before.refNumber !== after.refNumber) changed.refNumber = { before: before.refNumber, after: after.refNumber };
                if (Object.keys(changed).length > 0) {
                    try { recordAudit({ type: 'edit', entityType: 'person', entityId: updated.id, details: { before, after, changes: changed } }); } catch (e) {}
                }
            }
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.debug('handleSavePersonDetails audit failed', err);
        }
        setIsDirty(false);
        showStatus("Ändringar sparade.");
        handleCloseEditModal();
    };

    const handleEditFormChange = (updatedPerson) => {
        if (!updatedPerson) return;
        // Only update the `editingPerson` modal state if the modal is open.
        // When editing inline in the tree-drawer we don't want to switch into
        // the full editing view — so avoid setting `editingPerson` in that case.
        if (editingPerson) setEditingPerson(updatedPerson);
        const personIndex = (dbData && dbData.people ? dbData.people : []).findIndex(p => p.id === updatedPerson.id);
        if (personIndex === -1) return;
        const updatedPeople = dbData && dbData.people ? [...dbData.people] : [];
        updatedPeople[personIndex] = updatedPerson;
        setDbData(prevDb => ({ ...prevDb, people: updatedPeople }));
        setIsDirty(true);
        // Debounced audit for inline edits: record before snapshot once, then commit after idle
        try {
            const id = updatedPerson.id;
            const existing = pendingEditsRef.current[id];
            if (!existing) {
                // store before snapshot from current dbData (before this change)
                const orig = dbData.people.find(p => p.id === id) || { firstName: '', lastName: '', refNumber: '' };
                pendingEditsRef.current[id] = { before: { firstName: orig.firstName, lastName: orig.lastName, refNumber: orig.refNumber }, timer: null };
            }
            // reset debounce timer
            if (pendingEditsRef.current[id] && pendingEditsRef.current[id].timer) clearTimeout(pendingEditsRef.current[id].timer);
            pendingEditsRef.current[id].timer = setTimeout(() => commitPendingEdit(id), 1500);
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.debug('handleEditFormChange audit scheduling failed', err);
        }
    };

    const handleTabChange = (tabName) => {
        // Switch tabs without prompting about unsaved changes. User edits
        // are not forcefully discarded; the editingPerson state is cleared
        // when closing the edit modal explicitly.
        if (editingPerson) handleCloseEditModal();
        try { pushHistory({ tab: tabName, editingPersonId: editingPerson?.id || null }); } catch (e) {}
        setActiveTab(tabName);
    };

    const handleDeleteEvent = (personId, eventIndex) => {
        const originalDbData = dbData;
        const personIndex = (dbData && dbData.people ? dbData.people : []).findIndex(p => p.id === personId);
        if (personIndex === -1) return;
        const updatedPeople = dbData && dbData.people ? [...dbData.people] : [];
        const targetPerson = { ...updatedPeople[personIndex] };
        if (!targetPerson.events || !targetPerson.events[eventIndex]) return;
        const eventToDelete = targetPerson.events[eventIndex];
        targetPerson.events.splice(eventIndex, 1);
        updatedPeople[personIndex] = targetPerson;
        setDbData({ ...dbData, people: updatedPeople });
        if (editingPerson && editingPerson.id === personId) {
            setEditingPerson(targetPerson);
        }
        setIsDirty(true);
        showUndoToast(`Händelsen '${eventToDelete.type}' har raderats.`, () => setDbData(originalDbData));
    };

    const handleViewInFamilyTree = useCallback((personId) => {
        setFamilyTreeFocusPersonId(personId);
        if (editingPerson) handleCloseEditModal();
        setActiveTab('familyTree');
    }, [editingPerson, handleCloseEditModal]);

    // Cleanup pending timers on unmount
    useEffect(() => {
        return () => {
            try {
                const keys = Object.keys(pendingEditsRef.current || {});
                for (const k of keys) {
                    const p = pendingEditsRef.current[k];
                    if (p && p.timer) clearTimeout(p.timer);
                }
                pendingEditsRef.current = {};
            } catch (e) {}
        };
    }, []);

    const handleSaveRelations = (updatedPerson) => {
        const originalDbData = dbData;
        const updatedPeople = dbData.people.map(p => p.id === updatedPerson.id ? updatedPerson : p);
        setDbData(prev => ({ ...prev, people: updatedPeople }));
        setIsDirty(true);
        showUndoToast("Relationer har uppdaterats.", () => setDbData(originalDbData));
    };

    // Länka källa till media
    const handleLinkSourceToMedia = (sourceId) => {
        if (!linkingMediaInfo || linkingMediaInfo.type !== 'source') {
            return;
        }
        
        const { mediaId } = linkingMediaInfo;
        const source = dbData.sources?.find(s => s.id === sourceId);
        if (!source) {
            return;
        }
        
        setDbData(prev => {
            const currentMedia = Array.isArray(prev.media) ? prev.media : [];
            const found = currentMedia.some(m => m.id === mediaId);

            const mediaBase = found
                ? currentMedia
                : linkingMediaInfo?.mediaItem
                  ? [...currentMedia, linkingMediaInfo.mediaItem]
                  : currentMedia;

            const updatedMedia = mediaBase.map(item => {
                if (item.id !== mediaId) return item;

                const existingSources = Array.isArray(item.connections?.sources) ? item.connections.sources : [];
                if (existingSources.some(s => s.id === sourceId)) {
                    showStatus('Källan är redan kopplad', 'warning');
                    return item;
                }

                return {
                    ...item,
                    connections: {
                        ...item.connections,
                        sources: [...existingSources, source]
                    }
                };
            });

            return { ...prev, media: updatedMedia };
        });
        
        setIsDirty(true);
        showStatus('Källa kopplad till bild!');
        setSourceDrawerOpen(false);
        setLinkingMediaInfo(null);
    };

    // Länka plats till media
    const handleLinkPlaceToMedia = (placeNode) => {
        if (!linkingMediaInfo || linkingMediaInfo.type !== 'place') {
            return;
        }
        
        const { mediaId } = linkingMediaInfo;
        
        // placeNode kommer från PlaceCatalogNew och har strukturen: { id, name, type, metadata }
        if (!placeNode || !placeNode.id) {
            showStatus('Ogiltig plats', 'error');
            return;
        }
        
        const placeData = {
            id: placeNode.id,
            name: placeNode.name,
            type: placeNode.type || 'Plats'
        };
        
        setDbData(prev => {
            const currentMedia = Array.isArray(prev.media) ? prev.media : [];
            const found = currentMedia.some(m => m.id === mediaId);

            const mediaBase = found
                ? currentMedia
                : linkingMediaInfo?.mediaItem
                  ? [...currentMedia, linkingMediaInfo.mediaItem]
                  : currentMedia;

            const updatedMedia = mediaBase.map(item => {
                if (item.id !== mediaId) return item;

                const existingPlaces = Array.isArray(item.connections?.places) ? item.connections.places : [];
                if (existingPlaces.some(p => p.id === placeNode.id)) {
                    showStatus('Platsen är redan kopplad', 'warning');
                    return item;
                }

                return {
                    ...item,
                    connections: {
                        ...item.connections,
                        places: [...existingPlaces, placeData]
                    }
                };
            });

            return { ...prev, media: updatedMedia };
        });
        
        setIsDirty(true);
        showStatus('Plats kopplad till bild!');
        setPlaceDrawerOpen(false);
        setLinkingMediaInfo(null);
    };

    const handleNavigateToSource = (sourceId) => {
        setSourceCatalogState(prev => ({ ...prev, selectedSourceId: sourceId }));
        if (editingPerson) {
            setSourceDrawerOpen(true);
        } else {
            setActiveTab('sources');
        }
        try { pushHistory({ tab: editingPerson ? activeTab : 'sources', editingPersonId: editingPerson?.id || null, selectedSourceId: sourceId }); } catch (e) {}
    };

    // Öppna källDrawern utan att länka till en specifik event (för MediaManager)
    const openSourceDrawerForSelection = (mediaItem = null) => {
        setSourceDrawerOpen(true);
        setPlaceDrawerOpen(false);
        setSourcingEventInfo(null); // Ingen specifik event-kontext
        if (mediaItem && typeof mediaItem === 'object') {
            setLinkingMediaInfo({ mediaId: mediaItem.id, mediaItem, type: 'source' });
        } else if (mediaItem) {
            setLinkingMediaInfo({ mediaId: mediaItem, type: 'source' });
        } else {
            setLinkingMediaInfo(null);
        }
    };

    const handleToggleSourceDrawer = (personId, eventId) => {
        if (isSourceDrawerOpen && sourcingEventInfo?.eventId === eventId) {
            setSourceDrawerOpen(false);
            setSourcingEventInfo(null);
            try { pushHistory({ tab: activeTab, editingPersonId: editingPerson?.id || null, selectedSourceId: null }); } catch (e) {}
        } else {
            setSourceDrawerOpen(true);
            setPlaceDrawerOpen(false); // Stäng plats-drawern om den är öppen
            setSourcingEventInfo({ personId, eventId });
            try { pushHistory({ tab: activeTab, editingPersonId: editingPerson?.id || null, selectedSourceId: sourceCatalogState.selectedSourceId || null }); } catch (e) {}
        }
    };

    const handleLinkSourceFromDrawer = (sourceId) => {
        console.log('🔗 handleLinkSourceFromDrawer called with:', { sourceId, sourcingEventInfo, hasDbData: !!dbData.people });
        
        if (!sourcingEventInfo) {
            console.log('❌ No sourcingEventInfo');
            return;
        }
        
        const { personId, eventId } = sourcingEventInfo;
        
        // Special case: om eventId är '__editing__', använd global callback
        if (eventId === '__editing__') {
            if (window.__addSourceToEvent) {
                window.__addSourceToEvent(sourceId);
                showStatus("Källa tillagd!");
                console.log('✅ Source added to editing event via callback');
                // Stäng source drawer
                setSourceDrawerOpen(false);
                setSourcingEventInfo(null);
            } else {
                console.log('❌ No __addSourceToEvent callback found');
            }
            return;
        }
        
        console.log('👤 Looking for person:', personId, 'event:', eventId);
        
        const personIndex = dbData.people.findIndex(p => p.id === personId);
        if (personIndex === -1) {
            console.log('❌ Person not found:', personId);
            return;
        }
        
        const updatedPeople = [...dbData.people];
        const targetPerson = { ...updatedPeople[personIndex] };
        console.log('✅ Found person:', targetPerson.firstName, targetPerson.lastName, 'Events:', targetPerson.events?.length);
        
        const eventIndex = targetPerson.events.findIndex(e => e.id === eventId);
        if (eventIndex === -1) {
            console.log('❌ Event not found:', eventId, 'Available events:', targetPerson.events.map(e => ({ id: e.id, type: e.type })));
            return;
        }
        
        console.log('✅ Found event at index:', eventIndex);
        const eventToUpdate = { ...targetPerson.events[eventIndex] };
        
        if (!eventToUpdate.sources.includes(sourceId)) {
            eventToUpdate.sources.push(sourceId);
            targetPerson.events[eventIndex] = eventToUpdate;
            setDbData(prev => ({ ...prev, people: updatedPeople }));
            setEditingPerson(targetPerson);
            setIsDirty(true);
            console.log('✅ Source linked successfully!');
            showStatus("Källa kopplad!");
            // Stäng source drawer
            setSourceDrawerOpen(false);
            setSourcingEventInfo(null);
        } else {
            console.log('⚠️ Source already linked');
        }
    };

    const handleUnlinkSourceFromDrawer = (sourceId) => {
        if (!sourcingEventInfo) return;
        const { personId, eventId } = sourcingEventInfo;
        const personIndex = dbData.people.findIndex(p => p.id === personId);
        if (personIndex === -1) return;
        const updatedPeople = [...dbData.people];
        const targetPerson = { ...updatedPeople[personIndex] };
        const eventIndex = targetPerson.events.findIndex(e => e.id === eventId);
        if (eventIndex === -1) return;
        const eventToUpdate = { ...targetPerson.events[eventIndex] };
        if (eventToUpdate.sources && eventToUpdate.sources.includes(sourceId)) {
            eventToUpdate.sources = eventToUpdate.sources.filter(id => id !== sourceId);
            targetPerson.events[eventIndex] = eventToUpdate;
            updatedPeople[personIndex] = targetPerson;
            setDbData(prev => ({ ...prev, people: updatedPeople }));
            setEditingPerson(targetPerson);
            setIsDirty(true);
            showStatus('Koppling borttagen.');
        }
    };

    // ----------------------
    // Relation helpers
    // ----------------------
    // Reconcile relations array into per-person relations structure
    const reconcileRelationsToPeople = (relationsArray, peopleArray) => {
        const peopleById = new Map((peopleArray || []).map(p => [p.id, { ...p, relations: { parents: [], children: [], spouseId: null, siblings: [] } }]));

        for (const r of (relationsArray || [])) {
            if (!r || r._archived) continue;
            const from = r.fromPersonId;
            const to = r.toPersonId;
            if (!from || !to) continue;
            const type = (r.type || '').toLowerCase();

            // Ensure both ends exist in map
            if (!peopleById.has(from)) peopleById.set(from, { id: from, firstName: '', lastName: '', relations: { parents: [], children: [], spouseId: null, siblings: [] } });
            if (!peopleById.has(to)) peopleById.set(to, { id: to, firstName: '', lastName: '', relations: { parents: [], children: [], spouseId: null, siblings: [] } });

            const pFrom = peopleById.get(from);
            const pTo = peopleById.get(to);

            if (type === 'parent') {
                // from is parent of to
                pTo.relations.parents = Array.from(new Set([...(pTo.relations.parents || []), from]));
                pFrom.relations.children = Array.from(new Set([...(pFrom.relations.children || []), to]));
            } else if (type === 'child') {
                // from is child of to
                pFrom.relations.parents = Array.from(new Set([...(pFrom.relations.parents || []), to]));
                pTo.relations.children = Array.from(new Set([...(pTo.relations.children || []), from]));
            } else if (type === 'spouse' || type === 'partner') {
                pFrom.relations.spouseId = to;
                pTo.relations.spouseId = from;
            } else if (type === 'sibling') {
                pFrom.relations.siblings = Array.from(new Set([...(pFrom.relations.siblings || []), to]));
                pTo.relations.siblings = Array.from(new Set([...(pTo.relations.siblings || []), from]));
            } else {
                // For 'other' types, try to infer nothing; leave as metadata-only relation
            }
            // Note: roles/metadata stored in relations array only
        }

        // Merge back any additional person properties from original array to preserve names etc.
        const result = (peopleArray || []).map(orig => {
            const rebuilt = peopleById.get(orig.id) || orig;
            return { ...orig, relations: { ...(rebuilt.relations || {} ) } };
        });
        // Include any people referenced only by relations (rare) appended
        for (const [id, p] of peopleById.entries()) {
            if (!result.find(x => x.id === id)) {
                result.push({ id: p.id, firstName: p.firstName || '', lastName: p.lastName || '', relations: p.relations });
            }
        }
        return result;
    };
        // Record an audit entry into `dbData.meta.audit`.
        const recordAudit = ({ type, entityType, entityId = null, actor = null, details = null, sourceIds = [] } = {}) => {
            try {
                const entry = {
                    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
                    type: type || 'edit', // e.g. 'edit'|'delete'|'link'|'merge'|'restore'|'archive'
                    entityType: entityType || 'unknown',
                    entityId: entityId || null,
                    actor: actor || (dbData?.meta?.currentUser || 'local'),
                    timestamp: new Date().toISOString(),
                    details: details || null,
                    sourceIds: Array.isArray(sourceIds) ? sourceIds.slice() : []
                };
                setDbData(prev => ({ ...prev, meta: { ...(prev.meta || {}), audit: [...(prev.meta?.audit || []), entry] } }));
                    // also persist audit array to localStorage as a backup so history survives an app quit without saving
                    try {
                        const current = dbData?.meta?.audit || [];
                        const newAudit = Array.isArray(current) ? current.concat([entry]) : [entry];
                        localStorage.setItem('wft_audit_backup', JSON.stringify(newAudit));
                        // Also attempt to write a durable audit backup via Electron IPC
                        try {
                            if (window.electronAPI && typeof window.electronAPI.saveAuditBackup === 'function') {
                                const fileName = `audit_backup.json`;
                                // send JSON string to the main process for safe writing and log result (overwrite single file)
                                const backupDir = dbData?.meta?.auditBackupDir || null;
                                window.electronAPI.saveAuditBackup(fileName, JSON.stringify(newAudit), backupDir)
                                    .then(res => {
                                        if (res && res.success) {
                                            if (process.env.NODE_ENV !== 'production') console.debug('[recordAudit] audit backup saved:', res.savedPath);
                                        } else {
                                            if (process.env.NODE_ENV !== 'production') console.debug('[recordAudit] audit backup failed:', res);
                                            try { showStatus('Misslyckades spara audit-backup till disk.'); } catch (e) {}
                                        }
                                    })
                                    .catch(err => {
                                        if (process.env.NODE_ENV !== 'production') console.debug('[recordAudit] saveAuditBackup threw', err);
                                        try { showStatus('Misslyckades spara audit-backup (IPC).'); } catch (e) {}
                                    });
                            }
                        } catch (e) {
                            if (process.env.NODE_ENV !== 'production') console.debug('Failed to send audit backup to Electron', e);
                        }
                    } catch (err) {
                        if (process.env.NODE_ENV !== 'production') console.debug('Failed to write audit backup', err);
                    }
                return entry.id;
            } catch (err) {
                if (process.env.NODE_ENV !== 'production') console.warn('recordAudit failed', err);
                return null;
            }
        };
    const addRelation = (relation) => {
        // Validation: prevent impossible or clearly contradictory relations
        try {
            const cfgDefaults = {
                PARENT_MIN_YEARS: 15,
                PARENT_MAX_YEARS: 60,
                PARENT_LOOSE_MIN: 11,
                LARGE_AGE_GAP: 50,
                SIBLING_LARGE_GAP: 10,
                SPOUSAL_LARGE_GAP: 30,
                POSTHUMOUS_TOLERANCE: 1
            };
            let cfg = { ...cfgDefaults };
            try { const raw = window.localStorage.getItem('relationEngineConfig'); if (raw) cfg = { ...cfg, ...(JSON.parse(raw) || {}) }; } catch (e) {}

            if (relation.fromPersonId && relation.toPersonId && relation.fromPersonId === relation.toPersonId) {
                showStatus('Ogiltig relation: en person kan inte relateras till sig själv.', 'error');
                try { recordAudit({ type: 'warning', entityType: 'relation-validation', details: { message: 'self-relation prevented', svMessage: 'Ogiltig relation: en person kan inte relateras till sig själv.', relation } }); } catch (e) {}
                return null;
            }

            const peopleById = new Map((dbData.people || []).map(p => [p.id, p]));
            const parseYear = (dateStr) => {
                if (!dateStr) return null;
                const m = dateStr.toString().match(/(\d{3,4})/);
                if (!m) return null;
                const y = parseInt(m[1], 10);
                if (isNaN(y)) return null;
                return y;
            };

            const type = (relation.type || '').toString().toLowerCase();
            const fromPerson = peopleById.get(relation.fromPersonId) || null;
            const toPerson = peopleById.get(relation.toPersonId) || null;
            let fromBirth = null, toBirth = null;
            if (fromPerson && Array.isArray(fromPerson.events)) {
                const be = fromPerson.events.find(e => e.type === 'Födelse' || e.type === 'Birth');
                if (be) fromBirth = parseYear(be.date);
            }
            if (toPerson && Array.isArray(toPerson.events)) {
                const be = toPerson.events.find(e => e.type === 'Födelse' || e.type === 'Birth');
                if (be) toBirth = parseYear(be.date);
            }

            if (type === 'parent' && fromBirth !== null && toBirth !== null) {
                const ageDiff = toBirth - fromBirth; // positive if child born after parent
                if (ageDiff <= 0) {
                    showStatus('Ogiltig relation: datumkontradiktion (barn fött före eller samtidigt som förälder).', 'error');
                    try { recordAudit({ type: 'warning', entityType: 'relation-validation', details: { message: 'date contradiction prevented', svMessage: 'Ogiltig relation: datumkontradiktion (barn fött före eller samtidigt som förälder).', relation } }); } catch (e) {}
                    return null;
                }
                if (ageDiff < cfg.PARENT_LOOSE_MIN) {
                    showStatus(`Varning: föreslagen förälder var endast ${ageDiff} år vid barnets födelse.`, 'warn');
                    try { recordAudit({ type: 'warning', entityType: 'relation-validation', details: { message: 'parent very young', svMessage: `Varning: föreslagen förälder var endast ${ageDiff} år vid barnets födelse.`, relation, ageDiff } }); } catch (e) {}
                }
                if (ageDiff > cfg.LARGE_AGE_GAP) {
                    showStatus(`Varning: mycket stor åldersskillnad (${ageDiff} år) mellan förälder och barn.`, 'warn');
                    try { recordAudit({ type: 'warning', entityType: 'relation-validation', details: { message: 'parent large gap', svMessage: `Varning: mycket stor åldersskillnad (${ageDiff} år) mellan förälder och barn.`, relation, ageDiff } }); } catch (e) {}
                }
            }

            if (type === 'spouse' && fromBirth !== null && toBirth !== null) {
                const gap = Math.abs(fromBirth - toBirth);
                if (gap >= cfg.SPOUSAL_LARGE_GAP) {
                    showStatus(`Varning: stor åldersskillnad mellan makar (${gap} år).`, 'warn');
                    try { recordAudit({ type: 'warning', entityType: 'relation-validation', details: { message: 'spousal large gap', svMessage: `Varning: stor åldersskillnad mellan makar (${gap} år).`, relation, gap } }); } catch (e) {}
                }
            }
        } catch (e) {
            // ignore validation failures to avoid blocking relations on unexpected errors
            if (process.env.NODE_ENV !== 'production') console.debug('Relation validation failed', e);
        }

        const rel = {
            id: relation.id || `rel_${Date.now()}`,
            type: (relation.type || 'other').toString(),
            fromPersonId: relation.fromPersonId || null,
            toPersonId: relation.toPersonId || null,
            roleFrom: relation.roleFrom || null,
            roleTo: relation.roleTo || null,
            startDate: relation.startDate || '',
            endDate: relation.endDate || '',
            certainty: relation.certainty !== undefined ? relation.certainty : null,
            sourceIds: Array.isArray(relation.sourceIds) ? relation.sourceIds.slice() : [],
            note: relation.note || '',
            reason: relation.reason || '',
            createdBy: relation.createdBy || (dbData?.meta?.currentUser || 'local'),
            createdAt: relation.createdAt || new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            modifiedBy: relation.modifiedBy || (dbData?.meta?.currentUser || 'local'),
            _archived: !!relation._archived
        };

        // Prevent adding an exact duplicate relation (same from/to/type) that is not archived
        const exists = (dbData.relations || []).some(r => !r._archived && r.fromPersonId === rel.fromPersonId && r.toPersonId === rel.toPersonId && (r.type || '').toString().toLowerCase() === (rel.type || '').toString().toLowerCase());
        if (exists) {
            showStatus('Relation redan finns — ingen ändring gjord.');
            try { recordAudit({ type: 'warning', entityType: 'relation-validation', details: { message: 'duplicate prevented', svMessage: 'Relation redan finns — ingen ändring gjord.', relation: rel } }); } catch (e) {}
            return null;
        }

        setDbData(prev => {
            const newRelations = [...(prev.relations || []), rel];
            const newPeople = reconcileRelationsToPeople(newRelations, prev.people || []);
            return { ...prev, relations: newRelations, people: newPeople };
        });
        setIsDirty(true);
        showStatus('Relation tillagd.');
        try { recordAudit({ type: 'link', entityType: 'relation', entityId: rel.id, details: { relation: rel } }); } catch (e) {}
        return rel.id;
    };

    const updateRelation = (relationId, updates) => {
        setDbData(prev => {
            const newRelations = (prev.relations || []).map(r => {
                if (r.id !== relationId) return r;
                const updated = { ...r, ...updates };
                updated.modifiedAt = new Date().toISOString();
                updated.modifiedBy = updates.modifiedBy || (prev.meta?.currentUser || 'local');
                // ensure arrays are copied
                if (updates.sourceIds) updated.sourceIds = Array.isArray(updates.sourceIds) ? updates.sourceIds.slice() : updated.sourceIds;
                return updated;
            });
            const newPeople = reconcileRelationsToPeople(newRelations, prev.people || []);
            return { ...prev, relations: newRelations, people: newPeople };
        });
        setIsDirty(true);
        showStatus('Relation uppdaterad.');
        try { recordAudit({ type: 'edit', entityType: 'relation', entityId: relationId, details: updates }); } catch (e) {}
    };

    const unlinkRelation = (relationId) => {
        setDbData(prev => {
            const newRelations = (prev.relations || []).map(r => r.id === relationId ? { ...r, _archived: true, modifiedAt: new Date().toISOString(), modifiedBy: prev.meta?.currentUser || 'local' } : r);
            const newPeople = reconcileRelationsToPeople(newRelations, prev.people || []);
            return { ...prev, relations: newRelations, people: newPeople };
        });
        setIsDirty(true);
        showStatus('Relation arkiverad.');
        try { recordAudit({ type: 'archive', entityType: 'relation', entityId: relationId }); } catch (e) {}
    };

    const getPersonRelations = (personId) => {
        return (dbData.relations || []).filter(r => !r._archived && (r.fromPersonId === personId || r.toPersonId === personId));
    };

    // Bulk-create relations from an array of proposals.
    // Each proposal: { fromPersonId, toPersonId, type, confidence, sourceId, reasons }
    const handleBulkCreateRelations = (proposals = []) => {
        if (!Array.isArray(proposals) || proposals.length === 0) return [];
        const created = [];
        const warnings = [];
        const existing = new Set((dbData.relations || []).filter(r => !r._archived).map(r => `${r.fromPersonId}|${r.toPersonId}|${(r.type||'').toLowerCase()}`));

        // Load relation engine config (use same defaults as RelationSettings)
        let cfg = {
            PARENT_MIN_YEARS: 15,
            PARENT_MAX_YEARS: 60,
            PARENT_LOOSE_MIN: 11,
            LARGE_AGE_GAP: 50,
            SIBLING_LARGE_GAP: 10,
            SPOUSAL_LARGE_GAP: 30,
            POSTHUMOUS_TOLERANCE: 1
        };
        try {
            const raw = window.localStorage.getItem('relationEngineConfig');
            if (raw) cfg = { ...cfg, ...(JSON.parse(raw) || {}) };
        } catch (e) { /* ignore */ }

        const peopleById = new Map((dbData.people || []).map(p => [p.id, p]));

        const parseYear = (dateStr) => {
            if (!dateStr) return null;
            const m = dateStr.toString().match(/(\d{3,4})/);
            if (!m) return null;
            const y = parseInt(m[1], 10);
            if (isNaN(y)) return null;
            return y;
        };

        // Build adjacency map for parent relations to detect ancestry cycles.
        const parentAdj = new Map();
        for (const r of (dbData.relations || [])) {
            if (r._archived) continue;
            if ((r.type || '').toString().toLowerCase() === 'parent' && r.fromPersonId && r.toPersonId) {
                if (!parentAdj.has(r.fromPersonId)) parentAdj.set(r.fromPersonId, new Set());
                parentAdj.get(r.fromPersonId).add(r.toPersonId);
            }
        }

        const hasPath = (start, target, adj, visited = new Set()) => {
            if (!start || !target) return false;
            if (start === target) return true;
            if (visited.has(start)) return false;
            visited.add(start);
            const neigh = adj.get(start);
            if (!neigh) return false;
            for (const n of neigh) {
                if (n === target) return true;
                if (hasPath(n, target, adj, visited)) return true;
            }
            return false;
        };

        for (const p of proposals) {
            if (!p || !p.fromPersonId || !p.toPersonId) continue;
            // Prevent impossible self-relations
            if (p.fromPersonId === p.toPersonId) {
                warnings.push(`Ignorerar omöjlig relation: person ${p.fromPersonId} kan inte vara släkt med sig själv.`);
                continue;
            }

            const key = `${p.fromPersonId}|${p.toPersonId}|${(p.type||'').toLowerCase()}`;
            if (existing.has(key)) continue;

            // Age-based sanity checks (only when both persons exist and have birth years)
            const fromPerson = peopleById.get(p.fromPersonId) || null;
            const toPerson = peopleById.get(p.toPersonId) || null;
            let fromBirth = null, toBirth = null;
            if (fromPerson && Array.isArray(fromPerson.events)) {
                const be = fromPerson.events.find(e => e.type === 'Födelse' || e.type === 'Birth');
                if (be) fromBirth = parseYear(be.date);
            }
            if (toPerson && Array.isArray(toPerson.events)) {
                const be = toPerson.events.find(e => e.type === 'Födelse' || e.type === 'Birth');
                if (be) toBirth = parseYear(be.date);
            }

            // If proposing parent/child, enforce birth-year ordering (child born after parent)
            if ((p.type || '').toString().toLowerCase() === 'parent' && fromBirth !== null && toBirth !== null) {
                const ageDiff = toBirth - fromBirth; // positive if child born after parent
                if (ageDiff <= 0) {
                    warnings.push(`Ignorerar relation pga. datumkontradiktion: föreslagen förälder ${p.fromPersonId} ser yngre eller lika gammal ut som barnet ${p.toPersonId}.`);
                    continue; // impossible
                }
                if (ageDiff < cfg.PARENT_LOOSE_MIN) {
                    warnings.push(`Varning: föreslagen förälder ${p.fromPersonId} var endast ${ageDiff} år vid ${p.toPersonId}s födelse.`);
                }
                if (ageDiff > cfg.LARGE_AGE_GAP) {
                    warnings.push(`Varning: stor åldersskillnad (${ageDiff} år) mellan ${p.fromPersonId} och ${p.toPersonId}.`);
                }
            }

            // If proposing spouse, warn on big spousal age gaps
            if ((p.type || '').toString().toLowerCase() === 'spouse' && fromBirth !== null && toBirth !== null) {
                const gap = Math.abs(fromBirth - toBirth);
                if (gap >= cfg.SPOUSAL_LARGE_GAP) {
                    warnings.push(`Varning: stor åldersskillnad (${gap} år) mellan makar ${p.fromPersonId} och ${p.toPersonId}.`);
                }
            }

            // Detect ancestry cycles for parent proposals: do not create parent->child if
            // there is already a path from child -> parent (would create a cycle).
            if ((p.type || '').toString().toLowerCase() === 'parent') {
                const parentId = p.fromPersonId;
                const childId = p.toPersonId;
                if (hasPath(childId, parentId, parentAdj)) {
                    warnings.push(`Ignorerar relation pga. släktcykel: att lägga till ${parentId} som förälder till ${childId} skulle skapa en cyklisk härstamning.`);
                    continue;
                }
            }

            const rel = {
                type: p.type || 'other',
                fromPersonId: p.fromPersonId,
                toPersonId: p.toPersonId,
                certainty: typeof p.confidence === 'number' ? p.confidence : null,
                sourceIds: p.sourceId ? [p.sourceId] : (p.sourceIds || []),
                note: `Auto-fill from source (confidence=${p.confidence || 0}). Reasons: ${(p.reasons || []).join(', ')}`,
                reason: 'auto-fill-from-source',
                createdBy: dbData?.meta?.currentUser || 'local'
            };
            const id = addRelation(rel);
            if (id) created.push({ id, relation: rel });
            // Update adjacency map when a parent relation is actually created so
            // subsequent proposals in the same batch consider it.
            if (id && (p.type || '').toString().toLowerCase() === 'parent') {
                const a = p.fromPersonId, b = p.toPersonId;
                if (a && b) {
                    if (!parentAdj.has(a)) parentAdj.set(a, new Set());
                    parentAdj.get(a).add(b);
                }
            }
            existing.add(key);
        }

        if (created.length > 0) {
            try {
                recordAudit({ type: 'link', entityType: 'relation-bulk', details: { count: created.length, summary: created.map(c => ({ id: c.id, type: c.relation.type, from: c.relation.fromPersonId, to: c.relation.toPersonId })) }, sourceIds: Array.from(new Set(created.flatMap(c => c.relation.sourceIds || []))) });
            } catch (e) {}
            setIsDirty(true);
            showStatus(`${created.length} relationer skapade från källa.`);
        }

        // Surface warnings to the user (deduplicate)
        if (warnings.length > 0) {
            const uniq = Array.from(new Set(warnings)).slice(0, 5); // limit
            try { recordAudit({ type: 'warning', entityType: 'relation-validation', details: { warnings: uniq, svWarnings: uniq } }); } catch (e) {}
            // Show warnings as error severity so they appear visibly (red)
            showStatus(`${uniq.length} varning(ar): ${uniq.join(' · ')}`, 'error');
            // Also open a modal listing the warnings for better UX
            try { openBulkWarningsModal(uniq); } catch (e) {}
        }

        return created.map(c => c.id);
    };

    // ----------------------
    // Person archiving helpers
    // ----------------------
    const archivePerson = (personId, reason = '') => {
        setDbData(prev => ({ ...prev, people: (prev.people || []).map(p => p.id === personId ? { ...p, _archived: true, archiveReason: reason } : p) }));
        setIsDirty(true);
        showStatus('Person flyttad till arkiv.');
        try { recordAudit({ type: 'archive', entityType: 'person', entityId: personId, details: { reason } }); } catch (e) {}
    };

    const restorePerson = (personId) => {
        setDbData(prev => {
            const newPeople = (prev.people || []).map(p => p.id === personId ? (() => { const np = { ...p }; delete np._archived; delete np.archiveReason; return np; })() : p);
            // If this person is currently open in the editor, refresh editingPerson
            if (editingPerson && editingPerson.id === personId) {
                const updated = newPeople.find(p => p.id === personId);
                try { setEditingPerson(updated ? JSON.parse(JSON.stringify(updated)) : null); } catch (e) { setEditingPerson(updated || null); }
            }
            setIsDirty(true);
            showStatus('Person återställd från arkiv.');
            try { recordAudit({ type: 'restore', entityType: 'person', entityId: personId }); } catch (e) {}
            return { ...prev, people: newPeople };
        });
    };

        // Permanently delete a person and remove related relations
        const deletePersonPermanently = (personId) => {
            if (!personId) return false;
            const originalDb = dbData;
            setDbData(prev => {
                const newPeople = (prev.people || []).filter(p => p.id !== personId);
                const newRelations = (prev.relations || []).filter(r => r.fromPersonId !== personId && r.toPersonId !== personId);
                return { ...prev, people: newPeople, relations: newRelations };
            });
            setIsDirty(true);
            showUndoToast('Person raderad permanent.', () => setDbData(originalDb));
            try { recordAudit({ type: 'delete', entityType: 'person', entityId: personId }); } catch (e) {}
            return true;
        };

    // ----------------------
    // Merge metadata helpers
    // ----------------------
    const recordMerge = ({ mergedIntoId, originalPersonIds, createdBy }) => {
        // snapshot the original person objects so we can undo later
        const originalPeople = (dbData.people || []).filter(p => originalPersonIds.includes(p.id)).map(p => JSON.parse(JSON.stringify(p)));
        const mergeRecord = {
            id: `merge_${Date.now()}`,
            mergedIntoId,
            originalPersonIds: originalPersonIds.slice(),
            snapshot: originalPeople,
            createdBy: createdBy || 'system',
            createdAt: new Date().toISOString()
        };
        setDbData(prev => ({ ...prev, meta: { ...(prev.meta || {}), merges: [...(prev.meta?.merges || []), mergeRecord] } }));
        setIsDirty(true);
        showStatus('Merge registrerad.');
        return mergeRecord.id;
    };

    const undoMerge = (mergeId) => {
        const merge = dbData.meta?.merges?.find(m => m.id === mergeId);
        if (!merge) return false;
        // restore snapshot: replace any persons with same ids with snapshot entries
        setDbData(prev => {
            const peopleById = new Map(prev.people.map(p => [p.id, p]));
            for (const snap of (merge.snapshot || [])) {
                peopleById.set(snap.id, snap);
            }
            const newPeople = Array.from(peopleById.values());
            const newMerges = (prev.meta?.merges || []).filter(m => m.id !== mergeId);

            // If an opened editor corresponds to one of the restored persons, refresh it
            if (editingPerson && editingPerson.id) {
                const restored = newPeople.find(p => p.id === editingPerson.id);
                if (restored) {
                    try { setEditingPerson(JSON.parse(JSON.stringify(restored))); } catch (e) { setEditingPerson(restored); }
                }
            }

            setIsDirty(true);
            showStatus('Merge återställd.');
            return { ...prev, people: newPeople, meta: { ...(prev.meta || {}), merges: newMerges } };
        });
        return true;
    };

    // Perform a merge of multiple source persons into a single target person.
    // - snapshot originals via recordMerge (so undoMerge can restore)
    // - transfer events and links from sources to target
    // - rewrite relations to point to targetId and archive self-relations / duplicates
    // - archive source persons (soft-delete)
    const mergePersons = ({ targetId, sourceIds = [], createdBy = null }) => {
        if (process.env.NODE_ENV !== 'production') console.debug('[mergePersons] called with', { targetId, sourceIds, createdBy });
        if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) return null;
        // Filter out target if included accidentally
        const filtered = sourceIds.filter(id => id && id !== targetId);
        if (filtered.length === 0) return null;

        const mergeId = recordMerge({ mergedIntoId: targetId, originalPersonIds: filtered.slice(), createdBy: createdBy || (dbData?.meta?.currentUser || 'system') });
        if (process.env.NODE_ENV !== 'production') console.debug('[mergePersons] recorded mergeId', mergeId, 'filtered sources', filtered.slice());

        setDbData(prev => {
            // Use the shared simulation to determine which relations would be kept/archived
            const sim = simulateMerge(prev, targetId, filtered) || { keptList: [], archivedList: [] };
            const archivedIds = new Set((sim.archivedList || []).map(x => x.id));

            // Use helper to remap and dedupe relations
            const deduped = remapAndDedupeRelations(prev.relations || [], targetId, filtered, prev.meta?.currentUser || createdBy || 'system');

            // Transfer events & links and archive source persons
            const newPeople = transferEventsAndLinks(prev.people || [], targetId, filtered).map(p => p.id === targetId ? { ...p } : p);
            // Add merge-specific archiveReason for source persons
            for (const sid of filtered) {
                const idx = newPeople.findIndex(p => p.id === sid);
                if (idx !== -1) newPeople[idx] = { ...newPeople[idx], _archived: true, archiveReason: `Merged into ${targetId} (merge ${mergeId})` };
            }

            // Reconcile relations into people so derived `relations` stays consistent
            const reconciledPeople = reconcileRelationsToPeople(deduped, newPeople || []);

            // Update meta with lastMerge id
            const newMeta = { ...(prev.meta || {}), lastMerge: mergeId };

            return { ...prev, relations: deduped, people: reconciledPeople, meta: newMeta };
        });

        setIsDirty(true);
        if (process.env.NODE_ENV !== 'production') console.debug('[mergePersons] merge setDbData scheduled');
        showStatus('Personer sammanslagna. Du kan ångra via historiken.');
        try { recordAudit({ type: 'merge', entityType: 'person', entityId: targetId, details: { sourceIds: filtered.slice(), mergeId } }); } catch (e) {}
        return mergeId;
    };

    const handleCreateAndEditPerson = () => {
        const maxRef = dbData.people.reduce((max, p) => p.refNumber > max ? p.refNumber : max, 0);
        const newPerson = {
            id: `p_${Date.now()}`, refNumber: maxRef + 1, firstName: "", lastName: "", gender: "",
            events: [], notes: "", links: {}, relations: { parents: [], children: [], spouseId: null }
        };
        setDbData(prev => {
            const updatedPeople = [...prev.people, newPerson];
            setTimeout(() => handleOpenEditModal(newPerson.id), 0);
            return { ...prev, people: updatedPeople };
        });
        setIsDirty(true);
        showStatus(`Ny person (REF: ${newPerson.refNumber}) skapad. Fyll i uppgifter.`);
        try { recordAudit({ type: 'create', entityType: 'person', entityId: newPerson.id, details: { refNumber: newPerson.refNumber } }); } catch (e) {}
    };

    const handleOpenSourceModal = (personId, eventId, prefilledString = '') => {
        setSourcingEventInfo({ personId, eventId });
        const parsed = parseSourceString(prefilledString || '');
        setSourceState({
            sourceString: prefilledString || '', ...parsed, trust: 4, tags: '', note: '',
            imagePreview: null, imageFile: null, imageFilename: '', imagePath: ''
        });
        setIsCreatingSource(true);
    };

    const handleCloseSourceModal = () => {
        setSourcingEventInfo(null);
        setIsAttachingSource(false);
        setIsCreatingSource(false);
    };

    const handleSourceFormChange = (e) => setSourceState(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleParseSource = () => setSourceState(prev => ({ ...prev, ...parseSourceString(prev.sourceString) }));

    const handleSaveSource = async () => {
        // ... (Denna funktion är komplex och kan flyttas senare)
    };

    const handleSaveEditedSource = (updatedSource, updatedPeopleList = null) => {
        setDbData(prev => {
            // SÄKERHETSKONTROLL: Se till att alla fält finns innan vi bygger strängen
            const safeSource = {
                ...updatedSource,
                title: updatedSource.title || "",
                archive: updatedSource.archive || "",
                volume: updatedSource.volume || "",
                page: updatedSource.page || "",
                date: updatedSource.date || ""
            };

            const sourceString = typeof buildSourceString === 'function' 
                ? buildSourceString(safeSource) 
                : safeSource.title;
                
            const updated = { ...safeSource, sourceString };
            
            // Hantera dubbletter (checka mot sourceString)
            // Se till att prev.sources existerar
            const currentSources = prev.sources || [];
            
            const duplicate = currentSources.find(src => (src.sourceString || "").trim() === (sourceString || "").trim() && src.id !== updated.id);
            let newSources;
            
            if (duplicate) {
                const merged = { ...duplicate, ...updated, id: duplicate.id };
                newSources = currentSources.map(src => src.id === duplicate.id ? merged : src).filter(src => src.id !== updated.id);
                showStatus('Dubblett hittades – källor slogs ihop!');
            } else {
                const exists = currentSources.some(src => src.id === updated.id);
                if (exists) {
                    newSources = currentSources.map(src => src.id === updated.id ? updated : src);
                    showStatus('Källa uppdaterad!');
                } else {
                    newSources = [...currentSources, updated];
                    showStatus('Ny källa skapad!');
                }
            }
            return { ...prev, sources: newSources, people: updatedPeopleList || prev.people };
        });
        setIsDirty(true);
        try {
            const existed = Array.isArray(dbData.sources) && dbData.sources.some(s => s.id === updatedSource.id);
            const action = existed ? 'edit' : 'create';
            recordAudit({ type: action, entityType: 'source', entityId: updatedSource.id, details: { sourceString: updatedSource.sourceString } });
        } catch (e) {}
    };

    const handleUndo = () => {
        if (undoState.onUndo) undoState.onUndo();
        setUndoState({ isVisible: false, message: '', onUndo: null });
        if (window.undoTimeout) clearTimeout(window.undoTimeout);
    };

    const handleDeleteSource = useCallback((sourceIdToDelete) => {
        const originalDbData = dbData;
        const updatedSources = dbData.sources.filter(s => s.id !== sourceIdToDelete);
        const updatedPeople = dbData.people.map(person => {
            const updatedEvents = person.events.map(event => {
                if (event.sources?.includes(sourceIdToDelete)) {
                    return { ...event, sources: event.sources.filter(sid => sid !== sourceIdToDelete) };
                }
                return event;
            });
            return { ...person, events: updatedEvents };
        });
        setDbData({ ...dbData, sources: updatedSources, people: updatedPeople });
        setIsDirty(true);
        showUndoToast("Källan har raderats.", () => setDbData(originalDbData));
        try { recordAudit({ type: 'delete', entityType: 'source', entityId: sourceIdToDelete }); } catch (e) {}
    }, [dbData]);

    const handleAttachSources = (sourceIdsToAttach) => {
        if (!sourcingEventInfo || sourceIdsToAttach.length === 0) return;

        const personIndex = dbData.people.findIndex(p => p.id === sourcingEventInfo.personId);
        if (personIndex === -1) return;

        const updatedPeople = [...dbData.people];
        const targetPerson = { ...updatedPeople[personIndex] };
        const eventIndex = targetPerson.events.findIndex(e => e.id === sourcingEventInfo.eventId);
        if (eventIndex === -1) return;

        const targetEvent = { ...targetPerson.events[eventIndex] };
        if (!targetEvent.sources) targetEvent.sources = [];

        const newSourceIds = sourceIdsToAttach.filter(id => !targetEvent.sources.includes(id));
        targetEvent.sources = [...targetEvent.sources, ...newSourceIds];

        targetPerson.events[eventIndex] = targetEvent;
        updatedPeople[personIndex] = targetPerson;

        setDbData(prevDb => ({ ...prevDb, people: updatedPeople }));
        if (editingPerson && editingPerson.id === sourcingEventInfo.personId) {
            setEditingPerson(targetPerson);
        }

        setIsDirty(true);
        showStatus(`${newSourceIds.length} källor kopplades.`);
        handleCloseSourceModal();
    };

    const handleSwitchToCreateSource = (prefilledString = '') => {
        setIsAttachingSource(false);
        setSourceState({
            sourceString: prefilledString, archive: '', volume: '', imagePage: '', otherInfo: '',
            imagePreview: null, imageFile: null, imageFilename: '', imagePath: ''
        });
    };

    return {
        dbData, setDbData, fileHandle, isDirty, setIsDirty, newFirstName, setNewFirstName, newLastName, setNewLastName,
        showSettings, setShowSettings, editingPerson, activeTab, focusPair, bookmarks,
        sourceCatalogState, setSourceCatalogState, placeCatalogState, setPlaceCatalogState,
        familyTreeFocusPersonId, setFamilyTreeFocusPersonId,
        editingRelationsForPerson, setEditingRelationsForPerson, sourcingEventInfo, linkingMediaInfo, isAttachingSource,
        isSourceDrawerOpen, isPlaceDrawerOpen, isCreatingSource, sourceState, undoState, statusToast,
        handleNewFile, handleOpenFile, handleSaveFile, handleSaveFileAs, handleAddPerson,
        handleDeletePerson, handleOpenEditModal, handleCloseEditModal, handleSavePersonDetails,
        handleEditFormChange, handleTabChange, handleDeleteEvent, handleViewInFamilyTree,
        handleSaveRelations, handleNavigateToSource, handleNavigateToPlace, handleToggleSourceDrawer, handleLinkSourceFromDrawer, handleUnlinkSourceFromDrawer,
        handleLinkSourceToMedia, handleLinkPlaceToMedia,
        openSourceDrawerForSelection,
        handleTogglePlaceDrawer,
        openPlaceDrawerForSelection,
        handleCreateAndEditPerson, handleOpenSourceModal, handleCloseSourceModal, handleSourceFormChange,
        handleParseSource, handleSaveSource, handleSaveEditedSource, handleUndo, handleDeleteSource,
        handleSetFocusPair, handleToggleBookmark, handleSwapFocus, handleClearFocus,
        handleAddNewPlace, handleSavePlace,
        handleAttachSources, handleSwitchToCreateSource,
        // Relation & archive helpers
        addRelation, updateRelation, unlinkRelation, getPersonRelations, handleBulkCreateRelations,
        archivePerson, restorePerson,
        deletePersonPermanently,
        // Relationship drawer state & handlers
        isRelationshipDrawerOpen, setRelationshipDrawerOpen, relationshipCatalogState, setRelationshipCatalogState, handleToggleRelationshipDrawer,
        // Merge metadata
        recordMerge, undoMerge, mergePersons,
        showStatus,
        recordAudit,
        setAuditBackupDir,
        // bulk warnings modal state & controls
        bulkWarningsModal, openBulkWarningsModal, closeBulkWarningsModal,
        // expose undo toast helper so UI can show an inline Ångra action
        showUndoToast,
        applyHistoryEntry, historyState, isHistoryOpen, handleBack, handleForward, handleShowHistory
    };
}