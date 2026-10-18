import { WCBase } from "@r-a-i-t-h/tessera-wc-base";

export type ImageRevealRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ImageRevealItem = {
  id: string;
  url: string;
  href: string;
  alt?: string;
  rect?: ImageRevealRect;
};

type PanelState = {
  el: HTMLAnchorElement;
  orig: ImageRevealRect;
  href: string;
};

/** Legacy autoposition: evenly spaced horizontal tiles, vertically centered. */
export function autopositionRects(
  count: number,
  stageW: number,
  stageH: number,
  tileW: number,
  tileH: number,
): ImageRevealRect[] {
  const rects: ImageRevealRect[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = Math.round(((stageW - tileW * count) / (count + 1)) * (i + 1) + tileW * i);
    const y = Math.round((stageH - tileH) / 2);
    rects.push({ left: x, top: y, width: tileW, height: tileH });
  }
  return rects;
}

function defaultTileSize(items: ImageRevealItem[], stageW: number, stageH: number): { w: number; h: number } {
  for (const item of items) {
    if (item.rect) {
      return { w: item.rect.width, h: item.rect.height };
    }
  }
  const side = Math.min(180, Math.round(Math.min(stageW, stageH) * 0.45));
  return { w: side, h: side };
}

export function resolveItemRects(
  items: ImageRevealItem[],
  stageW: number,
  stageH: number,
  autoposition: boolean,
): ImageRevealRect[] {
  const manual = items.every((item) => item.rect);
  if (manual) {
    return items.map((item) => item.rect!);
  }
  if (!autoposition) {
    const { w, h } = defaultTileSize(items, stageW, stageH);
    return autopositionRects(items.length, stageW, stageH, w, h);
  }
  const { w, h } = defaultTileSize(items, stageW, stageH);
  return autopositionRects(items.length, stageW, stageH, w, h);
}

function parseItems(raw: string | null): ImageRevealItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const items: ImageRevealItem[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (typeof o.url !== "string" || typeof o.href !== "string" || typeof o.id !== "string") continue;
      const item: ImageRevealItem = {
        id: o.id,
        url: o.url,
        href: o.href,
        alt: typeof o.alt === "string" ? o.alt : undefined,
      };
      if (o.rect && typeof o.rect === "object") {
        const r = o.rect as Record<string, unknown>;
        if (
          typeof r.left === "number" &&
          typeof r.top === "number" &&
          typeof r.width === "number" &&
          typeof r.height === "number"
        ) {
          item.rect = { left: r.left, top: r.top, width: r.width, height: r.height };
        }
      }
      items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}

