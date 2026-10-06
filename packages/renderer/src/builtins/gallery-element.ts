import { WCBase } from "@r-a-i-t-h/tessera-wc-base";

export type GalleryItem = {
  id: string;
  url: string;
  alt?: string;
  caption?: string;
};

/**
 * Light-DOM gallery: thumbnail grid (or rotating slides) + dialog with prev/next.
 * Items arrive via the `items` JSON attribute (set by the registry `gallery` component).
 */
export class TesseraGallery extends WCBase {
  useShadow = false;

  #items: GalleryItem[] = [];
  #index = 0;
  #mode: "grid" | "slides" = "grid";
  #autoplay = false;
  #timer: ReturnType<typeof setInterval> | null = null;

  gridEl = this.d({ className: "tessera-gallery-grid w3-row-padding" });
  slidesEl = this.d({ className: "tessera-gallery-slides w3-display-container" });
  dialogEl = this.e("dialog", { className: "tessera-gallery-dialog" });

  static a = {
    items(this: TesseraGallery, v: string | null) {
      this.#items = parseItems(v);
      if (this.isConnected) this.#paint();
    },
    mode(this: TesseraGallery, v: string | null) {
      this.#mode = v === "slides" ? "slides" : "grid";
      if (this.isConnected) this.#paint();
    },
    autoplay(this: TesseraGallery, v: string | null) {
      this.#autoplay = v !== null && v !== "false";
      if (this.isConnected) this.#syncAutoplay();
    },
  };

  b() {
    this.style.display = "block";
    this.classList.add("tessera-gallery");

    const img = this.e("img", { className: "tessera-gallery-dialog-img" });
    img.alt = "";
    const caption = this.d({ className: "tessera-gallery-dialog-caption w3-padding" });
    const prev = this.e("button", {
      type: "button",
      className: "tessera-gallery-btn tessera-gallery-prev",
    });
    prev.textContent = "‹";
    prev.setAttribute("aria-label", "Previous");
    const next = this.e("button", {
      type: "button",
      className: "tessera-gallery-btn tessera-gallery-next",
    });
    next.textContent = "›";
    next.setAttribute("aria-label", "Next");
    const close = this.e("button", {
      type: "button",
      className: "tessera-gallery-btn tessera-gallery-close",
    });
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");

    const nav = this.d({ className: "tessera-gallery-dialog-nav" });
    nav.append(prev, next);

    const controls = this.d({ className: "tessera-gallery-dialog-controls w3-padding" });
    controls.append(nav, close);

    this.dialogEl.append(img, caption, controls);

    prev.addEventListener("click", (e) => {
      e.preventDefault();
      this.#step(-1);
    });
    next.addEventListener("click", (e) => {
      e.preventDefault();
      this.#step(1);
    });
    close.addEventListener("click", (e) => {
      e.preventDefault();
      this.#closeDialog();
    });
    this.dialogEl.addEventListener("cancel", () => this.#stopAutoplay());
    this.dialogEl.addEventListener("close", () => this.#stopAutoplay());

    this.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.dialogEl.open) return;
      if (e.key === "ArrowLeft") this.#step(-1);
      if (e.key === "ArrowRight") this.#step(1);
    });

