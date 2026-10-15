import type { RecordSummary } from "./api.js";
import { compareAlpha, compareCreationNewestFirst } from "./creation-rank.js";

export type ArticleListOrder = "created" | "date" | "alpha";

export function readArticleListOrder(): ArticleListOrder {
  try {
    const value = localStorage.getItem("tessera.articles.listOrder");
    if (value === "created" || value === "date" || value === "alpha") return value;
  } catch {
    // localStorage unavailable
  }
  return "date";
}

export function writeArticleListOrder(order: ArticleListOrder): void {
  try {
    localStorage.setItem("tessera.articles.listOrder", order);
  } catch {
    // ignore
  }
}

export function sortArticles(
  rows: readonly RecordSummary[],
  order: ArticleListOrder,
  creationRank: ReadonlyMap<string, number>,
): RecordSummary[] {
  const list = [...rows];
  if (order === "created") {
    return list.sort((a, b) => compareCreationNewestFirst(a, b, creationRank));
  }
  if (order === "alpha") {
    return list.sort(compareAlpha);
  }
  return list.sort(compareByPublishDate);
}

function compareByPublishDate(a: RecordSummary, b: RecordSummary): number {
  const da = a.date ?? "";
  const db = b.date ?? "";
  const aEmpty = !da;
  const bEmpty = !db;
  if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
  if (!aEmpty && !bEmpty) {
    const byDate = db.localeCompare(da);
    if (byDate !== 0) return byDate;
  }
  return a.id.localeCompare(b.id);
}
