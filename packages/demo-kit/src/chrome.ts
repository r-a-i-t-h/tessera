
import { resolveSiteStyle, siteStyleCss, type SiteStyle } from "@r-a-i-t-h/tessera-model";
import { escapeHtml } from "@r-a-i-t-h/tessera-renderer";

const FONT_STORAGE_KEY = "tessera-font";

export const bodySwitch = {
  sets: {
    font: ["fontA", "fontB", "fontC", "fontD"],
    theme: ["themeA", "themeB", "themeC", "themeD"],
  } as Record<string, string[]>,
  switch(set: string, idx: number): boolean {
    const list = this.sets[set];
    if (idx >= 0 && list && idx < list.length) {
      document.body.classList.remove(...list);
      document.body.classList.add(list[idx]!);
      if (set === "font") rememberFont(list[idx]!);
    }
    return false;
  },
};

function rememberFont(className: string): void {
  try {
    localStorage.setItem(FONT_STORAGE_KEY, className);
  } catch {
    /* private mode or a page without storage */
  }
}

/** Re-apply the visitor's font after a render replaces the default font class. */
export function restoreFontChoice(): void {
  if (typeof document === "undefined" || !document.body) return;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(FONT_STORAGE_KEY);
  } catch {
    return;
  }
  const list = bodySwitch.sets.font;
  if (!saved || !list.includes(saved)) return;
  document.body.classList.remove(...list);
  document.body.classList.add(saved);
}

export function wireSidebarToggle(): void {
  const sidebar = document.getElementById("mySidebar");
  const overlay = document.getElementById("myOverlay");
  if (!sidebar) return;

  (window as unknown as { w3_open: () => void; w3_close: () => void }).w3_open = () => {
    const open = sidebar.style.display === "block";
    sidebar.style.display = open ? "none" : "block";
    if (overlay) overlay.style.display = open ? "none" : "block";
  };
  (window as unknown as { w3_close: () => void }).w3_close = () => {
    sidebar.style.display = "none";
    if (overlay) overlay.style.display = "none";
  };
}

export function flipNavSide(): boolean {
  const cl = document.body.classList;
  const next = cl.contains("leftnav") ? "rightnav" : "leftnav";
  cl.remove("leftnav", "rightnav");
  cl.add(next);
  return false;
}

/** Write chrome tokens onto the document and re-bind the sidebar toggle. */
export function applySiteChrome(style: SiteStyle | undefined): void {
  if (typeof document === "undefined" || !document.body || !document.head) return;
  if (style) {
    const resolved = resolveSiteStyle(style);
    let el = document.getElementById("tessera-style");
    if (!el) {
      el = document.createElement("style");
      el.id = "tessera-style";
      document.head.append(el);
    }
    el.textContent = siteStyleCss(style);
    if (resolved.fontsHref) {
      const existing = document.getElementById("tessera-fonts");
      const link = existing instanceof HTMLLinkElement ? existing : document.createElement("link");
      if (!(existing instanceof HTMLLinkElement)) {
        link.id = "tessera-fonts";
        link.rel = "stylesheet";
        document.head.append(link);
      }
      link.href = resolved.fontsHref;
    }
    document.body.classList.remove("leftnav", "rightnav", ...bodySwitch.sets.font);
    document.body.classList.add(resolved.navSide === "left" ? "leftnav" : "rightnav", "fontA");
  }
  restoreFontChoice();
  wireSidebarToggle();
}

export function installChromeGlobals(): void {
  (window as unknown as { body_switch: typeof bodySwitch }).body_switch = bodySwitch;
  (window as unknown as { flip_nav_side: typeof flipNavSide }).flip_nav_side = flipNavSide;
  wireSidebarToggle();
  restoreFontChoice();
}

/** Show or clear a stale/offline banner (creates `#tessera-stale-banner` if needed). */
export function renderStaleBanner(
  usingCachedData: boolean,
  opts: { parent?: HTMLElement | null; message?: string } = {},
): void {
  const parent = opts.parent ?? document.body;
  if (!parent) return;
  let el = document.getElementById("tessera-stale-banner");
  if (!usingCachedData) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "tessera-stale-banner";
    el.setAttribute("role", "status");
    parent.prepend(el);
  }
  el.className = "w3-panel w3-pale-yellow w3-border w3-margin";
  el.textContent =
    opts.message ??
    "Showing cached site data — could not refresh from the network (you may be offline).";
}

export function insertHeadingsMenu(
  root: ParentNode = document,
  targetId = "headings_menu",
  headingLevel = "h2",
): void {
  const menu = document.getElementById(targetId);
  if (!menu) return;
  const headings = [...root.querySelectorAll(headingLevel)] as HTMLElement[];
  if (!headings.length) {
    menu.innerHTML = "";
    return;
  }
  menu.innerHTML = headings
    .map((h, i) => {
      const id = h.id || `heading-${i}`;
      h.id = id;
      return `<a class="w3-bar-item w3-button w3-small" href="#${id}">${escapeHtml(h.textContent || "")}</a>`;
    })
    .join("");
}
