import { describe, expect, it } from "vitest";
import { flattenPageTree, publishedPageTree } from "../page-tree.js";
import { parseSiteDocument } from "../schema.js";
import type { SiteDocument } from "../schema.js";

function doc(pages: SiteDocument["pages"]): SiteDocument {
  return parseSiteDocument({
    version: 1,
    site: { id: "s", title: "S", homePageId: "home" },
    layouts: [{ id: "L", root: { type: "zone", id: "main" } }],
    pages,
  });
}

describe("published page tree", () => {
  it("serves home at the root and nests children by parentId", () => {
    const tree = publishedPageTree(
      doc([
        { id: "home", title: "Home", zones: {} },
        { id: "events", title: "Events", parentId: "home", zones: {} },
        { id: "fair", title: "Fair", slug: "summer-fair", parentId: "events", zones: {} },
        { id: "about", title: "About", zones: {} },
      ]),
    );
    expect(tree.map((node) => [node.path, node.page.id])).toEqual([
      ["", "home"],
      ["about", "about"],
    ]);
    expect(tree[0]!.children.map((node) => node.path)).toEqual(["events"]);
    expect(tree[0]!.children[0]!.children.map((node) => node.path)).toEqual(["events/summer-fair"]);
    expect(flattenPageTree(tree).map((node) => node.path)).toEqual([
      "",
      "events",
      "events/summer-fair",
      "about",
    ]);
  });

  it("keeps description and nav visibility on the page record", () => {
    const parsed = doc([
      {
        id: "home",
        title: "Home",
        description: "The hall",
        showInNav: false,
        zones: {},
      },
    ]);
    expect(parsed.pages[0]).toMatchObject({
      description: "The hall",
      showInNav: false,
    });
  });

  it("rejects a cycle, a missing parent, and two pages on one path", () => {
    expect(() =>
      publishedPageTree(
        doc([
          { id: "home", title: "Home", zones: {} },
          { id: "a", title: "A", parentId: "b", zones: {} },
          { id: "b", title: "B", parentId: "a", zones: {} },
        ]),
      ),
    ).toThrow(/cycle/i);

    expect(() =>
      publishedPageTree(
        doc([
          { id: "home", title: "Home", zones: {} },
          { id: "a", title: "A", parentId: "missing", zones: {} },
        ]),
      ),
    ).toThrow(/parent/);

    expect(() =>
      publishedPageTree(
        doc([
          { id: "home", title: "Home", zones: {} },
          { id: "a", title: "A", slug: "same", zones: {} },
          { id: "b", title: "B", slug: "same", zones: {} },
        ]),
      ),
    ).toThrow(/both publish/);
  });
});
