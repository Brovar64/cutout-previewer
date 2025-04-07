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
  
  // Don't set ignore mouse events initially so we can interact with the preview window
  previewWindow.setIgnoreMouseEvents(false);
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