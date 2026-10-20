import { describe, expect, it } from "vitest";
import {
  maintenanceHtml,
  maintenanceTabCount,
  maintenanceTabId,
  MAINTENANCE_TABS,
} from "./maintenance.js";
import type { MaintenanceReport } from "./api.js";

const emptyReport: MaintenanceReport = {
  ok: true,
  orphans: [],
  unusedAssets: [],
  brokenRefs: [],
  unusedItems: [],
  unusedLayouts: [],
  unknownBindings: [],
  unreachableNav: [],
  rescanDrift: { danglingMedia: [], scannedAssets: [] },
};

describe("maintenance tabs", () => {
  it("overview when no tab is selected", () => {
    expect(maintenanceTabId(undefined)).toBeUndefined();
    expect(maintenanceTabId("nope")).toBeUndefined();
    expect(maintenanceTabId("broken")).toBe("broken");
  });

  it("overview lists report counts without findings", () => {
    const html = maintenanceHtml(
      {
        ...emptyReport,
        orphans: [{ href: "#/content/lonely", label: "Lonely", detail: "lonely" }],
        brokenRefs: [
          { href: "#/content/home", label: "Home", detail: "x" },
          { href: "#/content/about", label: "About", detail: "y" },
        ],
      },
      undefined,
    );
    expect(html).toContain("<h1 class=\"w3-large\">Maintenance</h1>");
    expect(html).not.toContain('aria-label="Maintenance reports"');
    expect(html).not.toContain('<a href="#/content/lonely">Lonely</a>');
    expect(html).toContain('href="#/maintenance/orphans"');
    expect(html).toContain("<strong>1</strong>");
    expect(html).toContain("<strong>2</strong>");
    expect(html).toContain('class="w3-text-grey">0</span>');
  });

  it("renders findings on a report sub-page", () => {
    const html = maintenanceHtml(
      {
        ...emptyReport,
        orphans: [{ href: "#/content/lonely", label: "Lonely", detail: "lonely" }],
      },
      "orphans",
    );
    expect(html).toContain('href="#/maintenance"');
    expect(html).toContain("Orphan pages");
    expect(html).toContain('<a href="#/content/lonely">Lonely</a>');
    expect(html).toContain("lonely");
    expect(MAINTENANCE_TABS).toHaveLength(7);
    expect(MAINTENANCE_TABS[0]).toEqual({ id: "orphans", label: "Orphan pages" });
  });

  it("counts unused items and rescan drift together", () => {
    expect(
      maintenanceTabCount(
        {
          ...emptyReport,
          unusedItems: [{ href: "#/items/a", label: "A" }],
          unusedLayouts: [{ href: "#/layouts/b", label: "B" }],
          rescanDrift: {
            danglingMedia: [{ href: "#/content/x", label: "X" }],
            scannedAssets: [],
          },
        },
        "unused",
      ),
    ).toBe(2);
    expect(
      maintenanceTabCount(
        {
          ...emptyReport,
          rescanDrift: {
            danglingMedia: [{ href: "#/content/x", label: "X" }],
            scannedAssets: [{ href: "#/library/scanned/y", label: "Y" }],
          },
        },
        "rescan",
      ),
    ).toBe(2);
  });

  it("escapes labels and details", () => {
    const html = maintenanceHtml(
      {
        ...emptyReport,
        brokenRefs: [
          {
            href: "#/content/home",
            label: "<Home>",
            detail: "missing page: <x>",
          },
        ],
      },
      "broken",
    );
    expect(html).toContain("&lt;Home&gt;");
    expect(html).toContain("missing page: &lt;x&gt;");
    expect(html).not.toContain("<Home>");
  });
});
