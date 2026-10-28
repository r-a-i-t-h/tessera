import { describe, expect, it } from "vitest";
import { authoringToZones } from "../src/site/document.js";

describe("widget zone blocks", () => {
  it("compiles widget blocks to a single text block at assemble", () => {
    const zones = authoringToZones({
      main: {
        blocks: [
          { kind: "text", heading: "", level: 2, html: "<p>Hello</p>" },
          { kind: "insert", id: "hall-gallery" },
        ],
      },
    });
    expect(zones.main).toEqual([
      {
        type: "text",
        html: expect.stringContaining("<p>Hello</p>"),
      },
    ]);
    expect(zones.main![0]!.html).toContain("{{hall-gallery}}");
  });

  it("returns empty blocks when widget list is empty", () => {
    const zones = authoringToZones({ main: { blocks: [] } });
    expect(zones.main).toEqual([]);
  });
});
