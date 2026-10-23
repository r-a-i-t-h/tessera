// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { decodeHtmlEntitiesOnce, sanitizeRichHtml } from "../html-sanitize.js";

describe("sanitizeRichHtml", () => {
  it("keeps allowed markup", () => {
    expect(sanitizeRichHtml("<p>Hi <strong>there</strong></p>")).toBe("<p>Hi <strong>there</strong></p>");
  });

  it("strips script tags", () => {
    expect(sanitizeRichHtml('<p>Ok</p><script>alert(1)</script>')).toBe("<p>Ok</p>");
  });
});

describe("decodeHtmlEntitiesOnce", () => {
  it("decodes entity-encoded markup once", () => {
    expect(decodeHtmlEntitiesOnce("&lt;p&gt;Hi&lt;/p&gt;")).toBe("<p>Hi</p>");
  });

  it("leaves raw markup unchanged", () => {
    expect(decodeHtmlEntitiesOnce("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});
