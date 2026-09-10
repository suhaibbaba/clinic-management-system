import bidiFactory from 'bidi-js';

// Joining first (on logical neighbours), then bidi. Presentation forms because pdf-lib maps glyphs
// by codepoint; runs stay logical, since fontkit reverses them.

const bidi = bidiFactory();

/** [isolated, final, initial, medial]. Two entries means right-joining: no initial or medial shape. */
const FORMS = new Map<number, readonly number[]>([
  [0x0621, [0xfe80]],
  [0x0622, [0xfe81, 0xfe82]],
  [0x0623, [0xfe83, 0xfe84]],
  [0x0624, [0xfe85, 0xfe86]],
  [0x0625, [0xfe87, 0xfe88]],
  [0x0626, [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c]],
  [0x0627, [0xfe8d, 0xfe8e]],
  [0x0628, [0xfe8f, 0xfe90, 0xfe91, 0xfe92]],
  [0x0629, [0xfe93, 0xfe94]],
  [0x062a, [0xfe95, 0xfe96, 0xfe97, 0xfe98]],
  [0x062b, [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c]],
  [0x062c, [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0]],
  [0x062d, [0xfea1, 0xfea2, 0xfea3, 0xfea4]],
  [0x062e, [0xfea5, 0xfea6, 0xfea7, 0xfea8]],
  [0x062f, [0xfea9, 0xfeaa]],
  [0x0630, [0xfeab, 0xfeac]],
  [0x0631, [0xfead, 0xfeae]],
  [0x0632, [0xfeaf, 0xfeb0]],
  [0x0633, [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4]],
  [0x0634, [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8]],
  [0x0635, [0xfeb9, 0xfeba, 0xfebb, 0xfebc]],
  [0x0636, [0xfebd, 0xfebe, 0xfebf, 0xfec0]],
  [0x0637, [0xfec1, 0xfec2, 0xfec3, 0xfec4]],
  [0x0638, [0xfec5, 0xfec6, 0xfec7, 0xfec8]],
  [0x0639, [0xfec9, 0xfeca, 0xfecb, 0xfecc]],
  [0x063a, [0xfecd, 0xfece, 0xfecf, 0xfed0]],
  [0x0641, [0xfed1, 0xfed2, 0xfed3, 0xfed4]],
  [0x0642, [0xfed5, 0xfed6, 0xfed7, 0xfed8]],
  [0x0643, [0xfed9, 0xfeda, 0xfedb, 0xfedc]],
  [0x0644, [0xfedd, 0xfede, 0xfedf, 0xfee0]],
  [0x0645, [0xfee1, 0xfee2, 0xfee3, 0xfee4]],
  [0x0646, [0xfee5, 0xfee6, 0xfee7, 0xfee8]],
  [0x0647, [0xfee9, 0xfeea, 0xfeeb, 0xfeec]],
  [0x0648, [0xfeed, 0xfeee]],
  [0x0649, [0xfeef, 0xfef0]],
  [0x064a, [0xfef1, 0xfef2, 0xfef3, 0xfef4]],
  [0x0671, [0xfb50, 0xfb51]],
  [0x067e, [0xfb56, 0xfb57, 0xfb58, 0xfb59]],
  [0x0686, [0xfb7a, 0xfb7b, 0xfb7c, 0xfb7d]],
  [0x0698, [0xfb8a, 0xfb8b]],
  [0x06a9, [0xfb8e, 0xfb8f, 0xfb90, 0xfb91]],
  [0x06af, [0xfb92, 0xfb93, 0xfb94, 0xfb95]],
  [0x06cc, [0xfbfc, 0xfbfd, 0xfbfe, 0xfbff]],
]);

const LAM = 0x0644;

/** Lam followed by one of these becomes a single ligature glyph. */
const LAM_ALEF = new Map<number, readonly [number, number]>([
  [0x0622, [0xfef5, 0xfef6]],
  [0x0623, [0xfef7, 0xfef8]],
  [0x0625, [0xfef9, 0xfefa]],
  [0x0627, [0xfefb, 0xfefc]],
]);

/** Harakat and other combining marks: invisible to the joining rules. */
const isTransparent = (cp: number): boolean =>
  (cp >= 0x064b && cp <= 0x065f) || cp === 0x0670 || (cp >= 0x06d6 && cp <= 0x06ed);

const joinsBackward = (cp: number): boolean => FORMS.has(cp);
const joinsForward = (cp: number): boolean => (FORMS.get(cp)?.length ?? 0) === 4;

export function shapeArabic(input: string): string {
  const cps = [...input].map((char) => char.codePointAt(0) ?? 0);
  const out: number[] = [];

  for (let i = 0; i < cps.length; i += 1) {
    const cp = cps[i] ?? 0;
    const next = cps[i + 1];

    if (cp === LAM && next !== undefined && LAM_ALEF.has(next)) {
      let before = i - 1;
      while (before >= 0 && isTransparent(cps[before] ?? 0)) before -= 1;

      const attached = before >= 0 && joinsForward(cps[before] ?? 0);
      out.push((LAM_ALEF.get(next) as readonly [number, number])[attached ? 1 : 0]);
      i += 1;
      continue;
    }

    const forms = FORMS.get(cp);
    if (!forms) {
      out.push(cp);
      continue;
    }

    let before = i - 1;
    while (before >= 0 && isTransparent(cps[before] ?? 0)) before -= 1;
    let after = i + 1;
    while (after < cps.length && isTransparent(cps[after] ?? 0)) after += 1;

    const attachedBefore = before >= 0 && joinsForward(cps[before] ?? 0);
    const attachedAfter = after < cps.length && joinsBackward(cps[after] ?? 0);
    const canJoinForward = forms.length === 4;

    let form = 0;
    if (attachedBefore && attachedAfter && canJoinForward) form = 3;
    else if (attachedBefore) form = 1;
    else if (attachedAfter && canJoinForward) form = 2;

    out.push(forms[Math.min(form, forms.length - 1)] ?? cp);
  }

  return String.fromCodePoint(...out);
}

export type TextDirection = 'rtl' | 'ltr';

export interface TextRun {
  /** Shaped, still in logical order — the PDF library reverses RTL runs. */
  readonly text: string;
  /** Even is left-to-right, odd is right-to-left. */
  readonly level: number;
}

// Bidi rule L2 at run granularity: from the deepest level down to the shallowest odd one, reverse
// every contiguous stretch at least that deep.
export function visualRuns(text: string, base: TextDirection = 'rtl'): TextRun[] {
  if (text === '') {
    return [];
  }

  const { levels } = bidi.getEmbeddingLevels(text, base);
  const chars = [...text];
  const runs: { text: string; level: number }[] = [];

  let start = 0;
  for (let i = 1; i <= chars.length; i += 1) {
    if (i === chars.length || levels[i] !== levels[start]) {
      runs.push({
        text: shapeArabic(chars.slice(start, i).join('')),
        level: levels[start] ?? 0,
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
