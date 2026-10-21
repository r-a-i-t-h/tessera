import { datasetRootRecords } from "../api.js";
import { activateDialog } from "../dialog.js";
import { escapeHtml } from "../dom.js";

export function openRecordPicker(
  datasetId: string,
  options?: { excludeUid?: number; currentUid?: number },
): Promise<number | undefined> {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return datasetRootRecords(datasetId).then(({ records }) => {
    const filtered = records.filter((r) => r.uid !== options?.excludeUid);
    return new Promise((resolve) => {
      const host = document.createElement("div");
      host.className = "editor-picker-host";
      let query = "";
      let done = false;
      const finish = (uid: number | undefined) => {
        if (done) return;
        done = true;
        host.remove();
        dialog?.destroy();
        resolve(uid);
      };
      const paint = () => {
        const q = query.trim().toLowerCase();
        const rows = filtered
          .filter((r) => {
            if (!q) return true;
            return r.displayName.toLowerCase().includes(q) || String(r.uid).includes(q);
          })
          .map(
            (r) =>
              `<li><button type="button" class="w3-button w3-white w3-block editor-picker-asset" data-pick-record="${r.uid}">${escapeHtml(r.displayName)} <span class="w3-text-grey">(${r.uid})</span></button></li>`,
          )
          .join("");
        host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop><div class="w3-card w3-white w3-padding editor-card" role="dialog" aria-modal="true" aria-labelledby="record-picker-title" tabindex="-1">
          <button type="button" class="editor-dialog-close" data-picker-close aria-label="Close">×</button>
          <h2 id="record-picker-title" class="w3-large">Choose a record</h2>
          <p><input class="w3-input w3-border" data-record-filter placeholder="Filter…" value="${escapeHtml(query)}" /></p>
          <ul class="w3-ul">${rows || "<li class=\"w3-text-grey\">No records.</li>"}</ul>
        </div></div>`;
      };
      let dialog: ReturnType<typeof activateDialog> | undefined;
      host.addEventListener("input", (event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement && input.hasAttribute("data-record-filter")) {
          query = input.value;
          paint();
        }
      });
      host.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest("button");
        if (!button) return;
        if (button.hasAttribute("data-picker-close")) {
          finish(undefined);
          return;
        }
        const uid = Number(button.dataset.pickRecord);
        if (Number.isInteger(uid)) finish(uid);
      });
      paint();
      document.body.appendChild(host);
      dialog = activateDialog(host, {
        onCancel: () => finish(undefined),
        returnFocus,
        initialFocus: "[data-record-filter]",
        closeOnBackdrop: true,
      });
    });
  });
}
