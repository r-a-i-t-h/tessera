import { describe, expect, it } from "vitest";
import { parseRoute } from "./router.js";

describe("parseRoute", () => {
  it.each([
    ["", { page: "home" }],
    ["#", { page: "home" }],
    ["#/", { page: "home" }],
    ["#/records", { page: "records", kind: undefined }],
    ["#/records/content", { page: "records", kind: "content" }],
    ["#/records/content/extra", { page: "missing" }],
    ["#/library", { page: "library", id: null }],
    ["#/library/image-folder", { page: "library", id: "image-folder" }],
    ["#/library/nested/folder", { page: "library", id: "nested/folder" }],
    ["#/backups", { page: "backups" }],
    ["#/styles", { page: "styles" }],
    ["#/guide", { page: "guide" }],
    ["#/account", { page: "account" }],
    ["#/users", { page: "users" }],
    ["#/users/alice", { page: "user", username: "alice" }],
    ["#/pages", { page: "pages" }],
    ["#/articles", { page: "articles", tenant: undefined }],
    ["#/articles/hall", { page: "articles", tenant: "hall" }],
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

  it("keeps the legacy site and navigation links on their embedded record tabs", () => {
    expect(parseRoute("#/site/demo")).toEqual({ page: "records", kind: "site" });
    expect(parseRoute("#/nav/nav")).toEqual({ page: "records", kind: "nav" });
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
});
