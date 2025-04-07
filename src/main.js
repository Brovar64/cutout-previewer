const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();

let controlWindow = null;
let previewWindow = null;
let cutouts = [];

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 400,
    height: 600,
    title: 'Cutout Previewer - Controls',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#222222'
  });

  controlWindow.loadFile(path.join(__dirname, 'control.html'));
  
  controlWindow.on('closed', () => {
    app.quit();
  });
  
  // Prevent accidental closing
  controlWindow.on('close', (e) => {
    const choice = dialog.showMessageBoxSync(controlWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Confirm',
      message: 'Are you sure you want to quit?'
    });
    
    if (choice === 1) {
      e.preventDefault();
    }
  });
}

function createPreviewWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  previewWindow = new BrowserWindow({
    width: Math.min(1000, width),
    height: Math.min(800, height),
    x: Math.floor(width * 0.1),  // Position to the right of control window
    y: Math.floor(height * 0.1),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  previewWindow.loadFile(path.join(__dirname, 'preview.html'));
  
  // Set ignore mouse events with forwarding
  // This allows clicks to pass through transparent areas
  // while still capturing events on non-transparent areas
  previewWindow.setIgnoreMouseEvents(true, { forward: true });
  
  // Add visual indicator to preview window when loaded
  previewWindow.webContents.on('did-finish-load', () => {
    previewWindow.webContents.send('show-initial-instructions');
  });
}

app.whenReady().then(() => {
  createControlWindow();
  createPreviewWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
      createPreviewWindow();
    }
  });
  
  // Load cutouts from the last folder if it exists
  const lastFolder = store.get('lastFolder');
  if (lastFolder) {
    scanFolder(lastFolder);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('select-folder', async () => {
  const result = await dialog.showOpenDialog(controlWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    const folderPath = result.filePaths[0];
    store.set('lastFolder', folderPath);
    scanFolder(folderPath);
  }
});

function scanFolder(folderPath) {
  try {
    console.log(`Scanning folder: ${folderPath}`);
    
    if (!fs.existsSync(folderPath)) {
      console.error(`Folder does not exist: ${folderPath}`);
      controlWindow.webContents.send('cutouts-updated', []);
      return;
    }
    
    fs.readdir(folderPath, (err, files) => {
      if (err) {
        console.error(`Error reading folder: ${err.message}`);
        controlWindow.webContents.send('cutouts-updated', []);
        return;
      }
      
      console.log(`Found ${files.length} files in folder`);
      
      const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
      console.log(`Found ${pngFiles.length} PNG files`);
      
      cutouts = pngFiles.map(file => {
        return {
          name: file,
          path: path.join(folderPath, file)
        };
      });
      
      if (controlWindow && !controlWindow.isDestroyed()) {
        controlWindow.webContents.send('cutouts-updated', cutouts);
      }
    });
  } catch (error) {
    console.error(`Unexpected error scanning folder: ${error.message}`);
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('cutouts-updated', []);
    }
  }
}

ipcMain.on('add-cutout', (event, cutoutPath) => {
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.webContents.send('add-cutout', cutoutPath);
  }
});

// Handle request for initial cutouts
ipcMain.on('request-initial-cutouts', (event) => {
  if (cutouts.length > 0) {
    event.sender.send('cutouts-updated', cutouts);
  }
});

// Listen for interactive regions updates from the renderer
ipcMain.on('update-interactive-region', (event, region) => {
  if (!previewWindow || previewWindow.isDestroyed()) return;
  
  // If we receive an empty region, reset to click-through mode
  if (!region || region.width === 0 || region.height === 0) {
    previewWindow.setIgnoreMouseEvents(true, { forward: true });
    return;
  }
  
  // Otherwise, use the specified region
  previewWindow.setIgnoreMouseEvents(true, { 
    forward: true,
    // Define the region where mouse events are not ignored
    region: {
      x: Math.floor(region.x),
      y: Math.floor(region.y),
      width: Math.ceil(region.width),
      height: Math.ceil(region.height)
    }
  });
});