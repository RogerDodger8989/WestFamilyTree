import React from 'react';
import TipTapEditor from './TipTapEditor';

export default function MaybeEditor(props) {
  const { value = '', onChange, containerProps = {}, spellCheck, lang, onBlur, onKeyDown } = props;

  return <TipTapEditor value={value} onChange={onChange} onBlur={onBlur} />;
}
