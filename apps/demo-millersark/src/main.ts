import "@r-a-i-t-h/tessera-skin-w3/w3.css";
import "@r-a-i-t-h/tessera-skin-w3/w3-theme-indigo.css";
import "@r-a-i-t-h/tessera-skin-w3/common.css";
import "./site.css";

import { ComponentRegistry, SiteRenderer } from "@r-a-i-t-h/tessera-renderer";
import { w3Skin } from "@r-a-i-t-h/tessera-skin-w3";
import {
  installChromeGlobals,
  insertHeadingsMenu,
  renderNavSidebar,
} from "@r-a-i-t-h/tessera-demo-kit";
import { openDaysTable } from "./components/open-days";

installChromeGlobals();

const registry = new ComponentRegistry();
registry.define("openDaysTable", openDaysTable);

const renderer = await SiteRenderer.create({
  documentUrl: "./data/site.json",
  registry,
  mount: "#app",
  skin: w3Skin,
  onAfterRender: (pageId, doc) => {
    const nav = document.getElementById("nav_data");
    if (nav) renderNavSidebar(pageId, doc, nav);
    insertHeadingsMenu(document.getElementById("app") ?? document);
  },
});

renderer.start();
