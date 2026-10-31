import { App, Modal, Notice, PluginSettingTab, Setting, TFile, type SettingDefinitionItem } from "obsidian";
import type PdfPrinterPlugin from "./main";

export class OrderModal extends Modal {
  constructor(
    app: App,
    private files: TFile[],
    private newPage: boolean,
    private onSubmit: (files: TFile[], newPage: boolean) => void,
  ) {
    super(app);
  }

  onOpen() {
    this.render();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Order in PDF" });

    new Setting(contentEl).setName("Start each note on a new page").addToggle((t) =>
      t.setValue(this.newPage).onChange((v) => (this.newPage = v)),
    );

    const list = contentEl.createDiv();
    this.files.forEach((f, i) => {
      new Setting(list)
        .setName(f.path)
        .addExtraButton((b) =>
          b.setIcon("arrow-up").setTooltip("Move up").setDisabled(i === 0).onClick(() => this.move(i, -1)),
        )
        .addExtraButton((b) =>
          b.setIcon("arrow-down").setTooltip("Move down").setDisabled(i === this.files.length - 1).onClick(() => this.move(i, 1)),
        );
    });

    new Setting(contentEl).addButton((b) =>
      b.setButtonText(`Print ${this.files.length} note(s)`).setCta().onClick(() => {
        this.close();
        this.onSubmit(this.files, this.newPage);
      }),
    );
  }

  private move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= this.files.length) return;
    [this.files[i], this.files[j]] = [this.files[j], this.files[i]];
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }
}

// Fallback, wenn automatisches Teilen nicht möglich ist (z. B. Nutzeraktivierung abgelaufen).
export class ResultModal extends Modal {
  constructor(app: App, private path: string, private share: () => Promise<boolean>) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "PDF created" });
    contentEl.createEl("p", { text: this.path });
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("Share").setCta().onClick(async () => {
          if (!(await this.share())) new Notice("Sharing not possible – the file is in your vault.");
        }),
      )
      .addButton((b) =>
        b.setButtonText("Open").onClick(() => {
          const app = this.app as App & { openWithDefaultApp?: (path: string) => Promise<void> };
          if (app.openWithDefaultApp) void app.openWithDefaultApp(this.path);
          else new Notice("Open not available.");
        }),
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: PdfPrinterPlugin) {
    super(app, plugin);
  }

  // Obsidian >= 1.13: deklarative Einstellungen (durchsuchbar in der Einstellungssuche).
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Start each note on a new page",
        desc: "Off: notes are placed one after another without page breaks.",
        control: { type: "toggle", key: "newPagePerNote", defaultValue: true },
      },
    ];
  }

  // Rückfall für ältere Obsidian-Versionen.
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Start each note on a new page")
      .setDesc("Off: notes are placed one after another without page breaks.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.newPagePerNote).onChange(async (v) => {
          this.plugin.settings.newPagePerNote = v;
          await this.plugin.saveSettings();
        }),
      );
  }
}
