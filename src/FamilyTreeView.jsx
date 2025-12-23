import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Edit2, User, Heart, Network, HeartCrack, PlusCircle, Trash2, Users,
  Copy, Plus, Minus, Home, Search, ArrowLeft, ArrowRight, AlertTriangle,
  List, X, MapPin, Star, Baby, UserPlus, GitFork, Bookmark, Maximize2, Minimize2, Settings,
  Link as LinkIcon, Layers, HeartHandshake, HelpCircle, ArrowUpCircle, RefreshCcw
} from 'lucide-react';
import WindowFrame from './WindowFrame.jsx';
import Button from './Button.jsx';
import SelectFatherModal from './SelectFatherModal.jsx';
import { useApp } from './AppContext';
import MediaImage from './components/MediaImage.jsx';

// --- HJÄLPFUNKTIONER ---
const calculateAge = (birthDate, deathDate) => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  const age = end.getFullYear() - birth.getFullYear();
  return age;
};

const calculateStatus = (person, birthDate, deathDate) => {
  if (deathDate) return 'Avliden';
  if (!birthDate) return 'Okänd';
  return 'Levande';
};

const getLifeSpan = (p) => {
  const getYear = (type) => {
    const evt = p.events?.find(e => e.type === type || e.type === (type === 'BIRT' ? 'Födelse' : 'Död'));
    return evt?.date ? evt.date.substring(0, 4) : '';
  };
  const b = getYear('BIRT');
  const d = getYear('DEAT');
  if (!b && !d) return '';
  return `(${b}-${d})`;
};

const convertPersonForDisplay = (person) => {
  if (!person) return null;

  const birthEvent = person.events?.find(e => e.type === 'BIRT' || e.type === 'Födelse');
  const deathEvent = person.events?.find(e => e.type === 'DEAT' || e.type === 'Död');

  const birthDate = birthEvent?.date || '';
  const deathDate = deathEvent?.date || '';
  const age = calculateAge(birthDate, deathDate);
  const status = calculateStatus(person, birthDate, deathDate);
  const childrenCount = (person.relations?.children || []).length;

  const occupationEvents = (person.events || []).filter(e => e.type === 'Yrke' || e.type === 'OCCU');
  const occupations = occupationEvents
    .map(e => {
      const notes = e.notes ? e.notes.replace(/<[^>]*>/g, '').trim() : '';
      return notes;
    })
    .filter(occ => occ && occ.length > 0);

  return {
    id: person.id,
    name: `${person.firstName || 'Okänd'} ${person.lastName || ''}`.trim(),
    firstName: person.firstName || 'Okänd',
    lastName: person.lastName || '',
    gender: person.sex === 'M' ? 'male' : person.sex === 'K' ? 'female' : 'unknown',
    sex: person.sex,
    birthDate: birthDate,
    birthPlace: birthEvent?.place || '',
    birthYear: birthDate ? parseInt(birthDate.substring(0, 4)) || 9999 : 9999,
    deathDate: deathDate,
    deathPlace: deathEvent?.place || '',
    age: age,
    status: status,
    img: person.media?.find(m => m.isProfilePicture)?.url || person.media?.[0]?.url || null,
    occupations: occupations,
    childrenCount: childrenCount,
    relations: person.relations || {},
    events: person.events || [],
    media: person.media || []
  };
};

// ============================================================================
// KONFIGURATION & STYLING
// ============================================================================
const CONFIG = {
  CARD_WIDTH: 150,
  CARD_HEIGHT: 160,
  GAP_X: 40,         // Mellanrum sidled (syskon)
  GAP_Y: 180,        // Mellanrum höjdled
  INDENT_X: 60,      // Hur långt till höger barnen hamnar under partnern
  STEP_Y: 180,       // Höjd per "rad" i partner-listan
};

