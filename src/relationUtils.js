// Helper: Build relations array from people array to keep dbData.relations in sync.
export function buildRelationsFromPeople(people = []) {
  const relations = [];
  const seen = new Set();

  const addRelation = (fromPersonId, toPersonId, type) => {
    if (!fromPersonId || !toPersonId || fromPersonId === toPersonId) return;
    const key1 = `${fromPersonId}|${toPersonId}|${type}`;
    const key2 = `${toPersonId}|${fromPersonId}|${type}`;
    if (seen.has(key1) || seen.has(key2)) return;
    seen.add(key1);

    relations.push({
      id: `rel_${fromPersonId}_${toPersonId}_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      fromPersonId,
      toPersonId,
      type,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      _archived: false
    });
  };

  for (const person of people) {
    if (!person || !person.id || !person.relations) continue;

    const { parents = [], children = [], spouseId = null, siblings = [], partners = [] } = person.relations;

    for (const parentId of parents) {
      if (typeof parentId === 'string') {
        addRelation(parentId, person.id, 'parent');
      } else if (parentId && typeof parentId === 'object' && parentId.id) {
        addRelation(parentId.id, person.id, 'parent');
      }
    }

    for (const childId of children) {
      if (typeof childId === 'string') {
        addRelation(person.id, childId, 'parent');
      } else if (childId && typeof childId === 'object' && childId.id) {
        addRelation(person.id, childId.id, 'parent');
      }
    }

    if (Array.isArray(partners)) {
      for (const partnerRef of partners) {
        const partnerId = typeof partnerRef === 'string' ? partnerRef : (partnerRef?.id || partnerRef);
        if (partnerId) addRelation(person.id, partnerId, 'spouse');
      }
    }

    if (spouseId) {
      const spouseIdStr = typeof spouseId === 'string' ? spouseId : (spouseId.id || spouseId);
      if (spouseIdStr) addRelation(person.id, spouseIdStr, 'spouse');
    }

    for (const siblingId of siblings) {
      if (typeof siblingId === 'string') {
        addRelation(person.id, siblingId, 'sibling');
      } else if (siblingId && typeof siblingId === 'object' && siblingId.id) {
        addRelation(person.id, siblingId.id, 'sibling');
      }
    }
  }

  return relations;
}

export const ensureParentsArePartners = (allPeople, personId) => {
  let updatedPeople = allPeople.map(p => ({ ...p, relations: { ...p.relations } }));

  const person = updatedPeople.find(p => p.id === personId);
  if (!person || !person.relations) return updatedPeople;

  const childrenFromChildren = (person.relations.children || []).map(c => typeof c === 'object' ? c.id : c);
  const childrenFromParents = updatedPeople
    .filter(p => {
      const parents = (p.relations?.parents || []).map(par => typeof par === 'object' ? par.id : par);
      return parents.includes(personId);
    })
    .map(p => p.id);

  const allChildren = [...new Set([...childrenFromChildren, ...childrenFromParents])];

  allChildren.forEach(childId => {
    const child = updatedPeople.find(p => p.id === childId);
    if (!child) return;

    const childParentsFromChild = (child.relations?.parents || [])
      .map(p => typeof p === 'object' ? p.id : p)
      .filter(Boolean);

    const childParentsFromOthers = updatedPeople
      .filter(p => p.relations?.children)
      .filter(p => {
        const pChildren = (p.relations.children || []).map(c => typeof c === 'object' ? c.id : c);
        return pChildren.includes(childId);
      })
      .map(p => p.id);

    const allParents = [...new Set([...childParentsFromChild, ...childParentsFromOthers])].filter(Boolean);
    if (allParents.length <= 1) return;

    allParents.forEach(parentId => {
      const parentIndex = updatedPeople.findIndex(p => p.id === parentId);
      if (parentIndex === -1) return;

      const parent = updatedPeople[parentIndex];
      if (!parent.relations) parent.relations = {};
      if (!parent.relations.partners) parent.relations.partners = [];

      allParents.forEach(otherParentId => {
        if (otherParentId === parentId) return;
        const otherParent = updatedPeople.find(p => p.id === otherParentId);
        if (!otherParent) return;

        const alreadyPartners = parent.relations.partners.some(p => (typeof p === 'object' ? p.id : p) === otherParentId);
        if (alreadyPartners) return;

        parent.relations.partners.push({
          id: otherParentId,
          name: `${otherParent.firstName || ''} ${otherParent.lastName || ''}`.trim(),
          type: 'Okand'
        });
      });

      updatedPeople[parentIndex] = parent;
    });
  });

  return updatedPeople;
};

export const ensureAllRelations = (allPeople) => {
  let updatedPeople = allPeople.map(p => ({ ...p, relations: { ...p.relations } }));
  updatedPeople.forEach(person => {
    if (person && person.id) updatedPeople = ensureParentsArePartners(updatedPeople, person.id);
  });
  return updatedPeople;
};