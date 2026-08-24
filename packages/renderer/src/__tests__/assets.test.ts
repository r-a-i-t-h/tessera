import { describe, expect, it } from "vitest";
import { normalizeSiteAssetUrl, isRootAbsoluteUrl } from "../assets.js";

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
});
