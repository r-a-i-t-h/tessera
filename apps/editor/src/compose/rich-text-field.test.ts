// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { expandWikiLinks, htmlForEditing, htmlFromEditing } from "./rich-text-field.js";

describe("expandWikiLinks", () => {
  it("expands wiki syntax into page anchors", () => {
    const titles = new Map([["hall", "Great Hall"]]);
    const html = expandWikiLinks("<p>See [[hall]] and [[hall|the hall]].</p>", titles);
    expect(html).toContain('data-tessera-page="hall"');
    expect(html).toMatch(/data-tessera-page="hall"[^>]*>the hall</);
  });

  it("leaves html without wiki tokens unchanged", () => {
    const html = "<p>Plain</p>";
    expect(expandWikiLinks(html)).toBe(html);
  });
});

describe("htmlFromEditing", () => {
  it("stores markdown links in block mode", () => {
    const out = htmlFromEditing("<p>Visit [Hall](https://example.com/hall) today.</p>", true);
    expect(out).toContain('<a href="https://example.com/hall">Hall</a>');
  });

  it("prepares stored html for the contenteditable surface", () => {
    expect(htmlForEditing("<p>A</p>\n\n<p>B</p>")).toContain("<p>B</p>");
  });
});
