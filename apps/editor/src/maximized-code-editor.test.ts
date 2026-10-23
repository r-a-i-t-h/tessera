// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { mountMaximizedCodeEditor, readFormText } from "./maximized-code-editor.js";

describe("maximized code editor", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("syncs document text back to the textarea on destroy", () => {
    document.body.innerHTML = `<form data-runtime-raw>
      <p class="runtime-module-editor-area"><label for="raw">Raw</label><textarea id="raw" name="text">initial</textarea></p>
    </form>`;
    const form = document.querySelector<HTMLFormElement>("form")!;
    const textarea = form.querySelector<HTMLTextAreaElement>("textarea")!;
    const editor = mountMaximizedCodeEditor(textarea, "javascript");

    expect(document.querySelector(".maximized-code-editor")).not.toBeNull();
    expect(textarea.classList.contains("maximized-code-editor-source-hidden")).toBe(true);

    editor.destroy();
    expect(textarea.classList.contains("maximized-code-editor-source-hidden")).toBe(false);
    expect(document.querySelector(".maximized-code-editor")).toBeNull();
    expect(readFormText(form)).toBe("initial");
  });
});
