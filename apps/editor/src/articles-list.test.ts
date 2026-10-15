import { describe, expect, it } from "vitest";
import type { RecordSummary } from "./api.js";
import { buildContentCreationRank } from "./creation-rank.js";
import { sortArticles } from "./articles-list.js";

function article(id: string, patch: Partial<RecordSummary> = {}): RecordSummary {
  return { kind: "content", id, title: id, type: "article", parentId: "news", ...patch };
}

describe("sortArticles", () => {
  const rank = buildContentCreationRank([
    article("first"),
    { kind: "content", id: "page", title: "Page" },
    article("second"),
    article("third"),
  ]);

  it("sorts by creation rank newest first", () => {
    const rows = [article("first"), article("second"), article("third")];
    expect(sortArticles(rows, "created", rank).map((r) => r.id)).toEqual(["third", "second", "first"]);
  });

  it("sorts by publish date descending with undated last", () => {
    const rows = [
      article("a", { date: "2026-01-01" }),
      article("b", { date: "2026-06-01" }),
      article("c"),
    ];
    expect(sortArticles(rows, "date", rank).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts alphabetically by title", () => {
    const rows = [article("z", { title: "Zed" }), article("a", { title: "Alpha" })];
    expect(sortArticles(rows, "alpha", rank).map((r) => r.id)).toEqual(["a", "z"]);
  });
});
