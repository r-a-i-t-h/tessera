// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  bindStyleColorFields,
  contrastingTextColor,
  hexForColorPicker,
  swatchForFrameColor,
  swatchForStyleToken,
} from "./style-color-field.js";

describe("style color swatch", () => {
  it("uses white text on dark bar teal", () => {
    const swatch = swatchForStyleToken("#009688");
    expect(swatch.background).toBe("#009688");
    expect(swatch.label).toBe("#009688");
    expect(swatch.text).toBe("#ffffff");
  });

  it("uses black text on light page white", () => {
    const swatch = swatchForStyleToken("#ffffff");
    expect(swatch.text).toBe("#000000");
  });

  it("shows Default on empty frame colour", () => {
    expect(swatchForFrameColor("").label).toBe("Default");
  });

  it("keeps rgba label and picks readable text", () => {
    const swatch = swatchForFrameColor("rgba(0, 0, 0, 0.85)");
    expect(swatch.label).toBe("rgba(0, 0, 0, 0.85)");
    expect(swatch.text).toBe("#ffffff");
  });

  it("contrasts mid grey toward black text on white blend", () => {
    expect(contrastingTextColor(200, 200, 200)).toBe("#000000");
  });

  it("normalizes shorthand hex for the colour picker", () => {
    expect(hexForColorPicker("#abc", "token")).toBe("#aabbcc");
    expect(hexForColorPicker("rgba(0, 150, 136, 0.75)", "frame")).toBe("#009688");
  });

  it("updates the text field when the picker changes", () => {
    document.body.innerHTML = `<form><span class="style-color-control" data-style-color-control data-style-color-mode="token">
      <span class="style-color-swatch" data-style-color-swatch><input name="bar" class="style-color-value-input" type="text" value="#009688" /></span>
      <button type="button" class="style-color-picker-btn">Pick</button>
      <input class="style-color-picker" type="color" value="#009688" />
    </span></form>`;
    bindStyleColorFields(document.body);
    const text = document.querySelector<HTMLInputElement>(".style-color-value-input")!;
    const picker = document.querySelector<HTMLInputElement>(".style-color-picker")!;
    picker.value = "#ff0000";
    picker.dispatchEvent(new Event("input", { bubbles: true }));
    expect(text.value).toBe("#ff0000");
  });
});
