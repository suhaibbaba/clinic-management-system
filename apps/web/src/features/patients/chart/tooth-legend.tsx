import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { ToothSwatch } from '@web/features/patients/chart/tooth-swatch';
import { useToothStates } from '@web/features/patients/chart/tooth-state';

/**
 * Colour key for the chart.
 *
 * It is not decoration: nine hues are more than anyone reliably tells apart, so
 * this is where a colour becomes a word. Every swatch is drawn with the same
 * style object the teeth use, so the two can never drift apart — including the
 * states a clinic added itself, which appear here the moment they are saved.
 */
export function ToothLegend(): JSX.Element {
  const { t } = useTranslation();
  const states = useToothStates();

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t('chart.legend')}>
      {states.all.map(({ code, label, style }) => {
        return (
          <li key={code} className="flex items-center gap-1.5 text-chart-text text-label">
            <ToothSwatch style={style} />
            {label}
          </li>
        );
      })}
    </ul>
  );
}
