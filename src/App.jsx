import React, { useState, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { syncRelations } from './syncRelations';
import PersonAddForm from './PersonAddForm.jsx';
import PersonList from './PersonList.jsx';
import EditPersonModal from './EditPersonModal.jsx';
import SourceCatalog from './SourceCatalog.jsx';
import AttachSourceModal from './AttachSourceModal.jsx';
import UndoToast from './UndoToast.jsx';
import StatusToast from './StatusToast.jsx';
import ValidationWarningsModal from './ValidationWarningsModal.jsx';
import PlaceCatalog from './PlaceCatalogNew.jsx';  // NY VERSION!
import FamilyTreeView from './FamilyTreeView.jsx';
import FarmArchiveView from './FarmArchiveView.jsx';
import OrphanArchiveView from './OrphanArchiveView.jsx';
import AuditPanel from './AuditPanel.jsx';
import MergeModal from './MergeModal.jsx';
import MergesPanel from './MergesPanel.jsx';
import SuggestionsPanel from './SuggestionsPanel.jsx';
import DuplicateMergePanel from './DuplicateMergePanel.jsx';
import RelationSettings from './RelationSettings.jsx';
import GedcomImporter from './GedcomImporter.jsx';
import { MediaManager } from './MediaManager.jsx';
import WindowFrame from './WindowFrame.jsx';
import LinkPersonModal from './LinkPersonModal.jsx';
import OAIArchiveHarvesterModal from './OAIArchiveHarvesterModal.jsx';
import Button from './Button.jsx'; 

// Helper: Build relations array from people array to keep dbData.relations in sync
function buildRelationsFromPeople(people = []) {
  const relations = [];
  const seen = new Set();
  
  const addRelation = (fromPersonId, toPersonId, type) => {
    if (!fromPersonId || !toPersonId || fromPersonId === toPersonId) return;
    // Create a normalized key to avoid duplicates (bidirectional)
    const key1 = `${fromPersonId}|${toPersonId}|${type}`;
    const key2 = `${toPersonId}|${fromPersonId}|${type}`;
    if (seen.has(key1) || seen.has(key2)) return;
    seen.add(key1);
    
    relations.push({
      id: `rel_${fromPersonId}_${toPersonId}_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      fromPersonId,
      toPersonId,
      type,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      _archived: false
    });
  };
  
  for (const person of people) {
    if (!person || !person.id || !person.relations) continue;
    
    const { parents = [], children = [], spouseId = null, siblings = [], partners = [] } = person.relations;
    
    // Parent-child relations (bidirectional)
    for (const parentId of parents) {
      if (typeof parentId === 'string') {
        addRelation(parentId, person.id, 'parent');
      } else if (parentId && typeof parentId === 'object' && parentId.id) {
        addRelation(parentId.id, person.id, 'parent');
      }
    }
    
    for (const childId of children) {
      if (typeof childId === 'string') {
        addRelation(person.id, childId, 'parent');
      } else if (childId && typeof childId === 'object' && childId.id) {
        addRelation(person.id, childId.id, 'parent');
      }
    }
    
    // Partner relations (från partners-arrayen)
    if (Array.isArray(partners)) {
      for (const partnerRef of partners) {
        const partnerId = typeof partnerRef === 'string' ? partnerRef : (partnerRef?.id || partnerRef);
        if (partnerId) {
          addRelation(person.id, partnerId, 'spouse');
        }
      }
    }
    
    // Fallback: Spouse relations (från spouseId för bakåtkompatibilitet)
    if (spouseId) {
      const spouseIdStr = typeof spouseId === 'string' ? spouseId : (spouseId.id || spouseId);
      if (spouseIdStr) {
        addRelation(person.id, spouseIdStr, 'spouse');
      }
    }
    
    // Sibling relations
    for (const siblingId of siblings) {
      if (typeof siblingId === 'string') {
        addRelation(person.id, siblingId, 'sibling');
      } else if (siblingId && typeof siblingId === 'object' && siblingId.id) {
        addRelation(person.id, siblingId.id, 'sibling');
      }
    }
  }
  
  return relations;
}

function App() {
    // Reset all UI state after new database
    // Visa bekräftelsedialog för ny databas
    const confirmNewDatabase = () => {
      const confirmed = window.confirm('Vill du verkligen skapa en ny databas? Osparad data kommer att gå förlorad.');
      return confirmed;
    };

    const resetUiState = () => {
      setNewFirstName("");
      setNewLastName("");
      setEditingPerson(null);
      setActiveTab('people');
      setPersonDrawerId(null);
      setIsMergeModalOpen(false);
      setIsMergesPanelOpen(false);
      setShowDuplicateMerge(false);
      setMergeInitialPair(null);
      setShowRelationSettings(false);
      setPersonDrawerLocked(true);
      setSourceDrawerLocked(false);
      setPlaceDrawerLocked(false);
      setIsGedcomImporterOpen(false);
      setLinkPersonModal({ isOpen: false, preSelectedPersonId: null });
      setShowArchived(false);
      setAuditBackupDirState('');
      setNewPersonToEditId(null);
      setIsOAIHarvesterOpen(false);
      setSourceCatalogState({});
      setPlaceCatalogState({});
      setFamilyTreeFocusPersonId(null);
      setSourcingEventInfo(null);
      setIsSourceDrawerOpen(false);
      setIsPlaceDrawerOpen(false);
      setCurrentView('people');
      setBookmarks([]);
      setFocusPair(null);
      setUndoState(null);
      setStatusToast(null);
      setBulkWarningsModal(false);
      setHistoryState({ past: [], future: [] });
      setContextMenu({ visible: false, x: 0, y: 0, targetPersonId: null });
      setPersonDrawerEditContext(null);
      setRelationshipCatalogState({});
      setIsRelationshipDrawerOpen(false);
    };
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
    handleLinkSourceToMedia, handleLinkPlaceToMedia, linkingMediaInfo,
    openSourceDrawerForSelection,
    handleCreateAndEditPerson, handleOpenSourceModal, handleCloseSourceModal, handleSourceFormChange,
    handleParseSource, handleSaveSource, handleSaveEditedSource, handleUndo, handleDeleteSource,
    addRelation, getPersonRelations,
    handleSetFocusPair, handleToggleBookmark, handleAddNewPlace, handleSavePlace, isAttachingSource, handleAttachSources, handleSwitchToCreateSource, handleNavigateToPlace,
    handleTogglePlaceDrawer,
    openPlaceDrawerForSelection,
    applyHistoryEntry,
    setAuditBackupDir,
    isRelationshipDrawerOpen, relationshipCatalogState, setRelationshipCatalogState, handleToggleRelationshipDrawer,
    setIsSourceDrawerOpen, 
    setCurrentView
  } = useApp();

  // Visa loader om dbData inte är laddad
  if (!dbData) {
    if (window.dbInitError) {
      return <div style={{padding:40, textAlign:'center', color:'red'}}>
        Kunde inte skapa ny databas:<br/>
        <pre>{window.dbInitError.message}</pre>
      </div>;
    }
    const isElectronApi = !!(window && window.electronAPI && typeof window.electronAPI.createNewDatabase === 'function');
    return <div style={{padding:40, textAlign:'center'}}>
      {!isElectronApi && (
        <div style={{color:'red',fontWeight:'bold',fontSize:'2rem',marginBottom:24}}>
          <div>VARNING: Electron-API saknas!</div>
          <div>Stäng alla webbläsarfönster och använd endast Electron-fönstret.</div>
          <div>Om felet kvarstår, bygg appen för produktion.</div>
        </div>
      )}
      Laddar databas...
    </div>;
  }

  const handleCloseEditModalSafe = () => {
    handleCloseEditModal();
  };

  // Helper to detect Electron
  const isElectron = !!(window && window.electronAPI && typeof window.electronAPI.saveFileAs === 'function');

  // Guard: prevent multiple dialogs (useRef for true sync)
  const openDialogActiveRef = useRef(false);
  // Listen for Electron menu actions and trigger save handlers
  React.useEffect(() => {
    if (isElectron && window.electronAPI && window.electronAPI.on) {
      const handler = (event, action) => {
        if (action === 'new-database') {
          if (confirmNewDatabase()) {
            Promise.resolve(handleNewFile()).then(() => {
              resetUiState();
            });
          }
        } else if (action === 'open-database') {
          if (!openDialogActiveRef.current) {
            openDialogActiveRef.current = true;
            Promise.resolve(handleOpenFile()).finally(() => { openDialogActiveRef.current = false; });
          }
        } else if (action === 'save-database') {
          handleSaveFile();
        } else if (action === 'save-as-database') {
          handleSaveFileAs('menu');
        }
      };
      window.electronAPI.on('menu-action', handler);
      return () => {
        window.electronAPI.off('menu-action', handler);
      };
    } else if (window && window.addEventListener) {
      // Fallback for custom event dispatch
      const handler = (e) => {
        if (!e || !e.detail) return;
        if (e.detail === 'new-database') {
          if (confirmNewDatabase()) {
            Promise.resolve(handleNewFile()).then(() => {
              resetUiState();
            });
          }
        } else if (e.detail === 'save-database') {
          handleSaveFile();
        } else if (e.detail === 'save-as-database') {
          handleSaveFileAs('menu');
        }
      };
      window.addEventListener('menu-action', handler);
      return () => {
        window.removeEventListener('menu-action', handler);
      };
    }
  }, [handleSaveFile, handleSaveFileAs, isElectron]);
  

  
  const [personDrawerId, setPersonDrawerId] = useState(null);
  const personDrawer = (dbData && dbData.people ? dbData.people : []).find(p => p.id === personDrawerId) || null;
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isMergesPanelOpen, setIsMergesPanelOpen] = useState(false);
  const [showDuplicateMerge, setShowDuplicateMerge] = useState(false);
  const [mergeInitialPair, setMergeInitialPair] = useState(null);
  const [showRelationSettings, setShowRelationSettings] = useState(false);
  
  const [personDrawerLocked, setPersonDrawerLocked] = useState(true);
  const [sourceDrawerLocked, setSourceDrawerLocked] = useState(false);
  const [placeDrawerLocked, setPlaceDrawerLocked] = useState(false);
  const [isGedcomImporterOpen, setIsGedcomImporterOpen] = useState(false);
  const [linkPersonModal, setLinkPersonModal] = useState({ isOpen: false, preSelectedPersonId: null });
  const [showArchived, setShowArchived] = useState(false);
  const [auditBackupDir, setAuditBackupDirState] = useState((dbData?.meta && dbData.meta.auditBackupDir) || '');
  const [newPersonToEditId, setNewPersonToEditId] = useState(null);
  const [isOAIHarvesterOpen, setIsOAIHarvesterOpen] = useState(false); 

  useEffect(() => {
    setAuditBackupDirState((dbData?.meta && dbData.meta.auditBackupDir) || '');
  }, [dbData?.meta?.auditBackupDir]);

  const visiblePeople = React.useMemo(() => (dbData.people || []).filter(p => showArchived ? true : !p._archived), [dbData.people, showArchived]);

  // Öppna edit-modal när en ny person skapats
  useEffect(() => {
    if (newPersonToEditId) {
      const newPerson = dbData.people.find(p => p.id === newPersonToEditId);
      if (newPerson) {
        handleOpenEditModal(newPerson.id);
        setNewPersonToEditId(null);
      }
    }
  }, [newPersonToEditId, dbData.people]);

  const alreadyLinkedIds = React.useMemo(() => {
      if (!sourcingEventInfo || !editingPerson) return [];
      const evt = editingPerson.events?.find(e => e.id === sourcingEventInfo.eventId);
      if (!evt || !evt.sources) return [];
      return evt.sources.map(s => typeof s === 'object' ? s.sourceId : s);
  }, [sourcingEventInfo, editingPerson]);

  const forceCloseSourceModal = () => {
      if (sourcingEventInfo) {
          handleToggleSourceDrawer();
          setTimeout(() => {
              if (typeof setIsSourceDrawerOpen === 'function') setIsSourceDrawerOpen(false);
              else handleToggleSourceDrawer();
          }, 10); 
      } else {
          if (typeof setIsSourceDrawerOpen === 'function') setIsSourceDrawerOpen(false);
          else handleToggleSourceDrawer();
      }
  };

  const handleOpenLinkPersonModal = (personId = null) => {
      setLinkPersonModal({ isOpen: true, preSelectedPersonId: personId });
  };

  const handleLinkSourceToPerson = (personId, eventId) => {
      const sourceId = sourceCatalogState.selectedSourceId;
      if (!sourceId) return;
      
      // Om eventId är '__create_new_event__', öppna EditPersonModal för att skapa event
      if (eventId === '__create_new_event__') {
          handleOpenEditModal(personId);
          return;
      }
      
      setDbData(prev => {
          const people = [...prev.people];
          const pIndex = people.findIndex(p => p.id === personId);
          if (pIndex === -1) return prev;
          const person = { ...people[pIndex] };
          const evIndex = person.events.findIndex(e => e.id === eventId);
          if (evIndex === -1) return prev;
          const event = { ...person.events[evIndex] };
          if (!event.sources) event.sources = [];
          if (!event.sources.includes(sourceId)) {
              event.sources.push(sourceId);
              person.events[evIndex] = event;
              people[pIndex] = person;
              showStatus('Källa kopplad till ' + person.firstName);
              return { ...prev, people };
          }
          return prev;
      });
      setIsDirty(true);
      setLinkPersonModal({ isOpen: false, preSelectedPersonId: null });
  };

  const handleUnlinkSourceFromPerson = (personId, eventId, sourceId) => {
    setDbData(prev => {
      const people = [...prev.people];
      const pIndex = people.findIndex(p => p.id === personId);
      if (pIndex === -1) return prev;
      const person = { ...people[pIndex] };
      const evIndex = person.events.findIndex(e => e.id === eventId);
      if (evIndex === -1) return prev;
      const event = { ...person.events[evIndex] };
      let updated = { ...prev };
      let didRemove = false;
      if (event.sources && event.sources.includes(sourceId)) {
        event.sources = event.sources.filter(sid => sid !== sourceId);
        person.events[evIndex] = event;
        people[pIndex] = person;
        updated.people = people;
        didRemove = true;
      }
      // If this is a Bild event, also remove the region from all images in this source
      const source = (prev.sources || []).find(s => s.id === sourceId);
      if (source && event.type === 'Bild' && Array.isArray(source.images)) {
        const newImages = source.images.map(img => {
          if (!Array.isArray(img.regions)) return img;
          return { ...img, regions: img.regions.filter(r => r.personId !== personId) };
        });
        updated.sources = (prev.sources || []).map(s => s.id === sourceId ? { ...s, images: newImages } : s);
        didRemove = true;
      }
      if (didRemove) {
        showStatus('Koppling borttagen.');
        return updated;
      }
      return prev;
    });
    setIsDirty(true);
  };

  const handleAddSource = () => {
    const newId = `src_${Date.now()}`;
    const newSource = {
      id: newId, title: "Ny källa", archiveTop: "Övrigt", archive: "", volume: "", page: "", note: "", aid: "", nad: "", bildid: "", imagePage: "", date: "", tags: "", dateAdded: new Date().toISOString(), trust: 0
    };
    setDbData(prev => ({ ...prev, sources: [...(prev.sources || []), newSource] }));
    setSourceCatalogState(prev => ({ ...prev, selectedSourceId: newId, searchTerm: '', expanded: { ...prev.expanded, 'Övrigt': true } }));
    setIsDirty(true);
    showStatus('Ny källa skapad.');
  };

  const handleNavigateToSource = (sourceId) => {
    const source = dbData.sources.find(s => s.id === sourceId);
    if (source) {
      setSourceCatalogState(prev => ({ ...prev, selectedSourceId: sourceId, searchTerm: source.title || source.id, expanded: {} }));
      if (editingPerson) {
        if (!isSourceDrawerOpen) { if (typeof setIsSourceDrawerOpen === 'function') setIsSourceDrawerOpen(true); else handleToggleSourceDrawer(); }
      } else { handleTabChange('sources'); }
    }
  };

  const openPersonDrawer = (person, opts) => {
    const id = person && typeof person === 'object' ? person.id : person;
    setPersonDrawerId(id || null);
    if (opts && opts.edit) {
      setPersonDrawerEditContext({ id: id, relation: opts.relation || null, targetId: opts.targetId || null });
      try { if (id && !creationSnapshotsRef.current[id]) { creationSnapshotsRef.current[id] = { dbData: dbData, prevFocus: familyTreeFocusPersonId, isEditSnapshot: true }; } } catch (e) { }
    }
  };
  const closePersonDrawer = () => setPersonDrawerId(null);
  const creationSnapshotsRef = useRef({});

  const cancelPersonCreation = (personId) => {
    const p = dbData.people.find(x => x.id === personId);
    if (!p) { closePersonDrawer(); return; }
    const snap = creationSnapshotsRef.current[personId];
    if (snap) { setDbData(snap.dbData); try { setFamilyTreeFocusPersonId(snap.prevFocus || null); } catch (err) { } const prev = snap.prevFocus || null; delete creationSnapshotsRef.current[personId]; setPersonDrawerEditContext(null); if (prev) setPersonDrawerId(prev); else setPersonDrawerId(null); setIsDirty(true); showStatus('Ändringar avbröts.'); return; }
    if (p._isPlaceholder) { setDbData(prev => ({ ...prev, people: (prev.people || []).filter(x => x.id !== personId) })); setPersonDrawerEditContext(null); setPersonDrawerId(null); setIsDirty(true); showStatus('Skapandet av avbröts.'); return; }
    if (!personDrawerLocked) closePersonDrawer();
  };

  const ensureRelationLink = (people, person) => {
    const placeholderRelation = person._placeholderRelation;
    const placeholderTargetId = person._placeholderTargetId;
    if (!placeholderRelation || !placeholderTargetId) return people;
    const idx = people.findIndex(p => p.id === person.id);
    const targetIdx = people.findIndex(p => p.id === placeholderTargetId);
    if (idx === -1 || targetIdx === -1) return people;
    const thisPerson = { ...people[idx] };
    const targetPerson = { ...people[targetIdx] };
    thisPerson.relations = thisPerson.relations || { parents: [], children: [], spouseId: null };
    targetPerson.relations = targetPerson.relations || { parents: [], children: [], spouseId: null };
    if (placeholderRelation === 'parent') {
      if (!targetPerson.relations.parents.includes(thisPerson.id)) {
        targetPerson.relations.parents.push(thisPerson.id);
      }
      if (!thisPerson.relations.children.includes(targetPerson.id)) {
        thisPerson.relations.children.push(targetPerson.id);
      }
    } else if (placeholderRelation === 'child') {
      if (!targetPerson.relations.children.includes(thisPerson.id)) {
        targetPerson.relations.children.push(thisPerson.id);
      }
      if (!thisPerson.relations.parents.includes(targetPerson.id)) {
        thisPerson.relations.parents.push(targetPerson.id);
      }
    } else if (placeholderRelation === 'spouse' || placeholderRelation === 'partner') {
      targetPerson.relations.spouseId = thisPerson.id;
      thisPerson.relations.spouseId = targetPerson.id;
    }
    const newPeople = [...people];
    newPeople[idx] = thisPerson;
    newPeople[targetIdx] = targetPerson;
    return newPeople;
  };

  const handlePersonDrawerSave = () => {
    if (personDrawer && personDrawer._isPlaceholder) {
      setDbData(prev => {
        let updatedPeople = (prev.people || []).map(p => ({ ...p }));
        // SÄKERSTÄLL RELATIONSLÄNK
        updatedPeople = ensureRelationLink(updatedPeople, personDrawer);
        // Ta bort placeholder-flaggor
        updatedPeople = updatedPeople.map(p =>
          p.id === personDrawer.id
            ? { ...p, _isPlaceholder: false, _placeholderRelation: undefined, _placeholderTargetId: undefined, _hideUntilEdit: false }
            : p
        );
        // Bygg relations-array från people så att dbData.relations är synkad
        const relations = buildRelationsFromPeople(updatedPeople);
        return { ...prev, people: updatedPeople, relations };
      });
    }
    if (personDrawer && creationSnapshotsRef.current[personDrawer.id]) delete creationSnapshotsRef.current[personDrawer.id];
    setPersonDrawerEditContext(null);
    setIsDirty(false);
    showStatus('Person sparad.');
  };


  // Generell funktion: Säkerställ att alla föräldrar till samma barn är partners
  // Denna funktion uppdaterar ALLA berörda personer, inte bara den som sparas
  const ensureParentsArePartners = (allPeople, personId) => {
    let updatedPeople = allPeople.map(p => ({ ...p, relations: { ...p.relations } }));
    
    // Hitta alla barn som är relaterade till denna person
    // 1. Barn som personen har i sin children-lista
    const person = updatedPeople.find(p => p.id === personId);
    if (!person || !person.relations) return updatedPeople;
    
    const childrenFromChildren = (person.relations.children || []).map(c => typeof c === 'object' ? c.id : c);
    
    // 2. Barn som har personen i sin parents-lista
    const childrenFromParents = updatedPeople
      .filter(p => {
        const parents = (p.relations?.parents || []).map(par => typeof par === 'object' ? par.id : par);
        return parents.includes(personId);
      })
      .map(p => p.id);
    
    const allChildren = [...new Set([...childrenFromChildren, ...childrenFromParents])];
    
    // För varje barn, hitta alla dess föräldrar och säkerställ att de är partners
    allChildren.forEach(childId => {
      const child = updatedPeople.find(p => p.id === childId);
      if (!child) return;
      
      // Hämta alla föräldrar till barnet
      const childParentsFromChild = (child.relations?.parents || [])
        .map(p => typeof p === 'object' ? p.id : p)
        .filter(Boolean);
      
      // Hitta andra personer som har detta barn i sin children-lista
      const childParentsFromOthers = updatedPeople
        .filter(p => p.relations?.children)
        .filter(p => {
          const pChildren = (p.relations.children || []).map(c => typeof c === 'object' ? c.id : c);
          return pChildren.includes(childId);
        })
        .map(p => p.id);
      
      // Kombinera alla föräldrar
      const allParents = [...new Set([...childParentsFromChild, ...childParentsFromOthers])]
        .filter(Boolean);
      
      // Om barnet har fler än en förälder, säkerställ att alla är partners med varandra
      if (allParents.length > 1) {
        // Uppdatera VARJE förälder så att de har de andra som partners
        allParents.forEach(parentId => {
          const parentIndex = updatedPeople.findIndex(p => p.id === parentId);
          if (parentIndex === -1) return;
          
          const parent = updatedPeople[parentIndex];
          if (!parent.relations) parent.relations = {};
          if (!parent.relations.partners) parent.relations.partners = [];
          
          // Lägg till alla andra föräldrar som partners
          allParents.forEach(otherParentId => {
            if (otherParentId === parentId) return; // Skippa sig själv
            
            const otherParent = updatedPeople.find(p => p.id === otherParentId);
            if (!otherParent) return;
            
            // Kolla om de redan är partners
            const alreadyPartners = parent.relations.partners.some(p => 
              (typeof p === 'object' ? p.id : p) === otherParentId
            );
            
            if (!alreadyPartners) {
              parent.relations.partners.push({ 
                id: otherParentId, 
                name: `${otherParent.firstName || ''} ${otherParent.lastName || ''}`.trim(),
                type: 'Okänd'
              });
            }
          });
          
          updatedPeople[parentIndex] = parent;
        });
      }
    });
    
    return updatedPeople;
  };

  const patchedHandleSavePersonDetails = (person) => {
    setDbData(prev => {
      // Synka ALLA relationer tvåvägs (partners, barn, föräldrar)
      let updatedPeople = syncRelations(person, prev.people || []);
      
      // Hitta alla personer som kan ha påverkats och behöver synkas
      const affectedPersonIds = new Set([person.id]);
      
      // Lägg till alla partners från den sparade personen
      const personPartners = (person.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
      personPartners.forEach(id => affectedPersonIds.add(id));
      
      // Lägg till alla föräldrar
      const personParents = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
      personParents.forEach(id => affectedPersonIds.add(id));
      
      // Lägg till alla barn
      const personChildren = (person.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
      personChildren.forEach(id => affectedPersonIds.add(id));
      
      // Hitta alla barn som har personen som förälder
      updatedPeople
        .filter(p => {
          const parents = (p.relations?.parents || []).map(par => typeof par === 'object' ? par.id : par);
          return parents.includes(person.id);
        })
        .forEach(p => affectedPersonIds.add(p.id));
      
      // Synka alla berörda personer först
      for (let i = 0; i < 2; i++) {
        affectedPersonIds.forEach(affectedId => {
          const affectedPerson = updatedPeople.find(p => p.id === affectedId);
          if (affectedPerson) {
            updatedPeople = syncRelations(affectedPerson, updatedPeople);
          }
        });
      }
      
      // EFTER att alla personer är synkade, säkerställ att alla föräldrar till samma barn är partners
      // Detta uppdaterar ALLA berörda personer (inte bara den som sparas)
      updatedPeople = ensureParentsArePartners(updatedPeople, person.id);
      
      // Kör ensureParentsArePartners för ALLA personer som kan ha påverkats
      const allAffectedIds = new Set([person.id]);
      personParents.forEach(id => allAffectedIds.add(id));
      personChildren.forEach(id => allAffectedIds.add(id));
      updatedPeople
        .filter(p => {
          const parents = (p.relations?.parents || []).map(par => typeof par === 'object' ? par.id : par);
          return parents.includes(person.id);
        })
        .forEach(p => allAffectedIds.add(p.id));
      
      // Kör ensureParentsArePartners för alla berörda personer
      allAffectedIds.forEach(affectedId => {
        updatedPeople = ensureParentsArePartners(updatedPeople, affectedId);
      });
      
      // Nu när partner-relationer har lagts till, synka alla personer igen
      // Hitta alla personer som kan ha fått nya partner-relationer
      const allPersonIdsToSync = new Set();
      updatedPeople.forEach(p => {
        allPersonIdsToSync.add(p.id);
        if (p.relations?.partners) {
          const partners = (p.relations.partners || []).map(par => typeof par === 'object' ? par.id : par);
          partners.forEach(partnerId => allPersonIdsToSync.add(partnerId));
        }
      });
      
      // Synka alla personer igen för att säkerställa tvåvägs-relationer
      for (let i = 0; i < 2; i++) {
        allPersonIdsToSync.forEach(personId => {
          const personToSync = updatedPeople.find(p => p.id === personId);
          if (personToSync) {
            updatedPeople = syncRelations(personToSync, updatedPeople);
          }
        });
      }
      
      // Bygg relations-array från people så att dbData.relations är synkad
      const relations = buildRelationsFromPeople(updatedPeople);
      return { ...prev, people: updatedPeople, relations };
    });
    setIsDirty(true);
    showStatus('Person sparad.');
    handleCloseEditModalSafe();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      
      // WindowFrame hanterar ESC själv - om det finns en WindowFrame öppen, gör ingenting här
      // editingPerson, linkPersonModal, och källkatalog använder WindowFrame
      
      if (isSourceDrawerOpen) { e.preventDefault(); e.stopPropagation(); forceCloseSourceModal(); return; }
      if (isPlaceDrawerOpen && !placeDrawerLocked) { e.preventDefault(); e.stopPropagation(); handleTogglePlaceDrawer(placeCatalogState.selectedPlaceId); return; }
      if (personDrawer && !personDrawerLocked) { closePersonDrawer(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [isSourceDrawerOpen, isPlaceDrawerOpen, personDrawer, personDrawerLocked]); 

  useEffect(() => {
    const handler = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.modal-content') || e.target.closest('[role="dialog"]')) return;
      if (!personDrawer) return;
      const drawerEl = document.querySelector('.drawer-inner'); if (drawerEl && drawerEl.contains(e.target)) return;
      const treeEl = document.querySelector('[data-family-tree="1"]'); if (treeEl && treeEl.contains(e.target)) return;
      cancelPersonCreation(personDrawer.id);
    };
    window.addEventListener('mousedown', handler, true); return () => window.removeEventListener('mousedown', handler, true);
  }, [personDrawer]);

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, targetPersonId: null });
  const showContextMenu = (personOrId, x, y) => { const id = personOrId && typeof personOrId === 'object' ? personOrId.id : personOrId; setContextMenu({ visible: true, x, y, targetPersonId: id }); };
  const hideContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, targetPersonId: null });
  const [personDrawerEditContext, setPersonDrawerEditContext] = useState(null); 

  const createPersonAndLink = (targetId, relation) => {
    const maxRef = dbData.people.reduce((max, p) => p.refNumber > max ? p.refNumber : max, 0);
    const newPerson = { id: `p_${Date.now()}`, refNumber: maxRef + 1, firstName: '', lastName: '', gender: '', events: [], notes: '', links: {}, relations: { parents: [], children: [], spouseId: null } };
    newPerson.firstName = ''; newPerson._hideUntilEdit = true; newPerson._isPlaceholder = true; newPerson._placeholderRelation = relation;
    if (relation === 'spouse' || relation === 'partner') newPerson._placeholderSide = 'left'; else if (relation === 'sibling') newPerson._placeholderSide = 'right'; else if (relation === 'parent') newPerson._placeholderSide = 'above'; else if (relation === 'child') newPerson._placeholderSide = 'below';
    newPerson._placeholderTargetId = targetId;

    setDbData(prev => {
      creationSnapshotsRef.current[newPerson.id] = { dbData: prev, prevFocus: familyTreeFocusPersonId };
      const alreadyHas = (prev.people || []).some(p => p.id === newPerson.id);
      let updatedPeople = alreadyHas ? [...prev.people] : [...(prev.people || []), newPerson];
      
      const targetIndex = updatedPeople.findIndex(p => p.id === targetId);
      const newPersonIndex = updatedPeople.findIndex(p => p.id === newPerson.id);

      if (targetIndex !== -1 && newPersonIndex !== -1) {
        const targetPerson = { ...updatedPeople[targetIndex] };
        const updatedNewPerson = { ...updatedPeople[newPersonIndex] };
        
        targetPerson.relations = targetPerson.relations || { parents: [], children: [], spouseId: null };
        updatedNewPerson.relations = updatedNewPerson.relations || { parents: [], children: [], spouseId: null };
        
        // KORRIGERAD LOGIK: Spara relationen direkt
        if (relation === 'parent') { 
          if (!targetPerson.relations.parents.includes(newPerson.id)) {
            targetPerson.relations.parents = [...targetPerson.relations.parents, newPerson.id];
          }
          if (!updatedNewPerson.relations.children.includes(targetId)) {
            updatedNewPerson.relations.children = [...updatedNewPerson.relations.children, targetId];
          }
        } 
        else if (relation === 'child') { 
          if (!targetPerson.relations.children.includes(newPerson.id)) {
            targetPerson.relations.children.push(newPerson.id);
          }
          if (!updatedNewPerson.relations.parents.includes(targetId)) {
            updatedNewPerson.relations.parents.push(targetId);
          }
        } 
        else if (relation === 'spouse') {
             targetPerson.relations.spouseId = newPerson.id;
             updatedNewPerson.relations.spouseId = targetId;
        }

        updatedPeople[targetIndex] = targetPerson;
        updatedPeople[newPersonIndex] = updatedNewPerson;
      }

      showStatus(`Ny person (REF ${newPerson.refNumber}) skapad. Öppnar för redigering...`);
      const unique = []; const seen = new Set(); (updatedPeople || []).forEach(pp => { if (!seen.has(pp.id)) { seen.add(pp.id); unique.push(pp); } });
      return { ...prev, people: unique };
    });
    setIsDirty(true); hideContextMenu();
    setNewPersonToEditId(newPerson.id); // <-- Trigga useEffect för att öppna modal
    setFamilyTreeFocusPersonId(targetId); // Behåll fokus på den URSPRUNGLIGA personen
  };

  const canGoBack = (historyState?.past?.length || 0) > 0;
  const canGoForward = (historyState?.future?.length || 0) > 0;
  const handleOpenSourceInDrawer = (sourceId, personId = null, eventId = null) => { handleToggleSourceDrawer(personId, eventId); };
  const onLocalTabChange = (tab) => { handleTabChange(tab); if (tab !== 'familyTree') { if (personDrawer) { setPersonDrawerId(null); setPersonDrawerLocked(false); } if (isSourceDrawerOpen) forceCloseSourceModal(); if (isPlaceDrawerOpen) handleTogglePlaceDrawer(placeCatalogState?.selectedPlaceId); } };

  useEffect(() => {
    const handler = (e) => {
      const detail = (e && e.detail) || {}; const { placeId, eventId } = detail; if (!placeId || !eventId) return;
      if (window.__WFT_lastUnlink && window.__WFT_lastUnlink.placeId === placeId && window.__WFT_lastUnlink.eventId === eventId && (Date.now() - window.__WFT_lastUnlink.ts) < 1000) return;
      let newDbResult = null;
      setDbData(prev => {
        const updated = { ...prev, people: (prev.people || []).map(p => ({ ...p, events: (p.events || []).map(ev => (ev.id === eventId && ev.placeId === placeId) ? { ...ev, placeId: null, place: '' } : ev) })) };
        newDbResult = updated; return updated;
      });
      setIsDirty(true); showStatus('Koppling borttagen.'); window.__WFT_lastUnlink = { placeId, eventId, ts: Date.now() };
      try { if (newDbResult) { if (editingPerson && editingPerson.id) { const updatedPerson = newDbResult.people.find(p => p.id === editingPerson.id); if (updatedPerson) { handleEditFormChange(updatedPerson); } } if (personDrawer && personDrawer.id) { const updatedDrawerPerson = newDbResult.people.find(p => p.id === personDrawer.id); if (updatedDrawerPerson) { handleEditFormChange(updatedDrawerPerson); } } } } catch (err) { }
    };
    window.addEventListener('WFT:unlinkPlaceFromEvent', handler); return () => window.removeEventListener('WFT:unlinkPlaceFromEvent', handler);
  }, []);

  const handleExportZip = async () => { try { if (window.electronAPI) showStatus('Export påbörjad... (inte implementerad i denna build)'); else showStatus('Export ej tillgänglig i webbläsarläge.'); } catch (err) { showStatus('Export misslyckades.'); } };
  const handleImportZip = async () => { try { showStatus('Import inte implementerad i denna version.'); } catch (err) { showStatus('Import misslyckades.'); } };
  const chooseAuditBackupDir = async () => { try { const apiAvailable = !!window.electronAPI && typeof window.electronAPI.openFileDialog === 'function'; const altAvailable = !!window.electron && typeof window.electron.openFileDialog === 'function'; if (!apiAvailable && !altAvailable) { showStatus('Fil-dialog inte tillgänglig.'); return; } const res = apiAvailable ? await window.electronAPI.openFileDialog({ properties: ['openDirectory'] }) : await window.electron.openFileDialog({ properties: ['openDirectory'] }); if (!res) return; const filePaths = Array.isArray(res) ? res : res.filePaths || []; if (res.canceled) return; if (!filePaths || filePaths.length === 0) return; const chosen = filePaths[0]; setAuditBackupDirState(chosen); showStatus(`Vald backup-mapp: ${chosen}`); } catch (err) { showStatus('Fel vid val av mapp.'); } };

  return ( 
    <div className="h-screen flex flex-col" style={{ overflow: 'hidden' }}>
      {/* TOP MENUBAR */}
      <div className="menubar shadow-md shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-bold tracking-wide mr-2">
            WestFamilyTree{fileHandle && fileHandle.name ? ` – [${fileHandle.name}]` : ''}
          </h1>
          <Button onClick={handleBack} disabled={!canGoBack} variant="secondary" size="sm" className={!canGoBack ? 'opacity-50' : ''}>←</Button>
          <Button onClick={handleForward} disabled={!canGoForward} variant="secondary" size="sm" className={!canGoForward ? 'opacity-50' : ''}>→</Button>
          <Button onClick={() => Promise.resolve(handleNewFile()).then(resetUiState)} variant="secondary" size="sm">Ny</Button>
          <Button onClick={handleOpenFile} variant="secondary" size="sm">Öppna fil...</Button>
          <Button onClick={() => window.close()} variant="primary" size="sm">Stäng</Button>
          <Button onClick={() => window.close()} variant="secondary" size="sm">Stäng</Button>
          <Button onClick={() => setShowSettings(true)} variant="secondary" size="sm">Inställningar</Button>
          <Button onClick={() => setIsMergeModalOpen(true)} variant="secondary" size="sm">Slå ihop</Button>
          <Button onClick={() => setIsMergesPanelOpen(true)} variant="secondary" size="sm">Merges</Button>
          <Button onClick={() => setIsGedcomImporterOpen(true)} variant="secondary" size="sm">GEDCOM import</Button>
        </div>
        <div className="text-xs text-slate-400"><span>{fileHandle ? `Öppen fil: ${fileHandle.name}` : 'Ny namnlös databas'}</span></div>
      </div>
      
      {/* SETTINGS MODAL */}
      {showSettings && (<div className="modal" style={{display: 'block'}}><div className="modal-content card bg-slate-800 border border-slate-700 p-8 max-w-2xl"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-slate-200">Inställningar</h2><button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-300 text-2xl">&times;</button></div><div><div className="text-slate-400 mb-4"><div className="mb-2">Audit-backup-mapp (valfritt):</div><div className="flex items-center gap-2"><input type="text" value={auditBackupDir} onChange={(e) => setAuditBackupDirState(e.target.value)} placeholder="Sökväg till mapp eller lämna tomt för standard" className="flex-1 border rounded px-2 py-1" /><Button onClick={chooseAuditBackupDir} variant="secondary" size="sm">Välj...</Button><Button onClick={() => setAuditBackupDirState('')} variant="danger" size="sm">Rensa</Button></div></div><div className="flex flex-col gap-2 mt-8"><div className="flex gap-2 justify-end"><Button onClick={handleExportZip} variant="primary" size="sm">Exportera allt som zip</Button><Button onClick={handleImportZip} variant="secondary" size="sm">Importera zip-backup</Button><Button onClick={() => setShowRelationSettings(true)} variant="secondary" size="sm">Relationsinställningar</Button><Button onClick={() => { setAuditBackupDir(auditBackupDir); setShowSettings(false); showStatus('Inställningar sparade.'); }} variant="success" size="sm">Stäng</Button></div>{showRelationSettings && (<div className="mt-4 p-4 border border-slate-700 rounded bg-slate-900"><RelationSettings inline={true} onClose={() => setShowRelationSettings(false)} /></div>)}{ ((personDrawer && personDrawer._isPlaceholder) || (personDrawerEditContext && personDrawer && personDrawerEditContext.id === personDrawer.id)) && (<div className="p-3 border-t border-slate-700 bg-slate-800 flex justify-end gap-2"><Button onClick={() => cancelPersonCreation(personDrawer.id)} variant="danger" size="sm">Avbryt</Button><Button onClick={handlePersonDrawerSave} variant="success" size="sm">Stäng ändringar</Button></div>)}</div></div></div></div>)}
      
      {/* OTHER MODALS */}
      {isMergeModalOpen && <MergeModal isOpen={isMergeModalOpen} onClose={(mergeId) => { setIsMergeModalOpen(false); if (mergeId) showStatus(`Merge klart (${mergeId})`); }} />}
      {isMergesPanelOpen && <MergesPanel isOpen={isMergesPanelOpen} onClose={() => setIsMergesPanelOpen(false)} />}
      {showDuplicateMerge && <DuplicateMergePanel allPeople={dbData.people || []} initialPair={mergeInitialPair} onClose={() => { setShowDuplicateMerge(false); setMergeInitialPair(null); }} />}
      
      {/* NY MODAL: Koppla Person */}
      <LinkPersonModal isOpen={linkPersonModal.isOpen} onClose={() => setLinkPersonModal({ isOpen: false, preSelectedPersonId: null })} people={visiblePeople} onLink={handleLinkSourceToPerson} initialPersonId={linkPersonModal.preSelectedPersonId} zIndex={isSourceDrawerOpen ? 10100 : 5100} />

      {isHistoryOpen && (<div className="modal" style={{display: 'block'}} onClick={handleShowHistory}><div className="modal-content card bg-slate-800 border border-slate-700 p-4 max-w-md" onClick={(e) => e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-200">Historik</h3><button onClick={handleShowHistory} className="text-slate-400 hover:text-slate-300 text-2xl">&times;</button></div><div className="text-sm text-slate-300 max-h-64 overflow-y-auto"><ul className="space-y-2">{historyState.past.map((h, idx) => (<li key={idx} onClick={() => applyHistoryEntry(h)} className="p-2 border border-slate-700 rounded hover:bg-slate-700 cursor-pointer"><div className="font-semibold">Flik: <b>{h.tab}</b></div></li>))}</ul></div></div></div>)}

      <div className="status-bar shrink-0"><span>{isDirty ? 'Redo med osparade ändringar' : 'Redo'}</span>{isDirty && <span className="text-amber-600 font-bold">● Osparade ändringar</span>}</div>

      <div id="app" className="flex-grow p-6 flex flex-col bg-slate-900 overflow-hidden min-h-0">
        <div className="w-full mb-4 border-b border-slate-700 bg-slate-900 shrink-0">
          <nav className="-mb-px flex space-x-2 md:space-x-4 lg:space-x-8">
            {/* Tab config: (Oförändrad) */}
            {[
              {
                label: 'Personregister',
                value: 'people',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ),
              },
              {
                label: 'Källkatalog',
                value: 'sources',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0H3m9 0h9" /></svg>
                ),
              },
              {
                label: 'Platsregister',
                value: 'places',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c-4 0-7 2.239-7 5v3h14v-3c0-2.761-3-5-7-5z" /></svg>
                ),
              },
              {
                label: 'Släktträd',
                value: 'familyTree',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 21V9a6 6 0 1112 0v12" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 21h12" /></svg>
                ),
              },
              {
                label: 'Verktyg',
                value: 'tools',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                ),
              },
              {
                label: 'Gårdsarkivet',
                value: 'farmArchive',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 010 7.75" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 3.13a4 4 0 010 7.75" /></svg>
                ),
              },
              {
                label: 'Orphan-arkivet',
                value: 'orphanArchive',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" /></svg>
                ),
              },
              {
                label: 'Audit',
                value: 'audit',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" /></svg>
                ),
                badge: null // Example: could be a count or warning
              },
              {
                label: 'Media',
                value: 'media',
                icon: (
                  <svg className="w-5 h-5 mr-1 inline-block align-text-bottom" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" /></svg>
                ),
              },
            ].map(tab => (
              <button
                key={tab.value}
                onClick={() => onLocalTabChange(tab.value)}
                className={`whitespace-nowrap py-2 px-2 md:px-3 border-b-2 font-medium text-sm tab-btn flex items-center gap-1 relative transition-colors duration-150
                  ${activeTab === tab.value ? 'border-blue-500 text-white bg-slate-700 rounded-t' : 'border-transparent text-white hover:bg-slate-800'}`}
                style={{ minWidth: 0 }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">{tab.badge}</span>
                ) : null}
                {activeTab === tab.value && (
                  <span className="absolute left-0 right-0 -bottom-1 h-1 bg-blue-200 rounded-b" style={{ zIndex: 1 }}></span>
                )}
              </button>
            ))}
          </nav>
        </div>


        <div className={`flex-grow min-h-0 ${editingPerson ? 'flex gap-4' : ''}`}>
          {/* Visa personregistret som fallback om activeTab är null/undefined eller 'people' */}
          {(!activeTab || activeTab === 'people') && (
            <div className="tab-content max-w-6xl mx-auto w-full">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <PersonAddForm newFirstName={newFirstName} setNewFirstName={setNewFirstName} newLastName={newLastName} setNewLastName={setNewLastName} onAddPerson={handleAddPerson} />
                <div className="flex items-center justify-between w-full mb-2"><div /><div className="flex items-center gap-3"><label className="text-sm text-slate-400 flex items-center gap-2"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /><span className="select-none">Visa arkiverade</span></label></div></div>
                <PersonList people={visiblePeople} onOpenEditModal={handleOpenEditModal} onOpenRelationModal={handleViewInFamilyTree} onDeletePerson={handleDeletePerson} focusPair={focusPair} onSetFocusPair={handleSetFocusPair} bookmarks={bookmarks} />
                <div className="lg:col-span-1"><SuggestionsPanel allPeople={visiblePeople} onOpenPair={(pair) => { setMergeInitialPair(pair); setShowDuplicateMerge(true); }} /></div>
              </div>
            </div>
          )}

          {activeTab === 'orphanArchive' && (<OrphanArchiveView people={dbData.people || []} allSources={dbData.sources || []} onOpenPerson={handleOpenEditModal} onViewInFamilyTree={handleViewInFamilyTree} />)}
          {activeTab === 'audit' && ( <AuditPanel /> )}
          {activeTab === 'media' && ( 
            <MediaManager 
              allPeople={visiblePeople} 
              onOpenEditModal={handleOpenEditModal}
              mediaItems={dbData.media || []}
              onUpdateMedia={(updatedMedia) => {
                setDbData(prev => ({ ...prev, media: updatedMedia }));
                setIsDirty(true);
              }}
              setIsSourceDrawerOpen={openSourceDrawerForSelection}
              setIsPlaceDrawerOpen={openPlaceDrawerForSelection}
            /> 
          )}

          {activeTab === 'tools' && (
            <div className="tab-content flex items-center justify-center h-full">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsOAIHarvesterOpen(true)}
                className="flex items-center gap-3 px-8 py-4 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                OAI-PMH arkivharvester
              </Button>
            </div>
          )}

          {/* STANDARDVISNING AV KÄLLKATALOG (EJ EDIT) */}

          {activeTab === 'sources' && (
            <SourceCatalog
              sources={dbData.sources || []}
              people={visiblePeople}
              places={dbData.places || []}
              onDeleteSource={handleDeleteSource}
              onEditSource={handleSaveEditedSource}
              catalogState={sourceCatalogState}
              setCatalogState={setSourceCatalogState}
              onCreateNewPerson={handleCreateAndEditPerson}
              onOpenEditModal={handleOpenEditModal}
              onNavigateToPlace={handleNavigateToPlace}
              onAddSource={handleAddSource}
              onOpenLinkPersonModal={handleOpenLinkPersonModal}
              onUnlinkSourceFromEvent={handleUnlinkSourceFromPerson}
            />
          )}

          {activeTab === 'places' && (
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
                const updatedPeople = (dbData.people || []).map(p => ({ ...p, events: (p.events || []).map(ev => (ev.id === eventId && ev.placeId === placeId) ? { ...ev, placeId: null, place: '' } : ev) }));
                const newDb = { ...dbData, people: updatedPeople };
                setDbData(newDb); setIsDirty(true); showStatus('Koppling borttagen.');
              }}
            />
          )}

          {/* HÄR VISAS SLÄKTTRÄDET ÄVEN NÄR EDITINGPERSON ÄR TRUE */}
          {activeTab === 'familyTree' && (<FamilyTreeView allPeople={visiblePeople} focusPersonId={familyTreeFocusPersonId} onSetFocus={(personId) => setFamilyTreeFocusPersonId(personId)} onOpenEditModal={handleOpenEditModal} onOpenPersonDrawer={openPersonDrawer} onSave={handleSaveRelations} onCreatePersonAndLink={createPersonAndLink} onOpenContextMenu={showContextMenu} onDeletePerson={handleDeletePerson} highlightPlaceholderId={personDrawerEditContext?.id || (personDrawer && personDrawer._isPlaceholder ? personDrawer.id : null)} onRequestOpenDuplicateMerge={() => setShowDuplicateMerge(true)} />)}
          
          {activeTab === 'farmArchive' && (<FarmArchiveView places={dbData.places || []} people={visiblePeople} allSources={dbData.sources || []} onSavePlace={handleSavePlace} onOpenPerson={handleOpenEditModal} onViewInFamilyTree={handleViewInFamilyTree} onNavigateToSource={handleNavigateToSource} onOpenSourceDrawer={handleToggleSourceDrawer} onNavigateToPlace={handleNavigateToPlace} onOpenPlaceDrawer={handleTogglePlaceDrawer} onOpenSourceInDrawer={handleOpenSourceInDrawer} />)}

          {/* EDITING PERSON (MODAL) */}
          {editingPerson && (
            <WindowFrame
              title={`Redigera ${editingPerson.firstName || ''} ${editingPerson.lastName || ''}`}
              onClose={handleCloseEditModalSafe}
              initialWidth={1200}
              initialHeight={800}
            >
              <EditPersonModal
                person={editingPerson}
                onClose={handleCloseEditModalSafe}
                onSave={patchedHandleSavePersonDetails}
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
            </WindowFrame>
          )}
        </div>
      </div>

      {/* ====================================================== */}
      {/* FLYTTBAR KÄLLKATALOG (MODAL) */}
      {/* ====================================================== */}
      
      {isSourceDrawerOpen && (
        <WindowFrame
          title="Källkatalog"
          onClose={forceCloseSourceModal}
          initialWidth={1100}
          initialHeight={700}
          zIndex={9999}
        >
          <SourceCatalog
            sources={dbData.sources || []}
            people={visiblePeople}
            places={dbData.places || []}
            onDeleteSource={handleDeleteSource}
            onEditSource={handleSaveEditedSource}
            catalogState={sourceCatalogState}
            setCatalogState={setSourceCatalogState}
            onCreateNewPerson={handleCreateAndEditPerson}
            onOpenEditModal={handleOpenEditModal}
            isDrawerMode={true}
            onLinkSource={linkingMediaInfo ? handleLinkSourceToMedia : handleLinkSourceFromDrawer}
            onUnlinkSource={handleUnlinkSourceFromDrawer}
            sourcingEventInfo={sourcingEventInfo}
            alreadyLinkedIds={alreadyLinkedIds}
            onAddSource={handleAddSource} 
            onOpenLinkPersonModal={handleOpenLinkPersonModal} 
            onUnlinkSourceFromEvent={handleUnlinkSourceFromPerson}
          />
        </WindowFrame>
      )}

      {/* ====================================================== */}
      {/* FLYTTBAR PLATSKATALOG (MODAL) */}
      {/* ====================================================== */}
      
      {isPlaceDrawerOpen && (
        <WindowFrame
          title="Platsregister"
          onClose={() => handleTogglePlaceDrawer(placeCatalogState?.selectedPlaceId)}
          initialWidth={1100}
          initialHeight={700}
          zIndex={9998}
        >
          <PlaceCatalog
            catalogState={placeCatalogState}
            setCatalogState={setPlaceCatalogState}
            isDrawerMode={!!linkingMediaInfo}
            onLinkPlace={handleLinkPlaceToMedia}
          />
        </WindowFrame>
      )}

      {/* Övriga modaler */}
      <UndoToast isVisible={undoState.isVisible} message={undoState.message} onUndo={handleUndo} duration={10000} />
      <StatusToast isVisible={statusToast.isVisible} message={statusToast.message} severity={statusToast.severity} />
      <ValidationWarningsModal isOpen={bulkWarningsModal?.isOpen} warnings={bulkWarningsModal?.warnings || []} onClose={() => { try { closeBulkWarningsModal(); } catch (e) {} }} />

      {isAttachingSource && <AttachSourceModal allSources={dbData.sources || []} allPeople={visiblePeople} onAttach={handleAttachSources} onCreateNew={handleSwitchToCreateSource} onClose={handleCloseSourceModal} onEditSource={(sourceId) => handleNavigateToSource(sourceId)} />}

      {isOAIHarvesterOpen && (
        <OAIArchiveHarvesterModal
          onClose={() => setIsOAIHarvesterOpen(false)}
          onImportSources={(sources) => {
            setDbData(prev => ({
              ...prev,
              sources: [...(prev.sources || []), ...sources]
            }));
            setIsOAIHarvesterOpen(false);
            setIsDirty(true);
            showStatus(`${sources.length} kilder importerade från OAI-PMH`);
            
            // Öppna SourceCatalog modal med fokus på första källan
            if (sources.length > 0) {
              setSourceCatalogState(prev => ({
                ...prev,
                selectedSourceId: sources[0].id,
                searchTerm: '',
                expanded: { ...prev.expanded, 'Övrigt': true }
              }));
              handleToggleSourceDrawer();
              // Spara automatiskt bara om en fil redan är öppnad (ingen dialog)
              if (fileHandle) {
                handleSaveFile();
              }
            }
          }}
        />
      )}

      {isGedcomImporterOpen && (
        <div className="modal" style={{display: 'block', zIndex: 3000}}>
          <div className="modal-content card bg-slate-800 border border-slate-700 shadow-2xl rounded-xl max-w-5xl">
            <div className="flex justify-between items-center border-b border-slate-700 p-4 bg-slate-700 rounded-t-xl">
              <h3 className="text-lg font-bold text-slate-200">Importera GEDCOM (NY)</h3>
              <button onClick={() => setIsGedcomImporterOpen(false)} className="text-slate-400 hover:text-slate-300 text-2xl\">&times;</button>
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

                  // Ensure all people have a relations field
                  const peopleWithRelations = Array.from(peopleMap.values()).map(p => {
                    if (!p.relations) {
                      return { ...p, relations: { parents: [], children: [], spouseId: null } };
                    }
                    // If relations exists, ensure all keys are present
                    return {
                      ...p,
                      relations: {
                        parents: Array.isArray(p.relations.parents) ? p.relations.parents : [],
                        children: Array.isArray(p.relations.children) ? p.relations.children : [],
                        spouseId: typeof p.relations.spouseId !== 'undefined' ? p.relations.spouseId : null
                      }
                    };
                  });

                  return {
                    ...prev,
                    people: peopleWithRelations,
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
    </div>
  )
}

export default App;