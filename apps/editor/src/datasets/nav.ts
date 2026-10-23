import type { EditorNavDataset } from "../chrome.js";

export function datasetNavItems(datasets: { id: string; title: string }[]): EditorNavDataset[] {
  return datasets
    .map((d) => ({ id: d.id, title: d.title.trim() || d.id }))
    .sort((a, b) => {
      const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
    });
}
