const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const previewContainer = document.getElementById('previewContainer');
  let activeCutout = null;
  let cutouts = [];
  let lastZIndex = 1;
  
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  // Create an initial instructions element
  const instructionsElement = document.createElement('div');
  instructionsElement.id = 'instructions';
  instructionsElement.className = 'instructions';
  instructionsElement.innerHTML = `
    <h2>Cutout Previewer</h2>
    <p>This is the transparent preview window.</p>
    <p>Select PNG cutouts from the control window to display them here.</p>
    <ul>
      <li><strong>Drag:</strong> Move cutouts by clicking and dragging</li>
      <li><strong>Scroll:</strong> Resize cutouts</li>
      <li><strong>M key:</strong> Mirror cutout horizontally</li>
      <li><strong>W key:</strong> Remove cutout</li>
    </ul>
  `;
  previewContainer.appendChild(instructionsElement);
  
  ipcRenderer.on('add-cutout', (event, cutoutPath) => {
    instructionsElement.style.display = 'none';
    addCutout(cutoutPath);
  });
  
  function addCutout(cutoutPath) {
    const cutoutId = `cutout-${Date.now()}`;
    
    const cutoutElement = document.createElement('div');
    cutoutElement.className = 'cutout';
    cutoutElement.id = cutoutId;
    cutoutElement.dataset.path = cutoutPath;
    cutoutElement.style.zIndex = lastZIndex++;
    cutoutElement.style.left = '50%';
    cutoutElement.style.top = '50%';
    cutoutElement.style.transform = 'translate(-50%, -50%) scale(1)';
    
    const img = document.createElement('img');
    img.src = `file://${cutoutPath}`;
    img.draggable = false;
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = 'Loading...';
    
    cutoutElement.appendChild(loadingIndicator);
    cutoutElement.appendChild(img);
    previewContainer.appendChild(cutoutElement);
    
    const cutout = {
      id: cutoutId,
      element: cutoutElement,
      img: img,
      path: cutoutPath,
      scale: 1,
      isFlipped: false,
      canvas: null,
      ctx: null
    };
    
    cutouts.push(cutout);
    
    img.onload = () => {
      loadingIndicator.remove();
      prepareTransparencyDetection(cutout);
      setActiveCutout(cutout);
    };
    
    img.onerror = () => {
      loadingIndicator.textContent = 'Error loading image';
      console.error(`Failed to load image: ${cutoutPath}`);
    };
    
    setupCutoutEventListeners(cutout);
  }
  
  function prepareTransparencyDetection(cutout) {
    cutout.canvas = document.createElement('canvas');
    cutout.ctx = cutout.canvas.getContext('2d', { willReadFrequently: true });
    cutout.canvas.width = cutout.img.naturalWidth;
    cutout.canvas.height = cutout.img.naturalHeight;
    cutout.ctx.drawImage(cutout.img, 0, 0);
  }
  
  function setupCutoutEventListeners(cutout) {
    cutout.element.addEventListener('mousedown', (e) => {
      setActiveCutout(cutout);
      
      const rect = cutout.element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (isTransparentAt(cutout, x, y)) {
        return;
      }
      
      isDragging = true;
      dragOffsetX = x;
      dragOffsetY = y;
      
      e.preventDefault();
    });
    
    cutout.element.addEventListener('wheel', (e) => {
      if (activeCutout === cutout) {
        e.preventDefault();
        
        const scaleChange = e.deltaY > 0 ? 0.95 : 1.05;
        cutout.scale *= scaleChange;
        
        updateCutoutTransform(cutout);
      }
    });
  }
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging && activeCutout) {
      const left = e.clientX - dragOffsetX;
      const top = e.clientY - dragOffsetY;
      
      activeCutout.element.style.left = `${left}px`;
      activeCutout.element.style.top = `${top}px`;
      activeCutout.element.style.transform = getTransformString(activeCutout);
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
  
  document.addEventListener('keydown', (e) => {
    if (!activeCutout) return;
    
    if (e.key.toLowerCase() === 'm') {
      activeCutout.isFlipped = !activeCutout.isFlipped;
      updateCutoutTransform(activeCutout);
    } else if (e.key.toLowerCase() === 'w') {
      removeCutout(activeCutout);
    }
  });
  
  function isTransparentAt(cutout, x, y) {
    if (!cutout.canvas || !cutout.ctx) return false;
    
    const scaledX = Math.floor(x / cutout.scale);
    const scaledY = Math.floor(y / cutout.scale);
    
    let pixelX = cutout.isFlipped 
      ? cutout.canvas.width - scaledX - 1 
      : scaledX;
    
    pixelX = Math.max(0, Math.min(cutout.canvas.width - 1, pixelX));
    const pixelY = Math.max(0, Math.min(cutout.canvas.height - 1, scaledY));
    
    try {
      const pixelData = cutout.ctx.getImageData(pixelX, pixelY, 1, 1).data;
      const alpha = pixelData[3];
      return alpha < 50;
    } catch (e) {
      console.error('Error checking transparency:', e);
      return false;
    }
  }
  
  function setActiveCutout(cutout) {
    if (activeCutout) {
      activeCutout.element.classList.remove('active');
    }
    
    activeCutout = cutout;
    activeCutout.element.classList.add('active');
    activeCutout.element.style.zIndex = lastZIndex++;
  }
  
  function updateCutoutTransform(cutout) {
    cutout.element.style.transform = getTransformString(cutout);
  }
  
  function getTransformString(cutout) {
    const flipValue = cutout.isFlipped ? -1 : 1;
    return `scale(${cutout.scale * flipValue}, ${cutout.scale})`;
  }
  
  function removeCutout(cutout) {
    const index = cutouts.findIndex(c => c.id === cutout.id);
    if (index !== -1) {
      cutout.element.remove();
      cutouts.splice(index, 1);
      
      if (cutouts.length > 0) {
        setActiveCutout(cutouts[cutouts.length - 1]);
      } else {
        activeCutout = null;
        // Show instructions again when all cutouts are removed
        instructionsElement.style.display = 'block';
      }
    }
  }
});