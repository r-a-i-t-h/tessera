// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatasetRecordsRawOverlay } from "./records-raw-overlay.js";

vi.mock("../maximized-code-editor.js", () => ({
  mountMaximizedCodeEditor: vi.fn(() => ({
    focus: vi.fn(),
    destroy: vi.fn(),
  })),
  readFormText: (form: HTMLFormElement) => {
    const field = form.elements.namedItem("text");
    return field instanceof HTMLTextAreaElement ? field.value : "";
  },
}));

vi.mock("../api.js", () => ({
  saveDatasetRecordsRaw: vi.fn(),
}));

describe("dataset records raw overlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("opens a dialog form with the records JSON", () => {
    const button = document.createElement("button");
    document.body.append(button);
    openDatasetRecordsRawOverlay({
      datasetId: "items",
      records: [{ uid: 1, added: "t", modified: "t", name: "A" }],
      returnFocus: button,
      isActive: () => true,
      onSaved: () => {},
    });
    expect(document.querySelector(".dataset-raw-overlay-host")).not.toBeNull();
    expect(document.querySelector("form[data-dataset-records-raw]")).not.toBeNull();
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="text"]');
    expect(textarea?.value).toContain('"uid": 1');
  });
});
