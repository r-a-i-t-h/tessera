import { activateDialog, type DialogController } from "./dialog.js";
import {
  bindPageTargetPickerPanels,
  renderPageTargetPicker,
  type PageTargetChoices,
} from "./forms/page-target.js";

export function openPageTargetPicker(
  choices: PageTargetChoices,
  current: string,
  returnFocus?: HTMLElement | null,
): Promise<string | undefined> {
  const focusTarget =
    returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "editor-picker-host";
    let done = false;
    let dialog: DialogController | undefined;
    const finish = (value: string | undefined) => {
      if (done) return;
      done = true;
      host.remove();
      dialog?.destroy();
      resolve(value);
    };
    const paint = () => {
      host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop><div class="w3-card w3-white w3-padding editor-card editor-page-target-dialog" role="dialog" aria-modal="true" aria-labelledby="page-target-picker-title" tabindex="-1">
        <button type="button" class="editor-dialog-close" data-picker-close aria-label="Close">×</button>
        <h2 id="page-target-picker-title" class="w3-large editor-page-target-dialog-title">Choose page or URL</h2>
        ${renderPageTargetPicker(choices, current)}
      </div></div>`;
      bindPageTargetPickerPanels(host);
    };
    host.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      if (button.hasAttribute("data-picker-close")) {
        finish(undefined);
        return;
      }
      if (button.dataset.pickPage) {
        finish(button.dataset.pickPage);
        return;
      }
      if (button.hasAttribute("data-page-target-use-url")) {
        const field = host.querySelector<HTMLInputElement>("[data-page-target-external]");
        const url = field?.value.trim() ?? "";
        if (url) finish(url);
      }
    });
    paint();
    document.body.appendChild(host);
    dialog = activateDialog(host, {
      onCancel: () => finish(undefined),
      returnFocus: focusTarget,
      initialFocus: "[data-picker-close]",
      closeOnBackdrop: false,
    });
  });
}
