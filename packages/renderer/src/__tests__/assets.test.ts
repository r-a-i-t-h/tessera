import { describe, expect, it } from "vitest";
import { normalizeSiteAssetUrl, isRootAbsoluteUrl, rewriteMediaUrls } from "../assets.js";
import { assetHref } from "../publish-pages.js";

describe("normalizeSiteAssetUrl", () => {
  it("rewrites root-absolute paths for subdirectory hosting", () => {
    expect(normalizeSiteAssetUrl("/media/a.png")).toBe("./media/a.png");
    expect(isRootAbsoluteUrl("/media/a.png")).toBe(true);
  });

  it("leaves relative and absolute URLs unchanged", () => {
    expect(normalizeSiteAssetUrl("./media/a.png")).toBe("./media/a.png");
    expect(normalizeSiteAssetUrl("media/a.png")).toBe("media/a.png");
    expect(normalizeSiteAssetUrl("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
    expect(normalizeSiteAssetUrl("data:image/svg+xml,x")).toBe("data:image/svg+xml,x");
    expect(normalizeSiteAssetUrl("#home")).toBe("#home");
    expect(isRootAbsoluteUrl("./x")).toBe(false);
  });

  it("prefixes media URLs for a nested page and leaves them on the home page", () => {
    const html = `<p><img src="./media/logo.svg" alt="Logo"></p>`;
    expect(rewriteMediaUrls(html, (url) => assetHref("", normalizeSiteAssetUrl(url)))).toBe(
      `<p><img src="./media/logo.svg" alt="Logo"></p>`,
    );
    expect(rewriteMediaUrls(html, (url) => assetHref("events/fair", normalizeSiteAssetUrl(url)))).toBe(
      `<p><img src="../../media/logo.svg" alt="Logo"></p>`,
    );
    expect(rewriteMediaUrls(`<img src="../../media/logo.svg" alt="">`, (url) => assetHref("events/fair", url))).toBe(
      `<img src="../../media/logo.svg" alt="">`,
    );
  });
});
