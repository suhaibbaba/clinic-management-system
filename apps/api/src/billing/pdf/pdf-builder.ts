import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { visualRuns, type TextDirection } from '@api/billing/pdf/arabic-text';

/**
 * A very small right-to-left document builder over pdf-lib.
 *
 * Everything a receipt or a statement needs — a letterhead, key/value lines, a
 * table, a totals block — and nothing else. It exists so the documents describe
 * *what* they show and never how Arabic is laid out.
 *
 */

const FONT_DIR = join(__dirname, 'fonts');

/**
 * Amiri (SIL Open Font License), a naskh face drawn for print.
 *
 * Chosen over the other free Arabic faces because its presentation forms are
 * single glyphs. Faces that build them out of a base letter plus separate dot
 * marks rely on the font's mark positioning, which pdf-lib does not apply — the
 * dots then pile up at the start of the line. Amiri simply has no such glyphs.
 */
const FONTS = {
  regular: join(FONT_DIR, 'Amiri-Regular.ttf'),
  bold: join(FONT_DIR, 'Amiri-Bold.ttf'),
} as const;

/**
 * Fonts are embedded whole and with Amiri's Arabic localisation switched off.
 *
 * `subset: false` because pdf-lib's subsetter drops the presentation-form
 * glyphs the shaper produces, and a receipt with missing letters is worse than
 * a receipt that is a few hundred kilobytes.
 *
 * `locl: false` because Amiri swaps the full stop for an Arabic decimal
 * separator whenever a run looks Arabic, and that glyph's advance does not
 * survive into the PDF: pdf-lib writes glyph widths but no positioning, so
 * `100.00 USD` came out measured one width and drawn another, overlapping the
 * label beside it. The text reaching the font is already shaped by hand, so
 * there is nothing for the font's own substitutions to add.
 */
const EMBED_OPTIONS = { subset: false, features: { locl: false } } as const;

export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = 42;

export interface Column {
  /** Share of the table width; the shares are normalised. */
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
  ) {}

  static async create(size: { width: number; height: number } = A4): Promise<RtlPdf> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const regular = await doc.embedFont(readFileSync(FONTS.regular), EMBED_OPTIONS);
    const bold = await doc.embedFont(readFileSync(FONTS.bold), EMBED_OPTIONS);
    const page = doc.addPage([size.width, size.height]);

    return new RtlPdf(doc, regular, bold, page, size.height - MARGIN);
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

  /** Width a line will occupy once shaped — runs are additive. */
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

  /**
   * Draws one line, run by run.
   *
   * Each run is placed at its own x and handed to pdf-lib in logical order:
   * fontkit reverses an Arabic run as it lays it out, so the runs end up in
   * visual order without the text ever being reversed by hand.
   */
  drawLine(
    text: string,
    options: {
      x: number;
      y: number;
      size: number;
      weight?: 'regular' | 'bold';
      colour?: [number, number, number];
      /**
       * Base direction of this line. `ltr` is the PDF's equivalent of the web
       * app's `dir="ltr"` island: a phone number or a date range read the same
       * way in Arabic as anywhere else, but the bidi algorithm would otherwise
       * float a leading `+` to the far side and swap the ends of a range.
       */
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

  /** Right-aligned line — the default on an Arabic sheet. */
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
      options.align === 'end'
        ? this.left
        : options.align === 'centre'
          ? (this.page.getWidth() - width) / 2
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

  rule(colour: [number, number, number] = [0.75, 0.75, 0.75]): void {
    this.page.drawLine({
      start: { x: this.left, y: this.cursor },
      end: { x: this.right, y: this.cursor },
      thickness: 0.7,
      color: rgb(...colour),
    });
    this.cursor -= 12;
  }

  /** `label: value` on one right-aligned line, the label in bold. */
  field(label: string, value: string, options: { size?: number; dir?: TextDirection } = {}): void {
    const size = options.size ?? 11;
    const dir = options.dir ?? 'rtl';
    const labelText = `${label}: `;
    const labelWidth = this.widthOf(labelText, size, 'bold');

    this.drawLine(labelText, { x: this.right - labelWidth, y: this.cursor, size, weight: 'bold' });

    const valueWidth = this.widthOf(value, size, 'regular', dir);
    this.drawLine(value, { x: this.right - labelWidth - valueWidth, y: this.cursor, size, dir });

    this.cursor -= size + 5;
  }

  /**
   * A table whose first column starts at the right edge.
   *
   * Rows break onto a new page rather than being split across one.
   */
  table(columns: readonly Column[], rows: readonly (readonly string[])[], size = 10): void {
    const usable = this.right - this.left;
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / total) * usable);

    const drawRow = (cells: readonly string[], weight: 'regular' | 'bold'): void => {
      let x = this.right;

      cells.forEach((cell, index) => {
        const columnWidth = widths[index] ?? 0;
        const align = columns[index]?.align ?? 'start';
        const cellWidth = this.widthOf(cell, size, weight);
        // `start` is the right edge on an RTL sheet; `end` the left.
        const cellX = align === 'end' ? x - columnWidth + 4 : x - cellWidth - 4;

        this.drawLine(cell, { x: cellX, y: this.cursor, size, weight });
        x -= columnWidth;
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
