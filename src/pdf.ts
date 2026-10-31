import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { PdfNode } from "./convert";

interface FontModule {
  pdfMake?: { vfs?: unknown };
  vfs?: unknown;
  default?: FontModule;
}

// Je nach Bundler liegt die Font-Tabelle an unterschiedlichen Stellen.
function findVfs(m: unknown): unknown {
  const f = m as FontModule;
  return f?.pdfMake?.vfs ?? f?.default?.pdfMake?.vfs ?? f?.vfs ?? f?.default ?? f;
}

let ready = false;
function init() {
  if (ready) return;
  pdfMake.vfs = findVfs(pdfFonts);
  ready = true;
}

export function makePdf(doc: PdfNode): Promise<ArrayBuffer> {
  init();
  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(doc).getBuffer((buf) => {
        const ab = new ArrayBuffer(buf.byteLength);
        new Uint8Array(ab).set(buf);
        resolve(ab);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}
