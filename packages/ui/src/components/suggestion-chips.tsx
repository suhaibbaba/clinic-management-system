import type { JSX } from "react";
import { Chip } from "@ui/components/badge";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface Suggestion {
  /** Stable across locales, so a test and a `data-testid` do not move with the wording. */
  readonly key: string;
  readonly label: string;
}

export interface SuggestionChipsProps extends TestIdProps {
  readonly suggestions: readonly Suggestion[];
  readonly onPick: (suggestion: Suggestion) => void;
  readonly disabled?: boolean | undefined;
  readonly className?: string | undefined;
}

/** The openers on an empty conversation: one tap instead of a blank field and no idea what to ask. */
export function SuggestionChips({
  suggestions,
  onPick,
  disabled = false,
  className,
  "data-testid": testId,
}: SuggestionChipsProps): JSX.Element {
  const part = parts("suggestion-chips", testId);

  return (
    <div {...part()} className={cn("flex flex-wrap gap-2", className)}>
      {suggestions.map((suggestion) => (
        <Chip
          key={suggestion.key}
          {...(testId !== undefined && { "data-testid": `${testId}-${suggestion.key}` })}
          disabled={disabled}
          onClick={() => onPick(suggestion)}
        >
          {suggestion.label}
        </Chip>
      ))}
    </div>
  );
}
