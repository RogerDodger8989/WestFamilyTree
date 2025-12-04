import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';

// --- HJÄLPFUNKTIONER ---

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

const getGenderColor = (gender) => {
    switch (gender) {
        case 'M': return '#3B82F6'; 
        case 'K': return '#EC4899'; 
        default: return '#9CA3AF';  
    }
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 140;
const NODE_SPACING_X = NODE_WIDTH + 60; 
const NODE_SPACING_Y = NODE_HEIGHT + 80; 

// --- DATATRANSFORMERING (Använder nu DUBBEL HIERARKI) ---
const transformDataForTreeLayout = (allPeople, focusPersonId) => {
    if (!focusPersonId || !allPeople.length || !allPeople.some(p => p.id === focusPersonId)) return { nodes: [], links: [], partnerLinks: [], parentGroupNodes: [], childToParentGroup: {} };
    
    const peopleMap = new Map(allPeople.map(p => [p.id, p]));
    const partnerLinks = [];
    const childrenMap = new Map(); 
    
    allPeople.forEach(p => {
        (p.relations?.parents || []).forEach(parentRel => {
            const parentId = typeof parentRel === 'object' ? parentRel.id : parentRel;
            if (!parentId) return;
            if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
            childrenMap.get(parentId).push(p.id);
        });
    });

    // 1. Bygg den NEDÅTRIKTADE (Barn) hierarkin rekursivt
    const buildChildrenHierarchy = (personId) => {
        const person = peopleMap.get(personId);
        if (!person) return null;

        const node = { id: personId, data: person, children: [] };
        // relations.children: [{id, status}] eller id
        const childIds = (person.relations?.children || []).map(c => typeof c === 'object' ? c.id : c).filter(Boolean);
        node.children = childIds.map(buildChildrenHierarchy).filter(Boolean); 

        if (person.relations?.spouseId && peopleMap.has(person.relations.spouseId)) {
            const existingLink = partnerLinks.some(l => 
                (l.sourceId === personId && l.targetId === person.relations.spouseId) ||
                (l.sourceId === person.relations.spouseId && l.targetId === personId)
            );
            if (!existingLink) { partnerLinks.push({ sourceId: personId, targetId: person.relations.spouseId }); }
        }
        
        return node;
    };
    
    // 2. Bygg den UPPÅTRIKTADE (Föräldrar) hierarkin rekursivt
    const buildParentHierarchy = (personId, visitedSet = new Set()) => {
        if (visitedSet.has(personId)) return null;
        visitedSet.add(personId);

        const person = peopleMap.get(personId);
        if (!person) return null;

        const node = { id: personId, data: person, children: [] };
        
        const nextVisitedSet = new Set(visitedSet);

        if (person.relations?.parents?.length) {
            node.children = person.relations.parents.map(parentRel => {
                const parentId = typeof parentRel === 'object' ? parentRel.id : parentRel;
                return buildParentHierarchy(parentId, nextVisitedSet);
            }).filter(Boolean);
        }
        return node;
    };
    
    const childrenRoot = buildChildrenHierarchy(focusPersonId);
    const parentsRoot = buildParentHierarchy(focusPersonId);
    
    return { childrenRoot, parentsRoot, partnerLinks };
};


// --- UNDERKOMPONENT FÖR NODRENDERING (Oförändrad) ---



// Dynamisk sökväg beroende på Electron/web
function getSilhouettePath(type) {
    // Om Electron: använd relativ sökväg till electron/-mappen
    const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
    if (isElectron) {
        if (type === 'K') return './electron/silhouette_woman.png';
        if (type === 'M') return './electron/silhouette_man.png';
        return './electron/silhouette_unknown.png';
    } else {
        if (type === 'K') return '/silhouettes/silhouette_woman.png';
        if (type === 'M') return '/silhouettes/silhouette_man.png';
        return '/silhouettes/silhouette_unknown.png';
    }
}

const PersonNode = React.memo(({ person, transform, onOpenEditModal, onCreatePersonAndLink, onOpenContextMenu, nodeWidth, nodeHeight }) => {
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeout = useRef(null);

    const color = getGenderColor(person.gender);
    const lifeSpan = getLifeSpan(person);

    const handleEditClick = () => {
        if (onOpenEditModal) onOpenEditModal(person.id);
    };
    
    const handleMouseEnter = () => {
        clearTimeout(hoverTimeout.current);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        hoverTimeout.current = setTimeout(() => {
            setIsHovered(false);
        }, 200);
    };

    const x = transform.x - nodeWidth / 2 || 0;
    const y = transform.y - nodeHeight / 2 || 0;

    // Välj siluettbild beroende på kön och miljö
    const silhouetteImg = getSilhouettePath(person.gender);

    // Om person har en riktig bild, använd den istället (lägg till logik om du har bildfält)
    // const profileImg = person.imageUrl || null;

    return (
        <g
            transform={`translate(${x}, ${y})`}
            className="transition-all duration-300"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* 1. Huvudbox / Bakgrund (Klickbar del) */}
            <rect
                x={0}
                y={0}
                width={nodeWidth}
                height={nodeHeight}
                rx={6}
                fill="#FFFFFF"
                stroke={color}
                strokeWidth={3}
                className="shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                onClick={handleEditClick} 
            />

            {/* 2. Profilbild / Siluett Placeholder */}
            <image
                href={silhouetteImg}
                x={nodeWidth / 2 - 25}
                y={5}
                width={50}
                height={50}
                style={{ borderRadius: '50%' }}
            />

            {/* 3. Textdetaljer */}
            <text x={nodeWidth / 2} y={80} textAnchor="middle" fontSize="12px" fill="#4B5563">
                Ref {person.refNumber}
            </text>
            <text x={nodeWidth / 2} y={98} textAnchor="middle" fontSize="14px" fontWeight="bold" fill="#1F2937">
                {person.firstName} {person.lastName}
            </text>
            <text x={nodeWidth / 2} y={115} textAnchor="middle" fontSize="12px" fill="#6B7280">
                {lifeSpan}
            </text>

            {/* 4. Hover-interaktioner (Skapa Släktingar) */}
            {isHovered && (
                <g className="hover-menu">
                    
                    {/* Lägg till Förälder (UPPÅT) */}
                    <rect
                        x={nodeWidth / 2 - 40} y={-25} width={80} height={25}
                        fill="#34D399" opacity="0.95" rx="5"
                        onClick={(e) => { e.stopPropagation(); onCreatePersonAndLink(person.id, 'parent'); }}
                        className="hover:scale-105 transition-transform cursor-pointer"
                    >
                        <title>Lägg till Förälder</title>
                    </rect>
                    <text x={nodeWidth / 2} y={-9} textAnchor="middle" fontSize="12px" fill="#fff" fontWeight="bold" className="pointer-events-none">FÖRÄLDER +</text>

                    {/* Lägg till Barn (NEDÅT) */}
                    <rect
                        x={nodeWidth / 2 - 40} y={nodeHeight} width={80} height={25}
                        fill="#34D399" opacity="0.95" rx="5"
                        onClick={(e) => { e.stopPropagation(); onCreatePersonAndLink(person.id, 'child'); }}
                        className="hover:scale-105 transition-transform cursor-pointer"
                    >
                        <title>Lägg till Barn</title>
                    </rect>
                    <text x={nodeWidth / 2} y={nodeHeight + 16} textAnchor="middle" fontSize="12px" fill="#fff" fontWeight="bold" className="pointer-events-none">BARN +</text>

                    {/* Lägg till Partner (HÖGER) */}
                    <rect
                        x={nodeWidth + 10} y={nodeHeight / 2 - 12.5} width={80} height={25}
                        fill="#FCD34D" opacity="0.95" rx="5"
                        onClick={(e) => { e.stopPropagation(); onCreatePersonAndLink(person.id, 'spouse'); onOpenEditModal(person.relations?.spouseId);}} 
                        className="hover:scale-105 transition-transform cursor-pointer"
                    >
                        <title>Lägg till Partner</title>
                    </rect>
                    <text x={nodeWidth + 50} y={nodeHeight / 2 + 5} textAnchor="middle" fontSize="12px" fill="#fff" fontWeight="bold" className="pointer-events-none">PARTNER +</text>
                </g>
            )}
        </g>
    );
});


