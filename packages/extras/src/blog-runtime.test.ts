import { describe, expect, it } from "vitest";
import { blogHash, blogStateFromHash, isFutureDate } from "./blog-runtime.js";

describe("blog dates and hashes", () => {
  it("hides a date-only article until that local day", () => {
    expect(isFutureDate("2026-10-09", "2026-10-08")).toBe(true);
    expect(isFutureDate("2026-10-08", "2026-10-08")).toBe(false);
    expect(isFutureDate("not-a-date", "2026-10-08")).toBe(false);
  });

  it("reads a snapshot hash and a pages hash", () => {
    expect(blogStateFromHash("#news/tenant/hall/tag/fair/slice/2", "news")).toEqual({
      tenant: "hall",
      tag: "fair",
      slice: 2,
    });
    expect(blogStateFromHash("#tenant/admin", "news")).toEqual({ tenant: "admin", slice: 0 });
  });

  it("builds the hash onto the page href", () => {
    expect(blogHash("news", "#news", { tenant: "hall", slice: 0 })).toBe("#news/tenant/hall");
    expect(blogHash("news", "./news/", { tag: "fair", slice: 1 })).toBe("./news/#tag/fair/slice/1");
  });
});
