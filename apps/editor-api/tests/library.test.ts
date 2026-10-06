import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import type { UploadLimits } from "../src/config/upload-limits.js";
import { parseLibraryAsset, projectLibrary, publicAssetUrl } from "../src/site/library.js";
import { AssetLibrary } from "../src/site/library-store.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("projectLibrary", () => {
  it("normalizes one library record for both listing and document projection", () => {
    expect(parseLibraryAsset({
      id: "portrait",
      name: "",
      kind: "image",
      ext: ".JPEG",
      folderId: "people",
      alt: "Portrait",
    })).toEqual({
      id: "portrait",
      name: "portrait.jpeg",
      kind: "image",
      ext: "jpg",
      folderId: "people",
      alt: "Portrait",
    });
  });

  it("derives a stable media url and folder membership without using the virtual path", () => {
    const projected = projectLibrary(
      [
        {
          id: "porch",
          name: "porch.svg",
          kind: "image",
          ext: "svg",
          folderId: "hall",
          alt: "The porch",
          sort: 2,
        },
        { id: "notes", name: "notes.pdf", kind: "document", ext: "pdf", folderId: "hall", title: "Notes" },
      ],
      [{ id: "hall" }],
    );
    expect(projected.media.map((item) => item.url)).toEqual([publicAssetUrl("porch", "svg"), publicAssetUrl("notes", "pdf")]);
    expect(projected.media[1]?.type).toBe("document");
    expect(projected.folders[0]?.images).toEqual([
      { file: "porch.svg", url: "./media/porch.svg", alt: "The porch" },
    ]);
  });

  it("copies a url media record and a path folder through unchanged", () => {
    const folder = { id: "g", path: "./media/g", images: [{ file: "01-a.svg" }] };
    const projected = projectLibrary([{ id: "logo", url: "./media/sample.svg", type: "image" }], [folder]);
    expect(projected.media[0]?.url).toBe("./media/sample.svg");
    expect(projected.folders[0]).toEqual(folder);
  });
});

