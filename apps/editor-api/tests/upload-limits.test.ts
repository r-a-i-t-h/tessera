import { describe, expect, it } from "vitest";
import {
  DEFAULT_UPLOAD_LIMITS,
  mergeUploadLimits,
} from "../src/config/upload-limits.js";

describe("upload limits", () => {
  it("uses defaults, environment values, and explicit overrides in that order", () => {
    expect(mergeUploadLimits(undefined, {})).toEqual(DEFAULT_UPLOAD_LIMITS);
    expect(mergeUploadLimits(undefined, {
      TESSERA_UPLOAD_MAX_FILE_BYTES: "10",
      TESSERA_UPLOAD_MAX_FILES: "2",
      TESSERA_UPLOAD_MAX_TOTAL_BYTES: "30",
    })).toEqual({
      maxFileBytes: 10,
      maxFiles: 2,
      maxTotalBytes: 30,
    });
    expect(mergeUploadLimits({ maxFiles: 4 }, {
      TESSERA_UPLOAD_MAX_FILES: "2",
    }).maxFiles).toBe(4);
  });

  it("rejects invalid environment values", () => {
    expect(() => mergeUploadLimits(undefined, {
      TESSERA_UPLOAD_MAX_FILES: "unlimited",
    })).toThrow(/positive integer/);
  });
});
