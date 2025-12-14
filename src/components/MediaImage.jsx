import React from 'react';
import { useMediaUrl } from '../hooks/useMediaUrl.js';

/**
 * Komponent för att visa bilder som hanterar media:// URLs automatiskt
 * @param {string} url - Bildens URL (kan vara media://, blob:, http://, eller data:)
 * @param {string} alt - Alt-text för bilden
 * @param {string} className - CSS-klasser
 * @param {object} props - Övriga props som skickas till <img> taggen
 */
export default function MediaImage({ url, alt, className, ...props }) {
  const { blobUrl, loading, error } = useMediaUrl(url);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-900/20 border border-red-700/50 ${className || ''}`}>
        <div className="text-center p-4">
          <p className="text-red-400 text-sm font-bold">Fel: Kunde inte läsa in bilden.</p>
          <p className="text-red-500 text-xs mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 ${className || ''}`}>
        <div className="text-slate-400 text-sm">Laddar bild...</div>
      </div>
    );
  }

  return (
    <img 
      src={blobUrl || url} 
      alt={alt || 'Bild'} 
      className={className}
      {...props}
    />
  );
}

