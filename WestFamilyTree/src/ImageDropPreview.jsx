import React from 'react';

// Komponent som visar förhandsinfo om filnamn och storlek vid drag/klistra in
export default function ImageDropPreview({ source }) {
  const [previewSize, setPreviewSize] = React.useState(null);
  const [previewName, setPreviewName] = React.useState(() => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const baseName = (source.archive || 'bild') + '_' + dateStr;
    return baseName + '.png';
  });

  // Hantera drag-over och drag-leave för att visa storlek
  React.useEffect(() => {
    const handleDragOver = (e) => {
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const item = e.dataTransfer.items[0];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setPreviewSize(Math.round(file.size / 1024));
            setPreviewName(file.name);
          }
        }
      }
    };
    const handleDragLeave = () => {
      setPreviewSize(null);
      setPreviewName(() => {
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-');
        const baseName = (source.archive || 'bild') + '_' + dateStr;
        return baseName + '.png';
      });
    };
    // Tyvärr kan vi inte läsa clipboard size förrän paste sker, så bara drag fungerar
    const node = document.getElementById('image-drop-preview');
    if (node) {
      node.addEventListener('dragover', handleDragOver);
      node.addEventListener('dragleave', handleDragLeave);
      node.addEventListener('drop', handleDragLeave);
    }
    return () => {
      if (node) {
        node.removeEventListener('dragover', handleDragOver);
        node.removeEventListener('dragleave', handleDragLeave);
        node.removeEventListener('drop', handleDragLeave);
      }
    };
  }, [source]);

  return (
    <div id="image-drop-preview" className="flex flex-col items-center justify-center h-[110px] w-[90px] border-2 border-dashed border-slate-600 rounded bg-slate-800 text-slate-400 text-xs select-none" style={{ cursor: 'pointer' }}>
      <span className="mb-1">Ingen bild</span>
      <span className="text-[10px]">Klistra in (Ctrl+V)</span>
      <span className="text-[10px]">eller dra in bild</span>
      <span className="text-[10px] mt-1 text-slate-400">Filnamn: {previewName}</span>
      {previewSize && <span className="text-[10px] text-slate-400">Storlek: {previewSize} kB</span>}
    </div>
  );
}