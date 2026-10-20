// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { tesseraLogo, tesseraLogoModel, type LogoTile } from "./logo.js";

function covers(tile: LogoTile, col: number, row: number, pitch: number, tileSize: number): boolean {
  const originCol = tile.x / pitch;
  const originRow = tile.y / pitch;
  const w = (tile.width - tileSize) / pitch + 1;
  const h = (tile.height - tileSize) / pitch + 1;
  return col >= originCol && col < originCol + w && row >= originRow && row < originRow + h;
}

describe("tessera logo", () => {
  const model = tesseraLogoModel();
  const mosaic = model.tiles.filter((tile) => tile.part === "mosaic");
  const era = model.tiles.filter((tile) => tile.part === "era");

  function mosaicAt(col: number, row: number): LogoTile | undefined {
    return mosaic.find((tile) => covers(tile, col, row, model.pitch, model.tile));
  }

  it("names the homepage heading Tessera and draws the wordmark", () => {
    document.body.innerHTML = tesseraLogo();
    const heading = document.querySelector("h1");
    expect(heading?.textContent).toBe("Tessera");
    expect(heading?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelectorAll("svg rect")).toHaveLength(model.tiles.length);
  });

  it("fills the mosaic rectangle once, with square letter tiles and some longer stones", () => {
    const seen = new Map<string, number>();
    for (const tile of mosaic) {
      const originCol = tile.x / model.pitch;
      const originRow = tile.y / model.pitch;
      const w = (tile.width - model.tile) / model.pitch + 1;
      const h = (tile.height - model.tile) / model.pitch + 1;
      for (let row = originRow; row < originRow + h; row += 1) {
        for (let col = originCol; col < originCol + w; col += 1) {
          const key = `${col},${row}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
      }
    }
    expect(seen.size).toBe(model.mosaic.cols * model.mosaic.rows);
    expect([...seen.values()].every((count) => count === 1)).toBe(true);
    expect(mosaic.some((tile) => tile.width !== tile.height)).toBe(true);
    expect(mosaic.filter((tile) => tile.ink).every((tile) => tile.width === model.tile && tile.fill === model.ink)).toBe(true);
    expect(mosaic.filter((tile) => !tile.ink).every((tile) => tile.fill !== model.ink)).toBe(true);
  });

  it("picks TESS out of the mosaic and sets ERA in the same face beside it", () => {
    // Top of T is a full bar; the stem sits in the middle of the next row.
    expect(mosaicAt(2, 2)?.ink).toBe(true);
    expect(mosaicAt(6, 2)?.ink).toBe(true);
    expect(mosaicAt(3, 3)?.ink).toBe(false);
    expect(mosaicAt(4, 3)?.ink).toBe(true);
    expect(mosaicAt(5, 3)?.ink).toBe(false);

    const letterTiles = mosaic.filter((tile) => tile.ink);
    const eraTop = Math.min(...era.map((tile) => tile.y));
    const letterTop = Math.min(...letterTiles.map((tile) => tile.y));
    const eraBottom = Math.max(...era.map((tile) => tile.y + tile.height));
    const letterBottom = Math.max(...letterTiles.map((tile) => tile.y + tile.height));
    expect(era.length).toBeGreaterThan(0);
    expect(era.every((tile) => tile.width === model.tile && tile.height === model.tile && tile.fill === model.ink)).toBe(true);
    expect(eraTop).toBe(letterTop);
    expect(eraBottom).toBe(letterBottom);
    expect(Math.min(...era.map((tile) => tile.x))).toBeGreaterThan(model.mosaic.width);
  });
});
