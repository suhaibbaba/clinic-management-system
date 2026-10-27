export function violatedConstraint(error: unknown, code: string): string | undefined {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === code) {
      const constraint = (current as { constraint_name?: unknown }).constraint_name;
      return typeof constraint === "string" ? constraint : undefined;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}
