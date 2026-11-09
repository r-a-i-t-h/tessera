/** Sole confirm UX for the editor (replaces `window.confirm`). */
import { activateDialog, type DialogController } from "./dialog.js";
import { escapeHtml } from "./dom.js";

export type ConfirmDialogOptions = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  returnFocus?: HTMLElement | null;
  destructive?: boolean;
};

let inFlight: Promise<boolean> | undefined;

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = new Promise<boolean>((resolve) => {
    const host = document.createElement("div");
    host.className = "editor-confirm-host";
    const confirmLabel = options.confirmLabel ?? "OK";
    const cancelLabel = options.cancelLabel ?? "Cancel";
    const primaryClass = options.destructive
      ? "w3-button w3-red"
      : "w3-button w3-blue";
    host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop>
      <div class="w3-card w3-white w3-padding editor-card editor-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-confirm-title" tabindex="-1">
        <button type="button" class="editor-dialog-close" data-confirm-close aria-label="Close">×</button>
        <h2 id="editor-confirm-title" class="w3-large w3-hide">Confirm</h2>
        <p class="editor-confirm-message w3-margin-top">${escapeHtml(options.message)}</p>
        <p class="w3-right-align w3-margin-top">
          <button type="button" class="w3-button w3-white" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="${primaryClass}" data-confirm-primary>${escapeHtml(confirmLabel)}</button>
        </p>
      </div>
    </div>`;

    let dialog: DialogController | undefined;
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      dialog?.destroy();
      host.remove();
      inFlight = undefined;
      resolve(value);
    };

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      finish(true);
    };
    host.addEventListener("keydown", onKeydown);

    host.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      if (button.hasAttribute("data-confirm-primary")) {
        finish(true);
        return;
      }
      if (button.hasAttribute("data-confirm-cancel") || button.hasAttribute("data-confirm-close")) {
        finish(false);
      }
    });

    document.body.appendChild(host);
    dialog = activateDialog(host, {
      onCancel: () => finish(false),
      returnFocus: options.returnFocus,
      initialFocus: "[data-confirm-primary]",
      closeOnBackdrop: false,
    });
  });

  return inFlight;
}
