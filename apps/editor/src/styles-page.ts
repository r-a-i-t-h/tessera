import { siteStyleCss, type SiteStyle } from "@r-a-i-t-h/tessera-model";
import { bindCodeWrap, codeWrapClass, codeWrapToggle } from "./code-wrap.js";
import { activateDialog, type DialogController } from "./dialog.js";
import { errorPanel, escapeHtml, noticePanel } from "./dom.js";
import { STYLE_FIELDS, styleDraft, styleFieldValues, styleFromValues, styleGroups } from "./forms/style.js";

const PANELS_KEY = "tessera.styles.panels";

type StoredPanels = {
  tokens?: boolean;
  sheets?: Record<string, boolean>;
};

function storedPanels(): StoredPanels {
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as StoredPanels;
  } catch {
    return {};
  }
}

function savePanels(state: StoredPanels): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/** Whether the Site style block starts open. Default open. */
export function readStyleTokensOpen(): boolean {
  const { tokens } = storedPanels();
  return tokens ?? true;
}

/** Whether a stylesheet editor starts open. Site layout defaults open. */
export function readStylesheetOpen(id: string): boolean {
  const { sheets } = storedPanels();
  if (sheets && Object.prototype.hasOwnProperty.call(sheets, id)) return sheets[id]!;
  return id === "site";
}

function writeStyleTokensOpen(open: boolean): void {
  const state = storedPanels();
  state.tokens = open;
  savePanels(state);
}

function writeStylesheetOpen(id: string, open: boolean): void {
  const state = storedPanels();
  state.sheets = { ...state.sheets, [id]: open };
  savePanels(state);
}

export function bindStylePanels(root: ParentNode): void {
  const tokens = root.querySelector<HTMLDetailsElement>("details.style-tokens");
  tokens?.addEventListener("toggle", () => writeStyleTokensOpen(tokens.open));

  for (const form of root.querySelectorAll<HTMLFormElement>("form[data-sheet]")) {
    const sheet = form.closest<HTMLDetailsElement>("details.style-sheet");
    if (!sheet || sheet.classList.contains("style-tokens")) continue;
    const id = form.dataset.sheet ?? "";
    if (!id) continue;
    sheet.addEventListener("toggle", () => writeStylesheetOpen(id, sheet.open));
  }
}

export function stylesPageHtml(record: Record<string, unknown>, notice = "", error = ""): string {
  const values = styleFieldValues(record);
  const fields = styleGroups()
    .map(
      (group) => `<fieldset class="style-group">
        <legend>${escapeHtml(group.group)}</legend>
        <div class="editor-props">${group.fields.map((field) => fieldHtml(field.name, field.label, field.kind, values[field.name])).join("")}</div>
      </fieldset>`,
    )
    .join("");
  return `<h1 class="w3-large">Styles</h1>
    ${noticePanel(notice)}
    ${errorPanel(error)}
    <details class="style-sheet style-tokens"${readStyleTokensOpen() ? " open" : ""}>
      <summary>Site style</summary>
      <div id="style-specimen" class="style-specimen" data-side="${escapeHtml(values.navSide)}">
        <style id="style-specimen-css">${siteStyleCss(values, ".style-specimen")}</style>
        <div class="style-specimen-bar"><span>Site title</span><span>A B</span></div>
        <div class="style-specimen-body">
          <aside class="style-specimen-side">Home</aside>
          <div class="style-specimen-main">
            <p>Body text with a <a href="#/styles">link</a>.</p>
            <nav class="tessera-links tessera-links-cards" aria-label="Sample links">
              <div class="tessera-links-row"><a class="tessera-link-card" href="#/styles">Section</a></div>
            </nav>
          </div>
        </div>
      </div>
      <form id="style-form">
        ${fields}
        <p><button type="submit" class="w3-button w3-theme">Save styles</button></p>
      </form>
    </details>
    <h2 class="w3-large">Stylesheets</h2>`;
}

export function readStyleForm(form: HTMLFormElement): { ok: true; style: SiteStyle } | { ok: false; error: string } {
  return styleFromValues(styleValues(form));
}

export function previewStyle(form: HTMLFormElement): SiteStyle {
  return styleDraft(styleValues(form));
}

function styleValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of STYLE_FIELDS) {
    const input = form.elements.namedItem(field.name);
    values[field.name] = input instanceof HTMLInputElement || input instanceof HTMLSelectElement ? input.value : "";
  }
  return values;
}

export function paintSpecimen(root: ParentNode, style: SiteStyle): void {
  const specimen = root.querySelector<HTMLElement>("#style-specimen");
  const css = root.querySelector<HTMLStyleElement>("#style-specimen-css");
  if (!specimen || !css) return;
  css.textContent = siteStyleCss(style, ".style-specimen");
  specimen.dataset.side = style.navSide === "left" ? "left" : "right";
}

