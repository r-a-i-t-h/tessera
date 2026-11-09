/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { confirmDialog } from "./confirm-dialog.js";
import {
  closeShortcutsHelp,
  handleShortcutsHelpKey,
  isShortcutsHelpOpen,
  openShortcutsHelp,
} from "./shortcuts-help.js";

describe("shortcuts help", () => {
  it("opens on ? and closes on second ?", () => {
    closeShortcutsHelp();
    const event = new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true });
    expect(handleShortcutsHelpKey(event)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(isShortcutsHelpOpen()).toBe(true);
    expect(document.querySelector(".editor-shortcuts-help-dialog")).toBeTruthy();

    const again = new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true });
    expect(handleShortcutsHelpKey(again)).toBe(true);
    expect(isShortcutsHelpOpen()).toBe(false);
  });

  it("does not open while typing in an input", () => {
    closeShortcutsHelp();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const event = new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true });
    Object.defineProperty(event, "target", { value: input });
    expect(handleShortcutsHelpKey(event)).toBe(false);
    input.remove();
  });

  it("does not open when another modal is open", async () => {
    closeShortcutsHelp();
    const confirmPromise = confirmDialog({ message: "Sure?" });
    const event = new KeyboardEvent("keydown", { key: "?", bubbles: true, cancelable: true });
    expect(handleShortcutsHelpKey(event)).toBe(false);
    document.querySelector<HTMLButtonElement>("[data-confirm-cancel]")?.click();
    await confirmPromise;
  });

  it("openShortcutsHelp returns false when blocked", async () => {
    closeShortcutsHelp();
    const confirmPromise = confirmDialog({ message: "Sure?" });
    expect(openShortcutsHelp()).toBe(false);
    document.querySelector<HTMLButtonElement>("[data-confirm-cancel]")?.click();
    await confirmPromise;
  });
});
