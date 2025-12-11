import React, { useState } from "react";

// En rad i bildgalleriet
export default function ImageGalleryRow({ image, onEdit, onSetProfile, onLinkPlace, onContextMenu }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuOpen(true);
    if (onContextMenu) onContextMenu(image);
  };
  return (
    <div className="flex items-center gap-4 py-2 px-3 border-b border-slate-700 hover:bg-slate-800 relative"
      onContextMenu={handleContextMenu}
    >
      {/* Miniatyr */}
      <img src={image.thumbUrl || image.url} alt={image.title || "Bild"} className="w-20 h-20 object-cover rounded shadow" />
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-200 truncate">{image.title || image.filename}</div>
        <div className="text-xs text-slate-400 truncate">{image.caption}</div>
        {/* Taggade personer */}
        {image.taggedPeople && image.taggedPeople.length > 0 && (
          <div className="text-xs text-amber-400 mt-1">
            Taggade: {image.taggedPeople.map(p => p.name).join(", ")}
          </div>
        )}
      </div>
      {/* Profilbild-markering */}
      {image.isProfile && <span className="px-2 py-1 bg-green-700 text-white text-xs rounded">Profilbild</span>}
      {/* Meny */}
      {menuOpen && (
        <div className="absolute right-2 top-10 bg-slate-900 border border-slate-700 rounded shadow-lg z-50 min-w-[160px]">
          <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-200" onClick={() => { setMenuOpen(false); onSetProfile(image); }}>Markera som profilbild</button>
          <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 text-slate-200" onClick={() => { setMenuOpen(false); onLinkPlace(image); }}>Koppla plats</button>
          <button className="block w-full text-left px-4 py-2 hover:bg-slate-800 text-red-400" onClick={() => setMenuOpen(false)}>Stäng</button>
        </div>
      )}
      {/* Redigera-knapp */}
      <button className="ml-2 px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs" onClick={() => onEdit(image)}>Redigera</button>
    </div>
  );
}
