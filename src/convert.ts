// Wandelt das von Obsidian gerenderte DOM einer Notiz in pdfmake-Inhalt um.
// Bewusst unabhängig von der Obsidian-API, damit es mit jsdom testbar ist.

export interface ImgInfo {
  data: string; // data-URL (jpeg/png)
  w: number; // Pixel
  h: number;
}

export interface Ctx {
  images: Map<Element, ImgInfo>;
  maxW: number; // nutzbare Seitenbreite in pt
}

type C = any;

const SKIP_TAGS = new Set([
  "script", "style", "svg", "audio", "video", "iframe", "button", "canvas", "input", "object", "embed",
]);
const SKIP_CLASSES = [
  "frontmatter", "metadata-container", "copy-code-button", "collapse-indicator", "edit-block-button",
  "mermaid", "block-language-dataview", "block-language-dataviewjs", "internal-embed-pdf",
  "pdf-embed", "audio-embed", "video-embed", "canvas-embed", "callout-icon", "list-collapse-indicator",
  "footnote-backref",
];
const BLOCK_SELECTOR = "div,p,ul,ol,table,pre,blockquote,h1,h2,h3,h4,h5,h6,hr";
const INLINE_TAGS = new Set([
  "a", "span", "strong", "b", "em", "i", "del", "s", "u", "code", "kbd", "mark", "sub", "sup", "small", "br", "img", "label",
]);

function shouldSkip(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return true;
  for (const c of SKIP_CLASSES) if (el.classList.contains(c)) return true;
  // PDF-/Medien-Einbettungen anhand der Dateiendung
  if (el.classList.contains("internal-embed")) {
    const src = (el.getAttribute("src") || "").toLowerCase().split("#")[0];
    if (/\.(pdf|mp3|wav|ogg|m4a|flac|mp4|webm|mov|mkv|canvas)$/.test(src)) return true;
  }
  return false;
}

function isInlineEl(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (!INLINE_TAGS.has(tag)) return false;
  if (tag === "img" || tag === "br") return true;
  return !el.querySelector(BLOCK_SELECTOR);
}

// ---- Sammler für Fließtext + Bilder ---------------------------------------

class Acc {
  blocks: C[] = [];
  runs: C[] = [];
  constructor(private ctx: Ctx, private para: C) {}

  text(t: string, style: C) {
    if (t) this.runs.push({ text: t, ...style });
  }
  raw(run: C) {
    this.runs.push(run);
  }
  image(el: Element) {
    this.flush();
    const info = this.ctx.images.get(el);
    if (info) this.blocks.push(imageBlock(el, info, this.ctx));
  }
  flush() {
    const r = trimRuns(this.runs);
    this.runs = [];
    if (r.length) this.blocks.push({ text: r, ...this.para });
  }
  done(): C[] {
    this.flush();
    return this.blocks;
  }
}

function trimRuns(runs: C[]): C[] {
  const r = runs.map((x) => ({ ...x }));
  while (r.length && typeof r[0].text === "string" && r[0].text !== "\n") {
    r[0].text = r[0].text.replace(/^\s+/, "");
    if (r[0].text === "") r.shift();
    else break;
  }
  while (r.length && typeof r[r.length - 1].text === "string") {
    const last = r[r.length - 1];
    if (last.text === "\n") {
      r.pop();
      continue;
    }
    last.text = last.text.replace(/\s+$/, "");
    if (last.text === "") r.pop();
    else break;
  }
  return r;
}

