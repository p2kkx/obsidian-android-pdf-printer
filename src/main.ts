import {
  Component,
  MarkdownRenderer,
  Notice,
  Plugin,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";
import { collectNotes } from "./collect";
import { buildDoc, CONTENT_WIDTH, noteToContent, type PdfNode } from "./convert";
import { preloadImages } from "./images";
import { makePdf } from "./pdf";
import { OrderModal, ResultModal, SettingsTab } from "./ui";

interface Settings {
  newPagePerNote: boolean;
}
const DEFAULTS: Settings = { newPagePerNote: true };

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : typeof e === "string" ? e : "unknown error");
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

export default class PdfPrinterPlugin extends Plugin {
  settings: Settings = { ...DEFAULTS };

  async onload() {
    const data = (await this.loadData()) as Partial<Settings> | null;
    this.settings = { ...DEFAULTS, ...data };
    this.addSettingTab(new SettingsTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "md") {
          menu.addItem((i) =>
            i
              .setTitle("Print to PDF")
              .setIcon("file-output")
              .onClick(() => {
                void this.printNote(file);
              }),
          );
        } else if (file instanceof TFolder) {
          menu.addItem((i) =>
            i
              .setTitle("Print folder to PDF")
              .setIcon("file-output")
              .onClick(() => this.printFolder(file)),
          );
        }
      }),
    );

    this.addCommand({
      id: "print-active-note",
      name: "Print active note to PDF",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f || f.extension !== "md") return false;
        if (!checking) void this.printNote(f);
        return true;
      },
    });
    this.addCommand({
      id: "print-active-folder",
      name: "Print folder of active note to PDF",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f || !f.parent) return false;
        if (!checking) this.printFolder(f.parent);
        return true;
      },
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private printNote(file: TFile) {
    const dir = file.parent && file.parent.path !== "/" ? file.parent.path + "/" : "";
    return this.run([file], dir + file.basename + ".pdf", this.settings.newPagePerNote);
  }

  private printFolder(folder: TFolder) {
    const files = collectNotes(folder);
    if (!files.length) {
      new Notice("No notes in this folder.");
      return;
    }
    const parent = folder.parent && folder.parent.path !== "/" ? folder.parent.path + "/" : "";
    const name = folder.isRoot() ? this.app.vault.getName() : folder.name;
    new OrderModal(this.app, files, this.settings.newPagePerNote, (ordered, newPage) => {
      void this.run(ordered, parent + name + ".pdf", newPage);
    }).open();
  }

  private async run(files: TFile[], outPath: string, newPage: boolean) {
    const notice = new Notice("Creating PDF …", 0);
    const host = document.body.createDiv({ cls: "pdf-printer-host" });
    // Eigene, kurzlebige Component statt der Plugin-Instanz (vermeidet Speicherlecks).
    const component = new Component();
    component.load();
    try {
      const notes: PdfNode[][] = [];
      for (let i = 0; i < files.length; i++) {
        notice.setMessage(`PDF: note ${i + 1}/${files.length} – ${files[i].basename}`);
        notes.push(await this.renderNote(files[i], host, component));
      }
      notice.setMessage("Writing PDF …");
      const buf = await makePdf(buildDoc(notes, newPage));
      const path = normalizePath(outPath);
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) await this.app.vault.modifyBinary(existing, buf);
      else await this.app.vault.createBinary(path, buf);
      notice.hide();
      new Notice(`PDF saved: ${path}`);
      await this.share(path, buf);
    } catch (e) {
      console.error("Multi-Note PDF Printer", e);
      notice.hide();
      new Notice("PDF error: " + errorMessage(e), 8000);
    } finally {
      component.unload();
      host.remove();
    }
  }

  private async renderNote(file: TFile, host: HTMLElement, component: Component) {
    const raw = await this.app.vault.cachedRead(file);
    const md = raw.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, "");
    const el = host.createDiv();
    await MarkdownRenderer.render(this.app, md, el, file.path, component);
    // auf asynchron gerenderte Einbettungen warten (max. ~3 s)
    for (let i = 0; i < 30; i++) {
      if (!el.querySelector(".internal-embed:not(.is-loaded)")) break;
      await sleep(100);
    }
    await sleep(100);
    const images = await preloadImages(el);
    return noteToContent(el, { images, maxW: CONTENT_WIDTH });
  }

  private async nativeShare(path: string, buf: ArrayBuffer): Promise<boolean> {
    const name = path.split("/").pop() || "notes.pdf";
    const file = new File([buf], name, { type: "application/pdf" });
    if (typeof navigator.share !== "function") return false;
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: name });
    return true;
  }

  private async share(path: string, buf: ArrayBuffer) {
    try {
      if (await this.nativeShare(path, buf)) return;
    } catch (e) {
      if (isAbort(e)) return; // vom Nutzer abgebrochen
    }
    // Teilen nicht automatisch möglich: Dialog mit Button (frische Nutzeraktion)
    new ResultModal(this.app, path, async () => {
      try {
        return await this.nativeShare(path, buf);
      } catch (e) {
        return isAbort(e);
      }
    }).open();
  }
}
