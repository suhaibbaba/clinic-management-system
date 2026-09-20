import type { JSX, ReactNode } from "react";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export type ChatAuthor = "user" | "assistant";

export interface ChatBubbleProps extends TestIdProps {
  readonly author: ChatAuthor;
  /** Shown in place of the body while the turn has produced no text yet. */
  readonly status?: ReactNode | undefined;
  /** Draws the caret after the last word: the answer is still arriving. */
  readonly streaming?: boolean | undefined;
  /** Sits under the body — the retry beside a failure, and nothing on a good turn. */
  readonly footer?: ReactNode | undefined;
  readonly tone?: "default" | "danger" | undefined;
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}

// The question and the answer are not the same object: one is a short accent bubble that hugs its
// text, the other a full-width card that will hold a table. `plaintext` on both, so a line that
// starts in English inside an Arabic thread runs the way it was typed.
export function ChatBubble({
  author,
  status,
  streaming = false,
  footer,
  tone = "default",
  className,
  children,
  "data-testid": testId,
}: ChatBubbleProps): JSX.Element {
  const part = parts("chat-bubble", testId);
  const mine = author === "user";

  return (
    <div
      {...part()}
      data-author={author}
      className={cn("flex w-full", mine ? "justify-end" : "justify-start", className)}
    >
      <div
        {...part("body")}
        className={cn(
          "min-w-0 rounded-panel px-4 py-3 text-value [unicode-bidi:plaintext]",
          mine
            ? "max-w-[min(42rem,85%)] bg-primary-600 text-ink-inverse"
            : "w-full border border-line bg-surface text-ink shadow-card",
          tone === "danger" && "border-danger-200 bg-danger-50 text-danger-700",
        )}
      >
        {status !== undefined && children === undefined ? (
          <div {...part("status")} className="text-label text-ink-muted">
            {status}
          </div>
        ) : (
          <>
            {children}
            {streaming && (
              <span
                {...part("caret")}
                aria-hidden="true"
                className={cn(
                  "ms-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] rounded-pill",
                  "bg-current motion-safe:animate-[chat-caret_1s_step-end_infinite]",
                )}
              />
            )}
          </>
        )}

        {footer !== undefined && (
          <div {...part("footer")} className="mt-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
