import { parseSiteDocument, type SiteDocument } from "@r-a-i-t-h/tessera-model";
import type { ComponentRegistry } from "./registry.js";
import { renderPage, resolvePageId, type Skin } from "./render.js";

export type SiteRendererOptions = {
  /** Parsed document, or fetch this URL as JSON. */
  document?: SiteDocument;
  documentUrl?: string;
  registry: ComponentRegistry;
  mount: string | HTMLElement;
  skin?: Skin;
  /** Called after each render (e.g. build sidebar from document.nav). */
  onAfterRender?: (pageId: string, document: SiteDocument) => void;
};

export class SiteRenderer {
  readonly document: SiteDocument;
  readonly registry: ComponentRegistry;
  readonly mount: HTMLElement;
  readonly skin?: Skin;
  private readonly onAfterRender?: SiteRendererOptions["onAfterRender"];
  private started = false;

  private constructor(opts: {
    document: SiteDocument;
    registry: ComponentRegistry;
    mount: HTMLElement;
    skin?: Skin;
    onAfterRender?: SiteRendererOptions["onAfterRender"];
  }) {
    this.document = opts.document;
    this.registry = opts.registry;
    this.mount = opts.mount;
    this.skin = opts.skin;
    this.onAfterRender = opts.onAfterRender;
  }

  static async create(options: SiteRendererOptions): Promise<SiteRenderer> {
    let siteDoc = options.document;
    if (!siteDoc) {
      if (!options.documentUrl) throw new Error("Provide document or documentUrl");
      const res = await fetch(options.documentUrl);
      if (!res.ok) throw new Error(`Failed to load ${options.documentUrl}: ${res.status}`);
      siteDoc = parseSiteDocument(await res.json());
    } else {
      siteDoc = parseSiteDocument(siteDoc);
    }

    const mountEl =
      typeof options.mount === "string"
        ? (globalThis.document.querySelector(options.mount) as HTMLElement | null)
        : options.mount;

    if (!mountEl) throw new Error(`Mount element not found: ${String(options.mount)}`);

    return new SiteRenderer({
      document: siteDoc,
      registry: options.registry,
      mount: mountEl,
      skin: options.skin,
      onAfterRender: options.onAfterRender,
    });
  }

  start(): this {
    if (this.started) return this;
    this.started = true;
    window.addEventListener("hashchange", () => this.render());
    this.render();
    return this;
  }

  render(pageId?: string): string {
    const id = resolvePageId(this.document, pageId ?? location.hash.slice(1));
    const html = renderPage({
      document: this.document,
      pageId: id,
      registry: this.registry,
      skin: this.skin,
    });
    this.mount.innerHTML = html;
    window.scrollTo(0, 0);
    this.onAfterRender?.(id, this.document);
    return html;
  }
}
