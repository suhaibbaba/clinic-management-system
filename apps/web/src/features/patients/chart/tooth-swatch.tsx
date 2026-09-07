import type { JSX } from 'react';

import type { ToothStateStyle } from '@web/features/patients/chart/tooth-state';

/**
 * A tooth state's colour, as a square.
 *
 * The chart's legend and the settings screen both draw one, and they draw it
 * from the same style object the teeth themselves are painted with — so a
 * state cannot be one colour on the chart, another in the key beside it, and a
 * third in the list where somebody chose it.
 *
 * The colour is an inline style rather than a class because it is per state and
 * half of them are the clinic's own. `theme.test.ts` allows this one file for
 * that reason; nothing else in the app may name a colour.
 */
export function ToothSwatch({
  style,
  className,
}: {
  readonly style: ToothStateStyle;
  readonly className?: string;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={className ?? 'inline-block size-3.5 shrink-0 rounded-sm border'}
      style={{
        backgroundColor: style.fill,
        borderColor: style.stroke,
        borderStyle: style.dashed ? 'dashed' : 'solid',
      }}
    />
  );
}
