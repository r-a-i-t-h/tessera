import { describe, expect, it } from "vitest";
import { createDefaultRegistry } from "../default-registry.js";

describe("default component registry", () => {
  it("contains every navigation and gallery built-in plus caller extensions", () => {
    const registry = createDefaultRegistry((define) => {
      define("extraExample", () => "extra");
    });

    for (const name of [
      "navTree",
      "navCollapse",
      "navPane",
      "navTags",
      "navFlat",
      "breadcrumbs",
      "linkCluster",
      "gallery",
      "documents",
      "imageRevealGallery",
      "searchBox",
      "searchResults",
      "htmlEmbed",
      "extraExample",
    ]) {
      expect(registry.hasFunction(name), name).toBe(true);
    }
  });
});
