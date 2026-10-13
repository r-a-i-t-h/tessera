import { describe, expect, it, beforeEach } from "vitest";
import { applySiteChrome } from "./chrome.js";

describe("applySiteChrome", () => {
  beforeEach(() => {
    document.body.className = "wh-body";
    document.head.innerHTML = "";
  });

  it("adds footer-fixed when footerStyle is fixed", () => {
    applySiteChrome({ footerStyle: "fixed", navSide: "left" });
    expect(document.body.classList.contains("footer-fixed")).toBe(true);
    expect(document.body.classList.contains("leftnav")).toBe(true);
    expect(document.body.classList.contains("fontA")).toBe(true);
  });

  it("removes footer-fixed when footerStyle is floating", () => {
    document.body.classList.add("footer-fixed", "leftnav", "fontA");
    applySiteChrome({ footerStyle: "floating" });
    expect(document.body.classList.contains("footer-fixed")).toBe(false);
    expect(document.body.classList.contains("rightnav")).toBe(true);
  });
});
