import {
  SITE_DOCUMENT_SCHEMA_VERSION,
  parseSiteDocument,
  type SiteDocument,
} from "@r-a-i-t-h/tessera-model";

export const DEFAULT_CONTENT_TTL_MS = 5 * 60 * 1000;

export type DocumentSource = "network" | "cache" | "provided";

export type DocumentStatus = {
  usingCachedData: boolean;
  source: DocumentSource;
};

export type CachedDocumentEnvelope = {
  schemaVersion: number;
  savedAt: string;
  document: unknown;
};

export type LoadSiteDocumentOptions = {
  documentUrl: string;
  /** Defaults to `localStorage` in browsers; pass `null` to disable. */
  storage?: Storage | null;
  storageKey?: string;
  expectedSchemaVersion?: number;
  fetchImpl?: typeof fetch;
  /** Override clock for tests. */
  now?: () => number;
};

function defaultStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function storageKeyForUrl(documentUrl: string): string {
  return `tessera:site-document:${documentUrl}`;
}

export function withCacheBust(url: string, now = Date.now()): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}t=${now}`;
}

function readCache(
  storage: Storage,
  key: string,
  expectedSchemaVersion: number,
): SiteDocument | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as CachedDocumentEnvelope;
    if (envelope.schemaVersion !== expectedSchemaVersion) {
      storage.removeItem(key);
      return null;
    }
    const doc = parseSiteDocument(envelope.document);
    if (doc.version !== expectedSchemaVersion) {
      storage.removeItem(key);
      return null;
    }
    return doc;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeDocumentCache(
  storage: Storage,
  key: string,
  document: SiteDocument,
  expectedSchemaVersion = SITE_DOCUMENT_SCHEMA_VERSION,
): void {
  if (document.version !== expectedSchemaVersion) return;
  const envelope: CachedDocumentEnvelope = {
    schemaVersion: expectedSchemaVersion,
    savedAt: new Date().toISOString(),
    document,
  };
  try {
    storage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota or private mode — browsing still works from memory.
  }
}

export function clearDocumentCache(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Fetch site.json with cache-busting. On success, validate and persist.
 * On failure, fall back to a schema-compatible localStorage copy when present.
 */
export async function loadSiteDocument(
  options: LoadSiteDocumentOptions,
): Promise<{ document: SiteDocument; status: DocumentStatus }> {
  const expectedSchemaVersion = options.expectedSchemaVersion ?? SITE_DOCUMENT_SCHEMA_VERSION;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const key = options.storageKey ?? storageKeyForUrl(options.documentUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  try {
    const res = await fetchImpl(withCacheBust(options.documentUrl, now()));
    if (!res.ok) throw new Error(`Failed to load ${options.documentUrl}: ${res.status}`);
    const document = parseSiteDocument(await res.json());
    if (document.version !== expectedSchemaVersion) {
      throw new Error(
        `Document schema ${document.version} does not match app schema ${expectedSchemaVersion}`,
      );
    }
    if (storage) writeDocumentCache(storage, key, document, expectedSchemaVersion);
    return {
      document,
      status: { usingCachedData: false, source: "network" },
    };
  } catch (networkError) {
    if (storage) {
      const cached = readCache(storage, key, expectedSchemaVersion);
      if (cached) {
        return {
          document: cached,
          status: { usingCachedData: true, source: "cache" },
        };
      }
    }
    throw networkError;
  }
}

/**
 * Re-fetch for TTL. Returns null if fetch/parse fails (caller keeps current doc).
 * Abandons and clears cache when schema mismatches.
 */
export async function refreshSiteDocument(
  options: LoadSiteDocumentOptions,
): Promise<{ document: SiteDocument; status: DocumentStatus } | null> {
  const expectedSchemaVersion = options.expectedSchemaVersion ?? SITE_DOCUMENT_SCHEMA_VERSION;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const key = options.storageKey ?? storageKeyForUrl(options.documentUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  try {
    const res = await fetchImpl(withCacheBust(options.documentUrl, now()));
    if (!res.ok) return null;
    const document = parseSiteDocument(await res.json());
    if (document.version !== expectedSchemaVersion) {
      clearDocumentCache(storage, key);
      return null;
    }
    if (storage) writeDocumentCache(storage, key, document, expectedSchemaVersion);
    return {
      document,
      status: { usingCachedData: false, source: "network" },
    };
  } catch {
    return null;
  }
}
