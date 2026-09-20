import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

/** Five lines, then it scrolls: past that the thread above is what the writer has lost. */
const MAX_ROWS = 5;

export interface ChatComposerProps extends TestIdProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onSend: () => void;
  /** Present while an answer is arriving; its absence is what makes the send button the only one. */
  readonly onStop?: (() => void) | undefined;
  readonly streaming?: boolean | undefined;
  readonly placeholder: string;
  readonly sendLabel: string;
  readonly stopLabel: string;
  /** Sits above the field — the suggestion chips on an empty conversation. */
  readonly children?: ReactNode;
  readonly className?: string | undefined;
}

// Enter sends and Shift+Enter breaks the line, which is the convention every messaging app has
// taught; a composer that needs the mouse to send is one nobody uses twice.
export function ChatComposer({
  value,
  onValueChange,
  onSend,
  onStop,
  streaming = false,
  placeholder,
  sendLabel,
  stopLabel,
  children,
  className,
  "data-testid": testId,
}: ChatComposerProps): JSX.Element {
  const part = parts("chat-composer", testId);
  const field = useRef<HTMLTextAreaElement>(null);

  // Measured rather than counted: a wrapped line is a line, and `value.split("\n")` cannot see one.
  useLayoutEffect(() => {
    const node = field.current;

    if (!node) {
      return;
    }

    node.style.height = "auto";

    const line = Number.parseFloat(getComputedStyle(node).lineHeight) || 24;
    node.style.height = `${Math.min(node.scrollHeight, line * MAX_ROWS)}px`;
  }, [value]);

  const submit = useCallback(() => {
    if (!streaming && value.trim().length > 0) {
      onSend();
    }
  }, [onSend, streaming, value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const empty = value.trim().length === 0;

  return (
    <div {...part()} className={cn("flex flex-col gap-2.5", className)}>
      {children}

      <div
        {...part("shell")}
        className={cn(
          "flex items-end gap-2 rounded-card border-[1.5px] border-line-strong bg-surface p-2",
          "transition-[border-color,box-shadow] duration-150",
          "focus-within:border-primary-600 focus-within:shadow-field-focus",
        )}
      >
        <textarea
          ref={field}
          {...part("field")}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={streaming}
          onKeyDown={onKeyDown}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onValueChange(event.target.value)}
          className={cn(
            "min-h-(--control-h) flex-1 resize-none self-center border-none bg-transparent",
            "px-2 py-1.5 text-field text-ink outline-none placeholder:text-ink-subtle",
            "[unicode-bidi:plaintext] page-rtl:text-right page-ltr:text-left",
            "disabled:cursor-not-allowed disabled:text-ink-faint",
          )}
        />

        {streaming && onStop ? (
          <button
            type="button"
            {...part("stop")}
            onClick={onStop}
            aria-label={stopLabel}
            title={stopLabel}
            className={cn(
              "grid size-(--control-h) shrink-0 cursor-pointer place-items-center rounded-control",
              "border border-line-strong bg-surface text-ink-muted",
              "transition-colors duration-150 hover:bg-inset hover:text-ink",
            )}
          >
            <Icon name="stop" className="size-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            {...part("send")}
            onClick={submit}
            disabled={empty}
            aria-label={sendLabel}
            title={sendLabel}
            className={cn(
              "grid size-(--control-h) shrink-0 place-items-center rounded-control",
              "transition-colors duration-150",
              empty
                ? "cursor-not-allowed bg-inset text-ink-faint"
                : "cursor-pointer bg-primary-600 text-ink-inverse hover:bg-primary-500",
            )}
          >
            <Icon name="send" className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
