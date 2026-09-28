export function nest(target: Record<string, unknown>, key: string, value: string): void {
  const parts = key.split(".");
  let node = target;

  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (typeof next !== "object" || next === null) {
      node[part] = {};
    }
    node = node[part] as Record<string, unknown>;
  }

  node[parts[parts.length - 1]!] = value;
}
