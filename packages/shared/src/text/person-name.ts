export function personName(
  name: { readonly ar: string; readonly en: string } | null | undefined,
  language: string,
): string {
  if (!name) {
    return "";
  }

  const english = language.startsWith("en");
  const ar = typeof name.ar === "string" ? name.ar : "";
  const en = typeof name.en === "string" ? name.en : "";

  const preferred = english ? en : ar;

  return preferred.trim() !== "" ? preferred : english ? ar : en;
}
