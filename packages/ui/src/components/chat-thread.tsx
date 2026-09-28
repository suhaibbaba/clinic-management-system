import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

const AT_BOTTOM_SLACK = 56;

export interface ChatThreadProps extends TestIdProps {
  readonly children: ReactNode;
  readonly jumpLabel: string;
  readonly className?: string | undefined;
}

export function ChatThread({
  children,
  jumpLabel,
  className,
  "data-testid": testId,
}: ChatThreadProps): JSX.Element {
  const part = parts("chat-thread", testId);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    const node = viewport.current;

    if (node) {
      node.scrollTo({ top: node.scrollHeight, behavior });
    }
  }, []);

  const onScroll = useCallback(() => {
    const node = viewport.current;

    if (node) {
      setPinned(node.scrollHeight - node.scrollTop - node.clientHeight <= AT_BOTTOM_SLACK);
    }
  }, []);

  useEffect(() => {
    const node = content.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (pinned) {
        scrollToEnd("auto");
      }
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [pinned, scrollToEnd]);

  return (
    <div {...part()} className={cn("relative min-h-0 flex-1", className)}>
      <div
        ref={viewport}
        {...part("viewport")}
        onScroll={onScroll}
        tabIndex={0}
        className={cn(
          "h-full overflow-y-auto scroll-smooth px-4 py-5 sm:px-6",
          "outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
        )}
      >
        <div ref={content} {...part("content")} className="mx-auto flex max-w-3xl flex-col gap-4">
          {children}
        </div>
      </div>

      {!pinned && (
        <button
          type="button"
          {...part("jump")}
          onClick={() => {
            setPinned(true);
            scrollToEnd("smooth");
          }}
          className={cn(
            "absolute bottom-3 left-1/2 -translate-x-1/2",
            "inline-flex h-(--control-h-sm) items-center gap-1.5 rounded-pill px-3",
            "border border-line bg-surface text-label text-ink-muted shadow-float",
            "cursor-pointer transition-colors duration-150 hover:bg-inset hover:text-ink",
          )}
        >
          <Icon name="arrow-down" className="size-3.5" />
          {jumpLabel}
        </button>
      )}
    </div>
  );
}
