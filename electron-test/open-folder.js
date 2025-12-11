const { shell } = require('electron');
const path = require('path');

module.exports = (folderPath) => {
  if (!folderPath) return;
  // Gör om till absolut sökväg om det behövs
  const absPath = path.resolve(folderPath);
  shell.openPath(absPath);
};
