import type { FieldErrors as HookFieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";
import { schemaErrors } from "@web/shared/lib/form-errors";

export function payloadResolver<TValues extends FieldValues>(
  schema: ZodType,
  toPayload: (values: TValues) => unknown,
): Resolver<TValues> {
  return (values) => {
    const flat = schemaErrors(schema, toPayload(values));

    if (Object.keys(flat).length === 0) {
      return { values, errors: {} };
    }

    const errors: Record<string, unknown> = {};

    for (const [path, error] of Object.entries(flat)) {
      const segments = path.split(".").filter((segment) => segment !== "");
      let node = errors;

      segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
          node[segment] ??= error;
          return;
        }

        node[segment] ??= {};
        node = node[segment] as Record<string, unknown>;
      });
    }

    return { values: {}, errors: errors as HookFieldErrors<TValues> };
  };
}
