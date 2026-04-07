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
                
                <span className="text-xs font-bold text-muted uppercase mr-1">Källor:</span>

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
                            className="group flex items-center bg-accent-soft border border-strong rounded-full pl-3 pr-1 py-1 text-xs text-accent transition-colors hover:bg-accent-soft/80 hover:border-strong"
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
                                <span className="text-muted mr-1 border-l border-subtle pl-1">
                                    {citationPage}
                                </span>
                            )}

                            {/* AID-länk */}
                            {source.aid && (
                                <span 
                                    onClick={(e) => handleOpenAid(e, source.aid)}
                                    className="mx-1 text-accent hover:text-primary hover:underline cursor-pointer font-mono"
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
                                className="flex items-center justify-center w-5 h-5 ml-1 bg-surface-2 text-warning rounded-full hover:bg-warning-soft hover:text-warning border border-strong transition-colors"
                                title="Ta bort koppling"
                            >
                                ×
                            </button>
                        </div>
                    );
                })}

                <button 
                    onClick={onToggleDrawer}
                    className="text-xs text-accent hover:text-accent bg-surface-2 border border-dashed border-strong rounded-full px-3 py-1 hover:bg-surface hover:border-strong transition-colors"
                >
                    + Lägg till källa
                </button>
            </div>
        </div>
    );
}

export default SourceManager;