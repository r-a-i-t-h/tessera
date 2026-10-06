// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRecord, type CreateRecordOptions } from "./create-record.js";

describe("record creation orchestration", () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    document.body.innerHTML = `<form><input id="record-id" value=" article " /><button type="submit">Create</button></form>`;
    form = document.querySelector("form")!;
  });

  function options(overrides: Partial<CreateRecordOptions> = {}): CreateRecordOptions {
    return {
      kind: "templates",
      form,
      idField: "#record-id",
      existingIds: [],
      validateId: () => undefined,
      buildBody: (id) => ({ id }),
      save: vi.fn().mockResolvedValue({ ok: true }),
      destinationMode: "compose",
      destinationHash: (id) => `#/templates/${id}`,
      successMessage: (id) => `Created ${id}.`,
      failureMessage: "Could not create the template.",
      showError: vi.fn(),
      navigate: vi.fn(),
      ...overrides,
    };
  }

  it("validates, saves the trimmed id, and navigates with a notice", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const navigate = vi.fn();
    await createRecord(options({ save, navigate }));

    expect(save).toHaveBeenCalledWith("templates", "article", { id: "article" });
    expect(navigate).toHaveBeenCalledWith({
      hash: "#/templates/article",
      mode: "compose",
      notice: "Created article.",
    });
    expect(form.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
  });

  it("shows tailored validation without starting a save", async () => {
    const save = vi.fn();
    const showError = vi.fn();
    await createRecord(options({
      validateId: () => "That template already exists.",
      save,
      showError,
    }));

    expect(showError).toHaveBeenCalledWith(form, "That template already exists.");
    expect(save).not.toHaveBeenCalled();
    expect(form.querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
  });

  it("re-enables the submit button after a save error", async () => {
    const showError = vi.fn();
    await createRecord(options({
      save: vi.fn().mockRejectedValue(new Error("Disk full")),
      showError,
    }));

    expect(showError).toHaveBeenCalledWith(form, "Disk full");
    expect(form.querySelector<HTMLButtonElement>("button")?.disabled).toBe(false);
  });

  it("allows a post-save hook to report partial success", async () => {
    const navigate = vi.fn();
    await createRecord(options({
      afterSave: (_id, notice) => `${notice} Sidebar update failed.`,
      navigate,
    }));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
      notice: "Created article. Sidebar update failed.",
    }));
  });
});
