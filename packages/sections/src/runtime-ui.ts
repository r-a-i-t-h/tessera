import { BLOCK_CLASS, cardClass, imgboxClass, toneClass, type BlockWidthId, type ToneId } from "./sections.js";

export type { BlockWidthId, ToneId };

export type DomCard = { root: HTMLDivElement; body: HTMLDivElement };
export type DomPanel = { root: HTMLDivElement; body: HTMLDivElement };

function applyWidth(el: HTMLElement, width: BlockWidthId): void {
  if (width && width !== "full") el.dataset.width = width;
}

export function createHeadingDom(level: 2 | 3 | 4, text: string): HTMLHeadingElement {
  const el = document.createElement(`h${level}`);
  el.className = BLOCK_CLASS;
  el.textContent = text;
  return el;
}

export function createTextDom(opts: { heading?: string; level?: 2 | 3 | 4; text?: string }): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = `${BLOCK_CLASS} tessera-text`;
  const heading = opts.heading?.trim() ?? "";
  if (heading) {
    const level = opts.level ?? 2;
    wrap.append(createHeadingDom(level, heading));
  }
  if (opts.text) {
    const p = document.createElement("p");
    p.textContent = opts.text;
    wrap.append(p);
  }
  return wrap;
}

export function createCardDom(opts: {
  title?: string;
  width?: BlockWidthId;
  plain?: boolean;
}): DomCard {
  const root = document.createElement("div");
  root.className = cardClass(opts.plain ?? false);
  applyWidth(root, opts.width ?? "full");
  const title = opts.title?.trim() ?? "";
  if (title) {
    const h3 = document.createElement("h3");
    h3.className = "w3-text-theme";
    h3.textContent = title;
    root.append(h3);
  }
  const body = document.createElement("div");
  body.className = "rt-card-body";
  root.append(body);
  return { root, body };
}

export function createImgBoxDom(opts: {
  src: string;
  alt?: string;
  caption?: string;
  width?: BlockWidthId;
  plain?: boolean;
}): HTMLDivElement {
  const root = document.createElement("div");
  root.className = imgboxClass(opts.plain ?? false);
  applyWidth(root, opts.width ?? "full");
  const img = document.createElement("img");
  img.src = opts.src;
  img.className = "w3-image";
  img.alt = opts.alt ?? "";
  root.append(img);
  const caption = opts.caption?.trim() ?? "";
  if (caption) {
    const cap = document.createElement("div");
    cap.className =
      "w3-display-middle w3-container w3-padding-16 w3-display-hover w3-normal w3-round-large w3-opacity-min w3-white";
    cap.textContent = caption;
    root.append(cap);
  }
  return root;
}

export function createPanelDom(opts: { tone?: ToneId }): DomPanel {
  const root = document.createElement("div");
  root.className = [BLOCK_CLASS, "w3-panel", "w3-padding", toneClass(opts.tone ?? "sand")].filter(Boolean).join(" ");
  const body = document.createElement("div");
  body.className = "rt-panel-body";
  root.append(body);
  return { root, body };
}
