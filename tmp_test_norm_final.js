const places = [
    { name: "Löderups" }, // Bad match
    { name: "Löderup (M)" }, // Good match (with county code)
    { name: "Borrby (L)" }
];

function normalizeArchiveTitle(rawArchive, places = []) {
  if (!rawArchive || typeof rawArchive !== 'string') return rawArchive;
  const cleanNameMatch = rawArchive.match(/^(.+?)\s+kyrkoarkiv(?:[,\s]+|$)/i);
  if (!cleanNameMatch) return rawArchive;
  const baseName = cleanNameMatch[1].trim();
  const searchTerms = [baseName.toLowerCase()];
  if (baseName.toLowerCase().endsWith('s')) {
      searchTerms.push(baseName.slice(0, -1).toLowerCase());
  }
  if (places && Array.isArray(places) && places.length > 0) {
    const sortedPlaces = [...places].sort((a, b) => {
        const aName = a.name || "";
        const bName = b.name || "";
        const aHasParen = aName.includes(' (');
        const bHasParen = bName.includes(' (');
        if (aHasParen && !bHasParen) return -1;
        if (!aHasParen && bHasParen) return 1;
        return bName.length - aName.length;
    });
    for (const place of sortedPlaces) {
       if (place && place.name) {
           const pName = place.name.toLowerCase();
           for (const term of searchTerms) {
               if (pName === term || pName.startsWith(term + ' (')) {
                   return place.name;
               }
           }
       }
    }
  }
  return baseName; 
}

console.log("Input: Löderups kyrkoarkiv -> Result:", normalizeArchiveTitle("Löderups kyrkoarkiv", places));
