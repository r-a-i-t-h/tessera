import { WCBase } from "@r-a-i-t-h/tessera-wc-base";

/** Simple light-DOM card — W3.CSS classes work without shadow encapsulation. */
export class RtCard extends WCBase {
  useShadow = false;

  elTitle = this.e("h3", { className: "w3-text-theme" });

  static a = {
    title(this: RtCard, v: string | null) {
      this.elTitle.textContent = v ?? "";
    },
  };

  b() {
    this.elTitle.style.marginTop = "0";
    // Custom elements default to display:inline; with block children + w3-white
    // padding that produces stray white fragment boxes.
    this.style.display = "block";
    this.className = "w3-card w3-padding w3-margin-bottom w3-white";
    return [this.elTitle, this.d({ className: "rt-card-body" }), []];
  }
}

export function registerCardElement(): void {
  if (!customElements.get("rt-card")) {
    customElements.define("rt-card", RtCard);
  }
}
