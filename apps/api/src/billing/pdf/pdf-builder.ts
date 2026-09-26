import { readFileSync } from "node:fs";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  autoDirection,
  hasRtlLetters,
  visualRuns,
  type TextDirection,
} from "@api/billing/pdf/arabic-text";

const FONT_DIR = join(__dirname, "fonts");

// Tajawal is the web app's face, so a printed page reads like the screen. Alef only fills the few
// glyphs Tajawal lacks — the shekel sign among them.
const FONTS = {
  regular: "Tajawal-Regular.ttf",
  medium: "Tajawal-Medium.ttf",
  bold: "Tajawal-Bold.ttf",
  fallbackRegular: "Alef-Regular.ttf",
  fallbackBold: "Alef-Bold.ttf",
} as const;

// fontkit shapes the Arabic from the font's own tables. `liga` off: a Latin "fi" drawn as one glyph
// copies out of the PDF as a character nobody typed.
const EMBED_OPTIONS = { subset: true, features: { liga: false } } as const;

export type Weight = "regular" | "medium" | "bold";
export type Colour = readonly [number, number, number];

export const INK: Colour = [0.114, 0.157, 0.188];
export const MUTED: Colour = [0.38, 0.44, 0.49];
export const HAIRLINE: Colour = [0.87, 0.89, 0.91];
export const BAND: Colour = [0.953, 0.961, 0.969];
export const ACCENT: Colour = [0.184, 0.345, 0.471];
export const ACCENT_BAND: Colour = [0.918, 0.941, 0.957];

export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = 42;

/** A table cell: its line, and an optional muted line under it. */
export interface Cell {
  readonly text: string;
  readonly sub?: string | undefined;
  readonly weight?: Weight | undefined;
  readonly colour?: Colour | undefined;
}

export interface Column {
  readonly width: number;
  readonly header: string;
  /** Numbers read better left-aligned even on an RTL sheet. */
  readonly align?: "start" | "end";
  /** A column of figures, dates or codes: drawn left to right on either sheet. */
  readonly ltr?: boolean;
}

export interface InfoPair {
  readonly label: string;
  readonly value: string;
  readonly ltr?: boolean;
}

interface Fonts {
  readonly regular: PDFFont;
  readonly medium: PDFFont;
  readonly bold: PDFFont;
  readonly fallbackRegular: PDFFont;
  readonly fallbackBold: PDFFont;
}

interface TextOptions {
  size: number;
  weight?: Weight;
  colour?: Colour;
  dir?: TextDirection;
}

const ELLIPSIS = "…";

export class RtlPdf {
  private readonly pages: PDFPage[] = [];
  private footerLabel: ((page: number, total: number) => string) | null = null;

