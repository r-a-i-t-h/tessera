import { describe, expect, it } from "vitest";
import { guideSectionHref, guideSectionQuery, parseRoute, stylesSheetHref, stylesSheetQuery } from "./router.js";

describe("parseRoute", () => {
  it.each([
    ["", { page: "home" }],
    ["#", { page: "home" }],
    ["#/", { page: "home" }],
    ["#/records", { page: "records", kind: undefined }],
    ["#/records/content", { page: "records", kind: "content" }],
    ["#/records/content/extra", { page: "missing" }],
    ["#/records/runtimeModules", { page: "runtime-modules", id: null }],
    ["#/records/runtimeModules/demo", { page: "runtime-modules", id: "demo" }],
    ["#/records/runtimeModules/demo/extra", { page: "missing" }],
    ["#/runtime-modules", { page: "runtime-modules", id: null }],
    ["#/runtime-modules/demo", { page: "runtime-modules", id: "demo" }],
    ["#/data", { page: "data", datasetId: undefined }],
    ["#/data/meetings", { page: "data", datasetId: "meetings" }],
    ["#/data/meetings/extra", { page: "missing" }],
    ["#/datasets", { page: "data", datasetId: undefined }],
    ["#/datasets/meetings", { page: "data", datasetId: "meetings" }],
    ["#/records/datasets", { page: "records", kind: "datasets", setupDataset: undefined }],
    ["#/records/datasets/demo-items", { page: "records", kind: "datasets", setupDataset: "demo-items" }],
    ["#/library", { page: "library", id: null }],
    ["#/library/image-folder", { page: "library", id: "image-folder" }],
    ["#/library/nested/folder", { page: "library", id: "nested/folder" }],
    ["#/maintenance", { page: "maintenance", tab: undefined }],
    ["#/maintenance/orphans", { page: "maintenance", tab: "orphans" }],
    ["#/maintenance/orphans/extra", { page: "missing" }],
    ["#/backups", { page: "backups" }],
    ["#/styles", { page: "styles" }],
    ["#/styles?sheet=site", { page: "styles", sheet: "site" }],
    ["#/styles?sheet=w3", { page: "styles", sheet: "w3" }],
    ["#/guide", { page: "guide" }],
    ["#/account", { page: "account" }],
    ["#/users", { page: "users" }],
    ["#/users/alice", { page: "user", username: "alice" }],
    ["#/pages", { page: "pages" }],
    ["#/navigation", { page: "navigation" }],
    ["#/articles", { page: "articles", blog: undefined }],
    ["#/articles/hall", { page: "articles", blog: "hall" }],
    ["#/articles/hall/extra", { page: "missing" }],
    ["#/content/home", { page: "edit", kind: "content", id: "home" }],
    ["#/templates/article", { page: "edit", kind: "templates", id: "article" }],
    ["#/layouts/standard", { page: "edit", kind: "layouts", id: "standard" }],
    ["#/content", { page: "missing" }],
    ["#/content/home/extra", { page: "missing" }],
    ["#/unknown/value", { page: "edit", kind: "unknown", id: "value" }],
  ] as const)("maps %s", (hash, expected) => {
    expect(parseRoute(hash)).toEqual(expected);
  });

  it.each(["backups", "styles", "guide", "account"])(
    "rejects an extra segment on the %s route",
    (page) => {
      expect(parseRoute(`#/${page}/extra`)).toEqual({ page: "missing" });
    },
  );

  it("keeps the legacy site link on its embedded record tab and sends nav links to Navigation", () => {
    expect(parseRoute("#/site/demo")).toEqual({ page: "records", kind: "site" });
    expect(parseRoute("#/nav/nav")).toEqual({ page: "navigation" });
    expect(parseRoute("#/site")).toEqual({ page: "missing" });
    expect(parseRoute("#/nav/nav/extra")).toEqual({ page: "missing" });
  });

  it("decodes route values after separating path segments", () => {
    expect(parseRoute("#/content/foo%20bar")).toEqual({
      page: "edit",
      kind: "content",
      id: "foo bar",
    });
    expect(parseRoute("#/records/content%2Farchive")).toEqual({ page: "missing" });
  });

  it("surfaces malformed URI encoding instead of silently changing the route", () => {
    expect(() => parseRoute("#/content/bad%")).toThrow(URIError);
  });

  it("reads sheet from hash query for styles deep links", () => {
    expect(stylesSheetQuery("#/styles?sheet=tessera")).toBe("tessera");
    expect(stylesSheetQuery("#/styles")).toBeUndefined();
  });

  it("builds a maximized stylesheet href", () => {
    expect(stylesSheetHref("local")).toBe("#/styles?sheet=local");
  });

  it("reads section from hash query for guide deep links", () => {
    expect(guideSectionQuery("#/guide?section=menus")).toBe("menus");
    expect(guideSectionQuery("#/guide")).toBeUndefined();
    expect(guideSectionQuery("#/pages")).toBeUndefined();
  });

  it("builds a guide section href", () => {
    expect(guideSectionHref("page-links-wiki-style")).toBe("#/guide?section=page-links-wiki-style");
  });
});
