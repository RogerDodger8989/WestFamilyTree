import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import {
  X, User, Users, Image as ImageIcon, FileText,
  Activity, Tag, Plus, Trash2, Calendar, MapPin,
  Heart, GitFork,
  Link as LinkIcon, Camera, Edit3, AlertCircle, Check,
  Copy, Star,
  ChevronDown, ChevronUp, MoreHorizontal, Search, Globe, HelpCircle, Network,
  ClipboardList, BookOpen, Clock, Printer,
  Sparkles, DownloadCloud
} from 'lucide-react';
import WindowFrame from './WindowFrame.jsx';
import PlacePicker from './PlacePicker.jsx';
import SmartDateField from './SmartDateField.jsx';
import ImageViewer from './ImageViewer.jsx';
import Editor from './MaybeEditor.jsx';
import MediaSelector from './MediaSelector.jsx';
import MediaImage from './components/MediaImage.jsx';
import { getAvatarImageStyle } from './imageUtils.js';
import { generatePersonaktHTML } from './personaktGenerator.js';
import { useApp } from './AppContext';
import { calculateRelationship, getAncestryPath } from './relationshipUtils';
import { ensureParentsArePartners } from './relationUtils.js';
import { syncRelations } from './syncRelations.js';
import {
  EVENT_TYPE_CONFIGS as EVENT_TYPES,
  EVENT_TYPE_CATEGORIES,
  buildEventSummary,
  createEmptyEvent,
  getEventFieldsForType,
  getEventTypeConfig,
  normalizeEventForType
} from './eventFieldConfig.js';
import { buildSourceString } from './parsing.js';

// --- KONSTANTER ---

const RELATION_TYPES = {
  parent: ['Biologisk', 'Adoptiv', 'Fosterförälder', 'Styvförälder'],
  partner: ['Gift', 'Sambo', 'Förlovad', 'Skild', 'Okänd'],
  child: ['Biologiskt', 'Adoptivbarn', 'Fosterbarn', 'Styvbarn'],
  sibling: ['Helsyskon', 'Halvsyskon', 'Styvsyskon', 'Adoptivsyskon']
};

const PRIORITY_LEVELS = [
  { level: 0, label: 'Ingen prio', color: 'text-muted' },
  { level: 1, label: 'Låg prio', color: 'text-success' },
  { level: 2, label: 'Mellan prio', color: 'text-warning' },
  { level: 3, label: 'Hög prio', color: 'text-warning' },
  { level: 4, label: 'Mycket hög prio', color: 'text-danger' },
  { level: 5, label: 'Extremt hög prio', color: 'text-danger font-bold' },
];

const TASK_STATUS = [
  { value: 'not-started', label: 'Inte påbörjad', color: 'text-muted', bgColor: 'bg-surface-2' },
  { value: 'in-progress', label: 'Pågående', color: 'text-accent', bgColor: 'bg-accent-soft' },
  { value: 'completed', label: 'Klar', color: 'text-success', bgColor: 'bg-success-soft' },
  { value: 'on-hold', label: 'Pausad', color: 'text-warning', bgColor: 'bg-warning-soft' },
];

const GENERIC_WITNESS_ROLE_OPTIONS = [
  'Vittne',
  'Uppgiftslämnare',
  'Informant',
  'Annan'
];

const EVENT_WITNESS_ROLE_OPTIONS = {
  'Dop': ['Fadder', 'Gudmor', 'Gudfar', 'Gudförälder', 'Präst', 'Klockare', 'Far', 'Mor', 'Förälder'],
  'Dop som vuxen': ['Fadder', 'Gudförälder', 'Präst', 'Klockare'],
  'Troendedop': ['Fadder', 'Gudförälder', 'Präst', 'Klockare'],
  'Födelse': ['Mor', 'Far', 'Förälder', 'Barnmorska', 'Gudförälder'],
  'Konfirmation': ['Präst', 'Fadder', 'Gudförälder', 'Förälder'],
  'Bar mitzvah': ['Präst', 'Förälder', 'Gudförälder'],
  'Första nattvarden': ['Präst', 'Fadder', 'Gudförälder', 'Förälder'],
  'Prästvigling': ['Präst', 'Ledare', 'Vän'],
  'Välsignelse': ['Präst', 'Förälder', 'Gudförälder'],

  'Vigsel': ['Brud', 'Brudgum', 'Vigselförrättare', 'Präst', 'Brudens far', 'Brudens mor', 'Brudgummens far', 'Brudgummens mor', 'Make/maka'],
  'Förlovning': ['Förlovningsvittne', 'Brud', 'Brudgum', 'Make/maka'],
  'Lysning': ['Präst', 'Brud', 'Brudgum', 'Make/maka'],
  'Samlevnad': ['Make/maka', 'Hustru', 'Vän', 'Granne'],
  'Samvetsäktenskap': ['Make/maka', 'Präst', 'Vigselförrättare'],
  'Skilsmässa': ['Make/maka', 'Ombud', 'Vän'],
  'Annulering av vigsel': ['Make/maka', 'Ombud', 'Präst'],
  'Arkivering av skilsmässa': ['Ombud', 'Uppgiftslämnare'],
  'Adoption': ['Adoptivfar', 'Adoptivmor', 'Biologisk far', 'Biologisk mor', 'Förmyndare'],

  'Bosatt': ['Ägare', 'Inneboende', 'Hyresgäst', 'Arrendator', 'Hushållsföreståndare', 'Dräng', 'Piga', 'Tjänstefolk', 'Logerande', 'Granne', 'Make/maka', 'Barn'],
  'Folkräkning': ['Hushållsföreståndare', 'Inneboende', 'Hyresgäst', 'Ägare', 'Dräng', 'Piga', 'Tjänstefolk', 'Logerande', 'Granne', 'Make/maka', 'Barn'],
  'Emigration': ['Resesällskap', 'Medföljande', 'Arbetsgivare', 'Uppgiftslämnare'],
  'Immigration': ['Resesällskap', 'Medföljande', 'Arbetsgivare', 'Uppgiftslämnare'],

  'Död': ['Arvinge', 'Dödsbodelägare', 'Informant', 'Förmyndare'],
  'Begravning': ['Präst', 'Gravrättsinnehavare', 'Arvinge', 'Dödsbodelägare'],
  'Kremering': ['Präst', 'Gravrättsinnehavare', 'Arvinge'],
  'Bouppteckning': ['Bouppteckningsman', 'Arvinge', 'Dödsbodelägare', 'Exekutor'],
  'Testamente': ['Testamentstagare', 'Exekutor', 'Arvinge', 'Dödsbodelägare'],

  'Militärtjänst': ['Befäl', 'Kamrat', 'Ledare'],
  'Utbildning': ['Lärare', 'Mentor', 'Examensvittne'],
  'Examen': ['Lärare', 'Mentor', 'Examensvittne'],
  'Yrke': ['Arbetsgivare', 'Arbetskamrat', 'Mästare', 'Gesäll', 'Lärling'],
  'Titel': ['Arbetsgivare', 'Arbetskamrat', 'Mästare', 'Ledare'],
  'Egen händelse': ['Vittne', 'Vän', 'Uppgiftslämnare']
};

function getWitnessRolesForEventType(eventType, currentRole = '') {
  const eventSpecific = EVENT_WITNESS_ROLE_OPTIONS[String(eventType || '').trim()] || [];
  const combined = [...eventSpecific, ...GENERIC_WITNESS_ROLE_OPTIONS];

  if (currentRole && !combined.includes(currentRole)) {
    combined.unshift(currentRole);
  }

  return Array.from(new Set(combined));
}

const formatWitnessPersonName = (person) => {
  if (!person) return '';
  const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return fullName || `Person ${person.id || ''}`.trim();
};

// Smart datumformatterare med stöd för olika format och prefix
const parseAndFormatDate = (input) => {
  if (!input || !input.trim()) return '';

  const original = input.trim();
  let prefix = '';
  let dateStr = original;

  // Hantera prefix (från, omkring, till, mellan)
  const prefixMatch = original.match(/^(från|omkring|ca|c|till|före|efter|mellan)\s+/i);
  if (prefixMatch) {
    const p = prefixMatch[1].toLowerCase();
    if (p === 'från') prefix = 'från ';
    else if (p === 'omkring' || p === 'ca' || p === 'c') prefix = 'ca ';
    else if (p === 'till' || p === 'före') prefix = 'före ';
    else if (p === 'efter') prefix = 'efter ';
    else if (p === 'mellan') prefix = 'mellan ';
    dateStr = original.substring(prefixMatch[0].length);
  }

  // Hantera "från-till" intervall
  if (dateStr.includes('-') && !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parts = dateStr.split('-').map(s => s.trim());
    if (parts.length === 2) {
      return `${parseDate(parts[0])} - ${parseDate(parts[1])}`;
    }
  }

  return prefix + parseDate(dateStr);
};

