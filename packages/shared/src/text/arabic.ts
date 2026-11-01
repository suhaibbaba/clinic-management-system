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

const LATIN_FOLDED = /ı|ş|ğ|ç|ö|ü|\u0307/g;

const LATIN_FOLD: Record<string, string> = {
  ı: "i",
  ş: "s",
  ğ: "g",
  ç: "c",
  ö: "o",
  ü: "u",
  "\u0307": "",
};

export function normalizeArabic(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(LATIN_FOLDED, (letter) => LATIN_FOLD[letter] ?? letter)
    .replace(REMOVED, "")
    .replace(FOLDED, (letter) => FOLD[letter] ?? letter)
    .replace(/\s+/g, " ")
    .trim();
}
