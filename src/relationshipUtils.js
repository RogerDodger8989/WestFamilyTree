/**
 * Finds a person object from an ID.
 * @param {string} id The person's ID.
 * @param {Array<object>} allPeople The list of all people.
 * @returns {object|null} The person object or null.
 */
function findPerson(id, allPeople) {
    return allPeople.find(p => p.id === id) || null;
}

function relationEntryToId(entry) {
    if (!entry) return null;
    if (typeof entry === 'string' || typeof entry === 'number') return String(entry);
    return String(
        entry.id
        || entry.personId
        || entry.parentId
        || entry.childId
        || entry.fromPersonId
        || entry.toPersonId
        || ''
    ) || null;
}

function getEmbeddedParentIds(person) {
    const parents = Array.isArray(person?.relations?.parents) ? person.relations.parents : [];
    return Array.from(new Set(parents.map(relationEntryToId).filter(Boolean)));
}

function getEmbeddedChildIds(person) {
    const children = Array.isArray(person?.relations?.children) ? person.relations.children : [];
    return Array.from(new Set(children.map(relationEntryToId).filter(Boolean)));
}

/**
 * Calculates the relationship between two people.
 * @param {string} personAId The ID of the first person.
 * @param {string} personBId The ID of the second person.
 * @param {Array<object>} allPeople The list of all people.
 * @returns {string} A string describing the relationship.
 */
export function calculateRelationship(personAId, personBId, allPeople, getPersonRelations) {
    if (!personAId || !personBId || personAId === personBId) {
        return "Välj två olika personer.";
    }

    const personA = findPerson(personAId, allPeople);
    const personB = findPerson(personBId, allPeople);

    if (!personA || !personB) {
        return "Personer kunde inte hittas.";
    }

    // 1. Check for Spouse relationship (via Vigsel event)
    const isSpouseA = personA.events?.some(e => e.type === 'Vigsel' && e.partnerId === personBId);
    const isSpouseB = personB.events?.some(e => e.type === 'Vigsel' && e.partnerId === personAId);
    if (isSpouseA || isSpouseB) {
        return "Make / Maka";
    }

    // 2. Check for Parent/Child relationship using relation objects (if provided)
    const getParentsFor = (pid) => {
        const p = findPerson(pid, allPeople);
        const embedded = getEmbeddedParentIds(p);

        if (typeof getPersonRelations === 'function') {
            const rels = getPersonRelations(pid) || [];
            const fromRelations = rels.flatMap(r => {
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent') {
                    if (r.toPersonId === pid) return [r.fromPersonId];
                    if (r.fromPersonId === pid) return [r.toPersonId];
                } else if (t === 'child') {
                    if (r.fromPersonId === pid) return [r.toPersonId];
                    if (r.toPersonId === pid) return [r.fromPersonId];
                }
                return [];
            }).filter(Boolean);
            return Array.from(new Set([...fromRelations, ...embedded]));
        }
        return embedded;
    };
    const getChildrenFor = (pid) => {
        const p = findPerson(pid, allPeople);
        const embedded = getEmbeddedChildIds(p);

        if (typeof getPersonRelations === 'function') {
            const rels = getPersonRelations(pid) || [];
            const fromRelations = rels.flatMap(r => {
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent') {
                    if (r.fromPersonId === pid) return [r.toPersonId];
                    if (r.toPersonId === pid) return [r.fromPersonId];
                } else if (t === 'child') {
                    if (r.toPersonId === pid) return [r.fromPersonId];
                    if (r.fromPersonId === pid) return [r.toPersonId];
                }
                return [];
            }).filter(Boolean);
            return Array.from(new Set([...fromRelations, ...embedded]));
        }
        return embedded;
    };

    const parentsA = getParentsFor(personAId);
    const parentsB = getParentsFor(personBId);
    const childrenA = getChildrenFor(personAId);
    const childrenB = getChildrenFor(personBId);

    if (childrenA.includes(personBId)) {
        return `${personA.gender === 'K' ? 'Mor' : 'Far'} och ${personB.gender === 'K' ? 'dotter' : 'son'}`;
    }
    if (childrenB.includes(personAId)) {
        return `${personB.gender === 'K' ? 'Mor' : 'Far'} och ${personA.gender === 'K' ? 'dotter' : 'son'}`;
    }
    if (parentsA.includes(personBId)) {
        return `${personB.gender === 'K' ? 'Mor' : 'Far'} och ${personA.gender === 'K' ? 'dotter' : 'son'}`;
    }

    // 3. Check for Sibling relationship (common parents)
    // 3. Check for Sibling relationship (common parents)
    if (parentsA.length > 0 && parentsB.length > 0) {
        const commonParents = parentsA.filter(pId => parentsB.includes(pId));
        if (commonParents.length > 0) return "Syskon";
    }

    return "Okänd relation";
}


