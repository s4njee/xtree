/**
 * A small 5×7 bitmap font for the ASCII effect, packed into a strip of 6×8
 * tiles (one column and one row of spacing). Tiles are ordered from least
 * to most ink: the ten-step ramp " .:-=+*#%@", then "0" and "1".
 */
const glyphs: Readonly<Record<string, readonly string[]>> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '%': ['##..#', '##.#.', '..#..', '.#...', '#..##', '...##', '#.###'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
};

/** Characters in atlas order. */
export const fontCharacters = ' .:-=+*#%@01';

/** Tile size in texels. */
export const tileWidth = 6;
export const tileHeight = 8;

let cached: Uint8Array | undefined;

/** RGBA texels of the font strip, rows from the bottom; ink is white. */
export function fontTexels(): Uint8Array {
  if (cached) return cached;
  const width = tileWidth * fontCharacters.length;
  const data = new Uint8Array(width * tileHeight * 4);
  [...fontCharacters].forEach((char, index) => {
    glyphs[char]!.forEach((row, y) => {
      [...row].forEach((pixel, x) => {
        if (pixel !== '#') return;
        // Glyph row 0 is the top; the texture starts at the bottom, leaving the bottom row as spacing.
        const texel =
          ((tileHeight - 1 - y) * width + index * tileWidth + x) * 4;
        data.fill(255, texel, texel + 4);
      });
    });
  });
  cached = data;
  return data;
}
