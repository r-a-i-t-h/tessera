// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  editorToastDurationMs,
  errorPanel,
  escapeHtml,
  fieldId,
  formErrorPanel,
  noticePanel,
  showEditorToast,
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
    noticePanel("Saved & ready");
    const toast = document.getElementById("editor-toast");
    expect(toast?.querySelector(".editor-toast-text")?.textContent).toBe("Saved & ready");
    expect(toast?.classList.contains("editor-toast--success")).toBe(true);
    expect(noticePanel("")).toBe("");
    expect(errorPanel("<Failed>")).toBe(
      `<p class="w3-panel w3-pale-red" role="alert">&lt;Failed&gt;</p>`,
    );
    expect(statusPanels("", "")).toBe("");
    expect(formErrorPanel()).toBe(
      `<p data-form-error class="w3-panel w3-pale-red" role="alert" hidden></p>`,
    );
  });

  afterEach(() => {
    document.getElementById("editor-toast")?.remove();
    vi.useRealTimers();
  });

  it("scales toast duration with message length", () => {
    expect(editorToastDurationMs("Saved.")).toBe(2400);
    expect(editorToastDurationMs("x".repeat(120))).toBeGreaterThan(6000);
  });

  it("shows a neutral toast for null outcomes", () => {
    vi.useFakeTimers();
    showEditorToast("Nothing was saved.", { tone: "neutral" });
    const toast = document.getElementById("editor-toast");
    expect(toast?.classList.contains("editor-toast--neutral")).toBe(true);
    expect(toast?.querySelector(".editor-toast-link")).toBeNull();
  });

  it("adds a link icon that opens in a new tab", () => {
    showEditorToast("Rendered 3 pages into the preview.", { href: "/preview/" });
    const link = document.querySelector<HTMLAnchorElement>(".editor-toast-link");
    expect(link?.href).toContain("/preview/");
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toBe("noopener noreferrer");
    expect(link?.querySelector("svg")).not.toBeNull();
  });

  it("hides after the computed duration", () => {
    vi.useFakeTimers();
    showEditorToast("Saved.");
    const toast = document.getElementById("editor-toast");
    expect(toast?.classList.contains("editor-toast--visible")).toBe(true);
    vi.advanceTimersByTime(2600);
    expect(toast?.classList.contains("editor-toast--visible")).toBe(false);
  });
});
