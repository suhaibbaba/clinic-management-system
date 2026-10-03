const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPrimitive = (value: unknown): boolean =>
  value === null || (typeof value !== "object" && typeof value !== "function");

export function countChanges(saved: unknown, current: unknown): number {
  if (Array.isArray(saved) && Array.isArray(current)) {
    if (saved.every(isPrimitive) && current.every(isPrimitive)) {
      const before = new Set(saved);
      const after = new Set(current);

      return (
        [...after].filter((item) => !before.has(item)).length +
        [...before].filter((item) => !after.has(item)).length
      );
    }

    const length = Math.max(saved.length, current.length);
    let total = 0;

    for (let index = 0; index < length; index += 1) {
      total += JSON.stringify(saved[index]) === JSON.stringify(current[index]) ? 0 : 1;
    }

    return total;
  }

  if (isPlainObject(saved) && isPlainObject(current)) {
    const keys = new Set([...Object.keys(saved), ...Object.keys(current)]);

    return [...keys].reduce((total, key) => total + countChanges(saved[key], current[key]), 0);
  }

  return JSON.stringify(saved) === JSON.stringify(current) ? 0 : 1;
}
