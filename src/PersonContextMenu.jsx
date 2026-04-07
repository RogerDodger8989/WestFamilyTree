import React, { useState, useRef, useEffect } from "react";
import defaultProfile from "./assets/silhouette_unknown.png";

// Dummy data för senaste personer
const recentPeople = [
  {
    id: 1,
    ref: "A1",
    lastName: "Andersson",
    firstName: "Anna",
    birth: { date: "1980-01-01", place: "Löderup" },
    death: { date: "2020-05-10", place: "Svenstorp" },
    image: null,
  },
  {
    id: 2,
    ref: "B2",
    lastName: "Bengtsson",
    firstName: "Bertil",
    birth: { date: "1975-03-15", place: "Ystad" },
    death: { date: "-", place: "-" },
    image: null,
  },
];

export default function PersonContextMenu({ x, y, onClose, onPersonSelect }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(recentPeople);
  const ref = useRef();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleEsc(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  useEffect(() => {
    // Sökning (dummy, filtrerar på namn)
    if (!search) setResults(recentPeople);
    else setResults(recentPeople.filter(p => (
      p.lastName.toLowerCase().includes(search.toLowerCase()) ||
      p.firstName.toLowerCase().includes(search.toLowerCase())
    )));
  }, [search]);

  return (
    <div
      ref={ref}
      className="absolute z-[1000] bg-surface-2 rounded-lg shadow-lg p-3 min-w-[320px] text-primary border border-subtle"
      style={{
        left: x,
        top: y
      }}
    >
      <input
        autoFocus
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Sök person..."
        className="w-full mb-2.5 px-2 py-1.5 rounded border border-subtle bg-background text-primary outline-none focus:border-strong"
      />
      <div>
        {results.map(person => (
          <div
            key={person.id}
            className="flex items-center gap-2.5 p-1.5 rounded-md cursor-pointer bg-background mb-1 hover:bg-surface"
            title={`(${person.ref}) ${person.lastName}, ${person.firstName}\n* ${person.birth.date}, ${person.birth.place}\n+ ${person.death.date}, ${person.death.place}`}
            onClick={() => {
              if (onPersonSelect) onPersonSelect(person.id);
              onClose();
            }}
          >
            <img
              src={person.image || defaultProfile}
              alt="Profil"
              className="w-9 h-9 rounded-full object-cover bg-surface"
            />
            <div>
              <div className="font-semibold">
                ({person.ref}) {person.lastName}, {person.firstName}
              </div>
              <div className="text-[13px] text-muted">
                * {person.birth.date}, {person.birth.place}
              </div>
              <div className="text-[13px] text-muted">
                + {person.death.date}, {person.death.place}
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 && <div className="text-muted p-2">Inga träffar</div>}
      </div>
    </div>
  );
}
