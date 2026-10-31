import { TFile, TFolder } from "obsidian";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// Erst Notizen des Ordners, dann Unterordner alphabetisch (rekursiv gleiche Regel).
export function collectNotes(folder: TFolder): TFile[] {
  const files: TFile[] = [];
  const subs: TFolder[] = [];
  for (const c of folder.children) {
    if (c.name.startsWith(".")) continue;
    if (c instanceof TFolder) subs.push(c);
    else if (c instanceof TFile && c.extension === "md") files.push(c);
  }
  files.sort((a, b) => collator.compare(a.name, b.name));
  subs.sort((a, b) => collator.compare(a.name, b.name));
  const out = files;
  for (const s of subs) out.push(...collectNotes(s));
  return out;
}
