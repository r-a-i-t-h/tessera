import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { toYaml } from "./document.js";
import {
  kindForExt,
  normalizeExt,
  publicAssetUrl,
  slugFromFilename,
  splitRelativePath,
  uniqueId,
  uniqueName,
  UPLOADS_ID,
  type AssetKind,
} from "./library.js";
import type { SiteStore } from "./store.js";
import { writeTextAtomic } from "../store/fs.js";

export type FolderView = {
  id: string;
  title: string;
  parentId: string | null;
  sort?: number;
};

export type AssetView = {
  id: string;
  name: string;
  kind: AssetKind;
  ext: string;
  folderId: string | null;
  title?: string;
  alt?: string;
  caption?: string;
  sort?: number;
  url: string;
};

export type LibraryListing = {
  folders: FolderView[];
  assets: AssetView[];
};

export type UploadFile = {
  filename: string;
  relativePath: string;
  bytes: Uint8Array;
};

export type UploadRequest = {
  files: UploadFile[];
  folderId?: string;
  folderTitle?: string;
  parentId?: string;
};

export type UploadResult = {
  created: { id: string; name: string; folderId: string }[];
  skipped: { name: string; reason: string }[];
};

const THUMB_SUFFIX = ".thumb.webp";

export async function writeThumbnail(bytes: Uint8Array, dest: string): Promise<boolean> {
  try {
    await sharp(bytes).resize(320, 320, { fit: "inside", withoutEnlargement: true }).webp().toFile(dest);
    return true;
  } catch {
    return false;
  }
}

export class AssetLibrary {
  constructor(
    private readonly site: SiteStore,
    readonly filesDir: string,
  ) {}

  async list(): Promise<LibraryListing> {
    const folders: FolderView[] = [];
    const assets: AssetView[] = [];
    let folderIds: string[] = [];
    let mediaIds: string[] = [];
    try {
      folderIds = await this.ids("folders");
    } catch {
      folderIds = [];
    }
    try {
      mediaIds = await this.ids("media");
    } catch {
      mediaIds = [];
    }
    for (const id of folderIds) {
      const row = await this.site.read("folders", id);
      // Hand-authored folder (`path` and `images`). Listed here, and copied through on flatten.
      if (typeof row.path === "string" && row.path.length > 0) {
        folders.push({
          id,
          title: typeof row.title === "string" ? row.title : id,
          parentId: null,
        });
        continue;
      }
      folders.push({
        id,
        title: typeof row.title === "string" ? row.title : id,
        parentId: typeof row.parentId === "string" ? row.parentId : null,
        ...(typeof row.sort === "number" ? { sort: row.sort } : {}),
      });
    }
    for (const id of mediaIds) {
      const row = await this.site.read("media", id);
      // Library assets only. A hand-authored `url` record has no `kind` and is left for flatten.
      if (row.kind === "image" || row.kind === "document") {
        const ext = typeof row.ext === "string" ? row.ext.replace(/^\./, "").toLowerCase() : "";
        if (!ext) continue;
        const normalized = ext === "jpeg" ? "jpg" : ext;
        assets.push({
          id,
          name: typeof row.name === "string" ? row.name : `${id}.${normalized}`,
          kind: row.kind,
          ext: normalized,
          folderId: typeof row.folderId === "string" ? row.folderId : null,
          ...(typeof row.title === "string" ? { title: row.title } : {}),
          ...(typeof row.alt === "string" ? { alt: row.alt } : {}),
          ...(typeof row.caption === "string" ? { caption: row.caption } : {}),
          ...(typeof row.sort === "number" ? { sort: row.sort } : {}),
          url: publicAssetUrl(id, normalized),
        });
      }
    }
    return { folders, assets };
  }

  async createFolder(title: string, parentId?: string, refresh = true): Promise<FolderView> {
    const listing = await this.list();
    if (parentId) this.assertFolder(listing, parentId);
    const id = uniqueId(slugFromFilename(title), this.takenIds(listing));
    const record: Record<string, unknown> = { id, title: title.trim() || id };
    if (parentId) record.parentId = parentId;
    await this.writeRecord("folders", id, record, refresh);
    return { id, title: String(record.title), parentId: parentId ?? null };
  }

