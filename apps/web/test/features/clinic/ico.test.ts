import { describe, expect, it } from "vitest";
import { packIco } from "@web/features/clinic/ico";

const png = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);

const read = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

describe("packIco", () => {
  it("writes the directory header the format expects", () => {
    const view = read(packIco([{ size: 16, png: png(10, 1) }]));

    expect(view.getUint16(0, true)).toBe(0);
    expect(view.getUint16(2, true)).toBe(1);
    expect(view.getUint16(4, true)).toBe(1);
  });

  it("points every entry at its own bytes", () => {
    const images = [
      { size: 16, png: png(10, 1) },
      { size: 32, png: png(20, 2) },
      { size: 48, png: png(30, 3) },
    ];

    const packed = packIco(images);
    const view = read(packed);

    images.forEach((image, index) => {
      const entry = 6 + index * 16;

      expect(view.getUint8(entry)).toBe(image.size);
      expect(view.getUint8(entry + 1)).toBe(image.size);
      expect(view.getUint16(entry + 4, true)).toBe(1);
      expect(view.getUint16(entry + 6, true)).toBe(32);

      const length = view.getUint32(entry + 8, true);
      const offset = view.getUint32(entry + 12, true);

      expect(length).toBe(image.png.byteLength);
      expect([...packed.slice(offset, offset + length)]).toEqual([...image.png]);
    });

    expect(packed.byteLength).toBe(6 + 3 * 16 + 60);
  });

  it("stores 256 as zero, which is the only way the byte can say it", () => {
    const view = read(packIco([{ size: 256, png: png(4, 7) }]));

    expect(view.getUint8(6)).toBe(0);
    expect(view.getUint8(7)).toBe(0);
  });

  it("refuses a size the directory cannot describe", () => {
    expect(() => packIco([{ size: 512, png: png(4, 7) }])).toThrow(/1–256px/);
  });

  it("refuses an empty set", () => {
    expect(() => packIco([])).toThrow(/at least one image/);
  });
});
