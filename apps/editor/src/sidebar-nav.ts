import { listDatasets, listRecords, type RecordList } from "./api.js";
import type { EditorNavBlog, EditorNavContext } from "./chrome.js";
import { datasetNavItems } from "./datasets/nav.js";

export function blogsFromListing(listing: RecordList): EditorNavBlog[] {
  return listing.records
    .filter((row) => row.kind === "content" && row.type === "blog")
    .map((row) => ({ id: row.id, title: row.title ?? row.id }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

let baseNav: EditorNavContext = {};

export async function refreshSidebarNav(): Promise<void> {
  const listing = await listRecords();
  const { datasets } = await listDatasets().catch(() => ({ ok: true as const, datasets: [] }));
  baseNav = {
    blogs: blogsFromListing(listing),
    datasets: datasetNavItems(datasets),
  };
}

export function mergeEditorNav(nav: EditorNavContext = {}): EditorNavContext {
  return { ...baseNav, ...nav };
}
