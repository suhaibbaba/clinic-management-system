const HEADER_BYTES = 6;
const DIRECTORY_ENTRY_BYTES = 16;
const ICON_TYPE = 1;
const COLOUR_PLANES = 1;
const BITS_PER_PIXEL = 32;

/** 256 is stored as 0; the field is one byte and the format has no other way to say it. */
const MAX_DIMENSION = 256;

export interface IcoImage {
  readonly size: number;
  readonly png: Uint8Array;
}

/**
 * Packs PNGs into one `.ico`. Windows Vista and every current browser read PNG-in-ICO, so the
 * bitmaps the format was built for are not worth encoding.
 */
export function packIco(images: readonly IcoImage[]): Uint8Array<ArrayBuffer> {
  if (images.length === 0) {
    throw new Error("An .ico needs at least one image");
  }

  const oversized = images.find((image) => image.size < 1 || image.size > MAX_DIMENSION);

  if (oversized) {
    throw new Error(`An .ico entry must be 1–${MAX_DIMENSION}px, not ${oversized.size}`);
  }

  const directoryBytes = HEADER_BYTES + images.length * DIRECTORY_ENTRY_BYTES;
  const total = images.reduce((sum, image) => sum + image.png.byteLength, directoryBytes);

  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, ICON_TYPE, true);
  view.setUint16(4, images.length, true);

  let offset = directoryBytes;

  images.forEach((image, index) => {
    const entry = HEADER_BYTES + index * DIRECTORY_ENTRY_BYTES;
    const dimension = image.size === MAX_DIMENSION ? 0 : image.size;

    view.setUint8(entry, dimension);
    view.setUint8(entry + 1, dimension);
    view.setUint8(entry + 2, 0);
    view.setUint8(entry + 3, 0);
    view.setUint16(entry + 4, COLOUR_PLANES, true);
    view.setUint16(entry + 6, BITS_PER_PIXEL, true);
    view.setUint32(entry + 8, image.png.byteLength, true);
    view.setUint32(entry + 12, offset, true);

    bytes.set(image.png, offset);
    offset += image.png.byteLength;
  });

  return bytes;
}
