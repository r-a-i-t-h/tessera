import { describe, expect, it } from "vitest";
import { registerExtras } from "./index.js";

describe("shared component catalogue", () => {
  it("registers the complete stable set of component names", () => {
    const names: string[] = [];
    registerExtras((name) => names.push(name));
    expect(names).toEqual([
      "now",
      "pageNav",
      "eventList",
      "aboutRenderer",
      "infoCard",
      "randomCells",
      "openDaysTable",
      "datedList",
      "peopleGrid",
      "articleByline",
      "profileKicker",
      "profilePhoto",
      "profileFacts",
      "agendaList",
      "attendeeList",
    ]);
  });
});
