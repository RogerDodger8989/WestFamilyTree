import React, { useRef, useState, useEffect } from 'react';
import ImageEditor from '@toast-ui/react-image-editor';
import 'tui-image-editor/dist/tui-image-editor.css';
import { X, Save, Copy } from 'lucide-react';

const ImageEditorModal = ({ isOpen, onClose, imageUrl, imageName, onSave }) => {
  const editorRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Rensa editorn när modal stängs
    return () => {
      if (editorRef.current) {
        const editorInstance = editorRef.current.getInstance();
        if (editorInstance && typeof editorInstance.destroy === 'function') {
          editorInstance.destroy();
        }
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleSave = async (createCopy) => {
    if (!editorRef.current) return;
    
    setIsSaving(true);
    try {
      const editorInstance = editorRef.current.getInstance();
      const imageDataUrl = editorInstance.toDataURL();
      
      // Konvertera data URL till Blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      onSave(blob, createCopy);
      onClose();
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Kunde inte spara bilden. Försök igen.');
    } finally {
      setIsSaving(false);
    }
  };

  const myTheme = {
    'common.bi.image': '',
    'common.bisize.width': '0px',
    'common.bisize.height': '0px',
    'common.backgroundImage': 'none',
    'common.backgroundColor': '#1e293b',
    'common.border': '1px solid #475569',

    // Header
    'header.backgroundImage': 'none',
    'header.backgroundColor': '#0f172a',
    'header.border': '0px',

    // Main icons
    'menu.normalIcon.color': '#94a3b8',
    'menu.activeIcon.color': '#3b82f6',
    'menu.disabledIcon.color': '#475569',
    'menu.hoverIcon.color': '#cbd5e1',
    'menu.iconSize.width': '24px',
    'menu.iconSize.height': '24px',

    // Submenu
    'submenu.backgroundColor': '#1e293b',
    'submenu.partition.color': '#475569',

    // Submenu icons
    'submenu.normalIcon.color': '#94a3b8',
    'submenu.activeIcon.color': '#3b82f6',
    'submenu.iconSize.width': '32px',
    'submenu.iconSize.height': '32px',

    // Submenu labels
    'submenu.normalLabel.color': '#cbd5e1',
    'submenu.normalLabel.fontWeight': 'normal',
    'submenu.activeLabel.color': '#3b82f6',
    'submenu.activeLabel.fontWeight': 'bold',

    // Checkbox
    'checkbox.border': '1px solid #475569',
    'checkbox.backgroundColor': '#0f172a',

    // Range
    'range.pointer.color': '#3b82f6',
    'range.bar.color': '#475569',
    'range.subbar.color': '#3b82f6',

    // Colorpicker
    'colorpicker.button.border': '1px solid #475569',
    'colorpicker.title.color': '#cbd5e1'
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-slate-900 rounded-lg shadow-2xl flex flex-col" style={{ width: '90vw', height: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Redigera Bild: {imageName}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
            disabled={isSaving}
          >
            <X size={20} />
          </button>
        </div>

        {/* Editor Container */}
        <div className="flex-1 overflow-hidden p-4">
          <ImageEditor
            ref={editorRef}
            includeUI={{
              loadImage: {
                path: imageUrl,
                name: imageName
              },
              theme: myTheme,
              menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'filter'],
              initMenu: 'filter',
              uiSize: {
                width: '100%',
                height: '100%'
              },
              menuBarPosition: 'bottom'
            }}
            cssMaxHeight={window.innerHeight * 0.9 - 150}
            cssMaxWidth={window.innerWidth * 0.9 - 50}
            selectionStyle={{
              cornerSize: 20,
              rotatingPointOffset: 70
            }}
            usageStatistics={false}
          />
        </div>

        {/* Footer - Save Buttons */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-700 bg-slate-800 rounded-b-lg">
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded transition-colors font-medium"
          >
            <Save size={18} />
            {isSaving ? 'Sparar...' : 'Spara över original'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded transition-colors font-medium"
          >
            <Copy size={18} />
            {isSaving ? 'Sparar...' : 'Spara som kopia'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorModal;
