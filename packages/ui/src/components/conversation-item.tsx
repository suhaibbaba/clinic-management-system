import type { JSX, MouseEvent, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface ConversationItemProps extends TestIdProps {
  readonly title: string;
  /** Already formatted by the caller — the library owns no locale. Left out under a day heading. */
  readonly timestamp?: string | undefined;
  readonly selected?: boolean | undefined;
  /** The row's own address, so it opens in a new tab like any other link. */
  readonly href: string;
  readonly onSelect: () => void;
  /** The kebab, supplied by the caller because its items are the caller's. */
  readonly trailing?: ReactNode | undefined;
  readonly className?: string | undefined;
}

// A real link with the router's behaviour layered on: a plain click stays in the app, and
// ctrl/cmd/middle click opens the conversation in its own tab the way every other address does.
function routerClick(onSelect: () => void) {
  return (event: MouseEvent<HTMLAnchorElement>): void => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onSelect();
  };
}

export function ConversationItem({
  title,
  timestamp,
  selected = false,
  href,
  onSelect,
  trailing,
  className,
  "data-testid": testId,
}: ConversationItemProps): JSX.Element {
  const part = parts("conversation-item", testId);

  return (
    <div
      {...part()}
      data-selected={selected || undefined}
      className={cn("group/row relative flex items-center", className)}
    >
      <a
        href={href}
        {...part("link")}
        onClick={routerClick(onSelect)}
        aria-current={selected ? "page" : undefined}
        className={cn(
          "min-w-0 flex-1 rounded-nav px-3 py-2 pe-9 outline-none",
          "transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-primary-300",
          selected ? "bg-selected text-ink" : "text-ink-muted hover:bg-inset hover:text-ink",
        )}
      >
        <span {...part("title")} className="block truncate text-label [unicode-bidi:plaintext]">
          {title}
        </span>
        {timestamp !== undefined && (
          <span {...part("time")} className="mt-0.5 block truncate text-micro text-ink-faint">
            {timestamp}
          </span>
        )}
      </a>

      {trailing !== undefined && (
        <div
          {...part("actions")}
          // Always there for a keyboard, and out of the way of a pointer until the row is under it.
          className={cn(
            "absolute end-1.5 opacity-0 transition-opacity duration-150",
            "group-hover/row:opacity-100 focus-within:opacity-100",
            selected && "opacity-100",
          )}
        >
          {trailing}
        </div>
      )}
    </div>
  );
}
