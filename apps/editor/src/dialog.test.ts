// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { activateDialog, type DialogController } from "./dialog.js";

describe("accessible dialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("moves and traps focus, closes on Escape, and restores focus", async () => {
    document.body.innerHTML = `<button id="opener">Open</button>
      <div id="host">
        <div data-dialog-backdrop>
          <section role="dialog" aria-modal="true" aria-labelledby="title" tabindex="-1">
            <h2 id="title">Choose</h2>
            <button id="first">First</button>
            <button id="last">Last</button>
          </section>
        </div>
      </div>`;
    const opener = document.querySelector<HTMLButtonElement>("#opener")!;
    const host = document.querySelector<HTMLElement>("#host")!;
    opener.focus();
    let controller: DialogController;
    const cancel = vi.fn(() => controller.destroy());
    controller = activateDialog(host, { onCancel: cancel, returnFocus: opener });
    await Promise.resolve();

    const first = document.querySelector<HTMLButtonElement>("#first")!;
    const last = document.querySelector<HTMLButtonElement>("#last")!;
    expect(document.activeElement).toBe(first);
    last.focus();
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);

    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
  });

  it("does not close on the backdrop unless requested", () => {
    document.body.innerHTML = `<div id="host"><div data-dialog-backdrop>
      <div role="dialog" aria-modal="true" aria-label="Example" tabindex="-1"><button>Close</button></div>
    </div></div>`;
    const host = document.querySelector<HTMLElement>("#host")!;
    const cancel = vi.fn();
    const controller = activateDialog(host, { onCancel: cancel, closeOnBackdrop: false });
    document.querySelector<HTMLElement>("[data-dialog-backdrop]")?.click();
    expect(cancel).not.toHaveBeenCalled();
    controller.destroy();
  });
});
