import { describe, expect, it } from "vitest";
import {
  errorPanel,
  escapeHtml,
  fieldId,
  formErrorPanel,
  noticePanel,
  statusPanels,
} from "./dom.js";

describe("editor DOM helpers", () => {
  it("escapes text used in HTML without changing the established apostrophe contract", () => {
    expect(escapeHtml(`A & <b title="x">'quoted'</b>`)).toBe(
      "A &amp; &lt;b title=&quot;x&quot;&gt;'quoted'&lt;/b&gt;",
    );
  });

  it("creates stable field ids", () => {
    expect(fieldId("zones.main.html")).toBe("f-zones-main-html");
  });

  it("preserves status and form-error markup", () => {
    expect(noticePanel("Saved & ready")).toBe(
      `<p class="w3-panel w3-pale-green" role="status">Saved &amp; ready</p>`,
    );
    expect(errorPanel("<Failed>")).toBe(
      `<p class="w3-panel w3-pale-red" role="alert">&lt;Failed&gt;</p>`,
    );
    expect(statusPanels("", "")).toBe("\n    ");
    expect(formErrorPanel()).toBe(
      `<p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>`,
    );
  });
});