// --- HUVUDKOMPONENT: FamilyTreeView ---
export default function FamilyTreeView({ allPeople, focusPersonId, onSetFocus, onOpenEditModal, onCreatePersonAndLink, onOpenContextMenu, onSave, highlightPlaceholderId, onRequestOpenDuplicateMerge }) {
    const svgRef = useRef(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTransform, setCurrentTransform] = useState(d3.zoomIdentity);
    
    const effectiveFocusId = useMemo(() => {
        if (searchQuery) {
            return allPeople.find(p => (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchQuery.toLowerCase()))?.id;
        }
        return allPeople.some(p => p.id === focusPersonId) ? focusPersonId : null;
    }, [allPeople, focusPersonId, searchQuery]);

    const layoutData = useMemo(() => { 
        if (!effectiveFocusId) {
             return { nodes: [], links: [], partnerLinks: [], parentGroupNodes: [], childToParentGroup: {} };
        }
        
        const { childrenRoot, parentsRoot, partnerLinks } = transformDataForTreeLayout(allPeople, effectiveFocusId);

        let combinedNodes = [];
        let combinedLinks = [];
        const nodesMap = new Map();
        
        // 1. Bearbeta BARN-trädet (Nedåt)
        if (childrenRoot) {
            const hierarchy = d3.hierarchy(childrenRoot, d => d.children);
            const treeData = d3.tree().nodeSize([NODE_SPACING_X, NODE_SPACING_Y])(hierarchy);
            
            treeData.descendants().forEach(d => {
                if (d.data.id && !nodesMap.has(d.data.id)) {
                    combinedNodes.push(d);
                    nodesMap.set(d.data.id, d);
                }
            });
            combinedLinks = combinedLinks.concat(treeData.links());
        }

        // 2. Bearbeta FÖRÄLDRAR-trädet (Uppåt)
        if (parentsRoot) {
            const hierarchy = d3.hierarchy(parentsRoot, d => d.children);
            const treeData = d3.tree().nodeSize([NODE_SPACING_X, NODE_SPACING_Y])(hierarchy);
            
            treeData.descendants().forEach(d => {
                // Invertera Y-axeln för att rita uppåt
                d.y = -d.y;
                
                // Lägg till noden endast om det inte är fokuspersonen
                if (d.data.id !== effectiveFocusId && !nodesMap.has(d.data.id)) {
                    combinedNodes.push(d);
                    nodesMap.set(d.data.id, d);
                }
            });
            
            // Lägg till de inverterade länkarna
            treeData.links().forEach(l => {
                if (l.source.data.id !== l.target.data.id) {
                    combinedLinks.push(l);
                }
            });
        }
        
        // 3. Post-Process (Centrering och Partner-injicering)
        // Bygg processedNodes så att varje person bara förekommer EN gång, oavsett var de hittas
        const processedNodes = [];
        const width = svgRef.current ? svgRef.current.clientWidth : 800;
        const nodeById = new Map();

        // Samla alla personer som ska visas (från combinedNodes)
        combinedNodes.forEach(d => {
            const person = d.data.data;
            if (!person.id) return;
            if (!nodeById.has(person.id)) {
                let currentX = d.x;
                const currentY = d.y;
                currentX -= width / 2;
                nodeById.set(person.id, { id: person.id, x: currentX, y: currentY, data: person });
            }
        });

        // Lägg till partnern EN gång per partnerlänk, om de inte redan finns
        partnerLinks.forEach(link => {
            const sourceNode = nodeById.get(link.sourceId);
            if (!sourceNode) return;
            const partnerId = link.targetId;
            if (!nodeById.has(partnerId)) {
                const partner = allPeople.find(p => p.id === partnerId);
                if (partner) {
                    nodeById.set(partnerId, {
                        id: partnerId,
                        x: sourceNode.x + NODE_SPACING_X,
                        y: sourceNode.y,
                        data: partner
                    });
                }
            }
        });

        // Lägg till alla unika noder i processedNodes
        nodeById.forEach(node => processedNodes.push(node));

        // Slutlig validering av Partnerlänkar
        const validPartnerLinks = partnerLinks.filter(l => 
            processedNodes.some(n => n.id === l.sourceId) && processedNodes.some(n => n.id === l.targetId)
        );

        return { nodes: processedNodes, links: combinedLinks, partnerLinks: validPartnerLinks };

    }, [allPeople, effectiveFocusId]); 


    const { nodes, partnerLinks, links } = layoutData;
    
    // 2. LAYOUT & VISUALISERING (D3 rendering)
    useEffect(() => {
        if (!svgRef.current || nodes.length === 0) {
            d3.select(svgRef.current).select('.node-container').selectAll('*').remove();
            return;
        }

        const svg = d3.select(svgRef.current);
        const container = svg.select('.node-container');
        const width = svgRef.current.clientWidth;
        const height = svgRef.current.clientHeight;
        
        container.selectAll('*').remove(); 
        
        // --- KLASSISK FAMILJETRÄDSKOPPLING: Gemensam bar för barn ---
        // 1. Hitta alla "parent groups" (alla föräldrar som delar barn)
        const parentGroups = [];
        const childToParents = {};
        nodes.forEach(n => {
            const child = n.data;
            if (child.relations?.parents?.length >= 2) {
                const parentIds = child.relations.parents.map(p => typeof p === 'object' ? p.id : p).filter(Boolean);
                childToParents[child.id] = parentIds;
                // Lägg till gruppen om den inte redan finns
                if (!parentGroups.some(g => g.sort().join(',') === parentIds.sort().join(','))) {
                    parentGroups.push(parentIds);
                }
            }
        });

        // 2. Rita föräldrar till bar, bar till barn
        parentGroups.forEach(parentIds => {
            // Hämta parent-noder
            const parentNodes = parentIds.map(pid => nodes.find(n => n.id === pid)).filter(Boolean);
            if (parentNodes.length < 2) return;
            // Barens X mitt emellan föräldrar, Y under föräldrar
            const minX = Math.min(...parentNodes.map(p => p.x + NODE_WIDTH / 2));
            const maxX = Math.max(...parentNodes.map(p => p.x + NODE_WIDTH / 2));
            const barY = parentNodes[0].y + NODE_HEIGHT + 24;
            const barX1 = minX;
            const barX2 = maxX;
            // Rita kurva från varje förälder till barens mittpunkt
            parentNodes.forEach((pNode, idx) => {
                const px = pNode.x + NODE_WIDTH / 2;
                const py = pNode.y + NODE_HEIGHT;
                const mx = (barX1 + barX2) / 2;
                const my = barY;
                container.append('path')
                    .attr('class', 'tree-link')
                    .attr('d', `M${px},${py} C${px},${py + 40} ${mx},${my - 40} ${mx},${my}`)
                    .attr('fill', 'none')
                    .attr('stroke', '#2563eb')
                    .attr('stroke-width', 2.2)
                    .attr('opacity', 0.92);
            });
            // Rita baren
            container.append('rect')
                .attr('x', barX1 - 18)
                .attr('y', barY - 2)
                .attr('width', barX2 - barX1 + 36)
                .attr('height', 4)
                .attr('rx', 2)
                .attr('fill', '#2563eb')
                .attr('opacity', 0.18);
            // Rita vertikala linjer från bar till varje barn
            nodes.forEach(childNode => {
                if (!childToParents[childNode.id]) return;
                // Kontrollera att denna bar gäller för detta barn
                if (childToParents[childNode.id].sort().join(',') !== parentIds.sort().join(',')) return;
                const cx = childNode.x + NODE_WIDTH / 2;
                const cy = childNode.y;
                container.append('path')
                    .attr('class', 'tree-link')
                    .attr('d', `M${cx},${barY + 2} L${cx},${cy}`)
                    .attr('fill', 'none')
                    .attr('stroke', '#2563eb')
                    .attr('stroke-width', 2.2)
                    .attr('opacity', 0.92);
            });
        });

        // 3. Rita övriga länkar (enförälder, övriga relationer)
        container.selectAll('.tree-link')
            .data(links.filter(l => {
                // Hoppa över länkar där båda föräldrar redan är kopplade via bar
                const childId = l.target.data.id;
                if (childToParents[childId] && childToParents[childId].length >= 2) return false;
                return l.source.data.id && l.target.data.id;
            }))
            .join('path')
            .attr('class', 'tree-link')
            .attr('d', d => {
                const sourceNode = nodes.find(n => n.id === d.source.data.id);
                const targetNode = nodes.find(n => n.id === d.target.data.id);
                if (!sourceNode || !targetNode) return '';
                const sX = sourceNode.x + NODE_WIDTH / 2;
                const sY = sourceNode.y + NODE_HEIGHT;
                const tX = targetNode.x + NODE_WIDTH / 2;
                const tY = targetNode.y;
                const midY = sY + (tY - sY) / 2;
                return `M${sX},${sY}C${sX},${midY},${tX},${midY},${tX},${tY}`;
            })
            .attr('fill', 'none')
            .attr('stroke', '#6B7280')
            .attr('stroke-width', 1.5);
            
        // Rita Partner-länkar (Manuell rendering)
        container.selectAll('.partner-link')
            .data(partnerLinks)
            .join('line')
            .attr('class', 'partner-link')
            .attr('x1', d => nodes.find(n => n.id === d.sourceId)?.x + NODE_WIDTH)
            .attr('y1', d => nodes.find(n => n.id === d.sourceId)?.y + NODE_HEIGHT / 2)
            .attr('x2', d => nodes.find(n => n.id === d.targetId)?.x)
            .attr('y2', d => nodes.find(n => n.id === d.targetId)?.y + NODE_HEIGHT / 2)
            .attr('stroke', '#9CA3AF')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5'); 

        // --- HANTERA ZOOM OCH PANORERING ---
        const zoomBehavior = d3.zoom()
            .scaleExtent([0.1, 4]) 
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
                setCurrentTransform(event.transform); 
            });

        svg.call(zoomBehavior);

        // Centrera på fokuspersonen vid första rendering
        const focusNode = nodes.find(n => n.id === effectiveFocusId);
        if (focusNode) {
            const initialTransform = d3.zoomIdentity
                .translate(width / 2 - focusNode.x - NODE_WIDTH / 2, height / 2 - focusNode.y - NODE_HEIGHT / 2);
            svg.call(zoomBehavior.transform, initialTransform);
        }

    }, [layoutData, effectiveFocusId]); 


    // Visa meddelande om tomt träd
    if (nodes.length === 0) {
        return (
            <div className="flex flex-col h-full w-full items-center justify-center bg-slate-800">
                {/* Sökruta (Måste vara utanför SVG för att vara interaktiv) */}
                <div className="p-2 border-b bg-slate-800 flex gap-4 shrink-0 absolute top-0 w-full justify-start">
                    <input 
                        type="text" 
                        placeholder="Sök person i träd..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1 border rounded shadow-sm text-sm w-64"
                    />
                    <button 
                        onClick={() => onSetFocus(null)} 
                        className="px-3 py-1 bg-slate-700 rounded text-sm text-slate-200 hover:bg-slate-600"
                    >
                        Återställ fokus
                    </button>
                </div>
                
                <div className="mt-10 text-slate-400">
                    {focusPersonId ? "Personen har valts, men det finns inga relationer att rita." : "Välj en person att fokusera på i personregistret, eller sök ovan."}
                </div>
            </div>
        );
    }
    
    // Huvudrendering (om träd finns)
    return (
        <div className="flex flex-col h-full w-full">
            {/* Sökruta och Kontrollpanel */}
            <div className="p-2 border-b border-slate-700 bg-slate-900 flex gap-4 shrink-0">
                <input 
                    type="text" 
                    placeholder="Sök person i träd..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-1 border border-slate-600 rounded shadow-sm text-sm w-64 bg-slate-800 text-slate-200 focus:border-blue-500 focus:outline-none"
                />
                <button 
                    onClick={() => onSetFocus(null)} 
                    className="px-3 py-1 bg-slate-700 rounded text-sm hover:bg-slate-600 text-slate-200 font-medium"
                >
                    Återställ fokus
                </button>
                {searchQuery && (
                    <span className="text-sm text-slate-400">Visar träd med fokus på sökresultat.</span>
                )}
            </div>

            {/* SVG-VISNINGSYTA */}
            <svg ref={svgRef} className="flex-1 w-full h-full bg-slate-800 min-h-0" data-family-tree="1">
                {/* 1. Länkar och D3-hanterade element (Flyttas av D3's zoom) */}
                <g className="node-container" />
                
                {/* 2. React-renderade noder (Flyttas av D3's zoom/pan) */}
                <g className="react-nodes" transform={currentTransform}>
                    {nodes.map(node => (
                        <PersonNode
                            key={node.id}
                            person={node.data}
                            transform={{ x: node.x, y: node.y }} 
                            onOpenEditModal={onOpenEditModal}
                            onCreatePersonAndLink={onCreatePersonAndLink}
                            nodeWidth={NODE_WIDTH}
                            nodeHeight={NODE_HEIGHT}
                            onOpenContextMenu={onOpenContextMenu}
                        />
                    ))}

                    {/* Dropdown-rutor för relationsstatus är borttagna enligt önskemål */}
                </g>
            </svg>
            </div>
                );
            }