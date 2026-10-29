import { describe, expect, it } from "vitest";
import {
  ARRANGE_STATIC_HTML_TARGET,
  layoutStaticHtmlField,
  rawHtmlField,
  rawHtmlInsertToolbar,
} from "./raw-html-field.js";

describe("rawHtmlInsertToolbar", () => {
  it("offers Image, Document, and Page inserts", () => {
    const html = rawHtmlInsertToolbar("zones.footer.html");
    expect(html).toContain('data-insert="image"');
    expect(html).toContain('data-insert="document"');
    expect(html).toContain('data-insert="page"');
    expect(html).toContain('data-target="zones.footer.html"');
    expect(html).toContain('class="editor-mark"');
    expect(html).toContain('aria-label="Image"');
    expect(html).not.toContain(">Image</button>");
  });
});

describe("rawHtmlField", () => {
  it("includes toolbar and data-raw-html-target on the textarea", () => {
    const html = rawHtmlField("zones.footer.html", "Footer HTML", "<p>Hi</p>", 12);
    expect(html).toContain('data-insert="image"');
    expect(html).toContain('name="zones.footer.html"');
    expect(html).toContain('data-raw-html-target="zones.footer.html"');
    expect(html).toContain("&lt;p&gt;Hi&lt;/p&gt;");
    expect(html.indexOf("Footer HTML")).toBeLessThan(html.indexOf("editor-raw-html-tools"));
    expect(html.indexOf("editor-raw-html-tools")).toBeLessThan(html.indexOf("<textarea"));
  });
});

describe("layoutStaticHtmlField", () => {
  it("uses arrange-static target for layout Custom HTML", () => {
    const html = layoutStaticHtmlField("<hr />");
    expect(html).toContain(`data-raw-html-target="${ARRANGE_STATIC_HTML_TARGET}"`);
    expect(html).toContain('data-target="arrange-static-html"');
    expect(html).toContain("&lt;hr /&gt;");
  });
});
