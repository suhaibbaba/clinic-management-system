import type { JSX } from "react";
import { cx } from "@web/booking/ui";

export function AccentRule({ className }: { readonly className?: string }): JSX.Element {
  return (
    <span aria-hidden className={cx("block h-0.5 w-12 rounded-pill bg-primary-500", className)} />
  );
}
