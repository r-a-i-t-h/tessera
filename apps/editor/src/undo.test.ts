import { describe, expect, it } from "vitest";
import { canRedo, canUndo, clearBurst, noteChange, redo, undo, undoHistory, UNDO_LIMIT } from "./undo.js";

describe("undo history", () => {
  it("undoes and redoes a document step", () => {
    const history = undoHistory("a");
    noteChange(history, "b");
    expect(canUndo(history)).toBe(true);
    expect(history.present).toBe("b");
    expect(undo(history)).toBe(true);
    expect(history.present).toBe("a");
    expect(canRedo(history)).toBe(true);
    expect(redo(history)).toBe(true);
    expect(history.present).toBe("b");
    expect(canRedo(history)).toBe(false);
  });

  it("keeps a typing visit as one step until focus leaves", () => {
    const history = undoHistory("a");
    noteChange(history, "ab", "title");
    noteChange(history, "abc", "title");
    expect(history.past).toEqual(["a"]);
    expect(history.present).toBe("abc");
    clearBurst(history);
    noteChange(history, "abcd", "title");
    expect(history.past).toEqual(["a", "abc"]);
    expect(history.present).toBe("abcd");
  });

  it("closes an open visit on undo so the next edit clears redo", () => {
    const history = undoHistory("a");
    noteChange(history, "ab", "title");
    noteChange(history, "abc", "title");
    expect(undo(history)).toBe(true);
    noteChange(history, "ab", "title");
    expect(history.past).toEqual(["a"]);
    expect(history.present).toBe("ab");
    expect(canRedo(history)).toBe(false);
  });

  it("treats a structural edit as its own step", () => {
    const history = undoHistory("a");
    noteChange(history, "ab", "body");
    noteChange(history, "abc", "body");
    noteChange(history, "xyz");
    expect(history.past).toEqual(["a", "abc"]);
    expect(history.present).toBe("xyz");
    expect(history.burst).toBeUndefined();
  });

  it("drops the oldest step past the limit", () => {
    const history = undoHistory("0");
    for (let i = 1; i <= UNDO_LIMIT + 2; i++) noteChange(history, String(i));
    expect(history.past).toHaveLength(UNDO_LIMIT);
    expect(history.past[0]).toBe("2");
    expect(history.present).toBe(String(UNDO_LIMIT + 2));
    for (let i = 0; i < UNDO_LIMIT; i++) expect(undo(history)).toBe(true);
    expect(undo(history)).toBe(false);
    expect(history.present).toBe("2");
  });

  it("ignores an unchanged document and empty directions", () => {
    const history = undoHistory("a");
    noteChange(history, "a", "title");
    expect(canUndo(history)).toBe(false);
    expect(history.burst).toBeUndefined();
    expect(undo(history)).toBe(false);
    expect(redo(history)).toBe(false);
  });
});
