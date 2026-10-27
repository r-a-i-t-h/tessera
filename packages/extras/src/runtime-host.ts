import type { DatasetViewPayload } from "./dataset-payload.js";
import {
  createCardDom,
  createHeadingDom,
  createImgBoxDom,
  createPanelDom,
  createTextDom,
  type BlockWidthId,
  type ToneId,
} from "@r-a-i-t-h/tessera-sections/runtime-ui";

export type RuntimeModuleMountContext = {
  props: Record<string, unknown>;
  dataset?: DatasetViewPayload;
  host: RuntimeModuleHost;
};

export type RuntimeModuleMount = (
  root: HTMLElement,
  ctx: RuntimeModuleMountContext,
) => void | Promise<void>;

export type RuntimeModuleHost = {
  root: HTMLElement;
  el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: { className?: string; text?: string; [key: string]: string | undefined },
  ): HTMLElementTagNameMap[K];
  text(value: string): Text;
  escapeHtml(value: string): string;
  assetUrl(id: string, ext: string): string;
  portal(where?: "after" | "before" | ParentNode): HTMLElement;
  ui: {
    card(opts: {
      title?: string;
      width?: BlockWidthId;
      plain?: boolean;
      frameColor?: string;
    }): ReturnType<typeof createCardDom>;
    imgBox(opts: {
      src: string;
      alt?: string;
      caption?: string;
      width?: BlockWidthId;
      plain?: boolean;
      frameColor?: string;
    }): HTMLDivElement;
    panel(opts: { tone?: ToneId }): ReturnType<typeof createPanelDom>;
    text(opts: { heading?: string; level?: 2 | 3 | 4; text?: string }): HTMLDivElement;
    heading(level: 2 | 3 | 4, text: string): HTMLHeadingElement;
  };
};

export function createRuntimeModuleHost(mount: HTMLElement): RuntimeModuleHost {
  const portalParent = mount.parentElement ?? mount;
  return {
    root: mount,
    el(tag, attrs = {}) {
      const el = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined) continue;
        if (key === "className") el.className = value;
        else if (key === "text") el.textContent = value;
        else el.setAttribute(key, value);
      }
      return el;
    },
    text(value: string) {
      return document.createTextNode(value);
    },
    escapeHtml(value: string) {
      const span = document.createElement("span");
      span.textContent = value;
      return span.innerHTML;
    },
    assetUrl(id: string, ext: string) {
      const normalized = ext.replace(/^\./, "").toLowerCase();
      return `./media/${id}.${normalized}`;
    },
    portal(where = "after") {
      if (where === "before") {
        const marker = document.createElement("div");
        marker.className = "tessera-runtime-module-portal";
        portalParent.insertBefore(marker, mount);
        return marker;
      }
      if (where instanceof HTMLElement || (typeof Node !== "undefined" && where instanceof Node)) {
        const marker = document.createElement("div");
        marker.className = "tessera-runtime-module-portal";
        where.append(marker);
        return marker;
      }
      const marker = document.createElement("div");
      marker.className = "tessera-runtime-module-portal";
      if (mount.nextSibling) portalParent.insertBefore(marker, mount.nextSibling);
      else portalParent.append(marker);
      return marker;
    },
    ui: {
      card: createCardDom,
      imgBox: createImgBoxDom,
      panel: createPanelDom,
      text: createTextDom,
      heading: createHeadingDom,
    },
  };
}
