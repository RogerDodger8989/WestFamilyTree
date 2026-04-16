// Kopierar Leaflet-ikoner från node_modules till public/
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../node_modules/leaflet/dist/images');
const destDir = path.join(__dirname, '../public');

const files = [
  'marker-icon.png',
  'marker-icon-2x.png',
  'marker-shadow.png'
];

for (const file of files) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Kopierade ${file} till public/`);
  } else {
    console.warn(`Filen ${file} hittades inte i ${srcDir}`);
  }
}
