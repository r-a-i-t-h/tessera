import { describe, expect, it } from "vitest";
import { queryOptionsFromProps } from "./dataset-present-props.js";

describe("queryOptionsFromProps", () => {
  it("parses row filters including hasValue and future", () => {
    expect(
      queryOptionsFromProps({
        dataset: "events",
        filter: [
          { field: "email", op: "hasValue" },
          { field: "when", op: "past" },
        ],
      }),
    ).toMatchObject({
      dataset: "events",
      filter: [
        { field: "email", op: "hasValue" },
        { field: "when", op: "past" },
      ],
    });
  });
});
