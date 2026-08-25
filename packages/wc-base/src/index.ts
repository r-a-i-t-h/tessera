// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AttrHandler = (this: any, value: string | null) => void;

/**
 * Minimal custom-element base (port of the original WCBase experiment).
 * Short hooks keep cookie-cut components tiny:
 * - `a` — attribute handlers
 * - `b` — build light/shadow tree (return nested element arrays; `[]` = slot for light children)
 * - `c` — connectedCallback extra work
 */
export class WCBase extends HTMLElement {
  static a: Record<string, AttrHandler> = {};

  static get observedAttributes(): string[] {
    return Object.keys(this.a);
  }

  childrenRehome: Element | null = null;
  /** Subclasses may set `useShadow = false` for W3.CSS-friendly light DOM. */
  useShadow = true;
  #built = false;
  /** Nodes created by `b()` — must not be moved into the light-child slot. */
  #structure = new Set<Node>();
  #lightObserver: MutationObserver | null = null;

  /** Override: build UI. Nested arrays = children; empty array `[]` marks where light-DOM children move. */
  b?(): Array<Node | Node[]>;

  /** Override: extra connected work. */
  c?(): void;

  d(props?: Partial<HTMLDivElement>): HTMLDivElement {
    return this.e("div", props);
  }

  e<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props?: Partial<HTMLElementTagNameMap[K]>,
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (props) Object.assign(el, props);
    return el;
  }

  connectedCallback(): void {
    if (this.#built) return;
    this.#built = true;

    // Attach shadow here so subclass field initializers (useShadow) have run.
    if (this.useShadow && !this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    const root: ParentNode = this.useShadow ? this.shadowRoot! : this;

    if (this.useShadow) {
      const slot = document.createElement("slot");
      root.appendChild(slot);
      this.#structure.add(slot);
      slot.addEventListener("slotchange", () => {
        if (!this.childrenRehome) return;
        slot.assignedNodes().forEach((n) => this.childrenRehome!.appendChild(n));
      });
    }

    if (this.b) {
      this.processElements(root, this.b());
    }

    // Autonomous custom elements default to display:inline. Layout components
    // almost always want block; subclasses can override in `b()` / CSS.
    if (!this.useShadow && getComputedStyle(this).display === "inline") {
      this.style.display = "block";
    }

    if (!this.useShadow && this.childrenRehome) {
      this.#rehomeLightChildren();
      // innerHTML / parser may attach light children after connectedCallback.
      this.#lightObserver = new MutationObserver(() => this.#rehomeLightChildren());
      this.#lightObserver.observe(this, { childList: true });
    }

    this.c?.();
  }

  disconnectedCallback(): void {
    this.#lightObserver?.disconnect();
    this.#lightObserver = null;
  }

  #rehomeLightChildren(): void {
    const rehome = this.childrenRehome;
    if (!rehome) return;
    for (const node of [...this.childNodes]) {
      if (node === rehome) continue;
      if (this.#structure.has(node)) continue;
      rehome.appendChild(node);
    }
  }

  attributeChangedCallback(attr: string, _old: string | null, value: string | null): void {
    const handler = (this.constructor as typeof WCBase).a[attr];
    handler?.call(this, value);
  }

  processElements(parent: ParentNode, children: Array<Node | Node[]>): void {
    let newParent: Element | null = null;
    for (const element of children) {
      if (Array.isArray(element)) {
        if (!newParent) throw new Error("Missing parent node when adding children");
        if (element.length === 0) {
          this.childrenRehome = newParent;
        } else {
          this.processElements(newParent, element);
        }
      } else {
        this.#structure.add(element);
        newParent = parent.appendChild(element) as Element;
      }
    }
  }
}
