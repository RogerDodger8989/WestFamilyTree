import React, { useState, useMemo } from 'react';

export default function TagInput({ value, onChange, placeholder = "Taggar..." }) {
  const [input, setInput] = useState('');

  // Omvandla strängen "tag1, tag2" till en array
  const tags = useMemo(() => {
    return value ? value.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
  }, [value]);

  const handleKeyDown = (e) => {
    // Lägg till tagg vid Enter eller Komma
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = input.trim();
      if (newTag && !tags.includes(newTag)) {
        const newTags = [...tags, newTag];
        onChange(newTags.join(', '));
        setInput('');
      }
    } 
    // Ta bort sista taggen vid Backspace om fältet är tomt
    else if (e.key === 'Backspace' && !input && tags.length > 0) {
      const newTags = tags.slice(0, -1);
      onChange(newTags.join(', '));
    }
  };

  const removeTag = (tagToRemove) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    onChange(newTags.join(', '));
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border border-slate-600 rounded px-2 py-1 bg-slate-900 w-full focus-within:ring-1 focus-within:ring-blue-500 min-h-[30px]">
      {tags.map((tag, idx) => (
        <span key={idx} className="flex items-center gap-1 bg-green-700 text-green-100 text-xs font-semibold px-2 py-0.5 rounded-full border border-green-600">
          {tag}
          <button 
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="hover:text-green-200 focus:outline-none font-bold leading-none ml-0.5 text-green-300"
            title="Ta bort tagg"
          >
            ×
          </button>
        </span>
      ))}
      <input 
        type="text" 
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
            // Spara det som står kvar när man lämnar fältet
            if (input.trim()) {
                const newTag = input.trim();
                if (!tags.includes(newTag)) {
                    onChange([...tags, newTag].join(', '));
                }
                setInput('');
            }
        }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[60px] text-sm outline-none bg-transparent text-slate-200"
      />
    </div>
  );
}