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

    // Stash light-DOM children before we build around them.
    const pendingLight = this.useShadow ? [] : Array.from(this.childNodes);

    // Attach shadow here so subclass field initializers (useShadow) have run.
    if (this.useShadow && !this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    const root: ParentNode = this.useShadow ? this.shadowRoot! : this;

    if (this.useShadow) {
      const slot = document.createElement("slot");
      root.appendChild(slot);
      slot.addEventListener("slotchange", () => {
        if (!this.childrenRehome) return;
        slot.assignedNodes().forEach((n) => this.childrenRehome!.appendChild(n));
      });
    }

    if (this.b) {
      this.processElements(root, this.b());
    }

    if (this.childrenRehome && pendingLight.length > 0) {
      pendingLight.forEach((n) => this.childrenRehome!.appendChild(n));
    }

    this.c?.();
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
        newParent = parent.appendChild(element) as Element;
      }
    }
  }
}
