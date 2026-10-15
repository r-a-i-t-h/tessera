import { describe, expect, it } from "vitest";
import type { RecordSummary } from "./api.js";
import { buildContentCreationRank } from "./creation-rank.js";
import { buildNavSortDocument, sortPages } from "./pages-list.js";

function row(id: string, patch: Partial<RecordSummary> = {}): RecordSummary {
  return { kind: "content", id, title: id, ...patch };
}

function ranks(ids: string[]): Map<string, number> {
  return buildContentCreationRank(ids.map((id) => row(id)));
}

describe("sortPages", () => {
  it("reverses creation order for created mode", () => {
    const rows = [row("a"), row("b"), row("c")];
    const creationRank = ranks(["a", "b", "c"]);
    const sorted = sortPages(rows, "created", { creationRank });
    expect(sorted.map((item) => item.row.id)).toEqual(["c", "b", "a"]);
    expect(sorted.every((item) => item.depth === 0)).toBe(true);
  });

  it("sorts alphabetically by title", () => {
    const rows = [row("z", { title: "Zed" }), row("a", { title: "Alpha" })];
    const creationRank = buildContentCreationRank(rows);
    const sorted = sortPages(rows, "alpha", { creationRank });
    expect(sorted.map((item) => item.row.id)).toEqual(["a", "z"]);
  });

  it("nests by parentId with siblings sorted A–Z", () => {
    const rows = [
      row("home"),
      row("old", { parentId: "home", title: "Old" }),
      row("new", { parentId: "home", title: "New" }),
      row("solo"),
    ];
    const creationRank = ranks(["home", "old", "new", "solo"]);
    const sorted = sortPages(rows, "nested", { creationRank });
    expect(sorted.map((item) => [item.row.id, item.depth])).toEqual([
      ["home", 0],
      ["new", 1],
      ["old", 1],
      ["solo", 0],
    ]);
  });

  it("orders by nav tree and appends non-nav pages alphabetically", () => {
    const rows = [row("about"), row("home"), row("zzz")];
    const creationRank = buildContentCreationRank(rows);
    const doc = buildNavSortDocument(
      { id: "s", title: "S", homePageId: "home" },
      [
        { id: "home", sidebar: true },
        { heading: "More", children: [{ id: "about", sidebar: true }] },
      ],
      rows,
      [],
    );
    const sorted = sortPages(rows, "nav", { creationRank, navDocument: doc });
    expect(sorted.map((item) => [item.row.id, item.depth])).toEqual([
      ["home", 0],
      ["about", 1],
      ["zzz", 0],
    ]);
  });
});
