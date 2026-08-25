import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDocumentCache,
  loadSiteDocument,
  refreshSiteDocument,
  storageKeyForUrl,
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

describe("document cache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches with cache-bust, validates, and writes storage", async () => {
    const doc = makeFixtureDoc();
    const storage = memoryStorage();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(doc), { status: 200 }),
    );

    const result = await loadSiteDocument({
      documentUrl: "./data/site.json",
      storage,
      now: () => 42,
    });

    expect(fetchMock).toHaveBeenCalledWith("./data/site.json?t=42");
    expect(result.status).toEqual({ usingCachedData: false, source: "network" });
    expect(result.document.site.id).toBe("test");
    expect(storage.getItem(storageKeyForUrl("./data/site.json"))).toBeTruthy();
  });

  it("falls back to cache when fetch fails", async () => {
    const doc = makeFixtureDoc();
    const storage = memoryStorage();
    const key = storageKeyForUrl("./data/site.json");
    writeDocumentCache(storage, key, doc);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await loadSiteDocument({
      documentUrl: "./data/site.json",
      storage,
    });

    expect(result.status.usingCachedData).toBe(true);
    expect(result.status.source).toBe("cache");
    expect(result.document.pages[0]!.id).toBe("home");
  });

  it("abandons cache when schema version mismatches", async () => {
    const storage = memoryStorage();
    const key = storageKeyForUrl("./data/site.json");
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
      loadSiteDocument({ documentUrl: "./data/site.json", storage }),
    ).rejects.toThrow(/offline/);
    expect(storage.getItem(key)).toBeNull();
  });

  it("refresh returns null on failure without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const result = await refreshSiteDocument({
      documentUrl: "./data/site.json",
      storage: memoryStorage(),
    });
    expect(result).toBeNull();
  });

  it("clearDocumentCache removes the key", () => {
    const storage = memoryStorage();
    const key = "k";
    writeDocumentCache(storage, key, makeFixtureDoc());
    clearDocumentCache(storage, key);
    expect(storage.getItem(key)).toBeNull();
  });
});
