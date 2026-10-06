import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuthoredRecordError, validateAuthoredRecord } from "../src/site/authored-schema.js";
import { fromYaml } from "../src/site/document.js";
import { isRecordKind } from "../src/site/kinds.js";
import { repoRoot } from "../src/site/paths.js";
import { SiteStore } from "../src/site/store.js";

describe("authored record validation", () => {
  it("reports a field path for invalid page values", () => {
    expect(() => validateAuthoredRecord("content", "home", {
      id: "home",
      title: 42,
      zones: { main: { html: "<p>Hello</p>" } },
    })).toThrow(expect.objectContaining({
      name: "AuthoredRecordError",
      kind: "content",
      id: "home",
      field: "title",
    }));

    expect(() => validateAuthoredRecord("content", "home", {
      id: "home",
      title: "Home",
      zones: { main: { component: 42 } },
    })).toThrow(expect.objectContaining({
      name: "AuthoredRecordError",
      field: "zones.main.component",
    }));
  });

  it("rejects malformed layouts before they are written", () => {
    expect(() => validateAuthoredRecord("layouts", "standard", {
      id: "standard",
      root: { type: "unknown" },
    })).toThrow(AuthoredRecordError);
  });

  it("permits editor extensions and both media and folder record forms", () => {
    expect(() => validateAuthoredRecord("templates", "article", {
      id: "article",
      title: "Editor-only title",
      locked: true,
      templateId: "base",
      zones: { main: { json: { draft: true } } },
    })).not.toThrow();
    expect(() => validateAuthoredRecord("media", "logo", {
      id: "logo",
      url: "/assets/logo.svg",
      customCredit: "Example",
    })).not.toThrow();
    expect(() => validateAuthoredRecord("media", "upload", {
      id: "upload",
      kind: "image",
      ext: "webp",
      folderId: "photos",
    })).not.toThrow();
    expect(() => validateAuthoredRecord("folders", "photos", {
      id: "photos",
      title: "Photos",
      path: "/assets/photos",
    })).not.toThrow();
    expect(() => validateAuthoredRecord("folders", "uploads", {
      id: "uploads",
      title: "Uploads",
      parentId: "photos",
    })).not.toThrow();
  });

  it("accepts every authored record in the Willow reference site", async () => {
    const store = new SiteStore(join(repoRoot, "sites", "willow", "records"));
    for (const summary of await store.list()) {
      if (summary.kind === "site") {
        validateAuthoredRecord("site", summary.id, await store.readSite());
      } else if (summary.kind === "nav") {
        validateAuthoredRecord("nav", "nav", await store.readNav());
      } else if (isRecordKind(summary.kind)) {
        validateAuthoredRecord(
          summary.kind,
          summary.id,
          fromYaml(await store.readRaw(summary.kind, summary.id)),
        );
      }
    }
  });
});
