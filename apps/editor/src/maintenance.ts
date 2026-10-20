import type { MaintenanceFinding, MaintenanceReport } from "./api.js";
import { escapeHtml, statusPanels } from "./dom.js";

export type MaintenanceTabId =
  | "orphans"
  | "assets"
  | "broken"
  | "unused"
  | "unknown"
  | "nav"
  | "rescan";

export const MAINTENANCE_TABS: { id: MaintenanceTabId; label: string }[] = [
  { id: "orphans", label: "Orphan pages" },
  { id: "assets", label: "Unused assets" },
  { id: "broken", label: "Broken refs" },
  { id: "unused", label: "Unused items" },
  { id: "unknown", label: "Unknown bindings" },
  { id: "nav", label: "Unreachable nav" },
  { id: "rescan", label: "Rescan drift" },
];

export function activeMaintenanceTab(selected?: string): MaintenanceTabId {
  if (MAINTENANCE_TABS.some((tab) => tab.id === selected)) {
    return selected as MaintenanceTabId;
  }
  return "orphans";
}

function findingList(items: MaintenanceFinding[], empty: string): string {
  if (!items.length) {
    return `<p class="w3-text-grey">${escapeHtml(empty)}</p>`;
  }
  const rows = items
    .map((item) => {
      const detail = item.detail
        ? ` <span class="w3-text-grey w3-small">${escapeHtml(item.detail)}</span>`
        : "";
      return `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>${detail}</li>`;
    })
    .join("");
  return `<ul class="w3-ul">${rows}</ul>`;
}

function tabBody(report: MaintenanceReport, tab: MaintenanceTabId): string {
  switch (tab) {
    case "orphans":
      return `<p class="w3-small w3-text-grey">Pages that are not home, not in the nav, and not linked from another page. Articles under a reachable blog are omitted.</p>
        ${findingList(report.orphans, "No orphan pages.")}`;
    case "assets":
      return `<p class="w3-small w3-text-grey">Library media that no page, item, layout, or binding references.</p>
        ${findingList(report.unusedAssets, "No unused library assets.")}`;
    case "broken":
      return `<p class="w3-small w3-text-grey">Missing page links, media, or gallery folders. Each link opens the record that holds the bad reference.</p>
        ${findingList(report.brokenRefs, "No broken references.")}`;
    case "unused":
      return `<h2 class="w3-medium">Items</h2>
        ${findingList(report.unusedItems, "Every item is included somewhere.")}
        <h2 class="w3-medium">Layouts</h2>
        ${findingList(report.unusedLayouts, "Every layout is in use.")}`;
    case "unknown":
      return `<p class="w3-small w3-text-grey">Mustache names with no binding, or components the registry does not know.</p>
        ${findingList(report.unknownBindings, "No unknown bindings or components.")}`;
    case "nav":
      return `<p class="w3-small w3-text-grey">Designed nav rows whose page id is missing.</p>
        ${findingList(report.unreachableNav, "Every nav target resolves.")}`;
    case "rescan":
      return `<h2 class="w3-medium">Dangling media</h2>
        <p class="w3-small w3-text-grey">Content still pointing at media that is not in the library.</p>
        ${findingList(report.rescanDrift.danglingMedia, "No dangling media references.")}
        <h2 class="w3-medium">Scanned folder</h2>
        <p class="w3-small w3-text-grey">Assets rescan imported into the scanned folder — move or delete after review.</p>
        ${findingList(report.rescanDrift.scannedAssets, "The scanned folder is empty.")}`;
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

export function maintenanceHtml(
  report: MaintenanceReport,
  selected: string | undefined,
  notice = "",
  error = "",
): string {
  const active = activeMaintenanceTab(selected);
  return `<h1 class="w3-large">Maintenance</h1>
    ${statusPanels(notice, error)}
    <p class="w3-text-grey">Site health reports. Each finding links to the editor record to fix.</p>
    <section class="editor-kind">${tabBody(report, active)}</section>`;
}
