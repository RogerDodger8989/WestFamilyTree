import React, { useState, useEffect } from 'react';

/**
 * Modal för att välja förälder när man skapar ett barn
 * @param {object} props
 * @param {object} props.mother - Modern (den person som skapar barnet)
 * @param {array} props.allPeople - Alla personer i databasen
 * @param {function} props.getPersonRelations - Funktion för att hämta relations
 * @param {function} props.onSelect - Callback när förälder är vald (parentId, isNew)
 * @param {function} props.onCreateNew - Callback när "Ny" klickas (skapar placeholder)
 * @param {function} props.onClose - Callback för att stänga modalen
 */
export default function SelectFatherModal({ mother, allPeople, getPersonRelations, onSelect, onCreateNew, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [partners, setPartners] = useState([]);

  // Hämta partners till den valda personen
  useEffect(() => {
    if (mother?.id) {
      // Hitta den korrekta personen från allPeople för att få uppdaterade relations
      const currentPerson = allPeople.find(p => p.id === mother.id) || mother;
      const partnerIds = new Set();
      
      // Först kolla i person.relations.partners (från EditPersonModal)
      if (currentPerson.relations?.partners && Array.isArray(currentPerson.relations.partners)) {
        currentPerson.relations.partners.forEach(p => {
          const partnerId = typeof p === 'object' ? p.id : p;
          if (partnerId) partnerIds.add(partnerId);
        });
      }
      
      // Sedan kolla via getPersonRelations (från relations tabellen)
      if (getPersonRelations) {
        const relations = getPersonRelations(currentPerson.id) || [];
        relations.forEach(r => {
          if (!r._archived) {
            const type = (r.type || '').toLowerCase();
            if (type === 'spouse' || type === 'partner') {
              // Hitta partner-ID
              const partnerId = r.fromPersonId === currentPerson.id ? r.toPersonId : r.fromPersonId;
              if (partnerId) partnerIds.add(partnerId);
            }
          }
        });
      }
      
      // Hämta partner-objekt
      const partnerObjects = Array.from(partnerIds)
        .map(id => allPeople.find(p => p.id === id))
        .filter(Boolean);
      
      console.log('[SelectFatherModal] Person:', currentPerson?.firstName, currentPerson?.lastName);
      console.log('[SelectFatherModal] Person relations:', currentPerson?.relations);
      console.log('[SelectFatherModal] Partner IDs:', Array.from(partnerIds));
      console.log('[SelectFatherModal] Partners hittade:', partnerObjects.length, partnerObjects.map(p => `${p.firstName} ${p.lastName}`));
      setPartners(partnerObjects);
    } else {
      setPartners([]);
    }
  }, [mother, allPeople, getPersonRelations]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = allPeople
        .filter(p => 
          p.id !== mother?.id && // Exkludera modern
          (p.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           String(p.refNumber || '').includes(searchTerm))
        )
        .slice(0, 20); // Visa max 20 resultat
      setFilteredPeople(filtered);
    } else {
      setFilteredPeople([]);
    }
  }, [searchTerm, allPeople, mother]);

  const handleSelectPerson = (personId) => {
    if (onSelect) {
      onSelect(personId, false); // false = inte ny person
    }
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew(); // Skapar placeholder person
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div 
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-slate-200">
          Välj förälder med {mother?.firstName} {mother?.lastName}
        </h3>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Sök på namn eller REF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Visa partners först om de finns */}
        {partners.length > 0 && !searchTerm.trim() && (
          <div className="mb-4">
            <div className="text-sm text-slate-400 mb-2">Partners:</div>
            <div className="space-y-2">
              {partners.map(person => {
                const profileImage = person.media?.[0]?.url;
                const lifeSpan = person.events?.find(e => e.type === 'Födelse')?.date || '';
                const deathDate = person.events?.find(e => e.type === 'Död')?.date || '';
                const lifeSpanStr = lifeSpan || deathDate ? `${lifeSpan || '?'} - ${deathDate || 'Levande'}` : '';
                
                return (
                  <div
                    key={person.id}
                    onClick={() => handleSelectPerson(person.id)}
                    className="p-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-lg cursor-pointer transition-colors flex items-center gap-3"
                  >
                    {/* Rund thumbnail */}
                    <div className="w-12 h-12 rounded-full bg-slate-600 flex-shrink-0 overflow-hidden border-2 border-slate-500">
                      {profileImage ? (
                        <img 
                          src={profileImage} 
                          alt={`${person.firstName} ${person.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          {person.firstName?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    
                    {/* Personinfo */}
                    <div className="flex-grow min-w-0">
                      <div className="font-semibold text-slate-200">
                        {person.firstName} {person.lastName}
                      </div>
                      {lifeSpanStr && (
                        <div className="text-sm text-slate-400">
                          {lifeSpanStr}
                        </div>
                      )}
                      {person.refNumber && (
                        <div className="text-xs text-slate-500">
                          REF: {person.refNumber}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-green-400 font-semibold">Partner</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Knapp för att skapa ny placeholder person */}
        <div className="mb-4">
          <button
            onClick={handleCreateNew}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <span>+</span>
            <span>Skapa ny (spök-ruta)</span>
          </button>
        </div>

        {/* Lista med personer */}
        {searchTerm.trim() && (
          <div className="max-h-64 overflow-y-auto border border-slate-700 rounded-lg">
            {filteredPeople.length > 0 ? (
              <ul className="divide-y divide-slate-700">
                {filteredPeople.map(person => {
                  const profileImage = person.media?.[0]?.url;
                  const lifeSpan = person.events?.find(e => e.type === 'Födelse')?.date || '';
                  const deathDate = person.events?.find(e => e.type === 'Död')?.date || '';
                  const lifeSpanStr = lifeSpan || deathDate ? `${lifeSpan || '?'} - ${deathDate || 'Levande'}` : '';
                  const isPartner = partners.some(p => p.id === person.id);
                  
                  return (
                    <li
                      key={person.id}
                      onClick={() => handleSelectPerson(person.id)}
                      className={`p-3 hover:bg-slate-700 cursor-pointer transition-colors flex items-center gap-3 ${isPartner ? 'bg-slate-700/30 border-l-2 border-green-500' : ''}`}
                    >
                      {/* Rund thumbnail */}
                      <div className="w-12 h-12 rounded-full bg-slate-600 flex-shrink-0 overflow-hidden border-2 border-slate-500">
                        {profileImage ? (
                          <img 
                            src={profileImage} 
                            alt={`${person.firstName} ${person.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                            {person.firstName?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      
                      {/* Personinfo */}
                      <div className="flex-grow min-w-0">
                        <div className="font-semibold text-slate-200">
                          {person.firstName} {person.lastName}
                        </div>
                        {lifeSpanStr && (
                          <div className="text-sm text-slate-400">
                            {lifeSpanStr}
                          </div>
                        )}
                        {person.refNumber && (
                          <div className="text-xs text-slate-500">
                            REF: {person.refNumber}
                          </div>
                        )}
                      </div>
                      {isPartner && (
                        <div className="text-xs text-green-400 font-semibold">Partner</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-4 text-center text-slate-400">
                Inga personer hittades
              </div>
            )}
          </div>
        )}

        {!searchTerm.trim() && partners.length === 0 && (
          <div className="p-4 text-center text-slate-400 text-sm">
            Skriv för att söka efter personer eller klicka på "Skapa ny" för att skapa en placeholder person
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

