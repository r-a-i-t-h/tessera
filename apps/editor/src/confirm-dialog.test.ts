// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmDialog } from "./confirm-dialog.js";

describe("confirmDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resolves true when the primary button is clicked", async () => {
    document.body.innerHTML = `<button id="opener">Open</button>`;
    const opener = document.querySelector<HTMLButtonElement>("#opener")!;
    opener.focus();
    const promise = confirmDialog({ message: "Continue?", returnFocus: opener });
    await Promise.resolve();
    document.querySelector<HTMLButtonElement>("[data-confirm-primary]")?.click();
    await expect(promise).resolves.toBe(true);
    expect(document.querySelector(".editor-confirm-host")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("resolves false on Escape", async () => {
    document.body.innerHTML = `<button id="opener">Open</button>`;
    const opener = document.querySelector<HTMLButtonElement>("#opener")!;
    const promise = confirmDialog({ message: "Continue?", returnFocus: opener });
    await Promise.resolve();
    const host = document.querySelector<HTMLElement>(".editor-confirm-host")!;
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect(promise).resolves.toBe(false);
  });

  it("resolves true on Enter", async () => {
    const promise = confirmDialog({ message: "Continue?" });
    await Promise.resolve();
    const host = document.querySelector<HTMLElement>(".editor-confirm-host")!;
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await expect(promise).resolves.toBe(true);
  });

  it("returns the same promise while a dialog is open", async () => {
    const first = confirmDialog({ message: "One" });
    const second = confirmDialog({ message: "Two" });
    expect(first).toBe(second);
    await Promise.resolve();
    expect(document.querySelectorAll(".editor-confirm-host")).toHaveLength(1);
    document.querySelector<HTMLButtonElement>("[data-confirm-cancel]")?.click();
    await expect(first).resolves.toBe(false);
  });
});
