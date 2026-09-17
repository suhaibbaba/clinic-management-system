import { describe, expect, it } from "vitest";

import { opaqueBounds } from "@web/features/clinic/trim";

function frame(width: number, height: number, ink: readonly [number, number][], alpha = 255) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (const [x, y] of ink) {
    data[(y * width + x) * 4 + 3] = alpha;
  }

  return opaqueBounds(data, width, height);
}

describe("opaqueBounds", () => {
  // An adaptive-icon foreground is authored this way: the mark inside, padding baked around it.
  it("finds the mark inside a padded frame", () => {
    expect(
      frame(10, 10, [
        [3, 4],
        [6, 7],
      ]),
    ).toEqual({ x: 3, y: 4, width: 4, height: 4 });
  });

  it("trims an image that fills its frame to itself", () => {
    expect(
      frame(4, 4, [
        [0, 0],
        [3, 3],
      ]),
    ).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  // A JPEG has no alpha channel at all, so nothing is ever removed from one.
  it("keeps the whole frame when everything is opaque", () => {
    const ink: [number, number][] = [];

    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        ink.push([x, y]);
      }
    }

    expect(frame(3, 3, ink)).toEqual({ x: 0, y: 0, width: 3, height: 3 });
  });

  it("keeps the whole frame rather than collapsing when nothing is drawn", () => {
    expect(frame(5, 6, [])).toEqual({ x: 0, y: 0, width: 5, height: 6 });
  });

  it("reads a barely-there edge as antialiasing, not artwork", () => {
    expect(frame(6, 6, [[1, 1]], 4)).toEqual({ x: 0, y: 0, width: 6, height: 6 });
    expect(frame(6, 6, [[1, 1]], 200)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
  });
});
