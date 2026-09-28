import bidiFactory from "bidi-js";

const bidi = bidiFactory();

export type TextDirection = "rtl" | "ltr";

export interface TextRun {
  readonly text: string;
  readonly level: number;
  readonly shapedRtl: boolean;
}

const RTL_LETTER = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u;

const BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

export const isolateLtr = (text: string): string => `\u2066${text}\u2069`;

export const hasRtlLetters = (text: string): boolean => RTL_LETTER.test(text);

export const mirror = (char: string): string => bidi.getMirroredCharacter(char) ?? char;

export function autoDirection(text: string, fallback: TextDirection): TextDirection {
  const { levels } = bidi.getEmbeddingLevels(text, fallback);
  const strong = [...text].findIndex((char) => /\p{L}/u.test(char));

  if (strong < 0) {
    return fallback;
  }

  return hasRtlLetters([...text][strong] ?? "") || (levels[strong] ?? 0) % 2 === 1 ? "rtl" : "ltr";
}

export function visualRuns(text: string, base: TextDirection = "rtl"): TextRun[] {
  if (text === "") {
    return [];
  }

  const { levels } = bidi.getEmbeddingLevels(text, base);
  const chars = [...text];
  const runs: { text: string; level: number; shapedRtl: boolean }[] = [];

  let start = 0;
  for (let i = 1; i <= chars.length; i += 1) {
    if (i === chars.length || levels[i] !== levels[start]) {
      const level = levels[start] ?? 0;
      const slice = chars.slice(start, i).join("").replace(BIDI_CONTROLS, "");
      const rtl = level % 2 === 1;
      const shapedRtl = rtl && hasRtlLetters(slice);

      const glyphs = rtl ? [...slice].map(mirror) : [...slice];

      runs.push({
        text: (rtl && !shapedRtl ? glyphs.reverse() : glyphs).join(""),
        level,
        shapedRtl,
      });
      start = i;
    }
  }

  const deepest = Math.max(...runs.map((run) => run.level));
  const shallowestOdd = Math.min(
    ...runs.map((run) => (run.level % 2 === 1 ? run.level : run.level + 1)),
  );

  for (let level = deepest; level >= shallowestOdd; level -= 1) {
    for (let i = 0; i < runs.length; i += 1) {
      if ((runs[i]?.level ?? 0) < level) {
        continue;
      }

      let end = i;
      while (end + 1 < runs.length && (runs[end + 1]?.level ?? 0) >= level) end += 1;

      const reversed = runs.slice(i, end + 1).reverse();
      runs.splice(i, reversed.length, ...reversed);
      i = end;
    }
  }

  return runs;
}
