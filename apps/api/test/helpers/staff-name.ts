/** A staff member's request fields from a sample name in each language: the first word, then the rest. */
export function staffName(ar: string, en: string) {
  const split = (name: string) => {
    const [first = name, ...rest] = name.trim().split(/\s+/);

    return { first, last: rest.length > 0 ? rest.join(" ") : first };
  };
  const arabic = split(ar);
  const english = split(en);

  return {
    firstName: { ar: arabic.first, en: english.first },
    lastName: { ar: arabic.last, en: english.last },
  };
}
