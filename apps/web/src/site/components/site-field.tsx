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
    <div className="flex flex-col gap-1.5">
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
  return (
    <div dir={addon ? "ltr" : undefined} className="flex gap-2">
      {addon}
      <div className="relative flex-1">
        <SiteIcon
          name={icon}
          className="pointer-events-none absolute inset-y-0 start-3 my-auto text-ink-subtle"
        />
        <input
          id={id}
          {...(error && { "aria-invalid": true, "aria-describedby": `${id}-error` })}
          className={cx(FIELD_BOX, "min-h-(--control-h) ps-10 pe-3", fieldTone(error))}
          {...rest}
        />
      </div>
    </div>
  );
}
