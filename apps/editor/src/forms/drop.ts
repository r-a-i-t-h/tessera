export type DroppedFile = { file: File; path: string };

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (cb: (file: File) => void) => void;
  createReader: () => { readEntries: (cb: (entries: FsEntry[]) => void) => void };
};

type DropItem = {
  kind: string;
  webkitGetAsEntry?: () => unknown;
  getAsFile?: () => File | null;
};

export type DropSource = {
  items: ArrayLike<DropItem> | Iterable<DropItem>;
};

/**
 * File items on a drop are only readable during the drop event itself.
 * `webkitGetAsEntry` and `getAsFile` must run for every item before the
 * first await, or the browser returns nothing after the first file.
 */
export async function readDataTransfer(transfer: DropSource): Promise<DroppedFile[]> {
  const queued: { entry: FsEntry | null; file: File | null }[] = [];
  for (const item of Array.from(transfer.items)) {
    const entry = asEntry(item.webkitGetAsEntry?.() ?? null);
    if (entry) {
      queued.push({ entry, file: null });
      continue;
    }
    if (item.kind === "file") {
      const file = item.getAsFile?.() ?? null;
      if (file) queued.push({ entry: null, file });
    }
  }
  const out: DroppedFile[] = [];
  for (const item of queued) {
    if (item.entry) await walkEntry(item.entry, "", out);
    else if (item.file) out.push({ file: item.file, path: item.file.name });
  }
  return out;
}

function asEntry(value: unknown): FsEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as FsEntry;
  if (typeof entry.name !== "string") return null;
  if (entry.isFile !== true && entry.isDirectory !== true) return null;
  return entry;
}

async function walkEntry(entry: FsEntry, prefix: string, out: DroppedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) => entry.file(resolve));
    out.push({ file, path: `${prefix}${file.name}` });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  const children = await readAllEntries(reader);
  for (const child of children) await walkEntry(child, `${prefix}${entry.name}/`, out);
}

/** `readEntries` returns one batch and must be called until that batch is empty. */
async function readAllEntries(reader: { readEntries: (cb: (entries: FsEntry[]) => void) => void }): Promise<FsEntry[]> {
  const all: FsEntry[] = [];
  for (;;) {
    const batch = await new Promise<FsEntry[]>((resolve) => reader.readEntries(resolve));
    if (batch.length === 0) break;
    all.push(...batch);
  }
  return all;
}