const parseDate = (input) => {
  if (!input) return '';

  const cleaned = input.trim();

  // Redan i rätt format (ÅÅÅÅ-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // Format: ÅÅÅÅMMDD (8 siffror utan separator) - t.ex. 20090401
  if (/^\d{8}$/.test(cleaned)) {
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  // Månadsmappning
  const months = {
    'jan': '01', 'januari': '01',
    'feb': '02', 'februari': '02',
    'mar': '03', 'mars': '03',
    'apr': '04', 'april': '04',
    'maj': '05', 'may': '05',
    'jun': '06', 'juni': '06',
    'jul': '07', 'juli': '07',
    'aug': '08', 'augusti': '08',
    'sep': '09', 'september': '09',
    'okt': '10', 'oktober': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };

  // Format: 21 nov 1980, 21 november 1980
  const monthNameMatch = cleaned.match(/(\d{1,2})\s+([a-zå-ö]+)\s+(\d{4})/i);
  if (monthNameMatch) {
    const day = monthNameMatch[1].padStart(2, '0');
    const monthName = monthNameMatch[2].toLowerCase();
    const year = monthNameMatch[3];
    const month = months[monthName];
    if (month) return `${year}-${month}-${day}`;
  }

  // Format: 21/11/1980, 21.11.1980, 21-11-1980
  const numericMatch = cleaned.match(/(\d{1,2})[\/\.\-\s](\d{1,2})[\/\.\-\s](\d{4})/);
  if (numericMatch) {
    const day = numericMatch[1].padStart(2, '0');
    const month = numericMatch[2].padStart(2, '0');
    const year = numericMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format: 1980-11-21 (redan ok)
  const isoMatch = cleaned.match(/(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Bara årtal
  if (/^\d{4}$/.test(cleaned)) return cleaned;

  // Kunde inte tolka - returnera original
  return input;
};

// Enkel datumformatterare (gammal)
const standardizeDate = (input) => {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return input;
};

// --- SUB-COMPONENTS ---

const EditorToolbar = () => (
  <div className="flex gap-1 bg-surface p-1 rounded-t border-b border-subtle mb-0">
    {['B', 'I', 'U'].map(cmd => (
      <button key={cmd} className="w-6 h-6 flex items-center justify-center hover:bg-surface-2 rounded text-xs font-bold text-secondary">
        {cmd}
      </button>
    ))}
    <div className="w-px h-4 bg-surface mx-1 self-center"></div>
    <button className="px-2 h-6 flex items-center justify-center hover:bg-surface-2 rounded text-xs text-secondary">H1</button>
    <button className="px-2 h-6 flex items-center justify-center hover:bg-surface-2 rounded text-xs text-secondary">Lista</button>
  </div>
);

// Sub-modal för att lägga till källa
const SourceModal = ({ isOpen, onClose, onAdd, eventType }) => {
  const [source, setSource] = useState({
    type: 'Arkiv',
    title: '',
    author: '',
    year: '',
    citation: '',
    url: ''
  });

  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 250, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.closest('.modal-header')) {
      setIsDragging(true);
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleAdd = () => {
    if (source.title.trim()) {
      onAdd(source);
      setSource({ type: 'Arkiv', title: '', author: '', year: '', citation: '', url: '' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4100] flex items-center justify-center bg-background/30">
      <div
        ref={modalRef}
        className="bg-surface border border-subtle rounded-lg shadow-2xl w-full max-w-md p-0 overflow-hidden"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxWidth: '500px'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="modal-header bg-background p-4 border-b border-subtle flex justify-between items-center cursor-move">
          <h3 className="font-bold text-on-accent">Lägg till källa</h3>
          <button onClick={onClose} className="text-muted hover:text-on-accent"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1">Källtyp</label>
            <select
              value={source.type}
              onChange={e => setSource({ ...source, type: e.target.value })}
              className="w-full bg-background border border-subtle rounded p-2 text-on-accent focus:border-accent focus:outline-none"
            >
              <option>Arkiv</option>
              <option>Bok</option>
              <option>Artikel</option>
              <option>Webb</option>
              <option>Familjebok</option>
              <option>Övrigt</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1">Titel</label>
            <input
              type="text"
              value={source.title}
              onChange={e => setSource({ ...source, title: e.target.value })}
              className="w-full bg-background border border-subtle rounded p-2 text-on-accent focus:border-accent focus:outline-none"
              placeholder="Källans titel"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase mb-1">Författare</label>
            <input
              type="text"
              value={source.author}
              onChange={e => setSource({ ...source, author: e.target.value })}
              className="w-full bg-background border border-subtle rounded p-2 text-on-accent focus:border-accent focus:outline-none"
              placeholder="Namn"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary uppercase mb-1">År</label>
            <input
              type="text"
              value={source.year}
              onChange={e => setSource({ ...source, year: e.target.value })}
              className="w-full bg-background border border-subtle rounded p-2 text-primary focus:border-accent focus:outline-none"
              placeholder="ÅÅÅÅ"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary uppercase mb-1">Citat/Referens</label>
            <textarea
              value={source.citation}
              onChange={e => setSource({ ...source, citation: e.target.value })}
              className="w-full bg-background border border-subtle rounded p-2 text-primary focus:border-accent focus:outline-none resize-none"
              rows="3"
              placeholder="Relevanta citat eller sidnummer"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary uppercase mb-1">URL (valfritt)</label>
            <input
              type="url"
              value={source.url}
              onChange={e => setSource({ ...source, url: e.target.value })}
              className="w-full bg-background border border-subtle rounded p-2 text-primary focus:border-accent focus:outline-none"
              placeholder="https://..."
            />
          </div>
        </div>
        <div className="bg-background p-4 border-t border-subtle flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted hover:text-on-accent">Avbryt</button>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-accent hover:bg-accent text-on-accent rounded text-sm font-medium transition-colors"
          >
            Lägg till källa
          </button>
        </div>
      </div>
    </div>
  );
};

// Dialog för att välja andra föräldern när man skapar barn
const SecondParentSelector = ({ isOpen, onClose, candidates, onSelect, onSelectOther, onSelectUnknown }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="bg-surface border-2 border-subtle rounded-xl shadow-2xl w-full max-w-md p-6 transform scale-100 animate-in fade-in zoom-in duration-200">
        <h3 className="text-xl font-bold text-on-accent mb-2 text-center">Vem är den andra föräldern?</h3>
        <p className="text-muted text-center text-sm mb-6">
          Du lägger till ett barn till en förälder som har partners.
          Vill du koppla barnet till någon av dem?
        </p>

        <div className="space-y-3">
          {candidates.map(candidate => (
            <button
              key={candidate.id}
              onClick={() => onSelect(candidate)}
              className="w-full flex items-center gap-4 p-4 bg-surface-2 hover:bg-surface border border-subtle hover:border-accent rounded-lg transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong group-hover:border-accent">
                {candidate.media && candidate.media.length > 0 ? (
                  <MediaImage
                    url={candidate.media[0].url || candidate.media[0].path}
                    alt={candidate.name}
                    className="w-full h-full object-cover"
                    style={getAvatarImageStyle(candidate.media[0], candidate.id)}
                  />
                ) : (
                  <User className="w-full h-full p-2 text-secondary" />
                )}
              </div>
              <div>
                <div className="font-bold text-primary group-hover:text-on-accent text-lg">{candidate.name}</div>
                <div className="text-xs text-muted group-hover:text-accent">Nuvarande partner</div>
              </div>
            </button>
          ))}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={onSelectOther}
              className="flex items-center justify-center gap-2 p-3 bg-surface-2 hover:bg-surface-2 border border-subtle rounded-lg text-secondary hover:text-on-accent transition-colors"
            >
              <Search size={16} /> Välj annan
            </button>
            <button
              onClick={onSelectUnknown}
              className="flex items-center justify-center gap-2 p-3 bg-surface-2 hover:bg-surface-2 border border-subtle rounded-lg text-secondary hover:text-on-accent transition-colors"
            >
              <HelpCircle size={16} /> Okänd/Ingen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- HUVUDKOMPONENT ---

export default function EditPersonModal({ person: initialPerson, allPlaces, onSave, onClose, onChange, onOpenSourceDrawer, allSources, allPeople, onOpenEditModal, allMediaItems = [], onUpdateAllMedia = () => { }, isDocked = false, onNavigateToPlace, onTogglePlaceDrawer, onViewInFamilyTree, isCollapsed = false, onToggleCollapse }) {
  const { getAllTags, setDbData, dbData, bookmarks = [], handleToggleBookmark, showStatus = () => { }, showUndoToast, handleQuickPasteSource, handleNavigateToSource } = useApp();

  const extractNicknameFromQuotedName = (nameText) => {
    const text = String(nameText || '');
    const match = text.match(/"([^"]+)"/);
    return match ? match[1].trim() : '';
  };

  const normalizeAdditionalNames = (personInput) => {
    const previousNames = Array.isArray(personInput?.previousNames)
      ? personInput.previousNames.filter((name) => String(name || '').trim().length > 0)
      : [];
    const alternateLastName = String(
      personInput?.alternateLastName
      || personInput?.birthName
      || previousNames[0]
      || ''
    ).trim();
    const alternateFirstName = String(personInput?.alternateFirstName || '').trim();
    const nicknameFromFirstName = extractNicknameFromQuotedName(personInput?.firstName);
    const explicitNickname = String(personInput?.nickname || '').trim();

    return {
      nickname: explicitNickname || nicknameFromFirstName,
      alternateFirstName,
      alternateLastName,
      birthName: alternateLastName,
      previousNames: alternateLastName ? [alternateLastName, ...previousNames.slice(1)] : previousNames
    };
  };

  // Relation linking modal state
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationTypeToAdd, setRelationTypeToAdd] = useState(null);
  const [relationSearch, setRelationSearch] = useState('');
  const [relationSearchIndex, setRelationSearchIndex] = useState(0);
  const [relationSortBy, setRelationSortBy] = useState('name'); // 'name', 'recent', 'related'
  const [selectedPartnerId, setSelectedPartnerId] = useState(null); // För att veta vilken partner man lägger till barn under

  // State för att välja andra föräldern (fix för högerklicks-meny)
  const [showSecondParentSelector, setShowSecondParentSelector] = useState(false);
  const [secondParentCandidates, setSecondParentCandidates] = useState([]);
  const [pendingChildId, setPendingChildId] = useState(null); // Barnets ID som vi håller på att skapa
  const [inlineRelationEditor, setInlineRelationEditor] = useState(null);
  const [isPrintSettingsOpen, setIsPrintSettingsOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    includeBasics: true,
    includeEvents: true,
    includeFamilyParentsSiblings: true,
    includeFamilyPartnersChildren: true,
    includeFamilyGrandchildren: false,
    includeMedia: true,
    includeNotesBiography: true,
    includeSourceList: true,
  });
  const inlineRelationFirstNameRef = useRef(null);

  const togglePrintOption = (key) => {
    if (key === 'includeBasics') return;
    setPrintOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreatePersonakt = () => {
    try {
      const html = generatePersonaktHTML(
        person,
        {
          people: Array.isArray(allPeople) ? allPeople : (dbData?.people || []),
          sources: Array.isArray(allSources) ? allSources : (dbData?.sources || []),
          places: Array.isArray(allPlaces) ? allPlaces : (dbData?.places || []),
        },
        printOptions
      );

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showStatus('Kunde inte oppna utskriftsfonster. Kontrollera popup-blockering.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();

      const triggerPrint = () => {
        try {
          printWindow.print();
        } catch (error) {
          console.error('[EditPersonModal] Kunde inte starta utskrift:', error);
          showStatus('Kunde inte starta utskrift.');
        }
      };

      if (printWindow.document.readyState === 'complete') {
        window.setTimeout(triggerPrint, 180);
      } else {
        printWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 180), { once: true });
      }

      setIsPrintSettingsOpen(false);
    } catch (error) {
      console.error('[EditPersonModal] Fel vid generering av personakt:', error);
      showStatus('Kunde inte skapa personakt.');
    }
  };

  useEffect(() => {
    const handleOpenPrintSettings = (event) => {
      const requestedPersonId = event?.detail?.personId;
      if (!requestedPersonId || requestedPersonId === initialPerson?.id) {
        setIsPrintSettingsOpen(true);
      }
    };

    window.addEventListener('WFT:openPersonPrintSettings', handleOpenPrintSettings);
    return () => window.removeEventListener('WFT:openPersonPrintSettings', handleOpenPrintSettings);
  }, [initialPerson?.id]);

  // Open relation picker modal
  const openRelationModal = (type, partnerId = null) => {
    setRelationTypeToAdd(type);
    setSelectedPartnerId(partnerId); // Spara partnerId om man lägger till barn under en partner
    setRelationModalOpen(true);
    setRelationSearch('');
    setRelationSearchIndex(0);
    setRelationSortBy('name');
  };

  const relationLabels = {
    parent: 'förälder',
    child: 'barn',
    partner: 'partner',
    sibling: 'syskon'
  };

  const getPersonName = (candidate) => {
    if (!candidate) return 'Okänd';
    return `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Okänd';
  };

  const getRelationId = (relation) => (typeof relation === 'object' ? relation?.id : relation);

  const ensureRelationsShape = (candidate) => {
    if (!candidate.relations || typeof candidate.relations !== 'object') {
      candidate.relations = {};
    }
    if (!Array.isArray(candidate.relations.parents)) candidate.relations.parents = [];
    if (!Array.isArray(candidate.relations.partners)) candidate.relations.partners = [];
    if (!Array.isArray(candidate.relations.children)) candidate.relations.children = [];
    if (!Array.isArray(candidate.relations.siblings)) candidate.relations.siblings = [];
  };

  const upsertRelationEntry = (owner, relationKey, entry) => {
    ensureRelationsShape(owner);
    const current = owner.relations[relationKey] || [];
    const exists = current.some((rel) => getRelationId(rel) === entry.id);
    if (!exists) {
      owner.relations[relationKey] = [...current, entry];
    }
  };

  const applyTwoWayRelationSync = (people, sourceId, targetId, relationType, partnerIdForChild = null) => {
    const updatedPeople = JSON.parse(JSON.stringify(Array.isArray(people) ? people : []));
    const source = updatedPeople.find((p) => p.id === sourceId);
    const target = updatedPeople.find((p) => p.id === targetId);
    if (!source || !target) return updatedPeople;

    const sourceName = getPersonName(source);
    const targetName = getPersonName(target);

    if (relationType === 'parents') {
      upsertRelationEntry(source, 'parents', { id: target.id, name: targetName, type: 'Biologisk' });
      upsertRelationEntry(target, 'children', { id: source.id, name: sourceName, type: 'Biologiskt' });
      return ensureParentsArePartners(updatedPeople, source.id);
    }

    if (relationType === 'children') {
      upsertRelationEntry(source, 'children', { id: target.id, name: targetName, type: 'Biologiskt' });
      upsertRelationEntry(target, 'parents', { id: source.id, name: sourceName, type: 'Biologisk' });

      if (partnerIdForChild && partnerIdForChild !== source.id) {
        const partner = updatedPeople.find((p) => p.id === partnerIdForChild);
        if (partner) {
          const partnerName = getPersonName(partner);
          upsertRelationEntry(partner, 'children', { id: target.id, name: targetName, type: 'Biologiskt' });
          upsertRelationEntry(target, 'parents', { id: partner.id, name: partnerName, type: 'Biologisk' });
        }
      }

      return ensureParentsArePartners(updatedPeople, target.id);
    }

    if (relationType === 'partners') {
      upsertRelationEntry(source, 'partners', { id: target.id, name: targetName, type: 'Okänd' });
      upsertRelationEntry(target, 'partners', { id: source.id, name: sourceName, type: 'Okänd' });
      return updatedPeople;
    }

    if (relationType === 'siblings') {
      upsertRelationEntry(source, 'siblings', { id: target.id, name: targetName, type: 'Helsyskon' });
      upsertRelationEntry(target, 'siblings', { id: source.id, name: sourceName, type: 'Helsyskon' });
      return updatedPeople;
    }

    return updatedPeople;
  };

  const canAddRelation = (relationType, targetPersonId, selected) => {
    const existingRelation = getRelationshipType(person.id, targetPersonId);
    if (existingRelation) {
      const personName = getPersonName(selected) || 'personen';
      window.alert(`Ogiltig relation: ${personName} är redan kopplad som ${relationLabels[existingRelation] || existingRelation}. En person kan bara ha en relationstyp till samma person.`);
      return false;
    }

    if (relationType === 'partners' && (isAncestor(person.id, targetPersonId) || isAncestor(targetPersonId, person.id))) {
      window.alert('Ogiltig relation: Förfäder och ättlingar kan inte vara partners.');
      return false;
    }

    if (relationType === 'parents' && isAncestor(person.id, targetPersonId)) {
      window.alert('Ogiltig relation: En ättling kan inte sättas som förälder.');
      return false;
    }

    if (relationType === 'children' && isAncestor(targetPersonId, person.id)) {
      window.alert('Ogiltig relation: En förfader kan inte sättas som barn.');
      return false;
    }

    if (relationType === 'siblings' && (isAncestor(person.id, targetPersonId) || isAncestor(targetPersonId, person.id))) {
      window.alert('Ogiltig relation: Förfäder och ättlingar kan inte vara syskon.');
      return false;
    }

    return true;
  };

  const buildNewRelationPerson = (relationType, people) => {
    const maxRef = (Array.isArray(people) ? people : []).reduce((max, candidate) => {
      const ref = Number(candidate?.refNumber);
      return Number.isFinite(ref) ? Math.max(max, ref) : max;
    }, 0);

    const labelByType = {
      parents: 'Ny Förälder',
      partners: 'Ny Partner',
      children: 'Nytt Barn',
      siblings: 'Nytt Syskon'
    };

    const baseLabel = labelByType[relationType] || 'Ny Person';
    const existingNames = new Set((Array.isArray(people) ? people : []).map((candidate) => String(candidate?.firstName || '').trim()).filter(Boolean));
    const uniqueLabel = (() => {
      if (!existingNames.has(baseLabel)) return baseLabel;
      let suffix = 2;
      let nextLabel = `${baseLabel} ${suffix}`;
      while (existingNames.has(nextLabel)) {
        suffix += 1;
        nextLabel = `${baseLabel} ${suffix}`;
      }
      return nextLabel;
    })();

    const timestamp = Date.now();
    let suffix = 0;
    let candidateId = `p_${timestamp}`;
    const existingIds = new Set((Array.isArray(people) ? people : []).map((candidate) => candidate.id));
    while (existingIds.has(candidateId)) {
      suffix += 1;
      candidateId = `p_${timestamp}_${suffix}`;
    }

    return {
      id: candidateId,
      refNumber: maxRef + 1,
      firstName: uniqueLabel,
      lastName: '',
      gender: '',
      sex: 'U',
      events: [],
      notes: '',
      links: {},
      relations: { parents: [], partners: [], children: [], siblings: [], spouseId: null },
      _isDraft: true,
      _isPlaceholder: true
    };
  };

  const syncRelationNamesForPerson = (people, personIdToSync, personName) => {
    return (Array.isArray(people) ? people : []).map((candidate) => {
      if (!candidate?.relations) return candidate;

      const nextRelations = { ...candidate.relations };
      let changed = false;

      ['parents', 'partners', 'children', 'siblings'].forEach((relationKey) => {
        const source = Array.isArray(nextRelations[relationKey]) ? nextRelations[relationKey] : [];
        const mapped = source.map((relation) => {
          if (typeof relation !== 'object' || !relation) return relation;
          if (relation.id !== personIdToSync) return relation;
          changed = true;
          return { ...relation, name: personName };
        });
        nextRelations[relationKey] = mapped;
      });

      return changed ? { ...candidate, relations: nextRelations } : candidate;
    });
  };

  const handleSaveInlineRelationEditor = () => {
    if (!inlineRelationEditor?.personId) return;

    const firstName = String(inlineRelationEditor.firstName || '').trim();
    const lastName = String(inlineRelationEditor.lastName || '').trim();
    const sex = inlineRelationEditor.sex || 'U';
    const displayName = `${firstName} ${lastName}`.trim();

    if (!firstName && !lastName) {
      window.alert('Fyll i minst förnamn eller efternamn.');
      return;
    }

    setDbData((prevData) => {
      const currentPeople = Array.isArray(prevData?.people) ? prevData.people : [];
      const updatedPeople = JSON.parse(JSON.stringify(currentPeople));
      const targetPerson = updatedPeople.find((candidate) => candidate.id === inlineRelationEditor.personId);
      if (!targetPerson) return prevData;

      targetPerson.firstName = firstName;
      targetPerson.lastName = lastName;
      targetPerson.sex = sex;
      targetPerson.gender = sex;
      delete targetPerson._isPlaceholder;
      if (displayName) {
        targetPerson._isDraft = false;
      }

      const syncedNamesPeople = syncRelationNamesForPerson(updatedPeople, inlineRelationEditor.personId, displayName || getPersonName(targetPerson));
      const refreshedCurrent = syncedNamesPeople.find((candidate) => candidate.id === person.id);
      if (refreshedCurrent) {
        setPerson(refreshedCurrent);
      }

      return { ...prevData, people: syncedNamesPeople };
    });

    setInlineRelationEditor(null);
    if (typeof showStatus === 'function') {
      showStatus('Ny relation uppdaterad.');
    }
  };

  const handleCancelInlineRelationEditor = () => {
    if (inlineRelationEditor?.personId) {
      setDbData((prevData) => {
        const currentPeople = Array.isArray(prevData?.people) ? prevData.people : [];
        const cleanedPeople = currentPeople
          .filter((candidate) => candidate.id !== inlineRelationEditor.personId)
          .map((candidate) => {
            if (!candidate?.relations) return candidate;

            const nextRelations = { ...candidate.relations };
            let changed = false;

            ['parents', 'partners', 'children', 'siblings'].forEach((relationKey) => {
              if (!Array.isArray(nextRelations[relationKey])) return;
              const filtered = nextRelations[relationKey].filter((relation) => getRelationId(relation) !== inlineRelationEditor.personId);
              if (filtered.length !== nextRelations[relationKey].length) {
                nextRelations[relationKey] = filtered;
                changed = true;
              }
            });

            return changed ? { ...candidate, relations: nextRelations } : candidate;
          });

        const refreshedCurrent = cleanedPeople.find((candidate) => candidate.id === person.id);
        if (refreshedCurrent) {
          setPerson(refreshedCurrent);
        }

        return { ...prevData, people: cleanedPeople };
      });
    }

    setInlineRelationEditor(null);
  };

  const handleInlineRelationEditorKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSaveInlineRelationEditor();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelInlineRelationEditor();
    }
  };

  const renderInlineRelationEditor = (relationType, partnerId = null) => {
    if (!inlineRelationEditor) return null;
    if (inlineRelationEditor.type !== relationType) return null;
    if ((inlineRelationEditor.partnerId || null) !== (partnerId || null)) return null;

    const titleByType = {
      parents: 'Ny förälder',
      partners: 'Ny partner',
      children: 'Nytt barn',
      siblings: 'Nytt syskon'
    };

    return (
      <div className="mt-3 rounded-lg border border-subtle bg-surface-2 p-3">
        <div className="text-xs font-semibold text-secondary mb-2 uppercase tracking-wide">{titleByType[relationType] || 'Ny person'}</div>
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <input
              ref={inlineRelationFirstNameRef}
              type="text"
              value={inlineRelationEditor.firstName}
              onChange={(e) => setInlineRelationEditor((prev) => ({ ...prev, firstName: e.target.value }))}
              onKeyDown={handleInlineRelationEditorKeyDown}
              placeholder="Förnamn"
              className="w-full min-w-0 bg-background border border-subtle rounded px-2 py-1.5 text-sm text-primary focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={inlineRelationEditor.lastName}
              onChange={(e) => setInlineRelationEditor((prev) => ({ ...prev, lastName: e.target.value }))}
              onKeyDown={handleInlineRelationEditorKeyDown}
              placeholder="Efternamn"
              className="w-full min-w-0 bg-background border border-subtle rounded px-2 py-1.5 text-sm text-primary focus:border-accent focus:outline-none"
            />
            <select
              value={inlineRelationEditor.sex}
              onChange={(e) => setInlineRelationEditor((prev) => ({ ...prev, sex: e.target.value }))}
              onKeyDown={handleInlineRelationEditorKeyDown}
              className="w-full min-w-0 bg-background border border-subtle rounded px-2 py-1.5 text-sm text-primary focus:border-accent focus:outline-none"
            >
              <option value="U">Okänt kön</option>
              <option value="M">Man</option>
              <option value="F">Kvinna</option>
              <option value="X">Annat</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
            <button
              type="button"
              onClick={handleSaveInlineRelationEditor}
              className="bg-accent hover:bg-accent text-on-accent text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Check size={12} /> Spara
            </button>
            <button
              type="button"
              onClick={handleCancelInlineRelationEditor}
              className="bg-background hover:bg-surface text-secondary text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 border border-subtle transition-colors whitespace-nowrap"
            >
              <X size={12} /> Avbryt
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleCreateNewRelation = (type, partnerIdForChild = null) => {
    if (!person?.id) return;

    let createdPerson = null;
    setDbData((prevData) => {
      const currentPeople = Array.isArray(prevData?.people) ? prevData.people : [];
      const newPerson = buildNewRelationPerson(type, currentPeople);
      createdPerson = newPerson;

      let updatedPeople = [...currentPeople, newPerson];
      updatedPeople = applyTwoWayRelationSync(updatedPeople, person.id, newPerson.id, type, partnerIdForChild);

      const refreshedCurrent = updatedPeople.find((candidate) => candidate.id === person.id);
      if (refreshedCurrent) {
        setPerson(refreshedCurrent);
      }

      return { ...prevData, people: updatedPeople };
    });

    if (createdPerson && typeof showStatus === 'function') {
      setInlineRelationEditor({
        personId: createdPerson.id,
        type,
        partnerId: partnerIdForChild,
        firstName: createdPerson.firstName || '',
        lastName: createdPerson.lastName || '',
        sex: createdPerson.sex || 'U'
      });
      showStatus('Ny relation skapad. Fyll i namn direkt i raden.');
    }
  };

  // Add selected person as relation
  const addRelation = (personId) => {
    if (!relationTypeToAdd || !person?.id) return;

    const selected = allPeople.find(p => p.id === personId);
    if (!selected) return;

    if (!canAddRelation(relationTypeToAdd, personId, selected)) return;

    setDbData((prevData) => {
      const currentPeople = Array.isArray(prevData?.people) ? prevData.people : [];
      const updatedPeople = applyTwoWayRelationSync(currentPeople, person.id, personId, relationTypeToAdd, selectedPartnerId);
      const refreshedCurrent = updatedPeople.find((candidate) => candidate.id === person.id);
      if (refreshedCurrent) {
        setPerson(refreshedCurrent);
      }
      return { ...prevData, people: updatedPeople };
    });

    setRelationModalOpen(false);
    setRelationTypeToAdd(null);
    setSelectedPartnerId(null);
    setRelationSearch('');
    setRelationSearchIndex(0);
  };

  // Hantera val av andra förälder från dialogen
  const handleSelectSecondParent = (partner) => {
    if (!pendingChildId || !initialPerson?.id) return;

    const partnerId = partner.id;
    setDbData((prevData) => {
      const currentPeople = Array.isArray(prevData?.people) ? prevData.people : [];
      const updatedPeople = applyTwoWayRelationSync(currentPeople, initialPerson.id, pendingChildId, 'children', partnerId);
      const refreshedCurrent = updatedPeople.find((candidate) => candidate.id === person?.id);
      if (refreshedCurrent) {
        setPerson(refreshedCurrent);
      }
      return { ...prevData, people: updatedPeople };
    });

    setShowSecondParentSelector(false);
    setPendingChildId(null);
  };

  // Upptäck om vi just skapat ett nytt barn via context menu
  useEffect(() => {
    if (initialPerson?._isPlaceholder && initialPerson._placeholderRelation === 'child' && initialPerson._placeholderTargetId) {
      // Vi är det nya barnet (initialPerson)
      // _placeholderTargetId är föräldern vi skapades från

      const parentId = initialPerson._placeholderTargetId;
      const parent = allPeople.find(p => p.id === parentId);

      if (parent && parent.relations?.partners && parent.relations.partners.length > 0) {
        // Föräldern har partners! Vi måste fråga vem som är den andra föräldern.

        // Mappa partners till kandidater
        const candidates = parent.relations.partners.map(p => {
          const pId = typeof p === 'object' ? p.id : p;
          const distinctP = allPeople.find(x => x.id === pId);
          return distinctP || { id: pId, name: (typeof p === 'object' ? p.name : 'Okänd partner') };
        });

        setSecondParentCandidates(candidates);
        setPendingChildId(initialPerson.id);

        // Visa dialogen (men vänta lite så att modalen hinner laddas klart)
        setTimeout(() => setShowSecondParentSelector(true), 500);
      }
    }
  }, [initialPerson]);

  useEffect(() => {
    if (!inlineRelationEditor) return;
    const timer = window.setTimeout(() => {
      if (inlineRelationFirstNameRef.current) {
        inlineRelationFirstNameRef.current.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [inlineRelationEditor]);

  // Remove relation
  const removeRelation = (type, id) => {
    const relationEntry = (person.relations?.[type] || []).find(r => (typeof r === 'object' ? r.id : r) === id);
    const relatedPerson = allPeople.find(p => p.id === id);
    const relationLabelMap = {
      parents: 'förälder',
      partners: 'partner',
      children: 'barn',
      siblings: 'syskon'
    };
    const relationLabel = relationLabelMap[type] || 'relation';
    const relatedName = relatedPerson
      ? `${relatedPerson.firstName || ''} ${relatedPerson.lastName || ''}`.trim()
      : (typeof relationEntry === 'object' && relationEntry?.name) ? relationEntry.name : id || 'okänd person';

    if (!window.confirm(`Är du säker på att du vill ta bort ${relationLabel}-relationen till ${relatedName}?`)) {
      return;
    }

    const originalPerson = typeof structuredClone === 'function'
      ? structuredClone(person)
      : JSON.parse(JSON.stringify(person));
    const originalDbData = typeof structuredClone === 'function'
      ? structuredClone(dbData)
      : JSON.parse(JSON.stringify(dbData));

    const removeRelationEntry = (owner, relationKey, targetId) => {
      if (!owner) return;
      ensureRelationsShape(owner);
      owner.relations[relationKey] = (owner.relations[relationKey] || []).filter((relation) => getRelationId(relation) !== targetId);
    };

    const updatePeopleForRemoval = (people) => {
      const updatedPeople = JSON.parse(JSON.stringify(Array.isArray(people) ? people : []));
      const currentPerson = updatedPeople.find((candidate) => candidate.id === person.id);
      const targetPerson = updatedPeople.find((candidate) => candidate.id === id);

      if (!currentPerson || !targetPerson) {
        return updatedPeople;
      }

      if (type === 'parents') {
        removeRelationEntry(currentPerson, 'parents', id);
        removeRelationEntry(targetPerson, 'children', person.id);
      } else if (type === 'children') {
        removeRelationEntry(currentPerson, 'children', id);
        removeRelationEntry(targetPerson, 'parents', person.id);
      } else if (type === 'partners') {
        removeRelationEntry(currentPerson, 'partners', id);
        removeRelationEntry(targetPerson, 'partners', person.id);
      } else if (type === 'siblings') {
        removeRelationEntry(currentPerson, 'siblings', id);
        removeRelationEntry(targetPerson, 'siblings', person.id);
      }

      return updatedPeople;
    };

    setDbData((prevData) => {
      const updatedPeople = updatePeopleForRemoval(prevData?.people);
      const refreshedCurrent = updatedPeople.find((candidate) => candidate.id === person.id);
      if (refreshedCurrent) {
        setPerson(refreshedCurrent);
      }
      return { ...prevData, people: updatedPeople };
    });

    if (typeof showUndoToast === 'function') {
      showUndoToast(`Relationen till ${relatedName} har raderats. Ångra?`, () => {
        setPerson(originalPerson);
        setDbData(originalDbData);
      });
    }
  };
  const [activeTab, setActiveTab] = useState('info');
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef(null);
  const firstNameInputRef = useRef(null);
  const focusedPersonIdRef = useRef(null);
  const relationSyncInitializedRef = useRef(false);

  // Helper: Få födelse- och dödsdata från events
  const getLifeInfo = (personData) => {
    if (!personData || !personData.events) {
      return { birthYear: null, deathYear: null, lifeSpan: null };
    }

    const birthEvent = personData.events.find(e => e.type === 'Födelse');
    const deathEvent = personData.events.find(e => e.type === 'Död');

    const birthYear = birthEvent && birthEvent.date ? birthEvent.date.substring(0, 4) : null;
    const deathYear = deathEvent && deathEvent.date ? deathEvent.date.substring(0, 4) : null;

    let lifeSpan = null;
    if (birthYear && deathYear) {
      lifeSpan = parseInt(deathYear) - parseInt(birthYear);
    }

    return { birthYear, deathYear, lifeSpan };
  };

  // Helper: Hämta födelse- och dödsdatum med plats för personväljaren
  const getPersonLifeDetails = (personData) => {
    if (!personData || !personData.events) {
      return { birthDate: '', birthPlace: '', deathDate: '', deathPlace: '' };
    }

    const birthEvent = personData.events.find(e => e.type === 'Födelse');
    const deathEvent = personData.events.find(e => e.type === 'Död');

    const birthDate = birthEvent?.date || '';
    const birthPlace = birthEvent?.place || '';
    const deathDate = deathEvent?.date || '';
    const deathPlace = deathEvent?.place || '';

    return { birthDate, birthPlace, deathDate, deathPlace };
  };

  // Helper: Beräkna relationstyp mellan två personer (enkel version)
  const getRelationshipType = (personAId, personBId) => {
    if (personAId === personBId) return null;

    const personA = allPeople.find(p => p.id === personAId);
    const personB = allPeople.find(p => p.id === personBId);
    if (!personA || !personB) return null;

    // Kolla om de är partners
    const aPartners = (personA.relations?.partners || []).map(p => typeof p === 'object' ? p.id : p);
    if (aPartners.includes(personBId)) return 'partner';

    // Kolla om de är föräldrar/barn
    const aParents = (personA.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
    if (aParents.includes(personBId)) return 'parent';

    const aChildren = (personA.relations?.children || []).map(c => typeof c === 'object' ? c.id : c);
    if (aChildren.includes(personBId)) return 'child';

    // Kolla om de är syskon (gemensamma föräldrar)
    const bParents = (personB.relations?.parents || []).map(p => typeof p === 'object' ? p.id : p);
    const commonParents = aParents.filter(p => bParents.includes(p));
    if (commonParents.length > 0) return 'sibling';

    return null;
  };

  // Helper: Kolla om ancestorId är förfader till descendantId
  const isAncestor = (ancestorId, descendantId) => {
    if (!ancestorId || !descendantId || ancestorId === descendantId) return false;

    const visited = new Set();
    const queue = [descendantId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);

      const currentPerson = allPeople.find(p => p.id === currentId);
      if (!currentPerson) continue;

      const parentIds = (currentPerson.relations?.parents || [])
        .map(p => (typeof p === 'object' ? p.id : p))
        .filter(Boolean);

      if (parentIds.includes(ancestorId)) return true;
      parentIds.forEach(pid => queue.push(pid));
    }

    return false;
  };

  // Helper: Beräkna ålder vid ett visst datum
  const calculateAgeAtEvent = (birthDate, eventDate) => {
    if (!birthDate || !eventDate) return null;

    const birthYear = parseInt(birthDate.substring(0, 4));
    const eventYear = parseInt(eventDate.substring(0, 4));

    if (isNaN(birthYear) || isNaN(eventYear)) return null;

    return eventYear - birthYear;
  };

  // Helper: Sortera events efter datum
  const extractYearMonthDay = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return { year: 9999, month: 0, day: 0 };

    const yearMatch = dateStr.match(/\b(\d{4})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 9999;

    const dateParts = dateStr.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
    let month = 0;
    let day = 0;
    if (dateParts) {
      month = parseInt(dateParts[1], 10);
      day = parseInt(dateParts[2], 10);
    }

    return { year, month, day };
  };

  const getChronologicallySortedEvents = (events) => {
    const source = Array.isArray(events) ? events : [];
    return [...source].sort((a, b) => {
      const aDate = extractYearMonthDay(a?.date);
      const bDate = extractYearMonthDay(b?.date);

      if (aDate.year !== bDate.year) {
        return aDate.year - bDate.year;
      }
      if (aDate.month !== bDate.month) {
        return aDate.month - bDate.month;
      }
      return aDate.day - bDate.day;
    });
  };

  const sortedEvents = () => {
    return getChronologicallySortedEvents(person.events);
  };

  // Helper: Bygg platshierarki från placeId eller placeData
  const getPlaceHierarchy = (evt) => {
    // Försök först använda placeData om den finns (nyare events)
    let place = evt?.placeData;

    // Annars försök hitta i allPlaces
    if (!place && evt?.placeId && allPlaces) {
      place = allPlaces.find(p => p.id === evt.placeId);
    }

    if (!place) return evt?.place || '';

    // Bygg hierarki från minst till störst
    const parts = [
      place.gard,
      place.by,
      place.specific,
      place.village,
      place.socken,
      place.sockenstadnamn,
      place.parish,
      place.kommunnamn,
      place.municipality,
      place.lansnamn,
      place.region,
      place.land,
      place.country
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : place.name || place.ortnamn || '';
  };

  const getMeaningfulNoteText = (rawNote) => {
    const raw = String(rawNote || '');
    return raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleMouseDown = (e) => {
    // Bara drag från header
    if (e.target.closest('.modal-header')) {
      setIsDragging(true);
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const [personRaw, setPersonRaw] = useState(() => {
    const base = initialPerson || {
      id: 'I_new',
      refId: '',
      firstName: '',
      lastName: '',
      nickname: '',
      alternateFirstName: '',
      alternateLastName: '',
      birthName: '',
      previousNames: [],
      sex: 'U',
      birthDate: '',
      deathDate: '',
      birthPlace: '',
      deathPlace: '',
      tags: [],
      events: [],
      relations: { parents: [], partners: [], children: [], siblings: [] },
      research: {
        tasks: [],
        notes: '',
        questions: []
      },
      media: [],
      notes: []
    };

    // Säkerställ att events är en array
    if (!Array.isArray(base.events)) {
      base.events = [];
    }

    // Säkerställ att research är ett objekt med tasks, notes, questions
    if (!base.research || typeof base.research !== 'object' || Array.isArray(base.research)) {
      base.research = {
        tasks: Array.isArray(base.research) ? base.research : [],
        notes: '',
        questions: []
      };
    }
    if (!Array.isArray(base.research.tasks)) base.research.tasks = [];
    if (!Array.isArray(base.research.questions)) base.research.questions = [];
    if (typeof base.research.notes !== 'string') base.research.notes = '';

    const normalizedNames = normalizeAdditionalNames(base);
    base.nickname = normalizedNames.nickname;
    base.birthName = normalizedNames.birthName;
    base.previousNames = normalizedNames.previousNames;

    return base;
  });

  // Uppdatera personRaw när initialPerson ändras
  const prevPersonIdRef = useRef(personRaw.id);
  useEffect(() => {
    if (initialPerson && initialPerson.id !== prevPersonIdRef.current) {
      prevPersonIdRef.current = initialPerson.id;

      // Säkerställ att events är en array
      const events = Array.isArray(initialPerson.events) ? initialPerson.events : [];

      // Säkerställ att research är ett objekt med tasks, notes, questions
      const research = (initialPerson.research && typeof initialPerson.research === 'object' && !Array.isArray(initialPerson.research))
        ? {
          tasks: Array.isArray(initialPerson.research.tasks) ? initialPerson.research.tasks : [],
          notes: typeof initialPerson.research.notes === 'string' ? initialPerson.research.notes : '',
          questions: Array.isArray(initialPerson.research.questions) ? initialPerson.research.questions : []
        }
        : {
          tasks: [],
          notes: '',
          questions: []
        };

      // Skapa en djup kopia av initialPerson med säkrade värden
      const updatedPerson = JSON.parse(JSON.stringify({
        ...initialPerson,
        events,
        research,
        ...normalizeAdditionalNames(initialPerson),
        media: Array.isArray(initialPerson.media) ? initialPerson.media : [],
        tags: Array.isArray(initialPerson.tags) ? initialPerson.tags : [],
        relations: initialPerson.relations || { parents: [], partners: [], children: [], siblings: [] }
      }));

      setPersonRaw(updatedPerson);
    }
  }, [initialPerson?.id]); // Bara när ID ändras, inte när objektet muteras

  // Wrapper för setPersonRaw som automatiskt anropar onChange för auto-save
  // Detta säkerställer att ALLA ändringar sparas automatiskt i realtid
  const onChangeTimeoutRef = useRef(null);
  const setPerson = useCallback((updater) => {
    setPersonRaw(prev => {
      const newPerson = typeof updater === 'function' ? updater(prev) : updater;
      return newPerson;
    });
  }, [onChange]);

  // Exponera personRaw som person för kompatibilitet
  const person = personRaw;

  // Media sort configuration - initialiseras från person.mediaSortConfig
  const [mediaSortConfig, setMediaSortConfigState] = useState(() => {
    return person?.mediaSortConfig || { sortBy: 'custom', imageSize: 0.62 };
  });

  // Uppdatera mediaSortConfig när person ändras
  useEffect(() => {
    setMediaSortConfigState(person?.mediaSortConfig || { sortBy: 'custom', imageSize: 0.62 });
  }, [person?.id]); // Bara när ID ändras

  // Wrapper för att uppdatera mediaSortConfig och spara i person
  const handleMediaSortChange = useCallback((newConfig) => {
    setMediaSortConfigState(newConfig);
    const updatedPerson = { ...person, mediaSortConfig: newConfig };
    setPerson(updatedPerson);
    if (onChange) onChange(updatedPerson);
  }, [person, setPerson, onChange]);

  useEffect(() => {
    if (!Array.isArray(person.events) || person.events.length < 2) return;

    const sorted = getChronologicallySortedEvents(person.events);
    const orderIsUnchanged = person.events.every((eventItem, index) => eventItem === sorted[index]);

    if (orderIsUnchanged) return;

    const updatedPerson = { ...person, events: sorted };
    setPerson(updatedPerson);
    if (onChange) onChange(updatedPerson);
  }, [person.events]);

  // Synka alltid relationsändringar till alla berörda personer i dbData
  useEffect(() => {
    if (!person?.id) return;

    // Undvik onödig första körning direkt vid initial modal-laddning
    if (!relationSyncInitializedRef.current) {
      relationSyncInitializedRef.current = true;
      return;
    }

    setDbData(prevData => {
      if (!prevData?.people) return prevData;
      const updatedPeople = syncRelations(person, prevData.people);
      return { ...prevData, people: updatedPeople };
    });
  }, [person?.relations, person?.id, setDbData]);

  useEffect(() => {
    if (!person?.id || !Array.isArray(person.media) || person.media.length === 0 || !Array.isArray(allMediaItems) || allMediaItems.length === 0) {
      return;
    }

    const mediaMap = new Map(allMediaItems.map((media) => [String(media.id), media]));
    let hasChanges = false;

    const syncedMedia = person.media.map((mediaItem) => {
      if (!mediaItem || mediaItem.id === undefined || mediaItem.id === null) return mediaItem;
      const latest = mediaMap.get(String(mediaItem.id));
      if (!latest) return mediaItem;

      const merged = { ...mediaItem, ...latest };
      // Bevara lokalt redigerade face-tag-fält så de inte skrivs över av stale global state.
      if (Object.prototype.hasOwnProperty.call(mediaItem, 'regions')) {
        merged.regions = mediaItem.regions;
      }
      if (Object.prototype.hasOwnProperty.call(mediaItem, 'faces')) {
        merged.faces = mediaItem.faces;
      }
      if (!hasChanges && JSON.stringify(mediaItem) !== JSON.stringify(merged)) {
        hasChanges = true;
      }
      return merged;
    });

    if (!hasChanges) return;

    setPersonRaw((prev) => ({
      ...prev,
      media: syncedMedia
    }));
  }, [allMediaItems, person?.id, person?.media]);

  const openPrimaryProfileImage = useCallback(() => {
    const mediaList = Array.isArray(person?.media) ? person.media : [];
    if (mediaList.length === 0) {
      setActiveTab('media');
      return;
    }

    setImageEditorContext('person');
    setEditingImageIndex(0);
    setIsImageEditorOpen(true);
  }, [person?.media]);

  const primaryAvatarStyle = useMemo(() => {
    const primary = person?.media?.[0];
    if (!primary) return undefined;
    const latestPrimary = Array.isArray(allMediaItems)
      ? allMediaItems.find((media) => String(media?.id) === String(primary?.id)) || primary
      : primary;
    return getAvatarImageStyle(latestPrimary, person?.id) || getAvatarImageStyle(latestPrimary, person?.refNumber);
  }, [allMediaItems, person?.media, person?.id, person?.refNumber]);

  useEffect(() => {
    if (!initialPerson?.id || initialPerson.id !== person?.id) return;

    const nextColor = initialPerson?.color || '';
    const nextArchived = Boolean(initialPerson?._archived);
    const nextArchiveReason = String(initialPerson?.archiveReason || '');

    const currentColor = String(person?.color || '');
    const currentArchived = Boolean(person?._archived);
    const currentArchiveReason = String(person?.archiveReason || '');

    if (currentColor === nextColor && currentArchived === nextArchived && currentArchiveReason === nextArchiveReason) return;

    setPersonRaw((prev) => ({
      ...prev,
      color: nextColor,
      _archived: nextArchived || undefined,
      archiveReason: nextArchiveReason || undefined
    }));
  }, [initialPerson?.id, initialPerson?.color, initialPerson?._archived, initialPerson?.archiveReason, person?.id, person?.color, person?._archived, person?.archiveReason]);

  useEffect(() => {
    const shouldAutofocus = Boolean(initialPerson?._isDraft)
      || (!String(initialPerson?.firstName || '').trim() && !String(initialPerson?.lastName || '').trim());

    if (!person?.id || !shouldAutofocus || isCollapsed) return;
    if (focusedPersonIdRef.current === person.id) return;

    focusedPersonIdRef.current = person.id;

    const focusTimer = window.setTimeout(() => {
      if (firstNameInputRef.current) {
        firstNameInputRef.current.focus();
        firstNameInputRef.current.select();
      }
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [person?.id, initialPerson?._isDraft, initialPerson?.firstName, initialPerson?.lastName, isCollapsed]);

  // Handle keyboard navigation in relation picker (moved after person definition)
  useEffect(() => {
    if (!relationModalOpen) return;

    const handleKeyDown = (e) => {
      // Beräkna filtrerad lista (samma logik som i modalen)
      const filtered = allPeople
        .filter(p => {
          if (p.id === person.id) return false;
          if (!relationSearch) return true;
          const searchLower = relationSearch.toLowerCase();
          const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
          const ref = (p.refNumber || p.refId || '').toString().toLowerCase();
          return fullName.includes(searchLower) || ref.includes(searchLower) ||
            (p.firstName || '').toLowerCase().includes(searchLower) ||
            (p.lastName || '').toLowerCase().includes(searchLower);
        })
        .map(p => {
          const relationship = getRelationshipType(person.id, p.id);
          const modifiedAt = p.modifiedAt || p.createdAt || '';
          return { ...p, relationship, modifiedAt };
        })
        .sort((a, b) => {
          if (relationSortBy === 'recent') {
            return (b.modifiedAt || '').localeCompare(a.modifiedAt || '');
          } else if (relationSortBy === 'related') {
            const order = { 'partner': 1, 'parent': 2, 'child': 3, 'sibling': 4 };
            const aOrder = order[a.relationship] || 99;
            const bOrder = order[b.relationship] || 99;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          } else {
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          }
        });

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setRelationSearchIndex(prev => Math.min(prev + 1, Math.max(0, filtered.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setRelationSearchIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[relationSearchIndex]) {
          addRelation(filtered[relationSearchIndex].id);
        }
      } else if (e.key === 'Escape') {
        setRelationModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationModalOpen, relationSearch, relationSearchIndex, relationSortBy, person.id, allPeople]);

  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [isSourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingEventIndex, setEditingEventIndex] = useState(null);
  const [eventModalPosition, setEventModalPosition] = useState({ x: window.innerWidth / 2 - 300, y: 100 });
  const [isEventModalDragging, setIsEventModalDragging] = useState(false);
  const [eventModalDragOffset, setEventModalDragOffset] = useState({ x: 0, y: 0 });
  const eventModalRef = useRef(null);
  const [isEventTypeMenuOpen, setEventTypeMenuOpen] = useState(false);
  const [eventTypeMenuPosition, setEventTypeMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 420,
    maxHeight: 460
  });
  const eventTypeMenuRef = useRef(null);
  const eventTypeButtonRef = useRef(null);
  const eventTypeSearchInputRef = useRef(null);
  const eventDateInputRef = useRef(null);
  const [eventTypeSearch, setEventTypeSearch] = useState('');
  const [eventTypeActiveIndex, setEventTypeActiveIndex] = useState(-1);
  const [newEvent, setNewEvent] = useState(() => createEmptyEvent('Födelse'));
  const [isWitnessModalOpen, setWitnessModalOpen] = useState(false);
  const [selectedWitnessId, setSelectedWitnessId] = useState(null);
  const [witnessMode, setWitnessMode] = useState('existing');
  const [witnessSearch, setWitnessSearch] = useState('');
  const [witnessDraft, setWitnessDraft] = useState({
    id: null,
    personId: '',
    name: '',
    role: 'Vittne',
    note: ''
  });

  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const tagInputRef = useRef(null);
  const [selectedEventIndex, setSelectedEventIndex] = useState(null);
  const [eventDetailView, setEventDetailView] = useState('sources'); // 'sources', 'notes', 'images'
  const [dragOverEventIndex, setDragOverEventIndex] = useState(null);
  const [draggedEventIndex, setDraggedEventIndex] = useState(null);
  const [eventSortOverIndex, setEventSortOverIndex] = useState(null);
  // State för högerklicksmeny på händelser
  const [eventContextMenu, setEventContextMenu] = useState({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
  const eventContextMenuRef = useRef(null);
  const [sourceRefreshKey, setSourceRefreshKey] = useState(0);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState(null);
  const [imageEditorContext, setImageEditorContext] = useState('event');
  const [sourceImageViewerMedia, setSourceImageViewerMedia] = useState([]);
  const [sourceThumbHover, setSourceThumbHover] = useState({ open: false, x: 0, y: 0, url: '', name: '' });
  const [isRefCopied, setIsRefCopied] = useState(false);
  const [isRefConflictVisible, setIsRefConflictVisible] = useState(false);
  const refCopyTimeoutRef = useRef(null);
  const refConflictTimeoutRef = useRef(null);
  const [hasClipboardSourceText, setHasClipboardSourceText] = useState(false);
  const [isPastingSourceFromClipboard, setIsPastingSourceFromClipboard] = useState(false);

  const updateSourceThumbHover = (clientX, clientY, url, name = '') => {
    if (!url) return;
    const margin = 14;
    const previewWidth = Math.min(Math.max(window.innerWidth * 0.28, 220), 420);
    const previewHeight = Math.min(Math.max(window.innerHeight * 0.32, 180), 460);

    let x = clientX + 18;
    let y = clientY + 18;

    if (x + previewWidth + margin > window.innerWidth) {
      x = Math.max(margin, clientX - previewWidth - 18);
    }
    if (y + previewHeight + margin > window.innerHeight) {
      y = Math.max(margin, clientY - previewHeight - 18);
    }

    setSourceThumbHover({ open: true, x, y, url, name });
  };

  const closeSourceThumbHover = () => {
    setSourceThumbHover((prev) => (prev.open ? { ...prev, open: false } : prev));
  };

  // State för noteringar-fliken
  const [noteSearch, setNoteSearch] = useState('');
  const [draggedNoteIndex, setDraggedNoteIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Stäng högerklicksmeny när man klickar utanför eller trycker Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (eventContextMenuRef.current && !eventContextMenuRef.current.contains(e.target)) {
        setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
      }
    };

    if (eventContextMenu.isOpen) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [eventContextMenu.isOpen]);

  useEffect(() => {
    if (!eventContextMenu.isOpen) return;

    const clampMenuPosition = () => {
      if (!eventContextMenuRef.current) return;
      const rect = eventContextMenuRef.current.getBoundingClientRect();
      const margin = 8;
      const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
      const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
      const clampedX = Math.min(Math.max(eventContextMenu.x, margin), maxX);
      const clampedY = Math.min(Math.max(eventContextMenu.y, margin), maxY);

      if (clampedX !== eventContextMenu.x || clampedY !== eventContextMenu.y) {
        setEventContextMenu((prev) => ({
          ...prev,
          x: clampedX,
          y: clampedY
        }));
      }
    };

    const rafId = requestAnimationFrame(clampMenuPosition);
    const handleResize = () => clampMenuPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [eventContextMenu.isOpen, eventContextMenu.x, eventContextMenu.y]);

  // State för forskning-fliken
  const [newQuestionInput, setNewQuestionInput] = useState('');
  const [editingTaskIndex, setEditingTaskIndex] = useState(null);

  // Re-render detail block när allSources ändras
  useEffect(() => {
    setSourceRefreshKey(prev => prev + 1);
  }, [allSources]);

  useEffect(() => {
    return () => {
      if (refCopyTimeoutRef.current) {
        clearTimeout(refCopyTimeoutRef.current);
      }
      if (refConflictTimeoutRef.current) {
        clearTimeout(refConflictTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyRefNumber = async () => {
    const refValue = String(person?.refNumber || '').trim();
    if (!refValue) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(refValue);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = refValue;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setIsRefCopied(true);
      if (refCopyTimeoutRef.current) clearTimeout(refCopyTimeoutRef.current);
      refCopyTimeoutRef.current = setTimeout(() => setIsRefCopied(false), 2000);
    } catch (err) {
      console.warn('[EditPersonModal] Kunde inte kopiera Ref Nr:', err);
    }
  };

  const getPersistedRefNumber = useCallback(() => {
    const fromPeople = (Array.isArray(allPeople) ? allPeople : []).find((candidate) => candidate?.id === person?.id);
    const persisted = fromPeople?.refNumber ?? initialPerson?.refNumber ?? '';
    return String(persisted ?? '').trim();
  }, [allPeople, initialPerson?.refNumber, person?.id]);

  const isRefNumberDuplicate = useCallback((refValue) => {
    const normalized = String(refValue ?? '').trim();
    if (!normalized) return false;
    return (Array.isArray(allPeople) ? allPeople : []).some((candidate) => (
      candidate
      && candidate.id !== person?.id
      && String(candidate.refNumber ?? '').trim() === normalized
    ));
  }, [allPeople, person?.id]);

  const flashRefConflict = useCallback(() => {
    setIsRefConflictVisible(true);
    if (refConflictTimeoutRef.current) clearTimeout(refConflictTimeoutRef.current);
    refConflictTimeoutRef.current = setTimeout(() => setIsRefConflictVisible(false), 1600);
  }, []);

  const isBookmarked = Array.isArray(bookmarks) && bookmarks.includes(person?.id);

  // VIKTIGT: Auto-save när person-data ändras (debounced)
  // Detta säkerställer att ALLA ändringar sparas automatiskt i realtid till SQLite
  const personRef = useRef(null);
  const onChangeTimeoutRef2 = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedPersonRef = useRef(null);

  useEffect(() => {
    // Ignorera första mount (när person initialiseras)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      personRef.current = person;
      lastSavedPersonRef.current = person ? JSON.stringify(person) : null;
      return;
    }

    // Om person är null eller undefined, hoppa över
    if (!person) return;

    // Jämför med senaste sparade versionen för att undvika onödiga sparningar
    const currentPersonString = JSON.stringify(person);
    if (currentPersonString === lastSavedPersonRef.current) {
      // Inget har ändrats sedan senaste sparningen
      personRef.current = person;
      return;
    }

    // Rensa tidigare timeout
    if (onChangeTimeoutRef2.current) {
      clearTimeout(onChangeTimeoutRef2.current);
    }

    // Debounce onChange-anropet för att undvika för många uppdateringar
    onChangeTimeoutRef2.current = setTimeout(() => {
      const prevPerson = personRef.current;
      // Kontrollera om person faktiskt har ändrats
      if (prevPerson && person && prevPerson.id === person.id) {
        
        // VALIDERA REF-NUMMER INNAN SPARNING
        if (person.refNumber && String(person.refNumber).trim() !== '') {
          const currentRef = String(person.refNumber).trim();
          if (isRefNumberDuplicate(currentRef)) {
            const fallbackRef = getPersistedRefNumber();
            showStatus(`REF ${currentRef} används redan! Återställer.`, 'error');
            flashRefConflict();
            setPerson(p => ({ ...p, refNumber: fallbackRef }));
            return; // Avbryt autosave för denna
          }
        }

        // Person har ändrats - anropa onChange för att spara automatiskt till SQLite
        if (onChange) {
          console.log('[EditPersonModal] Person ändrad, anropar onChange för auto-save till SQLite', {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            sex: person.sex,
            gender: person.gender,
            refNumber: person.refNumber,
            mediaCount: Array.isArray(person.media) ? person.media.length : 0,
            eventsCount: Array.isArray(person.events) ? person.events.length : 0
          });
          onChange(person);
          lastSavedPersonRef.current = JSON.stringify(person);
        }
      }
      personRef.current = person;
    }, 300); // 300ms debounce för att samla flera ändringar

    return () => {
      if (onChangeTimeoutRef2.current) {
        clearTimeout(onChangeTimeoutRef2.current);
      }
    };
  }, [person, onChange, isRefNumberDuplicate, getPersistedRefNumber, flashRefConflict]);

  // Kontrollera om en händelsetyp redan finns (för unique events)
  const canAddEventType = (eventType) => {
    const eventConfig = EVENT_TYPES.find(e => e.value === eventType);
    if (!eventConfig || !eventConfig.unique) return true;
    return !person.events?.some(e => e.type === eventType);
  };

  const normalizeEventSearchText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const eventTypeOptions = EVENT_TYPES.filter((eventType) => {
    const query = normalizeEventSearchText(eventTypeSearch).trim();
    if (!query) return true;
    const haystack = normalizeEventSearchText(`${eventType.label} ${eventType.value} ${eventType.category}`);
    return haystack.includes(query);
  });

  const hasBirthEvent = Array.isArray(person.events) && person.events.some((eventItem) => eventItem?.type === 'Födelse');
  const hasDeathEvent = Array.isArray(person.events) && person.events.some((eventItem) => eventItem?.type === 'Död');
  const selectedEventTypeConfig = EVENT_TYPES.find((eventType) => eventType.value === newEvent.type);
  const witnessRoleOptionsForType = useMemo(
    () => getWitnessRolesForEventType(newEvent.type, witnessDraft.role),
    [newEvent.type, witnessDraft.role]
  );
  const sortedPeopleForWitnesses = useMemo(() => {
    return [...(allPeople || [])].sort((a, b) => {
      const firstNameA = String(a?.firstName || '').toLocaleLowerCase('sv');
      const firstNameB = String(b?.firstName || '').toLocaleLowerCase('sv');
      if (firstNameA !== firstNameB) return firstNameA.localeCompare(firstNameB, 'sv');

      const lastNameA = String(a?.lastName || '').toLocaleLowerCase('sv');
      const lastNameB = String(b?.lastName || '').toLocaleLowerCase('sv');
      return lastNameA.localeCompare(lastNameB, 'sv');
    });
  }, [allPeople]);
  const linkedPersonsForEvent = useMemo(() => {
    const rawEntries = Array.isArray(newEvent.linkedPersons) ? newEvent.linkedPersons : [];
    const normalized = [];
    const seen = new Set();
    const fallbackRole = getWitnessRolesForEventType(newEvent.type)[0] || 'Vittne';

    rawEntries.forEach((entry, index) => {
      let personId = '';
      let name = '';
      let role = fallbackRole;
      let note = '';
      let stableId = '';

      if (typeof entry === 'string' || typeof entry === 'number') {
        personId = String(entry);
      } else if (entry && typeof entry === 'object') {
        personId = String(entry.personId || entry.linkedPersonId || entry.targetId || '').trim();
        name = String(entry.name || entry.personName || '').trim();
        role = String(entry.role || fallbackRole).trim() || fallbackRole;
        note = String(entry.note || '').trim();
        stableId = String(entry.id || '').trim();
      }

      const personMatch = personId
        ? sortedPeopleForWitnesses.find((candidate) => String(candidate.id) === personId)
        : null;

      const resolvedName = name || (personMatch ? formatWitnessPersonName(personMatch) : '');
      if (!personId && !resolvedName) return;

      const uniqueKey = personId
        ? `person:${personId}`
        : `name:${resolvedName.toLocaleLowerCase('sv')}|role:${role.toLocaleLowerCase('sv')}`;

      if (seen.has(uniqueKey)) return;
      seen.add(uniqueKey);

      normalized.push({
        id: stableId || `witness_${personId || resolvedName.replace(/\s+/g, '_') || index}_${index}`,
        personId,
        name: resolvedName,
        role,
        note
      });
    });

    return normalized;
  }, [newEvent.linkedPersons, sortedPeopleForWitnesses, newEvent.type]);

  const filteredWitnessCandidates = useMemo(() => {
    const query = witnessSearch.trim().toLocaleLowerCase('sv');
    if (!query) return sortedPeopleForWitnesses.slice(0, 60);
    return sortedPeopleForWitnesses
      .filter((candidate) => {
        const haystack = `${candidate.firstName || ''} ${candidate.lastName || ''} ${candidate.refNumber || ''}`
          .toLocaleLowerCase('sv');
        return haystack.includes(query);
      })
      .slice(0, 60);
  }, [witnessSearch, sortedPeopleForWitnesses]);

  const selectedEventFields = useMemo(() => getEventFieldsForType(newEvent.type), [newEvent.type]);

  const updateNewEventField = (fieldKey, value) => {
    setNewEvent((prev) => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  const renderEventTypeField = (field) => {
    const fieldValue = newEvent[field.key] ?? '';
    const inputClassName = 'w-full bg-background border border-subtle rounded p-2 text-primary focus:border-accent focus:outline-none';

    if (field.inputType === 'select') {
      return (
        <div key={field.key} className={field.span === 2 ? 'col-span-2' : ''}>
          <label className="block text-xs font-bold text-secondary uppercase mb-1">{field.label}</label>
          <select
            value={fieldValue}
            onChange={(e) => updateNewEventField(field.key, e.target.value)}
            onKeyDown={handleEventModalInputKeyDown}
            className={inputClassName}
          >
            {(field.options || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.inputType === 'date') {
      return (
        <div key={field.key} className={field.span === 2 ? 'col-span-2' : ''}>
          <label className="block text-xs font-bold text-secondary uppercase mb-1">{field.label}</label>
          <SmartDateField
            value={fieldValue}
            onChange={(value) => updateNewEventField(field.key, value)}
            placeholder={field.placeholder || field.label}
          />
        </div>
      );
    }

    if (field.inputType === 'textarea') {
      return (
        <div key={field.key} className={field.span === 2 ? 'col-span-2' : ''}>
          <label className="block text-xs font-bold text-secondary uppercase mb-1">{field.label}</label>
          <div className="bg-background border border-subtle rounded p-2 min-h-[80px]">
            <Editor
              value={fieldValue}
              onChange={(e) => updateNewEventField(field.key, e.target.value)}
              placeholder={field.placeholder || field.label}
            />
          </div>
        </div>
      );
    }

    return (
      <div key={field.key} className={field.span === 2 ? 'col-span-2' : ''}>
        <label className="block text-xs font-bold text-secondary uppercase mb-1">{field.label}</label>
        <input
          type={field.inputType === 'number' ? 'number' : 'text'}
          value={fieldValue}
          onChange={(e) => updateNewEventField(field.key, e.target.value)}
          onKeyDown={handleEventModalInputKeyDown}
          className={inputClassName}
          placeholder={field.placeholder || field.label}
        />
      </div>
    );
  };

  const renderEventTypeFields = () => {
    if (!selectedEventFields.length) return null;

    return (
      <div className="grid grid-cols-2 gap-3">
        {selectedEventFields.map((field) => renderEventTypeField(field))}
      </div>
    );
  };

  const resetWitnessDraft = (mode = 'existing') => {
    setWitnessMode(mode);
    setWitnessSearch('');
    const defaultRole = getWitnessRolesForEventType(newEvent.type)[0] || 'Vittne';
    setWitnessDraft({
      id: null,
      personId: '',
      name: '',
      role: defaultRole,
      note: ''
    });
    setSelectedWitnessId(null);
  };

  const loadWitnessIntoDraft = (entry) => {
    if (!entry) {
      resetWitnessDraft('existing');
      return;
    }

    setSelectedWitnessId(entry.id);
    setWitnessMode(entry.personId ? 'existing' : 'free');
    setWitnessSearch('');
    setWitnessDraft({
      id: entry.id,
      personId: entry.personId || '',
      name: entry.name || '',
      role: entry.role || (getWitnessRolesForEventType(newEvent.type)[0] || 'Vittne'),
      note: entry.note || ''
    });
  };

  const handlePickWitnessPerson = (personId) => {
    const personMatch = sortedPeopleForWitnesses.find((candidate) => String(candidate.id) === String(personId));
    setWitnessDraft((prev) => ({
      ...prev,
      personId: personMatch ? String(personMatch.id) : '',
      name: personMatch ? formatWitnessPersonName(personMatch) : prev.name
    }));
  };

  const handleSaveWitnessDraft = (closeAfterSave = false) => {
    const defaultRole = getWitnessRolesForEventType(newEvent.type)[0] || 'Vittne';
    const normalizedRole = String(witnessDraft.role || defaultRole).trim() || defaultRole;
    const normalizedNote = String(witnessDraft.note || '').trim();
    const normalizedName = String(witnessDraft.name || '').trim();
    const normalizedPersonId = witnessMode === 'existing'
      ? String(witnessDraft.personId || '').trim()
      : '';

    if (witnessMode === 'existing' && !normalizedPersonId) {
      return;
    }

    if (witnessMode === 'free' && !normalizedName) {
      return;
    }

    const personMatch = normalizedPersonId
      ? sortedPeopleForWitnesses.find((candidate) => String(candidate.id) === normalizedPersonId)
      : null;

    const finalEntry = {
      id: witnessDraft.id || `witness_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      personId: normalizedPersonId,
      name: normalizedPersonId
        ? formatWitnessPersonName(personMatch || { id: normalizedPersonId })
        : normalizedName,
      role: normalizedRole,
      note: normalizedNote
    };

    const currentEntries = linkedPersonsForEvent;
    const isUpdating = Boolean(witnessDraft.id && currentEntries.some((entry) => entry.id === witnessDraft.id));
    const nextEntries = isUpdating
      ? currentEntries.map((entry) => (entry.id === witnessDraft.id ? finalEntry : entry))
      : [...currentEntries, finalEntry];

    setNewEvent((prev) => ({
      ...prev,
      linkedPersons: nextEntries
    }));

    if (closeAfterSave) {
      setWitnessModalOpen(false);
    } else {
      loadWitnessIntoDraft(finalEntry);
    }
  };

  const handleDeleteWitnessEntry = (entryId) => {
    const nextEntries = linkedPersonsForEvent.filter((entry) => entry.id !== entryId);
    setNewEvent((prev) => ({ ...prev, linkedPersons: nextEntries }));

    if (selectedWitnessId === entryId) {
      if (nextEntries.length > 0) {
        loadWitnessIntoDraft(nextEntries[0]);
      } else {
        resetWitnessDraft('existing');
      }
    }
  };

  const getEventWitnessCount = (eventItem) => {
    const linked = Array.isArray(eventItem?.linkedPersons) ? eventItem.linkedPersons : [];
    const unique = new Set();

    linked.forEach((entry) => {
      if (typeof entry === 'string' || typeof entry === 'number') {
        unique.add(`id:${String(entry)}`);
        return;
      }

      if (!entry || typeof entry !== 'object') return;
      const personId = String(entry.personId || entry.linkedPersonId || entry.targetId || '').trim();
      const freeName = String(entry.name || entry.personName || '').trim().toLocaleLowerCase('sv');

      if (personId) {
        unique.add(`id:${personId}`);
      } else if (freeName) {
        unique.add(`name:${freeName}`);
      }
    });

    return unique.size;
  };

  const getNextSelectableEventTypeIndex = (startIndex, direction = 1) => {
    if (!eventTypeOptions.length) return -1;

    for (let step = 0; step < eventTypeOptions.length; step += 1) {
      const candidateIndex = (startIndex + (step * direction) + eventTypeOptions.length) % eventTypeOptions.length;
      const candidate = eventTypeOptions[candidateIndex];
      const isDisabled = candidate?.unique && editingEventIndex === null && !canAddEventType(candidate.value);
      if (!isDisabled) return candidateIndex;
    }

    return -1;
  };

  // Tag handling (samma som MediaManager/SourceCatalog)
  // Få förslag baserat på input (använder centraliserad tag-lista)
  const getTagSuggestions = (input) => {
    if (!input || input.trim().length === 0) return [];
    const allTags = getAllTags ? getAllTags() : [];
    const lowerInput = input.toLowerCase();
    const currentTags = Array.isArray(person?.tags) ? person.tags : [];
    return allTags.filter(tag =>
      tag.toLowerCase().includes(lowerInput) &&
      !currentTags.includes(tag)
    ).slice(0, 5);
  };

  // Lägg till tagg
  const handleAddTag = (tagText) => {
    if (!tagText || tagText.trim().length === 0) return;

    const tag = tagText.trim();
    const currentTags = Array.isArray(person.tags) ? person.tags : [];

    // Kontrollera om taggen redan finns
    if (currentTags.includes(tag)) {
      setTagInput('');
      setTagSuggestions([]);
      return;
    }

    // Lägg till taggen
    setPerson({ ...person, tags: [...currentTags, tag] });
    setTagInput('');
    setTagSuggestions([]);

    // Fokusera tagg-input igen efter att taggen lagts till
    setTimeout(() => {
      if (tagInputRef.current) {
        tagInputRef.current.focus();
      }
    }, 50);
  };

  const removeTag = (tagToRemove) => {
    setPerson({ ...person, tags: person.tags.filter(t => t !== tagToRemove) });
  };

  const getEventByCandidateTypes = (candidateTypes) => {
    const normalizedCandidates = candidateTypes.map((candidate) => String(candidate || '').toLowerCase());
    return (person.events || []).find((eventItem) => normalizedCandidates.includes(String(eventItem?.type || '').toLowerCase()));
  };

  const getRelatedPersonName = (relationEntry) => {
    const relationId = typeof relationEntry === 'object' ? relationEntry?.id : relationEntry;
    const personMatch = (allPeople || []).find((candidate) => candidate.id === relationId);
    if (personMatch) {
      return `${personMatch.firstName || ''} ${personMatch.lastName || ''}`.trim();
    }
    if (typeof relationEntry === 'object' && relationEntry?.name) {
      return relationEntry.name;
    }
    return '';
  };

  const handleGenerateBiography = () => {
    const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Okänd person';
    const birthEvent = getEventByCandidateTypes(['Födelse', 'BIRT', 'Birth']);
    const deathEvent = getEventByCandidateTypes(['Död', 'DEAT', 'Death']);
    const occupationEvents = (person.events || []).filter((eventItem) =>
      ['yrke', 'occu', 'occupation', 'titel', 'title'].includes(String(eventItem?.type || '').toLowerCase())
    );

    const uniquePlaces = Array.from(new Set(
      (person.events || [])
        .map((eventItem) => String(eventItem?.place || '').trim())
        .filter(Boolean)
    ));

    const parentNames = (person.relations?.parents || []).map(getRelatedPersonName).filter(Boolean);
    const partnerNames = (person.relations?.partners || []).map(getRelatedPersonName).filter(Boolean);
    const childNames = (person.relations?.children || []).map(getRelatedPersonName).filter(Boolean);

    const lines = [];
    let intro = `${fullName} `;

    if (birthEvent?.date || birthEvent?.place) {
      const birthDateText = birthEvent?.date ? `född ${birthEvent.date}` : 'född';
      const birthPlaceText = birthEvent?.place ? ` i ${birthEvent.place}` : '';
      intro += `var ${birthDateText}${birthPlaceText}`;
    } else {
      intro += 'är en person i släktträdet';
    }

    if (deathEvent?.date || deathEvent?.place) {
      const deathDateText = deathEvent?.date ? ` och avled ${deathEvent.date}` : ' och avled';
      const deathPlaceText = deathEvent?.place ? ` i ${deathEvent.place}` : '';
      intro += `${deathDateText}${deathPlaceText}`;
    }

    intro += '.';
    lines.push(intro);

    if (occupationEvents.length > 0) {
      const occupationSummary = occupationEvents
        .map((eventItem) => [eventItem.type, eventItem.notes || eventItem.date || ''].filter(Boolean).join(' - '))
        .slice(0, 3)
        .join(', ');
      lines.push(`Kända yrken eller roller: ${occupationSummary}.`);
    }

    if (uniquePlaces.length > 0) {
      const placeSummary = uniquePlaces.slice(0, 5).join(', ');
      lines.push(`Personen är knuten till följande platser: ${placeSummary}.`);
    }

    if (parentNames.length > 0) {
      lines.push(`Föräldrar: ${parentNames.join(' och ')}.`);
    }

    if (partnerNames.length > 0) {
      lines.push(`Partner: ${partnerNames.join(', ')}.`);
    }

    if (childNames.length > 0) {
      lines.push(`Barn: ${childNames.join(', ')}.`);
    }

    const now = new Date().toISOString();
    const existingBiographyCount = (person.notes || []).filter((noteItem) =>
      String(noteItem?.title || '').toLowerCase().startsWith('biografi')
    ).length;

    const biographyNote = {
      id: `note_biography_${Date.now()}`,
      title: existingBiographyCount > 0 ? `Biografi ${existingBiographyCount + 1}` : 'Biografi',
      content: `<p>${lines.join('</p><p>')}</p>`,
      createdAt: now,
      modifiedAt: now
    };

    setPerson((prev) => ({
      ...prev,
      notes: [...(prev.notes || []), biographyNote]
    }));
  };

  const inferImageExtension = (url = '', mimeType = '') => {
    const mimeMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp'
    };

    if (mimeType && mimeMap[mimeType]) return mimeMap[mimeType];

    const urlWithoutQuery = String(url || '').split('?')[0].split('#')[0];
    const extMatch = urlWithoutQuery.match(/\.([a-zA-Z0-9]+)$/);
    if (extMatch && extMatch[1]) return extMatch[1].toLowerCase();

    return 'jpg';
  };

  const sanitizeFilename = (input, fallback = 'bild') => {
    const cleaned = String(input || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
    return cleaned || fallback;
  };

  const resolveMediaToBlob = async (imageUrl) => {
    if (!imageUrl) throw new Error('Saknar bild-URL');

    if (imageUrl.startsWith('media://')) {
      if (!window.electronAPI || typeof window.electronAPI.readFile !== 'function') {
        throw new Error('media:// kräver Electron API för fil-läsning');
      }

      let filePath = imageUrl.replace('media://', '');
      try {
        filePath = decodeURIComponent(filePath);
      } catch {
        filePath = filePath.replace(/%2F/g, '/').replace(/%20/g, ' ').replace(/%5C/g, '\\');
      }
      filePath = filePath.replace(/%2F/g, '/');

      const fileData = await window.electronAPI.readFile(filePath);
      if (!fileData || fileData.error) {
        throw new Error(fileData?.error || 'Kunde inte läsa mediafil');
      }

      let uint8Array;
      if (fileData instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(fileData);
      } else if (fileData instanceof Uint8Array) {
        uint8Array = fileData;
      } else if (fileData.data instanceof Uint8Array) {
        uint8Array = fileData.data;
      } else if (fileData.data instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(fileData.data);
      } else if (Array.isArray(fileData.data)) {
        uint8Array = new Uint8Array(fileData.data);
      } else if (Array.isArray(fileData)) {
        uint8Array = new Uint8Array(fileData);
      } else {
        uint8Array = new Uint8Array(fileData.data || fileData);
      }

      const extension = inferImageExtension(filePath);
      const mimeType = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp'
      }[extension] || 'image/jpeg';

      return new Blob([uint8Array], { type: mimeType });
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Kunde inte ladda bild (${response.status})`);
    }
    return response.blob();
  };

  const handleDownloadPersonImages = async () => {
    const mediaList = Array.isArray(person.media) ? person.media : [];
    if (mediaList.length === 0) {
      alert('Personen har inga bilder att ladda ner.');
      return;
    }

    const zip = new JSZip();
    const nameCounts = new Map();

    for (let index = 0; index < mediaList.length; index += 1) {
      const mediaItem = mediaList[index];
      const imageUrl = mediaItem?.url || mediaItem?.path || '';

      try {
        const blob = await resolveMediaToBlob(imageUrl);
        const extension = inferImageExtension(imageUrl, blob.type);
        const baseName = sanitizeFilename(
          mediaItem?.name || mediaItem?.title || `${person.firstName || 'person'}_${person.lastName || 'bild'}_${index + 1}`,
          `bild_${index + 1}`
        );

        const extensionWithDot = extension ? `.${extension}` : '';
        const initialFileName = `${baseName}${extensionWithDot}`;
        const count = nameCounts.get(initialFileName) || 0;
        nameCounts.set(initialFileName, count + 1);

        const uniqueFileName = count === 0
          ? initialFileName
          : `${baseName}_${count + 1}${extensionWithDot}`;

        zip.file(uniqueFileName, await blob.arrayBuffer());
      } catch (error) {
        console.error('Kunde inte lägga till bild i zip:', error);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const personName = sanitizeFilename(
      `${person.firstName || 'person'}_${person.lastName || 'bilder'}`,
      'person_bilder'
    );

    const zipUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = `${personName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(zipUrl);
  };

  // Event handling
  const handleAddEvent = () => {
    if (isEventTypeMenuOpen) {
      closeEventTypeMenu();
      return;
    }

    const buttonRect = eventTypeButtonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;

    const viewportPadding = 12;
    const menuWidth = 420;
    const maxHeight = Math.min(460, window.innerHeight - viewportPadding * 2);
    const placeBelow = buttonRect.bottom + 8 + maxHeight <= window.innerHeight - viewportPadding;
    const top = placeBelow
      ? buttonRect.bottom + 8
      : Math.max(viewportPadding, buttonRect.top - 8 - maxHeight);
    const left = Math.min(
      Math.max(viewportPadding, buttonRect.left),
      window.innerWidth - menuWidth - viewportPadding
    );

    setEventTypeMenuPosition({ top, left, width: menuWidth, maxHeight });
    setEventTypeSearch('');
    setEventTypeMenuOpen(true);
  };

  const closeEventTypeMenu = () => {
    setEventTypeSearch('');
    setEventTypeActiveIndex(-1);
    setEventTypeMenuOpen(false);
  };

  const handleSelectEventType = (eventType) => {
    if (editingEventIndex === null && !canAddEventType(eventType)) {
      return;
    }

    setEditingEventIndex(null);
    setNewEvent(createEmptyEvent(eventType, { id: `evt_${Date.now()}_${eventType}` }));
    resetWitnessDraft('existing');
    setWitnessModalOpen(false);
    setEventTypeMenuOpen(false);
    setEventModalOpen(true);
  };

  const handleQuickAddEvent = (eventType) => {
    handleSelectEventType(eventType);
  };

  const handleEventTypeMenuKeyDown = (e) => {
    if (!eventTypeOptions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const start = eventTypeActiveIndex === -1 ? 0 : (eventTypeActiveIndex + 1) % eventTypeOptions.length;
      const next = getNextSelectableEventTypeIndex(start, 1);
      if (next !== -1) setEventTypeActiveIndex(next);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const start = eventTypeActiveIndex === -1
        ? eventTypeOptions.length - 1
        : (eventTypeActiveIndex - 1 + eventTypeOptions.length) % eventTypeOptions.length;
      const next = getNextSelectableEventTypeIndex(start, -1);
      if (next !== -1) setEventTypeActiveIndex(next);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = eventTypeOptions[eventTypeActiveIndex] || eventTypeOptions[0];
      if (!selected) return;
      handleSelectEventType(selected.value);
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeEventTypeMenu();
    }
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setEditingEventIndex(null);
    setEventTypeMenuOpen(false);
    setWitnessModalOpen(false);
  };

  const handleEditEvent = (eventId, openWitnessEditor = false) => {
    // Hitta rätt index i den ursprungliga person.events arrayen baserat på eventId
    const actualIndex = person.events.findIndex(e => e.id === eventId);
    if (actualIndex === -1) {
      console.error('[EditPersonModal] Kunde inte hitta händelse med id:', eventId);
      return;
    }
    setEditingEventIndex(actualIndex);
    const existingEvent = person.events[actualIndex] || {};
    const normalizedExistingEvent = normalizeEventForType(existingEvent);
    setNewEvent(normalizedExistingEvent);
    resetWitnessDraft('existing');
    setWitnessModalOpen(false);
    setEventModalOpen(true);

    if (openWitnessEditor) {
      const firstWitness = Array.isArray(existingEvent.linkedPersons) ? existingEvent.linkedPersons[0] : null;
      window.setTimeout(() => {
        if (firstWitness && (typeof firstWitness === 'string' || typeof firstWitness === 'number')) {
          const personId = String(firstWitness);
          const personMatch = sortedPeopleForWitnesses.find((candidate) => String(candidate.id) === personId);
          setSelectedWitnessId(null);
          setWitnessMode('existing');
          setWitnessSearch('');
          setWitnessDraft({
            id: null,
            personId,
            name: personMatch ? formatWitnessPersonName(personMatch) : '',
            role: getWitnessRolesForEventType(existingEvent.type)[0] || 'Vittne',
            note: ''
          });
        } else if (firstWitness && typeof firstWitness === 'object') {
          const personId = String(firstWitness.personId || firstWitness.linkedPersonId || firstWitness.targetId || '').trim();
          const mode = personId ? 'existing' : 'free';
          setSelectedWitnessId(firstWitness.id || null);
          setWitnessMode(mode);
          setWitnessSearch('');
          setWitnessDraft({
            id: firstWitness.id || null,
            personId,
            name: String(firstWitness.name || firstWitness.personName || '').trim(),
            role: String(firstWitness.role || (getWitnessRolesForEventType(existingEvent.type)[0] || 'Vittne')).trim() || (getWitnessRolesForEventType(existingEvent.type)[0] || 'Vittne'),
            note: String(firstWitness.note || '').trim()
          });
        } else {
          resetWitnessDraft('existing');
        }

        setWitnessModalOpen(true);
      }, 0);
    }
  };

  const openWitnessEditorForEvent = (eventId) => {
    const actualIndex = person.events.findIndex((eventItem) => eventItem.id === eventId);
    if (actualIndex === -1) {
      console.error('[EditPersonModal] Kunde inte hitta händelse med id för vittnesredigering:', eventId);
      return;
    }

    const existingEvent = person.events[actualIndex] || {};
    setEditingEventIndex(actualIndex);
    setNewEvent(normalizeEventForType(existingEvent));

    setEventModalOpen(false);

    const firstWitness = Array.isArray(existingEvent.linkedPersons) ? existingEvent.linkedPersons[0] : null;
    window.setTimeout(() => {
      if (firstWitness && (typeof firstWitness === 'string' || typeof firstWitness === 'number')) {
        const personId = String(firstWitness);
        const personMatch = sortedPeopleForWitnesses.find((candidate) => String(candidate.id) === personId);
        setSelectedWitnessId(null);
        setWitnessMode('existing');
        setWitnessSearch('');
        setWitnessDraft({
          id: null,
          personId,
          name: personMatch ? formatWitnessPersonName(personMatch) : '',
          role: getWitnessRolesForEventType(existingEvent.type)[0] || 'Vittne',
          note: ''
        });
      } else if (firstWitness && typeof firstWitness === 'object') {
        const personId = String(firstWitness.personId || firstWitness.linkedPersonId || firstWitness.targetId || '').trim();
        const mode = personId ? 'existing' : 'free';
        setSelectedWitnessId(firstWitness.id || null);
        setWitnessMode(mode);
        setWitnessSearch('');
        setWitnessDraft({
          id: firstWitness.id || null,
          personId,
          name: String(firstWitness.name || firstWitness.personName || '').trim(),
          role: String(firstWitness.role || (getWitnessRolesForEventType(existingEvent.type)[0] || 'Vittne')).trim() || (getWitnessRolesForEventType(existingEvent.type)[0] || 'Vittne'),
          note: String(firstWitness.note || '').trim()
        });
      } else {
        resetWitnessDraft('existing');
      }

      setWitnessModalOpen(true);
    }, 0);
  };

  const handleDropSourceOnEvent = (evt, eventId, eventDisplayIndex) => {
    evt.preventDefault();
    evt.stopPropagation();

    let payload = null;
    try {
      payload = JSON.parse(evt.dataTransfer.getData('application/json') || '{}');
    } catch (error) {
      payload = null;
    }

    if (!payload || payload.type !== 'source' || !payload.id) {
      setDragOverEventIndex(null);
      return;
    }

    if (!Array.isArray(person.events)) {
      setDragOverEventIndex(null);
      return;
    }

    const actualIndex = person.events.findIndex((eventItem) => eventItem.id === eventId);
    if (actualIndex === -1) {
      setDragOverEventIndex(null);
      return;
    }

    const targetEvent = person.events[actualIndex] || {};
    const targetSources = Array.isArray(targetEvent.sources) ? targetEvent.sources : [];
    const sourceAlreadyLinked = targetSources.includes(payload.id);

    if (sourceAlreadyLinked) {
      setDragOverEventIndex(null);
      setSelectedEventIndex(eventDisplayIndex);
      setEventDetailView('sources');
      showStatus('Källan är redan kopplad till denna händelse.', 'warning');
      return;
    }

    const updatedEvents = person.events.map((eventItem, index) => {
      if (index !== actualIndex) return eventItem;
      const currentSources = Array.isArray(eventItem.sources) ? eventItem.sources : [];
      return {
        ...eventItem,
        sources: [...currentSources, payload.id]
      };
    });

    const updatedPerson = { ...person, events: updatedEvents };
    setPerson(updatedPerson);
    if (onChange) onChange(updatedPerson);
    setDragOverEventIndex(null);
    setSelectedEventIndex(eventDisplayIndex);
    setEventDetailView('sources');
    showStatus('Källa kopplad till händelsen.');
  };

  const handleEventDragStart = (e, index) => {
    setDraggedEventIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleEventDragEnd = (e) => {
    setDraggedEventIndex(null);
    setEventSortOverIndex(null);
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleEventSortDragOver = (e, overIndex) => {
    e.preventDefault();
    setEventSortOverIndex(overIndex);
  };

  const handleEventSortDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedEventIndex === null || draggedEventIndex === dropIndex) {
      setEventSortOverIndex(null);
      return;
    }

    const newEvents = Array.isArray(person.events) ? [...person.events] : [];
    const draggedEvent = newEvents[draggedEventIndex];
    if (!draggedEvent) {
      setEventSortOverIndex(null);
      return;
    }

    newEvents.splice(draggedEventIndex, 1);
    newEvents.splice(dropIndex, 0, draggedEvent);

    const updatedPerson = { ...person, events: newEvents };
    setPerson(updatedPerson);
    if (onChange) onChange(updatedPerson);

    setDraggedEventIndex(null);
    setEventSortOverIndex(null);
  };

  const handleEventTypeChange = (nextType) => {
    if (!nextType || nextType === newEvent.type) return;

    if (linkedPersonsForEvent.length > 0) {
      const confirmed = window.confirm('Om du byter händelsetyp kommer de kopplade vittnena/medverkande att raderas eftersom deras roller kanske inte längre stämmer. Vill du fortsätta?');
      if (!confirmed) return;
    }

    const nextTypeConfig = getEventTypeConfig(nextType);
    const nextGedcomType = nextTypeConfig?.gedcomType || 'event';

    setNewEvent((prev) => normalizeEventForType({
      ...prev,
      type: nextType,
      gedcomType: nextGedcomType,
      linkedPersons: [],
      cause: '',
      customType: nextType === 'Egen händelse' ? String(prev.customType || '').trim() : ''
    }));

    resetWitnessDraft('existing');
  };

  const handleSaveEvent = () => {
    const eventConfig = getEventTypeConfig(newEvent.type);
    const resolvedGedcomType = eventConfig?.gedcomType || newEvent.gedcomType || 'event';
    const normalizedEvent = normalizeEventForType({
      ...newEvent,
      gedcomType: resolvedGedcomType,
      linkedPersons: linkedPersonsForEvent.map((entry) => ({
        id: entry.id,
        personId: entry.personId || '',
        name: String(entry.name || '').trim(),
        role: String(entry.role || (getWitnessRolesForEventType(newEvent.type)[0] || 'Vittne')).trim() || (getWitnessRolesForEventType(newEvent.type)[0] || 'Vittne'),
        note: String(entry.note || '').trim()
      }))
      .filter((entry) => entry.personId || entry.name)
    });

    if (resolvedGedcomType === 'custom') {
      normalizedEvent.customType = String(newEvent.customType || normalizedEvent.customType || '').trim();
    }

    // Validera: om det är en ny händelse (inte redigering) och händelsen är unique, kolla om den redan finns
    if (editingEventIndex === null) {
      if (eventConfig?.unique && person.events?.some(e => e.type === newEvent.type)) {
        alert(`Händelsen "${newEvent.type}" finns redan och kan bara läggas till en gång.`);
        return;
      }
    }

    if (editingEventIndex !== null) {
      const updated = person.events.map((e, i) => i === editingEventIndex ? normalizedEvent : e);
      setPerson({ ...person, events: updated });
    } else {
      setPerson({ ...person, events: [...person.events, normalizedEvent] });
    }
    setEventModalOpen(false);
    setEditingEventIndex(null);
    setWitnessModalOpen(false);
    resetWitnessDraft('existing');
    setNewEvent(createEmptyEvent('Födelse'));
  };

  const handleEventModalInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEvent();
    }
  };

  const handleDeleteEvent = (index) => {
    setPerson({ ...person, events: person.events.filter((_, i) => i !== index) });
    // Reset modal state if open
    setEventModalOpen(false);
    setEditingEventIndex(null);
    setWitnessModalOpen(false);
    resetWitnessDraft('existing');
    setNewEvent(createEmptyEvent('Födelse'));
  };

  const readClipboardText = useCallback(async () => {
    if (!navigator?.clipboard?.readText) return '';
    try {
      return String(await navigator.clipboard.readText() || '').trim();
    } catch (err) {
      return '';
    }
  }, []);

  const refreshClipboardSourceAvailability = useCallback(async () => {
    const text = await readClipboardText();
    setHasClipboardSourceText(Boolean(text));
    return text;
  }, [readClipboardText]);

  // Högerklicksmeny handler för händelser
  const handleEventContextMenu = (e, eventIndex, eventId) => {
    e.preventDefault();
    setEventContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      eventIndex,
      eventId
    });
    refreshClipboardSourceAvailability();
  };

  // Kopiera händelse (utan ID) till localStorage
  const handleCopyEvent = (eventIndex) => {
    const evt = person.events[eventIndex];
    if (!evt) return;
    
    const eventCopy = { ...evt };
    delete eventCopy.id;
    
    localStorage.setItem('copiedEvent', JSON.stringify(eventCopy));
    showStatus('Händelse kopierad');
    setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
  };

  // Kopiera källtexten från en händelse till systemets clipboard
  const handleCopyEventSources = async (eventIndex) => {
    const evt = person.events[eventIndex];
    const sourceIds = Array.isArray(evt?.sources) ? evt.sources : [];
    if (sourceIds.length === 0) {
      showStatus('Händelsen saknar källor att kopiera.', 'warning');
      return;
    }

    const sourcesToCopy = sourceIds
      .map((id) => allSources?.find((source) => String(source?.id) === String(id)))
      .filter(Boolean);

    if (sourcesToCopy.length === 0) {
      showStatus('Källor hittades inte i källkatalogen.', 'error');
      return;
    }

    const textToCopy = sourcesToCopy
      .map((source) => {
        const formatted = buildSourceString(source);
        const fallback = source.sourceString || source.title || '';
        return String(formatted || fallback).trim();
      })
      .filter(Boolean)
      .join('\n');

    if (!textToCopy) {
      showStatus('Källan saknar kopierbar text.', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setHasClipboardSourceText(true);
      showStatus('Källtext kopierad till clipboard.');
    } catch (err) {
      showStatus('Kunde inte kopiera källtext till clipboard.', 'error');
    }

    setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
  };

  const handlePasteSourceToSavedEvent = async (eventIndex) => {
    const evt = person.events[eventIndex];
    if (!evt?.id) {
      showStatus('Händelsen hittades inte.', 'error');
      return;
    }

    const clipboardText = await refreshClipboardSourceAvailability();
    if (!clipboardText) {
      showStatus('Clipboard saknar text att klistra in.', 'warning');
      return;
    }

    setIsPastingSourceFromClipboard(true);
    try {
      const result = handleQuickPasteSource(person.id, evt.id, clipboardText);
      if (!result?.success || !result.sourceId) return;

      const updatedEvents = (Array.isArray(person.events) ? person.events : []).map((eventItem, idx) => {
        if (idx !== eventIndex) return eventItem;
        const existingIds = Array.isArray(eventItem?.sources) ? eventItem.sources : [];
        if (existingIds.includes(result.sourceId)) return eventItem;
        return {
          ...eventItem,
          sources: [...existingIds, result.sourceId]
        };
      });

      const updatedPerson = { ...person, events: updatedEvents };
      setPerson(updatedPerson);
      if (typeof onChange === 'function') onChange(updatedPerson);
      setSourceRefreshKey((prev) => prev + 1);
      setSelectedEventIndex(eventIndex);
      setEventDetailView('sources');
    } finally {
      setIsPastingSourceFromClipboard(false);
      setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
    }
  };

  const handlePasteSourceToEditingEvent = async () => {
    const clipboardText = await refreshClipboardSourceAvailability();
    if (!clipboardText) {
      showStatus('Clipboard saknar text att klistra in.', 'warning');
      return;
    }

    setIsPastingSourceFromClipboard(true);
    try {
      const result = handleQuickPasteSource(person.id, '__editing__', clipboardText);
      if (!result?.success || !result.sourceId) return;

      setNewEvent((prev) => {
        const currentSources = Array.isArray(prev?.sources) ? prev.sources : [];
        if (currentSources.includes(result.sourceId)) {
          return prev;
        }
        return {
          ...prev,
          sources: [...currentSources, result.sourceId]
        };
      });
    } finally {
      setIsPastingSourceFromClipboard(false);
      refreshClipboardSourceAvailability();
    }
  };

  // Kopiera händelse som text
  const handleCopyEventAsText = (eventIndex) => {
    const evt = person.events[eventIndex];
    if (!evt) return;

    const text = `[${evt.type}]: ${evt.date || '-'} i ${evt.place || '-'}`;
    navigator.clipboard.writeText(text).then(() => {
      showStatus('Kopierat som text');
    }).catch(err => {
      console.error('Fel vid kopiering:', err);
    });

    setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
  };

  const hasCopiedEvent = Boolean(typeof window !== 'undefined' && window.localStorage.getItem('copiedEvent'));

  const contextMenuEvent = eventContextMenu.eventIndex !== null
    ? person.events?.[eventContextMenu.eventIndex]
    : null;
  const hasContextMenuEvent = Boolean(contextMenuEvent);
  const hasContextMenuSources = Array.isArray(contextMenuEvent?.sources) && contextMenuEvent.sources.length > 0;

  // Sök händelse i Riksarkivet
  const handleSearchInArchive = (eventIndex) => {
    const evt = person.events[eventIndex];
    if (!evt) return;

    const searchStr = `${person.firstName || ''} ${person.lastName || ''} ${evt.date || ''} ${evt.place || ''}`.trim();
    const url = `https://sok.riksarkivet.se/?Sokord=${encodeURIComponent(searchStr)}`;
    
    window.open(url, '_blank');
    setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
  };

  // Klistra in tidigare kopierad händelse
  const handlePasteEvent = () => {
    const copiedStr = localStorage.getItem('copiedEvent');
    if (!copiedStr) {
      showStatus('Ingen händelse att klistra in');
      return;
    }

    try {
      const copiedEvent = JSON.parse(copiedStr);
      const eventConfig = EVENT_TYPES.find((eventType) => eventType.value === copiedEvent?.type);

      if (eventConfig?.unique && Array.isArray(person.events) && person.events.some((eventItem) => eventItem?.type === copiedEvent?.type)) {
        showStatus('Den här händelsen får man endast ha en av');
        return;
      }

      const newEvent = {
        ...copiedEvent,
        id: `evt_${Date.now()}`
      };

      setPerson({
        ...person,
        events: [...(person.events || []), newEvent]
      });

      showStatus('Händelse inklistrad');
      setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
    } catch (err) {
      console.error('Fel vid klistring av händelse:', err);
    }
  };

  const handleAddSource = (source) => {
    const updatedEvent = {
      ...newEvent,
      sources: [...(newEvent.sources || []), { id: `src_${Date.now()}`, ...source }]
    };
    setNewEvent(updatedEvent);
  };

  // Event Modal dragging handlers
  const handleEventModalMouseDown = (e) => {
    if (e.target.closest('.modal-header')) {
      setIsEventModalDragging(true);
      const rect = eventModalRef.current.getBoundingClientRect();
      setEventModalDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleEventModalMouseMove = (e) => {
    if (!isEventModalDragging) return;
    setEventModalPosition({
      x: e.clientX - eventModalDragOffset.x,
      y: e.clientY - eventModalDragOffset.y
    });
  };

  const handleEventModalMouseUp = () => {
    setIsEventModalDragging(false);
  };

  useEffect(() => {
    if (isEventModalDragging) {
      document.addEventListener('mousemove', handleEventModalMouseMove);
      document.addEventListener('mouseup', handleEventModalMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleEventModalMouseMove);
        document.removeEventListener('mouseup', handleEventModalMouseUp);
      };
    }
  }, [isEventModalDragging, eventModalDragOffset]);

  useEffect(() => {
    if (!isEventTypeMenuOpen) return;

    const firstSelectable = getNextSelectableEventTypeIndex(0, 1);
    setEventTypeActiveIndex(firstSelectable);

    const focusTimer = window.setTimeout(() => {
      if (eventTypeSearchInputRef.current) {
        eventTypeSearchInputRef.current.focus();
      }
    }, 10);

    const handleClickOutside = (e) => {
      if (eventTypeMenuRef.current && eventTypeMenuRef.current.contains(e.target)) {
        return;
      }

      if (eventTypeButtonRef.current && eventTypeButtonRef.current.contains(e.target)) {
        return;
      }

      closeEventTypeMenu();
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeEventTypeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEventTypeMenuOpen, eventTypeOptions.length]);

  useEffect(() => {
    if (!isEventModalOpen) return;

    const focusTimer = window.setTimeout(() => {
      if (eventDateInputRef.current) {
        eventDateInputRef.current.focus();
      }
    }, 10);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isEventModalOpen, editingEventIndex]);

  useEffect(() => {
    if (!isEventModalOpen && !eventContextMenu.isOpen) return;

    refreshClipboardSourceAvailability();

    const onWindowFocus = () => {
      refreshClipboardSourceAvailability();
    };

    window.addEventListener('focus', onWindowFocus);
    return () => {
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [isEventModalOpen, eventContextMenu.isOpen, refreshClipboardSourceAvailability]);

  useEffect(() => {
    if (!isEventTypeMenuOpen) return;
    const next = getNextSelectableEventTypeIndex(0, 1);
    setEventTypeActiveIndex(next);
  }, [eventTypeSearch, isEventTypeMenuOpen]);

  // Image paste handler - TAS BORT: MediaSelector hanterar paste nu

  // handleSave borttagen - ändringar sparas automatiskt via onChange

  return (
    <>
      {/* BARA INNEHÅL - WindowFrame hanterar containern */}
      <div className="w-full h-full bg-surface flex flex-col overflow-hidden">
        {/* HEADER - Döljs när isDocked är true, MEN flikarna behålls */}
        {!isDocked ? (
          <div className="modal-header h-16 bg-surface-2 border-b border-subtle flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4 select-none">
              <button
                type="button"
                onClick={openPrimaryProfileImage}
                className="w-10 h-10 rounded-full bg-surface overflow-hidden border-2 border-strong hover:border-accent transition-colors"
                style={person?.color ? { borderColor: person.color, boxShadow: `0 0 0 1px ${person.color}55` } : undefined}
                title={person.media?.length > 0 ? 'Öppna profilbild' : 'Lägg till profilbild'}
                aria-label={person.media?.length > 0 ? 'Öppna profilbild' : 'Lägg till profilbild'}
              >
                {person.media?.length > 0 ? (
                  <MediaImage
                    url={person.media[0].url || person.media[0].path}
                    alt="Profil"
                    className="w-full h-full object-cover"
                    style={primaryAvatarStyle}
                  />
                ) : (
                  <User className="w-full h-full p-1 text-muted" />
                )}
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-primary leading-tight">
                    {person.firstName} {person.lastName}
                  </h1>
                  {person?.color && (
                    <span
                      className="inline-flex w-2.5 h-2.5 rounded-full border border-subtle"
                      style={{ backgroundColor: person.color }}
                      title={`Grenfärg: ${person.color}`}
                    />
                  )}
                  {typeof onViewInFamilyTree === 'function' && person?.id && (
                    <button
                      type="button"
                      onClick={() => onViewInFamilyTree(person.id)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded border border-subtle text-secondary hover:text-accent hover:border-accent hover:bg-accent-soft transition-colors"
                      title="Visa i släktträd"
                      aria-label="Visa i släktträd"
                    >
                      <Network className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPrintSettingsOpen(true)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded border border-subtle text-secondary hover:text-accent hover:border-accent hover:bg-accent-soft transition-colors"
                    title="Skapa personakt"
                    aria-label="Skapa personakt"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof handleToggleBookmark === 'function' && person?.id) {
                        handleToggleBookmark(person.id);
                      }
                    }}
                    className={`p-1 rounded transition-colors ${isBookmarked ? 'text-warning hover:text-warning' : 'text-muted hover:text-primary'}`}
                    title={isBookmarked ? 'Ta bort bokmärke' : 'Lägg till bokmärke'}
                    aria-label={isBookmarked ? 'Ta bort bokmärke' : 'Lägg till bokmärke'}
                  >
                    <Star className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-muted">
                  {(() => {
                    const { birthYear, deathYear, lifeSpan } = getLifeInfo(person);
                    if (birthYear && deathYear && lifeSpan !== null) {
                      return `${birthYear} — ${deathYear} (ca. ${lifeSpan} år)`;
                    } else if (birthYear && deathYear) {
                      return `${birthYear} — ${deathYear}`;
                    } else if (birthYear) {
                      return `${birthYear} — Levande`;
                    } else {
                      return '? — ?';
                    }
                  })()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Collapse/Expand button */}
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-2 hover:bg-surface rounded text-secondary hover:text-primary transition-colors"
                  title={isCollapsed ? "Expandera" : "Fäll in"}
                >
                  {isCollapsed ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronUp className="w-5 h-5" />
                  )}
                </button>
              )}
              <nav className="flex gap-1">
                {[
                  { id: 'info', icon: User, label: 'Info' },
                  { id: 'relations', icon: Users, label: 'Relationer' },
                  { id: 'media', icon: ImageIcon, label: 'Media' },
                  { id: 'notes', icon: FileText, label: 'Noteringar' },
                  { id: 'research', icon: Activity, label: 'Forskning' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    aria-label={tab.label}
                    className={`inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition-all relative ${activeTab === tab.id
                      ? 'bg-background text-accent border-b-2 border-accent'
                      : 'text-muted hover:text-primary hover:bg-surface-2 border-b-2 border-transparent'
                      }`}
                  >
                    <tab.icon size={16} />
                  </button>
                ))}
              </nav>
            </div>
          </div>
        ) : (
          // När dockad: Visa bara flikarna (utan header med profilbild/namn)
          <div className="border-b border-subtle bg-surface-2 px-4 py-2 shrink-0">
            <nav className="flex gap-1">
              {[
                { id: 'info', icon: User, label: 'Info' },
                { id: 'relations', icon: Users, label: 'Relationer' },
                { id: 'media', icon: ImageIcon, label: 'Media' },
                { id: 'notes', icon: FileText, label: 'Noteringar' },
                { id: 'research', icon: Activity, label: 'Forskning' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  aria-label={tab.label}
                  className={`inline-flex items-center justify-center px-3 py-2 text-sm font-medium transition-all relative ${activeTab === tab.id
                    ? 'bg-background text-accent border-b-2 border-accent'
                    : 'text-muted hover:text-primary hover:bg-surface-2 border-b-2 border-transparent'
                    }`}
                >
                  <tab.icon size={16} />
                </button>
              ))}
            </nav>
          </div>
        )}

        {isPrintSettingsOpen && (
          <div className="fixed inset-0 z-[4300] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-subtle bg-surface-2 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-primary">Utskriftsinställningar</h3>
                  <p className="text-xs text-muted mt-1">Välj innehåll som ska ingå i personakten.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintSettingsOpen(false)}
                  className="w-8 h-8 rounded border border-subtle text-secondary hover:text-primary hover:bg-surface transition-colors"
                  title="Stäng"
                  aria-label="Stäng"
                >
                  <X size={16} className="mx-auto" />
                </button>
              </div>

              <div className="p-5 space-y-3 text-sm">
                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background opacity-70 cursor-not-allowed">
                  <input type="checkbox" checked disabled className="accent-accent" />
                  <span className="text-primary font-medium">Basfakta & Profilbild</span>
                  <span className="text-xs text-muted">(alltid inkluderad)</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printOptions.includeEvents}
                    onChange={() => togglePrintOption('includeEvents')}
                    className="accent-accent"
                  />
                  <span className="text-primary">Livshändelser (kronologisk ordning)</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printOptions.includeFamilyParentsSiblings}
                    onChange={() => togglePrintOption('includeFamilyParentsSiblings')}
                    className="accent-accent"
                  />
                  <span className="text-primary">Familj: Föräldrar & Syskon</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printOptions.includeFamilyPartnersChildren}
                    onChange={() => togglePrintOption('includeFamilyPartnersChildren')}
                    className="accent-accent"
                  />
                  <span className="text-primary">Familj: Partners & Barn</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printOptions.includeFamilyGrandchildren}
                    onChange={() => togglePrintOption('includeFamilyGrandchildren')}
                    className="accent-accent"
                  />
                  <span className="text-primary">Familj: Barnbarn</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printOptions.includeMedia}
                    onChange={() => togglePrintOption('includeMedia')}
                    className="accent-accent"
                  />
                  <span className="text-primary">Media (kopplade bilder i galleri sist)</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printOptions.includeNotesBiography}
                    onChange={() => togglePrintOption('includeNotesBiography')}
                    className="accent-accent"
                  />
                  <span className="text-primary">Noteringar & Biografi</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded border border-subtle bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printOptions.includeSourceList}
                    onChange={() => togglePrintOption('includeSourceList')}
                    className="accent-accent"
                  />
                  <span className="text-primary">Källförteckning (fotnoter/referenslista)</span>
                </label>
              </div>

              <div className="px-5 py-4 border-t border-subtle bg-surface-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintSettingsOpen(false)}
                  className="px-3 py-2 text-sm rounded border border-subtle bg-surface text-primary hover:bg-background transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleCreatePersonakt}
                  className="px-4 py-2 text-sm rounded bg-accent text-on-accent hover:bg-accent transition-colors font-semibold"
                >
                  Skapa Personakt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT AREA - Dölj om collapsed */}
        {!isCollapsed && (
          <div className="flex-1 overflow-hidden flex bg-background relative min-h-0">
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">

              {/* FLIK: INFO */}
              {activeTab === 'info' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

                  {/* Grunddata */}
                  <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={openPrimaryProfileImage}
                        className="aspect-[3/4] w-full bg-surface-2 rounded-lg border border-subtle flex items-center justify-center relative overflow-hidden hover:border-accent transition-colors"
                        style={person?.color ? { borderColor: person.color, boxShadow: `0 0 0 1px ${person.color}55` } : undefined}
                        title={person.media?.length > 0 ? 'Öppna profilbild' : 'Gå till Media för att lägga till bild'}
                        aria-label={person.media?.length > 0 ? 'Öppna profilbild' : 'Gå till Media för att lägga till bild'}
                      >
                        {person.media?.length > 0 ? (
                          <MediaImage
                            url={person.media[0].url || person.media[0].path}
                            alt="Profil"
                            className="w-full h-full object-cover"
                            style={primaryAvatarStyle}
                          />
                        ) : (
                          <User size={40} className="text-muted" />
                        )}
                      </button>
                      {isDocked && (() => {
                        const { birthYear, deathYear, lifeSpan } = getLifeInfo(person);
                        return (
                          <div className="mt-2 text-center leading-tight">
                            <div className="text-[11px] font-bold text-primary whitespace-nowrap">
                              {birthYear || '????'} - {deathYear || '????'}
                            </div>
                            <div className="text-xs text-muted">
                              {lifeSpan !== null ? `${lifeSpan} år` : '? år'}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="col-span-10 grid grid-cols-2 gap-4 content-start">
                      <div>
                        <label className="text-xs uppercase font-bold text-secondary">Förnamn</label>
                        <input ref={firstNameInputRef} type="text" value={person.firstName} onChange={e => {
                          const nextFirstName = e.target.value;
                          const parsedNickname = extractNicknameFromQuotedName(nextFirstName);
                          const updated = {
                            ...person,
                            firstName: nextFirstName,
                            nickname: parsedNickname || person.nickname || ''
                          };
                          setPerson(updated);
                          if (onChange) onChange(updated);
                        }}
                          title='Tilltalsnamn skrivs med STORA bokstäver (GEDCOM-standard). Smeknamn tolkas när de skrivs inom citattecken i förnamn, t.ex. "Kalle".'
                          className="w-full bg-background border border-subtle rounded px-3 py-2 text-primary focus:border-accent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-bold text-secondary">Efternamn</label>
                        <input type="text" value={person.lastName} onChange={e => {
                          const updated = { ...person, lastName: e.target.value };
                          setPerson(updated);
                          if (onChange) onChange(updated);
                        }} className="w-full bg-background border border-subtle rounded px-3 py-2 text-primary focus:border-accent focus:outline-none" />
                      </div>

                      <div>
                        <label className="text-xs uppercase font-bold text-secondary">Kön</label>
                        <select value={person.sex} onChange={e => {
                          const updated = { ...person, sex: e.target.value };
                          setPerson(updated);
                          if (onChange) onChange(updated);
                        }} className="w-full bg-background border border-subtle rounded px-3 py-2 text-primary focus:border-accent focus:outline-none">
                          <option value="M">Man</option>
                          <option value="K">Kvinna</option>
                          <option value="U">Okänd</option>
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-xs uppercase font-bold text-secondary">Ref Nr</label>
                          <button
                            type="button"
                            onClick={handleCopyRefNumber}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${isRefCopied ? 'border-success text-success bg-success-soft' : 'border-subtle text-secondary hover:bg-surface-2'}`}
                            title={isRefCopied ? 'Kopierat' : 'Kopiera REF-nummer'}
                            aria-label={isRefCopied ? 'Kopierat' : 'Kopiera REF-nummer'}
                          >
                            {isRefCopied ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        {isRefConflictVisible && (
                          <div className="mb-1 text-[11px] text-danger font-semibold animate-pulse">
                            REF-numret är upptaget. Tidigare REF återställdes.
                          </div>
                        )}
                        <input
                          type="text"
                          value={person.refNumber || ''}
                          onFocus={() => {
                            if (isRefConflictVisible) {
                              setIsRefConflictVisible(false);
                            }
                          }}
                          onBlur={e => {
                            const val = String(e.target.value || '').trim();
                            const fallbackRef = getPersistedRefNumber();

                            if (!val) {
                              if (String(person.refNumber || '').trim() !== fallbackRef) {
                                const reverted = { ...person, refNumber: fallbackRef };
                                setPerson(reverted);
                                if (onChange) onChange(reverted);
                              }
                              flashRefConflict();
                              showStatus('REF-nummer får inte vara tomt. Tidigare REF återställdes.', 'error');
                              return;
                            }

                            if (!/^\d+$/.test(val) || isRefNumberDuplicate(val)) {
                              const reverted = { ...person, refNumber: fallbackRef };
                              setPerson(reverted);
                              if (onChange) onChange(reverted);
                              flashRefConflict();
                              showStatus(`REF ${val} används redan eller är ogiltigt. Tidigare REF återställdes.`, 'error');
                              return;
                            }

                            const normalized = String(Number.parseInt(val, 10));
                            if (normalized !== String(person.refNumber || '').trim()) {
                              const updated = { ...person, refNumber: normalized };
                              setPerson(updated);
                              if (onChange) onChange(updated);
                            }
                          }}
                          onChange={e => {
                            const val = e.target.value;
                            // Tillåt endast siffror
                            if (val === '' || /^\d+$/.test(val)) {
                              setPerson({ ...person, refNumber: val });
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.target.blur();
                            }
                          }}
                          className={`w-full bg-background border rounded px-3 py-2 text-primary focus:outline-none ${isRefConflictVisible ? 'border-danger ring-1 ring-danger/50 focus:border-danger' : 'border-subtle focus:border-accent'}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-muted uppercase mb-2 block">Taggar</label>

                        {/* Visade taggar */}
                        {Array.isArray(person?.tags) && person.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {person.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="bg-success/20 border border-success/50 text-success text-xs px-2 py-1 rounded-full flex items-center gap-1.5 group hover:bg-success/30 transition-colors"
                              >
                                <span>{tag}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTag(tag);
                                  }}
                                  className="text-success hover:text-danger transition-colors ml-0.5"
                                  title="Ta bort tagg"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Input för nya taggar */}
                        <div className="relative">
                          <input
                            ref={tagInputRef}
                            type="text"
                            placeholder="Skriv eller välj tagg..."
                            className="w-full bg-background border border-subtle rounded px-2 py-1.5 text-sm text-on-accent focus:outline-none focus:border-accent"
                            value={tagInput}
                            onChange={(e) => {
                              setTagInput(e.target.value);
                              setTagSuggestions(getTagSuggestions(e.target.value));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                e.stopPropagation();
                                const trimmed = tagInput.trim();
                                if (trimmed) {
                                  handleAddTag(trimmed);
                                }
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onFocus={(e) => {
                              e.stopPropagation();
                              e.target.select();
                              if (tagInput) {
                                setTagSuggestions(getTagSuggestions(tagInput));
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => setTagSuggestions([]), 200);
                            }}
                            autoComplete="off"
                          />

                          {/* Autocomplete dropdown */}
                          {tagSuggestions.length > 0 && tagInput && (
                            <div className="absolute z-50 w-full mt-1 bg-surface border border-subtle rounded shadow-lg max-h-40 overflow-y-auto">
                              {tagSuggestions.map((suggestion, idx) => (
                                <button
                                  key={idx}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleAddTag(suggestion);
                                    setTagInput('');
                                    setTagSuggestions([]);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-surface-2 transition-colors flex items-center gap-2"
                                >
                                  <Tag size={12} className="text-muted" />
                                  <span>{suggestion}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <p className="text-[10px] text-muted mt-1">Tryck Enter eller "," för att lägga till tagg</p>
                      </div>
                    </div>
                  </div>

                  {/* Livshändelser */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-md font-bold text-primary uppercase tracking-wide flex items-center gap-2">
                        <Activity size={16} className="text-accent" /> Livshändelser
                      </h3>
                      <div className="flex items-center gap-2">
                        {!hasBirthEvent && (
                          <button
                            onClick={() => handleQuickAddEvent('Födelse')}
                            className="flex items-center gap-1 text-xs bg-surface-2 hover:bg-surface text-primary px-2.5 py-1 rounded transition-colors"
                          >
                            <Plus size={13} /> Födelse
                          </button>
                        )}
                        {!hasDeathEvent && (
                          <button
                            onClick={() => handleQuickAddEvent('Död')}
                            className="flex items-center gap-1 text-xs bg-surface-2 hover:bg-surface text-primary px-2.5 py-1 rounded transition-colors"
                          >
                            <Plus size={13} /> Död
                          </button>
                        )}
                        <button
                          onClick={handleAddEvent}
                          ref={eventTypeButtonRef}
                          className="flex items-center gap-1 text-xs bg-accent hover:bg-accent text-on-accent px-3 py-1 rounded transition-colors"
                        >
                          <Plus size={14} /> Lägg till händelse
                        </button>
                      </div>
                    </div>

                    <div className="bg-background rounded-lg border border-subtle overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-surface text-secondary text-xs uppercase">
                          <tr>
                            <th className="p-2 w-16">Ålder</th>
                            <th className="p-2 w-24">Typ</th>
                            <th className="p-2 w-28">Datum</th>
                            <th className="p-2 w-32">Plats</th>
                            <th className="p-2 w-24">Info</th>
                            <th className="p-2 text-center w-32">Info</th>
                            <th className="p-2 text-right w-20"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                          {sortedEvents().map((evt, idx) => {
                            const actualIndex = Array.isArray(person.events)
                              ? person.events.findIndex((eventItem) => eventItem?.id === evt?.id)
                              : -1;
                            const canDragEvent = editingEventIndex === null && !String(evt?.date || '').trim();
                            const age = calculateAgeAtEvent(person.events?.find(e => e.type === 'Födelse')?.date, evt.date);
                            const witnessCount = getEventWitnessCount(evt);
                            const eventSummary = buildEventSummary(evt);
                            let partnerName = '';
                            // Hitta partner-namn för vigsel, lysning, samlevnad, skilsmässa, förlovning
                            if (['Vigsel', 'Lysning', 'Samlevnad', 'Skilsmässa', 'Förlovning'].includes(evt.type) && evt.partnerId && person.relations?.partners?.length > 0) {
                              const partner = person.relations.partners.find(p => p.id === evt.partnerId);
                              partnerName = partner ? partner.name : '';
                            }
                            return (
                              <tr
                                key={evt.id || idx}
                                draggable={canDragEvent}
                                onDragStart={(e) => {
                                  if (!canDragEvent || actualIndex === -1) return;
                                  handleEventDragStart(e, actualIndex);
                                }}
                                onDragEnd={handleEventDragEnd}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  if (!canDragEvent || actualIndex === -1) return;
                                  handleEventSortDragOver(e, actualIndex);
                                  setDragOverEventIndex(actualIndex);
                                }}
                                onDragLeave={() => {
                                  setEventSortOverIndex(null);
                                  setDragOverEventIndex(null);
                                }}
                                onDrop={(e) => {
                                  const sourceData = e.dataTransfer.getData('application/json');
                                  if (sourceData) {
                                    try {
                                      const payload = JSON.parse(sourceData);
                                      if (payload.type === 'source') {
                                        handleDropSourceOnEvent(e, evt.id, actualIndex === -1 ? idx : actualIndex);
                                        return;
                                      }
                                    } catch (err) {
                                      // Inte käll-data, kolla om det är event-sortering
                                    }
                                  }
                                  if (!canDragEvent || actualIndex === -1) return;
                                  handleEventSortDrop(e, actualIndex);
                                }}
                                onClick={() => {
                                  if (editingEventIndex === null && actualIndex !== -1) {
                                    setSelectedEventIndex(selectedEventIndex === actualIndex ? null : actualIndex);
                                    setEventDetailView('sources');
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (actualIndex !== -1) {
                                    setSelectedEventIndex(actualIndex);
                                    setEventDetailView('sources');
                                  }
                                  handleEditEvent(evt.id);
                                }}
                                onContextMenu={(e) => handleEventContextMenu(e, actualIndex === -1 ? idx : actualIndex, evt.id)}
                                className={`hover:bg-surface transition-colors group ${canDragEvent ? 'cursor-move' : 'cursor-default'} ${selectedEventIndex === actualIndex && editingEventIndex === null ? 'bg-accent-soft border-l-4 border-accent' : ''} ${dragOverEventIndex === actualIndex && draggedEventIndex === null ? 'bg-accent-soft ring-2 ring-inset ring-accent' : ''} ${eventSortOverIndex === actualIndex && draggedEventIndex !== null ? 'border-t-2 border-emerald-500' : ''}`}
                              >
                                <td className="p-2 text-secondary text-xs whitespace-nowrap">{age !== null ? `${age} år` : '-'}</td>
                                <td className="p-2 font-medium text-primary text-xs">{evt.type}</td>
                                <td className="p-2 font-mono text-secondary text-xs whitespace-nowrap">{evt.date || '-'}</td>
                                <td
                                  className="p-2 text-primary hover:text-accent hover:underline cursor-pointer flex items-center gap-1 text-xs"
                                  title={getPlaceHierarchy(evt)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (evt.placeId && typeof onTogglePlaceDrawer === 'function') {
                                      onTogglePlaceDrawer(evt.placeId);
                                    } else if (evt.placeId && onNavigateToPlace) {
                                      onNavigateToPlace(evt.placeId);
                                    }
                                  }}
                                >
                                  <MapPin size={10} /> <span className="truncate max-w-[100px]">{evt.place || '-'}</span>
                                </td>
                                <td className="p-2 text-primary text-xs">
                                  {/* För vigsel, lysning, samlevnad, skilsmässa, förlovning: visa partner-namn */}
                                  {['Vigsel', 'Lysning', 'Samlevnad', 'Skilsmässa', 'Förlovning'].includes(evt.type) ? (
                                    <span className="truncate block max-w-[80px]" title={partnerName || ''}>
                                      {partnerName || '-'}
                                    </span>
                                  ) : (
                                    /* För andra händelser: visa konfigdriven sammanfattning eller notering */
                                    (eventSummary || getMeaningfulNoteText(evt.notes)) ? (() => {
                                      const textContent = eventSummary || getMeaningfulNoteText(evt.notes);
                                      const displayText = textContent.length > 28 ? `${textContent.substring(0, 28)}...` : textContent;
                                      return (
                                        <span
                                          className="truncate block max-w-[80px] cursor-pointer hover:text-accent hover:underline"
                                          title={textContent.length > 28 ? textContent : ''}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditEvent(evt.id);
                                          }}
                                        >
                                          {displayText}
                                        </span>
                                      );
                                    })() : (
                                      '-'
                                    )
                                  )}
                                </td>
                                <td className="p-2">
                                  <div className="flex justify-center gap-2 text-xs text-muted">
                                    <span
                                      className={`flex items-center gap-0.5 cursor-pointer hover:text-accent ${evt.sources?.length > 0 ? 'text-primary' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (typeof onOpenSourceDrawer === 'function') {
                                          onOpenSourceDrawer(person.id, evt.id);
                                        }
                                      }}
                                      title="Källor"
                                    >
                                      <LinkIcon size={10} /> {evt.sources?.length || 0}
                                    </span>
                                    <span
                                      className={`flex items-center gap-0.5 cursor-pointer hover:text-accent ${getMeaningfulNoteText(evt.notes) ? 'text-primary' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditEvent(evt.id);
                                      }}
                                      title={getMeaningfulNoteText(evt.notes) || 'Noteringar'}
                                    >
                                      <FileText size={10} /> {getMeaningfulNoteText(evt.notes) ? 1 : 0}
                                    </span>
                                    <span
                                      className={`flex items-center gap-0.5 cursor-pointer hover:text-accent ${(Array.isArray(evt.images) ? evt.images.length : (evt.images || 0)) > 0 ? 'text-primary' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditEvent(evt.id);
                                      }}
                                      title="Bilder"
                                    >
                                      <ImageIcon size={10} /> {Array.isArray(evt.images) ? evt.images.length : (evt.images || 0)}
                                    </span>
                                    <span
                                      className={`flex items-center gap-0.5 cursor-pointer hover:text-accent ${witnessCount > 0 ? 'text-primary' : 'text-muted'}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openWitnessEditorForEvent(evt.id);
                                      }}
                                      title="Dopvittnen / medverkande"
                                    >
                                      <Users size={10} /> {witnessCount}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-2 text-right flex gap-1 justify-end items-center">
                                  {dragOverEventIndex === idx && (
                                    <span className="mr-2 inline-flex items-center rounded border border-accent/70 bg-accent-soft px-2 py-0.5 text-[10px] uppercase tracking-wide text-on-accent">
                                      Släpp här för att koppla källa
                                    </span>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); handleEditEvent(evt.id); }} className="text-muted hover:text-secondary p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Redigera">
                                    <Edit3 size={12} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); if (actualIndex !== -1) handleDeleteEvent(actualIndex); }} className="text-muted hover:text-danger p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Ta bort">
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {(!person.events || person.events.length === 0) && (
                            <tr>
                              <td colSpan="7" className="p-4 text-center text-muted text-sm">Inga händelser tillagda än</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* FLIK: RELATIONER */}
              {activeTab === 'relations' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  
                  {/* Föräldrar */}
                  <div className="bg-surface p-4 rounded-lg border-l-4 border-l-accent border border-subtle">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <Users size={18} className="text-accent" />
                        <h4 className="text-sm font-bold text-primary uppercase tracking-wide">Föräldrar</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRelationModal('parents')}
                          className="bg-surface-2 hover:bg-surface text-primary text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors border border-subtle"
                        >
                          <LinkIcon size={12} /> Koppla befintlig
                        </button>
                        <button
                          onClick={() => handleCreateNewRelation('parents')}
                          className="bg-accent hover:bg-accent text-on-accent text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        >
                          <Plus size={12} /> Skapa ny
                        </button>
                      </div>
                    </div>
                    {person.relations?.parents?.length > 0 ? (
                      person.relations.parents.map((p, idx) => {
                        const parentId = typeof p === 'string' ? p : (p?.id || p);
                        const parentPerson = allPeople.find(pp => pp.id === parentId);
                        const parentName = parentPerson
                          ? `${parentPerson.firstName || ''} ${parentPerson.lastName || ''}`.trim()
                          : (typeof p === 'object' && p.name ? p.name : parentId || 'Okänd');
                        const relationType = (typeof p === 'object' && p.type) ? p.type : RELATION_TYPES.parent[0];
                        const profileImage = parentPerson?.media && parentPerson.media.length > 0 ? parentPerson.media[0].url : null;

                        return (
                          <div key={parentId || idx} className="flex items-center justify-between bg-surface-2 p-2 rounded mb-2 border border-subtle">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong">
                                {profileImage ? (
                                  <MediaImage
                                    url={profileImage}
                                    alt={parentName}
                                    className="w-full h-full object-cover"
                                    style={getAvatarImageStyle(parentPerson?.media?.[0], parentId)}
                                  />
                                ) : (
                                  <User size={16} className="w-full h-full p-1.5 text-muted" />
                                )}
                              </div>
                              <span
                                className="text-primary font-medium cursor-pointer hover:text-accent"
                                onClick={() => parentPerson && onOpenEditModal && onOpenEditModal(parentId)}
                              >
                                {parentName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={relationType}
                                onChange={e => {
                                  const newType = e.target.value;
                                  setPerson(prev => {
                                    const rels = { ...prev.relations };
                                    rels.parents = rels.parents.map((rel, i) => {
                                      if (i === idx) {
                                        if (typeof rel === 'string') {
                                          return { id: rel, name: parentName, type: newType };
                                        }
                                        return { ...rel, type: newType };
                                      }
                                      return rel;
                                    });
                                    return { ...prev, relations: rels };
                                  });
                                }}
                                className="bg-background border border-subtle text-xs rounded px-2 py-1 text-primary"
                              >
                                {RELATION_TYPES.parent.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <button onClick={() => removeRelation('parents', parentId)} className="text-danger hover:text-danger text-xs"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted">Ingen förälder tillagd</p>
                    )}
                    {person.relations?.parents?.length > 0 && (
                      <p className="text-xs text-muted italic mt-1">
                        {person.relations.parents.length} förälder{person.relations.parents.length === 1 ? '' : 'ar'} tillagd{person.relations.parents.length === 1 ? '' : 'a'}.
                      </p>
                    )}
                    {renderInlineRelationEditor('parents')}
                  </div>

                  {/* Partners */}
                  <div className="bg-surface p-4 rounded-lg border-l-4 border-l-red-500 border border-subtle">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <Heart size={18} className="text-danger" />
                        <h4 className="text-sm font-bold text-primary uppercase tracking-wide">Partners</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRelationModal('partners')}
                          className="bg-surface-2 hover:bg-surface text-primary text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors border border-subtle"
                        >
                          <LinkIcon size={12} /> Koppla befintlig
                        </button>
                        <button
                          onClick={() => handleCreateNewRelation('partners')}
                          className="bg-danger hover:bg-danger text-on-accent text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        >
                          <Plus size={12} /> Skapa ny
                        </button>
                      </div>
                    </div>
                    {person.relations?.partners?.length > 0 ? (
                      person.relations.partners.map((p, partnerIdx) => {
                        const partnerId = p.id || p;
                        const partnerPerson = allPeople.find(pp => pp.id === partnerId);
                        const partnerName = partnerPerson
                          ? `${partnerPerson.firstName || ''} ${partnerPerson.lastName || ''}`.trim()
                          : (typeof p === 'object' && p.name ? p.name : partnerId || 'Okänd');
                        const partnerImage = partnerPerson?.media && partnerPerson.media.length > 0 ? partnerPerson.media[0].url : null;

                        // Hitta alla barn som har både fokus-personen OCH denna partner som föräldrar
                        const partnerChildren = (person.relations?.children || []).filter(c => {
                          const childId = typeof c === 'string' ? c : (c?.id || c);
                          const childPerson = allPeople.find(pp => pp.id === childId);
                          if (!childPerson) return false;
                          const childParents = (childPerson.relations?.parents || []).map(par => typeof par === 'object' ? par.id : par);
                          return childParents.includes(person.id) && childParents.includes(partnerId);
                        });

                        return (
                          <div key={partnerId || partnerIdx} className="bg-surface-2 rounded-lg border border-subtle mb-4 p-3">
                            {/* Partner header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-10 h-10 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong">
                                  {partnerImage ? (
                                    <MediaImage
                                      url={partnerImage}
                                      alt={partnerName}
                                      className="w-full h-full object-cover"
                                      style={getAvatarImageStyle(partnerPerson?.media?.[0], partnerId)}
                                    />
                                  ) : (
                                    <User size={20} className="w-full h-full p-2 text-muted" />
                                  )}
                                </div>
                                <div>
                                  <span
                                    className="text-primary font-medium cursor-pointer hover:text-accent block"
                                    onClick={() => partnerPerson && onOpenEditModal && onOpenEditModal(partnerId)}
                                  >
                                    {partnerName}
                                  </span>
                                  <span className="text-xs text-muted">Partner</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={p.type || RELATION_TYPES.partner[0]}
                                  onChange={e => {
                                    const newType = e.target.value;
                                    setPerson(prev => {
                                      const rels = { ...prev.relations };
                                      // Spara nya relationstypen
                                      rels.partners = rels.partners.map((rel, i) => i === partnerIdx ? { ...rel, type: newType } : rel);
                                      let events = [...prev.events];
                                      // Hämta tidigare typ (innan ändring)
                                      const prevType = prev.relations.partners[partnerIdx]?.type;
                                      // Skapa skilsmässa-händelse om man väljer Skild
                                      if (newType === 'Skild') {
                                        const alreadyExists = events.some(ev => ev.type === 'Skilsmässa' && ev.partnerId === partnerId);
                                        if (!alreadyExists) {
                                          events.push({
                                            id: `evt_${Date.now()}`,
                                            type: 'Skilsmässa',
                                            date: '',
                                            place: '',
                                            partnerId: partnerId,
                                            sources: [],
                                            images: 0,
                                            notes: ''
                                          });
                                        }
                                      }
                                      // Ta bort skilsmässa-händelse om man ändrar från Skild till något annat
                                      if (prevType === 'Skild' && newType !== 'Skild') {
                                        events = events.filter(ev => !(ev.type === 'Skilsmässa' && ev.partnerId === partnerId));
                                      }
                                      return { ...prev, relations: rels, events };
                                    });
                                  }}
                                  className="bg-background border border-subtle text-xs rounded px-2 py-1 text-primary"
                                >
                                  {RELATION_TYPES.partner.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button onClick={() => removeRelation('partners', partnerId)} className="text-danger hover:text-danger text-xs"><Trash2 size={14} /></button>
                              </div>
                            </div>

                            {/* Barn under denna partner */}
                            <div className="ml-4 border-l-2 border-subtle pl-3">
                              <div className="flex justify-between mb-2">
                                <h5 className="text-xs font-semibold text-secondary uppercase">Barn</h5>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openRelationModal('children', partnerId)}
                                    className="text-accent hover:text-accent text-xs flex items-center gap-1"
                                  >
                                    <LinkIcon size={10} /> Koppla
                                  </button>
                                  <button
                                    onClick={() => handleCreateNewRelation('children', partnerId)}
                                    className="text-success hover:text-success text-xs flex items-center gap-1"
                                  >
                                    <Plus size={10} /> Skapa
                                  </button>
                                </div>
                              </div>
                              {partnerChildren.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {partnerChildren.map((c, childIdx) => {
                                    const childId = typeof c === 'string' ? c : (c?.id || c);
                                    const childPerson = allPeople.find(pp => pp.id === childId);
                                    const childName = childPerson
                                      ? `${childPerson.firstName || ''} ${childPerson.lastName || ''}`.trim()
                                      : (typeof c === 'object' && c.name ? c.name : childId || 'Okänd');

                                    return (
                                      <button
                                        key={childId || childIdx}
                                        onClick={() => childPerson && onOpenEditModal && onOpenEditModal(childId)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-subtle bg-background hover:bg-surface text-xs text-primary transition-colors"
                                        title="Öppna barnet"
                                      >
                                        <User size={10} className="text-muted" />
                                        <span className="max-w-[140px] truncate">{childName}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-muted italic">Inga barn tillagda</p>
                              )}
                              {renderInlineRelationEditor('children', partnerId)}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted">Ingen partner tillagd</p>
                    )}
                    {renderInlineRelationEditor('partners')}
                  </div>

                  {/* Barn */}
                  <div className="bg-surface p-4 rounded-lg border-l-4 border-l-green-500 border border-subtle">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <User size={18} className="text-success" />
                        <h4 className="text-sm font-bold text-primary uppercase tracking-wide">Barn</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRelationModal('children')}
                          className="bg-surface-2 hover:bg-surface text-primary text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors border border-subtle"
                        >
                          <LinkIcon size={12} /> Koppla befintlig
                        </button>
                        <button
                          onClick={() => handleCreateNewRelation('children')}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        >
                          <Plus size={12} /> Skapa ny
                        </button>
                      </div>
                    </div>
                    {(person.relations?.children || []).length > 0 ? (
                      (person.relations.children || []).map((c, idx) => {
                        const childId = typeof c === 'string' ? c : (c?.id || c);
                        const childPerson = allPeople.find(pp => pp.id === childId);
                        const childName = childPerson
                          ? `${childPerson.firstName || ''} ${childPerson.lastName || ''}`.trim()
                          : (typeof c === 'object' && c.name ? c.name : childId || 'Okänd');
                        const relationType = (typeof c === 'object' && c.type) ? c.type : RELATION_TYPES.child[0];
                        const profileImage = childPerson?.media && childPerson.media.length > 0 ? childPerson.media[0].url : null;

                        return (
                          <div key={childId || idx} className="flex items-center justify-between bg-surface-2 p-2 rounded mb-2 border border-subtle">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong">
                                {profileImage ? (
                                  <MediaImage
                                    url={profileImage}
                                    alt={childName}
                                    className="w-full h-full object-cover"
                                    style={getAvatarImageStyle(childPerson?.media?.[0], childId)}
                                  />
                                ) : (
                                  <User size={16} className="w-full h-full p-1.5 text-muted" />
                                )}
                              </div>
                              <span
                                className="text-primary font-medium cursor-pointer hover:text-accent"
                                onClick={() => childPerson && onOpenEditModal && onOpenEditModal(childId)}
                              >
                                {childName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={relationType}
                                onChange={e => {
                                  const newType = e.target.value;
                                  setPerson(prev => {
                                    const rels = { ...prev.relations };
                                    rels.children = rels.children.map((rel, i) => {
                                      const relId = typeof rel === 'string' ? rel : (rel?.id || rel);
                                      if (relId === childId) {
                                        if (typeof rel === 'string') {
                                          return { id: rel, name: childName, type: newType };
                                        }
                                        return { ...rel, type: newType };
                                      }
                                      return rel;
                                    });
                                    return { ...prev, relations: rels };
                                  });
                                }}
                                className="bg-background border border-subtle text-xs rounded px-2 py-1 text-primary"
                              >
                                {RELATION_TYPES.child.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <button onClick={() => removeRelation('children', childId)} className="text-danger hover:text-danger text-xs"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted">Inga barn tillagda</p>
                    )}
                    {person.relations?.children?.length > 0 && (
                      <p className="text-xs text-muted italic mt-1">
                        {person.relations.children.length} barn tillagda.
                      </p>
                    )}
                    {renderInlineRelationEditor('children')}
                  </div>

                  {/* Syskon */}
                  <div className="bg-surface p-4 rounded-lg border-l-4 border-l-amber-500 border border-subtle">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <GitFork size={18} className="text-amber-400" />
                        <h4 className="text-sm font-bold text-primary uppercase tracking-wide">Syskon</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRelationModal('siblings')}
                          className="bg-surface-2 hover:bg-surface text-primary text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors border border-subtle"
                        >
                          <LinkIcon size={12} /> Koppla befintlig
                        </button>
                        <button
                          onClick={() => handleCreateNewRelation('siblings')}
                          className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        >
                          <Plus size={12} /> Skapa ny
                        </button>
                      </div>
                    </div>
                    {person.relations?.siblings?.length > 0 ? (
                      person.relations.siblings.map((s, idx) => {
                        const siblingId = typeof s === 'string' ? s : (s?.id || s);
                        const siblingPerson = allPeople.find(pp => pp.id === siblingId);
                        const siblingName = siblingPerson
                          ? `${siblingPerson.firstName || ''} ${siblingPerson.lastName || ''}`.trim()
                          : (typeof s === 'object' && s.name ? s.name : siblingId || 'Okänd');
                        const relationType = (typeof s === 'object' && s.type) ? s.type : RELATION_TYPES.sibling[0];
                        const profileImage = siblingPerson?.media && siblingPerson.media.length > 0 ? siblingPerson.media[0].url : null;

                        return (
                          <div key={siblingId || idx} className="flex items-center justify-between bg-surface-2 p-2 rounded mb-2 border border-subtle">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong">
                                {profileImage ? (
                                  <MediaImage
                                    url={profileImage}
                                    alt={siblingName}
                                    className="w-full h-full object-cover"
                                    style={getAvatarImageStyle(siblingPerson?.media?.[0], siblingId)}
                                  />
                                ) : (
                                  <User size={16} className="w-full h-full p-1.5 text-muted" />
                                )}
                              </div>
                              <span
                                className="text-primary font-medium cursor-pointer hover:text-accent"
                                onClick={() => siblingPerson && onOpenEditModal && onOpenEditModal(siblingId)}
                              >
                                {siblingName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={relationType}
                                onChange={e => {
                                  const newType = e.target.value;
                                  setPerson(prev => {
                                    const rels = { ...prev.relations };
                                    rels.siblings = rels.siblings.map((rel, i) => {
                                      const relId = typeof rel === 'string' ? rel : (rel?.id || rel);
                                      if (relId === siblingId) {
                                        if (typeof rel === 'string') {
                                          return { id: rel, name: siblingName, type: newType };
                                        }
                                        return { ...rel, type: newType };
                                      }
                                      return rel;
                                    });
                                    return { ...prev, relations: rels };
                                  });
                                }}
                                className="bg-background border border-subtle text-xs rounded px-2 py-1 text-primary"
                              >
                                {RELATION_TYPES.sibling.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <button onClick={() => removeRelation('siblings', siblingId)} className="text-danger hover:text-danger text-xs"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted">Ingen syskon tillagd</p>
                    )}
                    {person.relations?.siblings?.length > 0 && (
                      <p className="text-xs text-muted italic mt-1">
                        {person.relations.siblings.length} syskon tillagd{person.relations.siblings.length === 1 ? '' : 'a'}.
                      </p>
                    )}
                    {renderInlineRelationEditor('siblings')}
                  </div>

                  {/* Relation Picker Modal */}
                  {relationModalOpen && (() => {
                    // Filtrera och sortera personer
                    const filteredPeople = allPeople
                      .filter(p => {
                        if (p.id === person.id) return false; // Exkludera sig själv
                        if (!relationSearch) return true;

                        const searchLower = relationSearch.toLowerCase();
                        const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
                        const ref = (p.refNumber || p.refId || '').toString().toLowerCase();

                        // Sök på f.namn, e.namn, ref
                        return fullName.includes(searchLower) ||
                          ref.includes(searchLower) ||
                          (p.firstName || '').toLowerCase().includes(searchLower) ||
                          (p.lastName || '').toLowerCase().includes(searchLower);
                      })
                      .map(p => {
                        const relationship = getRelationshipType(person.id, p.id);
                        const modifiedAt = p.modifiedAt || p.createdAt || '';
                        return { ...p, relationship, modifiedAt };
                      })
                      .sort((a, b) => {
                        if (relationSortBy === 'recent') {
                          // Sortera efter senast ändrad (nyast först)
                          return (b.modifiedAt || '').localeCompare(a.modifiedAt || '');
                        } else if (relationSortBy === 'related') {
                          // Sortera efter relationstyp (partners först, sedan föräldrar, barn, syskon, osv)
                          const order = { 'partner': 1, 'parent': 2, 'child': 3, 'sibling': 4 };
                          const aOrder = order[a.relationship] || 99;
                          const bOrder = order[b.relationship] || 99;
                          if (aOrder !== bOrder) return aOrder - bOrder;
                          // Om samma typ, sortera alfabetiskt
                          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                        } else {
                          // Sortera alfabetiskt (standard)
                          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                        }
                      });

                    return (
                      <WindowFrame
                        title="Välj person att koppla"
                        icon={User}
                        onClose={() => setRelationModalOpen(false)}
                        initialWidth={800}
                        initialHeight={600}
                        zIndex={4200}
                      >
                        <div className="h-full flex flex-col bg-surface overflow-hidden">
                          <div className="p-4 space-y-3 flex-shrink-0">
                            {/* Sökfält */}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
                              <input
                                type="text"
                                value={relationSearch}
                                onChange={e => { setRelationSearch(e.target.value); setRelationSearchIndex(0); }}
                                placeholder="Sök på namn, ref, f.namn, e.namn..."
                                className="w-full bg-background border border-subtle rounded p-2 pl-10 text-on-accent focus:border-accent focus:outline-none"
                                autoFocus
                              />
                            </div>

                            {/* Filter/Sortering */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setRelationSortBy('name'); setRelationSearchIndex(0); }}
                                className={`px-3 py-1 text-xs rounded transition-colors ${relationSortBy === 'name'
                                  ? 'bg-accent text-on-accent'
                                  : 'bg-surface-2 text-secondary hover:bg-surface'
                                  }`}
                              >
                                Namn
                              </button>
                              <button
                                onClick={() => { setRelationSortBy('recent'); setRelationSearchIndex(0); }}
                                className={`px-3 py-1 text-xs rounded transition-colors ${relationSortBy === 'recent'
                                  ? 'bg-accent text-on-accent'
                                  : 'bg-surface-2 text-secondary hover:bg-surface'
                                  }`}
                              >
                                Senast tillagd
                              </button>
                              <button
                                onClick={() => { setRelationSortBy('related'); setRelationSearchIndex(0); }}
                                className={`px-3 py-1 text-xs rounded transition-colors ${relationSortBy === 'related'
                                  ? 'bg-accent text-on-accent'
                                  : 'bg-surface-2 text-secondary hover:bg-surface'
                                  }`}
                              >
                                Närmast släkt
                              </button>
                            </div>

                            {/* Personlista */}
                            <div className="flex-1 overflow-y-auto divide-y divide-subtle custom-scrollbar">
                              {filteredPeople.length === 0 ? (
                                <div className="text-muted py-8 text-center">Ingen person hittades</div>
                              ) : (
                                filteredPeople.map((p, idx) => {
                                  const { birthDate, birthPlace, deathDate, deathPlace } = getPersonLifeDetails(p);
                                  const sex = p.sex || 'U';
                                  const sexLabel = sex === 'M' ? 'M' : sex === 'K' ? 'F' : 'U';
                                  const profileImage = p.media && p.media.length > 0 ? p.media[0].url : null;

                                  return (
                                    <div
                                      key={p.id}
                                      className={`flex items-start gap-3 py-3 px-3 cursor-pointer hover:bg-surface-2 transition-colors ${idx === relationSearchIndex ? 'bg-accent text-on-accent' : 'text-primary'
                                        }`}
                                      onClick={() => addRelation(p.id)}
                                      onMouseEnter={() => setRelationSearchIndex(idx)}
                                    >
                                      {/* Rund thumbnail */}
                                      <div className="w-12 h-12 rounded-full bg-surface flex-shrink-0 overflow-hidden border-2 border-strong">
                                        {profileImage ? (
                                          <MediaImage
                                            url={profileImage}
                                            alt={`${p.firstName} ${p.lastName}`}
                                            className="w-full h-full object-cover"
                                            style={getAvatarImageStyle(p.media?.[0], p.id)}
                                          />
                                        ) : (
                                          <User className="w-full h-full p-2 text-muted" />
                                        )}
                                      </div>

                                      {/* Personinfo */}
                                      <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-base mb-1">
                                          {p.firstName} {p.lastName}
                                          {p.relationship && (
                                            <span className="ml-2 text-xs font-normal text-muted">
                                              ({p.relationship === 'partner' ? 'Partner' :
                                                p.relationship === 'parent' ? 'Förälder' :
                                                  p.relationship === 'child' ? 'Barn' :
                                                    p.relationship === 'sibling' ? 'Syskon' : ''})
                                            </span>
                                          )}
                                        </div>

                                        {/* Födelsedatum och plats */}
                                        {(birthDate || birthPlace) && (
                                          <div className="text-sm text-muted mb-0.5">
                                            * {birthDate || '????-??-??'} {birthPlace && ` ${birthPlace}`} ({sexLabel})
                                          </div>
                                        )}

                                        {/* Dödsdatum och plats */}
                                        {(deathDate || deathPlace) && (
                                          <div className="text-sm text-muted">
                                            + {deathDate || '????-??-??'} {deathPlace && ` ${deathPlace}`} ({sexLabel})
                                          </div>
                                        )}

                                        {/* Om inga datum finns */}
                                        {!birthDate && !deathDate && (
                                          <div className="text-sm text-muted italic">
                                            Inga datum registrerade
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </WindowFrame>
                    );
                  })()}
                </div>
              )}

              {/* FLIK: MEDIA */}
              {activeTab === 'media' && (
                <div className="animate-in fade-in duration-300 h-full">
                  <div className="flex justify-end items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 rounded border border-subtle bg-background px-3 py-1.5">
                      <span className="text-xs text-muted whitespace-nowrap">Storlek</span>
                      <input
                        type="range"
                        min="0.2"
                        max="2"
                        step="0.01"
                        value={Number(mediaSortConfig?.imageSize ?? 0.62)}
                        onChange={(e) => handleMediaSortChange({
                          ...(mediaSortConfig || {}),
                          imageSize: Number(e.target.value)
                        })}
                        className="w-36 accent-blue-500"
                        aria-label="Justera storlek på tumnaglar"
                      />
                      <span className="text-xs text-muted tabular-nums w-10 text-right">
                        {Math.round(Number(mediaSortConfig?.imageSize ?? 0.62) * 100)}%
                      </span>
                    </div>
                    <button
                      onClick={handleDownloadPersonImages}
                      className="text-xs bg-surface-2 hover:bg-surface text-primary px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                    >
                      <DownloadCloud size={14} /> Ladda ner personens bilder
                    </button>
                  </div>
                  <MediaSelector
                    media={person.media || []}
                    onMediaChange={(newMedia) => {
                      const updatedPerson = { ...person, media: newMedia };
                      setPerson(updatedPerson);
                      // Uppdatera också i dbData direkt så att media sparas
                      if (onChange) {
                        onChange(updatedPerson);
                      }
                    }}
                    mediaSortConfig={mediaSortConfig}
                    onMediaSortChange={handleMediaSortChange}
                    entityType="person"
                    entityId={person.id}
                    allPeople={allPeople}
                    onOpenEditModal={onOpenEditModal}
                    allMediaItems={allMediaItems}
                    onUpdateAllMedia={onUpdateAllMedia}
                    allSources={allSources || []}
                    allPlaces={allPlaces || []}
                  />
                </div>
              )}

              {/* FLIK: FORSKNING */}
              {activeTab === 'research' && (
                <div className="animate-in fade-in duration-300 space-y-8">
                  {/* FORSKNINGSUPPGIFTER */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-md font-bold text-primary uppercase flex items-center gap-2">
                        <ClipboardList size={18} className="text-accent" /> Forskningsuppgifter
                      </h3>
                      <button
                        onClick={() => {
                          const newTask = {
                            id: `task_${Date.now()}`,
                            task: '',
                            priority: 0,
                            status: 'not-started',
                            deadline: '',
                            notes: ''
                          };
                          const currentResearch = person.research || { tasks: [], notes: '', questions: [] };
                          setPerson({
                            ...person,
                            research: {
                              ...currentResearch,
                              tasks: [...(currentResearch.tasks || []), newTask]
                            }
                          });
                          setEditingTaskIndex((currentResearch.tasks || []).length);
                        }}
                        className="text-xs bg-accent hover:bg-accent text-on-accent px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                      >
                        <Plus size={14} /> Ny uppgift
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(person.research?.tasks || []).length === 0 ? (
                        <div className="bg-background border border-subtle rounded-lg p-8 text-center">
                          <ClipboardList size={32} className="text-muted mx-auto mb-2" />
                          <p className="text-muted text-sm">Inga forskningsuppgifter än. Klicka på "Ny uppgift" för att lägga till en.</p>
                        </div>
                      ) : (
                        (person.research?.tasks || []).map((task, idx) => {
                          const prio = PRIORITY_LEVELS.find(p => p.level === (task.priority || 0)) || PRIORITY_LEVELS[0];
                          const status = TASK_STATUS.find(s => s.value === (task.status || 'not-started')) || TASK_STATUS[0];
                          const isEditing = editingTaskIndex === idx;

                          return (
                            <div key={task.id || idx} className="bg-background border border-subtle rounded-lg p-4 hover:border-subtle transition-colors">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={task.task || ''}
                                    onChange={(e) => {
                                      const updatedTasks = [...(person.research?.tasks || [])];
                                      updatedTasks[idx] = { ...task, task: e.target.value };
                                      setPerson({
                                        ...person,
                                        research: {
                                          ...(person.research || { tasks: [], notes: '', questions: [] }),
                                          tasks: updatedTasks
                                        }
                                      });
                                    }}
                                    placeholder="Beskriv uppgiften..."
                                    className="bg-transparent font-medium text-primary w-full focus:outline-none focus:border-b border-accent pb-1"
                                  />
                                </div>
                                <div className="flex gap-2 ml-4 items-center">
                                  {/* Status */}
                                  <select
                                    value={task.status || 'not-started'}
                                    onChange={(e) => {
                                      const updatedTasks = [...(person.research?.tasks || [])];
                                      updatedTasks[idx] = { ...task, status: e.target.value };
                                      setPerson({
                                        ...person,
                                        research: {
                                          ...(person.research || { tasks: [], notes: '', questions: [] }),
                                          tasks: updatedTasks
                                        }
                                      });
                                    }}
                                    className={`bg-surface border border-subtle text-xs rounded px-2 py-1 ${status.color}`}
                                  >
                                    {TASK_STATUS.map(s => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                  </select>

                                  {/* Prioritet */}
                                  <select
                                    value={task.priority || 0}
                                    onChange={(e) => {
                                      const updatedTasks = [...(person.research?.tasks || [])];
                                      updatedTasks[idx] = { ...task, priority: parseInt(e.target.value) };
                                      setPerson({
                                        ...person,
                                        research: {
                                          ...(person.research || { tasks: [], notes: '', questions: [] }),
                                          tasks: updatedTasks
                                        }
                                      });
                                    }}
                                    className={`bg-surface border border-subtle text-xs rounded px-2 py-1 text-primary ${prio.color}`}
                                  >
                                    {PRIORITY_LEVELS.map(p => (
                                      <option key={p.level} value={p.level}>{p.level} - {p.label}</option>
                                    ))}
                                  </select>

                                  {/* Deadline */}
                                  <div className="relative">
                                    <input
                                      type="date"
                                      value={task.deadline || ''}
                                      onChange={(e) => {
                                        const updatedTasks = [...(person.research?.tasks || [])];
                                        updatedTasks[idx] = { ...task, deadline: e.target.value };
                                        setPerson({
                                          ...person,
                                          research: {
                                            ...(person.research || { tasks: [], notes: '', questions: [] }),
                                            tasks: updatedTasks
                                          }
                                        });
                                      }}
                                      className="bg-surface border border-subtle text-xs rounded px-2 py-1 text-primary w-32"
                                    />
                                    <Clock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                                  </div>

                                  {/* Ta bort */}
                                  <button
                                    onClick={() => {
                                      const updatedTasks = (person.research?.tasks || []).filter((_, i) => i !== idx);
                                      setPerson({
                                        ...person,
                                        research: {
                                          ...(person.research || { tasks: [], notes: '', questions: [] }),
                                          tasks: updatedTasks
                                        }
                                      });
                                    }}
                                    className="text-muted hover:text-danger transition-colors"
                                    title="Ta bort uppgift"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>

                              {/* Noteringar för uppgiften */}
                              <div className="bg-surface rounded border border-subtle mt-2">
                                <Editor
                                  value={task.notes || ''}
                                  onChange={(e) => {
                                    const updatedTasks = [...(person.research?.tasks || [])];
                                    updatedTasks[idx] = { ...task, notes: e.target.value };
                                    setPerson({
                                      ...person,
                                      research: {
                                        ...(person.research || { tasks: [], notes: '', questions: [] }),
                                        tasks: updatedTasks
                                      }
                                    });
                                  }}
                                  placeholder="Lägg till noteringar om denna uppgift..."
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* FORSKNINGSNOTERINGAR */}
                  <div>
                    <h3 className="text-md font-bold text-primary uppercase mb-4 flex items-center gap-2">
                      <BookOpen size={18} className="text-accent" /> Forskningsnoteringar
                    </h3>
                    <div className="bg-background border border-subtle rounded-lg p-4">
                      <Editor
                        value={person.research?.notes || ''}
                        onChange={(e) => {
                          setPerson({
                            ...person,
                            research: {
                              ...(person.research || { tasks: [], notes: '', questions: [] }),
                              notes: e.target.value
                            }
                          });
                        }}
                        placeholder="Skriv fria anteckningar om din forskning här... Vad har du hittat? Vilka källor har du kollat? Vilka teorier har du?"
                      />
                    </div>
                  </div>

                  {/* FRÅGOR ATT BESVARA */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-md font-bold text-primary uppercase flex items-center gap-2">
                        <HelpCircle size={18} className="text-accent" /> Frågor att besvara
                      </h3>
                    </div>

                    {/* Input för ny fråga */}
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newQuestionInput}
                          onChange={(e) => setNewQuestionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newQuestionInput.trim()) {
                              const currentResearch = person.research || { tasks: [], notes: '', questions: [] };
                              setPerson({
                                ...person,
                                research: {
                                  ...currentResearch,
                                  questions: [...(currentResearch.questions || []), {
                                    id: `q_${Date.now()}`,
                                    question: newQuestionInput.trim(),
                                    answered: false
                                  }]
                                }
                              });
                              setNewQuestionInput('');
                            }
                          }}
                          placeholder="Skriv en fråga och tryck Enter..."
                          className="flex-1 bg-background border border-subtle rounded px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent"
                        />
                        <button
                          onClick={() => {
                            if (newQuestionInput.trim()) {
                              const currentResearch = person.research || { tasks: [], notes: '', questions: [] };
                              setPerson({
                                ...person,
                                research: {
                                  ...currentResearch,
                                  questions: [...(currentResearch.questions || []), {
                                    id: `q_${Date.now()}`,
                                    question: newQuestionInput.trim(),
                                    answered: false
                                  }]
                                }
                              });
                              setNewQuestionInput('');
                            }
                          }}
                          className="bg-accent hover:bg-accent text-on-accent px-4 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                        >
                          <Plus size={16} /> Lägg till
                        </button>
                      </div>
                      <p className="text-xs text-muted mt-1">Tryck Enter eller klicka på "Lägg till" för att lägga till frågan</p>
                    </div>

                    {/* Lista med frågor */}
                    <div className="space-y-2">
                      {(person.research?.questions || []).length === 0 ? (
                        <div className="bg-background border border-subtle rounded-lg p-6 text-center">
                          <HelpCircle size={32} className="text-muted mx-auto mb-2" />
                          <p className="text-muted text-sm">Inga frågor än. Lägg till frågor du behöver hitta svar på.</p>
                        </div>
                      ) : (
                        (person.research?.questions || []).map((q, idx) => (
                          <div
                            key={q.id || idx}
                            className={`bg-background border rounded-lg p-3 flex items-start gap-3 transition-colors ${q.answered ? 'border-success bg-success-soft' : 'border-subtle hover:border-subtle'
                              }`}
                          >
                            <button
                              onClick={() => {
                                const updatedQuestions = [...(person.research?.questions || [])];
                                updatedQuestions[idx] = { ...q, answered: !q.answered };
                                setPerson({
                                  ...person,
                                  research: {
                                    ...(person.research || { tasks: [], notes: '', questions: [] }),
                                    questions: updatedQuestions
                                  }
                                });
                              }}
                              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${q.answered
                                ? 'bg-success border-success text-on-accent'
                                : 'border-subtle hover:border-success'
                                }`}
                              title={q.answered ? 'Markera som obesvarad' : 'Markera som besvarad'}
                            >
                              {q.answered && <Check size={14} />}
                            </button>
                            <input
                              type="text"
                              value={q.question || ''}
                              onChange={(e) => {
                                const updatedQuestions = [...(person.research?.questions || [])];
                                updatedQuestions[idx] = { ...q, question: e.target.value };
                                setPerson({
                                  ...person,
                                  research: {
                                    ...(person.research || { tasks: [], notes: '', questions: [] }),
                                    questions: updatedQuestions
                                  }
                                });
                              }}
                              className={`flex-1 bg-transparent text-sm ${q.answered ? 'text-muted line-through' : 'text-primary'
                                } focus:outline-none focus:border-b border-accent pb-1`}
                              placeholder="Fråga..."
                            />
                            <button
                              onClick={() => {
                                const updatedQuestions = (person.research?.questions || []).filter((_, i) => i !== idx);
                                setPerson({
                                  ...person,
                                  research: {
                                    ...(person.research || { tasks: [], notes: '', questions: [] }),
                                    questions: updatedQuestions
                                  }
                                });
                              }}
                              className="text-muted hover:text-danger transition-colors flex-shrink-0"
                              title="Ta bort fråga"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}


              {/* FLIK: NOTERINGAR */}
              {activeTab === 'notes' && (() => {
                // Säkerställ att alla noteringar har datum (för bakåtkompatibilitet)
                const notesWithDates = (person.notes || []).map(note => {
                  if (!note.createdAt) {
                    return { ...note, createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString() };
                  }
                  if (!note.modifiedAt) {
                    return { ...note, modifiedAt: note.createdAt };
                  }
                  return note;
                });

                // Filtrera noteringar baserat på söktext
                const filteredNotes = notesWithDates.filter(note => {
                  if (!noteSearch) return true;
                  const searchLower = noteSearch.toLowerCase();
                  const titleMatch = (note.title || '').toLowerCase().includes(searchLower);
                  // Sök även i HTML-innehållet (strippa HTML-taggar för sökning)
                  const contentText = (note.content || '').replace(/<[^>]*>/g, '').toLowerCase();
                  const contentMatch = contentText.includes(searchLower);
                  return titleMatch || contentMatch;
                });

                // Hantera drag start
                const handleDragStart = (e, index) => {
                  setDraggedNoteIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/html', e.target.outerHTML);
                  e.target.style.opacity = '0.5';
                };

                // Hantera drag over
                const handleDragOver = (e, index) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverIndex(index);
                };

                // Hantera drag leave
                const handleDragLeave = () => {
                  setDragOverIndex(null);
                };

                // Hantera drop
                const handleDrop = (e, dropIndex) => {
                  e.preventDefault();
                  if (draggedNoteIndex === null || draggedNoteIndex === dropIndex) {
                    setDraggedNoteIndex(null);
                    setDragOverIndex(null);
                    return;
                  }

                  // Hitta originalindex i den ofiltrerade listan
                  const draggedNote = filteredNotes[draggedNoteIndex];
                  const originalDraggedIndex = notesWithDates.findIndex(n => n.id === draggedNote.id);
                  const originalDropIndex = notesWithDates.findIndex(n => n.id === filteredNotes[dropIndex].id);

                  if (originalDraggedIndex !== -1 && originalDropIndex !== -1) {
                    const newNotes = [...notesWithDates];
                    const [removed] = newNotes.splice(originalDraggedIndex, 1);
                    newNotes.splice(originalDropIndex, 0, removed);

                    setPerson(prev => ({
                      ...prev,
                      notes: newNotes
                    }));
                  }

                  setDraggedNoteIndex(null);
                  setDragOverIndex(null);
                };

                // Hantera drag end
                const handleDragEnd = (e) => {
                  e.target.style.opacity = '1';
                  setDraggedNoteIndex(null);
                  setDragOverIndex(null);
                };

                // Formatera datum
                const formatDate = (dateString) => {
                  if (!dateString) return '';
                  try {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('sv-SE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  } catch {
                    return dateString;
                  }
                };

                return (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-primary">Noteringar</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleGenerateBiography}
                          className="text-xs bg-surface-2 hover:bg-surface text-primary px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                        >
                          <Sparkles size={14} /> Generera Biografi
                        </button>
                        <button
                          onClick={() => {
                            const now = new Date().toISOString();
                            const newNote = {
                              id: `note_${Date.now()}`,
                              title: 'Ny notering',
                              content: '',
                              createdAt: now,
                              modifiedAt: now
                            };
                            setPerson(prev => ({
                              ...prev,
                              notes: [...(prev.notes || []), newNote]
                            }));
                          }}
                          className="text-xs bg-accent hover:bg-accent text-on-accent px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                        >
                          <Plus size={14} /> Ny notering
                        </button>
                      </div>
                    </div>

                    {/* Sökfält */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" size={18} />
                      <input
                        type="text"
                        value={noteSearch}
                        onChange={(e) => setNoteSearch(e.target.value)}
                        placeholder="Sök i noteringar..."
                        className="w-full bg-background border border-subtle rounded p-2 pl-10 text-on-accent focus:border-accent focus:outline-none"
                      />
                      {noteSearch && (
                        <button
                          onClick={() => setNoteSearch('')}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-on-accent"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>

                    {(!notesWithDates || notesWithDates.length === 0) ? (
                      <div className="text-center py-12 text-muted">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-sm">Inga noteringar ännu. Klicka på "Ny notering" för att lägga till en.</p>
                      </div>
                    ) : filteredNotes.length === 0 ? (
                      <div className="text-center py-12 text-muted">
                        <Search size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-sm">Inga noteringar matchar din sökning.</p>
                      </div>
                    ) : (
                      filteredNotes.map((note, idx) => {
                        // Hitta originalindex
                        const originalIndex = notesWithDates.findIndex(n => n.id === note.id);

                        return (
                          <div
                            key={note.id || idx}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`bg-background border border-subtle rounded-lg overflow-hidden transition-all cursor-move ${dragOverIndex === idx ? 'border-accent ring-2 ring-accent/50' : ''
                              } ${draggedNoteIndex === idx ? 'opacity-50' : ''}`}
                          >
                            <div className="bg-surface p-3 border-b border-subtle flex justify-between items-center">
                              <div className="flex-1 flex items-center gap-2">
                                <div className="text-muted cursor-grab active:cursor-grabbing" title="Dra för att sortera">
                                  <MoreHorizontal size={18} />
                                </div>
                                <input
                                  type="text"
                                  value={note.title || 'Notering'}
                                  onChange={(e) => {
                                    const now = new Date().toISOString();
                                    setPerson(prev => ({
                                      ...prev,
                                      notes: prev.notes.map((n, i) =>
                                        i === originalIndex
                                          ? { ...n, title: e.target.value, modifiedAt: now }
                                          : n
                                      )
                                    }));
                                  }}
                                  className="bg-transparent font-bold text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 py-1 flex-1"
                                  placeholder="Titel på notering..."
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex gap-3 items-center ml-3">
                                {/* Datum */}
                                <div className="text-xs text-muted flex flex-col items-end">
                                  {note.createdAt && (
                                    <span title="Skapad">Skapad: {formatDate(note.createdAt)}</span>
                                  )}
                                  {note.modifiedAt && note.modifiedAt !== note.createdAt && (
                                    <span title="Senast ändrad" className="text-muted">Ändrad: {formatDate(note.modifiedAt)}</span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPerson(prev => ({
                                      ...prev,
                                      notes: prev.notes.filter((_, i) => i !== originalIndex)
                                    }));
                                  }}
                                  className="text-muted hover:text-danger transition-colors p-1"
                                  title="Ta bort notering"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="p-4 bg-surface" onClick={(e) => e.stopPropagation()}>
                              <Editor
                                value={note.content || ''}
                                onChange={(e) => {
                                  const now = new Date().toISOString();
                                  setPerson(prev => ({
                                    ...prev,
                                    notes: prev.notes.map((n, i) =>
                                      i === originalIndex
                                        ? { ...n, content: e.target.value, modifiedAt: now }
                                        : n
                                    )
                                  }));
                                }}
                                onBlur={() => {
                                  // Autospara när man lämnar editorn
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}

            </div>
          </div>
        )}

        {/* DETAIL BLOCK - visa källa-info för vald händelse */}
        {!isCollapsed && selectedEventIndex !== null && person.events?.[selectedEventIndex] && (
          <div className="bg-surface border-t border-subtle p-4 max-h-40 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-subtle">
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-primary truncate">
                  {person.events[selectedEventIndex].type}
                  {person.events[selectedEventIndex].date && ` - ${person.events[selectedEventIndex].date}`}
                </h4>
                {buildEventSummary(person.events[selectedEventIndex]) && (
                  <p className="text-[11px] text-secondary truncate mt-0.5">
                    {buildEventSummary(person.events[selectedEventIndex])}
                  </p>
                )}
              </div>
              {/* INFO-rad kopiad från livshändelser */}
              <div className="flex gap-3 text-xs text-muted">
                <span
                  className={`flex items-center gap-1 cursor-pointer hover:text-accent ${person.events[selectedEventIndex].sources?.length > 0 ? 'text-primary' : ''} ${eventDetailView === 'sources' ? 'text-accent' : ''}`}
                  onClick={() => {
                    setEventDetailView('sources');
                  }}
                >
                  <LinkIcon size={12} /> {person.events[selectedEventIndex].sources?.length || 0}
                </span>
                <span
                  className={`flex items-center gap-1 cursor-pointer hover:text-accent ${getMeaningfulNoteText(person.events[selectedEventIndex].notes) ? 'text-primary' : ''} ${eventDetailView === 'notes' ? 'text-accent' : ''}`}
                  onClick={() => setEventDetailView('notes')}
                  title={getMeaningfulNoteText(person.events[selectedEventIndex].notes) || ''}
                >
                  <FileText size={12} /> {getMeaningfulNoteText(person.events[selectedEventIndex].notes) ? 1 : 0}
                </span>
                <span
                  className={`flex items-center gap-1 cursor-pointer hover:text-accent ${(Array.isArray(person.events[selectedEventIndex].images) ? person.events[selectedEventIndex].images.length : (person.events[selectedEventIndex].images || 0)) > 0 ? 'text-primary' : ''} ${eventDetailView === 'images' ? 'text-accent' : ''}`}
                  onClick={() => setEventDetailView('images')}
                >
                  <ImageIcon size={12} /> {Array.isArray(person.events[selectedEventIndex].images) ? person.events[selectedEventIndex].images.length : (person.events[selectedEventIndex].images || 0)}
                </span>
              </div>
            </div>

            {/* Källa-sektion */}
            {eventDetailView === 'sources' && (
              <>
                {person.events[selectedEventIndex].sources && person.events[selectedEventIndex].sources.length > 0 ? (
                  <div className="space-y-2" key={`sources-${sourceRefreshKey}`}>
                    {person.events[selectedEventIndex].sources.map((sourceId) => {
                      // Hämta källan från allSources
                      let source = allSources?.find(s => s.id === sourceId);

                      if (!source) return null;

                      // Mappa database-fältnamn till display-namn
                      // Database uses: date, imagePage, page, trust
                      // Display uses: year, image, page, credibility
                      const displaySource = {
                        ...source,
                        year: source.date || source.year,
                        image: source.imagePage || source.image,
                        bildId: source.bildId || source.bildid || source.raId,
                        credibility: source.trust || source.credibility
                      };
                      const sourceTitleLine = [
                        displaySource.title || displaySource.archive || 'Ingen titel',
                        displaySource.volume ? `vol. ${displaySource.volume}` : '',
                        displaySource.year ? `(${displaySource.year})` : ''
                      ].filter(Boolean).join(' ');
                      const sourceReferenceText = displaySource.bildId ? `bildid: ${displaySource.bildId}` : '';
                      const sourceNotesText = getMeaningfulNoteText(displaySource.notes);
                      const sourceImageRefs = Array.isArray(displaySource.images) ? displaySource.images : [];
                      const resolvedSourceImages = sourceImageRefs
                        .map((imgRef, imgIdx) => {
                          if (!imgRef) return null;

                          const refId = (typeof imgRef === 'string' || typeof imgRef === 'number')
                            ? String(imgRef)
                            : (imgRef?.id ? String(imgRef.id) : null);

                          if (refId) {
                            const mediaMatch = (allMediaItems || []).find((m) => String(m?.id) === refId);
                            if (mediaMatch) return mediaMatch;
                          }

                          if (typeof imgRef === 'string') {
                            return {
                              id: `legacy_${sourceId}_${imgIdx}`,
                              url: imgRef,
                              name: 'Bild'
                            };
                          }

                          if (typeof imgRef === 'object') {
                            if (imgRef.url || imgRef.thumbnail) return imgRef;
                            if (imgRef.filePath) {
                              const normalizedPath = String(imgRef.filePath).replace(/\\/g, '/');
                              return {
                                ...imgRef,
                                url: `media://${encodeURIComponent(normalizedPath)}`
                              };
                            }
                          }

                          return null;
                        })
                        .filter(Boolean);

                      console.log('🔍 SOURCE FOR DISPLAY (mapped):', {
                        sourceId,
                        title: displaySource.title,
                        volume: displaySource.volume,
                        year: displaySource.year,
                        image: displaySource.image,
                        page: displaySource.page,
                        credibility: displaySource.credibility,
                        allSourcesLength: allSources?.length
                      });

                      return (
                        <div key={sourceId} className="bg-surface p-2 rounded border border-subtle flex items-start gap-3">
                          {/* Thumbnails */}
                          <div className="flex gap-1 items-start">
                            {resolvedSourceImages.length > 0 ? (
                              resolvedSourceImages.slice(0, 3).map((img, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="relative"
                                  onMouseEnter={(e) => updateSourceThumbHover(e.clientX, e.clientY, img.url || img.thumbnail, img.name || 'Källbild')}
                                  onMouseMove={(e) => updateSourceThumbHover(e.clientX, e.clientY, img.url || img.thumbnail, img.name || 'Källbild')}
                                  onMouseLeave={closeSourceThumbHover}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeSourceThumbHover();
                                    setSourceImageViewerMedia(resolvedSourceImages);
                                    setImageEditorContext('source');
                                    setEditingImageIndex(idx);
                                    setIsImageEditorOpen(true);
                                  }}
                                  title="Öppna i bildvisaren"
                                >
                                  <MediaImage
                                    url={img.url || img.thumbnail}
                                    alt="Thumbnail"
                                    className="h-8 w-8 object-cover rounded cursor-pointer border border-subtle hover:border-accent"
                                  />
                                </button>
                              ))
                            ) : (
                              <div className="h-8 w-8 bg-surface-2 rounded flex items-center justify-center text-muted">
                                <ImageIcon size={12} />
                              </div>
                            )}
                          </div>

                          {/* Source info */}
                          <div className="flex-1 text-xs">
                            <div className="font-semibold text-primary mb-1 flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                className="text-left hover:text-accent hover:underline"
                                title={sourceTitleLine}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (typeof handleNavigateToSource === 'function') {
                                    handleNavigateToSource(source.id);
                                  }
                                }}
                              >
                                {`${displaySource.title || displaySource.archive || 'Ingen titel'}${displaySource.volume ? ` vol. ${displaySource.volume}` : ''}${displaySource.year ? ` (${displaySource.year})` : ''}`}
                              </button>
                              {sourceReferenceText && (
                                <button
                                  type="button"
                                  className="text-muted hover:text-accent hover:underline text-left"
                                  title={`Öppna RA: ${displaySource.bildId}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (displaySource.bildId) {
                                      window.open(`https://sok.riksarkivet.se/bildvisning/${displaySource.bildId}`, '_blank');
                                    }
                                  }}
                                >
                                  {`, ${sourceReferenceText}`}
                                </button>
                              )}
                            </div>

                            {/* Trovärdighet - Stjärnor */}
                            <div className="flex gap-0.5 mt-1 items-center">
                              <span className="text-xs text-muted mr-1">Trovärdighet:</span>
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className={i < (displaySource.credibility || 0) ? "text-warning" : "text-muted"}>★</span>
                              ))}
                              {displaySource.credibilityLabel && <span className="ml-1 text-secondary text-xs">{displaySource.credibilityLabel}</span>}
                            </div>

                            {/* Trovärdighetsikoner */}
                            <div className="flex gap-2 mt-1">
                              {/* AD - Arkivdigital */}
                              <button
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${displaySource.aid ? 'bg-success-soft text-success hover:bg-success-soft cursor-pointer' : 'bg-surface-2 text-muted cursor-default'}`}
                                title={displaySource.aid ? `AID: ${displaySource.aid}` : 'Inte länkat till Arkivdigital'}
                                onClick={() => displaySource.aid && window.open(`https://www.arkivdigital.se/aid/show/${displaySource.aid}`, '_blank')}
                              >
                                AD
                              </button>

                              {/* RA - Riksarkivet */}
                              <button
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${displaySource.bildId ? 'bg-success-soft text-success hover:bg-success-soft cursor-pointer' : 'bg-surface-2 text-muted cursor-default'}`}
                                title={displaySource.bildId ? `BILDID: ${displaySource.bildId}` : 'Inte länkat till Riksarkivet'}
                                onClick={() => displaySource.bildId && window.open(`https://sok.riksarkivet.se/bildvisning/${displaySource.bildId}`, '_blank')}
                              >
                                RA
                              </button>

                              {/* NAD - Näringsliv Arkiv Digital */}
                              <button
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${displaySource.nad ? 'bg-success-soft text-success hover:bg-success-soft cursor-pointer' : 'bg-surface-2 text-muted cursor-default'}`}
                                title={displaySource.nad ? `NAD: ${displaySource.nad}` : 'Inte länkat till NAD'}
                                onClick={() => displaySource.nad && window.open(`https://sok.riksarkivet.se/?postid=ArkisRef%20${displaySource.nad}`, '_blank')}
                              >
                                NAD
                              </button>
                            </div>

                            {sourceNotesText && (
                              <div className="mt-1 text-muted text-xs italic line-clamp-1">
                                {sourceNotesText}
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-1 ml-2 items-center text-xs">
                            {/* Noter-ikon */}
                            {sourceNotesText && (
                              <div className="relative group">
                                <button
                                  className="text-muted hover:text-accent p-1 flex items-center gap-0.5"
                                  title="Noter"
                                >
                                  <FileText size={12} />
                                  <span className="text-muted">1</span>
                                </button>
                                <div className="absolute hidden group-hover:block z-50 bg-background text-on-accent text-xs rounded shadow-lg p-2 right-0 top-6 min-w-max max-w-xs whitespace-normal">
                                  {sourceNotesText}
                                  <div className="absolute top-0 right-2 transform -translate-y-1 w-2 h-2 bg-background rotate-45"></div>
                                </div>
                              </div>
                            )}

                            {/* Bild-ikon */}
                            {displaySource.images && displaySource.images.length > 0 && (
                              <button
                                className="text-muted hover:text-accent p-1 flex items-center gap-0.5"
                                title={`${displaySource.images.length} bilder`}
                              >
                                <ImageIcon size={12} />
                                <span className="text-muted">{displaySource.images.length}</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                // Öppna Source Drawer för att redigera källan
                                if (onOpenSourceDrawer) {
                                  onOpenSourceDrawer(person.id, null);
                                  // Navigera till källan (detta kan behöva justeras beroende på hur SourceDrawer hanterar navigation)
                                  console.log('Opening source drawer to edit source:', sourceId);
                                }
                              }}
                              className="text-muted hover:text-accent p-1"
                              title="Redigera källa"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => {
                                const newSources = person.events[selectedEventIndex].sources.filter(id => id !== sourceId);
                                const updatedEvents = person.events.map((e, i) =>
                                  i === selectedEventIndex ? { ...e, sources: newSources } : e
                                );
                                setPerson({ ...person, events: updatedEvents });
                              }}
                              className="text-muted hover:text-danger p-1"
                              title="Ta bort källa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted">Ingen källa kopplad till denna händelse</p>
                )}
              </>
            )}

            {/* Notiser-sektion */}
            {eventDetailView === 'notes' && (
              <div className="space-y-2">
                {person.events[selectedEventIndex].notes ? (
                  <div className="bg-background border border-subtle rounded p-3">
                    <div className="bg-surface border border-subtle rounded p-3 min-h-[100px]">
                      <Editor
                        value={person.events[selectedEventIndex].notes || ''}
                        onChange={(e) => {
                          const updatedEvents = person.events.map((e, i) =>
                            i === selectedEventIndex ? { ...e, notes: e.target.value } : e
                          );
                          setPerson({ ...person, events: updatedEvents });
                        }}
                        placeholder="Inga noteringar..."
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted">Inga noteringar för denna händelse</p>
                )}
              </div>
            )}

            {/* Bilder-sektion */}
            {eventDetailView === 'images' && (
              <div className="space-y-2">
                {(() => {
                  const eventImages = Array.isArray(person.events[selectedEventIndex].images)
                    ? person.events[selectedEventIndex].images
                    : [];

                  if (eventImages.length === 0) {
                    return <p className="text-xs text-muted">Inga bilder kopplade till denna händelse</p>;
                  }

                  // Hämta media-objekt från allMediaItems
                  const mediaObjects = allMediaItems.filter(m => eventImages.includes(m.id));

                  return (
                    <div className="grid grid-cols-8 gap-2">
                      {mediaObjects.map((mediaItem, idx) => (
                        <div
                          key={mediaItem.id}
                          className="relative aspect-square bg-background rounded-lg border-2 border-subtle overflow-hidden cursor-pointer hover:border-accent hover:shadow-lg transition-all group"
                          onDoubleClick={() => {
                            setImageEditorContext('event');
                            setEditingImageIndex(idx);
                            setIsImageEditorOpen(true);
                          }}
                          title="Dubbelklicka för att öppna i bildredigerare"
                        >
                          <MediaImage
                            url={mediaItem.url}
                            alt={mediaItem.name || 'Bild'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                            <p className="text-on-accent text-xs font-medium truncate mb-0.5">{mediaItem.name || 'Namnlös'}</p>
                            {mediaItem.date && (
                              <p className="text-on-accent/70 text-[10px]">{mediaItem.date}</p>
                            )}
                          </div>
                          <div className="absolute top-2 right-2 bg-background/50 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ImageIcon size={14} className="text-on-accent" />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Notiser-sektion */}
            {eventDetailView === 'notes' && (
              <div className="space-y-2">
                {person.events[selectedEventIndex].notes ? (
                  <div className="bg-background border border-subtle rounded p-3">
                    <div className="bg-surface border border-subtle rounded p-3 min-h-[100px]">
                      <Editor
                        value={person.events[selectedEventIndex].notes || ''}
                        onChange={(e) => {
                          const updatedEvents = person.events.map((e, i) =>
                            i === selectedEventIndex ? { ...e, notes: e.target.value } : e
                          );
                          setPerson({ ...person, events: updatedEvents });
                        }}
                        placeholder="Inga noteringar..."
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted">Inga noteringar för denna händelse</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* FOOTER */}
        {/* Footer borttagen - ändringar sparas automatiskt */}
      </div>

      {/* --- EVENT MODAL (SUB-MODAL) --- */}
      {isEventTypeMenuOpen && createPortal(
        <div
          ref={eventTypeMenuRef}
          className="fixed z-[6005] rounded-lg border border-subtle bg-background shadow-2xl overflow-hidden"
          style={{
            top: `${eventTypeMenuPosition.top}px`,
            left: `${eventTypeMenuPosition.left}px`,
            width: `${eventTypeMenuPosition.width}px`,
            maxHeight: `${eventTypeMenuPosition.maxHeight}px`
          }}
        >
          <div className="px-3 py-2 border-b border-subtle space-y-2">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Välj händelsetyp</div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={eventTypeSearchInputRef}
                type="text"
                value={eventTypeSearch}
                onChange={(e) => setEventTypeSearch(e.target.value)}
                onKeyDown={handleEventTypeMenuKeyDown}
                placeholder="Sök händelsetyp..."
                role="combobox"
                aria-expanded={isEventTypeMenuOpen}
                aria-controls="event-type-listbox"
                aria-autocomplete="list"
                aria-activedescendant={eventTypeActiveIndex >= 0 && eventTypeOptions[eventTypeActiveIndex] ? `event-type-option-${eventTypeOptions[eventTypeActiveIndex].value}` : undefined}
                className="w-full bg-background border border-subtle rounded pl-8 pr-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div
            id="event-type-listbox"
            role="listbox"
            aria-label="Händelsetyper"
            className="overflow-y-auto"
            style={{ maxHeight: `${Math.max(220, eventTypeMenuPosition.maxHeight - 82)}px` }}
          >
            {eventTypeOptions.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted">Ingen händelsetyp matchade sökningen.</div>
            )}

            {EVENT_TYPE_CATEGORIES.map((category) => {
              const categoryItems = eventTypeOptions.filter((eventType) => eventType.category === category);
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} role="group" aria-label={category}>
                  <div className="px-3 py-1.5 bg-surface/60 border-y border-subtle text-[10px] font-bold uppercase tracking-wide text-muted">
                    {category}
                  </div>
                  {categoryItems.map((eventType) => {
                    const optionIndex = eventTypeOptions.findIndex((item) => item.value === eventType.value);
                    const isActive = optionIndex === eventTypeActiveIndex;
                    const isDisabled = eventType.unique && editingEventIndex === null && !canAddEventType(eventType.value);

                    return (
                      <button
                        key={eventType.value}
                        id={`event-type-option-${eventType.value}`}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSelectEventType(eventType.value)}
                        onMouseEnter={() => setEventTypeActiveIndex(optionIndex)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${isDisabled
                          ? 'text-muted cursor-not-allowed'
                          : isActive
                            ? 'bg-accent-soft text-primary'
                            : 'text-primary hover:bg-surface'
                          }`}
                      >
                        <span className="text-base w-5 text-center">{eventType.icon}</span>
                        <span className="flex-1">{eventType.label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted">{eventType.gedcomType}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {isEventModalOpen && (
        <WindowFrame
          title={`${editingEventIndex !== null ? 'Redigera' : 'Lägg till'} händelse`}
          icon={Activity}
          initialWidth={600}
          initialHeight={720}
          onClose={closeEventModal}
        >
          <div className="flex flex-col h-full">
            <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-1">
              <div className="space-y-2.5">
                <div className="rounded-lg border border-subtle bg-background/60 px-3 py-2">
                  <div className="text-xs font-bold uppercase text-muted mb-1">Händelsetyp</div>
                  <select
                    value={newEvent.type || ''}
                    onChange={(e) => handleEventTypeChange(e.target.value)}
                    className="w-full bg-background border border-subtle rounded p-2 text-primary focus:border-accent focus:outline-none"
                  >
                    {EVENT_TYPES.map((eventType) => (
                      <option key={eventType.value} value={eventType.value}>
                        {eventType.label}
                      </option>
                    ))}
                  </select>
                </div>

                {newEvent.type === 'Vigsel' && person.relations?.partners?.length > 0 && (
                  <div className="mb-3">
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">Partner</label>
                    <select
                      value={newEvent.partnerId || ''}
                      onChange={e => setNewEvent({ ...newEvent, partnerId: e.target.value })}
                      className="w-full bg-background border border-subtle rounded p-2 text-primary focus:border-accent focus:outline-none"
                    >
                      <option value="">Välj partner...</option>
                      {person.relations.partners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {renderEventTypeFields()}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">Datum</label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                      <input
                        ref={eventDateInputRef}
                        type="text"
                        placeholder="t.ex. 21 nov 1980, från 1950, ca 1920"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                        onKeyDown={handleEventModalInputKeyDown}
                        className="w-full bg-background border border-subtle rounded pl-9 p-2 text-primary focus:border-accent focus:outline-none"
                        onBlur={(e) => setNewEvent({ ...newEvent, date: parseAndFormatDate(e.target.value) })}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1">Format: ÅÅÅÅ-MM-DD, eller skriv naturligt</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">Plats</label>
                    <PlacePicker
                      value={newEvent.placeId || ''}
                      displayValue={newEvent.place || ''}
                      allPlaces={allPlaces || []}
                      onChange={(placeId, placeObject) => {
                        const placeName = placeObject ? (placeObject.name || placeObject.ortnamn || placeObject.sockenstadnamn || '') : '';
                        setNewEvent({ ...newEvent, placeId, place: placeName, placeData: placeObject });
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label className="block text-xs font-bold text-secondary uppercase">Medverkande / Vittnen (Dopvittnen, inneboende etc)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setWitnessModalOpen(true);
                        if (linkedPersonsForEvent.length > 0) {
                          loadWitnessIntoDraft(linkedPersonsForEvent[0]);
                        } else {
                          resetWitnessDraft('existing');
                        }
                      }}
                      className="text-xs bg-surface-2 hover:bg-surface text-accent px-2 py-1 rounded"
                    >
                      Hantera
                    </button>
                  </div>

                  {linkedPersonsForEvent.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                      {linkedPersonsForEvent.map((personLink) => (
                        <span
                          key={personLink.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent-soft border border-accent text-on-accent text-xs"
                          title={personLink.note || undefined}
                        >
                          <span className="font-semibold">{personLink.role || 'Vittne'}:</span>
                          <span>{personLink.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted mt-1">Inga vittnen tillagda</p>
                  )}
                </div>
              </div>

              {/* Källor */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-secondary uppercase">Källor</label>
                  <button
                    onClick={() => {
                      // Öppna source drawer UTAN att spara personen
                      // Använd ett speciellt eventId som signalerar att vi är i edit-läge
                      if (onOpenSourceDrawer) {
                        // Sätt en global callback som source drawer kan använda
                        window.__addSourceToEvent = (sourceId) => {
                          setNewEvent(prev => ({
                            ...prev,
                            sources: prev.sources.includes(sourceId)
                              ? prev.sources
                              : [...prev.sources, sourceId]
                          }));
                        };

                        // Öppna drawer med ett speciellt flag
                        onOpenSourceDrawer(person.id, '__editing__');
                      } else {
                        setSourceModalOpen(true);
                      }
                    }}
                    className="text-xs bg-surface-2 hover:bg-surface text-accent px-2 py-1 rounded flex items-center gap-1"
                  >
                    <Plus size={12} /> Lägg till källa
                  </button>
                </div>

                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onMouseEnter={() => refreshClipboardSourceAvailability()}
                    onClick={handlePasteSourceToEditingEvent}
                    disabled={!hasClipboardSourceText || isPastingSourceFromClipboard}
                    className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${hasClipboardSourceText && !isPastingSourceFromClipboard ? 'bg-accent-soft hover:bg-accent-soft text-accent' : 'bg-surface-2 text-muted cursor-not-allowed opacity-60'}`}
                    title={hasClipboardSourceText ? 'Klistra in källa från clipboard' : 'Kopiera en källa först (t.ex. från ArkivDigital/SVAR)'}
                  >
                    <ClipboardList size={12} />
                    {isPastingSourceFromClipboard ? 'Klistrar in...' : 'Klistra in källa'}
                  </button>
                </div>

                {newEvent.sources && newEvent.sources.length > 0 ? (
                  <div className="space-y-2">
                    {newEvent.sources.map((sourceId, idx) => {
                      const source = allSources?.find(s => s.id === sourceId);
                      if (!source) return null;

                      const sourceYear = source.date || source.year;
                      const sourceBildId = source.bildid || source.bildId || source.raId;
                      const sourceMainText = `${source.title || 'Ingen titel'}${source.volume ? ` vol. ${source.volume}` : ''}${sourceYear ? ` (${sourceYear})` : ''}`;
                      const sourceImageRefs = Array.isArray(source.images) ? source.images : [];
                      const resolvedSourceImages = sourceImageRefs
                        .map((imgRef, imgIdx) => {
                          if (!imgRef) return null;

                          const refId = (typeof imgRef === 'string' || typeof imgRef === 'number')
                            ? String(imgRef)
                            : (imgRef?.id ? String(imgRef.id) : null);

                          if (refId) {
                            const mediaMatch = (allMediaItems || []).find((m) => String(m?.id) === refId);
                            if (mediaMatch) return mediaMatch;
                          }

                          if (typeof imgRef === 'string') {
                            return {
                              id: `event_src_legacy_${sourceId}_${imgIdx}`,
                              url: imgRef,
                              name: 'Bild'
                            };
                          }

                          if (typeof imgRef === 'object') {
                            if (imgRef.url || imgRef.thumbnail) return imgRef;
                            if (imgRef.filePath) {
                              const normalizedPath = String(imgRef.filePath).replace(/\\/g, '/');
                              return {
                                ...imgRef,
                                url: `media://${encodeURIComponent(normalizedPath)}`
                              };
                            }
                          }

                          return null;
                        })
                        .filter(Boolean);

                      return (
                        <div key={sourceId} className="bg-surface p-3 rounded text-sm border border-subtle flex items-start gap-3">
                          {resolvedSourceImages.length > 0 && (
                            <div className="flex gap-1 items-start shrink-0">
                              {resolvedSourceImages.slice(0, 3).map((img, imgIdx) => (
                                <button
                                  key={img.id || imgIdx}
                                  type="button"
                                  className="relative"
                                  onMouseEnter={(e) => updateSourceThumbHover(e.clientX, e.clientY, img.url || img.thumbnail, img.name || 'Källbild')}
                                  onMouseMove={(e) => updateSourceThumbHover(e.clientX, e.clientY, img.url || img.thumbnail, img.name || 'Källbild')}
                                  onMouseLeave={closeSourceThumbHover}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeSourceThumbHover();
                                    setSourceImageViewerMedia(resolvedSourceImages);
                                    setImageEditorContext('source');
                                    setEditingImageIndex(imgIdx);
                                    setIsImageEditorOpen(true);
                                  }}
                                  title="Öppna i bildvisaren"
                                >
                                  <MediaImage
                                    url={img.url || img.thumbnail}
                                    alt={img.name || 'Källbild'}
                                    className="h-9 w-9 object-cover rounded border border-subtle"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-primary mb-1 flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                className="text-left hover:text-accent hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (typeof handleNavigateToSource === 'function') {
                                    handleNavigateToSource(source.id);
                                  }
                                }}
                              >
                                {sourceMainText}
                              </button>
                              {sourceBildId && (
                                <button
                                  type="button"
                                  className="text-muted hover:text-accent hover:underline text-left"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`https://sok.riksarkivet.se/bildvisning/${sourceBildId}`, '_blank');
                                  }}
                                >
                                  {`, bildid: ${sourceBildId}`}
                                </button>
                              )}
                            </div>
                            {source.aid && (
                              <a
                                href={`https://www.arkivdigital.se/aid/show/${source.aid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:text-accent underline text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                AID: {source.aid}
                              </a>
                            )}
                          </div>
                          <div className="flex gap-2 ml-3 shrink-0">
                            <button
                              onClick={() => setNewEvent({
                                ...newEvent,
                                sources: newEvent.sources.filter(id => id !== sourceId)
                              })}
                              className="text-muted hover:text-danger p-1"
                              title="Ta bort källa"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted">Ingen källa tillagd</p>
                )}
              </div>

              {/* Bilder */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-secondary uppercase">Bilder</label>
                </div>
                <div className="bg-background border border-subtle rounded p-3 min-h-[140px]">
                  <MediaSelector
                    media={(() => {
                      // Hämta media-objekt från allMediaItems baserat på IDs i newEvent.images
                      if (!Array.isArray(newEvent.images) || newEvent.images.length === 0) return [];
                      return allMediaItems.filter(m => newEvent.images.includes(m.id));
                    })()}
                    onMediaChange={(newMedia) => {
                      // Uppdatera newEvent.images med IDs från valda media
                      const imageIds = newMedia.map(m => m.id);
                      setNewEvent({ ...newEvent, images: imageIds });
                    }}
                    entityType="event"
                    entityId={newEvent.id}
                    allPeople={allPeople || []}
                    onOpenEditModal={onOpenEditModal}
                    allMediaItems={allMediaItems}
                    onUpdateAllMedia={onUpdateAllMedia}
                    allSources={allSources || []}
                    allPlaces={allPlaces || []}
                  />
                </div>
              </div>

              {/* Noteringar */}
              {(!selectedEventFields.some((field) => field.key === 'note')) && (
                <div>
                  <label className="block text-xs font-bold text-secondary uppercase mb-1">Noteringar</label>
                  <div className="bg-background border border-subtle rounded p-2 min-h-[80px]">
                    <Editor
                      value={newEvent.notes || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                      placeholder="Lägg till noter för denna händelse..."
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-background px-4 py-3 border-t border-subtle flex justify-end gap-3 shrink-0">
              <button onClick={closeEventModal} className="px-4 py-2 text-sm text-muted hover:text-on-accent rounded-md transition-colors">Avbryt</button>
              <button
                onClick={handleSaveEvent}
                className="px-4 py-2 bg-accent hover:bg-accent text-on-accent rounded-md text-sm font-medium transition-colors"
              >
                {editingEventIndex !== null ? 'Uppdatera' : 'Lägg till'} händelse
              </button>
            </div>
          </div>
        </WindowFrame>
      )}

      {isWitnessModalOpen && (
        <WindowFrame
          title={`Vittnen till [${newEvent.type || 'Händelse'}] ${newEvent.date || ''} ${newEvent.place || ''}`.trim()}
          icon={Users}
          initialWidth={1040}
          initialHeight={740}
          initialX={40}
          initialY={40}
          ignoreSavedPosition={true}
          onClose={() => setWitnessModalOpen(false)}
        >
          <div className="flex flex-col h-full bg-background">
            <div className="flex-1 grid grid-cols-12 gap-3 p-4 overflow-hidden">
              <div className="col-span-5 border border-subtle rounded-md bg-surface overflow-hidden flex flex-col">
                <div className="px-3 py-2 text-xs font-bold uppercase text-secondary border-b border-subtle flex justify-between items-center">
                  <span>Vittnen</span>
                  <button
                    type="button"
                    onClick={() => resetWitnessDraft('existing')}
                    className="text-[11px] px-2 py-1 rounded bg-surface-2 hover:bg-surface text-primary"
                  >
                    Nytt vittne
                  </button>
                </div>
                <div className="overflow-auto flex-1">
                  {linkedPersonsForEvent.length === 0 ? (
                    <div className="p-4 text-sm text-muted">Inga vittnen registrerade ännu.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-surface border-b border-subtle text-secondary">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Roll</th>
                          <th className="text-left px-3 py-2 font-semibold">Vittne</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedPersonsForEvent.map((entry) => (
                          <tr
                            key={entry.id}
                            className={`cursor-pointer border-b border-subtle ${selectedWitnessId === entry.id ? 'bg-accent-soft' : 'hover:bg-surface/60'}`}
                            onClick={() => loadWitnessIntoDraft(entry)}
                          >
                            <td className="px-3 py-2 text-secondary">{entry.role || 'Vittne'}</td>
                            <td className="px-3 py-2 text-accent underline underline-offset-2">{entry.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="col-span-7 border border-subtle rounded-md bg-surface p-4 flex flex-col">
                <div className="space-y-3 flex-1">
                  <h3 className="text-lg font-semibold text-primary">{witnessDraft.id ? 'Redigera vittne' : 'Nytt vittne'}</h3>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">Vittne</label>
                    <select
                      value={witnessMode}
                      onChange={(e) => {
                        const nextMode = e.target.value;
                        setWitnessMode(nextMode);
                        setWitnessDraft((prev) => ({
                          ...prev,
                          personId: nextMode === 'existing' ? prev.personId : '',
                          name: nextMode === 'free' ? prev.name : prev.name
                        }));
                      }}
                      className="w-full bg-background border border-subtle rounded p-2 text-primary"
                    >
                      <option value="existing">Befintlig person</option>
                      <option value="free">Ny person / Fritext</option>
                    </select>
                  </div>

                  {witnessMode === 'existing' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={witnessSearch}
                        onChange={(e) => setWitnessSearch(e.target.value)}
                        className="w-full bg-background border border-subtle rounded p-2 text-primary"
                        placeholder="Sök befintlig person i fritext..."
                      />
                      <div className="max-h-44 overflow-auto border border-subtle rounded bg-background">
                        {filteredWitnessCandidates.length === 0 ? (
                          <p className="p-2 text-xs text-muted">Inga matchningar</p>
                        ) : (
                          filteredWitnessCandidates.map((candidate) => {
                            const displayName = formatWitnessPersonName(candidate);
                            const isSelected = String(witnessDraft.personId || '') === String(candidate.id);
                            return (
                              <button
                                key={candidate.id}
                                type="button"
                                onClick={() => handlePickWitnessPerson(candidate.id)}
                                className={`w-full text-left px-2 py-1.5 text-sm border-b border-subtle last:border-b-0 ${isSelected ? 'bg-accent-soft text-accent' : 'text-primary hover:bg-surface'}`}
                              >
                                {displayName}
                                {candidate.refNumber ? ` (REF: ${candidate.refNumber})` : ''}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={witnessDraft.name}
                        onChange={(e) => setWitnessDraft((prev) => ({ ...prev, name: e.target.value, personId: '' }))}
                        className="w-full bg-background border border-subtle rounded p-2 text-primary"
                        placeholder="Namn på vittne (fritext)..."
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">Roll</label>
                    <select
                      value={witnessDraft.role || (witnessRoleOptionsForType[0] || 'Vittne')}
                      onChange={(e) => setWitnessDraft((prev) => ({ ...prev, role: e.target.value }))}
                      className="w-full bg-background border border-subtle rounded p-2 text-primary"
                    >
                      {witnessRoleOptionsForType.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>{roleOption}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase mb-1">Notering</label>
                    <textarea
                      value={witnessDraft.note || ''}
                      onChange={(e) => setWitnessDraft((prev) => ({ ...prev, note: e.target.value }))}
                      className="w-full h-24 bg-background border border-subtle rounded p-2 text-primary resize-none"
                      placeholder="Frivillig notering..."
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 mt-4 pt-3 border-t border-subtle">
                  <button
                    type="button"
                    onClick={() => witnessDraft.id && handleDeleteWitnessEntry(witnessDraft.id)}
                    disabled={!witnessDraft.id}
                    className="px-3 py-2 text-sm rounded bg-danger-soft border border-danger text-on-accent hover:bg-danger disabled:opacity-50"
                  >
                    Ta bort
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWitnessModalOpen(false)}
                      className="px-3 py-2 text-sm rounded border border-subtle text-secondary hover:bg-surface-2"
                    >
                      Stäng
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveWitnessDraft(false)}
                      className="px-3 py-2 text-sm rounded bg-surface-2 text-primary hover:bg-surface"
                    >
                      Spara
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveWitnessDraft(true)}
                      className="px-3 py-2 text-sm rounded bg-accent text-on-accent hover:bg-accent"
                    >
                      Spara och stäng
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </WindowFrame>
      )}

      {/* --- IMAGE VIEWER (UNIFIED EDITOR) --- */}
      {isImageEditorOpen && (() => {
        const mediaObjects = imageEditorContext === 'person'
          ? (Array.isArray(person.media) ? person.media : [])
          : imageEditorContext === 'source'
            ? (Array.isArray(sourceImageViewerMedia) ? sourceImageViewerMedia : [])
            : (() => {
              const eventImages = selectedEventIndex !== null && person.events?.[selectedEventIndex]?.images
                ? (Array.isArray(person.events[selectedEventIndex].images)
                  ? person.events[selectedEventIndex].images
                  : [])
                : [];
              return allMediaItems.filter(m => eventImages.includes(m.id));
            })();

        const currentImage = editingImageIndex !== null ? mediaObjects[editingImageIndex] : null;
        const prevImage = editingImageIndex !== null && editingImageIndex > 0 ? mediaObjects[editingImageIndex - 1] : null;
        const nextImage = editingImageIndex !== null && editingImageIndex < mediaObjects.length - 1 ? mediaObjects[editingImageIndex + 1] : null;

        return (
          <ImageViewer
            isOpen={isImageEditorOpen}
            onClose={() => {
              setIsImageEditorOpen(false);
              setEditingImageIndex(null);
              setImageEditorContext('event');
              setSourceImageViewerMedia([]);
            }}
            imageSrc={currentImage?.url || currentImage?.path}
            imageTitle={currentImage?.name}
            imageMeta={currentImage}
            regions={currentImage?.regions || currentImage?.faces || []}
            onSaveRegions={(newRegions) => {
              if (!currentImage) return;
              if (imageEditorContext === 'person') {
                const personMedia = Array.isArray(person.media) ? [...person.media] : [];
                if (editingImageIndex !== null && personMedia[editingImageIndex]) {
                  personMedia[editingImageIndex] = {
                    ...personMedia[editingImageIndex],
                    regions: newRegions,
                    faces: newRegions
                  };
                  setPerson({ ...person, media: personMedia });
                }

                if (typeof onUpdateAllMedia === 'function') {
                  const nextAllMedia = (allMediaItems || []).map((item) =>
                    String(item?.id) === String(currentImage?.id)
                      ? { ...item, regions: newRegions, faces: newRegions }
                      : item
                  );
                  onUpdateAllMedia(nextAllMedia);
                }
              }

              if (imageEditorContext === 'source' && typeof onUpdateAllMedia === 'function') {
                const nextAllMedia = (allMediaItems || []).map((item) =>
                  String(item?.id) === String(currentImage?.id)
                    ? { ...item, regions: newRegions, faces: newRegions }
                    : item
                );
                onUpdateAllMedia(nextAllMedia);
              }
            }}
            onSaveImageMeta={(metaPatch) => {
              if (!currentImage || !metaPatch) return;

              const applyMetaPatch = (item) => ({
                ...item,
                name: metaPatch.name ?? item.name,
                description: metaPatch.description ?? item.description,
                note: metaPatch.note ?? item.note,
                tags: metaPatch.tags ?? item.tags,
                photographer: metaPatch.photographer ?? item.photographer,
                creator: metaPatch.creator ?? item.creator
              });

              if (imageEditorContext === 'person') {
                const personMedia = Array.isArray(person.media) ? [...person.media] : [];
                if (editingImageIndex !== null && personMedia[editingImageIndex]) {
                  personMedia[editingImageIndex] = applyMetaPatch(personMedia[editingImageIndex]);
                  setPerson({ ...person, media: personMedia });
                }
              }

              if (typeof onUpdateAllMedia === 'function') {
                const nextAllMedia = (allMediaItems || []).map((item) =>
                  String(item?.id) === String(currentImage?.id) ? applyMetaPatch(item) : item
                );
                onUpdateAllMedia(nextAllMedia);
              }
            }}
            onPrev={() => {
              if (editingImageIndex !== null && editingImageIndex > 0) {
                setEditingImageIndex(editingImageIndex - 1);
              }
            }}
            onNext={() => {
              if (editingImageIndex !== null && editingImageIndex < mediaObjects.length - 1) {
                setEditingImageIndex(editingImageIndex + 1);
              }
            }}
            hasPrev={!!prevImage}
            hasNext={!!nextImage}
            people={Array.isArray(allPeople) ? allPeople : []}
            onOpenEditModal={onOpenEditModal}
          />
        );
      })()}

      {sourceThumbHover.open && sourceThumbHover.url && createPortal(
        <div
          className="fixed pointer-events-none z-[140000] bg-background border border-subtle rounded-lg shadow-2xl overflow-hidden"
          style={{
            left: `${sourceThumbHover.x}px`,
            top: `${sourceThumbHover.y}px`,
            width: 'clamp(220px, 28vw, 420px)',
            height: 'clamp(180px, 32vh, 460px)'
          }}
        >
          <MediaImage
            url={sourceThumbHover.url}
            alt={sourceThumbHover.name || 'Förhandsvisning'}
            className="w-full h-full object-contain bg-surface"
          />
        </div>,
        document.body
      )}

      {/* --- SOURCE MODAL (SUB-MODAL) --- */}
      <SourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        onAdd={handleAddSource}
        eventType={newEvent.type}
      />

      {/* --- HÖGERKLICKSMENY FÖR HÄNDELSER --- */}
      {eventContextMenu.isOpen && (
        <div
          ref={eventContextMenuRef}
          className="fixed z-[9999] bg-surface border border-subtle rounded-lg shadow-lg inline-block"
          style={{
            left: `${eventContextMenu.x}px`,
            top: `${eventContextMenu.y}px`
          }}
        >
          <div className="py-1 min-w-[200px]">
            {/* Redigera händelse */}
            <button
              onClick={() => {
                if (!hasContextMenuEvent) return;
                handleEditEvent(eventContextMenu.eventId);
                setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
              }}
              disabled={!hasContextMenuEvent}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${hasContextMenuEvent ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <Edit3 size={14} /> Redigera händelse
            </button>

            {/* Byt händelse */}
            <button
              onClick={() => {
                if (!hasContextMenuEvent) return;
                handleEditEvent(eventContextMenu.eventId);
                setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
              }}
              disabled={!hasContextMenuEvent}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${hasContextMenuEvent ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <Edit3 size={14} /> Byt händelse
            </button>

            <div className="my-1 h-px bg-surface-2"></div>

            {/* Kopiera händelse */}
            <button
              onClick={() => handleCopyEvent(eventContextMenu.eventIndex)}
              disabled={!hasContextMenuEvent}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${hasContextMenuEvent ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <Copy size={14} /> Kopiera händelse
            </button>

            {/* Klistra in händelse */}
            <button
              onClick={() => {
                if (!hasCopiedEvent) return;
                handlePasteEvent();
              }}
              disabled={!hasCopiedEvent}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${hasCopiedEvent ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <ClipboardList size={14} /> Klistra in händelse
            </button>

            {/* Kopiera källa */}
            <button
              onClick={() => handleCopyEventSources(eventContextMenu.eventIndex)}
              disabled={!hasContextMenuSources}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${hasContextMenuSources ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <Copy size={14} /> Kopiera källa
            </button>

            {/* Klistra in källa */}
            <button
              onClick={() => handlePasteSourceToSavedEvent(eventContextMenu.eventIndex)}
              onMouseEnter={() => refreshClipboardSourceAvailability()}
              disabled={!hasClipboardSourceText || isPastingSourceFromClipboard || !hasContextMenuEvent}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${hasClipboardSourceText && !isPastingSourceFromClipboard && hasContextMenuEvent ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <ClipboardList size={14} /> {isPastingSourceFromClipboard ? 'Klistrar in källa...' : 'Klistra in källa'}
            </button>

            {/* Kopiera som text */}
            <button
              onClick={() => handleCopyEventAsText(eventContextMenu.eventIndex)}
              disabled={!hasContextMenuEvent}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${hasContextMenuEvent ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <Copy size={14} /> Kopiera som text
            </button>

            <div className="my-1 h-px bg-surface-2"></div>

            {/* Gå till platsen (endast om placeId finns) */}
            {person.events[eventContextMenu.eventIndex]?.placeId && (
              <button
                onClick={() => {
                  const evt = person.events[eventContextMenu.eventIndex];
                  if (evt?.placeId && typeof onTogglePlaceDrawer === 'function') {
                    onTogglePlaceDrawer(evt.placeId);
                  } else if (evt?.placeId && onNavigateToPlace) {
                    onNavigateToPlace(evt.placeId);
                  }
                  setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
                }}
                className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-surface-2 transition-colors flex items-center gap-2"
              >
                <MapPin size={14} /> Gå till platsen
              </button>
            )}

            {/* Sök händelse i arkiv */}
            <button
              onClick={() => handleSearchInArchive(eventContextMenu.eventIndex)}
              disabled={!hasContextMenuEvent}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${hasContextMenuEvent ? 'text-primary hover:bg-surface-2' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <Globe size={14} /> Sök händelse i arkiv
            </button>

            <div className="my-1 h-px bg-surface-2"></div>

            {/* Radera händelse */}
            <button
              onClick={() => {
                if (!hasContextMenuEvent) return;
                if (window.confirm('Är du säker på att du vill ta bort denna händelse?')) {
                  handleDeleteEvent(eventContextMenu.eventIndex);
                  setEventContextMenu({ isOpen: false, x: 0, y: 0, eventIndex: null, eventId: null });
                }
              }}
              disabled={!hasContextMenuEvent}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${hasContextMenuEvent ? 'text-danger hover:bg-danger-soft' : 'text-muted cursor-not-allowed opacity-50'}`}
            >
              <Trash2 size={14} /> Radera händelse
            </button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; border: 2px solid #f3f4f6; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </>
  );
}
