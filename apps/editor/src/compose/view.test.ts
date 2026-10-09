import { describe, expect, it } from "vitest";
import type { PageLayoutHint } from "../api.js";
import { composeFormInner } from "./view.js";

const layout: PageLayoutHint = {
  layoutId: "tessera-article",
  layoutSource: "type",
  fields: [],
  declaredZones: ["title", "main"],
  offLayoutZones: [],
  layouts: {},
  frames: [],
};

describe("composeFormInner", () => {
  it("edits an article title as a field and the body as the only zone", () => {
    const html = composeFormInner(
      "content",
      {
        id: "fair",
        title: "Summer fair",
        type: "article",
        fields: { tenant: "hall", date: "2026-10-09" },
        zones: { title: { html: "Summer fair" }, main: { html: "<p>Body</p>" } },
      },
      layout,
      [],
      { tenants: ["hall"] },
    );
    expect(html).toContain('name="title"');
    expect(html).toContain("Summer fair");
    expect(html).toContain('data-zone="main"');
    expect(html).not.toContain("Off layout");
    expect(html).not.toContain('data-zone="title"');
  });
});
