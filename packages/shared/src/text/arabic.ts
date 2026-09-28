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

export function normalizeArabic(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(REMOVED, "")
    .replace(FOLDED, (letter) => FOLD[letter] ?? letter)
    .replace(/\s+/g, " ")
    .trim();
}
