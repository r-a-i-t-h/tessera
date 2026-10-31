import type { DatasetSummary } from "./dataset-store.js";
import { KIND_LABELS, type RecordKind } from "./kinds.js";
import type { RecordSummary } from "./store.js";

export type EditorIndexItem = {
  category: string;
  label: string;
  filterText: string;
  hash?: string;
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
  extra: { hash?: string; action?: "render" | "publish" },
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
  return datasets.map((d) => {
    const label = d.title.trim() || d.id;
    return item("Dataset", label, { hash: encodeHash(`data/${d.id}`) }, d.id);
  });
}

function staticDestinations(admin: boolean): EditorIndexItem[] {
  const out: EditorIndexItem[] = [
    item("Editor", "Tessera home", { hash: "#/" }, "home"),
    item("Editor", "Pages list", { hash: "#/pages" }, "pages"),
    item("Editor", "Articles", { hash: "#/articles" }, "articles"),
    item("Editor", "Navigation", { hash: "#/navigation" }, "nav"),
    item("Editor", "Library", { hash: "#/library" }, "library"),
    item("Editor", "Data", { hash: "#/data" }, "data"),
    item("Editor", "Guide", { hash: "#/guide" }, "guide"),
    item("Action", "Render preview", { action: "render" }, "preview"),
    item("Action", "Publish site", { action: "publish" }, "publish"),
  ];
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

/** Build the editor command palette index (titles and ids only). */
export function buildEditorIndex(input: BuildEditorIndexInput): EditorIndexPayload {
  const items = [
    ...staticDestinations(input.admin),
    ...recordItems(input.records),
    ...(input.admin ? datasetItems(input.datasets) : []),
    ...(input.admin ? userItems(input.users) : []),
  ];
  items.sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
    if (byCategory !== 0) return byCategory;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
  return {
    ok: true,
    version: `${input.siteListingVersion}:${input.datasetListingVersion}`,
    items,
  };
}
