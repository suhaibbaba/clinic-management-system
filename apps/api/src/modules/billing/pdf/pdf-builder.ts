import { readFileSync } from "node:fs";
import { join } from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import {
  autoDirection,
  hasRtlLetters,
  visualRuns,
  type TextDirection,
} from "@api/modules/billing/pdf/arabic-text";

const FONT_DIR = join(__dirname, "fonts");

const FONTS = {
  regular: "Tajawal-Regular.ttf",
  medium: "Tajawal-Medium.ttf",
  bold: "Tajawal-Bold.ttf",
  fallbackRegular: "Alef-Regular.ttf",
  fallbackBold: "Alef-Bold.ttf",
} as const;

const EMBED_OPTIONS = { subset: true, features: { liga: false } } as const;

export type Weight = "regular" | "medium" | "bold";
export type Colour = readonly [number, number, number];

export const INK: Colour = [0.114, 0.157, 0.188];
export const MUTED: Colour = [0.38, 0.44, 0.49];
export const HAIRLINE: Colour = [0.87, 0.89, 0.91];
export const BAND: Colour = [0.953, 0.961, 0.969];
export const ACCENT: Colour = [0.106, 0.435, 0.592];
export const ACCENT_BAND: Colour = [0.945, 0.969, 0.98];
export const ACCENT_DEEP: Colour = [0.055, 0.239, 0.333];
export const ACCENT_MID: Colour = [0.082, 0.357, 0.49];
export const ACCENT_RULE: Colour = [0.784, 0.875, 0.925];
export const INK_SOFT: Colour = [0.239, 0.302, 0.345];

export const A4 = { width: 595.28, height: 841.89 } as const;
export const MARGIN = 42;

const LOGO_HEIGHT = 46;
const LOGO_MAX_WIDTH = 112;
const RUNNING_LOGO_HEIGHT = 22;
const FOOTER_LINE = 44;
const FOOTER_STRIP = 4.5;

export interface Cell {
  readonly text: string;
  readonly sub?: string | undefined;
  readonly weight?: Weight | undefined;
  readonly colour?: Colour | undefined;
}

export interface Column {
  readonly width: number;
  readonly header: string;
  readonly align?: "start" | "end";
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
const EMPTY_CELL = "--";

interface Brand {
  readonly name: string;
  readonly title: string;
  readonly printed: string;
  readonly logo: PDFImage | undefined;
}

export class RtlPdf {
  private readonly pages: PDFPage[] = [];
  private footerLabel: ((page: number, total: number) => string) | null = null;
  private brand: Brand | null = null;

  private constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
    private page: PDFPage,
    private cursor: number,
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

  private get floor(): number {
    return Math.max(this.margin + 18, this.brand ? FOOTER_LINE + 14 : 0);
  }

  ensure(height: number, onBreak?: () => void): void {
    if (this.cursor - height >= this.floor) {
      return;
    }

    this.page = this.doc.addPage([this.page.getWidth(), this.page.getHeight()]);
    this.pages.push(this.page);
    this.cursor = this.page.getHeight() - this.margin;
    this.runningHeader();
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
      return undefined;
    }

    return undefined;
  }

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