function fieldHtml(name: string, label: string, kind: string, value: string): string {
  const id = `style-${name}`;
  const wide = kind === "url" ? ` class="editor-prop-wide"` : "";
  if (kind === "side") {
    return `<p><label for="${id}">${escapeHtml(label)}</label>
      <select id="${id}" name="${escapeHtml(name)}" class="w3-select w3-border">
        <option value="right"${value === "right" ? " selected" : ""}>Right</option>
        <option value="left"${value === "left" ? " selected" : ""}>Left</option>
      </select></p>`;
  }
  if (kind === "footer") {
    return `<p><label for="${id}">${escapeHtml(label)}</label>
      <select id="${id}" name="${escapeHtml(name)}" class="w3-select w3-border">
        <option value="floating"${value !== "fixed" ? " selected" : ""}>Floating</option>
        <option value="fixed"${value === "fixed" ? " selected" : ""}>Fixed</option>
      </select></p>`;
  }
  if (kind === "color") {
    return `<p><label for="${id}">${escapeHtml(label)}</label>
      <input id="${id}" name="${escapeHtml(name)}" class="style-color" type="color" value="${escapeHtml(value)}" /></p>`;
  }
  const type = kind === "url" ? "url" : "text";
  return `<p${wide}><label for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" name="${escapeHtml(name)}" class="w3-input w3-border" type="${type}" value="${escapeHtml(value)}" /></p>`;
}

export type StylesheetView = {
  id: string;
  label: string;
  text: string;
  overridden: boolean;
};

export function stylesheetEditors(sheets: readonly StylesheetView[], error = ""): string {
  const alert = error ? `<p class="w3-panel w3-pale-red" role="alert">${escapeHtml(error)}</p>` : "";
  if (!sheets.length) return `${alert}<p>No stylesheets are available.</p>`;
  return alert + sheets.map(sheetEditor).join("");
}

function sheetEditor(sheet: StylesheetView): string {
  const open = readStylesheetOpen(sheet.id) ? " open" : "";
  const own = sheet.overridden ? " This site has its own copy." : "";
  return `<details class="style-sheet"${open}>
    <summary>${escapeHtml(sheet.label)}</summary>
    <p class="w3-small w3-text-grey">${escapeHtml(sheetNote(sheet.id) + own)}</p>
    <form data-sheet="${escapeHtml(sheet.id)}" aria-labelledby="style-sheet-title-${escapeHtml(sheet.id)}">
      <h3 class="style-sheet-dialog-title" id="style-sheet-title-${escapeHtml(sheet.id)}">${escapeHtml(sheet.label)}</h3>
      <p class="style-sheet-tools">${codeWrapToggle(`style-${sheet.id}`)}<button type="button" class="w3-button w3-small w3-white" data-sheet-maximize>Maximize</button></p>
      <p class="style-sheet-editor"><textarea id="style-${escapeHtml(sheet.id)}" name="text" rows="18" spellcheck="false" class="w3-input w3-border editor-yaml${codeWrapClass()}">${escapeHtml(sheet.text)}</textarea></p>
      <p class="style-sheet-actions">
        <button type="submit" class="w3-button w3-theme">Save ${escapeHtml(sheet.label)}</button>
        <button type="button" class="w3-button w3-white style-sheet-normalize" data-sheet-normalize>Normalize</button>
      </p>
    </form>
  </details>`;
}

export function bindStylesheetEditors(
  root: ParentNode,
  onSave: (form: HTMLFormElement) => void,
): void {
  bindCodeWrap(root);
  const dialogs = new WeakMap<HTMLDetailsElement, DialogController>();
  for (const form of root.querySelectorAll<HTMLFormElement>("form[data-sheet]")) {
    const sheet = form.closest<HTMLDetailsElement>("details.style-sheet");
    const maximize = form.querySelector<HTMLButtonElement>("[data-sheet-maximize]");
    const normalize = form.querySelector<HTMLButtonElement>("[data-sheet-normalize]");
    let overlay: HTMLDivElement | null = null;
    const restore = () => {
      if (!sheet) return;
      dialogs.get(sheet)?.destroy();
      dialogs.delete(sheet);
      sheet.classList.remove("style-sheet--maximized");
      sheet.appendChild(form);
      overlay?.remove();
      overlay = null;
      form.removeAttribute("role");
      form.removeAttribute("aria-modal");
      form.removeAttribute("tabindex");
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onSave(form);
    });
    maximize?.addEventListener("click", () => {
      if (!sheet || !maximize || !normalize) return;
      sheet.open = true;
      sheet.classList.add("style-sheet--maximized");
      overlay = document.createElement("div");
      overlay.className = "style-sheet-overlay-host";
      document.body.appendChild(overlay);
      overlay.appendChild(form);
      form.setAttribute("role", "dialog");
      form.setAttribute("aria-modal", "true");
      form.tabIndex = -1;
      const textarea = form.querySelector<HTMLTextAreaElement>('textarea[name="text"]');
      textarea?.focus();
      dialogs.set(
        sheet,
        activateDialog(overlay, {
          onCancel: restore,
          returnFocus: maximize,
          initialFocus: 'textarea[name="text"]',
        }),
      );
    });
    normalize?.addEventListener("click", restore);
  }
}

function sheetNote(id: string): string {
  const publish = "The preview uses a save immediately. Publish to update the published site.";
  const tokens =
    "Tokens you change above are written into a style element after these files and override those variables in Tessera. A variable left at its default stays in the stylesheet, so an edit there shows in the preview. Editing a variable here does not change the form above.";
  const shared = "This starts as the copy shipped with Tessera. Saving stores a copy for this site.";
  if (id === "site") return `This file is this site's layout. ${tokens} ${publish}`;
  if (id === "tessera") return `${shared} ${tokens} ${publish}`;
  return `${shared} ${publish}`;
}
