import { requestUrl } from "obsidian";
import type { ImgInfo } from "./convert";

const MAX_DIM = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const t = window.setTimeout(() => reject(new Error("timeout")), 10000);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      reject(new Error("load error"));
    };
    img.src = src;
  });
}

// Lädt alle <img> und wandelt sie in JPEG-Data-URLs (weißer Hintergrund) um.
// Das deckt auch webp/gif/transparente PNGs ab, die pdfmake sonst nicht kann.
export async function preloadImages(root: Element): Promise<Map<Element, ImgInfo>> {
  const map = new Map<Element, ImgInfo>();
  for (const el of Array.from(root.querySelectorAll("img"))) {
    try {
      let src = el.getAttribute("src") || el.src;
      if (!src) continue;
      let blobUrl: string | null = null;
      if (/^https?:/i.test(src)) {
        const res = await requestUrl({ url: src });
        blobUrl = URL.createObjectURL(new Blob([res.arrayBuffer]));
        src = blobUrl;
      }
      const img = await loadImage(src);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) continue;
      const k = Math.min(1, MAX_DIM / Math.max(nw, nh));
      const w = Math.round(nw * k);
      const h = Math.round(nh * k);
      const canvas = createEl("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      map.set(el, { data: canvas.toDataURL("image/jpeg", 0.88), w, h });
    } catch (e) {
      console.warn("Multi-Note PDF Printer: image skipped", e);
    }
  }
  return map;
}
