/**
 * @vitest-environment node
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname);

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...walkTs(path));
      continue;
    }
    if (name.endsWith(".ts") && !name.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

describe("no native confirm in editor src", () => {
  it("does not call window.confirm or bare confirm(", () => {
    const offenders: string[] = [];
    for (const file of walkTs(SRC)) {
      if (file.endsWith("confirm-dialog.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (/\bwindow\.confirm\s*\(/.test(text)) offenders.push(file);
      if (/(?<![.\w])confirm\s*\(/.test(text)) offenders.push(file);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
