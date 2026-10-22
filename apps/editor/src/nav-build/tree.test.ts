import { describe, expect, it } from "vitest";
import {
  insertNodes,
  newGroup,
  newLink,
  nodeFromPalette,
  paletteKindIsGroup,
  parseNavTree,
  relocate,
  removeNode,
  serializeNavTree,
} from "./tree.js";

const sample = [
  { id: "home", title: "Home", sidebar: true, topbar: true, fa: "home" },
  {
    heading: "Site",
    sidebar: true,
    fa: "folder",
    children: [{ id: "about", title: "About", sidebar: true, fa: "info" }],
    source: { pageType: "event", itemsTag: "person", note: "keep" },
  },
];

describe("nav-build tree", () => {
  it("round-trips sample fixtures", () => {
    expect(serializeNavTree(parseNavTree(sample))).toEqual(sample);
  });

  it("round-trips nested groups", () => {
    const data = [
      {
        heading: "Outer",
        sidebar: true,
        children: [
          {
            heading: "Inner",
            sidebar: true,
            children: [{ id: "leaf", title: "Leaf", sidebar: true }],
          },
        ],
      },
    ];
    expect(serializeNavTree(parseNavTree(data))).toEqual(data);
  });

  it("parses blog link with id", () => {
    const data = [{ id: "hall", title: "News", sidebar: true, source: { blog: true } }];
    expect(serializeNavTree(parseNavTree(data))).toEqual(data);
  });

  it("knows which palette kinds create groups", () => {
    expect(paletteKindIsGroup({ kind: "heading" })).toBe(true);
    expect(paletteKindIsGroup({ kind: "type", typeId: "x" })).toBe(true);
    expect(paletteKindIsGroup({ kind: "tag", tag: "x" })).toBe(true);
    expect(paletteKindIsGroup({ kind: "page", id: "home" })).toBe(false);
    expect(paletteKindIsGroup({ kind: "blog", id: "news" })).toBe(false);
  });

  it("creates nodes from palette kinds", () => {
    const heading = nodeFromPalette({ kind: "heading" });
    expect(heading.kind).toBe("group");
    const page = nodeFromPalette({ kind: "page", id: "about", title: "About" });
    expect(page).toMatchObject({ kind: "link", id: "about", title: "About" });
    const blog = nodeFromPalette({ kind: "blog", id: "news", title: "News" });
    expect(blog).toMatchObject({ kind: "link", source: { blog: true } });
    const type = nodeFromPalette({ kind: "type", typeId: "meeting" });
    expect(type.kind).toBe("group");
    if (type.kind === "group") expect(type.source).toEqual({ pageType: "meeting" });
    const tag = nodeFromPalette({ kind: "tag", tag: "person" });
    if (tag.kind === "group") expect(tag.source).toEqual({ itemsTag: "person" });
  });

  it("relocates within root and into a group", () => {
    let roots = parseNavTree([
      { id: "a", title: "A", sidebar: true },
      { id: "b", title: "B", sidebar: true },
      { heading: "G", sidebar: true, children: [] },
    ]);
    roots = relocate(roots, [0], [], 2);
    expect(roots.map((n) => (n.kind === "link" ? n.id : n.heading))).toEqual(["b", "a", "G"]);
    roots = insertNodes(roots, [2], 0, [newLink("c", "C")]);
    const group = roots[2];
    expect(group?.kind).toBe("group");
    if (group?.kind === "group") expect(group.children[0]?.kind === "link" && group.children[0].id).toBe("c");
  });

  it("refuses dropping into own descendant", () => {
    const roots = parseNavTree([
      {
        heading: "G",
        sidebar: true,
        children: [{ heading: "H", sidebar: true, children: [] }],
      },
    ]);
    const next = relocate(roots, [0], [0, 0], 0);
    expect(next).toEqual(roots);
  });

  it("removeNode extracts an entry", () => {
    const roots = parseNavTree([{ id: "a", sidebar: true }, { id: "b", sidebar: true }]);
    const removed = removeNode(roots, [0]);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.removed.kind).toBe("link");
      expect(removed.roots).toHaveLength(1);
    }
  });

  it("folds heading with no text and link children", () => {
    const data = [
      { id: "home", title: "Home", sidebar: true },
      {
        sidebar: true,
        children: [
          { id: "about", title: "About", sidebar: true },
          { id: "more", title: "More", sidebar: true },
        ],
      },
    ];
    expect(serializeNavTree(parseNavTree(data))).toEqual(data);
  });
});
