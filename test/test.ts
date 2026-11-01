import { JSDOM } from "jsdom";
import { writeFileSync, mkdirSync } from "fs";
import { buildDoc, noteToContent, CONTENT_WIDTH } from "../src/convert";
import { makePdf } from "../src/pdf";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function note(html: string, imgs = true, title?: string) {
  const dom = new JSDOM(`<div id="r">${html}</div>`);
  const root = dom.window.document.getElementById("r");
  const images = new Map();
  if (imgs) for (const i of Array.from(root.querySelectorAll("img"))) images.set(i, { data: PNG, w: 400, h: 300 });
  return noteToContent(root, { images, maxW: CONTENT_WIDTH }, title);
}

const mk1 = () => note(`
<h1>Erste Notiz Titel</h1>
<p>Normaler Text mit <strong>fett</strong>, <em>kursiv</em>, <code>code</code> und <a href="https://example.com">Link</a>.<br>Zweite Zeile.</p>
<h2>Unterüberschrift</h2>
<ul class="contains-task-list">
<li class="task-list-item"><input type="checkbox" class="task-list-item-checkbox"> offene Aufgabe</li>
<li class="task-list-item is-checked" data-task="x"><input type="checkbox" class="task-list-item-checkbox" checked> erledigte Aufgabe</li>
</ul>
<ul><li>Punkt A<ul><li>Unterpunkt A1</li></ul></li><li>Punkt B</li></ul>
<ol><li>eins</li><li>zwei</li></ol>
<p><span class="internal-embed image-embed"><img src="x.png" width="200"></span></p>
<table><thead><tr><th>Spalte1</th><th>Spalte2</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>
<blockquote><p>Zitat Text</p></blockquote>
<pre><code>let x = 1;\n  indented</code></pre>
<hr>
<div class="callout"><div class="callout-title"><div class="callout-icon"><svg></svg></div><div class="callout-title-inner">Hinweis</div></div><div class="callout-content"><p>Callout Inhalt</p></div></div>
<p>Skip <span class="internal-embed" src="doc.pdf">PDFEMBED</span> Ende.</p>
`);
const mk2 = () => note(`<h1>Zweite Notiz</h1><p>Inhalt zwei.</p>`, true, "Zweite Notiz");
const mk3 = () => note(`<h1>Dritte Notiz</h1><p>Inhalt drei.</p>`, true, "Dateiname drei");

function assert(c: unknown, msg: string) { if (!c) throw new Error(msg); }
{
  const a = mk2();
  assert(a[0].text === "Zweite Notiz" && a[0].fontSize === 26, "Titel fehlt");
  assert(!a.slice(1).some((b) => b.headlineLevel === 1), "doppeltes H1 nicht entfernt");
  const b = mk3();
  assert(b[0].text === "Dateiname drei" && b[1].headlineLevel === 1, "abweichendes H1 muss bleiben");
}

async function main() {
  mkdirSync("test/out", { recursive: true });
  for (const [name, newPage] of [["newpage", true], ["inline", false]] as const) {
    const buf = await makePdf(buildDoc([mk1(), mk2(), mk3()], newPage));
    writeFileSync(`test/out/${name}.pdf`, Buffer.from(buf));
    console.log(name, buf.byteLength, "bytes");
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
