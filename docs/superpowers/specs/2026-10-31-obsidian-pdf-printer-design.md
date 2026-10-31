# Obsidian PDF Printer – Design

## Intent
p2kkx verteilt Notizen an andere Personen. Dafür braucht er ein Obsidian-Plugin, das
eine Notiz oder einen ganzen Ordner als PDF ausgibt, primär auf **Android** (Obsidian
Mobile). Die PDF wird anschließend geteilt (Mail, Messenger).

## Goals
- Notiz oder Ordner (inkl. Unterordner) als eine PDF ausgeben.
- Einstellung: **Jede Notiz beginnt auf neuer Seite** (an/aus). Aus = Notizen werden
  direkt untereinander gesetzt.
- Dargestellt werden: Text, Überschriften, Bilder, Checklisten (Priorität). Tabellen,
  Einbettungen anderer Notizen, Code etc. sollen mitgerendert werden, haben aber keine
  Priorität.
- PDF ist **immer hell** (weißer Hintergrund, dunkle Schrift), unabhängig vom aktiven
  Obsidian-Theme (p2kkx nutzt Darkmode).
- Nur der Inhalt wird gedruckt: **kein Dateiname als Überschrift**, **kein Frontmatter**.
- Ordnerreihenfolge: erst Notizen im gewählten Ordner, dann Unterordner alphabetisch
  (jeweils rekursiv nach derselben Regel). Notizen innerhalb eines Ordners: alphabetisch
  (Annahme, siehe unten).
- Beim Drucken eines Ordners: optionaler Dialog, in dem die Reihenfolge manuell
  geändert werden kann („Zusatz, falls der Aufwand überschaubar bleibt").
- Nach der Erzeugung: PDF im Vault speichern und das Android-Teilen-Menü öffnen
  (Annahme von Claude, von p2kkx nicht widersprochen).

## Non-Goals
- Kein Extra-Aufwand für Desktop. Es darf dort laufen, wenn es ohne Mehraufwand geht;
  es wird dafür nichts getestet oder optimiert.
- Keine Dateinamen-Überschriften, kein Inhaltsverzeichnis, keine Kopf-/Fußzeilen
  (nicht gewünscht, nicht besprochen).

## Anti-Goals
- Dunkle PDF oder dunkles Theme in der PDF.
- Ein Plugin, das auf Android nicht läuft (Desktop-only-APIs wie Electron `printToPDF`,
  Node-`fs`).

## Constraints
- Obsidian Mobile/Android: kein Electron, kein Node. Nur Obsidian-API und Browser/
  WebView-APIs.
- Plugin muss `isDesktopOnly: false` setzen.

## Entscheidungen von p2kkx
- Einstellbar: neue Seite pro Notiz vs. untereinander.
- Reihenfolge Ordner: Hauptordner zuerst, dann Unterordner alphabetisch.
- Reihenfolgen-Menü beim Drucken: gewünscht, wenn nicht zu aufwändig.
- Nur Inhalt, kein Dateiname als Überschrift.
- Immer helles PDF.

## Claude-Entscheidungen (p2kkx kann widersprechen)
- **Rendering:** Obsidians `MarkdownRenderer` rendert die Notizen zu HTML, damit die
  Darstellung der App entspricht. Die Ausgabe wird in einem Container mit festem
  hellen Stylesheet gerendert, sodass Theme-Variablen die Farben nicht beeinflussen.
- **PDF-Erzeugung:** direkt im Plugin per JavaScript-Bibliothek (Kandidaten: jsPDF +
  html2canvas oder html2pdf.js; pdfmake würde eigenes Layout statt HTML-Render
  bedeuten). Wahl und Prüfung, ob der Text markierbar bleibt, erfolgt vor der
  Implementierung; Ergebnis wird p2kkx mitgeteilt.
- **Start:** Kontextmenü auf Datei/Ordner (Langdruck) plus Befehlspalette
  (aktive Notiz).
- **Format:** A4, normale Ränder.
- **Ablage:** PDF im Vault (Ordner und Namensschema: Builder entscheidet, Vorschlag:
  neben der Notiz bzw. im Ordner, Name = Notiz-/Ordnername).
- **Sortierung innerhalb eines Ordners:** alphabetisch nach Dateiname.
- **Einstellungen:** Settings-Tab mit dem Schalter „Neue Seite pro Notiz".
  Der Schalter kann zusätzlich im Reihenfolgen-Dialog angezeigt werden.

## Antworten von p2kkx nach Builder-Check
- Text in der PDF **muss markierbar sein** → kein Screenshot-Ansatz (html2canvas).
  Stattdessen: gerendertes DOM wird in eine pdfmake-Dokumentdefinition übersetzt
  (echter Text, eingebettete Bilder).
- Typischer Umfang: ca. 5 Notizen, wenige Bilder → keine Chunking-Architektur nötig.

## Weitere Claude-Entscheidungen
- Teilen: `navigator.share` mit Datei; Fallback: Notice mit Pfad + `openWithDefaultApp`.
  Best-effort, auf echtem Gerät zu prüfen.
- Nur `.md`-Dateien, `.`-Ordner übersprungen, Sortierung case-insensitive natürlich.
- Existierende PDF wird überschrieben. Ablage: Vault-Wurzel-Ordner der Notiz bzw.
  Elternordner des gedruckten Ordners (nicht innerhalb), Name = Notiz-/Ordnername.pdf.
- Nicht darstellbare Inhalte (Dataview, Mermaid, Canvas, Audio, PDF-Embeds): still
  übersprungen; Wikilinks als normaler Text.
- Reihenfolge-Dialog erscheint bei jedem Ordner-Druck, ohne Persistenz, mit Schalter
  „Neue Seite pro Notiz".

## Dem Builder überlassen
- Konkrete Bibliothek, Seitenumbruch-Logik (Bilder und Überschriften nicht zerreißen),
  Bildgrößenanpassung, Umgang mit sehr großen Ordnern (Speicher auf Mobile),
  Fortschrittsanzeige, Fehlerbehandlung, Aufbau des Reihenfolgen-Dialogs.
