import type { Folder, Media } from "@r-a-i-t-h/tessera-model";
import { isRecordId } from "./kinds.js";

/** Reserved inbox. Created on first upload that asks for it. Cannot be deleted. */
export const UPLOADS_ID = "uploads";

/** Inbox for files rescan finds on disk. Created only when a scan imports something. */
export const SCANNED_ID = "scanned";

/** Hero images uploaded from an article. Created on the first of those uploads. */
export const ARTICLES_ID = "articles";

export const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "pdf"]);

export type AssetKind = "image" | "document";

export type LibraryAsset = {
  id: string;
  name: string;
  kind: AssetKind;
  ext: string;
  folderId?: string;
  title?: string;
  alt?: string;
  caption?: string;
  sort?: number;
};

export type LibraryFolder = {
  id: string;
  parentId?: string;
};

export function publicAssetUrl(id: string, ext: string): string {
  return `./media/${id}.${ext.replace(/^\./, "").toLowerCase()}`;
}

export function normalizeExt(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  const ext = (match?.[1] ?? "").toLowerCase();
  return ext === "jpeg" ? "jpg" : ext;
}

export function kindForExt(ext: string): AssetKind | undefined {
  const normalized = ext === "jpeg" ? "jpg" : ext.toLowerCase();
  if (!ALLOWED_EXT.has(normalized) && normalized !== "jpg") return undefined;
  return normalized === "pdf" ? "document" : "image";
}

/** Slug that satisfies the record id rule. Empty or odd names become `file`. */
export function slugFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  let slug = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/-+/g, "-")
    .replace(/-+$/g, "");
  if (!slug || !/^[a-z0-9]/i.test(slug)) slug = slug ? `file-${slug}` : "file";
  return slug.slice(0, 80);
}

export function uniqueId(base: string, taken: Set<string>): string {
  const root = isRecordId(base) ? base : "file";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

export function uniqueName(name: string, taken: Set<string>): string {
  const key = name.toLowerCase();
  if (!taken.has(key)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (taken.has(`${stem}-${n}${ext}`.toLowerCase())) n += 1;
  return `${stem}-${n}${ext}`;
}

/**
 * Relative path from a drop, split into folder ids and a filename.
 * `..` and empty segments are rejected.
 */
export function splitRelativePath(relativePath: string): { folders: string[]; file: string } | undefined {
  const cleaned = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("\0")) return undefined;
  const parts = cleaned.split("/").filter((part) => part.length > 0);
  if (parts.some((part) => part === "." || part === "..")) return undefined;
  const file = parts.pop();
  if (!file) return undefined;
  return { folders: parts, file };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isLibraryAsset(row: Record<string, unknown>): boolean {
  return row.kind === "image" || row.kind === "document";
}

export function isDirectoryNode(row: Record<string, unknown>): boolean {
  return typeof row.path !== "string" || row.path.length === 0;
}

function mediaType(asset: LibraryAsset): Media["type"] {
  if (asset.kind === "document") return "document";
  if (asset.ext === "jpg" || asset.ext === "png" || asset.ext === "gif" || asset.ext === "webp" || asset.ext === "svg") {
    return asset.ext;
  }
  return "image";
}

export function parseLibraryAsset(row: Record<string, unknown>): LibraryAsset | undefined {
  if (typeof row.id !== "string" || !isLibraryAsset(row)) return undefined;
  const ext = typeof row.ext === "string" ? row.ext.replace(/^\./, "").toLowerCase() : "";
  if (!ext) return undefined;
  const name = typeof row.name === "string" && row.name.trim() ? row.name : `${row.id}.${ext}`;
  return {
    id: row.id,
    name,
    kind: row.kind as AssetKind,
    ext: ext === "jpeg" ? "jpg" : ext,
    ...(typeof row.folderId === "string" ? { folderId: row.folderId } : {}),
    ...(typeof row.title === "string" ? { title: row.title } : {}),
    ...(typeof row.alt === "string" ? { alt: row.alt } : {}),
    ...(typeof row.caption === "string" ? { caption: row.caption } : {}),
    ...(typeof row.sort === "number" ? { sort: row.sort } : {}),
  };
}

function toMedia(asset: LibraryAsset): Media {
  return {
    id: asset.id,
    url: publicAssetUrl(asset.id, asset.ext),
    type: mediaType(asset),
    ...(asset.title ? { title: asset.title } : {}),
    ...(asset.alt ? { alt: asset.alt } : {}),
    ...(asset.caption ? { caption: asset.caption } : {}),
    ...(asset.sort !== undefined ? { sort: asset.sort } : {}),
  };
}

function toFolder(node: Record<string, unknown>, assets: LibraryAsset[]): Folder {
  const id = String(node.id);
  const images = assets
    .filter((asset) => asset.kind === "image" && asset.folderId === id)
    .sort((a, b) => {
      const as = a.sort ?? Number.MAX_SAFE_INTEGER;
      const bs = b.sort ?? Number.MAX_SAFE_INTEGER;
      if (as !== bs) return as - bs;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    })
    .map((asset) => ({
      file: asset.name,
      url: publicAssetUrl(asset.id, asset.ext),
      ...(asset.caption ? { caption: asset.caption } : {}),
      ...(asset.alt ? { alt: asset.alt } : {}),
    }));
  return {
    id,
    path: "./media",
    images,
  };
}

/**
 * Authoring library records become the flattened `media[]` and `folders[]`.
 * A media record that already has `url` (and no `kind`), or a folder that already
 * has `path` and `images`, is copied through. That is a permanent escape hatch
 * for a file the library does not own.
 */
export function projectLibrary(mediaRows: unknown[], folderRows: unknown[]): { media: Media[]; folders: Folder[] } {
  const media: Media[] = [];
  const assets: LibraryAsset[] = [];
  for (const row of mediaRows) {
    if (!isRecord(row)) continue;
    if (isLibraryAsset(row)) {
      const asset = parseLibraryAsset(row);
      if (asset) assets.push(asset);
      continue;
    }
    media.push(row as Media);
  }
  const folders: Folder[] = [];
  const nodes: Record<string, unknown>[] = [];
  for (const row of folderRows) {
    if (!isRecord(row)) continue;
    if (isDirectoryNode(row)) nodes.push(row);
    else folders.push(row as Folder);
  }
  for (const asset of assets) media.push(toMedia(asset));
  for (const node of nodes) {
    if (typeof node.id !== "string" || !node.id) continue;
    folders.push(toFolder(node, assets));
  }
  return { media, folders };
}
