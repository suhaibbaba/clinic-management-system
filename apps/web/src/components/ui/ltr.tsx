import type { JSX, ReactNode } from 'react';

import { cn } from '@web/lib/cn';

export interface LtrProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  /**
   * The element to render. `span` by default; `dd`, `p` and `a` cover the
   * places a number is the whole of a definition, a line or a link.
   */
  readonly as?: 'span' | 'dd' | 'p' | 'div' | 'a' | undefined;
  /** Passed through when the island is a link — `tel:` and `mailto:`. */
  readonly href?: string | undefined;
  readonly title?: string | undefined;
}

/**
 * A left-to-right island inside a page that may be right-to-left.
 *
 * Phone numbers, money, dates, times, file numbers, tooth numbers, OTP codes,
 * versions, quantities — everything in this app that is Latin digits and
 * punctuation. Three things have to be true of every one of them, and each was
 * being remembered separately at forty-odd call sites:
 *
 * 1. **Its own direction.** `+963…` in an Arabic paragraph renders as `963…+`
 *    without it: the leading plus is a neutral character and the bidi
 *    algorithm hands it to the surrounding direction. Same for a minus sign in
 *    front of a refund and for the slashes in a date.
 *
 * 2. **Isolation from the text around it.** `dir` gives that in every browser
 *    that matters (`unicode-bidi: isolate` comes with it in the UA sheet), and
 *    it is what stops the number dragging a neighbouring comma or bracket to
 *    the wrong end of the line.
 *
 * 3. **Alignment that still belongs to the page.** This is the one that was
 *    quietly wrong everywhere. `text-align: start` resolves against the
 *    *element's* direction, so a `dir="ltr"` block inside an Arabic column
 *    aligned itself to the left while every line above and below it sat on the
 *    right: the time floated off the corner of its appointment, a file number
 *    hung off the far side of the patient's name, a lookup code drifted a
 *    whole card away from the option it belongs to.
 *
 *    `w-fit` is the fix, and it has to be a width rather than an alignment
 *    because these islands appear both as flex items — where `align-items:
 *    stretch` would otherwise blow them out to the full column and hand them
 *    back their own start edge — and as inline runs, where the parent's
 *    `text-align` should place them and does.
 *
 * So: one component, and the call sites stop having to know any of it.
 */
export function Ltr({ children, className, as = 'span', href, title }: LtrProps): JSX.Element {
  const Tag = as;

  return (
    <Tag
      dir="ltr"
      className={cn(
        // `inline-block` so the parent's own text-align positions the island,
        // `w-fit` so it never stretches to a column it does not fill, and
        // `whitespace-nowrap` because an amount, a date or a phone number is
        // one word: `200.00 USD` broken across two lines is not a number any
        // more, it is two.
        // `max-w-full` so a call site that asks for `truncate` still has a
        // box to truncate inside; without it the island would simply run past
        // the card it sits in.
        'inline-block w-fit max-w-full whitespace-nowrap',
        className,
      )}
      {...(href !== undefined && { href })}
      {...(title !== undefined && { title })}
    >
      {children}
    </Tag>
  );
}
