const { shell } = require('electron');

module.exports = function openImage(filePath) {
  shell.openPath(filePath);
};
