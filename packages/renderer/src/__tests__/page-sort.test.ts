import type { Page } from "@r-a-i-t-h/tessera-model";
import { describe, expect, it } from "vitest";
import { sortSubpageSiblings } from "../page-sort.js";

function page(id: string, title: string, date?: string): Page {
  return {
    id,
    title,
    ...(date !== undefined ? { fields: { date } } : {}),
    zones: {},
  };
}

describe("sortSubpageSiblings", () => {
  it("sorts by title A–Z when no sibling has a date", () => {
    const sorted = sortSubpageSiblings([
      page("z", "Zebra"),
      page("a", "Alpha"),
      page("m", "Middle"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["a", "m", "z"]);
  });

  it("sorts by date newest first when any sibling has a date", () => {
    const sorted = sortSubpageSiblings([
      page("old", "Old", "2026-01-01"),
      page("new", "New", "2026-03-01"),
      page("mid", "Mid", "2026-02-01"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["new", "mid", "old"]);
  });

  it("puts undated siblings last when date mode is active", () => {
    const sorted = sortSubpageSiblings([
      page("plain", "Plain"),
      page("b", "B", "2026-02-01"),
      page("a", "A", "2026-03-01"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["a", "b", "plain"]);
  });
});
