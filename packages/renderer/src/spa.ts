import { parseSiteDocument, type SiteDocument } from "@r-a-i-t-h/tessera-model";
import type { ComponentRegistry } from "./registry.js";
import { renderPage, resolvePageId, type Skin } from "./render.js";
import {
  DEFAULT_CONTENT_TTL_MS,
  loadSiteDocument,
  refreshSiteDocument,
  type DocumentStatus,
  type DocumentSource,
} from "./document-cache.js";

export type { DocumentStatus, DocumentSource };

export type SiteRendererOptions = {
  /** Parsed document, or fetch this URL as JSON. */
  document?: SiteDocument;
  documentUrl?: string;
  registry: ComponentRegistry;
  mount: string | HTMLElement;
  skin?: Skin;
  /** Called after each render (e.g. build sidebar from document.nav). */
  onAfterRender?: (pageId: string, document: SiteDocument) => void;
  /** Called when load/refresh status changes (stale banner, etc.). */
  onStatusChange?: (status: DocumentStatus) => void;
  /**
   * In-session re-fetch interval while the SPA stays open.
   * Default 5 minutes; `0` or negative disables. Only applies when `documentUrl` is set.
   */
  ttlMs?: number;
  /** Defaults to `localStorage`; pass `null` to disable persistence. */
  storage?: Storage | null;
  storageKey?: string;
};

export class SiteRenderer {
  private _document: SiteDocument;
  readonly registry: ComponentRegistry;
  readonly mount: HTMLElement;
  readonly skin?: Skin;
  private readonly onAfterRender?: SiteRendererOptions["onAfterRender"];
  private readonly onStatusChange?: SiteRendererOptions["onStatusChange"];
  private documentUrl?: string;
  private readonly ttlMs: number;
  private readonly storage: Storage | null | undefined;
  private readonly storageKey?: string;
  private started = false;
  private ttlTimer: ReturnType<typeof setInterval> | null = null;
  private _status: DocumentStatus;

  private constructor(opts: {
    document: SiteDocument;
    registry: ComponentRegistry;
    mount: HTMLElement;
    skin?: Skin;
    onAfterRender?: SiteRendererOptions["onAfterRender"];
    onStatusChange?: SiteRendererOptions["onStatusChange"];
    documentUrl?: string;
    ttlMs: number;
    storage?: Storage | null;
    storageKey?: string;
    status: DocumentStatus;
  }) {
    this._document = opts.document;
    this.registry = opts.registry;
    this.mount = opts.mount;
    this.skin = opts.skin;
    this.onAfterRender = opts.onAfterRender;
    this.onStatusChange = opts.onStatusChange;
    this.documentUrl = opts.documentUrl;
    this.ttlMs = opts.ttlMs;
    this.storage = opts.storage;
    this.storageKey = opts.storageKey;
    this._status = opts.status;
  }

  get document(): SiteDocument {
    return this._document;
  }

  get status(): DocumentStatus {
    return this._status;
  }

  get usingCachedData(): boolean {
    return this._status.usingCachedData;
  }

  static async create(options: SiteRendererOptions): Promise<SiteRenderer> {
    let siteDoc: SiteDocument;
    let status: DocumentStatus;

    if (options.document) {
      siteDoc = parseSiteDocument(options.document);
      status = { usingCachedData: false, source: "provided" };
    } else {
      if (!options.documentUrl) throw new Error("Provide document or documentUrl");
      const loaded = await loadSiteDocument({
        documentUrl: options.documentUrl,
        pageUrl: window.location.href,
        storage: options.storage,
        storageKey: options.storageKey,
      });
      siteDoc = loaded.document;
      status = loaded.status;
    }

    const mountEl =
      typeof options.mount === "string"
        ? (globalThis.document.querySelector(options.mount) as HTMLElement | null)
        : options.mount;

    if (!mountEl) throw new Error(`Mount element not found: ${String(options.mount)}`);

    const ttlMs = options.ttlMs ?? DEFAULT_CONTENT_TTL_MS;

    const renderer = new SiteRenderer({
      document: siteDoc,
      registry: options.registry,
      mount: mountEl,
      skin: options.skin,
      onAfterRender: options.onAfterRender,
      onStatusChange: options.onStatusChange,
      documentUrl: options.documentUrl,
      ttlMs,
      storage: options.storage,
      storageKey: options.storageKey,
      status,
    });

    options.onStatusChange?.(status);
    return renderer;
  }

  start(): this {
    if (this.started) return this;
    this.started = true;
    window.addEventListener("hashchange", this.boundRender);
    this.render();
    this.startTtl();
    return this;
  }

  /** Stop hash listening and TTL (for tests / teardown). */
  stop(): this {
    if (!this.started) return this;
    this.started = false;
    window.removeEventListener("hashchange", this.boundRender);
    this.clearTtl();
    return this;
  }

  private boundRender = (): void => {
    this.render();
  };

  private startTtl(): void {
    this.clearTtl();
    if (!this.documentUrl || this.ttlMs <= 0) return;
    this.ttlTimer = setInterval(() => {
      void this.refreshFromNetwork();
    }, this.ttlMs);
  }

  private clearTtl(): void {
    if (this.ttlTimer !== null) {
      clearInterval(this.ttlTimer);
      this.ttlTimer = null;
    }
  }

  /** Force a TTL-style refresh (also used by tests). */
  async refreshFromNetwork(): Promise<boolean> {
    if (!this.documentUrl) return false;
    const result = await refreshSiteDocument({
      documentUrl: this.documentUrl,
      pageUrl: window.location.href,
      storage: this.storage,
      storageKey: this.storageKey,
    });
    if (!result) {
      if (!this._status.usingCachedData) {
        this.setStatus({ usingCachedData: true, source: this._status.source });
      }
      return false;
    }
    if (!result.changed) return true;
    this.documentUrl = result.documentUrl;
    this._document = result.document;
    this.setStatus(result.status);
    if (this.started) this.render();
    return true;
  }

  private setStatus(status: DocumentStatus): void {
    this._status = status;
    this.onStatusChange?.(status);
  }

  render(pageId?: string): string {
    // Unknown hashes fall back silently via resolvePageId (home / first page).
    const id = resolvePageId(this._document, pageId ?? location.hash.slice(1));
    const html = renderPage({
      document: this._document,
      pageId: id,
      registry: this.registry,
      skin: this.skin,
    });
    this.mount.innerHTML = html;
    window.scrollTo(0, 0);
    this.onAfterRender?.(id, this._document);
    return html;
  }
}