/**
 * Finds the shortest path between two people in the family tree using a bidirectional search.
 * @param {string} startPersonId The ID of the person you are on.
 * @param {string} endPersonId The ID of the target person.
 * @param {Array<object>} allPeople The list of all people.
 * @returns {Array<object>|null} An array of person objects in the path, or null.
 */
export function getAncestryPath(startPersonId, endPersonId, allPeople, getPersonRelations) {
    if (!startPersonId || !endPersonId || startPersonId === endPersonId) return null;

    // Köer för vår dubbelriktade sökning. Varje element är en sökväg [id1, id2, ...].
    let queueA = [[startPersonId]];
    let queueB = [[endPersonId]];

    // Håller koll på besökta noder och vägen dit.
    let visitedA = { [startPersonId]: [startPersonId] };
    let visitedB = { [endPersonId]: [endPersonId] };

    // Vi söker i max 15 nivåer för att undvika oändliga loopar i komplexa träd.
    for (let i = 0; i < 15; i++) {
        // Sök ett steg från startpersonen
        const pathA = queueA.shift();
        if (!pathA) break; // Kön är tom
        const personAId = pathA[pathA.length - 1];
        const personA = findPerson(personAId, allPeople);

        // Grannar är både föräldrar och barn (deriverade från relation objects om möjligt)
        const embeddedParentsA = getEmbeddedParentIds(personA);
        const embeddedChildrenA = getEmbeddedChildIds(personA);
        const relationParentsA = typeof getPersonRelations === 'function' ? (getPersonRelations(personAId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.toPersonId === personAId ? [r.fromPersonId] : (r.fromPersonId === personAId ? [r.toPersonId] : []);
            if (t === 'child') return r.fromPersonId === personAId ? [r.toPersonId] : (r.toPersonId === personAId ? [r.fromPersonId] : []);
            return [];
        }).filter(Boolean) : [];
        const relationChildrenA = typeof getPersonRelations === 'function' ? (getPersonRelations(personAId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.fromPersonId === personAId ? [r.toPersonId] : (r.toPersonId === personAId ? [r.fromPersonId] : []);
            if (t === 'child') return r.toPersonId === personAId ? [r.fromPersonId] : (r.fromPersonId === personAId ? [r.toPersonId] : []);
            return [];
        }).filter(Boolean) : [];
        const parentsA = Array.from(new Set([...relationParentsA, ...embeddedParentsA]));
        const childrenA = Array.from(new Set([...relationChildrenA, ...embeddedChildrenA]));
        const relativesA = Array.from(new Set([...(parentsA || []), ...(childrenA || [])]));
        for (const relativeId of relativesA) {
            if (visitedB[relativeId]) {
                // Vi har mötts! Kombinera vägarna.
                const pathFromB = visitedB[relativeId].slice().reverse(); // Vänd på B-vägen
                const fullPath = [...pathA, ...pathFromB]; // Kombinera A-vägen med den omvända B-vägen
                return fullPath.map(id => findPerson(id, allPeople));
            }
            if (!visitedA[relativeId]) {
                const newPath = [...pathA, relativeId];
                visitedA[relativeId] = newPath;
                queueA.push(newPath);
            }
        }

        // Sök ett steg från slutpersonen
        const pathB = queueB.shift();
        if (!pathB) break; // Kön är tom
        const personBId = pathB[pathB.length - 1];
        const personB = findPerson(personBId, allPeople);
        const embeddedParentsB = getEmbeddedParentIds(personB);
        const embeddedChildrenB = getEmbeddedChildIds(personB);
        const relationParentsB = typeof getPersonRelations === 'function' ? (getPersonRelations(personBId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.toPersonId === personBId ? [r.fromPersonId] : (r.fromPersonId === personBId ? [r.toPersonId] : []);
            if (t === 'child') return r.fromPersonId === personBId ? [r.toPersonId] : (r.toPersonId === personBId ? [r.fromPersonId] : []);
            return [];
        }).filter(Boolean) : [];
        const relationChildrenB = typeof getPersonRelations === 'function' ? (getPersonRelations(personBId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.fromPersonId === personBId ? [r.toPersonId] : (r.toPersonId === personBId ? [r.fromPersonId] : []);
            if (t === 'child') return r.toPersonId === personBId ? [r.fromPersonId] : (r.fromPersonId === personBId ? [r.toPersonId] : []);
            return [];
        }).filter(Boolean) : [];
        const parentsB = Array.from(new Set([...relationParentsB, ...embeddedParentsB]));
        const childrenB = Array.from(new Set([...relationChildrenB, ...embeddedChildrenB]));
        const relativesB = Array.from(new Set([...(parentsB || []), ...(childrenB || [])]));
        for (const relativeId of relativesB) {
            if (visitedA[relativeId]) {
                // Vi har mötts! Kombinera vägarna.
                const pathFromA = visitedA[relativeId];
                const fullPath = [...pathFromA.slice(0, -1), ...pathB.slice().reverse()]; // Kombinera, men undvik dubblett av mötespunkten
                return fullPath.map(id => findPerson(id, allPeople));
            }
            if (!visitedB[relativeId]) {
                const newPath = [...pathB, relativeId];
                visitedB[relativeId] = newPath;
                queueB.push(newPath);
            }
        }
    }

    return null; // Ingen väg hittades
}

