import { invalidateEditorIndex } from "./editor-index-cache.js";

export const READ_CACHE_CHANNEL = "tessera-editor-cache";

const ME_PATH = "/auth/me";
const ME_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { data: unknown; fetchedAt: number };

const readCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

let channel: BroadcastChannel | undefined;
let channelListenerBound = false;

function cacheKey(path: string, method: string): string | null {
  if (method !== "GET") return null;
  return `GET ${path}`;
}

function meEntryExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt > ME_TTL_MS;
}

function dropReadCacheLocal(invalidateIndex: boolean): void {
  readCache.clear();
  if (invalidateIndex) invalidateEditorIndex();
}

function ensureBroadcastChannel(): BroadcastChannel | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;
  if (!channel) {
    channel = new BroadcastChannel(READ_CACHE_CHANNEL);
  }
  if (!channelListenerBound) {
    channelListenerBound = true;
    channel.addEventListener("message", () => {
      dropReadCacheLocal(true);
    });
  }
  return channel;
}

function notifyOtherTabs(): void {
  ensureBroadcastChannel()?.postMessage({ type: "drop" });
}

/** Drop cached GET responses and the command-palette index; notify other editor tabs. */
export function clearEditorReadCache(): void {
  dropReadCacheLocal(true);
  notifyOtherTabs();
}

/** After a failed session or a successful write. */
export function bustEditorReadCache(): void {
  dropReadCacheLocal(true);
  notifyOtherTabs();
}

export function peekReadCacheForTests(): Map<string, CacheEntry> {
  return readCache;
}

export function readCacheGet<T>(path: string): T | undefined {
  const key = cacheKey(path, "GET");
  if (!key) return undefined;
  const hit = readCache.get(key);
  if (!hit) return undefined;
  if (path === ME_PATH && meEntryExpired(hit)) {
    readCache.delete(key);
    return undefined;
  }
  return structuredClone(hit.data) as T;
}

export function readCacheSet(path: string, data: unknown): void {
  const key = cacheKey(path, "GET");
  if (!key) return;
  readCache.set(key, { data, fetchedAt: Date.now() });
}

export function readCacheInFlight<T>(path: string): Promise<T> | undefined {
  const key = cacheKey(path, "GET");
  if (!key) return undefined;
  return inFlight.get(key) as Promise<T> | undefined;
}

export function readCacheTrackInFlight(path: string, promise: Promise<unknown>): void {
  const key = cacheKey(path, "GET");
  if (!key) return;
  inFlight.set(key, promise);
}

export function readCacheClearInFlight(path: string): void {
  const key = cacheKey(path, "GET");
  if (!key) return;
  inFlight.delete(key);
}

export function isMutatingMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

/** Test helper: drop local GET cache without notifying other tabs. */
export function resetEditorReadCacheForTests(): void {
  readCache.clear();
  inFlight.clear();
}

if (typeof BroadcastChannel !== "undefined") {
  ensureBroadcastChannel();
}
