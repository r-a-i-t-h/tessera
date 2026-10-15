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

  it("pins the home page first in flat orders", () => {
    const rows = [
      row("about", { title: "About" }),
      row("home", { title: "Welcome" }),
      row("zeta", { title: "Zeta" }),
    ];
    const ctx = { creationRank: ranks(["about", "home", "zeta"]), homePageId: "home" };
    expect(sortPages(rows, "created", ctx).map((item) => item.row.id)).toEqual(["home", "zeta", "about"]);
    expect(sortPages(rows, "alpha", ctx).map((item) => item.row.id)).toEqual(["home", "about", "zeta"]);
  });

  it("pins the home page above nested siblings and keeps its children with it", () => {
    const rows = [
      row("alpha", { title: "Alpha" }),
      row("events", { title: "Events" }),
      row("home", { title: "Welcome", parentId: "events" }),
      row("fair", { parentId: "home", title: "Fair" }),
      row("news", { parentId: "events", title: "News" }),
    ];
    const sorted = sortPages(rows, "nested", {
      creationRank: ranks(rows.map((item) => item.id)),
      homePageId: "home",
    });
    expect(sorted.map((item) => [item.row.id, item.depth])).toEqual([
      ["home", 0],
      ["fair", 1],
      ["alpha", 0],
      ["events", 0],
      ["news", 1],
    ]);
  });

  it("pins the home page above nav order and keeps pages nested under it", () => {
    const rows = [row("about"), row("home"), row("fair", { title: "Fair" }), row("zeta", { title: "Zeta" })];
    const doc = buildNavSortDocument(
      { id: "s", title: "S", homePageId: "home" },
      [
        { id: "about", sidebar: true },
        {
          heading: "Visit",
          children: [{ id: "home", sidebar: true, children: [{ id: "fair", sidebar: true }] }],
        },
      ],
      rows,
      [],
    );
    const sorted = sortPages(rows, "nav", {
      creationRank: buildContentCreationRank(rows),
      navDocument: doc,
    });
    expect(sorted.map((item) => [item.row.id, item.depth])).toEqual([
      ["home", 0],
      ["fair", 1],
      ["about", 0],
      ["zeta", 0],
    ]);
  });
});
