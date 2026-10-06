const phrases = (text: string): string[] =>
  text
    .split(/[،,]/)
    .map((part) => part.trim())
    .filter((part) => part !== "");

export const hasInstruction = (text: string, phrase: string): boolean =>
  phrases(text).includes(phrase.trim());

export function toggleInstruction(text: string, phrase: string, separator: string): string {
  const kept = phrases(text);
  const next = hasInstruction(text, phrase)
    ? kept.filter((part) => part !== phrase.trim())
    : [...kept, phrase.trim()];

  return next.join(separator);
}
