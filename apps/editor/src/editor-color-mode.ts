export const STORAGE_KEY = "tessera.editor.darkMode";

const BODY_LIGHT = "w3-light-grey";
const BODY_DARK = "editor-body-dark";

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

export function darkModeToggle(): string {
  const checked = readDarkMode() ? " checked" : "";
  return `<label class="editor-check editor-dark-mode-toggle"><input type="checkbox" data-editor-dark-mode${checked} /> Dark mode</label>`;
}

export function darkModeAppearanceBlock(): string {
  return `<section class="editor-appearance w3-card w3-white w3-padding-large editor-card" aria-labelledby="editor-appearance-heading">
      <h2 id="editor-appearance-heading" class="w3-medium">Appearance</h2>
      <p>${darkModeToggle()}</p>
    </section>`;
}

export function isDarkModeToggle(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.hasAttribute("data-editor-dark-mode");
}

const darkModeBound = new WeakSet<ParentNode>();

/** Wire dark mode checkboxes under `root`; safe to call on every chrome re-render. */
export function bindDarkMode(root: ParentNode): void {
  syncDarkModeCheckboxes(root, readDarkMode());
  if (darkModeBound.has(root)) return;
  darkModeBound.add(root);
  root.addEventListener("change", (event) => {
    if (!isDarkModeToggle(event.target)) return;
    const on = (event.target as HTMLInputElement).checked;
    writeDarkMode(on);
    applyDarkMode(on);
    syncDarkModeCheckboxes(root, on);
    document.dispatchEvent(new CustomEvent("tessera-editor-dark-mode", { detail: { on } }));
  });
}

function syncDarkModeCheckboxes(root: ParentNode, on: boolean): void {
  for (const box of root.querySelectorAll<HTMLInputElement>("[data-editor-dark-mode]")) {
    box.checked = on;
  }
}
