import type { HTMLAttributes, JSX, ReactNode } from "react";

import { cn } from "@ui/lib/cn";

export type CardTone = "default" | "selected";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly tone?: CardTone | undefined;
  /** Drops the built-in padding for cards that manage their own (tables). */
  readonly flush?: boolean | undefined;
  readonly interactive?: boolean | undefined;
  readonly children: ReactNode;
}

// The selected edge is an `outline`, not a `border`: an outline takes no part in layout, so
// selecting a card does not nudge every neighbour.
export function Card({
  tone = "default",
  flush = false,
  interactive = false,
  className,
  children,
  ...props
}: CardProps): JSX.Element {
  return (
    <div
      data-part="card"
      className={cn(
        "rounded-card border border-line bg-surface shadow-card",
        // A quarter of a second, and Tailwind's curated property list: a lift moves `translate`,
        // not `transform`, so naming the latter animated nothing at all.
        "transition duration-[250ms] ease-in-out",
        !flush && "p-[18px_20px]",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:shadow-card-hover",
        tone === "selected" && "bg-selected outline outline-offset-[-1px] outline-selected-line",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
