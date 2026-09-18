import type { ButtonHTMLAttributes, JSX, ReactNode } from "react";
import { Icon, type IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

/** The label chip that names what a figure counts — the reference's `.tag`, never a status. */
export type BadgeVariant = BadgeTone | "wash";

const TONES: Record<BadgeVariant, string> = {
  neutral: "bg-sunken text-ink-muted",
  success: "bg-success-100 text-success-900",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-600",
  info: "bg-primary-100 text-primary-600",
  // The reference's `.tag`: the label that names what a KPI figure counts, or what a panel lists.
  wash: "tag-wash text-primary-900",
};

/** One pill for the whole app: a status, a count, a filter — the same box in every one of them. */
export const PILL_BASE = cn(
  "pill-text inline-flex items-center h-(--control-h-sm) gap-2 whitespace-nowrap rounded-pill px-3",
  "text-label font-normal",
);

export interface BadgeProps extends TestIdProps {
  readonly tone?: BadgeVariant | undefined;
  /** Drops the dot where the badge is already inside a coloured context, or leads with an icon. */
  readonly plain?: boolean | undefined;
  readonly icon?: IconName | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function Badge({
  tone = "neutral",
  plain = false,
  icon,
  className,
  children,
  "data-testid": testId,
}: BadgeProps): JSX.Element {
  const part = parts("badge", testId);

  return (
    <span {...part()} className={cn(PILL_BASE, "min-w-0", TONES[tone], className)}>
      {icon !== undefined && <Icon name={icon} className="size-3.5 shrink-0" />}
      {!plain && icon === undefined && (
        <span
          {...part("dot")}
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-pill bg-current"
        />
      )}
      <span {...part("label")} className="min-w-0 truncate">
        {children}
      </span>
    </span>
  );
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement>, TestIdProps {
  readonly selected?: boolean | undefined;
  readonly children: ReactNode;
}

export function Chip({
  selected = false,
  className,
  children,
  type = "button",
  "data-testid": testId,
  ...props
}: ChipProps): JSX.Element {
  const disabled = props.disabled === true;

  return (
    <button
      type={type}
      {...parts("chip", testId)()}
      aria-pressed={selected}
      className={cn(
        PILL_BASE,
        "h-(--control-h) shrink-0 cursor-pointer border-[1.5px]",
        "transition-[background-color,border-color,color] duration-[250ms] ease-in-out",
        disabled && "cursor-not-allowed border-transparent bg-inset text-ink-faint",
        !disabled &&
          (selected
            ? "border-primary-600 bg-primary-100 text-primary-700"
            : "border-line-strong bg-surface text-ink-muted hover:bg-inset hover:border-neutral-400 hover:text-ink"),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