const STYLES = `
  .vt-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
  }
  .vt-header {
    background: #1e293b;
    padding: 1rem 2rem;
    border-bottom: 1px solid #334155;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 20;
  }
  .vt-canvas {
    flex: 1;
    overflow: hidden;
    position: relative;
    padding: 4rem;
    cursor: grab;
    background-color: #0f172a;
  }
  .vt-canvas.dragging { cursor: grabbing; }

  /* KORT DESIGN */
  .vt-card {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 0.5rem;
    gap: 0.5rem;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    width: ${CONFIG.CARD_WIDTH}px;
    height: ${CONFIG.CARD_HEIGHT}px;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 10;
  }
  .vt-card:hover {
    border-color: #475569;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    transform: translateY(-2px);
    z-index: 50;
  }
  
  /* Könsfärger */
  .vt-card.male { 
    background: #1e3a5f;
    border-left: 4px solid #3b82f6; 
  }
  .vt-card.male:hover {
    background: #1e40af;
  }
  
  .vt-card.female { 
    background: #4a1942;
    border-left: 4px solid #ec4899; 
  }
  .vt-card.female:hover {
    background: #831843;
  }
  
  /* Fokusperson - mörkare för att sticka ut */
  .vt-card.focus { 
    border: 2px solid #fbbf24;
    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3);
  }
  .vt-card.focus.male {
    background: #1e40af;
  }
  .vt-card.focus.female {
    background: #831843;
  }
  .vt-card.focus:not(.male):not(.female) {
    background: #334155;
  }
  
  .vt-card.partner, .vt-card.stepparent {
    border-style: dashed;
  }

  .vt-deceased-marker {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 18px;
    color: #e2e8f0;
    opacity: 0.9;
    z-index: 1;
    text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  }
  
  .vt-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #334155;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    flex-shrink: 0;
    border: 2px solid #475569;
  }
  .vt-info { 
    display: flex; 
    flex-direction: column; 
    overflow: hidden; 
    gap: 1px;
    flex: 1;
    width: 100%;
    text-align: center;
    align-items: center;
  }
  .vt-name { 
    font-weight: 600; 
    font-size: 12px; 
    color: #e2e8f0; 
    white-space: nowrap; 
    overflow: hidden; 
    text-overflow: ellipsis; 
    width: 100%;
  }
  .vt-detail { 
    font-size: 9px; 
    color: #e2e8f0; 
    line-height: 1.4;
    white-space: nowrap; 
    overflow: hidden; 
    text-overflow: ellipsis;
    width: 100%;
    text-align: left;
    padding-left: 0.25rem;
  }
`;

// ============================================================================
// LOGIK: TRAJLIKNANDE LAYOUT (STEP-LAYOUT)
// ============================================================================

