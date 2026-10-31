declare module "pdfmake/build/pdfmake" {
  interface PdfDocument {
    getBuffer(callback: (buffer: Uint8Array) => void): void;
  }
  interface PdfMake {
    vfs: unknown;
    createPdf(definition: Record<string, unknown>): PdfDocument;
  }
  const pdfMake: PdfMake;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const fonts: unknown;
  export default fonts;
}
