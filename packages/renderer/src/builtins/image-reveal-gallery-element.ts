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
  title?: string;
};

type PanelState = {
  el: HTMLAnchorElement;
  orig: ImageRevealRect;
  href: string;
};

/** Split integer span into `parts` lengths that sum to `total`. */
export function splitSpan(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function clampPanelsPerRow(value: number, fallback = 3): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(2, Math.min(6, Math.round(value)));
}

/** Grid slots for `count` panels; `panelsPerRow` sets columns per row (2–6). */
export function gridPanelRects(
  count: number,
  stageW: number,
  stageH: number,
  panelsPerRow: number,
): ImageRevealRect[] {
  if (count <= 0) return [];
  const ppr = clampPanelsPerRow(panelsPerRow);
  const rows = Math.ceil(count / ppr);
  const colWidths = splitSpan(stageW, ppr);
  const rowHeights = splitSpan(stageH, rows);
  const rects: ImageRevealRect[] = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % ppr;
    const row = Math.floor(i / ppr);
    let left = 0;
    for (let c = 0; c < col; c += 1) left += colWidths[c]!;
    let top = 0;
    for (let r = 0; r < row; r += 1) top += rowHeights[r]!;
    rects.push({
      left,
      top,
      width: colWidths[col]!,
      height: rowHeights[row]!,
    });
  }
  return rects;
}

/** @deprecated Use {@link gridPanelRects}. */
export function autopositionRects(
  count: number,
  stageW: number,
  stageH: number,
  _tileW: number,
  _tileH: number,
): ImageRevealRect[] {
  return gridPanelRects(count, stageW, stageH, count);
}

export function resolveItemRects(
  items: ImageRevealItem[],
  stageW: number,
  stageH: number,
  panelsPerRow: number,
): ImageRevealRect[] {
  return gridPanelRects(items.length, stageW, stageH, panelsPerRow);
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
      if (typeof o.url !== "string" || typeof o.href !== "string") continue;
      const id = typeof o.id === "string" ? o.id : `panel-${items.length}`;
      const title =
        typeof o.title === "string"
          ? o.title
          : typeof o.alt === "string"
            ? o.alt
            : undefined;
      items.push({ id, url: o.url, href: o.href, title });
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

function titleLineCount(title: string): number {
  if (!title.trim()) return 0;
  return title.split("\n").length;
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
  #panelsPerRow = 3;
  #hoverExpand = 30;
  #navigateDelay = 2500;
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
    "panels-per-row"(this: TesseraImageRevealGallery, v: string | null) {
      this.#panelsPerRow = clampPanelsPerRow(v === null || v === "" ? 3 : Number(v));
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
  };

  b() {
    this.style.display = "block";
    this.classList.add("tessera-irg", "tessera-block", "tessera-irg--scale");
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
    this.#panelsPerRow = clampPanelsPerRow(numAttr(this, "panels-per-row", 3));
    this.#hoverExpand = numAttr(this, "hover-expand", 30);
    this.#navigateDelay = numAttr(this, "navigate-delay", 2500);
    this.wrapEl.style.maxWidth = `${this.#designW}px`;
  }

  #rebuild(): void {
    this.#navigating = false;
    this.#activeIndex = -1;
    this.stageEl.replaceChildren();
    this.#panels = [];

    if (!this.#items.length) {
      const empty = this.d({ className: "w3-text-grey w3-padding" });
      empty.textContent = "No reveal banner panels.";
      this.stageEl.append(empty);
      return;
    }

    const rects = resolveItemRects(this.#items, this.#designW, this.#designH, this.#panelsPerRow);

    this.stageEl.style.aspectRatio = `${this.#designW} / ${this.#designH}`;

    for (let i = 0; i < this.#items.length; i += 1) {
      const item = this.#items[i]!;
      const orig = rects[i]!;
      const link = this.e("a", {
        className: "tessera-irg-panel",
        href: item.href,
      });
      link.style.backgroundImage = `url("${item.url.replace(/"/g, "%22")}")`;
      const label = item.title?.trim();
      if (label) link.setAttribute("aria-label", label.replace(/\n/g, " "));
      link.tabIndex = 0;

      if (label) {
        const titleEl = this.d({ className: "tessera-irg-panel-title" });
        titleEl.textContent = label;
        const lines = titleLineCount(label);
        if (lines > 1) titleEl.dataset.lines = String(lines);
        link.append(titleEl);
      }

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
    el.style.backgroundSize = `${this.#designW * s}px ${this.#designH * s}px`;
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
    if (!this.#hoverCapable || this.#navigating) return;
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
    if (!this.#hoverCapable || this.#navigating) return;
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
        this.#applyRect(panel.el, { left: 0, top: 0, width: this.#designW, height: this.#designH });
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
