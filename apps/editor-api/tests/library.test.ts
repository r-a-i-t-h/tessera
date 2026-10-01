import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { projectLibrary, publicAssetUrl } from "../src/site/library.js";
import { AssetLibrary } from "../src/site/library-store.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("projectLibrary", () => {
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
    const users = new UserStore(join(root, "users"));
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    const sessions = new SessionStore();
    const token = sessions.create("alice").token;
    const app = createApp({ users, sessions, site, siteRoot: root });
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
});
