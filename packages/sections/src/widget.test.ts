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
});
