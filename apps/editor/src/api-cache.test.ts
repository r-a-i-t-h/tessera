import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  READ_CACHE_CHANNEL,
  clearEditorReadCache,
  peekReadCacheForTests,
  resetEditorReadCacheForTests,
} from "./api-read-cache.js";
import { me, listRecords, logout } from "./api.js";

const ME_BODY = { ok: true, username: "alice", createdAt: "2026-01-01" };
const RECORDS_BODY = { ok: true, records: [{ kind: "site", id: "site", title: "Site" }] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("editor read cache", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetEditorReadCacheForTests();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetEditorReadCacheForTests();
  });

  it("deduplicates concurrent me() and listRecords() GETs", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/auth/me") return Promise.resolve(jsonResponse(ME_BODY));
      if (url === "/api/records") return Promise.resolve(jsonResponse(RECORDS_BODY));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    await Promise.all([me(), me()]);
    expect(fetchMock.mock.calls.filter(([u]) => u === "/auth/me")).toHaveLength(1);

    resetEditorReadCacheForTests();
    fetchMock.mockClear();

    await Promise.all([listRecords(), listRecords()]);
    expect(fetchMock.mock.calls.filter(([u]) => u === "/api/records")).toHaveLength(1);
  });

  it("refetches /auth/me after five minutes but keeps /api/records", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-06-01T12:00:00.000Z");
    vi.setSystemTime(start);

    fetchMock.mockImplementation((url: string) => {
      if (url === "/auth/me") return Promise.resolve(jsonResponse(ME_BODY));
      if (url === "/api/records") return Promise.resolve(jsonResponse(RECORDS_BODY));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    await me();
    await listRecords();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(start.getTime() + 5 * 60 * 1000 + 1));

    await me();
    expect(fetchMock.mock.calls.filter(([u]) => u === "/auth/me")).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([u]) => u === "/api/records")).toHaveLength(1);

    await listRecords();
    expect(fetchMock.mock.calls.filter(([u]) => u === "/api/records")).toHaveLength(1);
  });

  it("drops cache after a successful mutating request", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/auth/me" && method === "GET") return Promise.resolve(jsonResponse(ME_BODY));
      if (url === "/auth/logout" && method === "POST") return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    await me();
    await logout();
    await me();
    expect(fetchMock.mock.calls.filter(([u]) => u === "/auth/me")).toHaveLength(2);
  });

  it("does not cache 401 responses", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/auth/me") return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    await expect(me()).rejects.toMatchObject({ status: 401 });
    expect(peekReadCacheForTests().size).toBe(0);
  });

  it("clears cached session state when /auth/me returns 401", async () => {
    vi.useFakeTimers();
    const start = new Date("2026-06-01T12:00:00.000Z");
    vi.setSystemTime(start);

    fetchMock.mockImplementation((url: string) => {
      if (url === "/auth/me") return Promise.resolve(jsonResponse(ME_BODY));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    await me();
    expect(peekReadCacheForTests().size).toBe(1);

    vi.setSystemTime(new Date(start.getTime() + 5 * 60 * 1000 + 1));
    fetchMock.mockImplementation((url: string) => {
      if (url === "/auth/me") return Promise.resolve(jsonResponse({ error: "Unauthorized" }, 401));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    await expect(me()).rejects.toMatchObject({ status: 401 });
    expect(peekReadCacheForTests().size).toBe(0);
  });

  it("drops cache in another tab when broadcast fires", async () => {
    if (typeof BroadcastChannel === "undefined") return;

    fetchMock.mockImplementation((url: string) => {
      if (url === "/auth/me") return Promise.resolve(jsonResponse(ME_BODY));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    const peer = new BroadcastChannel(READ_CACHE_CHANNEL);
    try {
      await me();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      peer.postMessage({ type: "drop" });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      expect(peekReadCacheForTests().size).toBe(0);

      await me();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      peer.close();
    }
  });

  it("returns isolated copies from the cache", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/records") return Promise.resolve(jsonResponse(RECORDS_BODY));
      return Promise.resolve(jsonResponse({ error: "unexpected" }, 404));
    });

    const first = await listRecords();
    first.records.push({ kind: "nav", id: "nav", title: "Nav" });
    const second = await listRecords();
    expect(second.records).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
