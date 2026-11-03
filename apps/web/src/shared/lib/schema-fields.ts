import type { ZodObject, ZodRawShape, ZodType } from "zod";

export type FieldNeed = { readonly required: true } | { readonly optional: true };

const REQUIRED_FIELD: FieldNeed = { required: true };
const OPTIONAL_FIELD: FieldNeed = { optional: true };

const unwrapped = (schema: ZodType): ZodType => {
  const inner = (schema as { unwrap?: () => ZodType }).unwrap;

  return typeof inner === "function" ? unwrapped(inner.call(schema)) : schema;
};

const fieldAt = (schema: ZodType, path: readonly string[]): ZodType | undefined =>
  path.reduce<ZodType | undefined>((current, key) => {
    const shape = current && (unwrapped(current) as { shape?: Record<string, ZodType> }).shape;

    return shape?.[key];
  }, schema);

export function fieldNeed(schema: ZodType, path: string): FieldNeed {
  const field = fieldAt(schema, path.split("."));

  return !field || field.safeParse(undefined).success ? OPTIONAL_FIELD : REQUIRED_FIELD;
}

export const fieldNeeds =
  <TShape extends ZodRawShape>(schema: ZodObject<TShape>) =>
  (field: keyof TShape & string): FieldNeed =>
    fieldNeed(schema, field);
