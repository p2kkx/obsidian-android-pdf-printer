import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";

let ready = false;
function init() {
  if (ready) return;
  const f: any = pdfFonts;
  const vfs = f?.pdfMake?.vfs ?? f?.default?.pdfMake?.vfs ?? f?.vfs ?? f?.default ?? f;
  (pdfMake as any).vfs = vfs;
  ready = true;
}

export function makePdf(doc: any): Promise<ArrayBuffer> {
  init();
  return new Promise((resolve, reject) => {
    try {
      (pdfMake as any).createPdf(doc).getBuffer((buf: Uint8Array) => {
        resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
      });
    } catch (e) {
      reject(e);
    }
  });
}
