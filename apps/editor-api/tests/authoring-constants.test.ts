import { describe, expect, it } from "vitest";
import {
  AUTHORING_SCHEMA_LEGACY_MAX,
  AUTHORING_SCHEMA_TARGET,
  INSERT_WIDGET_COMPILE,
} from "../src/site/authoring-constants.js";

describe("authoring schema constants", () => {
  it("targets the next version after legacy html zones", () => {
    expect(AUTHORING_SCHEMA_TARGET).toBe(AUTHORING_SCHEMA_LEGACY_MAX + 1);
  });

  it("documents insert compile as mustache in compiled html", () => {
    expect(INSERT_WIDGET_COMPILE).toBe("mustache-in-text-html");
  });
});
