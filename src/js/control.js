const { ipcRenderer } = require('electron');
const path = require('path');

document.addEventListener('DOMContentLoaded', () => {
  const selectFolderButton = document.getElementById('selectFolder');
  const cutoutList = document.getElementById('cutoutList');
  
  selectFolderButton.addEventListener('click', () => {
    ipcRenderer.send('select-folder');
  });
  
  ipcRenderer.on('cutouts-updated', (event, cutouts) => {
    updateCutoutList(cutouts);
  });
  
  function updateCutoutList(cutouts) {
    // Clear the existing list
    cutoutList.innerHTML = '';
    
    if (!cutouts || cutouts.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No PNG files found in the selected folder';
      cutoutList.appendChild(emptyState);
      return;
    }
    
    // Debug log to see what we're getting
    console.log('Received cutouts:', cutouts);
    
    cutouts.forEach(cutout => {
      const cutoutItem = document.createElement('div');
      cutoutItem.className = 'cutout-item';
      
      const thumbnail = document.createElement('img');
      thumbnail.className = 'cutout-thumbnail';
      thumbnail.src = `file://${cutout.path}`;
      thumbnail.alt = cutout.name;
      
      const nameSpan = document.createElement('div');
      nameSpan.className = 'cutout-name';
      nameSpan.textContent = cutout.name;
      
      cutoutItem.appendChild(thumbnail);
      cutoutItem.appendChild(nameSpan);
      
      cutoutItem.addEventListener('click', () => {
        ipcRenderer.send('add-cutout', cutout.path);
      });
      
      cutoutList.appendChild(cutoutItem);
    });
  }
  
  // Request the initial list of cutouts when the app starts
  ipcRenderer.send('request-initial-cutouts');
});