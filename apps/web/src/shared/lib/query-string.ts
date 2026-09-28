export const toQueryString = (
  params: Record<string, string | number | boolean | undefined>,
): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  return search.size > 0 ? `?${search.toString()}` : "";
};
