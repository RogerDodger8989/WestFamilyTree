import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Importera Quill's CSS
import DOMPurify from 'dompurify';

const toolbarOptions = [
  [{ 'header': [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  [{ 'align': [] }],
  ['link'],
  ['clean']
];

function NoteEditorModal({ isOpen, initialHtml, onClose, onSave }) {
  const [html, setHtml] = useState(initialHtml || '');

  useEffect(() => {
    // Uppdatera state om den initiala HTML-koden ändras (t.ex. vid byte av person)
    setHtml(initialHtml || '');
  }, [initialHtml, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Sanera HTML-koden innan den sparas för att förhindra XSS-attacker
    const sanitizedHtml = DOMPurify.sanitize(html);
    onSave(sanitizedHtml);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold">Redigera notering</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded font-semibold hover:bg-gray-300">Avbryt</button>
            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Spara</button>
          </div>
        </div>
        <ReactQuill
          theme="snow"
          value={html}
          onChange={setHtml}
          modules={{
            toolbar: {
              container: toolbarOptions,
            },
          }}
          className="bg-white"
          style={{ height: '400px', marginBottom: '4rem' }}
        />
      </div>
    </div>
  );
}

export default NoteEditorModal;