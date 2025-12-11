import React, { useState, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import PersonAddForm from './PersonAddForm.jsx';
import PersonList from './PersonList.jsx';
import EditPersonModal from './EditPersonModal.jsx';
import SourceCatalog from './SourceCatalog.jsx';
import AttachSourceModal from './AttachSourceModal.jsx';
import UndoToast from './UndoToast.jsx';
import StatusToast from './StatusToast.jsx';
import ValidationWarningsModal from './ValidationWarningsModal.jsx';
import PlaceCatalog from './PlaceCatalog.jsx';
import FamilyTreeView from './FamilyTreeView.jsx';
import ContextMenu from './ContextMenu.jsx';
import FarmArchiveView from './FarmArchiveView.jsx';
import OrphanArchiveView from './OrphanArchiveView.jsx';
import AuditPanel from './AuditPanel.jsx';
import MergeModal from './MergeModal.jsx';
import MergesPanel from './MergesPanel.jsx';
import RelationshipDrawer from './RelationshipDrawer.jsx';
import SuggestionsPanel from './SuggestionsPanel.jsx';
import DuplicateMergePanel from './DuplicateMergePanel.jsx';
import RelationSettings from './RelationSettings.jsx';
import GedcomImporter from './GedcomImporter.jsx';
import { WindowFrame } from './WindowFrame.jsx';
function ApiPersonList() {
  const [people, setPeople] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5005/search?q=Anna')
      .then(res => res.json())
      .then(data => setPeople(data));
  }, []);

  return (
    <div style={{margin: '2em 0', padding: '1em', background: '#f0f4ff', borderRadius: 8}}>
      <h2>Personer från API (namn innehåller "Anna")</h2>
      <ul>
        {people.map((person, i) => (
          <li key={i}>
            {person.name} (född {person.birth_date}) {person.id && <>[id: {person.id}]</>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function App() {
  const {
    dbData, setDbData, fileHandle, isDirty, setIsDirty, newFirstName, setNewFirstName, newLastName, setNewLastName,
    showSettings, setShowSettings, editingPerson, activeTab, focusPair, bookmarks,
    sourceCatalogState, setSourceCatalogState, placeCatalogState, setPlaceCatalogState,
    familyTreeFocusPersonId, setFamilyTreeFocusPersonId, sourcingEventInfo,
    isSourceDrawerOpen, isPlaceDrawerOpen, isCreatingSource, sourceState, undoState, statusToast,
    showStatus,
    bulkWarningsModal, closeBulkWarningsModal,
    historyState, isHistoryOpen, handleBack, handleForward, handleShowHistory,
    handleNewFile, handleOpenFile, handleSaveFile, handleSaveFileAs, handleAddPerson,
    handleDeletePerson, handleOpenEditModal, handleCloseEditModal, handleSavePersonDetails,
    handleEditFormChange, handleTabChange, handleDeleteEvent, handleViewInFamilyTree,
    handleSaveRelations, handleToggleSourceDrawer, handleLinkSourceFromDrawer, handleUnlinkSourceFromDrawer,
    handleCreateAndEditPerson, handleOpenSourceModal, handleCloseSourceModal, handleSourceFormChange,
    handleParseSource, handleSaveSource, handleSaveEditedSource, handleUndo, handleDeleteSource,
    addRelation, getPersonRelations,
    handleSetFocusPair, handleToggleBookmark, handleAddNewPlace, handleSavePlace, isAttachingSource, handleAttachSources, handleSwitchToCreateSource, handleNavigateToPlace,
    handleTogglePlaceDrawer,
    applyHistoryEntry,
    setAuditBackupDir,
    isRelationshipDrawerOpen, relationshipCatalogState, setRelationshipCatalogState, handleToggleRelationshipDrawer,
    setIsSourceDrawerOpen, 
    setCurrentView
  } = useApp();
  
  const [personDrawerId, setPersonDrawerId] = useState(null);
  const personDrawer = dbData.people.find(p => p.id === personDrawerId) || null;
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMergesPanelOpen, setIsMergesPanelOpen] = useState(false);
  const [showDuplicateMerge, setShowDuplicateMerge] = useState(false);
  const [mergeInitialPair, setMergeInitialPair] = useState(null);
  const [showRelationSettings, setShowRelationSettings] = useState(false);
  
  const [personDrawerLocked, setPersonDrawerLocked] = useState(true);
  const [sourceDrawerLocked, setSourceDrawerLocked] = useState(false);
  const [placeDrawerLocked, setPlaceDrawerLocked] = useState(false);
  const [isGedcomImporterOpen, setIsGedcomImporterOpen] = useState(false);

  const [showArchived, setShowArchived] = useState(false);
  const [auditBackupDir, setAuditBackupDirState] = useState((dbData?.meta && dbData.meta.auditBackupDir) || '');

  useEffect(() => {
    setAuditBackupDirState((dbData?.meta && dbData.meta.auditBackupDir) || '');
  }, [dbData?.meta?.auditBackupDir]);

  const visiblePeople = React.useMemo(() => (dbData.people || []).filter(p => showArchived ? true : !p._archived), [dbData.people, showArchived]);

  // Helper: Hitta redan kopplade källor för grön markering
  const alreadyLinkedIds = React.useMemo(() => {
      if (!sourcingEventInfo || !editingPerson) return [];
      const evt = editingPerson.events?.find(e => e.id === sourcingEventInfo.eventId);
      if (!evt || !evt.sources) return [];
      return evt.sources.map(s => typeof s === 'object' ? s.sourceId : s);
  }, [sourcingEventInfo, editingPerson]);

  // Helper: Tvinga stängning av modalen
  const forceCloseSourceModal = () => {
      if (typeof setIsSourceDrawerOpen === 'function') setIsSourceDrawerOpen(false);
      else handleToggleSourceDrawer(); 
  };

  // --- NAVIGATION ---
  const handleNavigateToSource = (sourceId) => {
    const source = dbData.sources.find(s => s.id === sourceId);
    if (source) {
      setSourceCatalogState(prev => ({
        ...prev,
        selectedSourceId: sourceId,
        searchTerm: source.title || source.id, 
        expanded: {} 
      }));

      if (editingPerson) {
        if (!isSourceDrawerOpen) {
            if (typeof setIsSourceDrawerOpen === 'function') setIsSourceDrawerOpen(true);
            else handleToggleSourceDrawer();
        }
      } else {
        handleTabChange('sources');
      }
    }
  };

  const openPersonDrawer = (person, opts) => {
    const id = person && typeof person === 'object' ? person.id : person;
    setPersonDrawerId(id || null);
    if (opts && opts.edit) {
      setPersonDrawerEditContext({ id: id, relation: opts.relation || null, targetId: opts.targetId || null });
      try {
        if (id && !creationSnapshotsRef.current[id]) {
          creationSnapshotsRef.current[id] = { dbData: dbData, prevFocus: familyTreeFocusPersonId, isEditSnapshot: true };
        }
      } catch (e) { }
    }
  };
  const closePersonDrawer = () => setPersonDrawerId(null);

  const creationSnapshotsRef = useRef({});

  const cancelPersonCreation = (personId) => {
    const p = dbData.people.find(x => x.id === personId);
    if (!p) { closePersonDrawer(); return; }
    const snap = creationSnapshotsRef.current[personId];
    if (snap) {
      setDbData(snap.dbData);
      try { setFamilyTreeFocusPersonId(snap.prevFocus || null); } catch (err) { }
      const prev = snap.prevFocus || null;
      delete creationSnapshotsRef.current[personId];
      setPersonDrawerEditContext(null);
      if (prev) setPersonDrawerId(prev); else setPersonDrawerId(null);
      setIsDirty(true);
      showStatus('Ändringar avbröts.');
      return;
    }
    if (p._isPlaceholder) {
      setDbData(prev => ({ ...prev, people: (prev.people || []).filter(x => x.id !== personId) }));
      setPersonDrawerEditContext(null);
      setPersonDrawerId(null);
      setIsDirty(true);
      showStatus('Skapandet avbröts.');
      return;
    }
    if (!personDrawerLocked) closePersonDrawer();
  };

  const handlePersonDrawerSave = () => {
    if (personDrawer && personDrawer._isPlaceholder) {
      setDbData(prev => {
        const updatedPeople = (prev.people || []).map(p => p.id === personDrawer.id ? { ...p, _isPlaceholder: false, _placeholderRelation: undefined, _placeholderTargetId: undefined } : p);
        return { ...prev, people: updatedPeople };
      });
    }
    if (personDrawer && creationSnapshotsRef.current[personDrawer.id]) delete creationSnapshotsRef.current[personDrawer.id];
    setPersonDrawerEditContext(null);
    setIsDirty(false);
    showStatus('Person sparad.');
  };

  // --- ESC KEY LISTENER (PRIORITERAD) ---
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;

      // 1. Stäng flytande modaler först
      if (isSourceDrawerOpen) {
          e.preventDefault();
          e.stopPropagation();
          forceCloseSourceModal();
          return; 
      }
      
      if (isPlaceDrawerOpen && !placeDrawerLocked) {
           e.preventDefault();
           e.stopPropagation();
           handleTogglePlaceDrawer(placeCatalogState.selectedPlaceId);
           return;
      }

      // 2. Stäng person-redigering om inget annat är öppet
      if (editingPerson) {
          handleCloseEditModal();
          return;
      }
      
      if (personDrawer && !personDrawerLocked) {
          closePersonDrawer();
      }
    };
    window.addEventListener('keydown', onKey, true); // Capture phase
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isSourceDrawerOpen, isPlaceDrawerOpen, personDrawer, personDrawerLocked, editingPerson]);


  useEffect(() => {
    const handler = (e) => {
      if (e.button !== 0) return;
      // Ignorera klick i modalen
      if (e.target.closest('.modal-content') || e.target.closest('[role="dialog"]')) return;
      
      if (!personDrawer) return;
      const drawerEl = document.querySelector('.drawer-inner');
      if (drawerEl && drawerEl.contains(e.target)) return;
      const treeEl = document.querySelector('[data-family-tree="1"]');
      if (treeEl && treeEl.contains(e.target)) return;
      
      cancelPersonCreation(personDrawer.id);
    };
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
  }, [personDrawer]);

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetPersonId: null });
  const showContextMenu = (personOrId, x, y) => {
    const id = personOrId && typeof personOrId === 'object' ? personOrId.id : personOrId;
    setContextMenu({ visible: true, x, y, targetPersonId: id });
  };
  const hideContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, targetPersonId: null });

  const [personDrawerEditContext, setPersonDrawerEditContext] = useState(null); 

  // --- HELA createPersonAndLink (Ej förkortad) ---
  const createPersonAndLink = (targetId, relation) => {
    const maxRef = dbData.people.reduce((max, p) => p.refNumber > max ? p.refNumber : max, 0);
      const newPerson = {
      id: `p_${Date.now()}`,
      refNumber: maxRef + 1,
      firstName: '',
      lastName: '',
      gender: '',
      events: [],
      notes: '',
      links: {},
      relations: { parents: [], children: [], spouseId: null }
    };
    newPerson.firstName = '';
    newPerson._hideUntilEdit = true;
    newPerson._isPlaceholder = true;
    newPerson._placeholderRelation = relation;
    if (relation === 'spouse' || relation === 'partner') newPerson._placeholderSide = 'left';
    else if (relation === 'sibling') newPerson._placeholderSide = 'right';
    else if (relation === 'parent') newPerson._placeholderSide = 'above';
    else if (relation === 'child') newPerson._placeholderSide = 'below';
    newPerson._placeholderTargetId = targetId;

    setDbData(prev => {
      creationSnapshotsRef.current[newPerson.id] = { dbData: prev, prevFocus: familyTreeFocusPersonId };
      const alreadyHas = (prev.people || []).some(p => p.id === newPerson.id);
      const updatedPeople = alreadyHas ? [...prev.people] : [...(prev.people || []), newPerson];
      const relationsToCreate = [];
      const targetIndex = updatedPeople.findIndex(p => p.id === targetId);
      if (targetIndex !== -1) {
        if (relation === 'parent') {
          relationsToCreate.push({ type: 'parent', fromPersonId: newPerson.id, toPersonId: targetId });
        } else if (relation === 'child') {
          relationsToCreate.push({ type: 'child', fromPersonId: newPerson.id, toPersonId: targetId });
        } else if (relation === 'sibling') {
          try {
            const relsForTarget = typeof getPersonRelations === 'function' ? getPersonRelations(targetId) || [] : [];
            const parentIds = Array.from(new Set(relsForTarget.flatMap(r => {
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent') return r.toPersonId === targetId ? [r.fromPersonId] : (r.fromPersonId === targetId ? [r.toPersonId] : []);
                if (t === 'child') return r.fromPersonId === targetId ? [r.toPersonId] : (r.toPersonId === targetId ? [r.fromPersonId] : []);
                return [];
            }).filter(Boolean)));
            if (parentIds.length > 0) {
              parentIds.forEach(pid => relationsToCreate.push({ type: 'child', fromPersonId: newPerson.id, toPersonId: pid }));
            } else {
              relationsToCreate.push({ type: 'sibling', fromPersonId: newPerson.id, toPersonId: targetId });
            }
          } catch (e) {
            relationsToCreate.push({ type: 'sibling', fromPersonId: newPerson.id, toPersonId: targetId });
          }
        } else if (relation === 'spouse') {
          relationsToCreate.push({ type: 'spouse', fromPersonId: newPerson.id, toPersonId: targetId });
        }
      }

      setTimeout(() => {
        openPersonDrawer(newPerson.id);
        setFamilyTreeFocusPersonId(newPerson.id);
        setPersonDrawerEditContext({ id: newPerson.id, relation, targetId });
        if (relationsToCreate.length > 0) {
          relationsToCreate.forEach(r => addRelation(r));
        }
      }, 0);
      showStatus(`Ny person (REF ${newPerson.refNumber}) skapad. Fyll i uppgifter i drawern.`);
      const unique = [];
      const seen = new Set();
      (updatedPeople || []).forEach(pp => { if (!seen.has(pp.id)) { seen.add(pp.id); unique.push(pp); } });
      return { ...prev, people: unique };
    });
    setIsDirty(true);
    hideContextMenu();
  };

  const canGoBack = (historyState?.past?.length || 0) > 0;
  const canGoForward = (historyState?.future?.length || 0) > 0;

  const handleOpenSourceInDrawer = (sourceId, personId = null, eventId = null) => {
    handleToggleSourceDrawer(personId, eventId);
  };
  const onLocalTabChange = (tab) => {
    handleTabChange(tab);
    if (tab !== 'familyTree') {
      if (personDrawer) {
        setPersonDrawerId(null);
        setPersonDrawerLocked(false);
      }
      if (isSourceDrawerOpen) forceCloseSourceModal();
      if (isPlaceDrawerOpen) handleTogglePlaceDrawer(placeCatalogState?.selectedPlaceId);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      const detail = (e && e.detail) || {};
      const { placeId, eventId } = detail;
      if (!placeId || !eventId) return;
      if (window.__WFT_lastUnlink && window.__WFT_lastUnlink.placeId === placeId && window.__WFT_lastUnlink.eventId === eventId && (Date.now() - window.__WFT_lastUnlink.ts) < 1000) return;
      
      let newDbResult = null;
      setDbData(prev => {
        const updated = {
          ...prev,
          people: (prev.people || []).map(p => ({
            ...p,
            events: (p.events || []).map(ev => (ev.id === eventId && ev.placeId === placeId) ? { ...ev, placeId: null, place: '' } : ev)
          }))
        };
        newDbResult = updated;
        return updated;
      });
      setIsDirty(true);
      showStatus('Koppling borttagen.');
      window.__WFT_lastUnlink = { placeId, eventId, ts: Date.now() };

      try {
        if (newDbResult) {
          if (editingPerson && editingPerson.id) {
            const updatedPerson = newDbResult.people.find(p => p.id === editingPerson.id);
            if (updatedPerson) {
              handleEditFormChange(JSON.parse(JSON.stringify(updatedPerson)));
            }
          }
          if (personDrawer && personDrawer.id) {
            const updatedDrawerPerson = newDbResult.people.find(p => p.id === personDrawer.id);
            if (updatedDrawerPerson) {
              handleEditFormChange(JSON.parse(JSON.stringify(updatedDrawerPerson)));
            }
          }
        }
      } catch (err) { }
    };
    window.addEventListener('WFT:unlinkPlaceFromEvent', handler);
    return () => window.removeEventListener('WFT:unlinkPlaceFromEvent', handler);
  }, []);

  const handleExportZip = async () => {
    try {
      if (window.electronAPI) showStatus('Export påbörjad... (inte implementerad i denna build)');
      else showStatus('Export ej tillgänglig i webbläsarläge.');
    } catch (err) {
      showStatus('Export misslyckades.');
    }
  };

  const handleImportZip = async () => {
    try {
      showStatus('Import inte implementerad i denna version.');
    } catch (err) {
      showStatus('Import misslyckades.');
    }
  };

  const chooseAuditBackupDir = async () => {
    try {
      const apiAvailable = !!window.electronAPI && typeof window.electronAPI.openFileDialog === 'function';
      const altAvailable = !!window.electron && typeof window.electron.openFileDialog === 'function';
      if (!apiAvailable && !altAvailable) {
        showStatus('Fil-dialog inte tillgänglig.');
        return;
      }
      const res = apiAvailable ? await window.electronAPI.openFileDialog({ properties: ['openDirectory'] }) : await window.electron.openFileDialog({ properties: ['openDirectory'] });
      if (!res) return;
      const filePaths = Array.isArray(res) ? res : res.filePaths || [];
      if (res.canceled) return;
      if (!filePaths || filePaths.length === 0) return;
      const chosen = filePaths[0];
      setAuditBackupDirState(chosen);
      showStatus(`Vald backup-mapp: ${chosen}`);
    } catch (err) {
      showStatus('Fel vid val av mapp.');
    }
  };

  return ( 
    <div className="h-screen flex flex-col">
      {/* TOP MENUBAR */}
      <div className="menubar shadow-md shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold tracking-wide mr-2">WestFamilyTree</h1>
          <button onClick={handleBack} disabled={!canGoBack} className={`menu-btn ${!canGoBack ? 'opacity-50 cursor-not-allowed' : ''}`} title="Bakåt">←</button>
          <button onClick={handleForward} disabled={!canGoForward} className={`menu-btn ${!canGoForward ? 'opacity-50 cursor-not-allowed' : ''}`} title="Framåt">→</button>
          <button onClick={handleNewFile} className="menu-btn">Ny</button>
          <button onClick={handleOpenFile} className="menu-btn">Öppna fil...</button>
          <button onClick={handleSaveFile} className="menu-btn primary">Spara</button>
          <button onClick={handleSaveFileAs} className="menu-btn">Spara som...</button>
          <button onClick={() => setShowSettings(true)} className="menu-btn">Inställningar</button>
          <button onClick={() => setIsMergeModalOpen(true)} className="menu-btn">Slå ihop</button>
          <button onClick={() => setIsMergesPanelOpen(true)} className="menu-btn">Merges</button>
        </div>
        <div className="text-xs text-gray-400">
          <span>{fileHandle ? `Öppen fil: ${fileHandle.name}` : 'Ny namnlös databas'}</span>
        </div>
      </div>
      
      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="modal" style={{display: 'block'}}>
          <div className="modal-content card bg-white p-8 max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Inställningar</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div>
              <div className="text-gray-600 mb-4">
                <div className="mb-2">Audit-backup-mapp (valfritt):</div>
                <div className="flex items-center gap-2">
                  <input type="text" value={auditBackupDir} onChange={(e) => setAuditBackupDirState(e.target.value)} placeholder="Sökväg till mapp eller lämna tomt för standard" className="flex-1 border rounded px-2 py-1" />
                  <button type="button" onClick={chooseAuditBackupDir} className="px-3 py-1 bg-gray-200 rounded">Välj...</button>
                  <button type="button" onClick={() => setAuditBackupDirState('')} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded">Rensa</button>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-8">
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={handleExportZip} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Exportera allt som zip</button>
                  <button type="button" onClick={handleImportZip} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Importera zip-backup</button>
                  <button type="button" onClick={() => setShowRelationSettings(true)} className="px-4 py-2 bg-gray-200 rounded">Relationsinställningar</button>
                  <button type="button" onClick={() => { setAuditBackupDir(auditBackupDir); setShowSettings(false); showStatus('Inställningar sparade.'); }} className="px-6 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700">Spara</button>
                </div>
                {showRelationSettings && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <RelationSettings inline={true} onClose={() => setShowRelationSettings(false)} />
                  </div>
                )}
                { ((personDrawer && personDrawer._isPlaceholder) || (personDrawerEditContext && personDrawer && personDrawerEditContext.id === personDrawer.id)) && (
                  <div className="p-3 border-t bg-white flex justify-end gap-2">
                    <button onClick={() => cancelPersonCreation(personDrawer.id)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded">Avbryt</button>
                    <button onClick={handlePersonDrawerSave} className="px-4 py-2 bg-green-600 text-white rounded">Spara ändringar</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* OTHER MODALS */}
      {isMergeModalOpen && <MergeModal isOpen={isMergeModalOpen} onClose={(mergeId) => { setIsMergeModalOpen(false); if (mergeId) showStatus(`Merge klart (${mergeId})`); }} />}
      {isMergesPanelOpen && <MergesPanel isOpen={isMergesPanelOpen} onClose={() => setIsMergesPanelOpen(false)} />}
      {showDuplicateMerge && <DuplicateMergePanel allPeople={dbData.people || []} initialPair={mergeInitialPair} onClose={() => { setShowDuplicateMerge(false); setMergeInitialPair(null); }} />}
      
      {isHistoryOpen && (
        <div className="modal" style={{display: 'block'}} onClick={handleShowHistory}>
          <div className="modal-content card bg-white p-4 max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Historik</h3>
              <button onClick={handleShowHistory} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="text-sm text-gray-700 max-h-64 overflow-y-auto">
              <ul className="space-y-2">
                {historyState.past.map((h, idx) => (
                    <li key={idx} onClick={() => applyHistoryEntry(h)} className="p-2 border rounded hover:bg-gray-50 cursor-pointer">
                      <div className="font-semibold">Flik: <b>{h.tab}</b></div>
                    </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="status-bar shrink-0">
        <span>{isDirty ? 'Redo med osparade ändringar' : 'Redo'}</span>
        {isDirty && <span className="text-amber-600 font-bold">● Osparade ändringar</span>}
      </div>

      <div id="app" className="flex-grow p-6 flex flex-col bg-gray-100">
        
        {/* Lägg till API-listan överst för demo */}
        <ApiPersonList />
        
        <div className="w-full mb-4 border-b border-gray-300 bg-gray-100 shrink-0">
          <nav className="-mb-px flex space-x-8">
            <button onClick={() => onLocalTabChange('people')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm tab-btn ${activeTab === 'people' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Personregister</button>
            <button onClick={() => onLocalTabChange('sources')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm tab-btn ${activeTab === 'sources' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Källkatalog</button>
            <button onClick={() => onLocalTabChange('places')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm tab-btn ${activeTab === 'places' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Platsregister</button>
            <button onClick={() => onLocalTabChange('familyTree')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm tab-btn ${activeTab === 'familyTree' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Släktträd</button>
            <button onClick={() => onLocalTabChange('farmArchive')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm tab-btn ${activeTab === 'farmArchive' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Gårdsarkivet</button>
            <button onClick={() => onLocalTabChange('orphanArchive')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm tab-btn ${activeTab === 'orphanArchive' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Orphan-arkivet</button>
            <button onClick={() => onLocalTabChange('audit')} className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm tab-btn ${activeTab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Audit</button>
          </nav>
        </div>

        <div className={`flex-grow min-h-0 ${editingPerson ? 'flex gap-4' : ''}`}>
          
          {activeTab === 'people' && !editingPerson && (
            <div className="tab-content max-w-6xl mx-auto w-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <PersonAddForm newFirstName={newFirstName} setNewFirstName={setNewFirstName} newLastName={newLastName} setNewLastName={setNewLastName} onAddPerson={handleAddPerson} />
                <div className="flex items-center justify-between w-full mb-2">
                  <div />
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 flex items-center gap-2">
                      <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                      <span className="select-none">Visa arkiverade</span>
                    </label>
                  </div>
                </div>
                <PersonList people={visiblePeople} onOpenEditModal={handleOpenEditModal} onOpenRelationModal={handleViewInFamilyTree} onDeletePerson={handleDeletePerson} focusPair={focusPair} onSetFocusPair={handleSetFocusPair} bookmarks={bookmarks} />
                <div className="lg:col-span-1">
                  <SuggestionsPanel allPeople={visiblePeople} onOpenPair={(pair) => { setMergeInitialPair(pair); setShowDuplicateMerge(true); }} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orphanArchive' && !editingPerson && (
            <OrphanArchiveView people={dbData.people || []} allSources={dbData.sources || []} onOpenPerson={handleOpenEditModal} onViewInFamilyTree={handleViewInFamilyTree} />
          )}

          {activeTab === 'audit' && !editingPerson && ( <AuditPanel /> )}

          {/* STANDARDVISNING AV KÄLLKATALOG (EJ EDIT) */}
          {activeTab === 'sources' && !editingPerson && (
            <SourceCatalog
              sources={dbData.sources || []}
              people={visiblePeople}
              onDeleteSource={handleDeleteSource}
              onEditSource={handleSaveEditedSource}
              catalogState={sourceCatalogState}
              setCatalogState={setSourceCatalogState}
              onCreateNewPerson={handleCreateAndEditPerson}
              onOpenEditModal={handleOpenEditModal}
              onNavigateToPlace={handleNavigateToPlace}
            />
          )}

          {activeTab === 'places' && !editingPerson && (
            <PlaceCatalog
              places={dbData.places || []}
              allPeople={visiblePeople}
              catalogState={placeCatalogState}
              setCatalogState={setPlaceCatalogState}
              onOpenEditModal={handleOpenEditModal}
              onSavePlace={handleSavePlace}
              onAddNewPlace={handleAddNewPlace}
              onNavigateToSource={handleNavigateToSource}
              onAttachSource={handleOpenSourceModal}
              onUnlinkPlaceFromEvent={(placeId, eventId) => {
                const updatedPeople = (dbData.people || []).map(p => ({
                  ...p,
                  events: (p.events || []).map(ev => (ev.id === eventId && ev.placeId === placeId) ? { ...ev, placeId: null, place: '' } : ev)
                }));
                const newDb = { ...dbData, people: updatedPeople };
                setDbData(newDb);
                setIsDirty(true);
                showStatus('Koppling borttagen.');
              }}
            />
          )}

          {activeTab === 'familyTree' && !editingPerson && (
            <FamilyTreeView
              allPeople={visiblePeople}
              focusPersonId={familyTreeFocusPersonId}
              onSetFocus={(personId) => setFamilyTreeFocusPersonId(personId)}
              onOpenEditModal={handleOpenEditModal}
              onOpenPersonDrawer={openPersonDrawer}
              onSave={handleSaveRelations}
              onCreateNewPerson={handleCreateAndEditPerson}
              onCreatePersonAndLink={createPersonAndLink}
              onOpenContextMenu={showContextMenu}
              highlightPlaceholderId={personDrawerEditContext?.id || (personDrawer && personDrawer._isPlaceholder ? personDrawer.id : null)}
              onRequestOpenDuplicateMerge={() => setShowDuplicateMerge(true)}
            />
          )}

          {activeTab === 'farmArchive' && !editingPerson && (
            <FarmArchiveView
              places={dbData.places || []}
              people={visiblePeople}
              allSources={dbData.sources || []}
              onSavePlace={handleSavePlace}
              onOpenPerson={handleOpenEditModal}
              onViewInFamilyTree={handleViewInFamilyTree}
              onNavigateToSource={handleNavigateToSource}
              onOpenSourceDrawer={handleToggleSourceDrawer}
              onNavigateToPlace={handleNavigateToPlace}
              onOpenPlaceDrawer={handleTogglePlaceDrawer}
              onOpenSourceInDrawer={handleOpenSourceInDrawer}
            />
          )}

          {/* EDITING PERSON (SPLIT VIEW) */}
          {editingPerson && (
            <>
              <div className="w-full h-full flex flex-col bg-white shadow-2xl rounded-xl border">
                <div className="flex justify-between items-center border-b p-4 bg-gray-50 rounded-t-xl shrink-0">
                  <div className={`${isPlaceDrawerOpen ? 'w-1/2' : 'w-full'}`}>
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                      {editingPerson.id === focusPair.primary 
                        ? <span className="text-yellow-400 text-2xl" title="Primär Fokusperson">★</span>
                        : <span onClick={() => handleSetFocusPair('primary', editingPerson.id)} className="text-gray-300 hover:text-yellow-400 cursor-pointer text-2xl" title="Sätt som Primär Fokus">☆</span>
                      }
                      {editingPerson.id === focusPair.secondary
                        ? <span className="text-blue-500 text-2xl" title="Sekundär Fokusperson">★</span>
                        : <span onClick={() => handleSetFocusPair('secondary', editingPerson.id)} className="text-gray-300 hover:text-blue-500 cursor-pointer text-2xl" title="Sätt som Sekundär Fokus">☆</span>
                      }
                      <span className="ml-2" title={`Person ID: ${editingPerson.id}`}>
                        Redigera: {editingPerson.firstName} {editingPerson.lastName}
                      </span>
                      <button onClick={() => handleToggleBookmark(editingPerson.id)} className="ml-4" title="Bokmärk person">
                        {bookmarks.includes(editingPerson.id)
                          ? <svg className="w-5 h-5 text-indigo-600 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v16l-7-3.5L5 21V5a2 2 0 0 1 2-2z"/></svg>
                          : <svg className="w-5 h-5 text-gray-400 hover:text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        }
                      </button>
                      <button onClick={() => handleViewInFamilyTree(editingPerson.id)} className="ml-4 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold">Släktträd</button>
                    </h3>
                  </div>
                  {(isPlaceDrawerOpen) && (
                    <div className="w-1/2 pl-4 border-l ml-4">
                      <h3 className="text-xl font-bold text-gray-800">&nbsp;</h3>
                    </div>
                  )}
                  <button onClick={handleCloseEditModal} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="flex flex-grow overflow-hidden">
                  {/* VÄNSTER: Person Editor */}
                  <div className={`transition-all duration-300 overflow-y-auto ${(isPlaceDrawerOpen) ? 'w-1/2' : 'w-full'}`}>
                    <EditPersonModal 
                      person={editingPerson}
                      onClose={handleCloseEditModal}
                      onSave={handleSavePersonDetails}
                      onChange={handleEditFormChange}
                      allSources={dbData.sources}
                      allPlaces={dbData.places || []}
                      allPeople={visiblePeople}
                      onDeleteEvent={handleDeleteEvent}
                      onOpenSourceDrawer={handleToggleSourceDrawer}
                      onNavigateToSource={handleNavigateToSource}
                      onNavigateToPlace={handleNavigateToPlace}
                      onTogglePlaceDrawer={handleTogglePlaceDrawer}
                      onViewInFamilyTree={handleViewInFamilyTree}
                      focusPair={focusPair}
                      onSetFocusPair={handleSetFocusPair}
                      activeSourcingEventId={sourcingEventInfo?.eventId}
                    />
                  </div>
                  {isPlaceDrawerOpen && (
                    <div className="w-1/2 border-l flex flex-col bg-gray-50" style={{overflow: 'hidden'}}>
                      <PlaceCatalog
                          places={dbData.places || []}
                          allPeople={visiblePeople}
                        catalogState={placeCatalogState}
                        setCatalogState={setPlaceCatalogState}
                        onOpenEditModal={handleOpenEditModal}
                        onSavePlace={handleSavePlace}
                        onAddNewPlace={handleAddNewPlace}
                        onNavigateToSource={handleNavigateToSource}
                        onAttachSource={handleOpenSourceModal}
                        isDrawerMode={true}
                        editingPerson={editingPerson}
                        onLinkPlaceToEvent={(placeId, eventId) => {
                          if (!editingPerson) return;
                          const updatedEvents = (editingPerson.events || []).map(ev =>
                            ev.id === eventId ? { ...ev, placeId } : ev
                          );
                          handleEditFormChange({ ...editingPerson, events: updatedEvents });
                        }}
                        onUnlinkPlaceFromEvent={(placeId, eventId) => {
                          if (!editingPerson) return;
                          const updatedEvents = (editingPerson.events || []).map(ev => ev.id === eventId ? { ...ev, placeId: null, place: '' } : ev);
                          handleEditFormChange({ ...editingPerson, events: updatedEvents });
                          setIsDirty(true);
                          showStatus('Koppling borttagen.');
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ====================================================== */}
      {/* FLYTTBAR KÄLLKATALOG (MODAL) */}
      {/* ====================================================== */}
      
      {isSourceDrawerOpen && (
        <WindowFrame
          title="Källkatalog"
          icon={null}
          onClose={forceCloseSourceModal}
          initialWidth={1100}
          initialHeight={700}
        >
          <SourceCatalog
            sources={dbData.sources || []}
            people={visiblePeople}
            onDeleteSource={handleDeleteSource}
            onEditSource={handleSaveEditedSource}
            catalogState={sourceCatalogState}
            setCatalogState={setSourceCatalogState}
            onCreateNewPerson={handleCreateAndEditPerson}
            onOpenEditModal={handleOpenEditModal}
            isDrawerMode={true}
            onLinkSource={handleLinkSourceFromDrawer}
            onUnlinkSource={handleUnlinkSourceFromDrawer}
            sourcingEventInfo={sourcingEventInfo}
            alreadyLinkedIds={alreadyLinkedIds}
          />
        </WindowFrame>
      )}

      {/* Övriga modaler */}
      <UndoToast isVisible={undoState.isVisible} message={undoState.message} onUndo={handleUndo} duration={10000} />
      <StatusToast isVisible={statusToast.isVisible} message={statusToast.message} severity={statusToast.severity} />
      <ValidationWarningsModal isOpen={bulkWarningsModal?.isOpen} warnings={bulkWarningsModal?.warnings || []} onClose={() => { try { closeBulkWarningsModal(); } catch (e) {} }} />

      {isAttachingSource && <AttachSourceModal allSources={dbData.sources || []} allPeople={visiblePeople} onAttach={handleAttachSources} onCreateNew={handleSwitchToCreateSource} onClose={handleCloseSourceModal} onEditSource={handleOpenEditSource} />}

      {isGedcomImporterOpen && (
        <div className="modal" style={{display: 'block', zIndex: 3000}}>
          <div className="modal-content card bg-white shadow-2xl rounded-xl border-0 max-w-5xl">
            <div className="flex justify-between items-center border-b p-4 bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-800">Importera GEDCOM (NY)</h3>
              <button onClick={() => setIsGedcomImporterOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-6">
              <GedcomImporter onImport={(imported) => {
                setDbData(prev => {
                  const peopleMap = new Map((prev.people || []).map(p => [p.id, p]));
                  for (const np of imported.individuals) { if (!peopleMap.has(np.id)) peopleMap.set(np.id, np); }
                  const sourceMap = new Map((prev.sources || []).map(s => [s.id, s]));
                  for (const ns of imported.sources) { if (!sourceMap.has(ns.id)) sourceMap.set(ns.id, ns); }
                  const placeMap = new Map((prev.places || []).map(p => [p.id, p]));
                  if (imported.places) { for (const npl of imported.places) { if (!placeMap.has(npl.id)) placeMap.set(npl.id, npl); } }
                  
                  return {
                    ...prev,
                    people: Array.from(peopleMap.values()),
                    sources: Array.from(sourceMap.values()),
                    places: Array.from(placeMap.values()),
                  };
                });
                setIsGedcomImporterOpen(false);
                showStatus('Import klar!');
              }} />
            </div>
          </div>
        </div>
      )}

      <button onClick={() => setIsGedcomImporterOpen(true)} className="fixed bottom-4 right-4 px-6 py-3 bg-blue-700 text-white rounded shadow-lg z-50">NY GEDCOM-import</button>
    </div>
  )
}

export default App;