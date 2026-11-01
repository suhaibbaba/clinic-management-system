import type { PDFFont } from "pdf-lib";
import { RtlPdf, type Weight } from "@api/modules/billing/pdf/pdf-builder";
import type { TextDirection } from "@api/modules/billing/pdf/arabic-text";

type Piece = { text: string; font: PDFFont };

const piecesOf = (pdf: RtlPdf, text: string, weight: Weight): Piece[] =>
  (
    pdf as unknown as {
      pieces: (text: string, weight: Weight, dir: TextDirection) => Piece[];
    }
  ).pieces(text, weight, pdf.direction);

const uncovered = (pieces: Piece[]): string[] =>
  pieces.flatMap((piece) => {
    const glyphs = new Set(piece.font.getCharacterSet());

    return [...piece.text].filter((char) => !glyphs.has(char.codePointAt(0) ?? 0));
  });

const nameOf = (font: PDFFont): string => font.name.replace(/^[A-Z]{6}\+/u, "");

const familyOf = (pieces: Piece[], char: string): string | undefined => {
  const piece = pieces.find((candidate) => candidate.text.includes(char));

  return piece && nameOf(piece.font);
};

describe("the PDF builder's typefaces", () => {
  const turkish = "Kompozit dolgu — 1.250 ₺ · İş Şükrü Işık";
  const weights: Weight[] = ["regular", "medium", "bold"];

  it.each(weights)(
    "prints a Turkish line in %s with a glyph for every character",
    async (weight) => {
      const pdf = await RtlPdf.create({ direction: "ltr" });
      const pieces = piecesOf(pdf, turkish, weight);

      expect(uncovered(pieces)).toEqual([]);
      expect(pieces.every((piece) => nameOf(piece.font).startsWith("NotoSans-"))).toBe(true);
      expect(pdf.widthOf(turkish, 10, weight)).toBeGreaterThan(0);
      expect(pdf.drawLine(turkish, { x: pdf.left, y: pdf.y, size: 10, weight })).toBeGreaterThan(0);
      expect((await pdf.save()).length).toBeGreaterThan(0);
    },
  );

  it("keeps Tajawal for Arabic in a Latin document", async () => {
    const pdf = await RtlPdf.create({ direction: "ltr" });
    const pieces = piecesOf(pdf, "Dolgu حشوة", "regular");

    expect(familyOf(pieces, "ح")).toMatch(/^Tajawal-/u);
    expect(familyOf(pieces, "D")).toMatch(/^NotoSans-/u);
  });

  it("keeps an Arabic document on Tajawal, then Alef, and reaches Noto Sans only for what both lack", async () => {
    const pdf = await RtlPdf.create();
    const pieces = piecesOf(pdf, "حشوة 1.250 ₺ ş", "regular");

    expect(uncovered(pieces)).toEqual([]);
    expect(familyOf(pieces, "ح")).toMatch(/^Tajawal-/u);
    expect(familyOf(pieces, "1")).toMatch(/^Tajawal-/u);
    expect(familyOf(pieces, "ş")).toMatch(/^Alef-/u);
    expect(familyOf(pieces, "₺")).toMatch(/^NotoSans-/u);
  });
});
