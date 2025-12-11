import React, { useState } from 'react';
import { Search, Download, Filter, AlertCircle } from 'lucide-react';
import WindowFrame from './WindowFrame.jsx';
import Button from './Button.jsx';

/**
 * OAI-PMH arkivharvester modal
 * Söker och skördar kyrkoböcker och arkivhandlingar från Riksarkivet
 */
export function OAIArchiveHarvesterModal({ onClose, onImportSources }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveResults, setArchiveResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestProgress, setHarvestProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  // Filterknappar
  const [filters, setFilters] = useState({
    all: true,
    births: false,
    weddings: false,
    deaths: false,
    households: false,
    mantalslengd: false,
    court: false,
  });

  // Sök efter arkiv
  const handleSearchArchives = async () => {
    if (!searchQuery.trim()) return;
    
    setError(null);
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        verb: 'ListSets',
        metadataPrefix: 'oai_ape_ead',
      });
      
      const response = await fetch(`http://localhost:5006/oai-pmh?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const filteredArchives = (data.sets || []).filter(s => 
        s.setName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (filteredArchives.length === 0) {
        setError(`Inga arkiv hittade för "${searchQuery}"`);
      }
      
      setArchiveResults(filteredArchives);
    } catch (error) {
      console.error('Sökning misslyckades:', error);
      setError(`Sökning misslyckades: ${error.message}`);
      setArchiveResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Skörda dokument från valt arkiv
  const handleHarvest = async () => {
    if (!selectedArchive) return;

    setError(null);
    setIsHarvesting(true);
    setHarvestProgress({ current: 0, total: 0 });

    try {
      const params = new URLSearchParams({
        verb: 'ListIdentifiers',
        metadataPrefix: 'oai_ape_ead',
        set: selectedArchive.setSpec,
      });

      const response = await fetch(`http://localhost:5006/oai-pmh?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const records = data.records || [];
      
      if (records.length === 0) {
        setError('Inga dokument hittades i detta arkiv');
        setIsHarvesting(false);
        return;
      }

      // Filtrera poster baserat på söktermen och valda dokumenttyper
      const filteredRecords = records.filter(record => {
        const identifier = (record.identifier || '').toLowerCase();
        const searchLower = searchQuery.toLowerCase();
        
        // Matcha söktermen mot arkivnamnet i identifieraren
        if (!identifier.includes(searchLower)) return false;
        
        // Filtrera på dokumenttyper om "alla" inte är vald
        if (!filters.all) {
          const hasMatchingType = 
            (filters.births && (identifier.includes('födelsebok') || identifier.includes('dopbok'))) ||
            (filters.weddings && (identifier.includes('vigselbok') || identifier.includes('lysning'))) ||
            (filters.deaths && (identifier.includes('dödbok') || identifier.includes('begrav'))) ||
            (filters.households && (identifier.includes('husförhörslängd') || identifier.includes('katekes'))) ||
            (filters.mantalslengd && identifier.includes('mantalslängd')) ||
            (filters.court && (identifier.includes('dombok') || identifier.includes('tingbok')));
          return hasMatchingType;
        }
        return true;
      });

      if (filteredRecords.length === 0) {
        setError('Inga dokument hittades som matchar din sökning och filter');
        setIsHarvesting(false);
        return;
      }

      // Räkna total antal bilder för progressbar
      const totalImages = filteredRecords.reduce((sum, rec) => sum + (rec.pages?.length || 1), 0);
      setHarvestProgress({ current: 0, total: totalImages });

      // Skapa en källa PER BILD, inte per volym
      const parsedSources = [];
      let imageCount = 0;

      filteredRecords.forEach((record) => {
        const title = extractArchiveName(record) || selectedArchive.setName;
        const volume = extractVolume(record);
        const dateRange = extractDateRange(record);

        // Om posten har bilder, skapa en källa per bild
        const pages = record.pages || [record.bildid || ''];
        
        pages.forEach((bildid) => {
          imageCount++;
          setHarvestProgress(prev => ({ ...prev, current: imageCount }));

          const imagePage = extractImagePage(bildid);
          
          parsedSources.push({
            id: `oai_${record.identifier.replace(/[^a-zA-Z0-9]/g, '_')}_${imagePage}`,
            title: title,
            archiveTop: 'Riksarkivet',
            archive: selectedArchive.setName,
            volume: volume,
            date: dateRange || record.datestamp || '',
            bildid: bildid,
            note: '',
            dateAdded: new Date().toISOString(),
            trust: 4, // "Förstahand" i TrustDropdown
            images: [],
            page: '',
            imagePage: imagePage,
            sourceString: '',
            otherInfo: '',
            nad: record.setSpec || '',
          });
        });
      });

      if (onImportSources) {
        onImportSources(parsedSources);
      }
    } catch (error) {
      console.error('Skörding misslyckades:', error);
      setError(`Skörding misslyckades: ${error.message}`);
    } finally {
      setIsHarvesting(false);
    }
  };

  const extractArchiveLevel = (record) => {
    const identifier = (record.identifier || '').toLowerCase();
    if (identifier.includes('födelsebok') || identifier.includes('dopbok')) return 'Födelseböcker';
    if (identifier.includes('vigselbok') || identifier.includes('lysning')) return 'Vigselböcker';
    if (identifier.includes('dödbok') || identifier.includes('begrav')) return 'Dödböcker';
    if (identifier.includes('husförhörslängd') || identifier.includes('katekes')) return 'Husförhörslängder';
    if (identifier.includes('mantalslängd')) return 'Mantalslängder';
    if (identifier.includes('dombok') || identifier.includes('tingbok')) return 'Domböcker';
    return 'Övrigt';
  };

  const extractArchiveName = (record) => {
    // Försök extrahera arkivnamn från identifieraren
    // T.ex. "Löderups kyrkoarkiv, Husförhörslängder, SE/LLA/13262/A I/6 (1821-1826), bildid: C0061051_00009"
    const identifier = record.identifier || '';
    const match = identifier.match(/^([^,]+)/);
    return match ? match[1].trim() : '';
  };

  const extractVolume = (record) => {
    // T.ex. extrahera "A I/6" från identifieraren
    const identifier = record.identifier || '';
    const match = identifier.match(/([A-Z]+\s+[IVX]+\/?\d*)/);
    return match ? match[1] : '';
  };

  const extractDateRange = (record) => {
    // T.ex. extrahera "(1821-1826)" från identifieraren
    const identifier = record.identifier || '';
    const match = identifier.match(/\((\d{4}[–\-]\d{4})\)/);
    return match ? match[1] : '';
  };

  const extractBildid = (record) => {
    // T.ex. extrahera "C0061051_00009" från identifieraren
    const identifier = record.identifier || '';
    const match = identifier.match(/bildid:\s*([A-Z0-9_]+)/i);
    return match ? match[1] : '';
  };

  const extractImagePage = (bildid) => {
    // Från "C0061051_00009" extrahera "00009" (siffror efter underscore)
    if (!bildid) return '';
    const match = bildid.match(/_(\d+)$/);
    return match ? match[1] : '';
  };

  const toggleFilter = (filterKey) => {
    setFilters(prev => {
      // Om "Alla" klickas: aktivera alla och stäng av övriga flaggor
      if (filterKey === 'all') {
        return {
          all: true,
          births: false,
          weddings: false,
          deaths: false,
          households: false,
          mantalslengd: false,
          court: false,
        };
      }

      // Toggle vald filter, stäng av "all"
      const updated = {
        ...prev,
        all: false,
        [filterKey]: !prev[filterKey],
      };

      // Se till att minst ett filter är aktivt; om alla är avstängda -> återställ till "Alla"
      const anyOn = updated.births || updated.weddings || updated.deaths || updated.households || updated.mantalslengd || updated.court;
      if (!anyOn) {
        return {
          all: true,
          births: false,
          weddings: false,
          deaths: false,
          households: false,
          mantalslengd: false,
          court: false,
        };
      }
      return updated;
    });
  };

  return (
    <WindowFrame
      title="OAI-PMH arkivharvester"
      onClose={onClose}
      icon={Download}
      initialWidth={900}
      initialHeight={700}
    >
      <div className="flex flex-col h-full bg-slate-900">
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-slate-200 font-semibold mb-2">Sök arkiv från Riksarkivet</h3>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="T.ex. Svenstorp, Stockholm..."
                className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none text-sm placeholder-slate-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchArchives()}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSearchArchives}
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? 'Söker...' : 'Sök'}
            </Button>
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-b border-red-700 text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* ARKIV RESULTAT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {archiveResults.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2 p-4">
              <Search size={32} className="opacity-20" />
              <span>Inga arkiv hittade. Sök för att komma igång.</span>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {archiveResults.map((archive) => (
                <div
                  key={archive.setSpec}
                  onClick={() => setSelectedArchive(archive)}
                  className={`p-3 rounded border-2 cursor-pointer transition-colors ${
                    selectedArchive?.setSpec === archive.setSpec
                      ? 'bg-blue-900/30 border-blue-500'
                      : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-medium text-slate-200">{archive.setName}</div>
                  <div className="text-xs text-slate-500 mt-1">{archive.setSpec}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTERKNAPPAR */}
        {selectedArchive && (
          <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2 mb-2">
              <Filter size={16} className="text-slate-500" />
              <span className="text-slate-400 text-sm font-medium">Filtrera dokumenttyper</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Alla' },
                { key: 'births', label: 'Födelseböcker' },
                { key: 'weddings', label: 'Vigselböcker' },
                { key: 'deaths', label: 'Dödböcker' },
                { key: 'households', label: 'Husförhörslängder' },
                { key: 'mantalslengd', label: 'Mantalslängder' },
                { key: 'court', label: 'Domböcker' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleFilter(key)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    filters[key]
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
          {isHarvesting && (
            <div className="text-xs text-slate-400">
              Skördar: {harvestProgress.current} / {harvestProgress.total}
            </div>
          )}
          <div className="flex-1" />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isHarvesting}
            >
              Avbryt
            </Button>
            <Button
              variant="primary"
              onClick={handleHarvest}
              disabled={!selectedArchive || isHarvesting}
            >
              {isHarvesting ? `Skördar...` : 'Parsa & Importera'}
            </Button>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

export default OAIArchiveHarvesterModal;
