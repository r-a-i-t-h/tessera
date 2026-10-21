import { uploadLibrary, getLibrary } from "./api.js";
import { activateDialog, type DialogController } from "./dialog.js";
import {
  readLibraryAssetListOrder,
  writeLibraryAssetListOrder,
} from "./library-list-order.js";
import { pickerUpload, renderPicker, type PickerMode, type PickedAsset } from "./forms/picker.js";

export function openLibraryPicker(initial: PickerMode): Promise<PickedAsset | { id: string; kind: "folder" } | undefined> {
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return getLibrary().then(
    (listing) =>
      new Promise((resolve) => {
        const host = document.createElement("div");
        host.className = "editor-picker-host";
        let mode = initial;
        let openId: string | null = null;
        let assetOrder = readLibraryAssetListOrder();
        let notice = "";
        let busy = false;
        let done = false;
        let dialog: DialogController | undefined;
        const finish = (value: PickedAsset | { id: string; kind: "folder" } | undefined) => {
          if (done) return;
          done = true;
          host.remove();
          dialog?.destroy();
          resolve(value);
        };
        const paint = () => {
          host.innerHTML = `<div class="editor-picker-backdrop" data-dialog-backdrop><div class="w3-card w3-white w3-padding editor-card editor-library-dialog" role="dialog" aria-modal="true" aria-labelledby="library-picker-title" tabindex="-1">
            <button type="button" class="editor-dialog-close" data-picker-close aria-label="Close">×</button>
            <h2 id="library-picker-title" class="w3-large editor-library-dialog-title">Choose from the library</h2>
            <div class="editor-picker-body">
              ${renderPicker(listing, mode, openId, assetOrder)}
              ${pickerUpload(notice)}
            </div>
          </div></div>`;
        };
        const fail = (message: string) => {
          if (done) return;
          notice = message;
          busy = false;
          paint();
          dialog?.focus();
        };
        const uploadFile = async (file: File) => {
          if (busy || done) return;
          busy = true;
          notice = "Adding…";
          paint();
          const body = new FormData();
          body.append("file", file);
          body.append("path", file.name);
          body.append("folderId", "uploads");
          try {
            const result = await uploadLibrary(body);
            if (done) return;
            const created = result.created[0];
            if (!created || result.skipped.length) {
              fail(result.skipped[0]?.reason ?? "Could not add that file.");
              return;
            }
            const fresh = await getLibrary();
            if (done) return;
            const asset = fresh.assets.find((item) => item.id === created.id);
            if (!asset) {
              fail("Could not add that file.");
              return;
            }
            finish(asset);
          } catch (err) {
            fail(err instanceof Error ? err.message : "Could not add that file.");
          }
        };
        host.addEventListener("submit", (event) => {
          const form = event.target;
          if (form instanceof HTMLFormElement && form.hasAttribute("data-picker-upload")) event.preventDefault();
        });
        host.addEventListener("dragover", (event) => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest("[data-picker-upload]")) return;
          event.preventDefault();
        });
        host.addEventListener("drop", (event) => {
          const target = event.target;
          if (!(target instanceof Element) || !target.closest("[data-picker-upload]")) return;
          event.preventDefault();
          if (busy || done) return;
          const files = event.dataTransfer?.files;
          if (!files || files.length !== 1) {
            fail("Only one file can be added.");
            return;
          }
          void uploadFile(files[0]);
        });
        host.addEventListener("change", (event) => {
          const target = event.target;
          if (target instanceof HTMLSelectElement && target.id === "library-picker-asset-list-order") {
            assetOrder = target.value === "added" ? "added" : "alpha";
            writeLibraryAssetListOrder(assetOrder);
            paint();
            dialog?.focus();
            return;
          }
          const input = target;
          if (!(input instanceof HTMLInputElement) || !input.hasAttribute("data-picker-file")) return;
          if (busy || done) return;
          const files = input.files;
          if (!files || files.length !== 1) {
            if (files && files.length > 1) fail("Only one file can be added.");
            return;
          }
          void uploadFile(files[0]);
        });
        host.addEventListener("click", (event) => {
          const button = (event.target as HTMLElement).closest("button");
          if (!button) return;
          if (button.hasAttribute("data-picker-close")) {
            finish(undefined);
            return;
          }
          if (button.dataset.pickerMode === "image" || button.dataset.pickerMode === "document" || button.dataset.pickerMode === "folder") {
            mode = button.dataset.pickerMode;
            paint();
            dialog?.focus();
            return;
          }
          if (button.dataset.openFolder) {
            openId = button.dataset.openFolder;
            paint();
            dialog?.focus();
            return;
          }
          if (button.hasAttribute("data-picker-up")) {
            openId = listing.folders.find((folder) => folder.id === openId)?.parentId ?? null;
            paint();
            dialog?.focus();
            return;
          }
          if (button.dataset.pickFolder) {
            finish({ id: button.dataset.pickFolder, kind: "folder" });
            return;
          }
          const asset = listing.assets.find((item) => item.id === button.dataset.pickAsset);
          if (asset) finish(asset);
        });
        paint();
        document.body.appendChild(host);
        dialog = activateDialog(host, {
          onCancel: () => finish(undefined),
          returnFocus,
          initialFocus: "[data-picker-close]",
          closeOnBackdrop: false,
        });
      }),
  );
}