  async patchFolder(
    id: string,
    patch: { title?: string; parentId?: string | null; sort?: number },
  ): Promise<void> {
    if (id === UPLOADS_ID && patch.parentId) {
      throw new Error("Uploads stays at the library root.");
    }
    const listing = await this.list();
    const current = listing.folders.find((folder) => folder.id === id);
    if (!current) throw new Error(`Unknown folder "${id}".`);
    if (patch.parentId) {
      this.assertFolder(listing, patch.parentId);
      if (this.wouldCycle(listing, id, patch.parentId)) {
        throw new Error("A folder cannot be moved into itself.");
      }
    }
    const record = await this.site.read("folders", id);
    if (patch.title !== undefined) record.title = patch.title.trim() || id;
    if (patch.parentId === null) delete record.parentId;
    else if (patch.parentId) record.parentId = patch.parentId;
    if (patch.sort !== undefined) record.sort = patch.sort;
    await this.writeRecord("folders", id, record);
  }

  async deleteFolder(id: string): Promise<void> {
    if (id === UPLOADS_ID) throw new Error("The Uploads folder cannot be deleted.");
    const listing = await this.list();
    if (!listing.folders.some((folder) => folder.id === id)) throw new Error(`Unknown folder "${id}".`);
    if (listing.folders.some((folder) => folder.parentId === id) || listing.assets.some((asset) => asset.folderId === id)) {
      throw new Error("Move or delete everything inside this folder first.");
    }
    await unlink(this.recordPath("folders", id));
    await this.site.rebuild();
  }

  async upload(request: UploadRequest): Promise<UploadResult> {
    const listing = await this.list();
    let destination = request.folderId;
    if (request.folderTitle?.trim()) {
      const created = await this.createFolder(request.folderTitle.trim(), request.parentId ?? request.folderId, false);
      destination = created.id;
    } else if (!destination || destination === UPLOADS_ID) {
      destination = await this.ensureUploads();
    } else {
      this.assertFolder(await this.list(), destination);
    }
    const created: UploadResult["created"] = [];
    const skipped: UploadResult["skipped"] = [];
    const ids = this.takenIds(await this.list());
    const namesByFolder = new Map<string, Set<string>>();
    const current = await this.list();
    for (const asset of current.assets) {
      const key = asset.folderId ?? "";
      const set = namesByFolder.get(key) ?? new Set<string>();
      set.add(asset.name.toLowerCase());
      namesByFolder.set(key, set);
    }
    const folderKey = (parentId: string, title: string) => `${parentId}\0${title.toLowerCase()}`;
    const folderIndex = new Map<string, string>();
    for (const folder of current.folders) {
      if (folder.parentId) folderIndex.set(folderKey(folder.parentId, folder.title), folder.id);
    }

    for (const file of request.files) {
      const split = splitRelativePath(file.relativePath || file.filename);
      if (!split) {
        skipped.push({ name: file.filename, reason: "That path is not allowed." });
        continue;
      }
      const ext = normalizeExt(split.file);
      const kind = kindForExt(ext);
      if (!kind) {
        skipped.push({ name: split.file, reason: "Only images and PDF files can be added." });
        continue;
      }
      let parent = destination;
      let placed = true;
      for (const segment of split.folders) {
        const key = folderKey(parent, segment);
        const existing = folderIndex.get(key);
        if (existing) {
          parent = existing;
          continue;
        }
        try {
          const made = await this.createFolder(segment, parent, false);
          folderIndex.set(key, made.id);
          ids.add(made.id);
          parent = made.id;
        } catch (err) {
          skipped.push({ name: split.file, reason: err instanceof Error ? err.message : "Could not create a folder." });
          placed = false;
          break;
        }
      }
      if (!placed) continue;
      const names = namesByFolder.get(parent) ?? new Set<string>();
      const name = uniqueName(split.file, names);
      names.add(name.toLowerCase());
      namesByFolder.set(parent, names);
      const id = uniqueId(slugFromFilename(name), ids);
      ids.add(id);
      const blob = join(this.filesDir, `${id}.${ext}`);
      const thumb = join(this.filesDir, `${id}${THUMB_SUFFIX}`);
      await mkdir(this.filesDir, { recursive: true });
      await writeFile(blob, file.bytes);
      if (kind === "image") await writeThumbnail(file.bytes, thumb);
      const sort = created.length + current.assets.filter((asset) => asset.folderId === parent).length;
      try {
        await this.writeRecord("media", id, { id, name, kind, ext, folderId: parent, sort }, false);
      } catch (err) {
        await unlink(blob).catch(() => undefined);
        await unlink(thumb).catch(() => undefined);
        skipped.push({ name: split.file, reason: err instanceof Error ? err.message : "Could not save the file." });
        continue;
      }
      created.push({ id, name, folderId: parent });
    }
    await this.site.rebuild();
    return { created, skipped };
  }

