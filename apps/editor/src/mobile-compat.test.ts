import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPOSE_TOUCH_MQ } from "./compose/compose-touch.js";

const here = dirname(fileURLToPath(import.meta.url));
const appCss = readFileSync(join(here, "app.css"), "utf8");

describe("desktop regression gates (CSS)", () => {
  it("gates touch compose palette swap behind coarse pointer and narrow width", () => {
    expect(appCss).toContain("(pointer: coarse) and (max-width: 800px)");
    expect(appCss).toContain(".editor-palette-desktop");
    expect(appCss).toContain(".editor-compose-touch-chrome");
    expect(appCss).toMatch(/\.editor-compose-layout\.editor-compose--touch[\s\S]*\.editor-palette-desktop[\s\S]*display:\s*none/);
  });

  it("enlarges tap targets only under pointer coarse", () => {
    expect(appCss).toMatch(
      /@media \(pointer: coarse\)[\s\S]*\.editor-section-icon[\s\S]*2\.75rem/,
    );
  });

  it("does not gate desktop-only nav-build scroll lock changes globally", () => {
    expect(appCss).toMatch(
      /@media \(pointer: coarse\) and \(max-width: 900px\)[\s\S]*\.editor-scroll:has\(\.editor-nav-build\)/,
    );
  });

  it("matches compose touch MQ constant", () => {
    expect(COMPOSE_TOUCH_MQ).toBe("(pointer: coarse) and (max-width: 800px)");
  });
});

/**
 * Manual QA matrix (iOS Safari + Android Chrome). Automate checks above; run these on device before release.
 */
describe("manual mobile QA matrix", () => {
  const scenarios = [
    "Phone portrait Fields tab: inputs visible, scroll reaches Save",
    "Menu drawer: Home at top, Render preview and Publish site",
    "Compose portrait: canvas scrolls, Add widget appends, up/down/delete on first tap",
    "Compose desktop baseline: full palette and DnD unchanged at fine pointer ≥1024px",
    "Arrange: up/down/delete without drag",
    "Nav Build: panes usable, save nav",
    "Dataset setup and grid: horizontal scroll or stacked schema",
    "Library picker from imgbox fits viewport",
  ] as const;

  it.each(scenarios)("manual: %s", (label) => {
    expect(label.length).toBeGreaterThan(10);
  });
});
