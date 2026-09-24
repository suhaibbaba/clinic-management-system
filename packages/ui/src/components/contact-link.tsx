import type { JSX } from "react";
import { Icon } from "@ui/components/icon";
import { Ltr } from "@ui/components/ltr";
import { cn } from "@ui/lib/cn";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface ContactLinkProps extends TestIdProps {
  /** The number or address as it is stored. Rendered verbatim. */
  readonly value: string | null | undefined;
  readonly className?: string | undefined;
  /** What to draw when there is nothing to link to. Defaults to an em dash. */
  readonly fallback?: JSX.Element | string | undefined;
}

const LINK_CLASS = cn(
  "text-primary-600 underline-offset-2 transition-colors duration-150",
  "hover:text-primary-700 hover:underline",
  // An absolutely positioned `::after` gives 44px of hit area with no layout: `inline-flex
  // min-h-11` bought the height out of the line box and dropped the number below its label.
  "relative inline-block",
  "after:absolute after:inset-x-0 after:top-1/2 after:h-(--control-h) after:-translate-y-1/2 after:content-[''] lg:after:hidden",
);

// `tel:` gets the digits stripped of spacing while the visible text stays as entered — that is what
// reception reads aloud. `<Ltr>`, or a leading `+` renders as `970599…+`.
export function PhoneLink({
  value,
  className,
  fallback = "—",
  "data-testid": testId,
}: ContactLinkProps): JSX.Element {
  if (value === null || value === undefined || value.trim() === "") {
    return <>{fallback}</>;
  }

  return (
    <Ltr
      as="a"
      data-part="phone-link"
      {...testid(testId)}
      href={`tel:${value.replace(/[^+\d]/g, "")}`}
      className={cn(LINK_CLASS, "tabular-nums", className)}
    >
      {value}
    </Ltr>
  );
}

// Same `<Ltr>` reasoning: the dot before a top-level domain is as neutral as the plus in a phone
// number.
export function EmailLink({
  value,
  className,
  fallback = "—",
  "data-testid": testId,
}: ContactLinkProps): JSX.Element {
  if (value === null || value === undefined || value.trim() === "") {
    return <>{fallback}</>;
  }

  return (
    <Ltr
      as="a"
      data-part="email-link"
      {...testid(testId)}
      href={`mailto:${value.trim()}`}
      className={cn(LINK_CLASS, className)}
    >
      {value}
    </Ltr>
  );
}

export interface WhatsAppLinkProps extends TestIdProps {
  /** International form, `+970599…`; anything else draws nothing. */
  readonly value: string | null | undefined;
  /** The visible text, and the name a screen reader announces. */
  readonly label: string;
  readonly className?: string | undefined;
}

// wa.me opens the chat in the app or on the web; nothing is sent until the reader sends it.
export function WhatsAppLink({
  value,
  label,
  className,
  "data-testid": testId,
}: WhatsAppLinkProps): JSX.Element | null {
  const digits = value?.trim().startsWith("+") ? value.replace(/\D/g, "") : "";

  if (digits === "") {
    return null;
  }

  return (
    <a
      data-part="whatsapp-link"
      {...testid(testId)}
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      title={value ?? undefined}
      className={cn(LINK_CLASS, "inline-flex items-center gap-1", className)}
    >
      <Icon name="message" className="size-4 shrink-0" />
      {label}
    </a>
  );
}
