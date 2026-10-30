import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../src/site/paths.js";
import {
  parseShellStylesheetLinks,
  stylesheetsFromShell,
  themeFileFromShell,
} from "../src/site/shell-stylesheets.js";

describe("shell stylesheet parsing", () => {
  it("preserves the starter shell stylesheet order and ignores other links", async () => {
    const shell = await readFile(
      join(repoRoot, "apps", "editor-api", "seed", "themes", "tessera-w3-starter", "shell", "index.html"),
      "utf8",
    );
    expect(parseShellStylesheetLinks(shell)).toEqual([
      "./skin/w3.css",
      "./skin/w3-theme-teal.css",
      "./skin/tessera.css",
      "./skin/microapps.css",
      "./site.css",
      "./local.css",
      "https://fonts.googleapis.com/css?family=Lekton|Roboto|Orbitron|Thasadith",
    ]);
  });

  it("finds a linked theme and falls back to page defaults when no stylesheets exist", () => {
    const shell = `<link href="./skin/w3-theme-teal.css" rel="stylesheet"><link rel="icon" href="x.svg">`;
    expect(themeFileFromShell(shell)).toBe("w3-theme-teal.css");
    expect(stylesheetsFromShell("<html></html>")).toEqual([
      "./skin/w3.css",
      "./skin/tessera.css",
      "./skin/microapps.css",
      "./site.css",
      "./local.css",
    ]);
  });
});
