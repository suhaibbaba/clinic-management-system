import { CLINIC_FAVICON_SIZES, CLINIC_ICONS } from '@clinic/shared';

import { packIco } from '@web/features/clinic/ico';

/** Android crops a maskable icon to a circle or a squircle; only the central 80% always survives. */
const MASKABLE_INSET = 0.1;

/** iOS composites a transparent home-screen icon onto black, so this one is filled and inset. */
const APPLE_INSET = 0.08;

export type ClinicIconSet = ReadonlyMap<string, Blob>;

/** Renders the tab mark and the home-screen icons from the logo the admin just picked. */
export async function buildClinicIconSet(file: File): Promise<ClinicIconSet> {
  const source = await createImageBitmap(file);

  try {
    const paper = paperColour();
    const set = new Map<string, Blob>();

    for (const icon of CLINIC_ICONS) {
      if (icon.name === 'favicon.ico') {
        continue;
      }

      const maskable = icon.purpose === 'maskable';
      const apple = icon.name === 'apple-touch-icon.png';

      set.set(
        icon.name,
        await render(source, icon.size, {
          inset: maskable ? MASKABLE_INSET : apple ? APPLE_INSET : 0,
          background: maskable || apple ? paper : null,
        }),
      );
    }

    const frames = await Promise.all(
      CLINIC_FAVICON_SIZES.map(async (size) => ({
        size,
        png: new Uint8Array(
          await (await render(source, size, { inset: 0, background: null })).arrayBuffer(),
        ),
      })),
    );

    set.set('favicon.ico', new Blob([packIco(frames)], { type: 'image/x-icon' }));

    return set;
  } finally {
    source.close();
  }
}

async function render(
  source: ImageBitmap,
  size: number,
  options: { readonly inset: number; readonly background: string | null },
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('This browser cannot render the clinic icons');
  }

  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, size, size);
  }

  const box = size * (1 - options.inset * 2);
  const scale = Math.min(box / source.width, box / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  context.imageSmoothingQuality = 'high';
  context.drawImage(source, (size - width) / 2, (size - height) / 2, width, height);

  return toBlob(canvas);
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The icon could not be encoded'))),
      'image/png',
    );
  });
}

// A baked icon outlives the theme it was generated under and is drawn by the OS, not the app, so
// it takes the one surface that does not follow dark mode: the printed sheet's.
function paperColour(): string | null {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--color-paper').trim();

  return value === '' ? null : value;
}
