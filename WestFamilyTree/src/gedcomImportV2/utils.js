// GEDCOM Import V2 - Hjälpfunktioner
// Här samlas hjälpfunktioner för t.ex. datum, plats, koordinater, mm.

export function parseDateV2(dateString) {
  // TODO: Implementera avancerad datumhantering enligt instruktion
  return dateString;
}

export function parsePlaceV2(placeString) {
  // TODO: Spara i omvänd ordning med LAND sist
  return placeString;
}

export function parseLatLongV2(latString, longString) {
  // TODO: Konvertera N59.123/E18.123 till decimaltal
  return {
    lat: latString,
    long: longString
  };
}

export function mapQuayV2(quay) {
  // Mappa 0-3 till text och stjärnor
  const map = ["Osäker", "Frågasatt", "Andrahand", "Primär"];
  return map[parseInt(quay, 10)] || "Okänd";
}