function calculateVerticalLayout(db, focusId) {
  const nodes = [];
  const edges = [];

  const focusPerson = db.persons.find(p => p.id === focusId);
  if (!focusPerson) return { nodes: [], edges: [], width: 0, height: 0 };

  // --------------------------------------------------------------------------
  // 1. DATAINSAMLING GEN 1 (Föräldrar + Styvföräldrar)
  // --------------------------------------------------------------------------

  const parentRels = db.parent_child.filter(pc => pc.child_id === focusId);
  const parents = parentRels.map(rel => db.persons.find(p => p.id === rel.parent_id)).filter(Boolean);
  parents.sort((a, b) => (a.gender === 'male' ? -1 : 1));

  // --------------------------------------------------------------------------
  // 2. DATAINSAMLING GEN 2 (Syskon & Halvsyskon)
  // --------------------------------------------------------------------------

  const siblingIds = new Set();
  parents.forEach(parent => {
    const children = db.parent_child.filter(pc => pc.parent_id === parent.id).map(pc => pc.child_id);
    children.forEach(id => {
      if (id !== focusId) siblingIds.add(id);
    });
  });

  const siblings = Array.from(siblingIds).map(id => db.persons.find(p => p.id === id));
  siblings.sort((a, b) => a.birthYear - b.birthYear);

  const olderSiblings = siblings.filter(s => s.birthYear < focusPerson.birthYear);
  const youngerSiblings = siblings.filter(s => s.birthYear > focusPerson.birthYear);

  // --------------------------------------------------------------------------
  // 3. PLACERING (X/Y)
  // --------------------------------------------------------------------------

  const startX = 600;
  const startY = 300;

  // --- A. PLACERA JIMMY (FOKUS) ---
  nodes.push({ ...focusPerson, x: startX, y: startY, type: 'focus' });

  // --- B. PLACERA SYSKON (SIDLED) ---
  // Gruppera syskon baserat på föräldrar för att placera dem på "rätt" sida
  // Vänster = Pappas barn (som inte är mammas)
  // Höger = Mammas barn (som inte är pappas)
  // Mitten = Gemensamma barn (Fullsyskon)

  const dad = parents.find(p => p.gender === 'male') || parents[0];
  const mom = parents.find(p => p.gender === 'female') || parents[1];

  const leftSiblings = [];
  const rightSiblings = [];
  const fullSiblings = [];

  siblings.forEach(sib => {
    const sibParents = db.parent_child.filter(pc => pc.child_id === sib.id).map(pc => pc.parent_id);
    const hasDad = dad && sibParents.includes(dad.id);
    const hasMom = mom && sibParents.includes(mom.id);

    if (hasDad && !hasMom) {
      leftSiblings.push(sib);
    } else if (hasMom && !hasDad) {
      rightSiblings.push(sib);
    } else {
      fullSiblings.push(sib);
    }
  });

  // Sortera varje grupp efter ålder
  leftSiblings.sort((a, b) => a.birthYear - b.birthYear);
  rightSiblings.sort((a, b) => a.birthYear - b.birthYear);
  fullSiblings.sort((a, b) => a.birthYear - b.birthYear);

  // Dela upp fullsyskon i äldre/yngre än fokus
  const olderFullSibs = fullSiblings.filter(s => s.birthYear < focusPerson.birthYear);
  const youngerFullSibs = fullSiblings.filter(s => s.birthYear > focusPerson.birthYear);

  // Placera VÄNSTER-sidan: Först Halvsyskon (äldst längst ut?), sen Äldre Fullsyskon
  // Vi vill ha: [Dad's Only] ... [Older Full] ... [FOCUS] ... [Younger Full] ... [Mom's Only]

  let leftCursor = startX - (CONFIG.CARD_WIDTH + CONFIG.GAP_X);

  // 1. Äldre Fullsyskon (närmast fokus på vänster sida)
  olderFullSibs.reverse().forEach(sib => {
    nodes.push({ ...sib, x: leftCursor, y: startY, type: 'sibling' });
    leftCursor -= (CONFIG.CARD_WIDTH + CONFIG.GAP_X);
  });

  // 2. Halvsyskon på pappas sida (längre åt vänster)
  leftSiblings.reverse().forEach(sib => {
    nodes.push({ ...sib, x: leftCursor, y: startY, type: 'sibling-left' });
    leftCursor -= (CONFIG.CARD_WIDTH + CONFIG.GAP_X);
  });

  // Placera HÖGER-sidan
  let rightCursor = startX + (CONFIG.CARD_WIDTH + CONFIG.GAP_X);

  // 1. Yngre Fullsyskon (närmast fokus på höger sida)
  youngerFullSibs.forEach(sib => {
    nodes.push({ ...sib, x: rightCursor, y: startY, type: 'sibling' });
    rightCursor += (CONFIG.CARD_WIDTH + CONFIG.GAP_X);
  });

  // 2. Halvsyskon på mammas sida (längre åt höger)
  rightSiblings.forEach(sib => {
    nodes.push({ ...sib, x: rightCursor, y: startY, type: 'sibling-right' });
    rightCursor += (CONFIG.CARD_WIDTH + CONFIG.GAP_X);
  });

  // --- C. PLACERA GEN 1 (FÖRÄLDRAR & STYVFÖRÄLDRAR) ---

  const parentsY = startY - CONFIG.GAP_Y - CONFIG.CARD_HEIGHT;
  const parentsCenterX = startX + CONFIG.CARD_WIDTH / 2;

  const dadX = parentsCenterX - CONFIG.CARD_WIDTH - 20;
  const momX = parentsCenterX + 20;

  // Hjälpfunktion för att placera styvföräldrar
  const placeStepParents = (bioParent, bioParentX, side) => {
    if (!bioParent) return;
    nodes.push({ ...bioParent, x: bioParentX, y: parentsY, type: 'parent' });

    const otherBio = parents.find(p => p.id !== bioParent.id);
    const pRels = db.relationships.filter(r => r.person1_id === bioParent.id || r.person2_id === bioParent.id);
    const stepParents = pRels.map(r => {
      const pid = r.person1_id === bioParent.id ? r.person2_id : r.person1_id;
      return db.persons.find(p => p.id === pid);
    }).filter(p => p && (!otherBio || p.id !== otherBio.id));

    let spCursor = bioParentX;
    stepParents.forEach(sp => {
      if (side === 'left') spCursor -= (CONFIG.CARD_WIDTH + CONFIG.GAP_X);
      else spCursor += (CONFIG.CARD_WIDTH + CONFIG.GAP_X);

      nodes.push({ ...sp, x: spCursor, y: parentsY, type: 'stepparent' });
      edges.push({
        id: `stepparent-${sp.id}-${bioParent.id}`,
        x1: side === 'left' ? spCursor + CONFIG.CARD_WIDTH : spCursor,
        y1: parentsY + CONFIG.CARD_HEIGHT / 2,
        x2: side === 'left' ? bioParentX : bioParentX + CONFIG.CARD_WIDTH,
        y2: parentsY + CONFIG.CARD_HEIGHT / 2,
        type: 'step-link'
      });
    });
  };

  // Placera ALLA föräldrar, oavsett kön
  if (parents.length >= 2) {
    const dad = parents.find(p => p.gender === 'male');
    const mom = parents.find(p => p.gender === 'female');

    const leftParent = dad || parents[0];
    const rightParent = (dad && mom) ? mom : (dad ? parents.find(p => p.id !== dad.id) : parents[1]);

    if (leftParent) placeStepParents(leftParent, dadX, 'left');
    if (rightParent) placeStepParents(rightParent, momX, 'right');
  } else if (parents.length === 1) {
    placeStepParents(parents[0], startX, 'left');
  }

  // Koppla fokusperson till föräldrar (Linje uppåt)
  if (parents.length > 0) {
    edges.push({
      id: 'focus-parents',
      x1: parentsCenterX, y1: parentsY + CONFIG.CARD_HEIGHT,
      x2: parentsCenterX, y2: startY,
      type: 'straight'
    });
  }

  // Koppla Syskon till RÄTT Föräldrapar (Elbow)
  [...olderSiblings, ...youngerSiblings].forEach(sib => {
    const sibNode = nodes.find(n => n.id === sib.id);
    if (!sibNode) return;

    const pIds = db.parent_child.filter(pc => pc.child_id === sib.id).map(pc => pc.parent_id);
    const pNodes = pIds.map(pid => nodes.find(n => n.id === pid)).filter(Boolean);

    let targetX = parentsCenterX;

    if (pNodes.length === 2) {
      const p1 = pNodes[0];
      const p2 = pNodes[1];
      targetX = ((p1.x + CONFIG.CARD_WIDTH / 2) + (p2.x + CONFIG.CARD_WIDTH / 2)) / 2;
    } else if (pNodes.length === 1) {
      targetX = pNodes[0].x + CONFIG.CARD_WIDTH / 2;
    }

    edges.push({
      id: `sib-${sib.id}`,
      x1: sibNode.x + CONFIG.CARD_WIDTH / 2, y1: sibNode.y,
      x2: targetX, y2: parentsY + CONFIG.CARD_HEIGHT,
      type: 'elbow-up'
    });
  });

  // ==========================================================================
  // 4. REKURSIV BRANCH-LAYOUT (Partners & Ättlingar)
  // ==========================================================================

  /**
   * Rekursiv funktion för att rita ut partners och barn (och deras barn...)
   * @param {string} personId - ID på personen vars träd vi ritar
   * @param {number} startX - X-position för denna gren (personens X)
   * @param {number} startY - Y-position där förgreningslinjen börjar (under personen)
   * @param {boolean} isRoot - Om detta är första nivån (fokus/syskon) eller längre ner
   */
  const layoutBranch = (personId, rootX, rootY) => {
    let currentY = rootY;

    // 1. Hitta partners
    const partnerRels = db.relationships.filter(r => r.person1_id === personId || r.person2_id === personId);
    const partners = partnerRels.map(r => {
      const pid = r.person1_id === personId ? r.person2_id : r.person1_id;
      return db.persons.find(p => p.id === pid);
    });

    // Om personen har barn men ingen partner registrerad, hantera som "null-partner"
    if (partners.length === 0) {
      const kids = db.parent_child.filter(pc => pc.parent_id === personId).map(pc => pc.child_id);
      if (kids.length > 0) partners.push(null);
    }

    let maxBranchY = currentY; // Track the maximum Y reached by any partner branch

    partners.forEach((partner, index) => {
      let childrenIds = [];
      if (partner) {
        // Hitta gemensamma barn
        childrenIds = db.persons.filter(p => {
          const rels = db.parent_child.filter(pc => pc.child_id === p.id);
          const hasMe = rels.some(r => r.parent_id === personId);
          const hasPartner = rels.some(r => r.parent_id === partner.id);
          return hasMe && hasPartner;
        }).map(p => p.id);
      } else {
        // Hitta barn till bara mig (om ingen partner finns)
        childrenIds = db.parent_child.filter(pc => pc.parent_id === personId).map(pc => pc.child_id);
      }
      const children = childrenIds.map(id => db.persons.find(p => p.id === id)).filter(Boolean).sort((a, b) => a.birthYear - b.birthYear);

      // Placera partner (PARALLELLT)
      // Använd samma Y för alla partners (rootY)
      // X-positionering: Långt vänster för udda, långt höger för jämna
      const isRight = index % 2 !== 0;
      const offset = 350;
      const partnerX = isRight ? rootX + offset : rootX - offset;
      const partnerY = rootY;

      // Om partner finns, rita ut den
      if (partner) {
        nodes.push({ ...partner, x: partnerX, y: partnerY, type: 'partner' });

        // Linje från roten (personens nod) till partnern
        // OBS: Om vi är djupt nere i rekursionen måste vi veta "varifrån" vi kom.
        // I denna layout ritar vi alltid partnern rakt under föregående nivå om det är fokus, men indenterat om det är barn.
        // Vänta, logiken i gamla koden var:
        // Focus -> Partner (Step-Left)
        // Child -> Partner (Step-Left)

        // Vi måste veta var "parent node" ligger för att dra linjen.
        // Men layoutBranch anropas med rootX/rootY som är positionen DÄR partnern ska hamna ungefär.
        const parentNode = nodes.find(n => n.id === personId);
        if (parentNode) {
          edges.push({
            id: `partner-${personId}-${partner.id}`,
            x1: parentNode.x + (CONFIG.CARD_WIDTH / 2), y1: parentNode.y + CONFIG.CARD_HEIGHT,
            x2: partnerX + (CONFIG.CARD_WIDTH / 2), y2: partnerY,
            type: 'elbow-down' // Byt till elbow-down för snyggare koppling
          });
        }
      }
      const branchStartY = partnerY + CONFIG.CARD_HEIGHT;
      let childBaseY = branchStartY + 20;

      // Barnen hamnar under partnern. Om ingen partner (singel), hamnar de under offset ändå för snyggare träd? 
      // Nej, om ingen partner, childX = rootX.
      const childX = partner ? partnerX + CONFIG.INDENT_X : rootX;

      children.forEach(child => {
        nodes.push({ ...child, x: childX, y: childBaseY, type: 'child' });

        // Linje från partner (eller föräldern om ingen partner) till barnet
        edges.push({
          id: `child-${personId}-${child.id}`,
          x1: partner ? partnerX + (CONFIG.CARD_WIDTH / 2) : rootX + (CONFIG.CARD_WIDTH / 2),
          y1: branchStartY,
          x2: childX + (CONFIG.CARD_WIDTH / 2),
          y2: childBaseY,
          type: 'straight'
        });

        // REKURSION! Rita ut detta barns gren (barnbarn osv)
        // Nästa nivå startar under detta barn
        const nestedHeight = layoutBranch(child.id, childX, childBaseY + CONFIG.CARD_HEIGHT + 20);

        // Uppdatera childBaseY så nästa syskon hamnar under hela det nyss utritade trädet
        // layoutBranch returnerar den totala Y-höjden som användes.
        // Om layoutBranch inte la till något (inga barnbarn), öka bara med standardhöjd.

        if (nestedHeight > childBaseY) {
          childBaseY = nestedHeight;
        } else {
          childBaseY += CONFIG.CARD_HEIGHT + 10;
        }
      });

      // Uppdatera maxhöjden för hela denna sektion
      if (childBaseY > maxBranchY) {
        maxBranchY = childBaseY;
      }
    });

    return maxBranchY > currentY ? maxBranchY : currentY + CONFIG.CARD_HEIGHT;
  };

  // --------------------------------------------------------------------------
  // 5. KÖR REKURSIONEN FÖR ALLA PÅ GEN 0 (Fokus + Syskon)
  // --------------------------------------------------------------------------

  // Fokuspersonens gren
  layoutBranch(focusId, startX, startY + CONFIG.CARD_HEIGHT + 40);

  // Syskonens grenar
  [...olderSiblings, ...youngerSiblings].forEach(sib => {
    const sibNode = nodes.find(n => n.id === sib.id);
    if (sibNode) {
      layoutBranch(sib.id, sibNode.x, sibNode.y + CONFIG.CARD_HEIGHT + 40);
    }
  });

  const maxX = Math.max(...nodes.map(n => n.x + CONFIG.CARD_WIDTH));
  const maxY = Math.max(...nodes.map(n => n.y + CONFIG.CARD_HEIGHT));

  return { nodes, edges, width: maxX + 100, height: maxY + 100 };
}

