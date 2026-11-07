import { describe, expect, it } from "vitest";
import type { SiteDocument } from "../schema.js";
import { collectNavPageOrder, flattenNav, resolveNavTree, rewriteNavPageTitle } from "../nav-expand.js";
import { makeFixtureDoc } from "./nav-fixtures.js";

describe("resolveNavTree", () => {
  it("resolves source.pageType into dynamic children without listing all pages", () => {
    const doc = makeFixtureDoc();
    doc.pages.push({
      id: "meetup-1",
      title: "Meetup One",
      type: "event",
      zones: { title: [{ type: "text", html: "M1" }], main: [] },
    });
    doc.nav = [
      { sidebar: true, id: "home", title: "Home" },
      {
        sidebar: true,
        heading: "Events",
        source: { pageType: "event" },
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
    expect(flattenNav(tree).some((n) => n.id === "about")).toBe(false);
  });

  it("resolves source.itemsTag when a page shares the item id", () => {
    const doc: SiteDocument = makeFixtureDoc();
    doc.items.push({
      id: "about",
      tags: ["listed"],
      zones: {},
    });
    doc.nav = [{ sidebar: true, heading: "Listed", source: { itemsTag: "listed" } }];

    const tree = resolveNavTree(doc);
    expect(tree[0]!.children[0]).toMatchObject({ id: "about", title: "About" });
  });

  it("copies footer onto links implied by a heading", () => {
    const doc = makeFixtureDoc();
    doc.pages.push({
      id: "meetup-1",
      title: "Meetup One",
      type: "event",
      zones: { title: [{ type: "text", html: "M1" }], main: [] },
    });
    doc.nav = [{ footer: true, heading: "Events", source: { pageType: "event" } }];
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

  it("adds an index link under a blog when showIndexInNav is set", () => {
    const doc = makeFixtureDoc();
    doc.pages.push(
      { id: "news", title: "News", type: "blog", fields: { showIndexInNav: "true" }, zones: {} },
      { id: "news-index", title: "Index", type: "blog-index", parentId: "news", zones: {} },
      {
        id: "fair",
        title: "Fair",
        type: "article",
        parentId: "news",
        tags: ["fair"],
        fields: { date: "2026-07-14" },
        zones: {},
      },
    );
    doc.nav = [{ id: "news", title: "News", sidebar: true, source: { blog: true } }];
    const tree = resolveNavTree(doc);
    expect(tree[0]!.children.map((child) => child.title)).toEqual(["Index"]);
    expect(tree[0]!.children.some((child) => child.id === "fair")).toBe(false);
  });

  it("uses the page title when a link title is omitted", () => {
    const doc = makeFixtureDoc();
    doc.nav = [{ id: "about", sidebar: true }];
    expect(resolveNavTree(doc)[0]).toMatchObject({ id: "about", title: "About" });
  });

  it("keeps a link title that differs from the page title", () => {
    const doc = makeFixtureDoc();
    doc.nav = [{ id: "about", title: "Who we are", sidebar: true }];
    expect(resolveNavTree(doc)[0]).toMatchObject({ id: "about", title: "Who we are" });
  });

  it("skips a row whose page is not in the document", () => {
    const doc = makeFixtureDoc();
    doc.nav = [
      { id: "home", title: "Home", sidebar: true },
      { id: "missing", title: "Gone", sidebar: true, children: [{ id: "home", title: "Nested" }] },
      { heading: "Kept", sidebar: true },
    ];
    const tree = resolveNavTree(doc);
    expect(tree.map((node) => node.id ?? node.heading)).toEqual(["home", "Kept"]);
  });
});

describe("collectNavPageOrder", () => {
  it("returns ids in nav order with depth and skips disallowed ids", () => {
    const doc = makeFixtureDoc();
    doc.nav = [
      { id: "home", sidebar: true },
      {
        heading: "Section",
        children: [{ id: "about", sidebar: true }],
      },
    ];
    const tree = resolveNavTree(doc);
    const allowed = new Set(["home", "about", "ghost"]);
    expect(collectNavPageOrder(tree, allowed)).toEqual([
      { id: "home", depth: 0 },
      { id: "about", depth: 1 },
    ]);
  });

  it("uses first occurrence when the same page appears twice", () => {
    const doc = makeFixtureDoc();
    doc.nav = [
      { id: "home", sidebar: true },
      { id: "home", sidebar: true, title: "Again" },
    ];
    const tree = resolveNavTree(doc);
    expect(collectNavPageOrder(tree, new Set(["home"]))).toEqual([{ id: "home", depth: 0 }]);
  });
});

describe("rewriteNavPageTitle", () => {
  it("updates a nav title that mirrored the previous page title", () => {
    const nav = [{ id: "about", title: "About", sidebar: true }];
    const { nav: next, changed } = rewriteNavPageTitle(nav, "about", "About", "About us");
    expect(changed).toBe(true);
    expect(next[0]).toMatchObject({ id: "about", title: "About us" });
  });

  it("leaves a custom nav label when it differs from the page title", () => {
    const nav = [{ id: "about", title: "Who we are", sidebar: true }];
    const { nav: next, changed } = rewriteNavPageTitle(nav, "about", "About", "About us");
    expect(changed).toBe(false);
    expect(next[0]).toMatchObject({ id: "about", title: "Who we are" });
  });

  it("leaves omitted nav titles unchanged", () => {
    const nav = [{ id: "about", sidebar: true }];
    const { nav: next, changed } = rewriteNavPageTitle(nav, "about", "About", "About us");
    expect(changed).toBe(false);
    expect(next[0]).toEqual({ id: "about", sidebar: true });
  });

  it("updates nested links and titles that matched the page id", () => {
    const nav = [
      {
        heading: "Pages",
        sidebar: true,
        children: [{ id: "draft", title: "draft", sidebar: true }],
      },
    ];
    const { nav: next, changed } = rewriteNavPageTitle(nav, "draft", "", "First draft");
    expect(changed).toBe(true);
    const group = next[0]!;
    expect(group.children?.[0]).toMatchObject({ id: "draft", title: "First draft" });
  });

  it("drops a mirrored title when the new page title is empty or the page id", () => {
    const nav = [{ id: "about", title: "About", sidebar: true }];
    const cleared = rewriteNavPageTitle(nav, "about", "About", "");
    expect(cleared.changed).toBe(true);
    expect(cleared.nav[0]).toEqual({ id: "about", sidebar: true });
    const idTitle = rewriteNavPageTitle([{ id: "about", title: "Old", sidebar: true }], "about", "Old", "about");
    expect(idTitle.nav[0]).toEqual({ id: "about", sidebar: true });
  });
});
