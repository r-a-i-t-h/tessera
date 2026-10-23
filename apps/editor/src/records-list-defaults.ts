/**
 * Default ordering when resolving bare `#/records` (see `recordTabs` in app.ts).
 * Intentionally separate from the sidebar Setup menu.
 */
export const DEFAULT_RECORD_LIST_KIND_ORDER: readonly string[] = [
  "site",
  "layouts",
  "types",
  "templates",
  "items",
  "blogs",
  "datasets",
  "bindings",
  "runtimeModules",
];

/** Labels for editor-only `#/records/<kind>` routes not returned as API record kinds. */
export const EDITOR_ONLY_RECORD_KIND_LABELS: Readonly<Record<string, string>> = {
  blogs: "Blogs",
  datasets: "Datasets",
};