/**
 * Hittar den senast gemensamma anan (LCA) och räknar ut exakt släktskap.
 */
export function calculateAdvancedRelationship(personAId, personBId, allPeople, getPersonRelations) {
    if (!personAId || !personBId || personAId === personBId) {
        return { type: 'none', text: 'Välj två olika personer', lca: null };
    }

    const personA = findPerson(personAId, allPeople);
    const personB = findPerson(personBId, allPeople);
    if (!personA || !personB) return { type: 'none', text: 'Personer kunde inte hittas', lca: null };

    const isSpouseA = personA.events?.some(e => e.type === 'Vigsel' && e.partnerId === personBId);
    const isSpouseB = personB.events?.some(e => e.type === 'Vigsel' && e.partnerId === personAId);
    if (isSpouseA || isSpouseB) {
        return { type: 'spouse', text: 'Makar / Partners', lca: null, lcaCount: 0 };
    }

    const getParents = (id) => {
        const p = findPerson(id, allPeople);
        if (!p) return [];
        const embedded = getEmbeddedParentIds(p);
        if (typeof getPersonRelations === 'function') {
            const rels = getPersonRelations(id) || [];
            const fromRelations = rels.flatMap(r => {
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent') return r.toPersonId === id ? [r.fromPersonId] : (r.fromPersonId === id ? [r.toPersonId] : []);
                if (t === 'child') return r.fromPersonId === id ? [r.toPersonId] : (r.toPersonId === id ? [r.fromPersonId] : []);
                return [];
            }).filter(Boolean);
            return Array.from(new Set([...fromRelations, ...embedded]));
        }
        return embedded;
    };

    const getAncestorsWithDepth = (startId) => {
        const ancestors = new Map();
        const queue = [{ id: startId, depth: 0 }];
        ancestors.set(startId, 0);

        while (queue.length > 0) {
            const { id, depth } = queue.shift();
            const parents = getParents(id);

            for (const pid of parents) {
                if (!ancestors.has(pid)) {
                    ancestors.set(pid, depth + 1);
                    queue.push({ id: pid, depth: depth + 1 });
                }
            }
        }
        return ancestors;
    };

    const ancestorsA = getAncestorsWithDepth(personAId);
    const ancestorsB = getAncestorsWithDepth(personBId);

    let minDistance = Infinity;
    let lcas = [];

    for (const [id, dA] of ancestorsA.entries()) {
        if (ancestorsB.has(id)) {
            const dB = ancestorsB.get(id);
            const dist = dA + dB;
            if (dist < minDistance) {
                minDistance = dist;
                lcas = [{ id, dA, dB }];
            } else if (dist === minDistance) {
                lcas.push({ id, dA, dB });
            }
        }
    }

    if (lcas.length === 0) return { type: 'none', text: 'Inga gemensamma blodsband hittades', lca: null, lcaCount: 0 };

    const bestLCANode = lcas[0];
    const lcaPerson = findPerson(bestLCANode.id, allPeople);
    const depthA = bestLCANode.dA;
    const depthB = bestLCANode.dB;
    const isHalf = lcas.length === 1 && depthA > 0 && depthB > 0;

    let text = '';
    if (depthA === 0 && depthB === 0) text = 'Samma person';
    else if (depthA > 0 && depthB === 0) text = depthA === 1 ? 'Barn' : depthA === 2 ? 'Barnbarn' : depthA === 3 ? 'Barnbarns barn' : `Ättling i ${depthA}:e led`;
    else if (depthA === 0 && depthB > 0) text = depthB === 1 ? 'Förälder' : depthB === 2 ? 'Far-/Morförälder' : depthB === 3 ? 'Gammelfar-/morförälder' : `Ana i ${depthB}:e led`;
    else if (depthA === 1 && depthB === 1) text = isHalf ? 'Halvsyskon' : 'Syskon';
    else if (depthA === 2 && depthB === 1) text = isHalf ? 'Halvsyskonbarn (Bror-/Systerson eller -dotter)' : 'Syskonbarn (Bror-/Systerson eller -dotter)';
    else if (depthA === 1 && depthB === 2) text = isHalf ? 'Halvfaster/moster/farbror/morbror' : 'Faster / Moster / Farbror / Morbror';
    else if (depthA === 2 && depthB === 2) text = isHalf ? 'Halvkusiner' : 'Kusiner';
    else if (depthA === 3 && depthB === 2) text = isHalf ? 'Halvkusinbarn' : 'Kusinbarn';
    else if (depthA === 2 && depthB === 3) text = isHalf ? 'Förälders halvkusin' : 'Förälders kusin';
    else if (depthA === 3 && depthB === 3) text = isHalf ? 'Halvsysslingar (Nästkusiner)' : 'Sysslingar (Nästkusiner)';
    else if (depthA === 4 && depthB === 3) text = isHalf ? 'Halvsysslingbarn' : 'Sysslingbarn';
    else if (depthA === 3 && depthB === 4) text = isHalf ? 'Förälders halvsyssling' : 'Förälders syssling';
    else if (depthA === 4 && depthB === 4) text = isHalf ? 'Halvbryllingar (Tredjekusiner)' : 'Bryllingar (Tredjekusiner)';
    else if (depthA === 5 && depthB === 4) text = isHalf ? 'Halvbryllingbarn' : 'Bryllingbarn';
    else if (depthA === 4 && depthB === 5) text = isHalf ? 'Förälders halvbrylling' : 'Förälders brylling';
    else if (depthA === 5 && depthB === 5) text = isHalf ? 'Halvpysslingar (Fjärdekusiner)' : 'Pysslingar (Fjärdekusiner)';
    else if (depthA === 6 && depthB === 6) text = isHalf ? 'Halvtrasslingar (Femtekusiner)' : 'Trasslingar (Femtekusiner)';
    else if (depthA === depthB) text = `${isHalf ? 'Halv' : ''}${depthA - 1}-männingar`;
    else {
        const min = Math.min(depthA, depthB);
        const diff = Math.abs(depthA - depthB);
        const baseType = min === 2 ? 'Kusin' : min === 3 ? 'Syssling' : min === 4 ? 'Brylling' : min === 5 ? 'Pyssling' : `${min - 1}-männing`;
        const prefix = isHalf ? 'Halv' : '';
        const formattedBase = prefix ? prefix + baseType.toLowerCase() : baseType;

        if (depthA > depthB) {
            text = `${formattedBase.charAt(0).toUpperCase() + formattedBase.slice(1)}barn${diff > 1 ? 'barn'.repeat(diff - 1) : ''}`;
        } else if (min === 1) {
            text = `Gammel${'gammel'.repeat(Math.max(0, diff - 2))}faster/moster/farbror/morbror${isHalf ? ' (halv)' : ''}`;
        } else {
            text = `Förälders ${diff > 1 ? 'far-/morförälders '.repeat(diff - 1) : ''}${formattedBase.toLowerCase()}`;
        }
    }

    return { type: 'blood', text, lca: lcaPerson, depthA, depthB, lcaCount: lcas.length };
}