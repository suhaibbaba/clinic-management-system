import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";
import { SiteIcon } from "@web/site/components/site-icon";
import { FIELD_BOX, fieldTone } from "@web/site/lib/field-style";

export function Labelled({
  id,
  label,
  error,
  hint,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly error: string | undefined;
  readonly hint?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div data-part="labelled" className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && (
        <span id={`${id}-hint`} className="text-label text-ink-muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-label font-medium text-danger-700">
          {error}
        </span>
      )}
    </div>
  );
}

export function IconInput({
  id,
  icon,
  error,
  addon,
  ...rest
}: {
  readonly id: string;
  readonly icon: "user" | "mail" | "phone" | "shield";
  readonly error: string | undefined;
  readonly addon?: ReactNode;
} & Omit<JSX.IntrinsicElements["input"], "id">): JSX.Element {
  const invalid = error && { "aria-invalid": true, "aria-describedby": `${id}-error` };

  if (addon) {
    return (
      <div
        dir="ltr"
        data-part="joined-field"
        className={cx(
          FIELD_BOX,
          "flex min-h-(--control-h) items-stretch overflow-hidden transition-[border-color,box-shadow]",
          error
            ? "border-danger-600 shadow-field-error"
            : "border-line-strong hover:border-neutral-400 focus-within:border-primary-600 focus-within:shadow-field-focus",
          "[&_[data-part=select]]:h-auto [&_[data-part=select]]:w-auto [&_[data-part=select]]:rounded-none [&_[data-part=select]]:border-0 [&_[data-part=select]]:bg-transparent [&_[data-part=select]]:ps-3 [&_[data-part=select]]:pe-2 [&_[data-part=select]]:shadow-none [&_[data-part=select]]:hover:bg-primary-50",
        )}
      >
        {addon}
        <span aria-hidden className="my-2.5 w-px shrink-0 bg-line-strong" />
        <input
          id={id}
          {...invalid}
          className="min-w-0 flex-1 bg-transparent px-3 tabular-nums outline-none placeholder:text-ink-subtle"
          {...rest}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <SiteIcon
        name={icon}
        className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-subtle"
      />
      <input
        id={id}
        {...invalid}
        className={cx(FIELD_BOX, "min-h-(--control-h) ps-10 pe-3", fieldTone(error))}
        {...rest}
      />
    </div>
  );
}
