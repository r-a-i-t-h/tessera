import type { SiteDocument } from "@r-a-i-t-h/tessera-model";
import { escapeHtml } from "@r-a-i-t-h/tessera-renderer";

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
    }
    return false;
  },
};

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

/** Expose helpers used by inline onclick handlers in demo HTML. */
export function installChromeGlobals(): void {
  (window as unknown as { body_switch: typeof bodySwitch }).body_switch = bodySwitch;
  (window as unknown as { flip_nav_side: typeof flipNavSide }).flip_nav_side = flipNavSide;
  wireSidebarToggle();
}

export function renderNavSidebar(pageId: string, doc: SiteDocument, target: HTMLElement): void {
  const parts: string[] = [];
  for (const entry of doc.nav) {
    if (entry.heading) {
      const fa = entry.fa ? `<i class="fa fa-${escapeHtml(entry.fa)}"></i> ` : "";
      parts.push(`<h4 class="w3-bar-item w3-text-theme">${fa}${escapeHtml(entry.heading)}</h4>`);
      continue;
    }
    if (!entry.sidebar) continue;
    const id = entry.id ?? "";
    const href = id ? `#${id}` : "#";
    const active = id === pageId || (!id && pageId === doc.site.homePageId) ? " w3-theme-l3" : "";
    const fa = entry.fa ? `<i class="fa fa-${escapeHtml(entry.fa)}"></i> ` : "";
    parts.push(
      `<a class="w3-bar-item w3-button${active}" href="${href}">${fa}${escapeHtml(entry.title ?? id)}</a>`,
    );
  }
  target.innerHTML = parts.join("");
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
