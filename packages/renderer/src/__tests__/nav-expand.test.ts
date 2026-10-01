import { describe, expect, it } from "vitest";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { resolveNavTree, flattenNav } from "../nav-expand.js";
import { makeFixtureDoc } from "./fixtures.js";

describe("resolveNavTree", () => {
  it("resolves source.pagesTag into dynamic children without listing all pages", () => {
    const doc = makeFixtureDoc();
    doc.pages.push({
      id: "meetup-1",
      title: "Meetup One",
      layoutId: "no-aside",
      tags: ["event"],
      zones: { title: [{ type: "text", html: "M1" }], main: [] },
    });
    doc.nav = [
      { sidebar: true, id: "home", title: "Home" },
      {
        sidebar: true,
        heading: "Events",
        source: { pagesTag: "event" },
      },
    ];

    const tree = resolveNavTree(doc);
    expect(tree).toHaveLength(2);
    expect(tree[0]!.id).toBe("home");
    expect(tree[0]!.children).toEqual([]);
    expect(tree[1]!.heading).toBe("Events");
    expect(tree[1]!.children).toEqual([
      expect.objectContaining({ id: "meetup-1", title: "Meetup One", dynamic: true }),
    ]);
    // about exists as a page but is not in designed nav and has no event tag
    expect(flattenNav(tree).some((n) => n.id === "about")).toBe(false);
  });

  it("resolves source.itemsTag when a page shares the item id", () => {
    const doc: SiteDocument = makeFixtureDoc();
    doc.items.push({
      id: "about",
      title: "About (from item)",
      tags: ["listed"],
      zones: {},
    });
    doc.nav = [{ sidebar: true, heading: "Listed", source: { itemsTag: "listed" } }];

    const tree = resolveNavTree(doc);
    expect(tree[0]!.children[0]).toMatchObject({ id: "about", title: "About (from item)" });
  });

  it("copies footer onto links implied by a heading", () => {
    const doc = makeFixtureDoc();
    doc.pages.push({
      id: "meetup-1",
      title: "Meetup One",
      layoutId: "no-aside",
      tags: ["event"],
      zones: { title: [{ type: "text", html: "M1" }], main: [] },
    });
    doc.nav = [{ footer: true, heading: "Events", source: { pagesTag: "event" } }];
    const tree = resolveNavTree(doc);
    expect(tree[0]!.footer).toBe(true);
    expect(tree[0]!.children[0]).toMatchObject({ id: "meetup-1", footer: true, dynamic: true });
  });

  it("supports nested designed children", () => {
    const doc = makeFixtureDoc();
    doc.nav = [
      {
        sidebar: true,
        heading: "Section",
        children: [{ sidebar: true, id: "home", title: "Home" }],
      },
    ];
    const tree = resolveNavTree(doc);
    expect(tree[0]!.children[0]!.id).toBe("home");
  });
});
