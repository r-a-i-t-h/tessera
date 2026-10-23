import type { BackupList, ThemeKitInfo } from "../api.js";
import { escapeHtml, statusPanels } from "../dom.js";
import { readDataTransfer } from "./drop.js";

const BACKUP_ARCHIVE = /\.tar\.gz$/i;

function isBackupArchive(file: File): boolean {
  return BACKUP_ARCHIVE.test(file.name);
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBackupWhen(mtime: string): string {
  const when = new Date(mtime);
  if (Number.isNaN(when.getTime())) return mtime;
  return when.toLocaleString();
}

function backupCollapsible(title: string, body: string, open = false): string {
  return `<details class="w3-card w3-white editor-card editor-library-add"${open ? " open" : ""}>
    <summary>${escapeHtml(title)}</summary>
    ${body}
  </details>`;
}

export function renderBackupsPage(
  listing: BackupList,
  themes: ThemeKitInfo[],
  notice: string,
  error: string,
): string {
  const themeRows = themes.length
    ? `<ul class="w3-ul">${themes
        .map((kit) => {
          const hasDemo = kit.id === "tessera-w3-starter";
          return `<li class="editor-backup">
            <span>${escapeHtml(kit.name)}</span>
            <button type="button" class="w3-button w3-small w3-white" data-theme-apply="${escapeHtml(kit.id)}" data-theme-name="${escapeHtml(kit.name)}">Apply</button>
            ${
              hasDemo
                ? `<button type="button" class="w3-button w3-small w3-white" data-theme-apply="${escapeHtml(kit.id)}" data-theme-name="${escapeHtml(kit.name)}" data-theme-demo="true">Apply with demo</button>
            <button type="button" class="w3-button w3-small w3-white" data-theme-reset-demo="${escapeHtml(kit.id)}" data-theme-name="${escapeHtml(kit.name)}">Remove demo</button>`
                : ""
            }
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="w3-text-grey">No theme kits are available on this server.</p>`;

  const rows = listing.backups.length
    ? `<ul class="w3-ul">${listing.backups
        .map(
          (item) => `<li class="editor-backup">
            <a class="editor-backup-name" href="/api/backups/${encodeURIComponent(item.name)}">${escapeHtml(item.name)}</a>
            <time class="w3-text-grey w3-small editor-backup-when" datetime="${escapeHtml(item.mtime)}">${escapeHtml(formatBackupWhen(item.mtime))}</time>
            <span class="w3-text-grey w3-small editor-backup-size">${formatBytes(item.size)}</span>
            <span class="editor-backup-actions">
              <button type="button" class="w3-button w3-small w3-white" data-restore="${escapeHtml(item.name)}">Restore</button>
              <button type="button" class="w3-button w3-small w3-white" data-delete="${escapeHtml(item.name)}">Delete</button>
            </span>
          </li>`,
        )
        .join("")}</ul>`
    : `<p class="w3-text-grey">No backups yet.</p>`;

  const examples = listing.examples.length
    ? `<ul class="w3-ul">${listing.examples
        .map(
          (item) => `<li class="editor-backup">
            <span>${escapeHtml(item.title)}</span>
            <button type="button" class="w3-button w3-small w3-white w3-border w3-border-red" data-example="${escapeHtml(item.name)}" data-title="${escapeHtml(item.title)}">Restore</button>
          </li>`,
        )
        .join("")}</ul>`
    : `<p class="w3-text-grey">No example archives are in the backup folder yet.</p>`;

  const uploadPanel = backupCollapsible(
    "Upload archive",
    `<form id="backup-upload" data-backup-upload class="w3-padding editor-drop">
      <p class="w3-text-grey w3-small">Choose or drop a site archive (.tar.gz) from another installation.</p>
      <p><input name="file" type="file" accept=".tar.gz,application/gzip,application/x-gzip" /></p>
      <p id="backup-upload-status" class="w3-text-grey" hidden></p>
      <p><button type="submit" class="w3-button w3-theme">Upload</button></p>
    </form>`,
    true,
  );

  const themesPanel = backupCollapsible(
    "Themes",
    `<div class="w3-padding">
      <p class="w3-small w3-text-grey">Apply a design without changing your page content. A safety backup is written first.</p>
      ${themeRows}
    </div>`,
  );

  const initialisePanel = backupCollapsible(
    "Initialise",
    `<div class="w3-padding">
      <p class="w3-small w3-text-grey">Replace this site with a starter or example. Your editors stay. A safety backup is written first.</p>
      ${examples}
      <p><button type="button" class="w3-button w3-white w3-border w3-border-red" data-action="reseed">Re-seed this site</button></p>
    </div>`,
  );

  return `<h1 class="w3-large">Backups</h1>
    ${statusPanels(notice, error)}
    <p><button type="button" class="w3-button w3-theme" data-action="backup">Back up now</button></p>
    <div class="editor-library-split editor-backups">
      <section class="editor-backups-browse" aria-label="Saved backups">
        ${rows}
      </section>
      <div class="editor-library-panels">
        ${uploadPanel}
        ${themesPanel}
        ${initialisePanel}
      </div>
    </div>`;
}

function setBackupUploadStatus(form: HTMLFormElement, message: string): void {
  const status = form.querySelector<HTMLElement>("#backup-upload-status");
  if (!status) return;
  status.hidden = !message;
  status.textContent = message;
}

export function bindBackupUpload(
  root: ParentNode,
  upload: (file: File) => void | Promise<void>,
): void {
  const form = root.querySelector<HTMLFormElement>("[data-backup-upload]");
  if (!form) return;
  let incoming: Promise<{ file: File; path: string }[]> = Promise.resolve([]);
  form.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  form.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!event.dataTransfer) return;
    const read = readDataTransfer(event.dataTransfer);
    incoming = read;
    void read.then((files) => {
      if (incoming !== read) return;
      const archives = files.map((item) => item.file).filter(isBackupArchive);
      setBackupUploadStatus(
        form,
        archives.length
          ? `${archives.length === 1 ? "1 archive" : `${archives.length} archives`} ready. The first will be uploaded.`
          : "No .tar.gz archive in that drop.",
      );
    });
  });
  form.addEventListener("change", () => {
    const input = form.querySelector<HTMLInputElement>('input[name="file"]');
    const file = input?.files?.[0];
    if (!file) {
      setBackupUploadStatus(form, "");
      return;
    }
    setBackupUploadStatus(
      form,
      isBackupArchive(file) ? `${file.name} selected.` : "Choose a .tar.gz site archive.",
    );
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const read = incoming;
    incoming = Promise.resolve([]);
    void read.then(async (dropped) => {
      const input = form.querySelector<HTMLInputElement>('input[name="file"]');
      const fromInput = input?.files?.[0];
      const file =
        dropped.map((item) => item.file).find(isBackupArchive) ??
        (fromInput && isBackupArchive(fromInput) ? fromInput : undefined);
      if (!file) {
        setBackupUploadStatus(form, "Choose a .tar.gz site archive.");
        return;
      }
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (button) button.disabled = true;
      setBackupUploadStatus(form, "");
      if (input) input.value = "";
      try {
        await upload(file);
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
}
