import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";
import { cx } from "@web/booking/ui";

export function EditBarButton({
  label,
  icon: Glyph,
  part,
  available = true,
  onPress,
}: {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly part: string;
  readonly available?: boolean;
  readonly onPress: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-part={part}
      aria-label={label}
      title={label}
      aria-disabled={available ? undefined : true}
      onClick={() => {
        if (available) {
          onPress();
        }
      }}
      className={cx(
        "inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center rounded-control text-ink-muted",
        "hover:bg-inset hover:text-ink aria-disabled:cursor-not-allowed aria-disabled:text-ink-subtle aria-disabled:hover:bg-transparent",
      )}
    >
      <Glyph aria-hidden="true" focusable="false" strokeWidth={1.75} className="size-4" />
    </button>
  );
}