  private constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
    private page: PDFPage,
    private cursor: number,
    // Every position is expressed against `start`/`end` rather than left and right, so one flag
    // turns the whole document round.
    private readonly pageDir: TextDirection,
    private readonly margin: number,
  ) {
    this.pages.push(page);
  }

  static async create(
    options: {
      size?: { width: number; height: number };
      direction?: TextDirection;
      margin?: number;
    } = {},
  ): Promise<RtlPdf> {
    const size = options.size ?? A4;
    const margin = options.margin ?? MARGIN;
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const embed = (file: string): Promise<PDFFont> =>
      doc.embedFont(readFileSync(join(FONT_DIR, file)), EMBED_OPTIONS);
    const [regular, medium, bold, fallbackRegular, fallbackBold] = await Promise.all([
      embed(FONTS.regular),
      embed(FONTS.medium),
      embed(FONTS.bold),
      embed(FONTS.fallbackRegular),
      embed(FONTS.fallbackBold),
    ]);
    const page = doc.addPage([size.width, size.height]);

    return new RtlPdf(
      doc,
      { regular, medium, bold, fallbackRegular, fallbackBold },
      page,
      size.height - margin,
      options.direction ?? "rtl",
      margin,
    );
  }

  get direction(): TextDirection {
    return this.pageDir;
  }

  get y(): number {
    return this.cursor;
  }

  get right(): number {
    return this.page.getWidth() - this.margin;
  }

  get left(): number {
    return this.margin;
  }

  get width(): number {
    return this.right - this.left;
  }

  /** Where a box of `width` sits against the start edge, or the end edge. */
  private xFor(
    width: number,
    align: "start" | "end" | "centre",
    from = this.left,
    to = this.right,
  ): number {
    if (align === "centre") {
      return from + (to - from - width) / 2;
    }

    return (align === "start") === (this.pageDir === "rtl") ? to - width : from;
  }

  font(weight: Weight = "regular"): PDFFont {
    return this.fonts[weight];
  }

  private fallback(weight: Weight): PDFFont {
    return weight === "bold" ? this.fonts.fallbackBold : this.fonts.fallbackRegular;
  }

  private readonly coverage = new Map<Weight, Set<number>>();

  private covers(weight: Weight, codePoint: number): boolean {
    let set = this.coverage.get(weight);
    if (!set) {
      set = new Set(this.font(weight).getCharacterSet());
      this.coverage.set(weight, set);
    }

    return set.has(codePoint);
  }

  /** A run split where the face lacks a glyph, in the order the pieces sit on the page. */
  private pieces(
    text: string,
    weight: Weight,
    dir: TextDirection,
  ): { text: string; font: PDFFont }[] {
    const primary = this.font(weight);
    const spare = this.fallback(weight);
    const out: { text: string; font: PDFFont }[] = [];

    for (const run of visualRuns(text, dir)) {
      const segments: { text: string; font: PDFFont }[] = [];

      for (const char of run.text) {
        const font = this.covers(weight, char.codePointAt(0) ?? 0) ? primary : spare;
        const last = segments.at(-1);

        if (last?.font === font) {
          last.text += char;
        } else {
          segments.push({ text: char, font });
        }
      }

      if (!run.shapedRtl) {
        out.push(...segments);
        continue;
      }

      // fontkit reverses an Arabic run within one draw, not across two fonts, and not a piece
      // with no Arabic in it — a bracket left alone beside the fallback's shekel sign.
      for (const segment of segments.reverse()) {
        out.push(
          hasRtlLetters(segment.text)
            ? segment
            : { font: segment.font, text: [...segment.text].reverse().join("") },
        );
      }
    }

    return out;
  }

  widthOf(
    text: string,
    size: number,
    weight: Weight = "regular",
    dir: TextDirection = this.pageDir,
  ): number {
    return this.pieces(text, weight, dir).reduce(
      (sum, piece) => sum + piece.font.widthOfTextAtSize(piece.text, size),
      0,
    );
  }

  drawLine(text: string, options: TextOptions & { x: number; y: number }): number {
    const weight = options.weight ?? "regular";
    const [r, g, b] = options.colour ?? INK;
    let x = options.x;

    for (const piece of this.pieces(text, weight, options.dir ?? this.pageDir)) {
      this.page.drawText(piece.text, {
        x,
        y: options.y,
        size: options.size,
        font: piece.font,
        color: rgb(r, g, b),
      });
      x += piece.font.widthOfTextAtSize(piece.text, options.size);
    }

    return x - options.x;
  }

  /** Word-wrapped lines no wider than `max`; the last one ends in an ellipsis if text is left over. */
  wrap(text: string, max: number, options: TextOptions & { lines?: number }): string[] {
    const limit = options.lines ?? Number.POSITIVE_INFINITY;
    const fits = (line: string): boolean =>
      this.widthOf(line, options.size, options.weight, options.dir) <= max;
    const lines: string[] = [];

    for (const paragraph of text.split(/\r?\n/u)) {
      let line = "";

      for (const word of paragraph.split(/\s+/u).filter(Boolean)) {
        const candidate = line === "" ? word : `${line} ${word}`;

        if (fits(candidate)) {
          line = candidate;
          continue;
        }

        if (line !== "") {
          lines.push(line);
        }
        line = fits(word) ? word : this.clip(word, max, options);
      }

      lines.push(line);
    }

    if (lines.length <= limit) {
      return lines;
    }

    const kept = lines.slice(0, limit);
    kept[limit - 1] = this.clip(
      `${kept[limit - 1] ?? ""} ${lines[limit] ?? ""}`,
      max,
      options,
      true,
    );

    return kept;
  }

  private clip(text: string, max: number, options: TextOptions, always = false): string {
    const fits = (line: string): boolean =>
      this.widthOf(line, options.size, options.weight, options.dir) <= max;

    if (!always && fits(text)) {
      return text;
    }

    const chars = [...text];
    while (chars.length > 0 && !fits(`${chars.join("").trimEnd()}${ELLIPSIS}`)) {
      chars.pop();
    }

    return `${chars.join("").trimEnd()}${ELLIPSIS}`;
  }

  text(
    value: string,
    options: {
      size?: number;
      weight?: Weight;
      colour?: Colour;
      gap?: number;
      align?: "start" | "end" | "centre";
      dir?: TextDirection;
    } = {},
  ): void {
    const size = options.size ?? 11;
    const style: TextOptions = {
      size,
      ...(options.weight && { weight: options.weight }),
      ...(options.colour && { colour: options.colour }),
      ...(options.dir && { dir: options.dir }),
    };

    for (const line of this.wrap(value, this.width, style)) {
      this.ensure(size + 4);
      const width = this.widthOf(line, size, options.weight, options.dir);
      this.drawLine(line, {
        ...style,
        x: this.xFor(width, options.align ?? "start"),
        y: this.cursor - size,
      });
      this.cursor -= size * 1.35;
    }

    this.cursor -= options.gap ?? 4;
  }

  space(amount: number): void {
    this.cursor -= amount;
  }

  /** Starts a new page when fewer than `height` points are left above the footer. */
  ensure(height: number, onBreak?: () => void): void {
    if (this.cursor - height >= this.margin + 18) {
      return;
    }

    this.page = this.doc.addPage([this.page.getWidth(), this.page.getHeight()]);
    this.pages.push(this.page);
    this.cursor = this.page.getHeight() - this.margin;
    onBreak?.();
  }

  private async embedImage(bytes: Buffer, mime: string): Promise<PDFImage | undefined> {
    try {
      if (mime === "image/png") {
        return await this.doc.embedPng(bytes);
      }
      if (mime === "image/jpeg") {
        return await this.doc.embedJpg(bytes);
      }
    } catch {
      // A file that says PNG and is not: same outcome as an unsupported type.
      return undefined;
    }

    return undefined;
  }

  /** False when the bytes are not something pdf-lib can embed; the sheet then carries the name alone. */
  async image(bytes: Buffer, mime: string, size = 34): Promise<boolean> {
    const embedded = await this.embedImage(bytes, mime);

    if (!embedded) {
      return false;
    }

    const width = embedded.width * (size / embedded.height);
    this.page.drawImage(embedded, {
      x: this.xFor(width, "centre"),
      y: this.cursor - size,
      width,
      height: size,
    });
    this.cursor -= size + 8;

    return true;
  }

  /**
   * The clinic's mark and name at the start edge, the document's title at the end, a rule under
   * both. `subtitle` is the title's second line — a receipt's number, a period.
   */
  async letterhead(options: {
    name: string;
    address: string;
    phone: string;
    logo: { bytes: Buffer; mime: string } | null;
    title: string;
    subtitle?: string | undefined;
  }): Promise<void> {
    const top = this.cursor;
    const logoHeight = 40;
    let offset = 0;

    const embedded = options.logo
      ? await this.embedImage(options.logo.bytes, options.logo.mime)
      : undefined;
    if (embedded) {
      const width = Math.min(embedded.width * (logoHeight / embedded.height), 120);
      const height = embedded.height * (width / embedded.width);
      this.page.drawImage(embedded, {
        x: this.xFor(width, "start"),
        y: top - (logoHeight + height) / 2,
        width,
        height,
      });
      offset = width + 12;
    }

    const titleRoom = Math.max(
      this.widthOf(options.title, 17, "bold"),
      options.subtitle ? this.widthOf(options.subtitle, 10, "medium", "ltr") : 0,
    );
    const nameWidth = this.width - offset - titleRoom - 32;
    const nameLines = this.wrap(options.name, nameWidth, { size: 14, weight: "bold", lines: 2 });
    let y = top - 14;
    for (const line of nameLines) {
      const width = this.widthOf(line, 14, "bold");
      this.drawLine(line, {
        size: 14,
        weight: "bold",
        x: this.pageDir === "rtl" ? this.right - offset - width : this.left + offset,
        y,
      });
      y -= 18;
    }

    // The address reads in the sheet's direction and the phone left to right, so each is its own
    // line: joined, the bidi algorithm drops the number into the middle of an Arabic street.
    const contact: { text: string; dir: TextDirection }[] = [
      ...(options.address ? [{ text: options.address, dir: this.pageDir }] : []),
      ...(options.phone ? [{ text: options.phone, dir: "ltr" as const }] : []),
    ];
    for (const entry of contact) {
      for (const line of this.wrap(entry.text, nameWidth, {
        size: 8.5,
        dir: entry.dir,
        lines: 2,
      })) {
        const width = this.widthOf(line, 8.5, "regular", entry.dir);
        this.drawLine(line, {
          size: 8.5,
          colour: MUTED,
          dir: entry.dir,
          x: this.pageDir === "rtl" ? this.right - offset - width : this.left + offset,
          y: y + 4,
        });
        y -= 11;
      }
    }

    const titleWidth = this.widthOf(options.title, 17, "bold");
    this.drawLine(options.title, {
      size: 17,
      weight: "bold",
      colour: ACCENT,
      x: this.xFor(titleWidth, "end"),
      y: top - 16,
    });
    if (options.subtitle) {
      const width = this.widthOf(options.subtitle, 10, "medium", "ltr");
      this.drawLine(options.subtitle, {
        size: 10,
        weight: "medium",
        colour: MUTED,
        dir: "ltr",
        x: this.xFor(width, "end"),
        y: top - 32,
      });
    }

    this.cursor = Math.min(y, top - logoHeight) - 8;
    this.page.drawLine({
      start: { x: this.left, y: this.cursor },
      end: { x: this.right, y: this.cursor },
      thickness: 1.2,
      color: rgb(...ACCENT),
    });
    this.cursor -= 16;
  }

  rule(colour: Colour = HAIRLINE): void {
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
    const labelWidth = this.widthOf(labelText, size, "bold");
    const room = this.width - labelWidth;

    this.ensure(size + 6);
    const lines = this.wrap(value, room, { size, dir });
    lines.forEach((line, index) => {
      const valueWidth = this.widthOf(line, size, "regular", dir);
      const y = this.cursor - size;

      if (index === 0) {
        this.drawLine(labelText, {
          size,
          weight: "bold",
          x: this.pageDir === "rtl" ? this.right - labelWidth : this.left,
          y,
        });
      }
      this.drawLine(line, {
        size,
        dir,
        x: this.pageDir === "rtl" ? this.right - labelWidth - valueWidth : this.left + labelWidth,
        y,
      });
      this.cursor -= size * 1.4;
    });
    this.cursor -= 2;
  }

  /** Label over value, in a shaded block: the header of a statement or a receipt. */
  infoGrid(pairs: readonly InfoPair[], columns = 2): void {
    const pad = 12;
    const rowHeight = 34;
    const rows = Math.ceil(pairs.length / columns);
    const height = rows * rowHeight + pad;
    const columnWidth = (this.width - pad * 2) / columns;

    this.ensure(height + 8);
    this.page.drawRectangle({
      x: this.left,
      y: this.cursor - height,
      width: this.width,
      height,
      color: rgb(...BAND),
    });

    pairs.forEach((pair, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const from =
        this.pageDir === "rtl"
          ? this.right - pad - (column + 1) * columnWidth
          : this.left + pad + column * columnWidth;
      const to = from + columnWidth - 8;
      const y = this.cursor - pad - row * rowHeight;

      const labelWidth = this.widthOf(pair.label, 8.5, "medium");
      this.drawLine(pair.label, {
        size: 8.5,
        weight: "medium",
        colour: MUTED,
        x: this.xFor(labelWidth, "start", from, to),
        y: y - 9,
      });

      const dir = pair.ltr ? "ltr" : this.pageDir;
      const [value = ""] = this.wrap(pair.value, to - from, {
        size: 11,
        weight: "medium",
        dir,
        lines: 1,
      });
      const valueWidth = this.widthOf(value, 11, "medium", dir);
      this.drawLine(value, {
        size: 11,
        weight: "medium",
        dir,
        x: this.xFor(valueWidth, "start", from, to),
        y: y - 24,
      });
    });

    this.cursor -= height + 14;
  }

  table(
    columns: readonly Column[],
    rows: readonly (readonly (string | Cell)[])[],
    size = 9.5,
  ): void {
    const pad = 6;
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / total) * this.width);

    // Each column's span, from the start edge.
    const spans = widths.map((width, index) => {
      const before = widths.slice(0, index).reduce((sum, value) => sum + value, 0);
      return this.pageDir === "rtl"
        ? { from: this.right - before - width, to: this.right - before }
        : { from: this.left + before, to: this.left + before + width };
    });

    const place = (text: string, index: number, style: TextOptions, y: number): void => {
      const span = spans[index];
      if (!span) {
        return;
      }
      const align = columns[index]?.align ?? "start";
      const width = this.widthOf(text, style.size, style.weight, style.dir);
      this.drawLine(text, {
        ...style,
        x: this.xFor(width, align, span.from + pad, span.to - pad),
        y,
      });
    };

    const header = (): void => {
      const height = size + 14;
      this.page.drawRectangle({
        x: this.left,
        y: this.cursor - height,
        width: this.width,
        height,
        color: rgb(...BAND),
      });
      columns.forEach((column, index) => {
        place(
          column.header,
          index,
          { size: size - 0.5, weight: "medium", colour: MUTED },
          this.cursor - height / 2 - size / 3,
        );
      });
      this.cursor -= height;
    };

    header();

    for (const row of rows) {
      const cells = row.map((cell): Cell => (typeof cell === "string" ? { text: cell } : cell));
      const laid = cells.map((cell, index) => {
        const column = columns[index];
        const room = (widths[index] ?? 0) - pad * 2;
        const dir: TextDirection = column?.ltr ? "ltr" : autoDirection(cell.text, this.pageDir);
        const subDir = cell.sub ? autoDirection(cell.sub, this.pageDir) : this.pageDir;
        return {
          lines: this.wrap(cell.text, room, {
            size,
            weight: cell.weight ?? "regular",
            dir,
            lines: 2,
          }),
          sub: cell.sub
            ? this.wrap(cell.sub, room, { size: size - 1.5, dir: subDir, lines: 2 })
            : [],
          dir,
          subDir,
        };
      });

      const lineHeight = size * 1.35;
      const subHeight = (size - 1.5) * 1.35;
      const height =
        Math.max(
          ...laid.map((cell) => cell.lines.length * lineHeight + cell.sub.length * subHeight),
        ) + 12;

      this.ensure(height, header);

      laid.forEach((cell, index) => {
        const source = cells[index];
        let y = this.cursor - 6 - size;
        for (const line of cell.lines) {
          place(
            line,
            index,
            {
              size,
              weight: source?.weight ?? "regular",
              colour: source?.colour ?? INK,
              dir: cell.dir,
            },
            y,
          );
          y -= lineHeight;
        }
        for (const line of cell.sub) {
          place(line, index, { size: size - 1.5, colour: MUTED, dir: cell.subDir }, y);
          y -= subHeight;
        }
      });

      this.cursor -= height;
      this.page.drawLine({
        start: { x: this.left, y: this.cursor },
        end: { x: this.right, y: this.cursor },
        thickness: 0.5,
        color: rgb(...HAIRLINE),
      });
    }

    this.cursor -= 10;
  }

  /** Totals against the end edge, the last one emphasised: a statement's closing figures. */
  totals(lines: readonly { label: string; value: string; strong?: boolean }[]): void {
    const width = Math.min(250, this.width);
    const from = this.pageDir === "rtl" ? this.left : this.right - width;
    const to = from + width;

    this.ensure(lines.length * 20 + 16);

    for (const line of lines) {
      const strong = line.strong === true;
      const height = strong ? 26 : 18;
      const size = strong ? 12 : 10;

      if (strong) {
        this.page.drawRectangle({
          x: from,
          y: this.cursor - height,
          width,
          height,
          color: rgb(...ACCENT_BAND),
        });
      }

      const y = this.cursor - height / 2 - size / 3;
      const weight: Weight = strong ? "bold" : "regular";
      const labelWidth = this.widthOf(line.label, size, weight);
      const valueWidth = this.widthOf(line.value, size, weight, "ltr");
      this.drawLine(line.label, {
        size,
        weight,
        colour: strong ? ACCENT : MUTED,
        x: this.xFor(labelWidth, "start", from + 8, to - 8),
        y,
      });
      this.drawLine(line.value, {
        size,
        weight,
        colour: strong ? ACCENT : INK,
        dir: "ltr",
        x: this.xFor(valueWidth, "end", from + 8, to - 8),
        y,
      });
      this.cursor -= height + 2;
    }

    this.cursor -= 8;
  }

  /** The figure a receipt is for, large, in a band of its own. */
  amount(label: string, value: string, note?: string): void {
    const height = 54;
    this.ensure(height + 8);
    this.page.drawRectangle({
      x: this.left,
      y: this.cursor - height,
      width: this.width,
      height,
      color: rgb(...ACCENT_BAND),
      borderColor: rgb(...ACCENT),
      borderWidth: 0.8,
    });

    const labelWidth = this.widthOf(label, 10, "medium");
    this.drawLine(label, {
      size: 10,
      weight: "medium",
      colour: ACCENT,
      x: this.xFor(labelWidth, "start", this.left + 16, this.right - 16),
      y: this.cursor - 22,
    });
    if (note) {
      const [line = ""] = this.wrap(note, this.width * 0.5, { size: 8.5, lines: 1 });
      const width = this.widthOf(line, 8.5);
      this.drawLine(line, {
        size: 8.5,
        colour: MUTED,
        x: this.xFor(width, "start", this.left + 16, this.right - 16),
        y: this.cursor - 38,
      });
    }

    const valueWidth = this.widthOf(value, 22, "bold", "ltr");
    this.drawLine(value, {
      size: 22,
      weight: "bold",
      colour: ACCENT,
      dir: "ltr",
      x: this.xFor(valueWidth, "end", this.left + 16, this.right - 16),
      y: this.cursor - height / 2 - 8,
    });

    this.cursor -= height + 14;
  }

  /** A line to sign on for each label, spread across the width. */
  signatures(labels: readonly string[]): void {
    const gap = 24;
    // A line to sign on, not a rule across the page: no wider than a signature needs.
    const width = Math.min(220, (this.width - gap * (labels.length - 1)) / labels.length);
    this.ensure(44);
    const y = this.cursor - 26;

    labels.forEach((label, index) => {
      // The first at the start edge, the last at the end, the rest spaced between.
      const step = labels.length > 1 ? (this.width - width) / (labels.length - 1) : 0;
      const from =
        this.pageDir === "rtl" ? this.right - width - index * step : this.left + index * step;
      this.page.drawLine({
        start: { x: from, y },
        end: { x: from + width, y },
        thickness: 0.7,
        color: rgb(...MUTED),
      });
      const labelWidth = this.widthOf(label, 8.5);
      this.drawLine(label, {
        size: 8.5,
        colour: MUTED,
        x: this.xFor(labelWidth, "centre", from, from + width),
        y: y - 12,
      });
    });

    this.cursor = y - 22;
  }

  /** What the viewer's tab and title bar show, instead of the blob's random name. */
  title(value: string): void {
    this.doc.setTitle(value.replace(/[\u2066-\u2069]/gu, ""), { showInWindowTitleBar: true });
  }

  /** Written on every page at save time, once the page count is known. */
  footer(label: (page: number, total: number) => string): void {
    this.footerLabel = label;
  }

  async save(): Promise<Buffer> {
    if (this.footerLabel) {
      this.pages.forEach((page, index) => {
        const text = this.footerLabel?.(index + 1, this.pages.length) ?? "";
        const current = this.page;
        this.page = page;
        const width = this.widthOf(text, 8);
        this.drawLine(text, {
          size: 8,
          colour: MUTED,
          x: this.xFor(width, "centre"),
          y: this.margin / 2,
        });
        this.page = current;
      });
    }

    return Buffer.from(await this.doc.save());
  }
}