// ============================================================================
// ADAPTER: Konvertera från WestFamilyTree databas till VerticalFamilyTree format
// ============================================================================
const buildMockDB = (allPeople) => {
  // Konvertera persons
  const persons = allPeople.map(p => {
    const displayPerson = convertPersonForDisplay(p);
    return {
      id: p.id,
      name: displayPerson.name,
      gender: displayPerson.gender,
      birthYear: displayPerson.birthYear,
      img: displayPerson.img,
    };
  });

  // Bygg parent_child relations FRÅN BARNETS PERSPEKTIV
  const parent_child = [];
  allPeople.forEach(person => {
    const parentIds = (person.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
    parentIds.forEach(parentId => {
      parent_child.push({ parent_id: parentId, child_id: person.id });
    });
  });


  // Bygg relationships (partners)
  const relationships = [];
  const processed = new Set();
  allPeople.forEach(person => {
    const partnerIds = (person.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
    partnerIds.forEach(partnerId => {
      const key = [person.id, partnerId].sort().join('-');
      if (!processed.has(key)) {
        relationships.push({ person1_id: person.id, person2_id: partnerId });
        processed.add(key);
      }
    });
  });

  return { persons, parent_child, relationships };
};

// ============================================================================
// KOMPONENT
// ============================================================================

export default function FamilyTreeView({
  allPeople = [],
  focusPersonId,
  onSetFocus,
  onOpenEditModal,
  onCreatePersonAndLink,
  onAddParentToChildAndSetPartners,
  onDeletePerson,
  getPersonRelations,
  personToCenter,
  onPersonCentered
}) {
  const app = useApp();

  // State
  const [focusId, setFocusId] = useState(focusPersonId || (allPeople[0]?.id) || 1);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [clickTimer, setClickTimer] = useState(null);
  const canvasRef = useRef(null);
  const dragThreshold = useRef(false);
  const hasOpenedModal = useRef(false); // Flagga för att bara öppna modal en gång

  // Uppdatera focusId när focusPersonId ändras
  useEffect(() => {
    if (focusPersonId) {
      setFocusId(focusPersonId);
    }
  }, [focusPersonId]);

  // Center person effect
  useEffect(() => {
    if (personToCenter && onPersonCentered) {
      setFocusId(personToCenter);
      onPersonCentered();
    }
  }, [personToCenter, onPersonCentered]);

  // Öppna EditPersonModal som collapsed när FamilyTreeView har personer
  useEffect(() => {
    // Kör bara om vi inte redan har öppnat modal, har personer, och ingen är redan vald
    if (!hasOpenedModal.current && allPeople.length > 0 && !app.editingPerson && onOpenEditModal) {
      hasOpenedModal.current = true; // Sätt flagga så vi inte gör detta igen

      // Öppna första personen som collapsed
      const personToEdit = focusPersonId || allPeople[0]?.id;
      if (personToEdit) {
        onOpenEditModal(personToEdit, true); // true = open as collapsed
      }
    }
  }, [allPeople, app.editingPerson, onOpenEditModal, focusPersonId]);

  // Generera layout med användarens EXAKTA funktion
  const { nodes, edges, width, height } = useMemo(() => {
    if (allPeople.length === 0) return { nodes: [], edges: [], width: 800, height: 800 };
    const db = buildMockDB(allPeople);
    return calculateVerticalLayout(db, focusId);
  }, [allPeople, focusId]);

  // Zoom functions
  const handleZoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }));
  };

  const handleZoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.3) }));
  };

  const handleResetView = () => {
    setTransform({ x: 0, y: 0, scale: 1 });
  };

  // Drag functions
  const handleMouseDown = (e) => {
    // Tillåt drag endast på canvas/svg/bakgrund, inte på cards
    const isCard = e.target.closest('.vt-card');
    if (!isCard) {
      setIsDragging(true);
      dragThreshold.current = false;
      setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      dragThreshold.current = true; // Vi har dragit tillräckligt för att räknas som drag
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(transform.scale + delta, 0.3), 3);
    setTransform(prev => ({ ...prev, scale: newScale }));
  };

  // Context menu handlers
  const handleContextMenu = (e, person) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      person: person
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Close context menu when clicking outside
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  return (
    <>
      <style>{STYLES}</style>
      <div className="vt-container">

        <div className="vt-header">
          <div>
            <h2 style={{ margin: 0, color: '#0f172a' }}>Släktträd</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              {nodes.length} personer visas
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleZoomIn}
              className="vt-card"
              style={{ position: 'static', height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={handleZoomOut}
              className="vt-card"
              style={{ position: 'static', height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Minus size={16} />
            </button>
            <button
              onClick={handleResetView}
              className="vt-card"
              style={{ position: 'static', height: '36px', width: 'auto', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCcw size={16} /> Återställ vy
            </button>
          </div>
        </div>

        <div
          ref={canvasRef}
          className={`vt-canvas ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div
            style={{
              width: Math.max(width, 800),
              height: Math.max(height, 800),
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          >

            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
              {edges.map(edge => {
                let d = '';
                if (edge.type === 'straight') {
                  d = `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`;
                } else if (edge.type === 'elbow-up') {
                  const midY = edge.y1 - 30;
                  d = `M ${edge.x1} ${edge.y1} V ${midY} H ${edge.x2} V ${edge.y2}`;
                } else if (edge.type === 'elbow-down') {
                  // Linje neråt: Ner -> Horisontellt till partner -> Ner
                  const midY = edge.y1 + 40;
                  d = `M ${edge.x1} ${edge.y1} V ${midY} H ${edge.x2} V ${edge.y2}`;
                } else if (edge.type === 'step-left') {
                  d = `M ${edge.x1} ${edge.y1} V ${edge.y2} H ${edge.x2}`;
                } else if (edge.type === 'step-indent') {
                  d = `M ${edge.x1} ${edge.y1} V ${edge.y2} H ${edge.x2}`;
                } else if (edge.type === 'step-link') {
                  d = `M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`;
                }

                return (
                  <path
                    key={edge.id}
                    d={d}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeDasharray={edge.type.includes('step-') || edge.type === 'step-link' ? '4 2' : '0'}
                  />
                );
              })}
            </svg>

            {nodes.map(node => {
              const person = allPeople.find(p => p.id === node.id);
              if (!person) return null;

              const displayPerson = convertPersonForDisplay(person);

              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Använd timer för att skilja single från double click
                    if (clickTimer) {
                      clearTimeout(clickTimer);
                      setClickTimer(null);
                      // Dubbelklick - öppna modal med ID
                      if (onOpenEditModal) onOpenEditModal(person.id);
                    } else {
                      // Single click - vänta 250ms för att se om det blir dubbelklick
                      const timer = setTimeout(() => {
                        setFocusId(node.id);
                        if (onSetFocus) onSetFocus(node.id);
                        setClickTimer(null);
                      }, 250);
                      setClickTimer(timer);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, person)}
                  className={`vt-card ${displayPerson.gender} ${node.type}`}
                  style={{ left: node.x, top: node.y }}
                >
                  {displayPerson.deathDate && (
                    <span className="vt-deceased-marker">✝</span>
                  )}
                  <div className="vt-avatar">
                    {node.img ? (
                      <MediaImage
                        src={node.img}
                        alt={node.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={32} />
                    )}
                  </div>
                  <div className="vt-info">
                    <span className="vt-name">{displayPerson.firstName} {displayPerson.lastName}</span>
                    {displayPerson.birthDate && (
                      <span className="vt-detail">
                        * {displayPerson.birthDate}{displayPerson.birthPlace ? `, ${displayPerson.birthPlace}` : ''}
                      </span>
                    )}
                    {displayPerson.deathDate && (
                      <span className="vt-detail">
                        + {displayPerson.deathDate}{displayPerson.deathPlace ? `, ${displayPerson.deathPlace}` : ''}
                      </span>
                    )}
                    {displayPerson.occupations && displayPerson.occupations.length > 0 && (
                      <span className="vt-detail" style={{ fontStyle: 'italic' }}>
                        {displayPerson.occupations[0]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-slate-800 text-slate-100 rounded-lg shadow-2xl border border-slate-700 py-2 z-[9999]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              minWidth: '200px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                if (onOpenEditModal) onOpenEditModal(contextMenu.person.id);
                closeContextMenu();
              }}
              className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-2"
            >
              <Edit2 size={16} />
              Redigera
            </button>
            <button
              onClick={() => {
                setFocusId(contextMenu.person.id);
                if (onSetFocus) onSetFocus(contextMenu.person.id);
                closeContextMenu();
              }}
              className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-2"
            >
              <Network size={16} />
              Sätt som fokus
            </button>
            <button
              onClick={() => {
                if (onCreatePersonAndLink) {
                  onCreatePersonAndLink('child', contextMenu.person.id);
                }
                closeContextMenu();
              }}
              className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-2"
            >
              <Baby size={16} />
              Lägg till barn
            </button>
            <button
              onClick={() => {
                if (onCreatePersonAndLink) {
                  onCreatePersonAndLink('partner', contextMenu.person.id);
                }
                closeContextMenu();
              }}
              className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-2"
            >
              <Heart size={16} />
              Lägg till partner
            </button>
            <button
              onClick={() => {
                if (onCreatePersonAndLink) {
                  onCreatePersonAndLink('parent', contextMenu.person.id);
                }
                closeContextMenu();
              }}
              className="w-full px-4 py-2 text-left hover:bg-slate-700 flex items-center gap-2"
            >
              <UserPlus size={16} />
              Lägg till förälder
            </button>
            <div className="border-t border-slate-700 my-1"></div>
            <button
              onClick={() => {
                if (onDeletePerson) {
                  if (confirm(`Är du säker på att du vill ta bort ${contextMenu.person.firstName} ${contextMenu.person.lastName}?`)) {
                    onDeletePerson(contextMenu.person.id);
                  }
                }
                closeContextMenu();
              }}
              className="w-full px-4 py-2 text-left hover:bg-red-900 text-red-400 flex items-center gap-2"
            >
              <Trash2 size={16} />
              Ta bort
            </button>
          </div>
        )}
      </div>
    </>
  );
}