  async letterhead(options: {
    name: string;
    otherName: string;
    address: string;
    phone: string;
    email: string;
    logo: { bytes: Buffer; mime: string } | null;
    title: string;
    subtitle?: string | undefined;
    issued: string;
    printed: string;
  }): Promise<void> {
    const top = this.cursor;
    const logo = options.logo
      ? await this.embedImage(options.logo.bytes, options.logo.mime)
      : undefined;
    this.brand = { name: options.name, title: options.title, printed: options.printed, logo };

    let offset = 0;
    if (logo) {
      const width = Math.min(logo.width * (LOGO_HEIGHT / logo.height), LOGO_MAX_WIDTH);
      const height = logo.height * (width / logo.width);
      this.page.drawImage(logo, {
        x: this.xFor(width, "start"),
        y: top - (LOGO_HEIGHT + height) / 2,
        width,
        height,
      });
      const divider = this.pageDir === "rtl" ? this.right - width - 12 : this.left + width + 12;
      this.page.drawLine({
        start: { x: divider, y: top - 2 },
        end: { x: divider, y: top - LOGO_HEIGHT + 2 },
        thickness: 0.75,
        color: rgb(...ACCENT_RULE),
      });
      offset = width + 24;
    }

    const meta = [options.subtitle, options.issued].filter((line): line is string => !!line);
    const titleRoom = Math.max(
      this.widthOf(options.title, 16, "bold"),
      ...meta.map((line) => this.widthOf(line, 9, "medium", "ltr")),
    );
    const startX = (width: number): number =>
      this.pageDir === "rtl" ? this.right - offset - width : this.left + offset;
    const nameWidth = this.width - offset - titleRoom - 24;
    const nameLines = this.wrap(options.name, nameWidth, { size: 15, weight: "bold", lines: 2 });
    let y = top - 17;
    for (const line of nameLines) {
      this.drawLine(line, {
        size: 15,
        weight: "bold",
        colour: ACCENT_DEEP,
        x: startX(this.widthOf(line, 15, "bold")),
        y,
      });
      y -= 19;
    }
    if (options.otherName) {
      const dir = autoDirection(options.otherName, this.pageDir);
      const line = this.clip(options.otherName, nameWidth, { size: 9, weight: "medium", dir });
      this.drawLine(line, {
        size: 9,
        weight: "medium",
        colour: ACCENT_MID,
        dir,
        x: startX(this.widthOf(line, 9, "medium", dir)),
        y: y + 5,
      });
      y -= 13;
    }

    this.drawLine(options.title, {
      size: 16,
      weight: "bold",
      colour: ACCENT,
      x: this.xFor(this.widthOf(options.title, 16, "bold"), "end"),
      y: top - 16,
    });
    meta.forEach((line, index) => {
      this.drawLine(line, {
        size: 9,
        weight: index === 0 ? "medium" : "regular",
        colour: index === 0 ? INK : MUTED,
        dir: "ltr",
        x: this.xFor(this.widthOf(line, 9, index === 0 ? "medium" : "regular", "ltr"), "end"),
        y: top - 31 - index * 12,
      });
    });

    this.cursor = Math.min(y + 5, top - LOGO_HEIGHT, top - 31 - meta.length * 12) - 12;
    this.contactRow([
      { text: options.address, dir: this.pageDir },
      { text: options.phone, dir: "ltr" },
      { text: options.email, dir: "ltr" },
    ]);
    this.brandRule(60, 2.2);
    this.cursor -= 18;
  }

  private contactRow(items: readonly { text: string; dir: TextDirection }[]): void {
    const size = 8.5;
    const gap = 14;
    let used = 0;

    for (const item of items.filter((entry) => entry.text !== "")) {
      const text = this.clip(item.text, this.width, { size, dir: item.dir });
      const width = this.widthOf(text, size, "regular", item.dir);

      if (used > 0 && used + gap + width > this.width) {
        this.cursor -= size + 5;
        used = 0;
      }

      const from = used === 0 ? 0 : used + gap;
      this.drawLine(text, {
        size,
        colour: INK_SOFT,
        dir: item.dir,
        x: this.pageDir === "rtl" ? this.right - from - width : this.left + from,
        y: this.cursor - size,
      });
      used = from + width;
    }

    this.cursor -= size + 10;
  }

  private brandRule(bar: number, thickness: number): void {
    const barFrom = this.pageDir === "rtl" ? this.right - bar : this.left;
    this.page.drawLine({
      start: { x: this.left, y: this.cursor },
      end: { x: this.right, y: this.cursor },
      thickness: 0.75,
      color: rgb(...ACCENT_RULE),
    });
    this.page.drawRectangle({
      x: barFrom,
      y: this.cursor - thickness / 2,
      width: bar,
      height: thickness,
      color: rgb(...ACCENT),
    });
  }

