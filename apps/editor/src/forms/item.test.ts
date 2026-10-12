import { describe, expect, it } from "vitest";
import { formatJsonText, itemZoneError, jsonText, newItemBody, parseJsonText, tidyItemRecord, zonesDeclaredBy } from "./item.js";

describe("new item", () => {
  it("unions zones in layout order and drops duplicates", () => {
    expect(
      zonesDeclaredBy([
        {
          type: "region",
          children: [
            { type: "zone", id: "title" },
            { type: "zone", id: "main" },
          ],
        },
        {
          type: "region",
          children: [
            { type: "page" },
            { type: "zone", id: "main" },
            { type: "zone", id: "footer" },
          ],
        },
      ]),
    ).toEqual(["title", "main", "footer"]);
  });

  it("accepts a zone name or none, and rejects punctuation", () => {
    expect(itemZoneError(" footer ")).toBeUndefined();
    expect(itemZoneError("")).toBeUndefined();
    expect(itemZoneError("  ")).toBeUndefined();
    expect(itemZoneError("footer.note")).toMatch(/letter/);
    expect(itemZoneError("-footer")).toMatch(/letter/);
  });

  it("starts as empty HTML in the named zone", () => {
    expect(newItemBody(" common-footer ", " footer ")).toEqual({
      id: "common-footer",
      zones: { footer: { html: "" } },
    });
  });

  it("starts with no zone when none is chosen", () => {
    expect(newItemBody("note", "")).toEqual({ id: "note", zones: {} });
    expect(newItemBody("note", "  ", "json")).toEqual({ id: "note", zones: {} });
  });

  it("starts a JSON item as an empty value in the named zone", () => {
    expect(newItemBody("trustees", "aside", "json")).toEqual({
      id: "trustees",
      zones: { aside: { json: null } },
    });
  });

  it("starts a component from its catalogue name and a block list as an empty array", () => {
    expect(newItemBody("banner", "header", "component", " eventList ")).toEqual({
      id: "banner",
      zones: { header: { component: "eventList" } },
    });
    expect(newItemBody("slides", "main", "blocks")).toEqual({
      id: "slides",
      zones: { main: { blocks: [] } },
    });
  });

  it("drops blank component props and keeps an empty block list", () => {
    expect(
      tidyItemRecord({
        id: "banner",
        zones: {
          header: { component: "eventList", props: null },
          main: { blocks: null },
        },
      }),
    ).toEqual({
      id: "banner",
      zones: {
        header: { component: "eventList" },
        main: { blocks: [] },
      },
    });
  });

  it("pretty-prints stored JSON and leaves a blank box blank", () => {
    expect(jsonText(null)).toBe("");
    expect(jsonText([{ title: "Fair" }])).toBe(`[
  {
    "title": "Fair"
  }
]`);
  });

  it("parses the box and treats blank as null", () => {
    expect(parseJsonText("  ")).toBeNull();
    expect(parseJsonText('[ {"title":"Fair"} ]')).toEqual([{ title: "Fair" }]);
    expect(() => parseJsonText("{")).toThrow(/JSON/i);
  });

  it("pretty-prints on demand and reports broken JSON", () => {
    expect(formatJsonText("")).toEqual({ ok: true, text: "" });
    expect(formatJsonText('[ {"title":"Fair"} ]')).toEqual({
      ok: true,
      text: `[
  {
    "title": "Fair"
  }
]`,
    });
    const broken = formatJsonText("{");
    expect(broken.ok).toBe(false);
  });
});
