import type { JSX, ReactNode } from "react";
import { cx } from "@web/booking/ui";

const LINE = "h-px w-10 shrink-0 bg-primary-500 sm:w-16";

export function Eyebrow({
  align = "center",
  children,
}: {
  readonly align?: "start" | "center";
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <p
      className={cx(
        "flex max-w-full items-center gap-3 text-section font-medium text-primary-600 sm:gap-4",
        align === "center" ? "justify-center text-center" : "justify-start",
      )}
    >
      <span aria-hidden className={LINE} />
      <span className="min-w-0">{children}</span>
      {align === "center" && <span aria-hidden className={LINE} />}
    </p>
  );
}
