import { describe, expect, it } from "vitest";
import { recordUsesBinding } from "../src/site/binding-refs.js";

describe("recordUsesBinding", () => {
  it("finds mustache and component inserts", () => {
    expect(recordUsesBinding({ zones: { main: { html: "Hi {{events}}" } } }, "events")).toBe(true);
    expect(recordUsesBinding({ zones: { main: [{ type: "component", name: "events" }] } }, "events")).toBe(true);
    expect(recordUsesBinding({ zones: { main: { html: "Hi {{other}}" } } }, "events")).toBe(false);
  });
});
