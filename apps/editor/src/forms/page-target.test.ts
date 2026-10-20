import { describe, expect, it } from "vitest";
import type { RecordList } from "../api.js";
import {
  buildPageTargetChoices,
  parsePageTargetChoices,
  readPageTargetSectionOpen,
  renderPageTargetPicker,
  serializePageTargetChoices,
} from "./page-target.js";

function listing(records: RecordList["records"]): RecordList {
  return { ok: true, records };
}

describe("buildPageTargetChoices", () => {
  it("orders nav pages like the nav tree and groups articles by blog", () => {
    const list = listing([
      { kind: "content", id: "home", title: "Home" },
      { kind: "content", id: "about", title: "About" },
      { kind: "content", id: "news", title: "News", type: "blog" },
      { kind: "content", id: "fair", title: "Fair", type: "article", parentId: "news", date: "2026-07-14" },
      { kind: "content", id: "open", title: "Open day", type: "article", parentId: "news", date: "2026-06-01" },
    ]);
    const choices = buildPageTargetChoices(
      list,
      { id: "s", title: "S", homePageId: "home" },
      [
        { id: "home", sidebar: true },
        { heading: "More", children: [{ id: "about", sidebar: true }] },
      ],
    );
    expect(choices.nav.map((p) => [p.id, p.depth])).toEqual([
      ["home", 0],
      ["about", 1],
    ]);
    expect(choices.articles).toHaveLength(1);
    expect(choices.articles[0]?.blogId).toBe("news");
    expect(choices.articles[0]?.pages.map((p) => p.id)).toEqual(["fair", "open"]);
    expect(choices.pages.map((p) => p.id).sort()).toEqual(["about", "home", "news"]);
  });
});

describe("readPageTargetSectionOpen", () => {
  it("defaults sections to collapsed", () => {
    expect(readPageTargetSectionOpen("nav")).toBe(false);
    expect(readPageTargetSectionOpen("pages")).toBe(false);
    expect(readPageTargetSectionOpen("articles")).toBe(false);
  });
});

describe("renderPageTargetPicker", () => {
  it("lists nav picks and prefills external URL when current is external", () => {
    const choices = buildPageTargetChoices(
      listing([{ kind: "content", id: "home", title: "Home" }]),
      { id: "s", title: "S", homePageId: "home" },
      [{ id: "home", sidebar: true }],
    );
    const html = renderPageTargetPicker(choices, "https://example.com/x");
    expect(html).toContain('data-pick-page="home"');
    expect(html).toContain('value="https://example.com/x"');
    expect(html).toContain('data-page-target-section="nav"');
    expect(html).toContain("<summary");
    expect(html).not.toContain('data-page-target-section="nav" open');
    expect(html).not.toContain("Page link:");
  });

  it("shows the current page link at the top", () => {
    const choices = buildPageTargetChoices(
      listing([{ kind: "content", id: "home", title: "Home" }]),
      { id: "s", title: "S", homePageId: "home" },
      [{ id: "home", sidebar: true }],
    );
    const html = renderPageTargetPicker(choices, "home");
    expect(html.indexOf("Page link:")).toBeLessThan(html.indexOf("External url"));
    expect(html).toContain("<strong>Home (home)</strong>");
    expect(html).toContain('aria-current="true"');
  });
});

describe("serializePageTargetChoices", () => {
  it("round-trips through JSON", () => {
    const choices = { nav: [{ id: "home", depth: 0, title: "Home" }], pages: [{ id: "home", title: "Home" }], articles: [] };
    const parsed = parsePageTargetChoices(serializePageTargetChoices(choices));
    expect(parsed).toEqual(choices);
  });
});