describe("asset library", () => {
  let root: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (root) await rm(root, { recursive: true, force: true });
  });

  async function setup() {
    root = await mkdtemp(join(tmpdir(), "tessera-lib-"));
    const records = join(root, "records");
    const site = new SiteStore(records, join(root, "preview", "data", "site.json"));
    await site.write("layouts", "page", { root: { type: "zone", id: "main" } });
    await site.write("content", "home", { title: "Home", zones: { main: { html: "<p>Hi</p>" } } });
    await site.writeSite({ version: 2, id: "demo", title: "Demo", homePageId: "home", defaultLayoutId: "page" });
    const library = new AssetLibrary(site, join(root, "files"));
    return { site, library };
  }

  async function authenticatedApp(site: SiteStore, uploadLimits?: Partial<UploadLimits>) {
    const users = new UserStore(join(root, "users"));
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    const sessions = new SessionStore();
    const token = sessions.create("alice").token;
    return {
      app: createApp({ users, sessions, site, siteRoot: root, uploadLimits }),
      token,
    };
  }

  it("uploads a folder of files into nested virtual folders and keeps the url after a move", async () => {
    const { site, library } = await setup();
    const result = await library.upload({
      files: [
        { filename: "porch.png", relativePath: "hall/porch.png", bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") },
        { filename: "notes.pdf", relativePath: "hall/notes.pdf", bytes: new TextEncoder().encode("%PDF-1.1") },
      ],
    });
    expect(result.skipped).toEqual([]);
    expect(result.created).toHaveLength(2);
    const listing = await library.list();
    const hall = listing.folders.find((folder) => folder.id === "hall");
    expect(hall?.parentId).toBe("uploads");
    const porch = listing.assets.find((asset) => asset.name === "porch.png");
    expect(porch?.url).toBe(`./media/${porch?.id}.png`);
    expect(await readFile(join(root, "files", `${porch?.id}.thumb.webp`))).toBeTruthy();
    const doc = await site.flatten();
    expect(doc?.media.find((item) => item.id === porch?.id)?.url).toBe(porch?.url);
    await library.patchAsset(porch!.id, { folderId: "uploads" });
    const moved = await library.list();
    expect(moved.assets.find((asset) => asset.id === porch?.id)?.url).toBe(porch?.url);
    await expect(library.deleteFolder("uploads")).rejects.toThrow(/cannot be deleted/i);
    await expect(library.deleteFolder(hall!.id)).rejects.toThrow(/inside/i);
  });

  it("serves an upload over HTTP", async () => {
    const { site } = await setup();
    const { app, token } = await authenticatedApp(site);
    const body = new FormData();
    body.append("file", new File([`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>`], "mark.svg", { type: "image/svg+xml" }));
    body.append("path", "mark.svg");
    body.append("folderId", "uploads");
    const res = await app.request("/api/library/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { created: { id: string }[] };
    const thumb = await app.request(`/api/library/assets/${json.created[0]!.id}/thumb`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(thumb.status).toBe(200);
    expect(thumb.headers.get("content-type")).toMatch(/webp/);
  });

  it("rejects too many or oversized files before storing upload bytes", async () => {
    const { site } = await setup();
    const { app, token } = await authenticatedApp(site, {
      maxFileBytes: 3,
      maxFiles: 1,
      maxTotalBytes: 10_000,
    });
    const oversized = new FormData();
    oversized.append("file", new File(["four"], "large.txt"));
    const fileResponse = await app.request("/api/library/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: oversized,
    });
    expect(fileResponse.status).toBe(413);
    expect(await fileResponse.json()).toMatchObject({ error: expect.stringContaining("large.txt") });

    const crowded = new FormData();
    crowded.append("file", new File(["a"], "a.txt"));
    crowded.append("file", new File(["b"], "b.txt"));
    const countResponse = await app.request("/api/library/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: crowded,
    });
    expect(countResponse.status).toBe(413);
    expect(await countResponse.json()).toMatchObject({ error: expect.stringContaining("at most 1") });
    expect(await readdir(join(root, "files")).catch(() => [])).toEqual([]);
  });

  it("rejects an upload request over the total body limit", async () => {
    const { site } = await setup();
    const { app, token } = await authenticatedApp(site, {
      maxFileBytes: 1_000,
      maxFiles: 10,
      maxTotalBytes: 100,
    });
    const body = new FormData();
    body.append("file", new File(["small"], "small.txt"));
    const response = await app.request("/api/library/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("total limit") });
  });

  it("rebuilds once for a direct library mutation", async () => {
    const { site, library } = await setup();
    const uploaded = await library.upload({
      files: [
        {
          filename: "notes.pdf",
          relativePath: "notes.pdf",
          bytes: new TextEncoder().encode("%PDF-1.1"),
        },
      ],
    });
    const rebuild = vi.spyOn(site, "rebuild");

    await library.patchAsset(uploaded.created[0]!.id, { title: "Meeting notes" });

    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it("restores media metadata when rebuilding a library update fails", async () => {
    const { site, library } = await setup();
    const uploaded = await library.upload({
      files: [
        {
          filename: "notes.pdf",
          relativePath: "notes.pdf",
          bytes: new TextEncoder().encode("%PDF-1.1"),
        },
      ],
    });
    const id = uploaded.created[0]!.id;
    const recordPath = join(root, "records", "media", `${id}.yaml`);
    const before = await readFile(recordPath, "utf8");
    vi.spyOn(site, "rebuild").mockRejectedValueOnce(new Error("rebuild blocked"));

    await expect(library.patchAsset(id, { title: "Changed" })).rejects.toThrow("rebuild blocked");

    expect(await readFile(recordPath, "utf8")).toBe(before);
  });

  it("restores media files when rebuilding a library deletion fails", async () => {
    const { site, library } = await setup();
    const uploaded = await library.upload({
      files: [
        {
          filename: "notes.pdf",
          relativePath: "notes.pdf",
          bytes: new TextEncoder().encode("%PDF-1.1"),
        },
      ],
    });
    const id = uploaded.created[0]!.id;
    const recordPath = join(root, "records", "media", `${id}.yaml`);
    const blobPath = join(root, "files", `${id}.pdf`);
    const beforeRecord = await readFile(recordPath, "utf8");
    const beforeBlob = await readFile(blobPath);
    vi.spyOn(site, "rebuild").mockRejectedValueOnce(new Error("rebuild blocked"));

    await expect(library.deleteAsset(id)).rejects.toThrow("rebuild blocked");

    expect(await readFile(recordPath, "utf8")).toBe(beforeRecord);
    expect(await readFile(blobPath)).toEqual(beforeBlob);
  });

  it("rebuilds at most once for an HTTP library mutation", async () => {
    const { site } = await setup();
    const { app, token } = await authenticatedApp(site);
    const rebuild = vi.spyOn(site, "rebuild");

    const response = await app.request("/api/library/folders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "documents" }),
    });

    expect(response.status).toBe(200);
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it("restores a folder record when rebuilding its deletion fails", async () => {
    const { site, library } = await setup();
    await library.createFolder("documents");
    const recordPath = join(root, "records", "folders", "documents.yaml");
    const before = await readFile(recordPath, "utf8");
    vi.spyOn(site, "rebuild").mockRejectedValueOnce(new Error("rebuild blocked"));

    await expect(library.deleteFolder("documents")).rejects.toThrow("rebuild blocked");

    expect(await readFile(recordPath, "utf8")).toBe(before);
  });

  it("removes every new record and blob when the final upload rebuild fails", async () => {
    const { site, library } = await setup();
    vi.spyOn(site, "rebuild").mockRejectedValueOnce(new Error("rebuild blocked"));

    await expect(
      library.upload({
        files: [
          {
            filename: "notes.pdf",
            relativePath: "documents/notes.pdf",
            bytes: new TextEncoder().encode("%PDF-1.1"),
          },
          {
            filename: "agenda.pdf",
            relativePath: "documents/agenda.pdf",
            bytes: new TextEncoder().encode("%PDF-1.1"),
          },
        ],
      }),
    ).rejects.toThrow("rebuild blocked");

    expect((await site.list()).filter((row) => row.kind === "media" || row.kind === "folders")).toEqual([]);
    expect(await readdir(join(root, "files"))).toEqual([]);
  });
});