  private runningHeader(): void {
    if (!this.brand) {
      return;
    }

    const top = this.cursor;
    let offset = 0;
    if (this.brand.logo) {
      const logo = this.brand.logo;
      const width = Math.min(logo.width * (RUNNING_LOGO_HEIGHT / logo.height), 60);
      const height = logo.height * (width / logo.width);
      this.page.drawImage(logo, {
        x: this.xFor(width, "start"),
        y: top - (RUNNING_LOGO_HEIGHT + height) / 2,
        width,
        height,
      });
      offset = width + 10;
    }

    const titleWidth = this.widthOf(this.brand.title, 10, "bold");
    const name = this.clip(this.brand.name, this.width - offset - titleWidth - 24, {
      size: 10,
      weight: "bold",
    });
    const nameWidth = this.widthOf(name, 10, "bold");
    this.drawLine(name, {
      size: 10,
      weight: "bold",
      colour: ACCENT_DEEP,
      x: this.pageDir === "rtl" ? this.right - offset - nameWidth : this.left + offset,
      y: top - 15,
    });
    this.drawLine(this.brand.title, {
      size: 10,
      weight: "bold",
      colour: ACCENT,
      x: this.xFor(titleWidth, "end"),
      y: top - 15,
    });

    this.cursor = top - RUNNING_LOGO_HEIGHT - 8;
    this.brandRule(36, 1.6);
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
      const cells = row
        .map((cell): Cell => (typeof cell === "string" ? { text: cell } : cell))
        .map((cell) => (cell.text.trim() === "" ? { ...cell, text: EMPTY_CELL } : cell));
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

  signatures(labels: readonly string[]): void {
    const gap = 24;
    const width = Math.min(220, (this.width - gap * (labels.length - 1)) / labels.length);
    this.ensure(44);
    const y = this.cursor - 26;

    labels.forEach((label, index) => {
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

  title(value: string): void {
    this.doc.setTitle(value.replace(/[\u2066-\u2069]/gu, ""), { showInWindowTitleBar: true });
  }

  footer(label: (page: number, total: number) => string): void {
    this.footerLabel = label;
  }

  async save(): Promise<Buffer> {
    const current = this.page;

    this.pages.forEach((page, index) => {
      this.page = page;

      if (this.brand) {
        this.brandFooter(index + 1);
      } else if (this.footerLabel) {
        const text = this.footerLabel(index + 1, this.pages.length);
        this.drawLine(text, {
          size: 8,
          colour: MUTED,
          x: this.xFor(this.widthOf(text, 8), "centre"),
          y: this.margin / 2,
        });
      }
    });

    this.page = current;

    return Buffer.from(await this.doc.save());
  }

  private brandFooter(page: number): void {
    if (!this.brand) {
      return;
    }

    this.page.drawLine({
      start: { x: this.left, y: FOOTER_LINE },
      end: { x: this.right, y: FOOTER_LINE },
      thickness: 0.75,
      color: rgb(...ACCENT_RULE),
    });

    const label = this.footerLabel?.(page, this.pages.length) ?? "";
    const room = this.width - (label ? this.widthOf(label, 8.5, "medium") + 24 : 0);
    const name = this.clip(this.brand.name, room, { size: 8.5, weight: "medium" });
    const printed = this.clip(this.brand.printed, room, { size: 8 });
    this.drawLine(name, {
      size: 8.5,
      weight: "medium",
      colour: INK_SOFT,
      x: this.xFor(this.widthOf(name, 8.5, "medium"), "start"),
      y: FOOTER_LINE - 14,
    });
    this.drawLine(printed, {
      size: 8,
      colour: MUTED,
      x: this.xFor(this.widthOf(printed, 8), "start"),
      y: FOOTER_LINE - 26,
    });
    if (label) {
      this.drawLine(label, {
        size: 8.5,
        weight: "medium",
        colour: ACCENT_DEEP,
        x: this.xFor(this.widthOf(label, 8.5, "medium"), "end"),
        y: FOOTER_LINE - 20,
      });
    }

    this.page.drawRectangle({
      x: 0,
      y: 0,
      width: this.page.getWidth(),
      height: FOOTER_STRIP,
      color: rgb(...ACCENT),
    });
  }
}
