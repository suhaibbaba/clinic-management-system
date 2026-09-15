export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Below this an edge is antialiasing rather than artwork. */
const ALPHA_FLOOR = 8;

/**
 * The tightest box holding anything not fully transparent, or the whole frame when nothing is.
 * An opaque image trims to itself: only emptiness is removed, never colour.
 */
export function opaqueBounds(alpha: Uint8ClampedArray, width: number, height: number): Bounds {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((alpha[(y * width + x) * 4 + 3] ?? 0) <= ALPHA_FLOOR) {
        continue;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return maxX < 0
    ? { x: 0, y: 0, width, height }
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
