import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { LineCapStyle, PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

import { visualRuns, type TextDirection } from '@api/billing/pdf/arabic-text';
import type { MarkPath, MarkViewBox } from '@api/billing/pdf/brand-mark';

const FONT_DIR = join(__dirname, 'fonts');

// Amiri because its presentation forms are single glyphs: faces that compose them from a base
// letter plus mark glyphs need mark positioning, which pdf-lib does not apply.
const FONTS = {
  regular: join(FONT_DIR, 'Amiri-Regular.ttf'),
  bold: join(FONT_DIR, 'Amiri-Bold.ttf'),
} as const;

// `subset: false` — pdf-lib's subsetter drops presentation-form glyphs. `locl: false` — Amiri's
// Arabic decimal separator is measured at one width and drawn at another, overlapping the label.
const EMBED_OPTIONS = { subset: false, features: { locl: false } } as const;

export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = 42;

export interface Column {
  readonly width: number;
  readonly header: string;
  /** Numbers read better left-aligned even on an RTL sheet. */
  readonly align?: 'start' | 'end';
}

export class RtlPdf {
  private constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private page: PDFPage,
    private cursor: number,
    // Every position is expressed against `start`/`end` rather than left and right, so one flag
    // turns the whole document round.
    private readonly pageDir: TextDirection,
  ) {}

  static async create(
    options: { size?: { width: number; height: number }; direction?: TextDirection } = {},
  ): Promise<RtlPdf> {
    const size = options.size ?? A4;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const regular = await doc.embedFont(readFileSync(FONTS.regular), EMBED_OPTIONS);
    const bold = await doc.embedFont(readFileSync(FONTS.bold), EMBED_OPTIONS);
    const page = doc.addPage([size.width, size.height]);

    return new RtlPdf(doc, regular, bold, page, size.height - MARGIN, options.direction ?? 'rtl');
  }

  /** The edge a line begins at: the right on an Arabic sheet, the left on an English one. */
  private get startEdge(): number {
    return this.pageDir === 'rtl' ? this.right : this.left;
  }

  private get flow(): 1 | -1 {
    return this.pageDir === 'rtl' ? -1 : 1;
  }

  get direction(): TextDirection {
    return this.pageDir;
  }

  get y(): number {
    return this.cursor;
  }

  get right(): number {
    return this.page.getWidth() - MARGIN;
  }

  get left(): number {
    return MARGIN;
  }

  font(weight: 'regular' | 'bold' = 'regular'): PDFFont {
    return weight === 'bold' ? this.bold : this.regular;
  }

  widthOf(
    text: string,
    size: number,
    weight: 'regular' | 'bold' = 'regular',
    dir: TextDirection = 'rtl',
  ): number {
    const font = this.font(weight);

    return visualRuns(text, dir).reduce(
      (sum, run) => sum + font.widthOfTextAtSize(run.text, size),
      0,
    );
  }

  // Each run is placed at its own x in logical order: fontkit reverses an Arabic run as it lays it
  // out, so nothing is reversed by hand.
  drawLine(
    text: string,
    options: {
      x: number;
      y: number;
      size: number;
      weight?: 'regular' | 'bold';
      colour?: [number, number, number];
      // The PDF's equivalent of the web app's `dir="ltr"` island: without it bidi floats a leading
      // `+` to the far side and swaps the ends of a range.
      dir?: TextDirection;
    },
  ): number {
    const font = this.font(options.weight ?? 'regular');
    const [r, g, b] = options.colour ?? [0, 0, 0];
    let x = options.x;

    for (const run of visualRuns(text, options.dir ?? 'rtl')) {
      this.page.drawText(run.text, {
        x,
        y: options.y,
        size: options.size,
        font,
        color: rgb(r, g, b),
      });
      x += font.widthOfTextAtSize(run.text, options.size);
    }

    return x - options.x;
  }

  text(
    value: string,
    options: {
      size?: number;
      weight?: 'regular' | 'bold';
      colour?: [number, number, number];
      gap?: number;
      align?: 'start' | 'end' | 'centre';
      dir?: TextDirection;
    } = {},
  ): void {
    const size = options.size ?? 11;
    const width = this.widthOf(value, size, options.weight, options.dir);

    const x =
      options.align === 'centre'
        ? (this.page.getWidth() - width) / 2
        : (options.align === 'end') === (this.pageDir === 'rtl')
          ? this.left
          : this.right - width;

    this.drawLine(value, {
      x,
      y: this.cursor,
      size,
      ...(options.weight && { weight: options.weight }),
      ...(options.colour && { colour: options.colour }),
      ...(options.dir && { dir: options.dir }),
    });

    this.cursor -= size + (options.gap ?? 5);
  }

  space(amount: number): void {
    this.cursor -= amount;
  }

  // The cursor is a baseline, but pdf-lib anchors an SVG path at its top-left, so the mark's top
  // goes a full `size` above it — drawing at the cursor would collide with the next line.
  mark(paths: readonly MarkPath[], viewBox: MarkViewBox, size = 34): void {
    // Fit by height and centre by whatever width that leaves: a mark is as
    // tall as the band it sits in, and its own proportions decide the rest.
    const scale = size / viewBox.height;
    const x = (this.page.getWidth() - viewBox.width * scale) / 2;
    const top = this.cursor + size;

    for (const path of paths) {
      this.page.drawSvgPath(path.d, {
        // The paths keep the artwork's own coordinates, so the box's origin is
        // subtracted here rather than baked into every number in the file.
        x: x - viewBox.x * scale,
        y: top - viewBox.y * scale,
        scale,
        // pdf-lib fills with black unless told otherwise, which would turn a
        // stroked-only path into a solid blob.
        ...(path.fill && { color: rgb(...path.fill) }),
        ...(path.stroke && {
          borderColor: rgb(...path.stroke),
          borderWidth: (path.strokeWidth ?? 1) * scale,
          borderLineCap: LineCapStyle.Round,
        }),
      });
    }

    this.cursor -= size + 8;
  }

  // False when the bytes are not something pdf-lib can embed, so the caller falls back to the
  // built-in mark rather than failing the receipt.
  async image(bytes: Buffer, mime: string, size = 34): Promise<boolean> {
    const embedded = await this.embed(bytes, mime);

    if (!embedded) {
      return false;
    }

    const scale = size / embedded.height;
    const width = embedded.width * scale;

    this.page.drawImage(embedded, {
      x: (this.page.getWidth() - width) / 2,
      // Unlike an SVG path, an image is anchored at its bottom-left, so the
      // cursor is where it stands rather than where its top goes.
      y: this.cursor,
      width,
      height: size,
    });

    this.cursor -= size + 8;

    return true;
  }

  private async embed(bytes: Buffer, mime: string): Promise<PDFImage | undefined> {
    try {
      if (mime === 'image/png') {
        return await this.doc.embedPng(bytes);
      }
      if (mime === 'image/jpeg') {
        return await this.doc.embedJpg(bytes);
      }
    } catch {
      // A file that says PNG and is not: same outcome as an unsupported type.
      return undefined;
    }

    // pdf-lib embeds PNG and JPEG only; WebP is fine on screen and not here.
    return undefined;
  }

  rule(colour: [number, number, number] = [0.75, 0.75, 0.75]): void {
    this.page.drawLine({
      start: { x: this.left, y: this.cursor },
      end: { x: this.right, y: this.cursor },
      thickness: 0.7,
      color: rgb(...colour),
    });
    this.cursor -= 12;
  }

  field(label: string, value: string, options: { size?: number; dir?: TextDirection } = {}): void {
    const size = options.size ?? 11;
    const dir = options.dir ?? this.pageDir;
    const labelText = `${label}: `;
    const labelWidth = this.widthOf(labelText, size, 'bold');
    const valueWidth = this.widthOf(value, size, 'regular', dir);

    const labelX = this.pageDir === 'rtl' ? this.right - labelWidth : this.left;
    const valueX =
      this.pageDir === 'rtl' ? this.right - labelWidth - valueWidth : this.left + labelWidth;

    this.drawLine(labelText, { x: labelX, y: this.cursor, size, weight: 'bold' });
    this.drawLine(value, { x: valueX, y: this.cursor, size, dir });

    this.cursor -= size + 5;
  }

  // First column at the sheet's starting edge. Rows break onto a new page rather than being split
  // across one.
  table(columns: readonly Column[], rows: readonly (readonly string[])[], size = 10): void {
    const usable = this.right - this.left;
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / total) * usable);

    const drawRow = (cells: readonly string[], weight: 'regular' | 'bold'): void => {
      let x = this.startEdge;

      cells.forEach((cell, index) => {
        const columnWidth = widths[index] ?? 0;
        const align = columns[index]?.align ?? 'start';
        const cellWidth = this.widthOf(cell, size, weight);

        const cellX =
          this.pageDir === 'rtl'
            ? align === 'end'
              ? x - columnWidth + 4
              : x - cellWidth - 4
            : align === 'end'
              ? x + columnWidth - cellWidth - 4
              : x + 4;

        this.drawLine(cell, { x: cellX, y: this.cursor, size, weight, dir: this.pageDir });
        x += columnWidth * this.flow;
      });

      this.cursor -= size + 8;
    };

    drawRow(
      columns.map((column) => column.header),
      'bold',
    );
    this.rule([0.4, 0.4, 0.4]);

    for (const row of rows) {
      if (this.cursor < MARGIN + 60) {
        this.page = this.doc.addPage([this.page.getWidth(), this.page.getHeight()]);
        this.cursor = this.page.getHeight() - MARGIN;
        drawRow(
          columns.map((column) => column.header),
          'bold',
        );
        this.rule([0.4, 0.4, 0.4]);
      }

      drawRow(row, 'regular');
    }
  }

  async save(): Promise<Buffer> {
    return Buffer.from(await this.doc.save());
  }
}
