import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';

// Denna wrapper-komponent säkerställer att ReactQuill bara renderas på klientsidan
// och efter den initiala monteringen, vilket kringgår problemen med React 18 Strict Mode.

const QuillWrapper = (props) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Skicka med alla props (value, onChange, etc.) till ReactQuill
  return <>{isClient ? <ReactQuill {...props} /> : null}</>;
};

export default QuillWrapper;