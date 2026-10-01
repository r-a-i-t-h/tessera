import { describe, expect, it } from "vitest";
import { parseSiteDocument, resolvePageProfile, sectionMatchesPage } from "../index.js";
import type { Page, SiteDocument } from "../index.js";

function baseDoc(): SiteDocument {
  return parseSiteDocument({
    version: 2,
    site: {
      id: "s",
      title: "S",
      homePageId: "home",
      defaultLayoutId: "standard",
    },
    layouts: [
      { id: "standard", root: { type: "zone", id: "main" } },
      { id: "simple", root: { type: "zone", id: "main" } },
    ],
    pages: [
      { id: "home", title: "Home", layoutId: "standard", tags: ["page"], zones: {} },
      { id: "event-farm", title: "Farm", tags: ["event"], zones: {} },
      { id: "event-vip", title: "VIP", tags: ["event", "vip"], zones: {} },
      { id: "no-aside", title: "Override", layoutId: "simple", tags: ["page"], zones: {} },
    ],
    sections: [
      {
        id: "site-default",
        match: { tags: ["page"] },
        layoutId: "standard",
      },
      {
        id: "events",
        match: { tags: ["event"] },
        layoutId: "simple",
        children: [
          {
            id: "events-vip",
            match: { tags: ["vip"] },
          },
        ],
      },
    ],
  });
}

describe("sectionMatchesPage", () => {
  const page: Page = { id: "event-farm", title: "Farm", tags: ["event"], zones: {} };

  it("matches empty criteria", () => {
    expect(sectionMatchesPage({}, page)).toBe(true);
  });

  it("matches tags and prefix with AND", () => {
    expect(sectionMatchesPage({ tags: ["event"] }, page)).toBe(true);
    expect(sectionMatchesPage({ tags: ["page"] }, page)).toBe(false);
    expect(sectionMatchesPage({ pageIdPrefix: "event-" }, page)).toBe(true);
    expect(sectionMatchesPage({ tags: ["event"], pageIdPrefix: "blog-" }, page)).toBe(false);
  });
});

describe("resolvePageProfile", () => {
  it("uses page.layoutId as override", () => {
    const doc = baseDoc();
    const page = doc.pages.find((p) => p.id === "no-aside")!;
    const profile = resolvePageProfile(doc, page);
    expect(profile).toMatchObject({
      layoutId: "simple",
      layoutSource: "page",
      sectionId: "site-default",
    });
  });

  it("inherits layout from a matching section", () => {
    const doc = baseDoc();
    const page = doc.pages.find((p) => p.id === "event-farm")!;
    const profile = resolvePageProfile(doc, page);
    expect(profile).toMatchObject({
      layoutId: "simple",
      layoutSource: "section",
      sectionId: "events",
    });
  });

  it("prefers the deeper nested section", () => {
    const doc = baseDoc();
    const page = doc.pages.find((p) => p.id === "event-vip")!;
    const profile = resolvePageProfile(doc, page);
    expect(profile).toMatchObject({
      layoutId: "simple",
      layoutSource: "section",
      sectionId: "events-vip",
    });
  });

  it("falls back to site.defaultLayoutId when nothing matches", () => {
    const lonely = parseSiteDocument({
      version: 2,
      site: {
        id: "s",
        title: "S",
        homePageId: "lonely",
        defaultLayoutId: "standard",
      },
      layouts: [
        { id: "standard", root: { type: "zone", id: "main" } },
        { id: "simple", root: { type: "zone", id: "main" } },
      ],
      pages: [{ id: "lonely", title: "Lonely", zones: {} }],
      sections: [],
    });
    const profile = resolvePageProfile(lonely, lonely.pages[0]!);
    expect(profile).toMatchObject({
      layoutId: "standard",
      layoutSource: "site",
    });
    expect(profile.sectionId).toBeUndefined();
  });
});
