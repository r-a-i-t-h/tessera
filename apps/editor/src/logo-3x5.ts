/**
 * 3×5 variant of the homepage wordmark. Same mosaic and ERA lockup as logo.ts,
 * with a smaller pixel face. Three columns keep the stem of T in the middle.
 * Each render gives the non-letter tiles a new shade. The letters stay fixed.
 */

const PITCH = 10;
const TILE = 8;
const PAD_X = 1;
const PAD_Y = 1;
const GLYPH_W = 3;
const GLYPH_H = 5;
const LETTER_GAP = 1;
/** Space between the mosaic's right edge and the E of ERA. */
const AFTER_MOSAIC = 12;

/** Deep teal for the word. Field tiles stay lighter so the letters read. */
const INK = "#00695c";

/** Tiles that sit against the letters. Kept light so the word stays clear. */
const NEAR = ["#d7f1ee", "#c5e8e3", "#b3dfd9", "#9ed3cb", "#e5f7f4", "#cfeae6"];

/** Outer band, a little deeper, so the mosaic has a varied edge. */
const RIM = ["#b2dfdb", "#8ecfc6", "#6dc4b8", "#4db6ac", "#a3d9d2", "#d0efeb", "#5eb3a8"];

/**
 * 3×5. `1` is a tile of the letter.
 * R is a bowl plus a split leg. A keeps a peak so the two stay apart.
 */
const GLYPH: Record<string, readonly string[]> = {
  T: ["111", "010", "010", "010", "010"],
  E: ["111", "100", "111", "100", "111"],
  S: ["111", "100", "111", "001", "111"],
  R: ["110", "101", "110", "101", "101"],
  A: ["010", "101", "111", "101", "101"],
};

const MOSAIC_WORD = "TESS";
const ERA = "ERA";

const WORD_COLS = MOSAIC_WORD.length * GLYPH_W + (MOSAIC_WORD.length - 1) * LETTER_GAP;
const MOSAIC_COLS = WORD_COLS + PAD_X * 2;
const MOSAIC_ROWS = GLYPH_H + PAD_Y * 2;

