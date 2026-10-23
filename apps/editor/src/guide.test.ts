import { describe, expect, it } from "vitest";
import { guideHtml } from "./guide.js";
import { stylesSheetHref } from "./router.js";

describe("guideHtml", () => {
  it("links editor pages and stylesheet editors mentioned in the guide", () => {
    const html = guideHtml();
    expect(html).toContain('href="#/layouts/master"');
    expect(html).toContain('href="#/content/search"');
    expect(html).toContain('href="#/records/site"');
    expect(html).toContain(`href="${stylesSheetHref("w3")}"`);
    expect(html).toContain(`href="${stylesSheetHref("tessera")}"`);
    expect(html).toContain(`href="${stylesSheetHref("microapps")}"`);
    expect(html).toContain(`href="${stylesSheetHref("site")}"`);
    expect(html).toContain(`href="${stylesSheetHref("local")}"`);
    expect(html).toContain(`href="${stylesSheetHref("theme")}"`);
    expect(html).toContain('href="#/styles">Styles</a>');
    expect(html).toContain('href="#/records/items"');
    expect(html).toContain('href="#/items/common-footer"');
    expect(html).toContain('id="items"');
    expect(html).toContain('href="#/records/datasets"');
    expect(html).toContain('href="#/data"');
    expect(html).toContain('href="#/records/runtimeModules"');
    expect(html).toContain('id="datasets"');
    expect(html).toContain('id="runtime-modules"');
  });
});
