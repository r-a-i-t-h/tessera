// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { bindBackupUpload, renderBackupsPage } from "./backups.js";

describe("backups page", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders saved backups on the left and collapsible panels on the right", () => {
    const html = renderBackupsPage(
      {
        ok: true,
        directory: "/backup",
        backups: [{ name: "2026.tar.gz", size: 1024, mtime: "2026-01-01T15:30:00.000Z" }],
        examples: [],
      },
      [{ id: "tessera-w3-starter", name: "Starter" }],
      "",
      "",
    );
    expect(html).toContain("editor-library-split");
    expect(html).toContain("data-backup-upload");
    expect(html).toContain("editor-drop");
    expect(html).toContain("<summary>Upload archive</summary>");
    expect(html).toContain("<summary>Themes</summary>");
    expect(html).toContain("<summary>Initialise</summary>");
    expect(html).toContain('data-action="reseed"');
    expect(html).toContain("No example archives are in the backup folder yet.");
    expect(html).not.toContain("<h2");
    expect(html).toContain('datetime="2026-01-01T15:30:00.000Z"');
    expect(html).toContain("editor-backup-when");
  });

  it("uploads a file chosen in the form", async () => {
    const uploaded: File[] = [];
    document.body.innerHTML = renderBackupsPage(
      { ok: true, directory: "/backup", backups: [], examples: [] },
      [],
      "",
      "",
    );
    bindBackupUpload(document.body, (file) => {
      uploaded.push(file);
    });
    const form = document.querySelector<HTMLFormElement>("[data-backup-upload]")!;
    const input = form.querySelector<HTMLInputElement>('input[name="file"]')!;
    const file = new File(["archive"], "site.tar.gz", { type: "application/gzip" });
    Object.defineProperty(input, "files", { value: [file] });
    form.requestSubmit();
    await Promise.resolve();
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]?.name).toBe("site.tar.gz");
  });
});
