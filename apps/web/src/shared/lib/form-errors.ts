import type { FieldError } from "react-hook-form";
import type { ZodType } from "zod";

export type FieldErrors = Readonly<Record<string, FieldError>>;

export const FORM_ROOT = "";

export const REQUIRED: FieldError = { type: "invalid_type" };

export function schemaErrors(schema: ZodType, value: unknown): FieldErrors {
  const result = schema.safeParse(value);

  if (result.success) {
    return {};
  }

  const errors: Record<string, FieldError> = {};

  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".");
    const given = valueAt(value, issue.path);

    errors[key] ??=
      given === undefined || given === null || given === ""
        ? REQUIRED
        : { type: issue.code, message: issue.message };
  }

  return errors;
}

export function nestedErrors(errors: FieldErrors, prefix: string): FieldErrors {
  const start = `${prefix}.`;

  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith(start))
      .map(([key, error]) => [key.slice(start.length), error]),
  );
}

function valueAt(value: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<PropertyKey, unknown>)[segment];
  }

  return current;
}

export function shownErrors(errors: FieldErrors, left: readonly string[]): FieldErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) =>
      left.some((field) => key === field || key.startsWith(`${field}.`)),
    ),
  );
}

export function revealFirstError(root: ParentNode | null = document): void {
  requestAnimationFrame(() => {
    const field = root?.querySelector<HTMLElement>('[data-part="form-field-error"]')?.parentElement;

    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    field
      ?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, button")
      ?.focus({ preventScroll: true });
  });
}
