import { beforeEach, describe, expect, it } from "vitest";
import { WCBase } from "@r-a-i-t-h/tessera-wc-base";

class RtCardProbe extends WCBase {
  useShadow = false;
  elTitle = this.e("h3", { className: "w3-text-theme" });
  static a = {
    title(this: RtCardProbe, v: string | null) {
      this.elTitle.textContent = v ?? "";
    },
  };
  b() {
    this.className = "w3-card w3-padding w3-white";
    return [this.elTitle, this.d({ className: "rt-card-body" }), []];
  }
}

describe("WCBase light-DOM rehome", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    if (!customElements.get("rt-card-probe")) {
      customElements.define("rt-card-probe", RtCardProbe);
    }
  });

  it("moves light children into the [] slot even when they arrive with innerHTML", async () => {
    document.body.innerHTML =
      `<rt-card-probe title="T"><p>Child light-DOM content from the renderer.</p></rt-card-probe>`;
    await customElements.whenDefined("rt-card-probe");
    // Allow MutationObserver microtask to flush late children.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    const card = document.querySelector("rt-card-probe")!;
    const body = card.querySelector(".rt-card-body");
    expect(body?.textContent).toContain("Child light-DOM content");
    expect(card.querySelector(":scope > p")).toBeNull();
  });
});
