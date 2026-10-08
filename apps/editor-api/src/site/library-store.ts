import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { isRecordId } from "./kinds.js";
import {
  kindForExt,
  normalizeExt,
  parseLibraryAsset,
  publicAssetUrl,
  SCANNED_ID,
  slugFromFilename,
  splitRelativePath,
  uniqueId,
  uniqueName,
  UPLOADS_ID,
  type AssetKind,
} from "./library.js";
import type { SiteStore, SnapshotRef } from "./store.js";

export type FolderView = {
  id: string;
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
  snapshot?: SnapshotRef;
};

export type RescanResult = {
  removed: { id: string; name: string }[];
  added: { id: string; name: string; folderId: string }[];
  skipped: { name: string; reason: string }[];
  snapshot?: SnapshotRef;
};

type MutationResult = { snapshot?: SnapshotRef };

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
          parentId: null,
        });
        continue;
      }
      folders.push({
        id,
        parentId: typeof row.parentId === "string" ? row.parentId : null,
        ...(typeof row.sort === "number" ? { sort: row.sort } : {}),
      });
    }
    for (const id of mediaIds) {
      const row = await this.site.read("media", id);
      // Library assets only. A hand-authored `url` record has no `kind` and is left for flatten.
      const asset = parseLibraryAsset(row);
      if (!asset) continue;
      assets.push({
        ...asset,
        folderId: asset.folderId ?? null,
        url: publicAssetUrl(asset.id, asset.ext),
      });
    }
    return { folders, assets };
  }

  async createFolder(
    id: string,
    parentId?: string,
    rebuild = true,
  ): Promise<{ folder: FolderView; snapshot?: SnapshotRef }> {
    const folderId = id.trim();
    if (!isRecordId(folderId)) throw new Error(`Invalid record id "${id}".`);
    const listing = await this.list();
    if (parentId) this.assertFolder(listing, parentId);
    if (this.takenIds(listing).has(folderId)) throw new Error(`Folder "${folderId}" already exists.`);
    const record: Record<string, unknown> = { id: folderId };
    if (parentId) record.parentId = parentId;
    const saved = await this.site.writeLibraryRecord("folders", folderId, record, { rebuild });
    return {
      folder: { id: folderId, parentId: parentId ?? null },
      ...(saved.snapshot ? { snapshot: saved.snapshot } : {}),
    };
  }

  async patchFolder(
    id: string,
    patch: { parentId?: string | null; sort?: number },
  ): Promise<MutationResult> {
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
    if (patch.parentId === null) delete record.parentId;
    else if (patch.parentId) record.parentId = patch.parentId;
    if (patch.sort !== undefined) record.sort = patch.sort;
    const saved = await this.site.writeLibraryRecord("folders", id, record);
    return saved.snapshot ? { snapshot: saved.snapshot } : {};
  }

  async deleteFolder(id: string): Promise<MutationResult> {
    if (id === UPLOADS_ID) throw new Error("The Uploads folder cannot be deleted.");
    const listing = await this.list();
    if (!listing.folders.some((folder) => folder.id === id)) throw new Error(`Unknown folder "${id}".`);
    if (listing.folders.some((folder) => folder.parentId === id) || listing.assets.some((asset) => asset.folderId === id)) {
      throw new Error("Move or delete everything inside this folder first.");
    }
    const saved = await this.site.deleteLibraryRecord("folders", id);
    return saved.snapshot ? { snapshot: saved.snapshot } : {};
  }

  async upload(request: UploadRequest): Promise<UploadResult> {
    const listing = await this.list();
    const createdFolders: string[] = [];
    const createdFiles: { id: string; ext: string }[] = [];
    let destination = request.folderId;
    if (request.folderTitle?.trim()) {
      const created = await this.createFolder(request.folderTitle.trim(), request.parentId ?? request.folderId, false);
      destination = created.folder.id;
      createdFolders.push(created.folder.id);
    } else if (!destination || destination === UPLOADS_ID) {
      const uploads = await this.ensureUploads();
      destination = uploads.id;
      if (uploads.created) createdFolders.push(uploads.id);
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
    const folderKey = (parentId: string, folderId: string) => `${parentId}\0${folderId}`;
    const folderIndex = new Map<string, string>();
    for (const folder of current.folders) {
      if (folder.parentId) folderIndex.set(folderKey(folder.parentId, folder.id), folder.id);
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
        const slug = slugFromFilename(segment);
        if (!isRecordId(slug)) {
          skipped.push({ name: split.file, reason: "That path is not allowed." });
          placed = false;
          break;
        }
        const key = folderKey(parent, slug);
        const existing = folderIndex.get(key);
        if (existing) {
          parent = existing;
          continue;
        }
        const folderId = ids.has(slug) ? uniqueId(slug, ids) : slug;
        try {
          const made = await this.createFolder(folderId, parent, false);
          folderIndex.set(key, made.folder.id);
          ids.add(made.folder.id);
          createdFolders.push(made.folder.id);
          parent = made.folder.id;
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
        await this.site.writeLibraryRecord(
          "media",
          id,
          { id, name, kind, ext, folderId: parent, sort },
          { rebuild: false },
        );
      } catch (err) {
        await unlink(blob).catch(() => undefined);
        await unlink(thumb).catch(() => undefined);
        skipped.push({ name: split.file, reason: err instanceof Error ? err.message : "Could not save the file." });
        continue;
      }
      createdFiles.push({ id, ext });
      created.push({ id, name, folderId: parent });
    }
    try {
      const rebuilt = await this.site.rebuild();
      return {
        created,
        skipped,
        ...(rebuilt.snapshot ? { snapshot: rebuilt.snapshot } : {}),
      };
    } catch (err) {
      for (const file of createdFiles.reverse()) {
        await this.site.deleteLibraryRecord("media", file.id, [], { rebuild: false }).catch(() => undefined);
        await unlink(join(this.filesDir, `${file.id}.${file.ext}`)).catch(() => undefined);
        await unlink(join(this.filesDir, `${file.id}${THUMB_SUFFIX}`)).catch(() => undefined);
      }
      for (const folderId of createdFolders.reverse()) {
        await this.site.deleteLibraryRecord("folders", folderId, [], { rebuild: false }).catch(() => undefined);
      }
      throw err;
    }
  }

  async patchAsset(
    id: string,
    patch: { name?: string; title?: string; alt?: string; caption?: string; folderId?: string | null; sort?: number },
  ): Promise<MutationResult> {
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
    const saved = await this.site.writeLibraryRecord("media", id, record);
    return saved.snapshot ? { snapshot: saved.snapshot } : {};
  }

  async deleteAsset(id: string): Promise<MutationResult> {
    const listing = await this.list();
    const asset = listing.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`Unknown file "${id}".`);
    const saved = await this.site.deleteLibraryRecord("media", id, [
      join(this.filesDir, `${id}.${asset.ext}`),
      join(this.filesDir, `${id}${THUMB_SUFFIX}`),
    ]);
    return saved.snapshot ? { snapshot: saved.snapshot } : {};
  }

  async rescan(): Promise<RescanResult> {
    const fileNames = await this.diskFileNames();
    const listing = await this.list();
    const present = new Set<string>();
    const missing: AssetView[] = [];
    for (const asset of listing.assets) {
      const blobName = `${asset.id}.${asset.ext}`;
      if (fileNames.has(blobName)) {
        present.add(blobName);
        present.add(`${asset.id}${THUMB_SUFFIX}`);
      } else missing.push(asset);
    }

    const imports: string[] = [];
    const skipped: RescanResult["skipped"] = [];
    const orphanThumbs: string[] = [];
    for (const name of [...fileNames].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (present.has(name)) continue;
      if (name.endsWith(THUMB_SUFFIX)) {
        orphanThumbs.push(name);
        continue;
      }
      if (!kindForExt(normalizeExt(name))) {
        skipped.push({ name, reason: "Only images and PDF files can be added." });
        continue;
      }
      imports.push(name);
    }

    if (imports.length && !listing.folders.some((folder) => folder.id === SCANNED_ID)) {
      const removing = new Set(missing.map((asset) => asset.id));
      const mediaIds = await this.ids("media");
      if (mediaIds.includes(SCANNED_ID) && !removing.has(SCANNED_ID)) {
        throw new Error('A file already uses the id "scanned".');
      }
    }

    if (!missing.length && !imports.length) {
      await Promise.all(orphanThumbs.map((name) => unlink(join(this.filesDir, name)).catch(() => undefined)));
      return { removed: [], added: [], skipped };
    }

    const removals: { id: string; name: string; record: Record<string, unknown> }[] = [];
    for (const asset of missing) {
      removals.push({ id: asset.id, name: asset.name, record: await this.site.read("media", asset.id) });
    }

    const removed: RescanResult["removed"] = [];
    const added: RescanResult["added"] = [];
    const createdFolders: string[] = [];
    const createdFiles: { id: string; ext: string; renamedFrom?: string; thumb: boolean }[] = [];
    const stagedThumbs: { original: string; aside: string }[] = [];
    const deleted: typeof removals = [];

    try {
      for (const asset of removals) {
        await this.site.deleteLibraryRecord("media", asset.id, [], { rebuild: false });
        deleted.push(asset);
        removed.push({ id: asset.id, name: asset.name });
      }
      for (const name of orphanThumbs) {
        const original = join(this.filesDir, name);
        const aside = `${original}.${process.pid}.${randomBytes(8).toString("hex")}.rollback`;
        try {
          await rename(original, aside);
          stagedThumbs.push({ original, aside });
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }
      }

      if (imports.length) {
        const folder = await this.ensureScanned();
        if (folder.created) createdFolders.push(folder.id);
        const current = await this.list();
        const names = new Set(
          current.assets.filter((asset) => asset.folderId === SCANNED_ID).map((asset) => asset.name.toLowerCase()),
        );
        const taken = new Set([
          ...current.folders.map((item) => item.id),
          ...current.assets.map((asset) => asset.id),
          ...(await this.ids("media")),
        ]);
        let sort = current.assets.filter((asset) => asset.folderId === SCANNED_ID).length;
        for (const filename of imports) {
          const ext = normalizeExt(filename);
          const kind = kindForExt(ext);
          if (!kind) continue;
          const name = uniqueName(filename, names);
          names.add(name.toLowerCase());
          const id = this.freeBlobId(slugFromFilename(name), ext, filename, taken, fileNames);
          taken.add(id);
          const canonical = `${id}.${ext}`;
          const source = join(this.filesDir, filename);
          const dest = join(this.filesDir, canonical);
          let renamedFrom: string | undefined;
          let thumb = false;
          try {
            if (filename !== canonical) {
              await rename(source, dest);
              fileNames.delete(filename);
              fileNames.add(canonical);
              renamedFrom = filename;
            }
            if (kind === "image") {
              thumb = await writeThumbnail(await readFile(dest), join(this.filesDir, `${id}${THUMB_SUFFIX}`));
            }
            await this.site.writeLibraryRecord(
              "media",
              id,
              { id, name, kind, ext, folderId: SCANNED_ID, sort },
              { rebuild: false },
            );
          } catch (err) {
            if (renamedFrom) {
              await rename(dest, source).catch(() => undefined);
              fileNames.delete(canonical);
              fileNames.add(filename);
            }
            if (thumb) await unlink(join(this.filesDir, `${id}${THUMB_SUFFIX}`)).catch(() => undefined);
            taken.delete(id);
            names.delete(name.toLowerCase());
            skipped.push({
              name: filename,
              reason: err instanceof Error ? err.message : "Could not save the file.",
            });
            continue;
          }
          sort += 1;
          createdFiles.push({ id, ext, ...(renamedFrom ? { renamedFrom } : {}), thumb });
          added.push({ id, name, folderId: SCANNED_ID });
        }
      }

      if (!added.length) {
        for (const folderId of [...createdFolders].reverse()) {
          await this.site.deleteLibraryRecord("folders", folderId, [], { rebuild: false });
        }
        createdFolders.length = 0;
      }

      if (!deleted.length && !added.length) {
        await Promise.all(stagedThumbs.map(({ aside }) => unlink(aside).catch(() => undefined)));
        return { removed, added, skipped };
      }

      const rebuilt = await this.site.rebuild();
      await Promise.all(stagedThumbs.map(({ aside }) => unlink(aside).catch(() => undefined)));
      return {
        removed,
        added,
        skipped,
        ...(rebuilt.snapshot ? { snapshot: rebuilt.snapshot } : {}),
      };
    } catch (err) {
      for (const file of createdFiles.reverse()) {
        await this.site.deleteLibraryRecord("media", file.id, [], { rebuild: false }).catch(() => undefined);
        if (file.thumb) await unlink(join(this.filesDir, `${file.id}${THUMB_SUFFIX}`)).catch(() => undefined);
        if (file.renamedFrom) {
          await rename(
            join(this.filesDir, `${file.id}.${file.ext}`),
            join(this.filesDir, file.renamedFrom),
          ).catch(() => undefined);
        }
      }
      for (const folderId of createdFolders.reverse()) {
        await this.site.deleteLibraryRecord("folders", folderId, [], { rebuild: false }).catch(() => undefined);
      }
      for (const asset of deleted.reverse()) {
        await this.site.writeLibraryRecord("media", asset.id, asset.record, { rebuild: false }).catch(() => undefined);
      }
      for (const staged of stagedThumbs.reverse()) {
        await rename(staged.aside, staged.original).catch(() => undefined);
      }
      throw err;
    }
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

  private async ensureScanned(): Promise<{ id: string; created: boolean }> {
    const listing = await this.list();
    if (listing.folders.some((folder) => folder.id === SCANNED_ID)) {
      return { id: SCANNED_ID, created: false };
    }
    await this.createFolder(SCANNED_ID, undefined, false);
    return { id: SCANNED_ID, created: true };
  }

  private async diskFileNames(): Promise<Set<string>> {
    try {
      const entries = await readdir(this.filesDir, { withFileTypes: true });
      const names = new Set<string>();
      for (const entry of entries) {
        if (entry.isFile()) names.add(entry.name);
      }
      return names;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Set();
      throw err;
    }
  }

  private freeBlobId(
    base: string,
    ext: string,
    currentName: string,
    takenIds: Set<string>,
    fileNames: Set<string>,
  ): string {
    const reserved = new Set(takenIds);
    let id = uniqueId(base, reserved);
    while (`${id}.${ext}` !== currentName && fileNames.has(`${id}.${ext}`)) {
      reserved.add(id);
      id = uniqueId(base, reserved);
    }
    return id;
  }

  private async ensureUploads(): Promise<{ id: string; created: boolean }> {
    const listing = await this.list();
    if (listing.folders.some((folder) => folder.id === UPLOADS_ID)) {
      return { id: UPLOADS_ID, created: false };
    }
    await this.site.writeLibraryRecord("folders", UPLOADS_ID, { id: UPLOADS_ID }, { rebuild: false });
    return { id: UPLOADS_ID, created: true };
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
