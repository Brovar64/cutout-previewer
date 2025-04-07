# Cutout Previewer

A specialized desktop application built with Electron that allows users (primarily in architectural visualization) to overlay PNG cutouts of people, trees, or other objects onto their screen for visualization purposes.

## Features

- **Multiple Window System**
  - Control window for managing cutouts and selecting folders
  - Transparent preview window for displaying and manipulating cutouts

- **Folder Management**
  - Select folders containing PNG cutouts
  - Remember last selected folder between sessions

- **Cutout Management**
  - Display thumbnails of available cutouts
  - Add cutouts to the preview window with a click
  - Support for multiple simultaneous cutouts

- **Pixel-Perfect Dragging**
  - Detect transparent pixels in PNG images
  - Only allow dragging when clicking on non-transparent parts
  - Prevent accidental movement when clicking on transparent areas
  - Enhanced with Electron's setIgnoreMouseEvents with region forwarding

- **Image Manipulation**
  - **Dragging**: Move cutouts by clicking and dragging non-transparent areas
  - **Scaling**: Use mouse wheel to resize cutouts
  - **Mirroring**: Press 'M' key to horizontally flip cutouts
  - **Removal**: Press 'W' key to remove cutouts from screen
  - **Z-indexing**: Automatically brings cutouts to front when clicked

## Technical Implementation

The application uses advanced techniques to handle transparency:

- Leverages Electron's `setIgnoreMouseEvents()` with `forward` option
- Creates interactive hit regions that match non-transparent areas of PNGs
- Updates interactive regions dynamically when dragging, scaling, or flipping
- Uses canvas to detect transparent pixels in PNG images
- Advanced region-based mouse event handling

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