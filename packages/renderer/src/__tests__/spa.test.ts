import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentRegistry, SiteRenderer, documentCacheKey, writeDocumentCache } from "../index.js";
import { makeFixtureDoc } from "./fixtures.js";

function buildRegistry() {
  const registry = new ComponentRegistry();
  registry.define("greet", () => "greet");
  registry.define("eventList", () => "events");
  return registry;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
    key: (i) => [...map.keys()][i] ?? null,
  };
}

describe("SiteRenderer navigation", () => {
  let mount: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    mount = document.getElementById("app")!;
    window.location.hash = "";
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the home page by default and calls onAfterRender", async () => {
    const after: string[] = [];
    const renderer = await SiteRenderer.create({
      document: makeFixtureDoc(),
      registry: buildRegistry(),
      mount: "#app",
      onAfterRender: (id) => after.push(id),
    });
    renderer.start();
    expect(mount.innerHTML).toContain("Home title");
    expect(after).toEqual(["home"]);
    renderer.stop();
  });

  it("navigates on hashchange", async () => {
    const renderer = await SiteRenderer.create({
      document: makeFixtureDoc(),
      registry: buildRegistry(),
      mount: "#app",
    });
    renderer.start();
    expect(mount.innerHTML).toContain("Home title");

    window.location.hash = "#about";
    window.dispatchEvent(new Event("hashchange"));

    expect(mount.innerHTML).toContain("About body");
    expect(mount.innerHTML).not.toContain("Home title");

    window.location.hash = "#about/tenant/hall";
    window.dispatchEvent(new Event("hashchange"));
    expect(mount.innerHTML).toContain("About body");
    renderer.stop();
  });

  it("unknown hash falls back to home without error UI", async () => {
    const renderer = await SiteRenderer.create({
      document: makeFixtureDoc(),
      registry: buildRegistry(),
      mount: "#app",
    });
    renderer.start();
    window.location.hash = "#does-not-exist";
    window.dispatchEvent(new Event("hashchange"));
    expect(mount.innerHTML).toContain("Home title");
    renderer.stop();
  });

  it("render(pageId) overrides the hash", async () => {
    window.location.hash = "#home";
    const renderer = await SiteRenderer.create({
      document: makeFixtureDoc(),
      registry: buildRegistry(),
      mount: "#app",
    });
    renderer.start();
    renderer.render("hidden-aside");
    expect(mount.innerHTML).toContain("No aside layout");
    expect(mount.innerHTML).not.toContain("Should not show");
    renderer.stop();
  });

  it("loads a document from the hashed relative URL", async () => {
    const doc = makeFixtureDoc();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(doc), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const renderer = await SiteRenderer.create({
      documentUrl: "./data/site.abc123.json",
      registry: buildRegistry(),
      mount: "#app",
      storage: null,
      ttlMs: 0,
    });
    renderer.start();

    expect(fetchMock.mock.calls[0]![0]).toBe("./data/site.abc123.json");
    expect(mount.innerHTML).toContain("Home title");
    expect(renderer.usingCachedData).toBe(false);
    renderer.stop();
  });

  it("uses localStorage fallback and reports stale status", async () => {
    const doc = makeFixtureDoc();
    const storage = memoryStorage();
    writeDocumentCache(storage, documentCacheKey("./data/site.json", window.location.href), doc);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const statuses: boolean[] = [];
    const renderer = await SiteRenderer.create({
      documentUrl: "./data/site.json",
      registry: buildRegistry(),
      mount: "#app",
      storage,
      ttlMs: 0,
      onStatusChange: (s) => statuses.push(s.usingCachedData),
    });
    renderer.start();

    expect(renderer.usingCachedData).toBe(true);
    expect(statuses).toEqual([true]);
    expect(mount.innerHTML).toContain("Home title");
    renderer.stop();
  });

  it("TTL refresh reads rev.json and updates only when the hash changes", async () => {
    vi.useFakeTimers();
    const doc1 = makeFixtureDoc();
    const doc2 = makeFixtureDoc();
    doc2.pages[0]!.zones.title = [{ type: "text", html: "Updated home" }];

    let revision = { hash: "aaa111", file: "site.aaa111.json" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("rev.json")) {
        return new Response(JSON.stringify(revision), { status: 200 });
      }
      if (target.endsWith("site.bbb222.json")) {
        return new Response(JSON.stringify(doc2), { status: 200 });
      }
      return new Response(JSON.stringify(doc1), { status: 200 });
    });

    const renderer = await SiteRenderer.create({
      documentUrl: "./data/site.aaa111.json",
      registry: buildRegistry(),
      mount: "#app",
      storage: null,
      ttlMs: 1000,
    });
    renderer.start();
    expect(mount.innerHTML).toContain("Home title");

    await vi.advanceTimersByTimeAsync(1000);
    expect(mount.innerHTML).toContain("Home title");
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("site.bbb222.json"))).toBe(false);

    revision = { hash: "bbb222", file: "site.bbb222.json" };
    await vi.advanceTimersByTimeAsync(1000);
    expect(mount.innerHTML).toContain("Updated home");
    renderer.stop();
    vi.useRealTimers();
  });
});
