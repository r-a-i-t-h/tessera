// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  contrastingTextColor,
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
});
