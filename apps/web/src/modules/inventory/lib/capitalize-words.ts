export function capitalizeWords(value: string): string {
  return value.replace(
    /(^|[\s\-(])(\p{Ll})/gu,
    (_, before: string, letter: string) => `${before}${letter.toUpperCase()}`,
  );
}
