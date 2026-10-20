import { describe, expect, it } from "vitest";
import {
  activeMaintenanceTab,
  maintenanceHtml,
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
  it("defaults to orphans", () => {
    expect(activeMaintenanceTab(undefined)).toBe("orphans");
    expect(activeMaintenanceTab("nope")).toBe("orphans");
    expect(activeMaintenanceTab("broken")).toBe("broken");
  });

  it("renders findings as editor links", () => {
    const html = maintenanceHtml(
      {
        ...emptyReport,
        orphans: [{ href: "#/content/lonely", label: "Lonely", detail: "lonely" }],
      },
      "orphans",
    );
    expect(html).toContain("<h1 class=\"w3-large\">Maintenance</h1>");
    expect(html).toContain('href="#/maintenance/orphans" aria-current="page"');
    expect(html).toContain('<a href="#/content/lonely">Lonely</a>');
    expect(html).toContain("lonely");
    expect(MAINTENANCE_TABS).toHaveLength(7);
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
