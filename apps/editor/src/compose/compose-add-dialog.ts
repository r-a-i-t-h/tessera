import { COMPOSE_PALETTE_GROUP_LENGTHS, PALETTE } from "@r-a-i-t-h/tessera-sections";
import { activateDialog, type DialogController } from "../dialog.js";
import { escapeHtml } from "../dom.js";

export type ComposeAddDialogOptions = {
  onPick: (kind: string) => void;
  returnFocus?: HTMLElement | null;
};

let inFlight = false;

export function openComposeAddDialog(options: ComposeAddDialogOptions): void {
  if (inFlight) return;
  inFlight = true;

  const host = document.createElement("div");
  host.className = "editor-compose-add-host";

  let at = 0;
  const groupHtml = COMPOSE_PALETTE_GROUP_LENGTHS.map((length) => {
    const slice = PALETTE.slice(at, at + length);
    at += length;
    const buttons = slice
      .map(
        (item) =>
          `<li role="presentation"><button type="button" class="w3-button w3-white w3-border editor-compose-add-kind" data-palette="${escapeHtml(item.kind)}">${escapeHtml(item.label)}</button></li>`,
      )
      .join("");
    return `<ul class="w3-ul editor-compose-add-group" role="group">${buttons}</ul>`;
  }).join('<hr class="editor-palette-rule" aria-hidden="true">');

  host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop>
    <div class="w3-card w3-white w3-padding editor-card editor-compose-add-dialog" role="dialog" aria-modal="true" aria-label="Add widget" tabindex="-1">
      <button type="button" class="editor-dialog-close" data-compose-add-close aria-label="Close">×</button>
      <h2 class="w3-large">Add widget</h2>
      <p class="w3-small w3-text-grey">Inserts at the end of the active zone. Use ↑ ↓ to move.</p>
      ${groupHtml}
    </div>
  </div>`;

  let dialog: DialogController | undefined;

  const finish = () => {
    dialog?.destroy();
    host.remove();
    inFlight = false;
  };

  host.querySelector("[data-compose-add-close]")?.addEventListener("click", () => finish());
  host.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-palette]");
    if (!button?.dataset.palette) return;
    event.preventDefault();
    options.onPick(button.dataset.palette);
    finish();
  });

  document.body.appendChild(host);
  dialog = activateDialog(host, {
    onCancel: finish,
    closeOnBackdrop: true,
    returnFocus: options.returnFocus ?? null,
  });
}
