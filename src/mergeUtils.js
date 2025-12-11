// Utility to simulate and perform merge-related computations so UI and
// merge logic share the same rules (remap endpoints, archive self-relations,
// deduplicate by type+from+to).

export function simulateMerge(dbData, targetId, sourceIds = []) {
    if (!dbData || !targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) return null;
    const filtered = sourceIds.filter(id => id && id !== targetId);
    if (filtered.length === 0) return null;

    const people = dbData.people || [];

    // Event previews per source
    const previews = filtered.map(sid => {
        const src = people.find(p => p.id === sid) || { id: sid };
        const eventsCount = (src.events || []).length;
        return { id: sid, name: `${src.firstName || ''} ${src.lastName || ''}`.trim(), eventsCount, raw: src };
    });
    const totalEvents = previews.reduce((s, p) => s + p.eventsCount, 0);

    // Relation simulation
    const activeRels = (dbData.relations || []).slice();
    const seen = new Set();
    const kept = [];
    const archived = [];

    for (const r of activeRels) {
        if (!r || r._archived) continue;
        const nr = { ...r };
        if (filtered.includes(nr.fromPersonId)) nr.fromPersonId = targetId;
        if (filtered.includes(nr.toPersonId)) nr.toPersonId = targetId;
        if (nr.fromPersonId === nr.toPersonId) {
            archived.push({ original: r, reason: 'self-relation after remap', remapped: nr });
            continue;
        }
        const key = `${(nr.type||'').toString().toLowerCase()}::${nr.fromPersonId}::${nr.toPersonId}`;
        if (seen.has(key)) {
            archived.push({ original: r, reason: 'duplicate after remap', remapped: nr });
        } else {
            seen.add(key);
            kept.push({ original: r, remapped: nr });
        }
    }

    const resolveName = (id) => {
        const p = people.find(x => x.id === id);
        return p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : id;
    };

    const keptList = kept.map(entry => ({ id: entry.original.id, type: entry.original.type, fromId: entry.remapped.fromPersonId, toId: entry.remapped.toPersonId, from: resolveName(entry.remapped.fromPersonId), to: resolveName(entry.remapped.toPersonId), sources: entry.original.sourceIds || [], note: entry.original.note || '' }));
    const archivedList = archived.map(entry => ({ id: entry.original.id, type: entry.original.type, fromId: entry.remapped.fromPersonId, toId: entry.remapped.toPersonId, from: resolveName(entry.remapped.fromPersonId), to: resolveName(entry.remapped.toPersonId), reason: entry.reason, sources: entry.original.sourceIds || [], note: entry.original.note || '' }));

    return { previews, totalEvents, keptList, archivedList, remappedRelations: kept.map(k => k.remapped), archivedRelations: archived.map(a => a.remapped) };
}
