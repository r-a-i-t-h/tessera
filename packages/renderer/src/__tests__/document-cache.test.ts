import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDocumentCache,
  loadSiteDocument,
  refreshSiteDocument,
  documentCacheKey,
  writeDocumentCache,
} from "../document-cache.js";
import { makeFixtureDoc } from "./fixtures.js";

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

const pageUrl = "https://raith.com/willow/";

describe("document cache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives each published site its own cache key on a shared origin", () => {
    const a = documentCacheKey("./data/site.json", "https://raith.com/a/");
    const b = documentCacheKey("./data/site.json", "https://raith.com/b/");
    expect(a).toBe("tessera:site-document:https://raith.com/a/data/site.json");
    expect(b).toBe("tessera:site-document:https://raith.com/b/data/site.json");
    expect(a).not.toBe(b);
    expect(documentCacheKey("./data/site.json", "https://raith.com/a/#about")).toBe(a);
  });

  it("fetches the hashed site file as named, validates, and writes storage", async () => {
    const doc = makeFixtureDoc();
    const storage = memoryStorage();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(doc), { status: 200 }),
    );

    const result = await loadSiteDocument({
      documentUrl: "./data/site.abc123.json",
      pageUrl,
      storage,
    });

    expect(fetchMock).toHaveBeenCalledWith("./data/site.abc123.json");
    expect(result.status).toEqual({ usingCachedData: false, source: "network" });
    expect(result.document.site.id).toBe("test");
    expect(storage.getItem(documentCacheKey("./data/site.abc123.json", pageUrl))).toBeTruthy();
  });

  it("falls back to cache when fetch fails", async () => {
    const doc = makeFixtureDoc();
    const storage = memoryStorage();
    const key = documentCacheKey("./data/site.json", pageUrl);
    writeDocumentCache(storage, key, doc);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await loadSiteDocument({
      documentUrl: "./data/site.json",
      pageUrl,
      storage,
    });

    expect(result.status.usingCachedData).toBe(true);
    expect(result.status.source).toBe("cache");
    expect(result.document.pages[0]!.id).toBe("home");
  });

  it("abandons cache when schema version mismatches", async () => {
    const storage = memoryStorage();
    const key = documentCacheKey("./data/site.json", pageUrl);
    storage.setItem(
      key,
      JSON.stringify({
        schemaVersion: 99,
        savedAt: new Date().toISOString(),
        document: makeFixtureDoc(),
      }),
    );

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    await expect(
      loadSiteDocument({ documentUrl: "./data/site.json", pageUrl, storage }),
    ).rejects.toThrow(/offline/);
    expect(storage.getItem(key)).toBeNull();
  });

  it("refresh returns null when the revision check fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await refreshSiteDocument({
      documentUrl: "./data/site.abc123.json",
      pageUrl,
      storage: memoryStorage(),
    });
    expect(result).toBeNull();
  });

  it("refresh skips the document body when rev.json names the current hash", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hash: "abc123", file: "site.abc123.json" }), { status: 200 }),
    );
    const result = await refreshSiteDocument({
      documentUrl: "./data/site.abc123.json",
      pageUrl,
      storage: memoryStorage(),
    });
    expect(result).toEqual({ changed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("./data/rev.json", { cache: "no-cache" });
  });

  it("refresh downloads the new hashed file when rev.json changes", async () => {
    const doc = makeFixtureDoc();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("rev.json")) {
        return new Response(JSON.stringify({ hash: "def456", file: "site.def456.json" }), { status: 200 });
      }
      return new Response(JSON.stringify(doc), { status: 200 });
    });
    const storage = memoryStorage();
    const result = await refreshSiteDocument({
      documentUrl: "./data/site.abc123.json",
      pageUrl,
      storage,
    });
    expect(result).toMatchObject({
      changed: true,
      documentUrl: "./data/site.def456.json",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.getItem(documentCacheKey("./data/site.def456.json", pageUrl))).toBeTruthy();
  });

  it("clearDocumentCache removes the key", () => {
    const storage = memoryStorage();
    const key = "k";
    writeDocumentCache(storage, key, makeFixtureDoc());
    clearDocumentCache(storage, key);
    expect(storage.getItem(key)).toBeNull();
  });
});
