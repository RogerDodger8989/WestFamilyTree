import React from 'react';
import { useMediaUrl } from '../hooks/useMediaUrl.js';

import { ImageOff } from 'lucide-react';

/**
 * Komponent för att visa bilder som hanterar media:// URLs automatiskt
 * @param {string} url - Bildens URL (kan vara media://, blob:, http://, eller data:)
 * @param {string} alt - Alt-text för bilden
 * @param {string} className - CSS-klasser
 * @param {object} props - Övriga props som skickas till <img> taggen
 */
export default function MediaImage({ url, alt, className, style, ...props }) {
  const { blobUrl, loading, error } = useMediaUrl(url);

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-surface-2 border border-dashed border-subtle text-muted rounded-lg overflow-hidden ${className || ''}`} style={style}>
        <ImageOff size={24} className="opacity-40 mb-1" />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Saknas</span>
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
      style={style}
      {...props}
    />
  );
}

