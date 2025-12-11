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
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 1000,
        background: "#222",
        borderRadius: 8,
        boxShadow: "0 4px 24px #0008",
        padding: 12,
        minWidth: 320,
        color: "#fff"
      }}
    >
      <input
        autoFocus
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Sök person..."
        style={{ width: "100%", marginBottom: 10, padding: 6, borderRadius: 4, border: "none" }}
      />
      <div>
        {results.map(person => (
          <div
            key={person.id}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: 6, borderRadius: 6, cursor: "pointer", background: "#333", marginBottom: 4 }}
            title={`(${person.ref}) ${person.lastName}, ${person.firstName}\n* ${person.birth.date}, ${person.birth.place}\n+ ${person.death.date}, ${person.death.place}`}
            onClick={() => {
              if (onPersonSelect) onPersonSelect(person.id);
              onClose();
            }}
          >
            <img
              src={person.image || defaultProfile}
              alt="Profil"
              style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "#444" }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                ({person.ref}) {person.lastName}, {person.firstName}
              </div>
              <div style={{ fontSize: 13, color: "#ccc" }}>
                * {person.birth.date}, {person.birth.place}
              </div>
              <div style={{ fontSize: 13, color: "#ccc" }}>
                + {person.death.date}, {person.death.place}
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 && <div style={{ color: "#aaa", padding: 8 }}>Inga träffar</div>}
      </div>
    </div>
  );
}
