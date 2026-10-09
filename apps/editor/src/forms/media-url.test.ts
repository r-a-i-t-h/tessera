import { describe, expect, it } from "vitest";
import { editorMediaHtml, editorMediaSrc } from "./media-url.js";

describe("editor media addresses", () => {
  it("points a published media path at the preview", () => {
    expect(editorMediaSrc("./media/porch.svg")).toBe("/preview/media/porch.svg");
    expect(editorMediaSrc(" https://example.test/a.png ")).toBe("https://example.test/a.png");
    expect(editorMediaSrc("/preview/media/porch.svg")).toBe("/preview/media/porch.svg");
  });

  it("rewrites image and document addresses in displayed markup", () => {
    expect(editorMediaHtml(`<img src="./media/porch.svg" alt="Porch" />`)).toBe(
      `<img src="/preview/media/porch.svg" alt="Porch" />`,
    );
    expect(editorMediaHtml(`<a href='./media/notes.pdf'>Notes</a>`)).toBe(
      `<a href='/preview/media/notes.pdf'>Notes</a>`,
    );
  });
});
