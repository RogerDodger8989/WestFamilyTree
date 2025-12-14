import { useState, useEffect, useRef } from 'react';

/**
 * Hook för att konvertera media:// URLs till blob URLs som kan användas i <img> taggar
 * @param {string} url - Bildens URL (kan vara media://, blob:, http://, eller data:)
 * @returns {object} - { blobUrl, loading, error }
 */
export function useMediaUrl(url) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const blobUrlRef = useRef(null); // Ref för att spara blobUrl för cleanup

  useEffect(() => {
    // Rensa tidigare blob URL om den finns
    if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    if (!url) {
      setBlobUrl(null);
      return;
    }

    // Om URL:en redan är kompatibel (blob:, http://, https://, data:), använd direkt
    if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      blobUrlRef.current = null; // Ingen blob URL att rensa
      setBlobUrl(url);
      setLoading(false);
      setError(null);
      return;
    }

    // Om det är en media:// URL, konvertera till blob URL
    if (url.startsWith('media://')) {
      setLoading(true);
      setError(null);

      const loadMediaUrl = async () => {
        try {
          // Extrahera filvägen från media:// URL
          let filePath = url.replace('media://', '');
          // Decode URL encoding
          try {
            filePath = decodeURIComponent(filePath);
          } catch (e) {
            // Om decodeURIComponent misslyckas, försök manuellt
            filePath = filePath.replace(/%2F/g, '/').replace(/%20/g, ' ').replace(/%5C/g, '\\');
          }
          // Ersätt %2F med / om det fortfarande finns kvar (extra säkerhet)
          filePath = filePath.replace(/%2F/g, '/');

          if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
            console.log('[useMediaUrl] Anropar readFile med sökväg:', filePath);
            const fileData = await window.electronAPI.readFile(filePath);
            console.log('[useMediaUrl] readFile svar:', fileData?.error ? { error: fileData.error } : 'Success (data received)');

            if (fileData && !fileData.error) {
              // readFile returnerar data på olika sätt - hantera alla fall
              let uint8Array;

              if (fileData instanceof ArrayBuffer) {
                uint8Array = new Uint8Array(fileData);
              } else if (fileData instanceof Uint8Array) {
                uint8Array = fileData;
              } else if (fileData.data) {
                if (fileData.data instanceof Uint8Array) {
                  uint8Array = fileData.data;
                } else if (fileData.data instanceof ArrayBuffer) {
                  uint8Array = new Uint8Array(fileData.data);
                } else if (Array.isArray(fileData.data)) {
                  uint8Array = new Uint8Array(fileData.data);
                } else {
                  uint8Array = new Uint8Array(fileData.data);
                }
              } else if (Array.isArray(fileData)) {
                uint8Array = new Uint8Array(fileData);
              } else if (typeof fileData === 'string') {
                const binaryString = atob(fileData);
                uint8Array = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  uint8Array[i] = binaryString.charCodeAt(i);
                }
              } else {
                try {
                  uint8Array = new Uint8Array(fileData);
                } catch (e) {
                  console.error('[useMediaUrl] Could not convert fileData to Uint8Array:', e);
                  throw new Error('Kunde inte konvertera bilddata');
                }
              }

              // Bestäm MIME-typ baserat på filändelse
              const ext = (filePath || url).split('.').pop()?.toLowerCase() || 'png';
              const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp'
              };
              const mimeType = mimeTypes[ext] || 'image/png';

              const blob = new Blob([uint8Array], { type: mimeType });
              const newBlobUrl = URL.createObjectURL(blob);
              blobUrlRef.current = newBlobUrl; // Spara i ref för cleanup
              setBlobUrl(newBlobUrl);
              setLoading(false);
              setError(null);
            } else {
              throw new Error(fileData?.error || 'Kunde inte läsa filen');
            }
          } else {
            throw new Error('Electron API är inte tillgänglig');
          }
        } catch (err) {
          console.error('[useMediaUrl] Error loading media:// URL:', err);
          setError(err.message || 'Kunde inte ladda bilden');
          setLoading(false);
          setBlobUrl(null);
        }
      };

      loadMediaUrl();

      // Cleanup: Rensa blob URL när komponenten unmountas eller URL ändras
      return () => {
        // Rensa blob URL om den finns (använd ref för att komma åt senaste värdet)
        if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    } else {
      // För andra URL-typer, använd direkt
      blobUrlRef.current = null; // Ingen blob URL att rensa
      setBlobUrl(url);
      setLoading(false);
      setError(null);
    }
  }, [url]);

  return { blobUrl, loading, error };
}