function walkInline(node: Node, style: C, acc: Acc) {
  if (node.nodeType === 3) {
    acc.text((node.textContent || "").replace(/\s+/g, " "), style);
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  if (shouldSkip(el)) return;
  const tag = el.tagName.toLowerCase();
  let s = style;
  switch (tag) {
    case "br":
      acc.raw({ text: "\n" });
      return;
    case "img":
      acc.image(el);
      return;
    case "strong":
    case "b":
      s = { ...style, bold: true };
      break;
    case "em":
    case "i":
      s = { ...style, italics: true };
      break;
    case "del":
    case "s":
      s = { ...style, decoration: "lineThrough" };
      break;
    case "u":
      s = { ...style, decoration: "underline" };
      break;
    case "code":
    case "kbd":
      s = { ...style, fontSize: 9.5, background: "#eeeeee", color: "#333333" };
      break;
    case "mark":
      s = { ...style, background: "#fff3a3" };
      break;
    case "a": {
      const href = el.getAttribute("href") || "";
      if (/^(https?:|mailto:)/i.test(href) && !el.classList.contains("internal-link")) {
        s = { ...style, link: href, color: "#1a5fb4", decoration: "underline" };
      }
      break;
    }
  }
  for (const ch of Array.from(el.childNodes)) walkInline(ch, s, acc);
}

// ---- Bilder ----------------------------------------------------------------

function imageBlock(el: Element, info: ImgInfo, ctx: Ctx): C {
  let wpt = info.w * 0.75;
  let hpt = info.h * 0.75;
  const attr = parseFloat(el.getAttribute("width") || "");
  if (attr > 0) {
    const r = (attr * 0.75) / wpt;
    wpt *= r;
    hpt *= r;
  }
  const scale = Math.min(1, ctx.maxW / wpt, 680 / hpt);
  return { image: info.data, width: Math.max(1, wpt * scale), margin: [0, 2, 0, 8] };
}

// ---- Blöcke ----------------------------------------------------------------

export function blocksOf(parent: Node, ctx: Ctx, depth = 0): C[] {
  const acc = new Acc(ctx, { margin: [0, 0, 0, 6] });
  for (const n of Array.from(parent.childNodes)) {
    if (n.nodeType === 3) {
      walkInline(n, {}, acc);
      continue;
    }
    if (n.nodeType !== 1) continue;
    const el = n as Element;
    if (shouldSkip(el)) continue;
    if (isInlineEl(el)) {
      walkInline(el, {}, acc);
      continue;
    }
    acc.flush();
    acc.blocks.push(...blockFor(el, ctx, depth));
  }
  return acc.done();
}

const HEAD_SIZES = [22, 18, 15, 13, 12, 11];

function blockFor(el: Element, ctx: Ctx, depth: number): C[] {
  const tag = el.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const n = Number(tag[1]);
    const acc = new Acc(ctx, {
      fontSize: HEAD_SIZES[n - 1],
      bold: true,
      margin: [0, n === 1 ? 10 : 8, 0, 5],
      headlineLevel: n,
    });
    for (const ch of Array.from(el.childNodes)) walkInline(ch, {}, acc);
    return acc.done();
  }

  switch (tag) {
    case "p": {
      const acc = new Acc(ctx, { margin: [0, 0, 0, 6] });
      for (const ch of Array.from(el.childNodes)) walkInline(ch, {}, acc);
      return acc.done();
    }
    case "ul":
    case "ol":
      return [listBlock(el, ctx, tag === "ol", depth)];
    case "blockquote": {
      const inner = blocksOf(el, ctx, depth);
      return inner.length ? [{ stack: inner, margin: [12, 0, 0, 6], color: "#555555" }] : [];
    }
    case "pre": {
      const code = (el.textContent || "").replace(/\s+$/, "");
      if (!code) return [];
      return [{ text: code, fontSize: 8.5, preserveLeadingSpaces: true, background: "#f2f2f2", margin: [0, 0, 0, 8] }];
    }
    case "hr":
      return [{
        canvas: [{ type: "line", x1: 0, y1: 0, x2: ctx.maxW, y2: 0, lineWidth: 0.7, lineColor: "#bbbbbb" }],
        margin: [0, 6, 0, 10],
      }];
    case "table":
      return tableBlock(el, ctx);
    case "img": {
      const acc = new Acc(ctx, { margin: [0, 0, 0, 6] });
      acc.image(el);
      return acc.done();
    }
  }

  // div/section/Callouts/Einbettungen: Inhalt flach einsammeln
  const inner = blocksOf(el, ctx, depth);
  if (!inner.length) return [];
  if (el.classList.contains("callout-title")) return [{ stack: inner, bold: true }];
  if (el.classList.contains("callout")) return [{ stack: inner, margin: [10, 2, 0, 8], color: "#333333" }];
  return inner;
}

// ---- Listen ----------------------------------------------------------------

