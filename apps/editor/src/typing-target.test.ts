/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest";
import { defocusTypingTarget, isTypingTarget } from "./typing-target.js";

describe("defocusTypingTarget", () => {
  it("blurs the focused input and leaves other targets alone", () => {
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(defocusTypingTarget()).toBe(true);
    expect(document.activeElement).not.toBe(input);
    input.remove();
    expect(defocusTypingTarget()).toBe(false);
  });

  it("treats contenteditable as typing", () => {
    const el = document.createElement("div");
    el.contentEditable = "true";
    document.body.append(el);
    expect(isTypingTarget(el)).toBe(true);
    el.remove();
  });
});
