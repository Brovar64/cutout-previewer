const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
const cutoutWindows = new Map(); // Keep track of cutout windows
let activeDragWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    title: 'Cutout Previewer',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    backgroundColor: '#222222'
  });

  mainWindow.loadFile(path.join(__dirname, 'main.html'));
  
  mainWindow.on('closed', () => {
    app.quit();
  });
}

function createCutoutWindow(cutoutPath, cutoutName) {
  const cutoutWindow = new BrowserWindow({
    width: 500,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  cutoutWindow.loadFile(path.join(__dirname, 'cutout.html'));
  
  // When window is ready, send the cutout path
  cutoutWindow.webContents.on('did-finish-load', () => {
    cutoutWindow.webContents.send('set-cutout', { path: cutoutPath, name: cutoutName });
  });
  
  // Store the window reference
  cutoutWindows.set(cutoutPath, cutoutWindow);
  
  cutoutWindow.on('closed', () => {
    cutoutWindows.delete(cutoutPath);
  });
  
  return cutoutWindow;
}

app.whenReady().then(() => {
  createMainWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
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
  const result = await dialog.showOpenDialog(mainWindow, {
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
      mainWindow.webContents.send('cutouts-updated', []);
      return;
    }
    
    fs.readdir(folderPath, (err, files) => {
      if (err) {
        console.error(`Error reading folder: ${err.message}`);
        mainWindow.webContents.send('cutouts-updated', []);
        return;
      }
      
      console.log(`Found ${files.length} files in folder`);
      
      const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
      console.log(`Found ${pngFiles.length} PNG files`);
      
      const cutouts = pngFiles.map(file => {
        return {
          name: file,
          path: path.join(folderPath, file)
        };
      });
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cutouts-updated', cutouts);
      }
    });
  } catch (error) {
    console.error(`Unexpected error scanning folder: ${error.message}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cutouts-updated', []);
    }
  }
}

ipcMain.on('show-cutout', (event, cutout) => {
  // Check if we already have a window for this cutout
  let cutoutWindow = cutoutWindows.get(cutout.path);
  
  if (!cutoutWindow || cutoutWindow.isDestroyed()) {
    cutoutWindow = createCutoutWindow(cutout.path, cutout.name);
  } else {
    cutoutWindow.focus();
  }
});

// Handle cutout window dragging
ipcMain.on('cutout-drag-start', (event) => {
  activeDragWindow = BrowserWindow.fromWebContents(event.sender);
});

ipcMain.on('cutout-drag-move', (event, delta) => {
  if (!activeDragWindow || activeDragWindow.isDestroyed()) return;
  
  const [x, y] = activeDragWindow.getPosition();
  activeDragWindow.setPosition(x + delta.dx, y + delta.dy);
});

ipcMain.on('cutout-drag-end', () => {
  activeDragWindow = null;
});

ipcMain.on('cutout-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

// Handle request for initial cutouts
ipcMain.on('request-initial-cutouts', (event) => {
  const lastFolder = store.get('lastFolder');
  if (lastFolder) {
    scanFolder(lastFolder);
  }
});