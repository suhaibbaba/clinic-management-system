import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  LEGEND_STATES,
  TOOTH_STATE_STYLES,
  toothStateLabelKey,
} from '@web/features/patients/chart/tooth-state';

/**
 * Colour key for the chart.
 *
 * It is not decoration: nine hues are more than anyone reliably tells apart, so
 * this is where a colour becomes a word. Every swatch is drawn with the same
 * style object the teeth use, so the two can never drift apart.
 */
export function ToothLegend(): JSX.Element {
  const { t } = useTranslation();

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t('chart.legend')}>
      {LEGEND_STATES.map((state) => {
        const style = TOOTH_STATE_STYLES[state];

        return (
          <li key={state} className="flex items-center gap-1.5 text-chart-text text-label">
            <span
              aria-hidden="true"
              className="inline-block size-3.5 shrink-0 rounded-sm border"
              style={{
                backgroundColor: style.fill,
                borderColor: style.stroke,
                borderStyle: style.dashed ? 'dashed' : 'solid',
              }}
            />
            {t(toothStateLabelKey(state))}
          </li>
        );
      })}
    </ul>
  );
}
