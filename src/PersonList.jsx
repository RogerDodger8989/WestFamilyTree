import React, { useEffect } from 'react';
import { useApp } from './AppContext';

function GenderIcon({ gender, className = '' }) {
  if (gender === 'M') {
    return (
      <svg className={`w-5 h-5 text-blue-200 fill-current ${className}`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2a5 5 0 0 0-5 5c0 2.47 1.8 4.5 4.1 4.92L11 13H9v2h2v7h2v-7h2v-2h-2l-.1-1.08A5 5 0 0 0 12 2zm0 2a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3z" />
      </svg>
    );
  }
  if (gender === 'K') {
    return (
      <svg className={`w-5 h-5 text-pink-200 fill-current ${className}`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2a5 5 0 0 0-5 5a5 5 0 0 0 5 5a5 5 0 0 0 5-5a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3a3 3 0 0 1-3 3a3 3 0 0 1-3-3a3 3 0 0 1 3-3zm0 8c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm0 2c2.11 0 3.63.53 4.4 1H7.6c.77-.47 2.29-1 4.4-1z" />
      </svg>
    );
  }
  return null;
}

function PersonList({ people, onOpenEditModal, onOpenRelationModal, onDeletePerson, focusPair, onSetFocusPair, bookmarks }) {
  const getLifeSpanString = (person) => {
    const birthEvent = person.events?.find(e => e.type === 'Födelse');
    const deathEvent = person.events?.find(e => e.type === 'Död');
    const birthDate = birthEvent?.date || '';
    const deathDate = deathEvent?.date || '';
    if (!birthDate && !deathDate) return '';
    return `(${birthDate} - ${deathDate})`;
  };

  const handleContextMenu = (event, personId) => {
    event.preventDefault();
    if (window.electron && window.electron.showPersonContextMenu) {
      window.electron.showPersonContextMenu(personId);
    }
  };

  useEffect(() => {
    if (window.electron && window.electron.onContextMenuCommand) {
      const cleanup = window.electron.onContextMenuCommand((command, personId) => {
        const person = people.find(p => p.id === personId);
        if (!person) return;
        switch (command) {
          case 'edit-person':
            onOpenEditModal(person.id);
            break;
          case 'view-in-family-tree':
            onOpenRelationModal(person.id);
            break;
          case 'set-primary-focus':
            onSetFocusPair('primary', person.id);
            break;
          case 'set-secondary-focus':
            onSetFocusPair('secondary', person.id);
            break;
          case 'delete-person':
            onDeletePerson(personId);
            break;
          case 'copy-ref':
            navigator.clipboard.writeText(person.refNumber);
            break;
          case 'copy-name':
            navigator.clipboard.writeText(`${person.firstName} ${person.lastName}`);
            break;
          default:
        }
      });
      return () => cleanup();
    }
  }, [people, onOpenEditModal, onDeletePerson, onOpenRelationModal, onSetFocusPair]);

  const sortedPeople = [...people].sort((a, b) => a.refNumber - b.refNumber);
  const bookmarkedPeople = sortedPeople.filter(p => bookmarks.includes(p.id));
  const otherPeople = sortedPeople.filter(p => !bookmarks.includes(p.id));

  const { dbData, undoMerge, restorePerson, showStatus, setFamilyTreeFocusPersonId, familyTreeFocusPersonId, setIsDirty } = useApp();

  const PersonRow = ({ person }) => {
    const handleRestore = (e) => {
      e.stopPropagation();
      const merge = (dbData?.meta?.merges || []).find(m => (m.originalPersonIds || []).includes(person.id));
      if (merge && undoMerge) {
        try {
          const ok = undoMerge(merge.id);
          if (ok) showStatus('Sammanfogning ångrad.');
          else showStatus('Återställning misslyckades.');
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.debug('undoMerge failed', err);
          showStatus('Återställning misslyckades.');
        }
      } else if (restorePerson) {
        try {
          restorePerson(person.id);
          showStatus('Person återställd från arkiv.');
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.debug('restorePerson failed', err);
          showStatus('Återställning misslyckades.');
        }
      } else {
        showStatus('Ingen ångra-information hittades.');
      }
    };

    return (
      <div
        key={person.id}
        onContextMenu={(e) => handleContextMenu(e, person.id)}
        className="flex justify-between items-center p-4 hover:bg-slate-700 transition border-b border-slate-700 last:border-0"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono mr-2">REF: {person.refNumber}</span>
          <span
            onClick={(e) => { e.stopPropagation(); onSetFocusPair('primary', person.id); }}
            className={`cursor-pointer text-xl ${person.id === focusPair.primary ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-300'}`}
            title="Sätt som Primär Fokus"
          >★</span>
          <span
            onClick={(e) => { e.stopPropagation(); onSetFocusPair('secondary', person.id); }}
            className={`cursor-pointer text-xl ${person.id === focusPair.secondary ? 'text-blue-500' : 'text-slate-500 hover:text-blue-400'}`}
            title="Sätt som Sekundär Fokus"
          >★</span>
          <GenderIcon gender={person.gender} className="mr-2 flex-shrink-0" />
          <span className="cursor-pointer hover:text-blue-400" onClick={() => onOpenEditModal(person.id)}>
            <span className="font-bold text-slate-200">{person.firstName} {person.lastName}</span>
            {person._archived && <span className="text-red-500 font-semibold ml-2">ARKIVERAD</span>}
            {person._archived && (
              <button onClick={(e) => handleRestore(e)} className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded text-xs hover:bg-red-700">Återställ</button>
            )}
            <span className="text-slate-400 text-sm font-normal ml-1">{getLifeSpanString(person)}</span>
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <button
        onClick={(e) => {
          e.stopPropagation();
          setFamilyTreeFocusPersonId(person.id);
          // setFamilyTreeFocusPersonId wrapper sätter automatiskt isDirty
          showStatus('Huvudperson sparad!');
        }}
            title="Huvudperson - sätt som fokus i trädvyn"
            className={`px-2 py-0.5 text-xs border rounded ${familyTreeFocusPersonId === person.id ? 'bg-yellow-600 border-yellow-500 text-yellow-100' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
          >
            Huvudperson
          </button>

          <button
            onClick={() => onOpenEditModal(person.id)}
            title="Redigera person"
            className="px-2 py-0.5 text-xs bg-slate-700 border border-slate-600 text-slate-200 rounded hover:bg-slate-600"
          >
            Redigera
          </button>

          <button
            onClick={() => onOpenRelationModal(person.id)}
            title="Koppla person till annan"
            className="px-2 py-0.5 text-xs border border-purple-600 text-purple-300 rounded hover:bg-purple-900"
          >
            Koppla
          </button>

          <button
            onClick={() => onDeletePerson(person.id)}
            title="Ta bort person"
            className="px-2 py-0.5 text-xs border border-red-600 text-red-400 rounded hover:bg-red-900 font-semibold"
          >
            Ta bort
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="lg:col-span-2 h-[84vh]">
      <div className="card min-h-[500px] h-full flex flex-col">
        <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center rounded-t-lg">
          <h2 className="font-semibold text-slate-200">Människor i databasen</h2>
          <span className="text-xs bg-slate-700 px-2 py-1 rounded-full text-slate-300">{people.length} st</span>
        </div>
        <div className="divide-y divide-slate-700 flex-grow max-h-[600px] overflow-y-auto bg-slate-800">
          {people.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Registret är tomt.</div>
          ) : (
            <>
              {bookmarkedPeople.map(person => <PersonRow key={person.id} person={person} />)}
              {bookmarkedPeople.length > 0 && otherPeople.length > 0 && (
                <hr className="my-2 border-t-2 border-dashed border-slate-700" />
              )}
              {otherPeople.map(person => <PersonRow key={person.id} person={person} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonList;