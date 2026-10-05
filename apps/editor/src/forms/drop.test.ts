import { describe, expect, it } from "vitest";
import { readDataTransfer, type DropSource } from "./drop.js";

function fileEntry(name: string): {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (cb: (file: File) => void) => void;
  createReader: () => never;
} {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file(cb) {
      cb(new File(["x"], name, { type: "image/png" }));
    },
    createReader() {
      throw new Error("not a directory");
    },
  };
}

/** Models a drop whose items go blank once the event handler returns. */
function expiringFiles(names: string[]): { source: DropSource; expire: () => void } {
  let live = true;
  const items = names.map((name) => ({
    kind: "file",
    webkitGetAsEntry() {
      return live ? fileEntry(name) : null;
    },
    getAsFile() {
      return live ? new File(["x"], name, { type: "image/png" }) : null;
    },
  }));
  return { source: { items }, expire: () => { live = false; } };
}

describe("readDataTransfer", () => {
  it("keeps every file from a drop, including ones that expire after the event", async () => {
    const { source, expire } = expiringFiles(["one.png", "two.png", "three.png"]);
    const pending = readDataTransfer(source);
    expire();
    const files = await pending;
    expect(files.map((item) => item.path)).toEqual(["one.png", "two.png", "three.png"]);
  });

  it("reads a fallback file list before the drop expires", async () => {
    let live = true;
    const source: DropSource = {
      items: ["a.pdf", "b.pdf"].map((name) => ({
        kind: "file",
        getAsFile() {
          return live ? new File(["%PDF"], name, { type: "application/pdf" }) : null;
        },
      })),
    };
    const pending = readDataTransfer(source);
    live = false;
    const files = await pending;
    expect(files.map((item) => item.path)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("walks a dropped folder across every readEntries batch", async () => {
    const porch = fileEntry("porch.png");
    const notes = fileEntry("notes.pdf");
    let calls = 0;
    const source: DropSource = {
      items: [
        {
          kind: "file",
          webkitGetAsEntry: () => ({
            isFile: false,
            isDirectory: true,
            name: "hall",
            file() {
              throw new Error("not a file");
            },
            createReader: () => ({
              readEntries(cb: (entries: unknown[]) => void) {
                calls += 1;
                if (calls === 1) cb([porch]);
                else if (calls === 2) cb([notes]);
                else cb([]);
              },
            }),
          }),
        },
      ],
    };
    const files = await readDataTransfer(source);
    expect(files.map((item) => item.path)).toEqual(["hall/porch.png", "hall/notes.pdf"]);
  });
});
