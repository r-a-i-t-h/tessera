import { describe, expect, it, vi } from "vitest";
import { BACK_TO_TOP_SHOW_PX, bindBackToTop, syncSiteBackToTop } from "../back-to-top.js";

describe("bindBackToTop", () => {
  it("shows the button after scrolling past the threshold", () => {
    document.body.innerHTML = `<button type="button" class="tessera-back-to-top">Up</button>`;
    const button = document.querySelector<HTMLButtonElement>(".tessera-back-to-top")!;
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
    bindBackToTop({ button });
    expect(button.classList.contains("tessera-back-to-top--visible")).toBe(false);

    Object.defineProperty(window, "scrollY", { value: BACK_TO_TOP_SHOW_PX + 1, configurable: true, writable: true });
    window.dispatchEvent(new Event("scroll"));
    expect(button.classList.contains("tessera-back-to-top--visible")).toBe(true);
  });

  it("scrolls to the top on click", () => {
    document.body.innerHTML = `<button type="button" class="tessera-back-to-top">Up</button>`;
    const button = document.querySelector<HTMLButtonElement>(".tessera-back-to-top")!;
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as typeof window.scrollTo;
    bindBackToTop({ button });
    button.click();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});

describe("syncSiteBackToTop", () => {
  it("inserts and removes the control", () => {
    document.body.innerHTML = "";
    syncSiteBackToTop(true);
    expect(document.querySelector(".tessera-back-to-top")).toBeTruthy();
    syncSiteBackToTop(false);
    expect(document.querySelector(".tessera-back-to-top")).toBeNull();
  });
});
