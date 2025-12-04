import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import './tiptap-editor.css';

export default function TipTapEditor({ value = '', onChange, onBlur }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable: true,
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange({ target: { value: editor.getHTML() } });
      }
    },
    onBlur: () => {
      if (onBlur) onBlur();
    },
  });

  // Auto-focus the editor when it's created
  useEffect(() => {
    if (editor && !editor.isFocused) {
      setTimeout(() => {
        editor.commands.focus();
      }, 0);
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-wrapper">
      <div className="tiptap-toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          onClick={() => editor.chain().focus().clearNodes().run()}
          title="Clear formatting"
        >
          ✕
        </button>
        <div className="toolbar-divider"></div>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          title="Bullet list"
        >
          •
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          title="Ordered list"
        >
          1.
        </button>
      </div>
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  );
}
