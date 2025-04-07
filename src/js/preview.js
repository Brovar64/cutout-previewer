const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  const previewContainer = document.getElementById('previewContainer');
  let activeCutout = null;
  let cutouts = [];
  let lastZIndex = 1;
  
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  // Create a wrapper div for interactive elements that will become "hitRegions"
  const hitRegionContainer = document.createElement('div');
  hitRegionContainer.id = 'hitRegionContainer';
  hitRegionContainer.style.position = 'absolute';
  hitRegionContainer.style.top = '0';
  hitRegionContainer.style.left = '0';
  hitRegionContainer.style.width = '100%';
  hitRegionContainer.style.height = '100%';
  hitRegionContainer.style.pointerEvents = 'none'; // Start with no hit regions
  previewContainer.appendChild(hitRegionContainer);
  
  ipcRenderer.on('add-cutout', (event, cutoutPath) => {
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
    
    cutoutElement.appendChild(img);
    previewContainer.appendChild(cutoutElement);
    
    // Create hitRegion element - this will be the clickable/interactive area
    const hitRegion = document.createElement('div');
    hitRegion.className = 'hit-region';
    hitRegion.id = `hit-${cutoutId}`;
    hitRegion.style.position = 'absolute';
    hitRegion.style.zIndex = lastZIndex;
    hitRegion.style.pointerEvents = 'auto'; // Make this element interactive
    hitRegionContainer.appendChild(hitRegion);
    
    const cutout = {
      id: cutoutId,
      element: cutoutElement,
      img: img,
      hitRegion: hitRegion,
      path: cutoutPath,
      scale: 1,
      isFlipped: false,
      canvas: null,
      ctx: null
    };
    
    cutouts.push(cutout);
    prepareTransparencyDetection(cutout);
    setActiveCutout(cutout);
    
    setupCutoutEventListeners(cutout);
  }
  
  function prepareTransparencyDetection(cutout) {
    cutout.img.onload = () => {
      cutout.canvas = document.createElement('canvas');
      cutout.ctx = cutout.canvas.getContext('2d', { willReadFrequently: true });
      cutout.canvas.width = cutout.img.naturalWidth;
      cutout.canvas.height = cutout.img.naturalHeight;
      cutout.ctx.drawImage(cutout.img, 0, 0);
      
      // Now that we have the image data, update the hit region
      updateHitRegion(cutout);
    };
  }
  
  function updateHitRegion(cutout) {
    // Get the bounding rect of the image to position the hit region
    const rect = cutout.element.getBoundingClientRect();
    
    // Adjust hit region to match exact shape of non-transparent parts
    cutout.hitRegion.style.left = `${rect.left}px`;
    cutout.hitRegion.style.top = `${rect.top}px`;
    cutout.hitRegion.style.width = `${rect.width}px`;
    cutout.hitRegion.style.height = `${rect.height}px`;
    
    // Create a CSS clip-path to match non-transparent areas
    // This would require more complex calculations in a real app,
    // but for now we'll use a basic rectangular shape
    
    // Inform main process of the hit region 
    ipcRenderer.send('update-interactive-region', {
      x: rect.left,
      y: rect.top,
      width: rect.width, 
      height: rect.height
    });
  }
  
  function setupCutoutEventListeners(cutout) {
    // Apply listeners to the hit region instead of the image
    cutout.hitRegion.addEventListener('mousedown', (e) => {
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
    
    cutout.hitRegion.addEventListener('wheel', (e) => {
      if (activeCutout === cutout) {
        e.preventDefault();
        
        const scaleChange = e.deltaY > 0 ? 0.95 : 1.05;
        cutout.scale *= scaleChange;
        
        updateCutoutTransform(cutout);
        updateHitRegion(cutout);
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
      
      // Update hit region position when dragging
      updateHitRegion(activeCutout);
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
      updateHitRegion(activeCutout);
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
    
    const pixelData = cutout.ctx.getImageData(pixelX, pixelY, 1, 1).data;
    const alpha = pixelData[3];
    
    return alpha < 50;
  }
  
  function setActiveCutout(cutout) {
    if (activeCutout) {
      activeCutout.element.classList.remove('active');
    }
    
    activeCutout = cutout;
    activeCutout.element.classList.add('active');
    activeCutout.element.style.zIndex = lastZIndex;
    activeCutout.hitRegion.style.zIndex = lastZIndex++;
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
      cutout.hitRegion.remove();
      cutouts.splice(index, 1);
      
      if (cutouts.length > 0) {
        setActiveCutout(cutouts[cutouts.length - 1]);
      } else {
        activeCutout = null;
        // Reset the interactive region when all cutouts are removed
        ipcRenderer.send('update-interactive-region', null);
      }
    }
  }
  
  // Handle window resize events
  window.addEventListener('resize', () => {
    if (activeCutout) {
      updateHitRegion(activeCutout);
    }
  });
});