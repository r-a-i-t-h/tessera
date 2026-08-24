import "@r-a-i-t-h/tessera-skin-w3/w3.css";
import "@r-a-i-t-h/tessera-skin-w3/w3-theme-teal.css";
import "./site.css";

import { escapeHtml, ComponentRegistry, SiteRenderer } from "@r-a-i-t-h/tessera-renderer";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import { registerSiteComponents } from "./components";
import { registerCardElement } from "./components/rt-card";

registerCardElement();

const registry = new ComponentRegistry();
registerSiteComponents((name, fn) => registry.define(name, fn));

registry.define("infoCard", (ctx, props = {}) => {
  const title = typeof props.title === "string" ? props.title : "Card";
  return `<rt-card title="${ctx.escapeHtml(title)}"><p>Child light-DOM content from the renderer.</p></rt-card>`;
});

function renderSidebar(pageId: string, doc: SiteDocument): void {
  const el = document.getElementById("sidebar");
  if (!el) return;
  const parts: string[] = [];
  for (const entry of doc.nav) {
    if (entry.heading) {
      parts.push(`<h4 class="w3-text-theme">${escapeHtml(entry.heading)}</h4>`);
      continue;
    }
    if (!entry.sidebar) continue;
    const id = entry.id ?? "";
    const href = id ? `#${id}` : "#";
    const active = id === pageId ? " is-active" : "";
    parts.push(`<a class="${active}" href="${href}">${escapeHtml(entry.title ?? id)}</a>`);
  }
  el.innerHTML = parts.join("");
}

const renderer = await SiteRenderer.create({
  documentUrl: "./data/site.json",
  registry,
  mount: "#app",
  skin: w3Skin,
  onAfterRender: (pageId, doc) => {
    renderSidebar(pageId, doc);
    const clock = document.getElementById("clock");
    if (clock) {
      const page = doc.pages.find((p) => p.id === pageId)!;
      clock.innerHTML = registry.render("now", {
        document: doc,
        page,
        zones: new Map(),
        registry,
        renderBlocks: () => "",
        zoneJson: () => [],
        mediaHtml: () => "",
        escapeHtml,
      });
    }
  },
});

renderer.start();
