import { describe, expect, it } from "vitest";
import { entryVisible } from "./entries.js";

const event = { type: "event", tags: ["hall", "music"], title: "Harvest supper" };
const page = { title: "About" };

describe("entryVisible", () => {
  it("shows every entry when the boxes are empty", () => {
    const query = { type: "", tag: "", title: "" };
    expect(entryVisible(event, query)).toBe(true);
    expect(entryVisible(page, query)).toBe(true);
  });

  it("requires type, tag, and title to match together", () => {
    expect(entryVisible(event, { type: "eve", tag: "", title: "" })).toBe(true);
    expect(entryVisible(event, { type: "event", tag: "mus", title: "harvest" })).toBe(true);
    expect(entryVisible(event, { type: "event", tag: "hall", title: "about" })).toBe(false);
    expect(entryVisible(page, { type: "event", tag: "", title: "" })).toBe(false);
  });
});
