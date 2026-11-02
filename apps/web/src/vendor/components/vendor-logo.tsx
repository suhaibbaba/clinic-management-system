import { cn } from "@clinic/ui/lib/cn";
import type { JSX } from "react";

export function VendorLogo({
  size = "md",
  className,
}: {
  readonly size?: "md" | "lg";
  readonly className?: string | undefined;
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      data-testid="vendor-logo"
      className={cn(size === "lg" ? "size-14" : "size-10", "shrink-0", className)}
    >
      <rect width="48" height="48" rx="13" className="fill-primary-600" />
      <path
        d="M24 11.5a4 4 0 0 1 4 4V20h4.5a4 4 0 0 1 0 8H28v4.5a4 4 0 0 1-8 0V28h-4.5a4 4 0 0 1 0-8H20v-4.5a4 4 0 0 1 4-4Z"
        className="fill-ink-inverse"
      />
      <circle cx="24" cy="24" r="3.2" className="fill-primary-600" />
      <path d="M35 9.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4Z" className="fill-success-300" />
    </svg>
  );
}
