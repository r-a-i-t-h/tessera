import { describe, expect, it } from "vitest";
import { rewriteLibraryFolderRefs } from "../src/site/library-folder-refs.js";

describe("rewriteLibraryFolderRefs", () => {
  it("rewrites compose gallery sections and binding props", () => {
    const tree = {
      zones: {
        main: {
          sections: [{ kind: "gallery", folder: "hall-gallery", mode: "grid" }],
        },
      },
    };
    const binding = {
      id: "g",
      component: "gallery",
      props: { folders: ["hall-gallery", "other"], folder: "hall-gallery" },
    };
    const treeResult = rewriteLibraryFolderRefs(tree, "hall-gallery", "gallery-hall");
    expect(treeResult.changed).toBe(true);
    expect(treeResult.value).toEqual({
      zones: {
        main: {
          sections: [{ kind: "gallery", folder: "gallery-hall", mode: "grid" }],
        },
      },
    });
    const bindingResult = rewriteLibraryFolderRefs(binding, "hall-gallery", "gallery-hall");
    expect(bindingResult.changed).toBe(true);
    expect(bindingResult.value).toMatchObject({
      props: { folders: ["gallery-hall", "other"], folder: "gallery-hall" },
    });
  });

  it("leaves unrelated values unchanged", () => {
    const input = { kind: "text", html: "<p>Hi</p>" };
    expect(rewriteLibraryFolderRefs(input, "a", "b")).toEqual({ value: input, changed: false });
  });
});
