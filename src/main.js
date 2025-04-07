const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
    title: 'Cutout Previewer',
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
}

function createPreviewWindow() {
  previewWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error(err);
      return;
    }
    
    const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
    cutouts = pngFiles.map(file => {
      return {
        name: file,
        path: path.join(folderPath, file)
      };
    });
    
    controlWindow.webContents.send('cutouts-updated', cutouts);
  });
}

ipcMain.on('add-cutout', (event, cutoutPath) => {
  previewWindow.webContents.send('add-cutout', cutoutPath);
});

// Listen for interactive regions updates from the renderer
ipcMain.on('update-interactive-region', (event, region) => {
  if (!previewWindow) return;
  
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