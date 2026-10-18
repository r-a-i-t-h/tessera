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
  margin = 0,
  gap = 0,
): ImageRevealRect[] {
  if (count <= 0) return [];
  const ppr = clampPanelsPerRow(panelsPerRow);
  const rows = Math.ceil(count / ppr);
  const innerW = stageW - margin * 2 - gap * Math.max(0, ppr - 1);
  const innerH = stageH - margin * 2 - gap * Math.max(0, rows - 1);
  if (innerW <= 0 || innerH <= 0) return [];
  const colWidths = splitSpan(innerW, ppr);
  const rowHeights = splitSpan(innerH, rows);
  const rects: ImageRevealRect[] = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % ppr;
    const row = Math.floor(i / ppr);
    let left = margin;
    for (let c = 0; c < col; c += 1) left += colWidths[c]! + gap;
    let top = margin;
    for (let r = 0; r < row; r += 1) top += rowHeights[r]! + gap;
    rects.push({
      left,
      top,
      width: colWidths[col]!,
      height: rowHeights[row]!,
    });
  }
  return rects;
}

/** Title size in em (1–2, step 0.2). Uses step index to avoid float drift (1.2, 1.4, …). */
export function clampTitleSizeEm(value: number, fallback = 1): number {
  if (!Number.isFinite(value)) return fallback;
  const step = Math.max(0, Math.min(5, Math.round((value - 1) / 0.2)));
  return 1 + step * 0.2;
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
  margin = 0,
  gap = 0,
  inset = 0,
): ImageRevealRect[] {
  const cells = gridPanelRects(items.length, stageW, stageH, panelsPerRow, margin, gap);
  if (inset <= 0) return cells;
  return cells.map((cell) => ({
    left: cell.left + inset,
    top: cell.top + inset,
    width: Math.max(1, cell.width - 2 * inset),
    height: Math.max(1, cell.height - 2 * inset),
  }));
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

type PixelBox = { left: number; top: number; width: number; height: number };

const PANEL_MOVE_MS = 250;

type PanelMove = { frame: number; finish: () => void };

function sameBox(a: PixelBox, b: PixelBox): boolean {
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

function boxFromInline(el: HTMLElement): PixelBox | null {
  const left = parseFloat(el.style.left);
  const top = parseFloat(el.style.top);
  const width = parseFloat(el.style.width);
  const height = parseFloat(el.style.height);
  if (![left, top, width, height].every(Number.isFinite)) return null;
  return { left, top, width, height };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
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
  #hoverGap = 10;
  #navigateDelay = 2500;
  #titleSizeEm = 1;
  #scale = 1;
  #activeIndex = -1;
  #navigating = false;
  #resizeObserver: ResizeObserver | null = null;
  #hoverCapable = fineHover();
  #moves = new WeakMap<HTMLElement, PanelMove>();

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
      if (this.isConnected) this.#rebuild();
    },
    "hover-gap"(this: TesseraImageRevealGallery, v: string | null) {
      const n = v === null || v === "" ? 10 : Number(v);
      this.#hoverGap = Number.isFinite(n) ? Math.max(0, n) : 10;
      if (this.isConnected) this.#rebuild();
    },
    "navigate-delay"(this: TesseraImageRevealGallery, v: string | null) {
      const n = v === null || v === "" ? 2500 : Number(v);
      this.#navigateDelay = Number.isFinite(n) ? n : 2500;
    },
    "title-size"(this: TesseraImageRevealGallery, v: string | null) {
      const n = v === null || v === "" ? 1 : Number(v);
      this.#titleSizeEm = clampTitleSizeEm(n);
      this.style.setProperty("--tessera-irg-title-size", `${this.#titleSizeEm}em`);
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
    for (const panel of this.#panels) this.#stopMove(panel.el);
  }

  #readAttrs(): void {
    this.#items = parseItems(this.getAttribute("items"));
    this.#designW = numAttr(this, "width", 700);
    this.#designH = numAttr(this, "height", 300);
    this.#panelsPerRow = clampPanelsPerRow(numAttr(this, "panels-per-row", 3));
    this.#hoverExpand = numAttr(this, "hover-expand", 30);
    this.#hoverGap = Math.max(0, numAttr(this, "hover-gap", 10));
    this.#navigateDelay = numAttr(this, "navigate-delay", 2500);
    this.#titleSizeEm = clampTitleSizeEm(numAttr(this, "title-size", 1));
    this.style.setProperty("--tessera-irg-title-size", `${this.#titleSizeEm}em`);
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

    // Outer margin is one expansion so a grown panel reaches the stage edge.
    // Space between panels is one expansion plus the expanded gap, so a grown
    // panel sits that gap away from a resting neighbor.
    const expand = Math.max(0, this.#hoverExpand);
    const apart = expand + Math.max(0, this.#hoverGap);
    const rects = resolveItemRects(
      this.#items,
      this.#designW,
      this.#designH,
      this.#panelsPerRow,
      expand,
      apart,
    );

    this.stageEl.style.aspectRatio = `${this.#designW} / ${this.#designH}`;
    this.wrapEl.style.padding = "";

    for (let i = 0; i < this.#items.length; i += 1) {
      const item = this.#items[i]!;
      const orig = rects[i]!;
      const link = this.e("a", {
        className: "tessera-irg-panel",
        href: item.href,
      });
      const art = this.d({ className: "tessera-irg-art" });
      art.style.backgroundImage = `url("${item.url.replace(/"/g, "%22")}")`;
      link.append(art);
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

  /**
   * Box and crop are written together each frame. A CSS transition on
   * background-position runs after left/top, so the image slides inside the panel.
   */
  #applyRect(el: HTMLAnchorElement, rect: ImageRevealRect, animate = false): Promise<void> {
    const to = this.#pixelBox(rect);
    const from = boxFromInline(el);
    this.#stopMove(el);
    const motion =
      animate && !!from && !sameBox(from, to) && !prefersReducedMotion() && typeof requestAnimationFrame === "function";
    if (!motion) {
      this.#commitBox(el, to);
      return Promise.resolve();
    }
    return this.#moveBox(el, from, to);
  }

  #pixelBox(rect: ImageRevealRect): PixelBox {
    const s = this.#scale;
    return {
      left: Math.round(rect.left * s),
      top: Math.round(rect.top * s),
      width: Math.max(1, Math.round(rect.width * s)),
      height: Math.max(1, Math.round(rect.height * s)),
    };
  }

  #commitBox(el: HTMLElement, box: PixelBox): void {
    el.style.left = `${box.left}px`;
    el.style.top = `${box.top}px`;
    el.style.width = `${box.width}px`;
    el.style.height = `${box.height}px`;
    const art = el.querySelector<HTMLElement>(".tessera-irg-art");
    if (!art) return;
    art.style.width = `${Math.round(this.#designW * this.#scale)}px`;
    art.style.height = `${Math.round(this.#designH * this.#scale)}px`;
    art.style.left = `${-box.left}px`;
    art.style.top = `${-box.top}px`;
  }

  #moveBox(el: HTMLElement, from: PixelBox, to: PixelBox): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const move: PanelMove = { frame: 0, finish: () => resolve() };
      const step = (now: number) => {
        if (this.#moves.get(el) !== move) return;
        const t = Math.min(1, (now - start) / PANEL_MOVE_MS);
        const e = 1 - (1 - t) ** 3;
        this.#commitBox(el, {
          left: lerp(from.left, to.left, e),
          top: lerp(from.top, to.top, e),
          width: lerp(from.width, to.width, e),
          height: lerp(from.height, to.height, e),
        });
        if (t >= 1) {
          this.#commitBox(el, to);
          this.#moves.delete(el);
          resolve();
          return;
        }
        move.frame = requestAnimationFrame(step);
      };
      this.#moves.set(el, move);
      move.frame = requestAnimationFrame(step);
    });
  }

  #stopMove(el: HTMLElement): void {
    const move = this.#moves.get(el);
    if (!move) return;
    this.#moves.delete(el);
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(move.frame);
    move.finish();
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
        void this.#applyRect(panel.el, this.#expandedRect(panel.orig), true);
      } else {
        void this.#applyRect(panel.el, panel.orig, true);
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
    void this.#applyRect(panel.el, panel.orig, true);
  }

  #onActivate(e: Event, index: number): void {
    if (this.#navigating) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    this.#navigating = true;
    this.#activeIndex = index;

    let motion = Promise.resolve();
    for (let i = 0; i < this.#panels.length; i += 1) {
      const panel = this.#panels[i]!;
      panel.el.classList.remove("is-hovered");
      panel.el.onmouseenter = null;
      panel.el.onmouseleave = null;
      if (i === index) {
        panel.el.classList.add("is-revealed");
        panel.el.style.zIndex = "999";
        motion = this.#applyRect(panel.el, { left: 0, top: 0, width: this.#designW, height: this.#designH }, true);
      } else {
        panel.el.style.opacity = "0";
        panel.el.style.pointerEvents = "none";
      }
    }

    const href = this.#panels[index]?.href ?? "";
    const delay = prefersReducedMotion() ? Math.min(400, this.#navigateDelay) : this.#navigateDelay;
    const navigate = () => {
      if (this.#navigating && href) window.location.assign(href);
    };

    if (prefersReducedMotion()) {
      window.setTimeout(navigate, delay);
      return;
    }

    const fallback = window.setTimeout(navigate, delay + PANEL_MOVE_MS + 800);
    void motion.then(() => {
      if (!this.#navigating) return;
      window.clearTimeout(fallback);
      window.setTimeout(navigate, delay);
    });
  }
}

export function registerImageRevealGalleryElement(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("tessera-image-reveal-gallery")) {
    customElements.define("tessera-image-reveal-gallery", TesseraImageRevealGallery);
  }
}