    return [this.gridEl, this.slidesEl, this.dialogEl];
  }

  c() {
    this.#items = parseItems(this.getAttribute("items"));
    this.#mode = this.getAttribute("mode") === "slides" ? "slides" : "grid";
    this.#autoplay =
      this.hasAttribute("autoplay") && this.getAttribute("autoplay") !== "false";
    this.#paint();
    this.#syncAutoplay();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopAutoplay();
  }

  #paint(): void {
    this.gridEl.replaceChildren();
    this.slidesEl.replaceChildren();
    this.gridEl.hidden = this.#mode !== "grid";
    this.slidesEl.hidden = this.#mode !== "slides";

    if (this.#mode === "grid") {
      for (let i = 0; i < this.#items.length; i++) {
        const item = this.#items[i]!;
        const col = this.d({ className: "w3-col s6 m4 l3 w3-margin-bottom" });
        const btn = this.e("button", {
          type: "button",
          className: "tessera-gallery-thumb w3-btn w3-padding-small",
        });
        btn.style.width = "100%";
        btn.style.padding = "0";
        btn.style.border = "none";
        btn.style.background = "transparent";
        btn.setAttribute("aria-label", item.caption || item.alt || item.id);
        const img = this.e("img", {
          className: "w3-image w3-round",
          src: item.url,
          alt: item.alt ?? "",
        });
        img.style.width = "100%";
        img.style.aspectRatio = "4 / 3";
        img.style.objectFit = "cover";
        btn.append(img);
        if (item.caption) {
          const cap = this.d({ className: "w3-small w3-center w3-padding-small" });
          cap.textContent = item.caption;
          btn.append(cap);
        }
        const idx = i;
        btn.addEventListener("click", () => this.#openDialog(idx));
        col.append(btn);
        this.gridEl.append(col);
      }
      return;
    }

    // slides mode — one image at a time with prev/next on the strip
    const stage = this.d({ className: "w3-display-container" });
    const img = this.e("img", { className: "w3-image tessera-gallery-slide-img" });
    img.style.width = "100%";
    img.style.maxHeight = "420px";
    img.style.objectFit = "contain";
    const prev = this.e("button", {
      type: "button",
      className: "tessera-gallery-btn tessera-gallery-prev w3-display-left",
    });
    prev.textContent = "‹";
    prev.setAttribute("aria-label", "Previous");
    const next = this.e("button", {
      type: "button",
      className: "tessera-gallery-btn tessera-gallery-next w3-display-right",
    });
    next.textContent = "›";
    next.setAttribute("aria-label", "Next");
    const open = this.e("button", {
      type: "button",
      className: "w3-button w3-theme w3-margin-top",
    });
    open.textContent = "Open large view";
    prev.addEventListener("click", () => this.#step(-1));
    next.addEventListener("click", () => this.#step(1));
    open.addEventListener("click", () => this.#openDialog(this.#index));
    img.addEventListener("click", () => this.#openDialog(this.#index));
    stage.append(img, prev, next);
    this.slidesEl.append(stage, open);
    this.#paintSlide();
  }

  #paintSlide(): void {
    const img = this.slidesEl.querySelector(".tessera-gallery-slide-img") as HTMLImageElement | null;
    const item = this.#items[this.#index];
    if (!img || !item) return;
    img.src = item.url;
    img.alt = item.alt ?? "";
  }

  #paintDialog(): void {
    const item = this.#items[this.#index];
    if (!item) return;
    const img = this.dialogEl.querySelector(".tessera-gallery-dialog-img") as HTMLImageElement | null;
    const cap = this.dialogEl.querySelector(".tessera-gallery-dialog-caption");
    if (img) {
      img.src = item.url;
      img.alt = item.alt ?? "";
    }
    if (cap) {
      cap.textContent = item.caption || item.alt || "";
    }
  }

  #openDialog(index: number): void {
    if (!this.#items.length) return;
    this.#index = ((index % this.#items.length) + this.#items.length) % this.#items.length;
    this.#paintDialog();
    if (this.#mode === "slides") this.#paintSlide();
    if (!this.dialogEl.open) this.dialogEl.showModal();
    this.#syncAutoplay();
  }

  #closeDialog(): void {
    if (this.dialogEl.open) this.dialogEl.close();
    this.#stopAutoplay();
  }

  #step(delta: number): void {
    if (!this.#items.length) return;
    this.#index = (this.#index + delta + this.#items.length) % this.#items.length;
    if (this.#mode === "slides") this.#paintSlide();
    if (this.dialogEl.open) this.#paintDialog();
  }

  #syncAutoplay(): void {
    this.#stopAutoplay();
    if (!this.#autoplay) return;
    if (this.#mode !== "slides" && !this.dialogEl.open) return;
    this.#timer = setInterval(() => this.#step(1), 3000);
  }

  #stopAutoplay(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
}

function parseItems(raw: string | null): GalleryItem[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const items: GalleryItem[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (typeof o.url !== "string" || typeof o.id !== "string") continue;
      items.push({
        id: o.id,
        url: o.url,
        alt: typeof o.alt === "string" ? o.alt : undefined,
        caption: typeof o.caption === "string" ? o.caption : undefined,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export function registerGalleryElement(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get("tessera-gallery")) {
    customElements.define("tessera-gallery", TesseraGallery);
  }
}
