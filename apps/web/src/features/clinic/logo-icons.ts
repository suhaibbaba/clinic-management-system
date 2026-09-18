import { CLINIC_FAVICON_SIZES, CLINIC_ICONS } from "@clinic/shared";
import { opaqueBounds, type Bounds } from "@web/features/clinic/trim";
import { packIco } from "@web/features/clinic/ico";

// Android crops a maskable icon to a circle or a squircle, and the guaranteed region is a circle
// of 80% of the width — so the whole picture has to fit that circle, diagonal included.
const MASKABLE_INSET = 0.1;

/** iOS composites a transparent home-screen icon onto black, so this one is filled and inset. */
const APPLE_INSET = 0.08;

/** Big enough to place an edge within a pixel of the full-size one, small enough to scan cheaply. */
const TRIM_SCAN_SIZE = 256;

export type ClinicIconSet = ReadonlyMap<string, Blob>;

/** Renders the tab mark and the home-screen icons from whichever picture the icons come from. */
export async function buildClinicIconSet(file: Blob): Promise<ClinicIconSet> {
  const source = await createImageBitmap(file);

  try {
    const content = crop(source, trimmedBounds(source));
    const paper = paperColour();
    const set = new Map<string, Blob>();

    for (const icon of CLINIC_ICONS) {
      if (icon.name === "favicon.ico") {
        continue;
      }

      const maskable = icon.purpose === "maskable";
      const apple = icon.name === "apple-touch-icon.png";

      set.set(
        icon.name,
        await render(content, icon.size, {
          inset: maskable ? MASKABLE_INSET : apple ? APPLE_INSET : 0,
          background: maskable || apple ? paper : null,
          fit: maskable ? "circle" : "box",
        }),
      );
    }

    const frames = await Promise.all(
      CLINIC_FAVICON_SIZES.map(async (size) => ({
        size,
        png: new Uint8Array(
          await (
            await render(content, size, { inset: 0, background: null, fit: "box" })
          ).arrayBuffer(),
        ),
      })),
    );

    set.set("favicon.ico", new Blob([packIco(frames)], { type: "image/x-icon" }));

    return set;
  } finally {
    source.close();
  }
}

async function render(
  content: HTMLCanvasElement,
  size: number,
  options: {
    readonly inset: number;
    readonly background: string | null;
    readonly fit: "box" | "circle";
  },
): Promise<Blob> {
  const canvas = surface(size, size);
  const context = context2d(canvas);

  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, size, size);
  }

  const safe = size * (1 - options.inset * 2);
  const scale =
    options.fit === "circle"
      ? safe / Math.hypot(content.width, content.height)
      : Math.min(safe / content.width, safe / content.height);

  const width = Math.max(1, Math.round(content.width * scale));
  const height = Math.max(1, Math.round(content.height * scale));

  context.drawImage(
    stepDown(content, width, height),
    (size - width) / 2,
    (size - height) / 2,
    width,
    height,
  );

  return toBlob(canvas);
}

// Chrome samples too few source pixels when `drawImage` is asked to shrink by more than half in
// one go, which turns a thin line into hard blocks. Halving keeps every source pixel in the average.
function stepDown(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  let current = source;

  while (current.width >= width * 2 && current.height >= height * 2) {
    const next = surface(
      Math.max(1, Math.floor(current.width / 2)),
      Math.max(1, Math.floor(current.height / 2)),
    );

    context2d(next).drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }

  return current;
}

function crop(source: ImageBitmap, bounds: Bounds): HTMLCanvasElement {
  const canvas = surface(bounds.width, bounds.height);

  context2d(canvas).drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  return canvas;
}

// An adaptive-icon foreground carries its safe-zone padding baked in, and a wordmark exported from
// a design tool carries its artboard margin. Fitting the frame would keep both and shrink the ink.
function trimmedBounds(source: ImageBitmap): Bounds {
  const whole = { x: 0, y: 0, width: source.width, height: source.height };
  const scale = Math.min(1, TRIM_SCAN_SIZE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = surface(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return whole;
  }

  context.drawImage(source, 0, 0, width, height);

  const scanned = opaqueBounds(context.getImageData(0, 0, width, height).data, width, height);
  // One scanned pixel of slack each way, so a soft edge is not shaved off by the downscale.
  const pad = 1 / scale;

  const x = Math.max(0, Math.floor(scanned.x / scale - pad));
  const y = Math.max(0, Math.floor(scanned.y / scale - pad));

  return {
    x,
    y,
    width: Math.min(source.width - x, Math.ceil(scanned.width / scale + pad * 2)),
    height: Math.min(source.height - y, Math.ceil(scanned.height / scale + pad * 2)),
  };
}

function surface(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser cannot render the clinic icons");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  return context;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The icon could not be encoded"))),
      "image/png",
    );
  });
}

// A baked icon outlives the theme it was generated under and is drawn by the OS, not the app, so
// it takes the one surface that does not follow dark mode: the printed sheet's.
function paperColour(): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim();

  return value === "" ? null : value;
}
