// syncRelations.js
// Utility to ensure two-way sync of relations between people in a genealogy app

/**
 * Ensures all relations (partners, parents, children) are two-way synced between people.
 * @param {object} person - The person being saved (with updated relations)
 * @param {Array<object>} allPeople - The full list of people
 * @returns {Array<object>} - The updated list of people with synced relations
 */
export function syncRelations(person, allPeople) {
  // Helper to get display name
  const getName = p => `${p.firstName || ''} ${p.lastName || ''}`.trim();

  // Helper: kolla om ancestorId är förfader till descendantId
  const isAncestor = (peopleList, ancestorId, descendantId) => {
    if (!ancestorId || !descendantId || ancestorId === descendantId) return false;

    const visited = new Set();
    const queue = [descendantId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);

      const current = peopleList.find(p => p.id === currentId);
      if (!current) continue;

      const parentIds = (current.relations?.parents || [])
        .map(r => (typeof r === 'object' ? r.id : r))
        .filter(Boolean);

      if (parentIds.includes(ancestorId)) return true;
      parentIds.forEach(pid => queue.push(pid));
    }

    return false;
  };

  const isInvalidPartnerRelation = (peopleList, personAId, personBId) => {
    if (!personAId || !personBId || personAId === personBId) return true;

    const personA = peopleList.find(p => p.id === personAId);
    if (!personA) return true;

    const parentIds = (personA.relations?.parents || []).map(r => (typeof r === 'object' ? r.id : r));
    const childIds = (personA.relations?.children || []).map(r => (typeof r === 'object' ? r.id : r));

    if (parentIds.includes(personBId) || childIds.includes(personBId)) return true;
    if (isAncestor(peopleList, personAId, personBId) || isAncestor(peopleList, personBId, personAId)) return true;

    return false;
  };

  // Clone allPeople to avoid mutating original
  let updatedPeople = allPeople.map(p => ({ ...p, relations: { ...p.relations } }));

  // Remove this person from all other people's relations (full clean)
  updatedPeople = updatedPeople.map(p => {
    if (p.id === person.id) return p;
    const rels = { ...p.relations };
    rels.partners = (rels.partners || []).filter(r => r.id !== person.id);
    rels.parents = (rels.parents || []).filter(r => r.id !== person.id);
    rels.children = (rels.children || []).filter(r => r.id !== person.id);
    rels.siblings = (rels.siblings || []).filter(r => r.id !== person.id);
    return { ...p, relations: rels };
  });

  // Add/update this person in each partner's partners-list, always sync type
  (person.relations.partners || []).forEach(partner => {
    const partnerId = typeof partner === 'object' ? partner.id : partner;
    if (isInvalidPartnerRelation(updatedPeople, person.id, partnerId)) return;

    updatedPeople = updatedPeople.map(p => {
      if (p.id !== partnerId) return p;
      const rels = { ...p.relations };
      rels.partners = rels.partners || [];
      // Remove any old entry for this person
      rels.partners = rels.partners.filter(r => r.id !== person.id);
      // Add with correct type
      rels.partners.push({ id: person.id, name: getName(person), type: partner.type });
      return { ...p, relations: rels };
    });
  });

  // Add this person to each parent's children-list
  (person.relations.parents || []).forEach(parent => {
    updatedPeople = updatedPeople.map(p => {
      if (p.id !== parent.id) return p;
      const rels = { ...p.relations };
      rels.children = rels.children || [];
      if (!rels.children.some(r => r.id === person.id)) {
        rels.children.push({ id: person.id, name: getName(person) });
      }
      return { ...p, relations: rels };
    });
  });

  // Add this person to each child's parents-list
  (person.relations.children || []).forEach(child => {
    updatedPeople = updatedPeople.map(p => {
      if (p.id !== child.id) return p;
      const rels = { ...p.relations };
      rels.parents = rels.parents || [];
      if (!rels.parents.some(r => r.id === person.id)) {
        rels.parents.push({ id: person.id, name: getName(person) });
      }
      return { ...p, relations: rels };
    });
  });

  // Add/update this person to each sibling's siblings-list (bidirectional)
  (person.relations.siblings || []).forEach(sibling => {
    updatedPeople = updatedPeople.map(p => {
      if (p.id !== sibling.id) return p;
      const rels = { ...p.relations };
      rels.siblings = rels.siblings || [];
      // Remove any old entry for this person
      rels.siblings = rels.siblings.filter(r => r.id !== person.id);
      // Add with correct type
      rels.siblings.push({ id: person.id, name: getName(person), type: sibling.type });
      return { ...p, relations: rels };
    });
  });

  // Sanera partners globalt: ta bort ogiltiga partnerkopplingar
  updatedPeople = updatedPeople.map(p => {
    const rels = { ...p.relations };
    const seenPartnerIds = new Set();

    rels.partners = (rels.partners || []).filter(partner => {
      const partnerId = typeof partner === 'object' ? partner.id : partner;
      if (!partnerId || seenPartnerIds.has(partnerId)) return false;
      if (isInvalidPartnerRelation(updatedPeople, p.id, partnerId)) return false;
      seenPartnerIds.add(partnerId);
      return true;
    });

    return { ...p, relations: rels };
  });

  // Update this person in the list
  // VIKTIGT: Behåll all data från den ursprungliga personen (inklusive media)
  // men uppdatera med den nya personens data och behåll de synkade relationerna
  updatedPeople = updatedPeople.map(p => {
    if (p.id === person.id) {
      // Behåll all data från den ursprungliga personen, men uppdatera med den nya personens data
      // och behåll de synkade relationerna
      // VIKTIGT: Om person-objektet har media, använd den. Annars behåll den ursprungliga.
      const mediaToKeep = person.media && Array.isArray(person.media) && person.media.length > 0 
        ? person.media 
        : (p.media || []);
      
      return {
        ...p, // Behåll all ursprunglig data
        ...person, // Överskriv med den nya personens data
        media: mediaToKeep, // Säkerställ att media bevaras
        relations: p.relations // Men behåll de synkade relationerna
      };
    }
    return p;
  });

  return updatedPeople;
}
