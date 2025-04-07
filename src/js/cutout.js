const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const cutoutImage = document.getElementById('cutoutImage');
  const loadingIndicator = document.getElementById('loadingIndicator');
  
  // Prepare canvas for transparency detection
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  let isDragging = false;
  let startX, startY;
  
  // Receive cutout data from main process
  ipcRenderer.on('set-cutout', (event, cutoutData) => {
    cutoutImage.src = `file://${cutoutData.path}`;
    document.title = cutoutData.name;
    
    cutoutImage.onload = () => {
      loadingIndicator.style.display = 'none';
      
      // Set up canvas for transparency detection
      canvas.width = cutoutImage.naturalWidth;
      canvas.height = cutoutImage.naturalHeight;
      ctx.drawImage(cutoutImage, 0, 0);
    };
    
    cutoutImage.onerror = () => {
      loadingIndicator.textContent = 'Error loading image';
    };
  });
  
  // Mouse event handling
  cutoutImage.addEventListener('mousedown', (e) => {
    // Get the cursor position within the image
    const rect = cutoutImage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if we're clicking on a transparent pixel
    if (isTransparentAt(x, y)) {
      return; // Don't start dragging on transparent pixels
    }
    
    // Store the starting point of the drag
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    e.preventDefault();
    
    // Tell the main process we're starting to drag
    ipcRenderer.send('cutout-drag-start');
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    // Calculate movement delta
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    // Send the movement to the main process
    ipcRenderer.send('cutout-drag-move', { dx, dy });
    
    // Update starting point for next move
    startX = e.clientX;
    startY = e.clientY;
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      ipcRenderer.send('cutout-drag-end');
    }
  });
  
  // Close window on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ipcRenderer.send('cutout-close');
    }
  });
  
  // Helper function to check if a pixel is transparent
  function isTransparentAt(x, y) {
    if (!ctx) return true;
    
    // Scale coordinates to match the actual image size
    const rect = cutoutImage.getBoundingClientRect();
    const scaleX = cutoutImage.naturalWidth / rect.width;
    const scaleY = cutoutImage.naturalHeight / rect.height;
    
    const pixelX = Math.floor(x * scaleX);
    const pixelY = Math.floor(y * scaleY);
    
    // Boundary check
    if (pixelX < 0 || pixelY < 0 || 
        pixelX >= cutoutImage.naturalWidth || 
        pixelY >= cutoutImage.naturalHeight) {
      return true;
    }
    
    try {
      const pixelData = ctx.getImageData(pixelX, pixelY, 1, 1).data;
      const alpha = pixelData[3];
      return alpha < 50; // Consider pixels with alpha < 50 as transparent
    } catch (e) {
      console.error('Error checking transparency:', e);
      return false;
    }
  }
});