# Cutout Previewer

A specialized desktop application built with Electron that allows users (primarily in architectural visualization) to overlay PNG cutouts of people, trees, or other objects onto their screen for visualization purposes.

## Features

- **Clean Single-Window Interface**
  - Simple control window for selecting folders and managing cutouts
  - Spawn separate windows for each cutout

- **Folder Management**
  - Select folders containing PNG cutouts
  - Remember last selected folder between sessions

- **Cutout Management**
  - Display thumbnails of available cutouts
  - Click on a cutout to spawn a dedicated transparent window

- **Pixel-Perfect Dragging**
  - Detect transparent pixels in PNG images
  - Only allow dragging when clicking on non-transparent parts
  - Prevent accidental movement when clicking on transparent areas

## Usage

1. Launch the application
2. Select a folder containing PNG images using the "Select PNG Folder" button
3. Click on any cutout thumbnail to create a transparent window with that image
4. Drag the cutout window by clicking and dragging on non-transparent parts of the image
5. Press Escape to close a cutout window

## Technical Implementation

- Leverages Electron's transparent windows
- Uses HTML5 Canvas API for transparency detection
- Implements proper window management
- Inter-Process Communication (IPC) for window coordination

## Development

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/Brovar64/cutout-previewer.git
   cd cutout-previewer
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the application:
   ```
   npm start
   ```

### Building Distributables

To build the application for your platform:

```
npm run build
```

## License

MIT