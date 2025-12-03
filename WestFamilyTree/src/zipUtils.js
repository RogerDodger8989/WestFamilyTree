// zipUtils.js
// Utilities for zipping/unzipping files in Electron renderer
import JSZip from 'jszip';

export async function createZipFromData(dbData, imageFolder, otherImagesFolder) {
  const zip = new JSZip();
  // Add database JSON
  zip.file('database.json', JSON.stringify(dbData, null, 2));
  // Add images from folders
  const addImagesFromFolder = async (folder, zipPath) => {
    if (!window.electronAPI || !window.electronAPI.readDir) return;
    const files = await window.electronAPI.readDir(folder);
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
        const data = await window.electronAPI.readFile(`${folder}/${file}`);
        zip.file(`${zipPath}/${file}`, data);
      }
    }
  };
  await addImagesFromFolder(imageFolder, 'kallor');
  await addImagesFromFolder(otherImagesFolder, 'diverse');
  return zip.generateAsync({ type: 'uint8array' });
}

export async function extractZipToFolders(zipData, imageFolder, otherImagesFolder, setDbData) {
  const zip = await JSZip.loadAsync(zipData);
  // Extract database
  const dbText = await zip.file('database.json').async('string');
  setDbData(JSON.parse(dbText));
  // Extract images
  for (const relPath in zip.files) {
    if (relPath.startsWith('kallor/') || relPath.startsWith('diverse/')) {
      const fileData = await zip.files[relPath].async('uint8array');
      const outFolder = relPath.startsWith('kallor/') ? imageFolder : otherImagesFolder;
      const outPath = `${outFolder}/${relPath.split('/')[1]}`;
      if (window.electronAPI && window.electronAPI.saveFile) {
        window.electronAPI.saveFile(outPath, fileData);
      }
    }
  }
}
