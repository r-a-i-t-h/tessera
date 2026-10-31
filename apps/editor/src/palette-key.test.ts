/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { isCommandPaletteShortcut } from "./palette-key.js";

describe("isCommandPaletteShortcut", () => {
  it("matches Cmd/Ctrl+Shift+P only", () => {
    expect(
      isCommandPaletteShortcut(new KeyboardEvent("keydown", { code: "KeyP", metaKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      isCommandPaletteShortcut(new KeyboardEvent("keydown", { code: "KeyP", ctrlKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      isCommandPaletteShortcut(new KeyboardEvent("keydown", { code: "KeyP", metaKey: true })),
    ).toBe(false);
    expect(
      isCommandPaletteShortcut(new KeyboardEvent("keydown", { code: "KeyO", metaKey: true, shiftKey: true })),
    ).toBe(false);
  });
});
