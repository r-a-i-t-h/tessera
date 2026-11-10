// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { openComposeAddDialog } from "./compose-add-dialog.js";

describe("openComposeAddDialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("calls onPick with palette kind and closes", () => {
    const onPick = vi.fn();
    openComposeAddDialog({ onPick });
    const textBtn = document.body.querySelector<HTMLButtonElement>('[data-palette="text"]');
    expect(textBtn).not.toBeNull();
    textBtn?.click();
    expect(onPick).toHaveBeenCalledWith("text");
    expect(document.body.querySelector(".editor-compose-add-host")).toBeNull();
  });
});
