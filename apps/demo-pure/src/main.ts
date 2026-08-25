import "@r-a-i-t-h/tessera-skin-w3/w3.css";
import "@r-a-i-t-h/tessera-skin-w3/w3-theme-teal.css";
import "./site.css";

import {
  escapeHtml,
  ComponentRegistry,
  SiteRenderer,
  registerNavComponents,
} from "@r-a-i-t-h/tessera-renderer";
import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import { bodySwitch, installChromeGlobals, renderStaleBanner } from "@r-a-i-t-h/tessera-demo-kit";
import { registerSiteComponents } from "./components";
import { registerCardElement } from "./components/rt-card";

installChromeGlobals();
registerCardElement();

const registry = new ComponentRegistry();
registerSiteComponents((name, fn) => registry.define(name, fn));
registerNavComponents((name, fn) => registry.define(name, fn));

registry.define("infoCard", (ctx, props = {}) => {
  const title = typeof props.title === "string" ? props.title : "Card";
  return `<rt-card title="${ctx.escapeHtml(title)}"><p>Child light-DOM content from the renderer.</p></rt-card>`;
});

function renderSidebar(pageId: string, doc: SiteDocument): void {
  const el = document.getElementById("sidebar");
  if (!el) return;
  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]!;
  const navHtml = registry.render(
    "navCollapse",
    {
      document: doc,
      page,
      zones: new Map(),
      registry,
      renderBlocks: () => "",
      zoneJson: () => [],
      mediaHtml: () => "",
      escapeHtml,
    },
    { scope: "sidebar" },
  );
  el.innerHTML = `${navHtml}<div class="font-switch">
    <button type="button" class="w3-button w3-tiny" data-font="0">font A</button>
    <button type="button" class="w3-button w3-tiny" data-font="1">font B</button>
    <button type="button" class="w3-button w3-tiny" data-font="2">font C</button>
    <button type="button" class="w3-button w3-tiny" data-font="3">font D</button>
  </div>`;
  el.querySelectorAll("[data-font]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bodySwitch.switch("font", Number((btn as HTMLElement).dataset.font));
    });
  });
}

const renderer = await SiteRenderer.create({
  documentUrl: "./data/site.json",
  registry,
  mount: "#app",
  skin: w3Skin,
  onStatusChange: (status) => {
    renderStaleBanner(status.usingCachedData);
  },
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
