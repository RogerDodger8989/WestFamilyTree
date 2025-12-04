import React from 'react';

// Hjälpfunktion: Bygg en läsbar titel av källan (för fallback)
const buildSourceString = (source) => {
  if (!source) return '';
  const parts = [
    source.title,   
    source.archive, 
    source.volume,  
    source.page,    
    source.aid      
  ];
  return parts.filter(Boolean).join(', ');
};

// NY HJÄLPFUNKTION: Konverterar HTML till vanlig text med radbrytningar för Tooltip
const formatTooltip = (htmlText) => {
    if (!htmlText) return "";
    // 1. Byt ut <br>, <br/>, <br /> mot en riktig ny rad (\n)
    let formatted = htmlText.replace(/<br\s*\/?>/gi, '\n');
    // 2. Byt ut <hr> mot en rad med streck
    formatted = formatted.replace(/<hr\s*\/?>/gi, '\n----------------\n');
    // 3. Ta bort alla andra HTML-taggar (t.ex. <b>, <i>) så det blir ren text
    formatted = formatted.replace(/<[^>]+>/g, '');
    return formatted.trim();
};

function SourceManager({ event, allSources, onLinkSource, onUnlinkSource, onToggleDrawer, onNavigateToSource }) {

    const getSourceDetails = (id) => {
        const src = allSources.find(s => s.id === id);
        if (!src) return { title: id, archive: '', volume: '', aid: '' };
        return src;
    };

    const handleOpenAid = (e, aid) => {
        e.stopPropagation(); 
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(`https://app.arkivdigital.se/aid/${aid}`);
        } else {
            window.open(`https://app.arkivdigital.se/aid/${aid}`, '_blank');
        }
    };

    return (
        <div className="source-manager mt-2">
            <div className="flex flex-wrap items-center gap-2">
                
                <span className="text-xs font-bold text-slate-400 uppercase mr-1">Källor:</span>

                {(event.sources || []).map((sourceEntry, index) => {
                    // Hantera både objekt och strängar
                    const sourceId = typeof sourceEntry === 'object' ? sourceEntry.sourceId : sourceEntry;
                    const citationNote = typeof sourceEntry === 'object' ? sourceEntry.note : "";
                    const citationPage = typeof sourceEntry === 'object' ? sourceEntry.page : "";

                    const source = getSourceDetails(sourceId);
                    
                    // Visa Titel eller Arkiv+Volym
                    const displayText = source.title || `${source.archive} ${source.volume}`.trim() || 'Namnlös källa';

                    // --- HÄR ÄR FIXEN FÖR TOOLTIP ---
                    // Vi bygger en text som fungerar i webbläsarens "title"-attribut
                    let tooltipParts = [];
                    if (citationPage) tooltipParts.push(`Sida/Ref: ${citationPage}`);
                    if (citationNote) tooltipParts.push(`Notering:\n${formatTooltip(citationNote)}`); // <-- Konverterar <br> till \n
                    if (!citationPage && !citationNote) tooltipParts.push(buildSourceString(source));
                    
                    const tooltipText = tooltipParts.join('\n\n');

                    return (
                        <div 
                            key={`${sourceId}-${index}`} 
                            className="group flex items-center bg-blue-50 border border-blue-200 rounded-full pl-3 pr-1 py-1 text-xs text-blue-900 transition-colors hover:bg-blue-100 hover:border-blue-300"
                            title={tooltipText} // Nu visas radbrytningarna korrekt!
                        >
                            {/* Källans namn */}
                            <span 
                                className="cursor-pointer font-medium truncate max-w-[200px] mr-1"
                                onClick={() => {
                                    if (onNavigateToSource) onNavigateToSource(sourceId);
                                }}
                            >
                                {displayText}
                            </span>

                            {/* Visa sidhänvisning (PAGE) direkt i pillret om det finns plats, annars bara i tooltip */}
                            {citationPage && (
                                <span className="text-slate-400 mr-1 border-l border-slate-600 pl-1">
                                    {citationPage}
                                </span>
                            )}

                            {/* AID-länk */}
                            {source.aid && (
                                <span 
                                    onClick={(e) => handleOpenAid(e, source.aid)}
                                    className="mx-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-mono"
                                    title={`Öppna AID: ${source.aid}`}
                                >
                                    (AID)
                                </span>
                            )}

                            {/* Ta bort-knapp */}
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onUnlinkSource(sourceId); 
                                }}
                                className="flex items-center justify-center w-5 h-5 ml-1 bg-slate-700 text-red-400 rounded-full hover:bg-red-600 hover:text-white border border-red-700 transition-colors"
                                title="Ta bort koppling"
                            >
                                ×
                            </button>
                        </div>
                    );
                })}

                <button 
                    onClick={onToggleDrawer}
                    className="text-xs text-blue-400 hover:text-blue-300 bg-slate-700 border border-dashed border-blue-600 rounded-full px-3 py-1 hover:bg-slate-600 hover:border-blue-500 transition-colors"
                >
                    + Lägg till källa
                </button>
            </div>
        </div>
    );
}

export default SourceManager;