export type LogoTile = {
  part: "mosaic" | "era";
  ink: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

export type TesseraLogoModel = {
  tiles: LogoTile[];
  mosaic: { width: number; height: number; cols: number; rows: number };
  view: { width: number; height: number };
  pitch: number;
  tile: number;
  ink: string;
};

type Span = { col: number; row: number; w: number; h: number };

/** Widths across the single tile above and below the letters. Each list sums to the mosaic column count. */
const RIM_ROWS: { row: number; widths: readonly number[] }[] = [
  { row: 0, widths: [3, 1, 2, 1, 3, 2, 1, 2, 2] },
  { row: 6, widths: [1, 2, 3, 1, 2, 1, 3, 2, 2] },
];

/** The single column beside the letters: squares and a few upright stones. */
const SIDE_SPANS: readonly Span[] = [
  { col: 0, row: 1, w: 1, h: 2 },
  { col: 0, row: 3, w: 1, h: 1 },
  { col: 0, row: 4, w: 1, h: 2 },
  { col: 16, row: 1, w: 1, h: 1 },
  { col: 16, row: 2, w: 1, h: 2 },
  { col: 16, row: 4, w: 1, h: 2 },
];

function runsToSpans(row: number, widths: readonly number[]): Span[] {
  const spans: Span[] = [];
  let col = 0;
  for (const w of widths) {
    spans.push({ col, row, w, h: 1 });
    col += w;
  }
  return spans;
}

function rimSpans(): Span[] {
  return [...RIM_ROWS.flatMap((entry) => runsToSpans(entry.row, entry.widths)), ...SIDE_SPANS];
}

function glyphOrigin(index: number): number {
  return index * (GLYPH_W + LETTER_GAP);
}

function mosaicInk(col: number, row: number): boolean {
  if (row < PAD_Y || row >= PAD_Y + GLYPH_H) return false;
  const localRow = row - PAD_Y;
  const localCol = col - PAD_X;
  if (localCol < 0 || localCol >= WORD_COLS) return false;
  const stride = GLYPH_W + LETTER_GAP;
  const index = Math.floor(localCol / stride);
  const glyphCol = localCol % stride;
  if (glyphCol >= GLYPH_W || index >= MOSAIC_WORD.length) return false;
  const rows = GLYPH[MOSAIC_WORD[index]!];
  return rows?.[localRow]?.[glyphCol] === "1";
}

function isRim(col: number, row: number, w: number, h: number): boolean {
  const right = col + w - 1;
  const bottom = row + h - 1;
  return col === 0 || right === MOSAIC_COLS - 1 || row === 0 || bottom === MOSAIC_ROWS - 1;
}

function fieldFill(col: number, row: number, w: number, h: number, random: () => number): string {
  const palette = isRim(col, row, w, h) ? RIM : NEAR;
  const index = Math.floor(random() * palette.length) % palette.length;
  return palette[index] ?? palette[0]!;
}

function tileBox(col: number, row: number, w: number, h: number): Pick<LogoTile, "x" | "y" | "width" | "height"> {
  return {
    x: col * PITCH,
    y: row * PITCH,
    width: (w - 1) * PITCH + TILE,
    height: (h - 1) * PITCH + TILE,
  };
}

function mosaicTiles(random: () => number): LogoTile[] {
  const spans = rimSpans();
  const covered = new Set<string>();
  const tiles: LogoTile[] = [];
  const mark = (col: number, row: number, w: number, h: number) => {
    for (let y = row; y < row + h; y += 1) {
      for (let x = col; x < col + w; x += 1) covered.add(`${x},${y}`);
    }
  };
  for (const span of spans) {
    mark(span.col, span.row, span.w, span.h);
    tiles.push({
      part: "mosaic",
      ink: false,
      fill: fieldFill(span.col, span.row, span.w, span.h, random),
      ...tileBox(span.col, span.row, span.w, span.h),
    });
  }
  for (let row = 0; row < MOSAIC_ROWS; row += 1) {
    for (let col = 0; col < MOSAIC_COLS; col += 1) {
      if (covered.has(`${col},${row}`)) continue;
      const ink = mosaicInk(col, row);
      tiles.push({
        part: "mosaic",
        ink,
        fill: ink ? INK : fieldFill(col, row, 1, 1, random),
        ...tileBox(col, row, 1, 1),
      });
    }
  }
  return tiles;
}

function eraTiles(originX: number): LogoTile[] {
  const tiles: LogoTile[] = [];
  for (let index = 0; index < ERA.length; index += 1) {
    const glyph = GLYPH[ERA[index]!];
    if (!glyph) continue;
    const originCol = glyphOrigin(index);
    for (let row = 0; row < GLYPH_H; row += 1) {
      const line = glyph[row] ?? "";
      for (let col = 0; col < GLYPH_W; col += 1) {
        if (line[col] !== "1") continue;
        tiles.push({
          part: "era",
          ink: true,
          fill: INK,
          x: originX + (originCol + col) * PITCH,
          y: PAD_Y * PITCH + row * PITCH,
          width: TILE,
          height: TILE,
        });
      }
    }
  }
  return tiles;
}

export function tesseraLogo3x5Model(random: () => number = Math.random): TesseraLogoModel {
  const mosaicWidth = (MOSAIC_COLS - 1) * PITCH + TILE;
  const mosaicHeight = (MOSAIC_ROWS - 1) * PITCH + TILE;
  const era = eraTiles(mosaicWidth + AFTER_MOSAIC);
  const eraRight = era.reduce((max, tile) => Math.max(max, tile.x + tile.width), 0);
  return {
    tiles: [...mosaicTiles(random), ...era],
    mosaic: { width: mosaicWidth, height: mosaicHeight, cols: MOSAIC_COLS, rows: MOSAIC_ROWS },
    view: { width: eraRight, height: mosaicHeight },
    pitch: PITCH,
    tile: TILE,
    ink: INK,
  };
}

function rect(tile: LogoTile): string {
  const tileKind = tile.part === "era" ? "era" : tile.ink ? "ink" : "field";
  return `<rect data-tile="${tileKind}" x="${tile.x}" y="${tile.y}" width="${tile.width}" height="${tile.height}" fill="${tile.fill}"/>`;
}

export function tesseraLogo3x5Svg(): string {
  const model = tesseraLogo3x5Model();
  const mosaic = model.tiles.filter((tile) => tile.part === "mosaic").map(rect).join("");
  const era = model.tiles.filter((tile) => tile.part === "era").map(rect).join("");
  return `<svg class="tessera-logo" viewBox="0 0 ${model.view.width} ${model.view.height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g>${mosaic}</g><g>${era}</g></svg>`;
}

/** Same heading markup as the 5×7 wordmark, drawing the 3×5 face. */
export function tesseraLogo3x5(): string {
  return `<h1 class="editor-logo"><span class="editor-sr-only">Tessera</span>${tesseraLogo3x5Svg()}</h1>`;
}
