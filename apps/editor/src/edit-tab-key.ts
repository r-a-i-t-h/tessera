import { isTypingTarget } from "./typing-target.js";

export type EditTabDirection = "next" | "prev";

/** `[` / `]` — previous / next editing tab (not while typing in a field). */
export function isEditTabShortcut(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
  if (event.defaultPrevented) return false;
  if (isTypingTarget(event.target)) return false;
  if (event.code !== "BracketRight" && event.code !== "BracketLeft") return false;
  return true;
}

export function editTabDirectionFromEvent(event: KeyboardEvent): EditTabDirection | undefined {
  if (!isEditTabShortcut(event)) return undefined;
  if (event.code === "BracketRight") return "next";
  if (event.code === "BracketLeft") return "prev";
  return undefined;
}

function visibleTabs(root: ParentNode): HTMLButtonElement[] {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[aria-label="Editing mode"] [data-mode]')];
  return tabs.filter((tab) => {
    if (tab.disabled || tab.hidden) return false;
    if (
      tab.isConnected &&
      "checkVisibility" in tab &&
      typeof tab.checkVisibility === "function" &&
      !tab.checkVisibility()
    ) {
      return false;
    }
    return true;
  });
}

function activeTabIndex(tabs: HTMLButtonElement[]): number {
  return tabs.findIndex(
    (tab) => tab.classList.contains("is-active") || tab.getAttribute("aria-selected") === "true",
  );
}

/** Activates the next or previous tab in the Editing mode tablist. Returns true when a tab was activated. */
export function triggerEditTabAdjacent(root: ParentNode, direction: EditTabDirection): boolean {
  const tabs = visibleTabs(root);
  if (!tabs.length) return false;
  const current = activeTabIndex(tabs);
  if (current < 0) {
    tabs[0]?.click();
    return true;
  }
  const next = direction === "next" ? current + 1 : current - 1;
  if (next < 0 || next >= tabs.length) return false;
  tabs[next]!.click();
  return true;
}
