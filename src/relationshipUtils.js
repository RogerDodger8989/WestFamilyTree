/**
 * Finds a person object from an ID.
 * @param {string} id The person's ID.
 * @param {Array<object>} allPeople The list of all people.
 * @returns {object|null} The person object or null.
 */
function findPerson(id, allPeople) {
    return allPeople.find(p => p.id === id) || null;
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
        if (typeof getPersonRelations === 'function') {
            const rels = getPersonRelations(pid) || [];
            return Array.from(new Set(rels.flatMap(r => {
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent') {
                    if (r.toPersonId === pid) return [r.fromPersonId];
                    if (r.fromPersonId === pid) return [r.toPersonId];
                } else if (t === 'child') {
                    if (r.fromPersonId === pid) return [r.toPersonId];
                    if (r.toPersonId === pid) return [r.fromPersonId];
                }
                return [];
            })).filter(Boolean));
        }
        return personA.relations?.parents || [];
    };
    const getChildrenFor = (pid) => {
        if (typeof getPersonRelations === 'function') {
            const rels = getPersonRelations(pid) || [];
            return Array.from(new Set(rels.flatMap(r => {
                const t = (r.type || '').toString().toLowerCase();
                if (t === 'parent') {
                    if (r.fromPersonId === pid) return [r.toPersonId];
                    if (r.toPersonId === pid) return [r.fromPersonId];
                } else if (t === 'child') {
                    if (r.toPersonId === pid) return [r.fromPersonId];
                    if (r.fromPersonId === pid) return [r.toPersonId];
                }
                return [];
            })).filter(Boolean));
        }
        return personA.relations?.children || [];
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
        const parentsA = typeof getPersonRelations === 'function' ? (getPersonRelations(personAId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.toPersonId === personAId ? [r.fromPersonId] : (r.fromPersonId === personAId ? [r.toPersonId] : []);
            if (t === 'child') return r.fromPersonId === personAId ? [r.toPersonId] : (r.toPersonId === personAId ? [r.fromPersonId] : []);
            return [];
        }).filter(Boolean) : (personA?.relations?.parents || []);
        const childrenA = typeof getPersonRelations === 'function' ? (getPersonRelations(personAId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.fromPersonId === personAId ? [r.toPersonId] : (r.toPersonId === personAId ? [r.fromPersonId] : []);
            if (t === 'child') return r.toPersonId === personAId ? [r.fromPersonId] : (r.fromPersonId === personAId ? [r.toPersonId] : []);
            return [];
        }).filter(Boolean) : (personA?.relations?.children || []);
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
        const parentsB = typeof getPersonRelations === 'function' ? (getPersonRelations(personBId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.toPersonId === personBId ? [r.fromPersonId] : (r.fromPersonId === personBId ? [r.toPersonId] : []);
            if (t === 'child') return r.fromPersonId === personBId ? [r.toPersonId] : (r.toPersonId === personBId ? [r.fromPersonId] : []);
            return [];
        }).filter(Boolean) : (personB?.relations?.parents || []);
        const childrenB = typeof getPersonRelations === 'function' ? (getPersonRelations(personBId) || []).flatMap(r => {
            const t = (r.type || '').toString().toLowerCase();
            if (t === 'parent') return r.fromPersonId === personBId ? [r.toPersonId] : (r.toPersonId === personBId ? [r.fromPersonId] : []);
            if (t === 'child') return r.toPersonId === personBId ? [r.fromPersonId] : (r.fromPersonId === personBId ? [r.toPersonId] : []);
            return [];
        }).filter(Boolean) : (personB?.relations?.children || []);
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