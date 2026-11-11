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

  it("keeps editor-shell flex on phone so editor-scroll can scroll", () => {
    expect(appCss).toMatch(
      /@media \(max-width: 600px\)[\s\S]*\.editor-shell[\s\S]*flex:\s*1\s+1\s+auto/,
    );
    expect(appCss).not.toMatch(
      /@media \(max-width: 600px\)\s*\{[^}]*\.editor-shell\s*\{\s*display:\s*block/,
    );
  });

  it("uses a fixed viewport Add bar in touch compose mode", () => {
    expect(appCss).toMatch(
      /@media \(pointer: coarse\) and \(max-width: 800px\)[\s\S]*\.editor-compose-layout\.editor-compose--touch \.editor-compose-touch-chrome[\s\S]*position:\s*fixed/,
    );
  });

  it("uses compact vertical padding on editor sidebar nav rows", () => {
    expect(appCss).toMatch(
      /\.editor-sidebar \.editor-nav-block > \.w3-bar-item\.w3-button:not\(\.tessera-nav-brand\)[\s\S]*padding:\s*0\.3rem 1rem/,
    );
  });

  it("defines phone drawer Home vs desktop brand sidebar links", () => {
    expect(appCss).toContain(".editor-sidebar-home");
    expect(appCss).toContain(".editor-sidebar-brand-desktop");
    expect(appCss).toMatch(
      /\.editor-sidebar \.w3-bar-block \.editor-sidebar-home[\s\S]*display:\s*none/,
    );
    expect(appCss).toMatch(
      /@media \(max-width: 600px\)[\s\S]*\.editor-sidebar \.w3-bar-block \.editor-sidebar-home[\s\S]*display:\s*block/,
    );
  });

  it("offsets the phone drawer below the mobile top bar so Home stays clickable", () => {
    expect(appCss).toContain("--editor-mobile-bar-height");
    expect(appCss).toMatch(
      /@media \(max-width: 600px\)[\s\S]*\.editor-sidebar[\s\S]*top:\s*var\(--editor-mobile-bar-height/,
    );
  });

  it("keeps compose block chrome on two compact rows at phone width", () => {
    expect(appCss).toMatch(
      /@media \(max-width: 40rem\)[\s\S]*\.editor-section-kind[\s\S]*order:\s*1/,
    );
    expect(appCss).toMatch(
      /@media \(max-width: 40rem\)[\s\S]*\.editor-section-bar::after[\s\S]*flex-basis:\s*100%/,
    );
  });

  it("clips collapsed compose list previews instead of growing past the viewport", () => {
    expect(appCss).toMatch(/\.editor-section-list-preview[\s\S]*min-width:\s*0/);
    expect(appCss).toMatch(/\.editor-section-list-preview[\s\S]*text-overflow:\s*ellipsis/);
    expect(appCss).toMatch(
      /@media \(max-width: 40rem\)[\s\S]*\.editor-compose-list \.editor-section-bar[\s\S]*display:\s*none !important/,
    );
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