  async patchAsset(
    id: string,
    patch: { name?: string; title?: string; alt?: string; caption?: string; folderId?: string | null; sort?: number },
  ): Promise<void> {
    const listing = await this.list();
    const asset = listing.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`Unknown file "${id}".`);
    const record = await this.site.read("media", id);
    const nextFolder = patch.folderId === undefined ? asset.folderId : patch.folderId;
    if (nextFolder) this.assertFolder(listing, nextFolder);
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new Error("A file needs a name.");
      const taken = new Set(
        listing.assets
          .filter((item) => item.id !== id && (item.folderId ?? null) === (nextFolder ?? null))
          .map((item) => item.name.toLowerCase()),
      );
      if (taken.has(name.toLowerCase())) throw new Error(`“${name}” is already in that folder.`);
      record.name = name;
    }
    if (patch.title !== undefined) {
      if (patch.title.trim()) record.title = patch.title.trim();
      else delete record.title;
    }
    if (patch.alt !== undefined) {
      if (patch.alt.trim()) record.alt = patch.alt.trim();
      else delete record.alt;
    }
    if (patch.caption !== undefined) {
      if (patch.caption.trim()) record.caption = patch.caption.trim();
      else delete record.caption;
    }
    if (patch.folderId === null) delete record.folderId;
    else if (patch.folderId) record.folderId = patch.folderId;
    if (patch.sort !== undefined) record.sort = patch.sort;
    await this.writeRecord("media", id, record);
  }

  async deleteAsset(id: string): Promise<void> {
    const listing = await this.list();
    const asset = listing.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`Unknown file "${id}".`);
    await unlink(this.recordPath("media", id));
    await unlink(join(this.filesDir, `${id}.${asset.ext}`)).catch(() => undefined);
    await unlink(join(this.filesDir, `${id}${THUMB_SUFFIX}`)).catch(() => undefined);
    await this.site.rebuild();
  }

  async readOriginal(id: string): Promise<{ bytes: Buffer; type: string; filename: string } | undefined> {
    const listing = await this.list();
    const asset = listing.assets.find((item) => item.id === id);
    if (!asset) return undefined;
    try {
      const bytes = await readFile(join(this.filesDir, `${asset.id}.${asset.ext}`));
      return { bytes, type: contentType(asset.ext), filename: asset.name };
    } catch {
      return undefined;
    }
  }

  async readThumb(id: string): Promise<Buffer | undefined> {
    const listing = await this.list();
    const asset = listing.assets.find((item) => item.id === id);
    if (!asset || asset.kind !== "image") return undefined;
    try {
      return await readFile(join(this.filesDir, `${id}${THUMB_SUFFIX}`));
    } catch {
      return undefined;
    }
  }

  private async ensureUploads(): Promise<string> {
    const listing = await this.list();
    if (listing.folders.some((folder) => folder.id === UPLOADS_ID)) return UPLOADS_ID;
    await this.writeRecord("folders", UPLOADS_ID, { id: UPLOADS_ID, title: "Uploads" }, false);
    return UPLOADS_ID;
  }

  private assertFolder(listing: LibraryListing, id: string): void {
    if (!listing.folders.some((folder) => folder.id === id)) throw new Error(`Unknown folder "${id}".`);
  }

  private wouldCycle(listing: LibraryListing, id: string, parentId: string): boolean {
    let cursor: string | null = parentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === id || seen.has(cursor)) return true;
      seen.add(cursor);
      cursor = listing.folders.find((folder) => folder.id === cursor)?.parentId ?? null;
    }
    return false;
  }

  private takenIds(listing: LibraryListing): Set<string> {
    return new Set([...listing.folders.map((folder) => folder.id), ...listing.assets.map((asset) => asset.id)]);
  }

  private async ids(kind: "media" | "folders"): Promise<string[]> {
    const summaries = await this.site.list();
    return summaries.filter((row) => row.kind === kind).map((row) => row.id);
  }

  private recordPath(kind: "media" | "folders", id: string): string {
    return join(this.site.siteDir, this.site.fileRef(kind, id).file);
  }

  private async writeRecord(
    kind: "media" | "folders",
    id: string,
    record: Record<string, unknown>,
    refresh = true,
  ): Promise<void> {
    await writeTextAtomic(this.recordPath(kind, id), toYaml({ ...record, id }));
    if (refresh) await this.site.rebuild();
  }
}

function contentType(ext: string): string {
  switch (ext) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
