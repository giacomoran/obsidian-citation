# PDF Citation Navigator

Adds a back button to PDFs that appears when you click on internal links (citations), allowing you to easily return to where you were reading.

## Installation

### Manual Installation

1. Clone or download this plugin to your vault's plugins folder:

   ```
   [Your Vault]/.obsidian/plugins/pdf-citation-navigator/
   ```

2. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

3. Enable the plugin in Obsidian Settings → Community Plugins

### Development

For hot reload during development:

```bash
npm run dev
```

## Usage

Click any internal PDF link (citation, reference, etc.) and a back button will appear in the top-right corner to return to your previous position.

## Limitations

- Works only with Obsidian's built-in PDF viewer
- Desktop only (not compatible with mobile apps)
- Supports internal links only (not external URLs)

## License

[MIT License](LICENSE)
