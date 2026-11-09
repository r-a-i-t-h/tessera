import type { DatasetSummary } from "./dataset-store.js";
import { KIND_LABELS, type RecordKind } from "./kinds.js";
import { PREVIEW_SITE_HREF, publishedSiteHref } from "./site-hrefs.js";
import type { RecordSummary } from "./store.js";

export type EditorIndexItem = {
  category: string;
  label: string;
  filterText: string;
  hash?: string;
  href?: string;
  action?: "render" | "publish";
};

export type EditorIndexPayload = {
  ok: true;
  version: string;
  items: EditorIndexItem[];
};

type BuildEditorIndexInput = {
  records: RecordSummary[];
  datasets: DatasetSummary[];
  users: string[];
  admin: boolean;
  siteListingVersion: string;
  datasetListingVersion: string;
  /** Live site origin from `site.yaml`, if any. */
  siteOrigin?: string;
};

function encodeHash(path: string): string {
  return `#/${path.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function recordLabel(row: RecordSummary): string {
  if (row.kind === "site" || row.kind === "nav" || row.kind === "content") {
    return row.title?.trim() || row.id;
  }
  return row.id;
}

function contentCategory(type: string | undefined): string {
  if (type === "article") return "Article";
  if (type === "blog") return "Blog";
  if (type === "blog-index") return "Blog index";
  return "Page";
}

function recordHash(row: RecordSummary): string {
  if (row.kind === "site") return "#/records/site";
  if (row.kind === "nav") return "#/navigation";
  return encodeHash(`${row.kind}/${row.id}`);
}

function filterText(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function item(
  category: string,
  label: string,
  extra: { hash?: string; href?: string; action?: "render" | "publish" },
  ...filterParts: string[]
): EditorIndexItem {
  return {
    category,
    label,
    filterText: filterText([category, label, ...filterParts]),
    ...extra,
  };
}

function recordItems(records: RecordSummary[]): EditorIndexItem[] {
  const out: EditorIndexItem[] = [];
  for (const row of records) {
    if (row.kind === "media" || row.kind === "folders") continue;
    const label = recordLabel(row);
    if (row.kind === "content") {
      const category = contentCategory(row.type);
      out.push(
        item(category, label, { hash: recordHash(row) }, row.id, row.type ?? "", row.parentId ?? "", ...(row.tags ?? [])),
      );
      continue;
    }
    if (row.kind === "site") {
      out.push(item("Site", label, { hash: recordHash(row) }, row.id));
      continue;
    }
    if (row.kind === "nav") {
      out.push(item("Navigation", label, { hash: recordHash(row) }, row.id));
      continue;
    }
    const kind = row.kind as RecordKind;
    const category = KIND_LABELS[kind] ?? kind;
    out.push(item(category, label, { hash: recordHash(row) }, row.id, ...(row.tags ?? [])));
  }
  return out;
}

function datasetItems(datasets: DatasetSummary[]): EditorIndexItem[] {
  const out: EditorIndexItem[] = [];
  for (const d of datasets) {
    const label = d.title.trim() || d.id;
    out.push(item("Data", label, { hash: encodeHash(`data/${d.id}`) }, d.id));
    out.push(item("Dataset", label, { hash: encodeHash(`records/datasets/${d.id}`) }, d.id));
  }
  return out;
}

function staticDestinations(admin: boolean, siteOrigin: string | undefined): EditorIndexItem[] {
  const publishedHref = publishedSiteHref(siteOrigin);
  const out: EditorIndexItem[] = [
    item("Editor", "Tessera home", { hash: "#/" }, "home"),
    item("Editor", "Pages list", { hash: "#/pages" }, "pages"),
    item("Editor", "Articles", { hash: "#/articles" }, "articles"),
    item("Editor", "Navigation", { hash: "#/navigation" }, "nav"),
    item("Editor", "Library", { hash: "#/library" }, "library"),
    item("Editor", "Data", { hash: "#/data" }, "data"),
    item("Editor", "Guide", { hash: "#/guide" }, "guide"),
    item("Action", "Open preview", { href: PREVIEW_SITE_HREF }, "preview", "open"),
    item("Action", "Render preview", { action: "render" }, "preview", "render"),
    item("Action", "Publish site", { action: "publish" }, "publish"),
  ];
  if (publishedHref) {
    out.push(item("Action", "Open published site", { href: publishedHref }, "published", "live", "open"));
  }
  if (admin) {
    out.push(
      item("Editor", "Styles", { hash: "#/styles" }, "styles"),
      item("Editor", "Site setup", { hash: "#/records/site" }, "site", "setup"),
      item("Editor", "Layouts list", { hash: "#/records/layouts" }, "layouts"),
      item("Editor", "Types list", { hash: "#/records/types" }, "types"),
      item("Editor", "Templates list", { hash: "#/records/templates" }, "templates"),
      item("Editor", "Items list", { hash: "#/records/items" }, "items"),
      item("Editor", "Blogs list", { hash: "#/records/blogs" }, "blogs"),
      item("Editor", "Datasets setup", { hash: "#/records/datasets" }, "datasets"),
      item("Editor", "Bindings list", { hash: "#/records/bindings" }, "bindings"),
      item("Editor", "Runtime modules list", { hash: "#/records/runtimeModules" }, "runtime", "modules"),
      item("Editor", "Maintenance", { hash: "#/maintenance" }, "maintenance"),
      item("Editor", "Backups", { hash: "#/backups" }, "backups"),
      item("Editor", "Users list", { hash: "#/users" }, "users"),
    );
  }
  return out;
}

function userItems(usernames: string[]): EditorIndexItem[] {
  return usernames.map((username) =>
    item("User", username, { hash: encodeHash(`users/${username}`) }, username),
  );
}

/** Bump when static palette destinations or ordering change (invalidates editor index ETags). */
const EDITOR_INDEX_REVISION = 2;

/** Palette sections pinned above alphabetical content categories. */
const PALETTE_CATEGORY_RANK: Record<string, number> = {
  Editor: 0,
  Action: 1,
};

const PINNED_OPEN_LABELS = ["Open preview", "Open published site"] as const;

function paletteCategoryRank(category: string): number {
  return PALETTE_CATEGORY_RANK[category] ?? 2;
}

function palettePinRank(item: EditorIndexItem): number {
  const pinned = PINNED_OPEN_LABELS.indexOf(item.label as (typeof PINNED_OPEN_LABELS)[number]);
  if (pinned >= 0) return pinned;
  return PINNED_OPEN_LABELS.length + paletteCategoryRank(item.category);
}

function comparePaletteItems(a: EditorIndexItem, b: EditorIndexItem): number {
  const byPin = palettePinRank(a) - palettePinRank(b);
  if (byPin !== 0) return byPin;
  const byRank = paletteCategoryRank(a.category) - paletteCategoryRank(b.category);
  if (byRank !== 0) return byRank;
  const byCategory = a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
  if (byCategory !== 0) return byCategory;
  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

/** Build the editor command palette index (titles and ids only). */
export function buildEditorIndex(input: BuildEditorIndexInput): EditorIndexPayload {
  const items = [
    ...staticDestinations(input.admin, input.siteOrigin),
    ...recordItems(input.records),
    ...(input.admin ? datasetItems(input.datasets) : []),
    ...(input.admin ? userItems(input.users) : []),
  ];
  items.sort(comparePaletteItems);
  return {
    ok: true,
    version: `${EDITOR_INDEX_REVISION}:${input.siteListingVersion}:${input.datasetListingVersion}`,
    items,
  };
}
