/** Tashkeel, the superscript alef, Quranic marks, tatweel and the standalone hamza. */
const REMOVED = /[ً-ٰٕۖ-ۭـء]/g;

const FOLDED = /[أإآٱةىئؤ]/g;

const FOLD: Record<string, string> = {
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ٱ: "ا",
  ة: "ه",
  ى: "ي",
  ئ: "ي",
  ؤ: "و",
};

/** Folds an Arabic (or mixed) name to the form stored in `normalized_name` and searched against. */
export function normalizeArabic(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(REMOVED, "")
    .replace(FOLDED, (letter) => FOLD[letter] ?? letter)
    .replace(/\s+/g, " ")
    .trim();
}
