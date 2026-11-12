export const STORAGE_KEY = "tessera.editor.darkMode";

const BODY_LIGHT = "w3-light-grey";
const BODY_DARK = "editor-body-dark";

const DARK_MODE_ICON_MOON = `<svg class="editor-dark-mode-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M10.2 2.1a5.5 5.5 0 1 0 3.7 9.6A6 6 0 0 1 8 14a6 6 0 0 1 0-12c.75 0 1.47.14 2.2.1Z"/></svg>`;

const DARK_MODE_ICON_SUN = `<svg class="editor-dark-mode-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.1" fill="none" stroke="currentColor" stroke-width="1.4"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M8 1.4v2.2M8 12.4v2.2M1.4 8h2.2M12.4 8h2.2M3.2 3.2l1.55 1.55M11.25 11.25l1.55 1.55M3.2 12.8l1.55-1.55M11.25 4.75l1.55-1.55"/></svg>`;

const RELOAD_DATA_ICON = `<svg class="editor-cache-clear-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M13.2 8a5.2 5.2 0 1 1-1.5-3.7"/><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M13.2 3.2V8h-4.8"/></svg>`;

/** Whether the editor shell uses dark mode. */
export function readDarkMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isDarkMode(): boolean {
  return readDarkMode();
}

export function writeDarkMode(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // localStorage unavailable
  }
}

/** Sync document root, body, and color-scheme to the stored preference. */
export function applyDarkMode(on?: boolean): void {
  const dark = on ?? readDarkMode();
  const root = document.documentElement;
  root.classList.toggle("editor-dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";

  const body = document.body;
  if (body) {
    body.classList.toggle(BODY_LIGHT, !dark);
    body.classList.toggle(BODY_DARK, dark);
  }
}

function darkModeControlMarkup(className: string): string {
  const dark = readDarkMode();
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  const icon = dark ? DARK_MODE_ICON_SUN : DARK_MODE_ICON_MOON;
  return `<button type="button" class="${className}" data-editor-dark-mode aria-pressed="${dark ? "true" : "false"}" aria-label="${label}" title="${label}">${icon}</button>`;
}

export function darkModeSidebarToggle(): string {
  return darkModeControlMarkup("w3-bar-item w3-button editor-dark-mode-toggle");
}

export function darkModeLoginToggle(): string {
  return darkModeControlMarkup("w3-bar-item w3-button editor-dark-mode-toggle editor-dark-mode-toggle--login");
}

function cacheClearMarkup(className: string): string {
  return `<button type="button" class="${className}" data-editor-clear-cache aria-label="Reload editor data" title="Reload editor data">${RELOAD_DATA_ICON}</button>`;
}

export function cacheClearSidebarToggle(): string {
  return cacheClearMarkup("w3-bar-item w3-button editor-cache-clear-toggle");
}

export function cacheClearLoginToggle(): string {
  return cacheClearMarkup("w3-bar-item w3-button editor-cache-clear-toggle editor-cache-clear-toggle--login");
}

export function isDarkModeToggle(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.hasAttribute("data-editor-dark-mode");
}

const darkModeBound = new WeakSet<ParentNode>();

/** Wire dark mode toggles under `root`; safe to call on every chrome re-render. */
export function bindDarkMode(root: ParentNode): void {
  syncDarkModeControls(root, readDarkMode());
  if (darkModeBound.has(root)) return;
  darkModeBound.add(root);
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("[data-editor-dark-mode]");
    if (!button) return;
    event.preventDefault();
    const on = !readDarkMode();
    writeDarkMode(on);
    applyDarkMode(on);
    syncDarkModeControls(root, on);
    document.dispatchEvent(new CustomEvent("tessera-editor-dark-mode", { detail: { on } }));
  });
}

function syncDarkModeControls(root: ParentNode, on: boolean): void {
  const label = on ? "Switch to light mode" : "Switch to dark mode";
  const icon = on ? DARK_MODE_ICON_SUN : DARK_MODE_ICON_MOON;
  for (const button of root.querySelectorAll<HTMLElement>("[data-editor-dark-mode]")) {
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.innerHTML = icon;
  }
}
