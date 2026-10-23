import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth/password.js";
import { SessionStore } from "../src/auth/sessions.js";
import { projectRuntimeModules, publicRuntimeModuleUrl } from "../src/site/runtime-module.js";
import { RuntimeModuleLibrary } from "../src/site/runtime-module-store.js";
import { SiteStore } from "../src/site/store.js";
import { UserStore } from "../src/store/users.js";

describe("projectRuntimeModules", () => {
  it("derives public urls from catalog records", () => {
    expect(
      projectRuntimeModules([{ id: "demo", ext: "mjs", title: "Demo" }]),
    ).toEqual([{ id: "demo", url: publicRuntimeModuleUrl("demo", "mjs"), title: "Demo" }]);
  });
});

describe("runtime module API", () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  async function setup() {
    root = await mkdtemp(join(tmpdir(), "tessera-rtmod-"));
    const records = join(root, "records");
    const site = new SiteStore(records, join(root, "preview", "data", "site.json"));
    await site.write("layouts", "page", { root: { type: "zone", id: "main" } });
    await site.write("content", "home", { title: "Home", zones: { main: { html: "<p>Hi</p>" } } });
    await site.writeSite({ version: 2, id: "demo", title: "Demo", homePageId: "home", defaultLayoutId: "page" });
    const library = new RuntimeModuleLibrary(site, join(root, "runtime-modules"));
    const users = new UserStore(join(root, "users"));
    await users.load();
    const password = await hashPassword("secret1");
    await users.createUser("alice", password.hash, password.salt);
    const sessions = new SessionStore();
    const token = sessions.create("alice").token;
    const app = createApp({ users, sessions, site, siteRoot: root });
    return { site, library, app, token };
  }

  it("uploads, reads raw text, and writes the blob on disk", async () => {
    const { library, app, token } = await setup();
    const source = 'export default function mount(root) { root.textContent = "ok"; }\n';
    const upload = await app.request("/api/runtime-modules/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: (() => {
        const form = new FormData();
        form.append("file", new File([source], "hello.mjs", { type: "text/javascript" }));
        return form;
      })(),
    });
    expect(upload.status).toBe(200);
    const created = (await upload.json()) as { id: string };
    expect(created.id).toBe("hello");

    const raw = await app.request(`/api/runtime-modules/${created.id}/raw`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(raw.status).toBe(200);
    const body = (await raw.json()) as { text: string };
    expect(body.text).toBe(source);

    const onDisk = await readFile(join(root, "runtime-modules", "hello.mjs"), "utf8");
    expect(onDisk).toBe(source);

    const listing = await library.list();
    expect(listing.modules.map((m) => m.id)).toEqual(["hello"]);
  });
});
