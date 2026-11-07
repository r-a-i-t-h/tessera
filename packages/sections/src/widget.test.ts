import { describe, expect, it } from "vitest";
import { compileWidgetsToHtml, widgetsFromLegacyHtml } from "./widget.js";

describe("compileWidgetsToHtml", () => {
  it("emits mustache for insert widgets", () => {
    expect(compileWidgetsToHtml([{ kind: "insert", id: "hall-gallery" }])).toBe("{{hall-gallery}}");
  });

  it("round-trips simple text through legacy html parse", () => {
    const html = "<p>Hello</p>";
    const widgets = widgetsFromLegacyHtml(html);
    expect(compileWidgetsToHtml(widgets)).toContain("Hello");
  });

  it("omits hidden widgets from compiled html", () => {
    const html = compileWidgetsToHtml([
      { kind: "text", heading: "", level: 2, html: "<p>Visible</p>" },
      { kind: "text", heading: "", level: 2, html: "<p>Hidden</p>", hidden: true },
    ]);
    expect(html).toContain("Visible");
    expect(html).not.toContain("Hidden");
  });

  it("omits hidden nested children inside a visible panel", () => {
    const html = compileWidgetsToHtml([
      {
        kind: "panel",
        tone: "plain",
        sections: [
          { kind: "text", heading: "", level: 2, html: "<p>Shown</p>" },
          { kind: "text", heading: "", level: 2, html: "<p>Gone</p>", hidden: true },
        ],
      },
    ]);
    expect(html).toContain("Shown");
    expect(html).not.toContain("Gone");
  });

  it("omits an entire hidden panel", () => {
    const html = compileWidgetsToHtml([
      { kind: "text", heading: "", level: 2, html: "<p>Keep</p>" },
      {
        kind: "panel",
        tone: "plain",
        hidden: true,
        sections: [{ kind: "text", heading: "", level: 2, html: "<p>Inside</p>" }],
      },
    ]);
    expect(html).toContain("Keep");
    expect(html).not.toContain("Inside");
  });
});
