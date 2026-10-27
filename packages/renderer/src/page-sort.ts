import type { Page } from "@r-a-i-t-h/tessera-model";

function pageDate(page: Page): string {
  return page.fields?.date?.trim() ?? "";
}

function hasDate(page: Page): boolean {
  return Boolean(pageDate(page));
}

function compareByTitleAsc(a: Page, b: Page): number {
  const ta = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  return ta !== 0 ? ta : a.id.localeCompare(b.id);
}

/** Newest first; undated pages last; tiebreak id (matches editor articles list). */
function compareByDateDesc(a: Page, b: Page): number {
  const da = pageDate(a);
  const db = pageDate(b);
  const aEmpty = !da;
  const bEmpty = !db;
  if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
  if (!aEmpty && !bEmpty) {
    const byDate = db.localeCompare(da);
    if (byDate !== 0) return byDate;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Order sibling pages for a subpages list: date descending when any sibling has
 * `fields.date`, otherwise title A–Z.
 */
export function sortSubpageSiblings(pages: readonly Page[]): Page[] {
  const list = [...pages];
  if (list.some(hasDate)) {
    return list.sort(compareByDateDesc);
  }
  return list.sort(compareByTitleAsc);
}
