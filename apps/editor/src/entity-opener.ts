import { escapeHtml } from "./dom.js";
import { pickerItemFromOpener, wirePickerList } from "./entity-picker.js";

export type EntityOpenerItem = {
  id: string;
  label: string;
  hash: string;
  filterText: string;
};

let documentClickBound = false;

function ensureDocumentClickClose(): void {
  if (documentClickBound) return;
  documentClickBound = true;
  document.addEventListener("click", (event) => {
    for (const host of document.querySelectorAll<HTMLElement>("[data-entity-opener]")) {
      const panel = host.querySelector<HTMLElement>(".editor-entity-opener-panel");
      if (!panel || panel.hidden) continue;
      if (host.contains(event.target as Node)) continue;
      closeEntityOpenerHost(host);
    }
  });
}

function closeEntityOpenerHost(host: HTMLElement): void {
  const panel = host.querySelector<HTMLElement>(".editor-entity-opener-panel");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  host.classList.remove("editor-entity-opener--open");
  host.querySelector<HTMLButtonElement>("[data-entity-opener-toggle]")?.setAttribute("aria-expanded", "false");
  const input = host.querySelector<HTMLInputElement>(".editor-entity-opener-search");
  input?.setAttribute("aria-expanded", "false");
  if (input) input.value = "";
  host.querySelectorAll<HTMLElement>('[role="option"]').forEach((opt) => opt.setAttribute("aria-selected", "false"));
  input?.removeAttribute("aria-activedescendant");
}

function jsonDataScript(items: EntityOpenerItem[]): string {
  const json = JSON.stringify(items).replace(/</g, "\\u003c");
  return `<script type="application/json" data-entity-opener-data>${json}</script>`;
}

/** Toolbar title or searchable entity opener when at least one other entity exists in scope. */
export function entityOpenerHtml(currentLabel: string, _currentId: string, items: EntityOpenerItem[]): string {
  if (items.length < 1) {
    return `<h1 class="w3-large">${escapeHtml(currentLabel)}</h1>`;
  }
  return `<div class="editor-entity-opener" data-entity-opener data-entity-open>
    <span class="editor-entity-opener-current w3-large">${escapeHtml(currentLabel)}</span>
    <button type="button" class="editor-entity-opener-toggle" data-entity-opener-toggle aria-label="Open another" aria-expanded="false" aria-haspopup="listbox" title="Open another (⌘O / Ctrl+O; use ⌘⇧O in Safari)">▾</button>
    <div class="editor-entity-opener-panel" hidden>
      <input type="search" class="editor-entity-opener-search w3-input w3-border" placeholder="Filter…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" />
      <ul class="editor-entity-opener-list w3-ul w3-card w3-white" role="listbox"></ul>
    </div>
    ${jsonDataScript(items)}
  </div>`;
}

function parseItems(host: HTMLElement): EntityOpenerItem[] {
  const raw = host.querySelector("[data-entity-opener-data]")?.textContent;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntityOpenerItem);
  } catch {
    return [];
  }
}

function isEntityOpenerItem(value: unknown): value is EntityOpenerItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    typeof row.hash === "string" &&
    typeof row.filterText === "string"
  );
}

function isVisibleOpener(host: HTMLElement): boolean {
  if (host.hidden) return false;
  if (
    host.isConnected &&
    "checkVisibility" in host &&
    typeof host.checkVisibility === "function" &&
    !host.checkVisibility()
  ) {
    return false;
  }
  return true;
}

function wireHost(host: HTMLElement): void {
  ensureDocumentClickClose();
  if (host.dataset.entityOpenerBound === "1") return;
  host.dataset.entityOpenerBound = "1";

  const toggle = host.querySelector<HTMLButtonElement>("[data-entity-opener-toggle]");
  const panel = host.querySelector<HTMLElement>(".editor-entity-opener-panel");
  const input = host.querySelector<HTMLInputElement>(".editor-entity-opener-search");
  const list = host.querySelector<HTMLElement>(".editor-entity-opener-list");
  if (!toggle || !panel || !input || !list) return;

  const openerItems = parseItems(host);
  const mountId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `entity-opener-${Math.random().toString(36).slice(2)}`;
  const listId = `editor-entity-opener-list-${mountId}`;
  list.id = listId;

  const getItems = () => openerItems.map(pickerItemFromOpener);

  const navigate = (hash: string) => {
    closeEntityOpenerHost(host);
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  const picker = wirePickerList({
    input,
    list,
    listId,
    getItems,
    onSelect: (item) => {
      if (item.hash) navigate(item.hash);
    },
    onEscape: () => {
      closeEntityOpenerHost(host);
      toggle.focus();
    },
  });

  const setOpen = (open: boolean) => {
    if (!open) {
      closeEntityOpenerHost(host);
      picker.resetFilter();
      return;
    }
    panel.hidden = false;
    host.classList.add("editor-entity-opener--open");
    toggle.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
  };

  const openPanel = () => {
    setOpen(true);
    picker.renderList();
    input.focus();
    input.select();
  };

  toggle.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else setOpen(false);
  });
}

export function bindEntityOpener(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-entity-opener]").forEach((host) => wireHost(host));
}

export function closeEntityOpener(root: ParentNode): boolean {
  let closed = false;
  for (const host of root.querySelectorAll<HTMLElement>("[data-entity-opener]")) {
    if (!isVisibleOpener(host)) continue;
    const panel = host.querySelector<HTMLElement>(".editor-entity-opener-panel");
    if (!panel || panel.hidden) continue;
    closeEntityOpenerHost(host);
    closed = true;
  }
  return closed;
}

export function openEntityOpener(root: ParentNode): boolean {
  for (const host of root.querySelectorAll<HTMLElement>("[data-entity-open]")) {
    if (!isVisibleOpener(host)) continue;
    const panel = host.querySelector<HTMLElement>(".editor-entity-opener-panel");
    const toggle = host.querySelector<HTMLButtonElement>("[data-entity-opener-toggle]");
    if (!panel || panel.hidden) {
      toggle?.click();
    } else {
      host.querySelector<HTMLInputElement>(".editor-entity-opener-search")?.focus();
    }
    if (!host.querySelector<HTMLElement>(".editor-entity-opener-panel")?.hidden) return true;
  }
  return false;
}
