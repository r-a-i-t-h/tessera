// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { tesseraLogo3x5, tesseraLogo3x5Model, type LogoTile } from "./logo-3x5.js";

function covers(tile: LogoTile, col: number, row: number, pitch: number, tileSize: number): boolean {
  const originCol = tile.x / pitch;
  const originRow = tile.y / pitch;
  const w = (tile.width - tileSize) / pitch + 1;
  const h = (tile.height - tileSize) / pitch + 1;
  return col >= originCol && col < originCol + w && row >= originRow && row < originRow + h;
}

describe("tessera logo 3×5", () => {
  const model = tesseraLogo3x5Model({ mosaicFace: "tess" });
  const mosaic = model.tiles.filter((tile) => tile.part === "mosaic");
  const era = model.tiles.filter((tile) => tile.part === "era");

  function mosaicAt(col: number, row: number): LogoTile | undefined {
    return mosaic.find((tile) => covers(tile, col, row, model.pitch, model.tile));
  }

  function eraOn(col: number, row: number): boolean {
    const originX = Math.min(...era.map((tile) => tile.x));
    const originY = Math.min(...era.map((tile) => tile.y));
    return era.some(
      (tile) => tile.x === originX + col * model.pitch && tile.y === originY + row * model.pitch,
    );
  }

  it("names the heading Tessera", () => {
    document.body.innerHTML = tesseraLogo3x5();
    expect(document.querySelector("h1")?.textContent).toBe("Tessera");
    expect(document.querySelectorAll("svg rect")).toHaveLength(model.tiles.length);
  });

  it("fills the mosaic once and keeps letter tiles square", () => {
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
    expect(model.mosaic.cols).toBe(17);
    expect(model.mosaic.rows).toBe(7);
    expect(seen.size).toBe(17 * 7);
    expect([...seen.values()].every((count) => count === 1)).toBe(true);
    expect(mosaic.filter((tile) => tile.ink).every((tile) => tile.width === tile.height)).toBe(true);
  });

  it("centers the stem of T and aligns ERA with those letters", () => {
    expect(mosaicAt(1, 1)?.ink).toBe(true);
    expect(mosaicAt(3, 1)?.ink).toBe(true);
    expect(mosaicAt(1, 2)?.ink).toBe(false);
    expect(mosaicAt(2, 2)?.ink).toBe(true);
    expect(mosaicAt(3, 2)?.ink).toBe(false);
    expect(mosaicAt(0, 1)?.ink).toBe(false);
    expect(mosaicAt(16, 1)?.ink).toBe(false);

    const letterTiles = mosaic.filter((tile) => tile.ink);
    expect(Math.min(...era.map((tile) => tile.y))).toBe(Math.min(...letterTiles.map((tile) => tile.y)));
    expect(Math.max(...era.map((tile) => tile.y + tile.height))).toBe(
      Math.max(...letterTiles.map((tile) => tile.y + tile.height)),
    );
    expect(Math.min(...era.map((tile) => tile.x))).toBeGreaterThan(model.mosaic.width);

    // R sits on columns 4–6: a bowl, then a stem and a right leg. A peaks on column 9.
    expect([0, 1, 2, 3, 4].map((row) => [4, 5, 6].map((col) => (eraOn(col, row) ? "1" : "0")).join(""))).toEqual([
      "110",
      "101",
      "110",
      "101",
      "101",
    ]);
    expect(eraOn(8, 0)).toBe(false);
    expect(eraOn(9, 0)).toBe(true);
    expect(eraOn(10, 0)).toBe(false);
  });

  it("gives the field tiles a new shade each render and keeps the letters", () => {
    const letters = (model: ReturnType<typeof tesseraLogo3x5Model>) =>
      model.tiles.filter((tile) => tile.ink).map((tile) => `${tile.part}:${tile.x},${tile.y},${tile.fill}`);
    const field = (model: ReturnType<typeof tesseraLogo3x5Model>) =>
      model.tiles.filter((tile) => tile.part === "mosaic" && !tile.ink).map((tile) => tile.fill);
    const pale = tesseraLogo3x5Model({ random: () => 0, mosaicFace: "tess" });
    const deep = tesseraLogo3x5Model({ random: () => 0.999, mosaicFace: "tess" });
    expect(field(pale)).not.toEqual(field(deep));
    expect(letters(pale)).toEqual(letters(deep));
    expect(field(pale).every((fill) => fill !== pale.ink)).toBe(true);
    expect(field(deep).every((fill) => fill !== deep.ink)).toBe(true);
  });

  it("can spell 733S in the mosaic while ERA keeps a normal E", () => {
    const leet = tesseraLogo3x5Model({ mosaicFace: "733s" });
    const mosaic733 = leet.tiles.filter((tile) => tile.part === "mosaic");
    const era733 = leet.tiles.filter((tile) => tile.part === "era");

    function at(col: number, row: number): LogoTile | undefined {
      return mosaic733.find((tile) => covers(tile, col, row, leet.pitch, leet.tile));
    }

    // 7: full top, stem on the right column.
    expect(at(1, 1)?.ink).toBe(true);
    expect(at(2, 1)?.ink).toBe(true);
    expect(at(3, 1)?.ink).toBe(true);
    expect(at(2, 2)?.ink).toBe(false);
    expect(at(3, 2)?.ink).toBe(true);

    // 3: middle bar on the second letter.
    expect(at(5, 1)?.ink).toBe(true);
    expect(at(6, 1)?.ink).toBe(true);
    expect(at(7, 1)?.ink).toBe(true);
    expect(at(5, 3)?.ink).toBe(true);
    expect(at(6, 3)?.ink).toBe(true);
    expect(at(7, 3)?.ink).toBe(true);

    const tess = tesseraLogo3x5Model({ mosaicFace: "tess" });
    const eraTess = tess.tiles.filter((tile) => tile.part === "era");
    expect(era733.map((tile) => `${tile.x},${tile.y}`)).toEqual(eraTess.map((tile) => `${tile.x},${tile.y}`));
  });
});
