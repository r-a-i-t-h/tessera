import { describe, expect, it } from "vitest";
import { contentZones, zoneBlocks } from "./fixtures/content-zones.js";
import { recordUsesBinding } from "../src/site/binding-refs.js";

describe("recordUsesBinding", () => {
  it("finds mustache and component inserts", () => {
    expect(recordUsesBinding({ zones: contentZones("Hi {{events}}") }, "events")).toBe(true);
    expect(recordUsesBinding({ zones: { main: [{ type: "component", name: "events" }] } }, "events")).toBe(true);
    expect(recordUsesBinding({ zones: contentZones("Hi {{other}}") }, "events")).toBe(false);
  });
});
