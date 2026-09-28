export const putParam = (next: URLSearchParams, key: string, value: string): void => {
  if (value === "") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
};