function checkboxSvg(checked: boolean): string {
  const tick = checked ? '<path d="M3 6.5 L5.5 9 L10 3.5" fill="none" stroke="#333" stroke-width="1.5"/>' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><rect x="0.5" y="0.5" width="11" height="11" rx="2" fill="none" stroke="#555" stroke-width="1"/>${tick}</svg>`;
}

function listBlock(el: Element, ctx: Ctx, ordered: boolean, depth: number): C {
  const items: C[] = [];
  let n = parseInt(el.getAttribute("start") || "1", 10);
  if (!(n >= 0)) n = 1;
  for (const li of Array.from(el.children)) {
    if (li.tagName.toLowerCase() !== "li") continue;
    const checkbox = li.querySelector(":scope > input[type=checkbox]") as HTMLInputElement | null;
    const isTask = li.classList.contains("task-list-item") || !!checkbox;
    const dataTask = li.getAttribute("data-task");
    const checked = !!(checkbox && (checkbox.checked || checkbox.hasAttribute("checked"))) ||
      li.classList.contains("is-checked") || (dataTask != null && dataTask !== "" && dataTask !== " ");

    const acc = new Acc(ctx, { margin: [0, 0, 0, 2] });
    const nested: C[] = [];
    for (const ch of Array.from(li.childNodes)) {
      if (ch.nodeType === 1) {
        const c = ch as Element;
        if (shouldSkip(c)) continue;
        const t = c.tagName.toLowerCase();
        if (t === "ul" || t === "ol") {
          acc.flush();
          nested.push(listBlock(c, ctx, t === "ol", depth + 1));
          continue;
        }
        if (!isInlineEl(c)) {
          acc.flush();
          acc.blocks.push(...blockFor(c, ctx, depth + 1));
          continue;
        }
      }
      walkInline(ch, {}, acc);
    }
    const content = acc.done().concat(nested);
    const body: C = content.length ? { stack: content } : { text: "" };

    let marker: C;
    if (isTask) marker = { svg: checkboxSvg(checked), width: 12, margin: [0, 2, 0, 0] };
    else if (ordered) marker = { text: `${n}.`, width: 18, alignment: "right" };
    else marker = { text: "•", width: 12, alignment: "center" };
    if (ordered) n++;

    items.push({
      columns: [marker, body],
      columnGap: isTask ? 6 : 4,
      margin: [0, 0, 0, 1],
    });
  }
  return { stack: items, margin: [depth > 0 ? 14 : 4, 0, 0, depth > 0 ? 2 : 6] };
}

// ---- Tabellen --------------------------------------------------------------

function tableBlock(el: Element, ctx: Ctx): C[] {
  const rows: C[][] = [];
  let headerRows = 0;
  for (const tr of Array.from(el.querySelectorAll("tr"))) {
    const isHead = !!tr.closest("thead");
    const cells: C[] = [];
    for (const cell of Array.from(tr.children)) {
      const t = cell.tagName.toLowerCase();
      if (t !== "td" && t !== "th") continue;
      const acc = new Acc(ctx, { margin: [0, 0, 0, 0] });
      for (const ch of Array.from(cell.childNodes)) walkInline(ch, isHead || t === "th" ? { bold: true } : {}, acc);
      const blocks = acc.done();
      cells.push(blocks.length === 0 ? "" : blocks.length === 1 ? blocks[0] : { stack: blocks });
    }
    if (cells.length) {
      rows.push(cells);
      if (isHead) headerRows++;
    }
  }
  if (!rows.length) return [];
  const cols = Math.max(...rows.map((r) => r.length));
  for (const r of rows) while (r.length < cols) r.push("");
  return [{
    table: { headerRows, widths: Array(cols).fill("*"), body: rows },
    layout: "lightHorizontalLines",
    margin: [0, 2, 0, 10],
  }];
}

export function noteToContent(root: Element, ctx: Ctx): C[] {
  return blocksOf(root, ctx);
}

// ---- Dokument --------------------------------------------------------------

export const PAGE_MARGINS: [number, number, number, number] = [40, 45, 40, 45];
export const CONTENT_WIDTH = 595.28 - PAGE_MARGINS[0] - PAGE_MARGINS[2];

export function buildDoc(notes: C[][], newPagePerNote: boolean): C {
  const content: C[] = [];
  for (const blocks of notes) {
    if (!blocks.length) continue;
    if (content.length) {
      content.push(newPagePerNote ? { text: "", pageBreak: "before" } : { text: "", margin: [0, 12, 0, 0] });
    }
    content.push(...blocks);
  }
  if (!content.length) content.push({ text: "(leer)" });
  return {
    pageSize: "A4",
    pageMargins: PAGE_MARGINS,
    content,
    defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.2, color: "#000000" },
    // Überschrift nie allein am Seitenende
    pageBreakBefore: (node: any, following: any[]) => !!node.headlineLevel && following.length === 0,
  };
}
