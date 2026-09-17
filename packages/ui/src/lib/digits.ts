const ARABIC_INDIC = 0x0660;
const EASTERN_ARABIC_INDIC = 0x06f0;

/** Rewrites Arabic-Indic digits as ASCII and leaves everything else alone. */
export function foldDigits(value: string): string {
  let out = "";

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const arabic = code - ARABIC_INDIC;
    const eastern = code - EASTERN_ARABIC_INDIC;

    if (arabic >= 0 && arabic <= 9) {
      out += String(arabic);
    } else if (eastern >= 0 && eastern <= 9) {
      out += String(eastern);
    } else {
      out += character;
    }
  }

  return out;
}
