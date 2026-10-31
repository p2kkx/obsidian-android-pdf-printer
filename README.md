# Multi-Note PDF Printer for Obsidian

Print a note or a whole folder to a single PDF – works on **Obsidian Mobile (Android)**, no Electron or Node required.

## Features
- Long-press / right-click a note or folder in the file explorer → **Print to PDF** / **Print folder to PDF**
- Command palette: *Print active note to PDF*, *Print folder of active note to PDF*
- Setting **Start each note on a new page** (on/off; also available in the folder dialog)
- Folder order: notes of the folder first, then subfolders alphabetically; reorder manually in the dialog before printing
- Always a light PDF (independent of dark mode), text is selectable
- Supports headings, text formatting, images, task lists, lists, tables, quotes, code, callouts
- Frontmatter and file names are not printed
- The PDF is saved in your vault (next to the note, or next to the printed folder) and the system share sheet is opened if available

Not supported: Dataview, Mermaid, embedded PDFs/audio/video/canvas (skipped).

## Installation (manual)
Copy `main.js`, `manifest.json` and `styles.css` to `<Vault>/.obsidian/plugins/multi-note-pdf-printer/` and enable the plugin.

## Build
`docker run --rm -v "$PWD":/app -w /app node:22-alpine sh -c "npm install && npm run build"`

## License
MIT. Bundled third-party components: see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

---

## Kurzfassung (Deutsch)
Druckt eine Notiz oder einen ganzen Ordner als eine PDF – auch auf Android. Per Langdruck auf Notiz/Ordner → „Print to PDF“. Einstellbar: neue Seite pro Notiz oder alles untereinander. Die PDF ist immer hell, der Text markierbar.
