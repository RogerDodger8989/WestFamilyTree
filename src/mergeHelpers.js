// Helper functions for performing merge operations. These are small, pure
// utilities so they can be unit tested independently of React context.

export function remapAndDedupeRelations(relations = [], targetId, sourceIds = [], currentUser = 'system') {
    const filtered = sourceIds.filter(id => id && id !== targetId);
    const remapped = (relations || []).map(r => {
        const nr = { ...r };
        if (filtered.includes(nr.fromPersonId)) nr.fromPersonId = targetId;
        if (filtered.includes(nr.toPersonId)) nr.toPersonId = targetId;
        if (nr.fromPersonId === nr.toPersonId) {
            nr._archived = true;
            nr.modifiedAt = new Date().toISOString();
            nr.modifiedBy = currentUser;
        }
        return nr;
    });

    const seen = new Set();
    const deduped = [];
    for (const r of remapped) {
        if (r._archived) { deduped.push(r); continue; }
        const key = `${(r.type||'').toString().toLowerCase()}::${r.fromPersonId}::${r.toPersonId}`;
        if (seen.has(key)) {
            deduped.push({ ...r, _archived: true, modifiedAt: new Date().toISOString(), modifiedBy: currentUser });
        } else {
            seen.add(key);
            deduped.push(r);
        }
    }

    return deduped;
}

export function transferEventsAndLinks(people = [], targetId, sourceIds = []) {
    if (!Array.isArray(people) || !targetId) return people;
    const filtered = sourceIds.filter(id => id && id !== targetId);
    const peopleCopy = people.map(p => ({ ...p, events: Array.isArray(p.events) ? p.events.map(ev => ({ ...ev })) : [], links: p.links ? { ...p.links } : {} }));
    const tgtIndex = peopleCopy.findIndex(p => p.id === targetId);
    if (tgtIndex === -1) return peopleCopy;
    const targetPerson = peopleCopy[tgtIndex];

    for (const sid of filtered) {
        const sIndex = peopleCopy.findIndex(p => p.id === sid);
        if (sIndex === -1) continue;
        const src = peopleCopy[sIndex];
        if (Array.isArray(src.events) && src.events.length > 0) {
            targetPerson.events = targetPerson.events || [];
            for (const ev of src.events) {
                const newEv = { ...ev };
                if (!newEv.id) newEv.id = `e_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                while (targetPerson.events.find(e => e.id === newEv.id)) {
                    newEv.id = `e_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
                }
                targetPerson.events.push(newEv);
            }
        }
        targetPerson.links = targetPerson.links || {};
        if (src.links) {
            for (const k of Object.keys(src.links)) {
                if (!targetPerson.links[k]) targetPerson.links[k] = src.links[k];
            }
        }
    }

    // Archive source persons (soft-delete) by setting _archived and archiveReason
    const newPeople = peopleCopy.map(p => filtered.includes(p.id) ? { ...p, _archived: true, archiveReason: `Merged into ${targetId}` } : p);
    return newPeople;
}
