// Helper utilities for string normalization
export function normalizeString(input) {
  if (input === null || input === undefined) return '';
  try {
    // Normalize to NFD, strip diacritics, lowercase, remove some punctuation and collapse whitespace
    return String(input)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[.,\/()\-\u2013\u2014]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  } catch (e) {
    // Fallback for older environments without Unicode property escapes
    return String(input)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,\/()\-\u2013\u2014]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}

export default normalizeString;
