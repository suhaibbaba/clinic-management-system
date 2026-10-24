export const FIELD_BOX =
  "w-full rounded-control border-[1.5px] bg-surface text-field text-ink placeholder:text-ink-subtle";

export const fieldTone = (error: string | undefined): string =>
  error
    ? "border-danger-600 shadow-field-error"
    : "border-line-strong hover:border-neutral-400 focus:border-primary-600 focus:shadow-field-focus";
