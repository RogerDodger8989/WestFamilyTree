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

  // Clone allPeople to avoid mutating original
  let updatedPeople = allPeople.map(p => ({ ...p, relations: { ...p.relations } }));

  // Remove this person from all other people's relations (full clean)
  updatedPeople = updatedPeople.map(p => {
    if (p.id === person.id) return p;
    const rels = { ...p.relations };
    rels.partners = (rels.partners || []).filter(r => r.id !== person.id);
    rels.parents = (rels.parents || []).filter(r => r.id !== person.id);
    rels.children = (rels.children || []).filter(r => r.id !== person.id);
    return { ...p, relations: rels };
  });

  // Add/update this person in each partner's partners-list, always sync type
  (person.relations.partners || []).forEach(partner => {
    updatedPeople = updatedPeople.map(p => {
      if (p.id !== partner.id) return p;
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

  // Update this person in the list
  updatedPeople = updatedPeople.map(p => p.id === person.id ? person : p);

  return updatedPeople;
}
