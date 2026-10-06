import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { repoRoot } from "../src/site/paths.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("record routes", () => {
  let dataDir: string;
  let siteDir: string;
  let users: UserStore;
  let sessions: SessionStore;
  let site: SiteStore;
  let token: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "tessera-rec-data-"));
    siteDir = await mkdtemp(join(tmpdir(), "tessera-rec-site-"));
    users = new UserStore(dataDir);
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    sessions = new SessionStore();
    token = sessions.create("alice").token;
    site = new SiteStore(siteDir, join(siteDir, "out.json"));
    await site.write("content", "home", {
      title: "Home",
      tags: ["page"],
      zones: { main: { html: "<p>Hello</p>" } },
    });
    await site.writeSite({
      version: 2,
      id: "demo",
      title: "Demo",
      homePageId: "home",
      defaultLayoutId: "standard",
    });
    await site.writeNav([{ id: "home", title: "Home", topbar: true }]);
    await site.write("layouts", "standard", {
      root: { type: "zone", id: "main" },
    });
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    await rm(siteDir, { recursive: true, force: true });
  });

  function app() {
    return createApp({ users, sessions, site });
  }

  it("rejects anonymous record reads", async () => {
    const res = await app().request("/api/records");
    expect(res.status).toBe(401);
    const render = await app().request("/api/render", { method: "POST" });
    expect(render.status).toBe(401);
  });

  it("renders every page into the preview snapshot", async () => {
    const res = await app().request("/api/render", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pages: number; snapshot: { file: string } };
    expect(body.pages).toBe(1);
    expect(body.snapshot.file).toMatch(/^site\.[a-f0-9]+\.json$/);
    const written = await readFile(join(siteDir, "out.json"), "utf8");
    expect(written).toContain("Hello");
  });

  it("refuses to render into a reference site directory", async () => {
    const guarded = createApp({
      users,
      sessions,
      site,
      siteRoot: join(repoRoot, "sites", "willow"),
    });
    const res = await guarded.request("/api/render", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/reference material/);
  });

  it("rejects a render when the site has no pages", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "tessera-rec-empty-"));
    try {
      const empty = createApp({
        users,
        sessions,
        site: new SiteStore(emptyDir, join(emptyDir, "out.json")),
      });
      const res = await empty.request("/api/render", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(400);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  it("lists each template file and leaves templates out of the published document", async () => {
    await site.write("templates", "animal", {
      isLocked: true,
      layoutId: "standard",
      zones: { main: { html: "<h2>Animal name</h2>" } },
    });
    await mkdir(join(siteDir, "templates"), { recursive: true });
    await writeFile(
      join(siteDir, "templates", "visit.yaml"),
      "id: visit\nzones:\n  main:\n    html: \"<p>When to come.</p>\"\n",
      "utf8",
    );

    const list = await app().request("/api/records", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { records: { id: string; kind: string }[]; kinds: { kind: string }[] };
    expect(body.kinds.some((kind) => kind.kind === "templates")).toBe(true);
    expect(body.records.some((row) => row.kind === "templates" && row.id === "animal")).toBe(true);
    expect(body.records.some((row) => row.kind === "templates" && row.id === "visit")).toBe(true);

    const written = await readFile(join(siteDir, "out.json"), "utf8");
    expect(written).not.toContain("Animal name");
    expect(written).not.toContain("When to come.");

    const doc = await site.flatten();
    expect(doc?.pages.some((page) => page.id === "animal" || page.id === "visit")).toBe(false);
    await site.writeFromDocument(doc!);
    const template = await site.read("templates", "animal");
    expect(template.title).toBeUndefined();
    expect(template.isLocked).toBe(true);
    const dropped = await site.read("templates", "visit");
    expect(dropped.title).toBeUndefined();
    expect(dropped.id).toBe("visit");
  });

  it("lists and updates a content record", async () => {
    const list = await app().request("/api/records", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { records: { id: string; kind: string }[] };
    expect(body.records.some((r) => r.kind === "content" && r.id === "home")).toBe(true);

    const saved = await app().request("/api/records/content/home", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { title: "Welcome", zones: { main: { html: "<p>Updated</p>" } } },
      }),
    });
    expect(saved.status).toBe(200);

    const read = await app().request("/api/records/content/home", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const record = (await read.json()) as {
      data: { title: string; zones: Record<string, unknown> };
      layout?: { layoutId: string; declaredZones: string[]; offLayoutZones: string[] };
    };
    expect(record.data.title).toBe("Welcome");
    expect(record.layout?.layoutId).toBe("standard");
    expect(record.layout?.declaredZones).toEqual(["main"]);
    expect(record.layout?.offLayoutZones ?? []).toEqual([]);
  });

  it("marks page zones the layout does not declare as off-layout", async () => {
    await site.write("layouts", "standard", {
      root: {
        type: "region",
        children: [
          { type: "zone", id: "title" },
          { type: "zone", id: "main" },
        ],
      },
    });
    await site.write("content", "home", {
      title: "Home",
      tags: ["page"],
      zones: {
        main: { html: "<p>Hello</p>" },
        meta: { json: { date: "2026-09-10" } },
      },
    });
    const read = await app().request("/api/records/content/home", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const record = (await read.json()) as {
      layout: { declaredZones: string[]; offLayoutZones: string[] };
    };
    expect(record.layout.declaredZones).toEqual(["title", "main"]);
    expect(record.layout.offLayoutZones).toEqual(["meta"]);
  });

  it("appends the previous page file and republishes a new snapshot", async () => {
    const before = await app().request("/api/records/content/home", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const opened = (await before.json()) as {
      raw: string;
      file: string;
      historyFile: string;
      schemaVersion: number;
      history: unknown[];
      snapshot: { file: string };
    };
    expect(opened.file).toBe("content/home.yaml");
    expect(opened.historyFile).toBe("history/content/home.history");
    expect(opened.schemaVersion).toBe(0);
    expect(opened.history).toEqual([]);
    expect(opened.snapshot.file).toMatch(/^site\.[a-f0-9]+\.json$/);

    const saved = await app().request("/api/records/content/home", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: "id: home\ntitle: Welcome\nzones:\n  main:\n    html: <p>Updated</p>\n",
      }),
    });
    expect(saved.status).toBe(200);
    const body = (await saved.json()) as {
      historyAppended: boolean;
      historyCount: number;
      snapshot: { file: string; hash: string };
    };
    expect(body.historyAppended).toBe(true);
    expect(body.historyCount).toBe(1);
    expect(body.snapshot.file).not.toBe(opened.snapshot.file);

    const entry = await app().request("/api/records/content/home/history/0", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(entry.status).toBe(200);
    const past = (await entry.json()) as { raw: string; schemaVersion: number };
    expect(past.raw).toBe(opened.raw);
    expect(past.schemaVersion).toBe(0);

    const same = await app().request("/api/records/content/home", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: "id: home\ntitle: Welcome\nzones:\n  main:\n    html: <p>Updated</p>\n",
      }),
    });
    const unchanged = (await same.json()) as { historyAppended: boolean; historyCount: number };
    expect(unchanged.historyAppended).toBe(false);
    expect(unchanged.historyCount).toBe(1);
  });

  it("rejects invalid authored fields before writing", async () => {
    const before = await readFile(join(siteDir, "content", "home.yaml"), "utf8");
    const beforeDocument = await readFile(join(siteDir, "out.json"), "utf8");
    const beforeRevision = await readFile(join(siteDir, "rev.json"), "utf8");
    const saved = await app().request("/api/records/content/home", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: "id: home\ntitle: Home\nzones:\n  main:\n    nope: true\n",
      }),
    });
    expect(saved.status).toBe(400);
    expect(await saved.json()).toMatchObject({
      kind: "content",
      id: "home",
      field: "zones.main",
    });
    expect(await readFile(join(siteDir, "content", "home.yaml"), "utf8")).toBe(before);
    expect(await readFile(join(siteDir, "out.json"), "utf8")).toBe(beforeDocument);
    expect(await readFile(join(siteDir, "rev.json"), "utf8")).toBe(beforeRevision);
    const listed = await app().request("/api/records/content/home", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const record = (await listed.json()) as {
      history: unknown[];
      snapshot: { hash: string; file: string };
    };
    expect(record.history).toEqual([]);
    expect(record.snapshot).toEqual(JSON.parse(beforeRevision));
  });

  it("removes a new record when its first rebuild rejects it", async () => {
    const beforeDocument = await readFile(join(siteDir, "out.json"), "utf8");
    const beforeRevision = await readFile(join(siteDir, "rev.json"), "utf8");
    const saved = await app().request("/api/records/content/draft-page", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: "id: draft-page\ntitle: Draft\nzones:\n  main:\n    nope: true\n",
      }),
    });

    expect(saved.status).toBe(400);
    await expect(readFile(join(siteDir, "content", "draft-page.yaml"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(siteDir, "out.json"), "utf8")).toBe(beforeDocument);
    expect(await readFile(join(siteDir, "rev.json"), "utf8")).toBe(beforeRevision);
    expect((await site.list()).some((record) => record.kind === "content" && record.id === "draft-page")).toBe(false);
  });

  it("records the authoring schema version on the history entry", async () => {
    const versioned = new SiteStore(siteDir, join(siteDir, "out.json"), async () => 1);
    await versioned.write("content", "home", {
      title: "After schema",
      zones: { main: { html: "<p>Next</p>" } },
    });
    const entry = await versioned.pageHistoryEntry("home", 0);
    expect(entry?.schemaVersion).toBe(1);
    expect(entry?.raw).toContain("title: Home");
  });

  it("resolves a section frame from the parent page", async () => {
    const frame = {
      type: "region",
      children: [{ type: "static", html: "frame" }, { type: "page" }],
    };
    await site.write("layouts", "master", { root: frame });
    await site.write("layouts", "events-frame", { root: frame });
    await site.writeSite({
      version: 2,
      id: "demo",
      title: "Demo",
      homePageId: "home",
      defaultLayoutId: "standard",
      masterLayoutId: "master",
    });
    await site.write("content", "events", {
      title: "Events",
      masterLayoutId: "events-frame",
      zones: { main: { html: "<p>List</p>" } },
    });
    await site.write("content", "fair", {
      title: "Fair",
      parentId: "events",
      zones: { main: { html: "<p>On the green</p>" } },
    });

    const read = await app().request("/api/records/content/fair", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(read.status).toBe(200);
    const record = (await read.json()) as {
      layout: { frames: string[]; masterLayoutId: string; masterSource: string; masterFromPageId: string };
    };
    expect(record.layout.frames.sort()).toEqual(["events-frame", "master"]);
    expect(record.layout.masterLayoutId).toBe("events-frame");
    expect(record.layout.masterSource).toBe("ancestor");
    expect(record.layout.masterFromPageId).toBe("events");
  });
});
