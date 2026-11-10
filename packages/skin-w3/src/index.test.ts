import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { w3Panel, w3Quote, w3Skin } from "./index.js";

const tesseraCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../css/tessera.css"),
  "utf8",
);

describe("tessera.css", () => {
  it("scrolls in-page hash targets below the fixed top bar", () => {
    expect(tesseraCss).toContain("scroll-padding-top: var(--tessera-bar-height)");
  });
});

describe("W3 skin helpers", () => {
  it("combines semantic region and authored classes", () => {
    expect(w3Skin.regionClass?.("main", "feature")).toBe("w3-container feature");
    expect(w3Skin.regionClass?.("unknown", "feature")).toBe("feature");
  });

  it("wraps trusted component HTML without rewriting it", () => {
    expect(w3Panel("<strong>Notice</strong>")).toBe(
      `<div class="w3-panel w3-theme-l4 w3-padding"><strong>Notice</strong></div>`,
    );
    expect(w3Quote("Words")).toContain("<p>Words</p>");
  });
});
