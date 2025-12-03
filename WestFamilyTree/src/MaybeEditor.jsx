import React from 'react';
import * as EditorLib from 'react-simple-wysiwyg';
import './editor.css';

const RealEditor = (EditorLib && (EditorLib.default || EditorLib.Editor)) || null;

export default function MaybeEditor(props) {
  const { value = '', onChange, containerProps = {}, spellCheck, lang, onBlur, onKeyDown } = props;

  if (RealEditor) {
    return <RealEditor {...props} />;
  }

  // Fallback: render a simple textarea that mimics the important props
  const handleChange = (e) => {
    if (typeof onChange === 'function') {
      // pass an event-like object to keep callers unchanged
      onChange({ target: { value: e.target.value } });
    }
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      spellCheck={spellCheck}
      lang={lang}
      {...containerProps}
    />
  );
}
