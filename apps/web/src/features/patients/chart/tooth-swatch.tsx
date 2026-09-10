import type { JSX } from 'react';

import type { ToothStateStyle } from '@web/features/patients/chart/tooth-state';

// Drawn from the same style object the teeth are, so a state cannot be one colour on the chart and
// another in the key. `theme.test.ts` allows this one file to name a colour.
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
