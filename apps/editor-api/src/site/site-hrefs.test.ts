import { describe, expect, it } from "vitest";
import { PREVIEW_SITE_HREF, publishedSiteHref } from "./site-hrefs.js";

describe("publishedSiteHref", () => {
  it("is undefined when origin is missing or blank", () => {
    expect(publishedSiteHref(undefined)).toBeUndefined();
    expect(publishedSiteHref("  ")).toBeUndefined();
  });

  it("normalizes a live origin URL", () => {
    expect(publishedSiteHref("https://example.org/fair")).toBe("https://example.org/fair/");
  });

  it("exposes the preview path", () => {
    expect(PREVIEW_SITE_HREF).toBe("/preview/");
  });
});
