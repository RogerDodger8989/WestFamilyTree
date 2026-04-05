export const toValidPercent = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
};

export const normalizeFaceTagRect = (faceTag) => {
  if (!faceTag || typeof faceTag !== 'object') return null;
  const x = toValidPercent(faceTag.x, 0);
  const y = toValidPercent(faceTag.y, 0);
  const w = toValidPercent(faceTag.w ?? faceTag.width, 0);
  const h = toValidPercent(faceTag.h ?? faceTag.height, 0);
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
};

export const findFaceTagForPerson = (mediaItem, personId) => {
  if (!mediaItem || !personId) return null;
  const faces = Array.isArray(mediaItem.faces)
    ? mediaItem.faces
    : (Array.isArray(mediaItem.regions) ? mediaItem.regions : []);

  const directHit = faces.find((face) => String(face?.personId ?? '') === String(personId ?? ''));
  return normalizeFaceTagRect(directHit);
};

export const getAvatarImageStyle = (mediaItem, personId) => {
  const faceRect = findFaceTagForPerson(mediaItem, personId);
  if (!faceRect) return undefined;

  const centerX = Math.max(0, Math.min(100, faceRect.x + faceRect.w / 2));
  const centerY = Math.max(0, Math.min(100, faceRect.y + faceRect.h / 2));
  const dominantSize = Math.max(faceRect.w, faceRect.h);
  const zoom = Math.min(40, 150 / Math.max(dominantSize, 0.5));

  return {
    objectFit: 'cover',
    objectPosition: `${centerX}% ${centerY}%`,
    transformOrigin: `${centerX}% ${centerY}%`,
    transform: `scale(${zoom})`
  };
};