function numAttr(el: Element, name: string, fallback: number): number {
  const raw = el.getAttribute(name);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function fineHover(): boolean {
  return typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Cropped image panels: hover grow (fine pointer), click/tap reveal full stage then navigate.
 */
export class TesseraImageRevealGallery extends WCBase {
  useShadow = false;

  wrapEl = this.d({ className: "tessera-irg-wrap" });
  stageEl = this.d({ className: "tessera-irg-stage" });

  #items: ImageRevealItem[] = [];
  #panels: PanelState[] = [];
  #designW = 700;
  #designH = 300;
  #layout: "scale" | "stack" = "scale";
  #hoverExpand = 30;
  #navigateDelay = 2500;
  #autoposition = true;
  #scale = 1;
  #activeIndex = -1;
  #navigating = false;
  #resizeObserver: ResizeObserver | null = null;
  #hoverCapable = fineHover();

  static a = {
    items(this: TesseraImageRevealGallery, v: string | null) {
      this.#items = parseItems(v);
      if (this.isConnected) this.#rebuild();
    },
    width(this: TesseraImageRevealGallery, v: string | null) {
      const n = v === null || v === "" ? 700 : Number(v);
      this.#designW = Number.isFinite(n) ? n : 700;
      if (this.isConnected) this.#rebuild();
    },
    height(this: TesseraImageRevealGallery, v: string | null) {
      const n = v === null || v === "" ? 300 : Number(v);
      this.#designH = Number.isFinite(n) ? n : 300;
      if (this.isConnected) this.#rebuild();
    },
    layout(this: TesseraImageRevealGallery, v: string | null) {
      this.#layout = v === "stack" ? "stack" : "scale";
      if (this.isConnected) this.#rebuild();
    },
    "hover-expand"(this: TesseraImageRevealGallery, v: string | null) {
      const n = v === null || v === "" ? 30 : Number(v);
      this.#hoverExpand = Number.isFinite(n) ? n : 30;
    },
    "navigate-delay"(this: TesseraImageRevealGallery, v: string | null) {
      const n = v === null || v === "" ? 2500 : Number(v);
      this.#navigateDelay = Number.isFinite(n) ? n : 2500;
    },
    autoposition(this: TesseraImageRevealGallery, v: string | null) {
      this.#autoposition = v !== "false";
      if (this.isConnected) this.#rebuild();
    },
  };

  b() {
    this.style.display = "block";
    this.classList.add("tessera-irg", "tessera-block");
    this.wrapEl.style.maxWidth = `${this.#designW}px`;
    return [this.wrapEl, [this.stageEl]];
  }

  c() {
    this.#readAttrs();
    this.#hoverCapable = fineHover();
    this.#rebuild();
    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver(() => this.#syncScale());
      this.#resizeObserver.observe(this.stageEl);
    }
    this.#syncScale();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
  }

  #readAttrs(): void {
    this.#items = parseItems(this.getAttribute("items"));
    this.#designW = numAttr(this, "width", 700);
    this.#designH = numAttr(this, "height", 300);
    this.#layout = this.getAttribute("layout") === "stack" ? "stack" : "scale";
    this.#hoverExpand = numAttr(this, "hover-expand", 30);
    this.#navigateDelay = numAttr(this, "navigate-delay", 2500);
    this.#autoposition = this.getAttribute("autoposition") !== "false";
    this.wrapEl.style.maxWidth = `${this.#designW}px`;
  }

  #rebuild(): void {
    this.#navigating = false;
    this.#activeIndex = -1;
    this.stageEl.replaceChildren();
    this.#panels = [];
    this.classList.toggle("tessera-irg--stack", this.#layout === "stack");
    this.classList.toggle("tessera-irg--scale", this.#layout !== "stack");

    if (!this.#items.length) {
      const empty = this.d({ className: "w3-text-grey w3-padding" });
      empty.textContent = "No reveal banner panels.";
      this.stageEl.append(empty);
      return;
    }

    const rects = resolveItemRects(this.#items, this.#designW, this.#designH, this.#autoposition);

    this.stageEl.style.aspectRatio =
      this.#layout === "stack" ? "" : `${this.#designW} / ${this.#designH}`;

    for (let i = 0; i < this.#items.length; i += 1) {
      const item = this.#items[i]!;
      const orig = rects[i]!;
      const link = this.e("a", {
        className: "tessera-irg-panel",
        href: item.href,
      });
      link.style.backgroundImage = `url("${item.url.replace(/"/g, "%22")}")`;
      if (item.alt) link.setAttribute("aria-label", item.alt);
      link.tabIndex = 0;

      const idx = i;
      link.addEventListener("mouseenter", () => this.#onHoverEnter(idx));
      link.addEventListener("mouseleave", () => this.#onHoverLeave(idx));
      link.addEventListener("click", (e) => this.#onActivate(e, idx));
      link.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.#onActivate(e, idx);
        }
      });

      this.stageEl.append(link);
      this.#panels.push({ el: link, orig, href: item.href });
    }

    this.#syncScale();
  }

  #syncScale(): void {
    if (this.#layout === "stack") {
      this.#scale = 1;
      for (let i = 0; i < this.#panels.length; i += 1) {
        this.#applyStackRect(this.#panels[i]!, i);
      }
      return;
    }
    const w = this.stageEl.clientWidth;
    this.#scale = w > 0 ? w / this.#designW : 1;
    for (let i = 0; i < this.#panels.length; i += 1) {
      const panel = this.#panels[i]!;
      if (panel.el.classList.contains("is-revealed")) {
        this.#applyRect(panel.el, { left: 0, top: 0, width: this.#designW, height: this.#designH });
      } else if (panel.el.classList.contains("is-hovered") && i === this.#activeIndex) {
        this.#applyRect(panel.el, this.#expandedRect(panel.orig));
      } else {
        this.#applyRect(panel.el, panel.orig);
      }
    }
  }

  #applyStackRect(panel: PanelState, index: number): void {
    const r = panel.orig;
    const ratio = r.width > 0 ? r.height / r.width : 9 / 16;
    panel.el.style.position = "relative";
    panel.el.style.left = "";
    panel.el.style.top = "";
    panel.el.style.width = "100%";
    panel.el.style.height = "";
    panel.el.style.aspectRatio = `${r.width} / ${r.height}`;
    panel.el.style.marginBottom = index < this.#panels.length - 1 ? "0.75rem" : "";
    panel.el.style.backgroundPosition = `-${r.left}px -${r.top}px`;
    panel.el.style.backgroundSize = `${this.#designW}px ${this.#designH}px`;
    panel.el.style.zIndex = panel.el.classList.contains("is-revealed") ? "999" : String(991 + index);
  }

  #applyRect(el: HTMLAnchorElement, rect: ImageRevealRect): void {
    const s = this.#scale;
    const left = rect.left * s;
    const top = rect.top * s;
    const width = rect.width * s;
    const height = rect.height * s;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.backgroundPosition = `-${left}px -${top}px`;
  }

  #expandedRect(orig: ImageRevealRect): ImageRevealRect {
    const e = this.#hoverExpand;
    return {
      left: orig.left - e,
      top: orig.top - e,
      width: orig.width + e * 2,
      height: orig.height + e * 2,
    };
  }

  #onHoverEnter(index: number): void {
    if (!this.#hoverCapable || this.#navigating || this.#layout === "stack") return;
    this.#activeIndex = index;
    for (let i = 0; i < this.#panels.length; i += 1) {
      const panel = this.#panels[i]!;
      panel.el.classList.toggle("is-hovered", i === index);
      panel.el.style.zIndex = i === index ? "999" : "991";
      if (i === index) {
        this.#applyRect(panel.el, this.#expandedRect(panel.orig));
      } else {
        this.#applyRect(panel.el, panel.orig);
      }
    }
  }

  #onHoverLeave(index: number): void {
    if (!this.#hoverCapable || this.#navigating || this.#layout === "stack") return;
    if (this.#activeIndex !== index) return;
    this.#activeIndex = -1;
    const panel = this.#panels[index];
    if (!panel) return;
    panel.el.classList.remove("is-hovered");
    this.#applyRect(panel.el, panel.orig);
  }

  #onActivate(e: Event, index: number): void {
    if (this.#navigating) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    this.#navigating = true;
    this.#activeIndex = index;

    for (let i = 0; i < this.#panels.length; i += 1) {
      const panel = this.#panels[i]!;
      panel.el.classList.remove("is-hovered");
      panel.el.onmouseenter = null;
      panel.el.onmouseleave = null;
      if (i === index) {
        panel.el.classList.add("is-revealed");
        panel.el.style.zIndex = "999";
        if (this.#layout === "stack") {
          panel.el.style.backgroundSize = "cover";
          panel.el.style.backgroundPosition = "center";
        } else if (prefersReducedMotion()) {
          this.#applyRect(panel.el, { left: 0, top: 0, width: this.#designW, height: this.#designH });
        } else {
          this.#applyRect(panel.el, { left: 0, top: 0, width: this.#designW, height: this.#designH });
        }
      } else {
        panel.el.style.opacity = "0";
        panel.el.style.pointerEvents = "none";
      }
    }

    const href = this.#panels[index]?.href ?? "";
    const delay = prefersReducedMotion() ? Math.min(400, this.#navigateDelay) : this.#navigateDelay;
    const navigate = () => {
      if (href) window.location.assign(href);
    };

    if (prefersReducedMotion()) {
      window.setTimeout(navigate, delay);
      return;
    }

    const panel = this.#panels[index]?.el;
    if (!panel) {
      window.setTimeout(navigate, delay);
      return;
    }

    const fallback = window.setTimeout(navigate, delay + 800);
    const done = (ev: TransitionEvent) => {
      if (ev.target !== panel) return;
      if (ev.propertyName !== "width" && ev.propertyName !== "height") return;
      panel.removeEventListener("transitionend", done);
      window.clearTimeout(fallback);
      window.setTimeout(navigate, delay);
    };
    panel.addEventListener("transitionend", done);
  }
}

export function registerImageRevealGalleryElement(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("tessera-image-reveal-gallery")) {
    customElements.define("tessera-image-reveal-gallery", TesseraImageRevealGallery);
  }
}
