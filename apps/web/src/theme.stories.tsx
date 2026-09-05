import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type JSX } from 'react';

import { TOOTH_STATE_STYLES, toothStateLabelKey } from '@web/features/patients/chart/tooth-state';

/**
 * The design language, read from the running stylesheet.
 *
 * Nothing on this page hard-codes a colour: every swatch resolves its own CSS
 * custom property at runtime, so the catalogue is generated from `theme.css`
 * rather than transcribed from it. Change a token and this page changes with
 * it — including the contrast ratios, which are computed here rather than
 * copied from a spreadsheet.
 */
const meta = {
  title: 'Design language/Colour',
  parameters: {
    layout: 'fullscreen',
    // The swatch grids are deliberately colour-only; the labels beside them
    // carry the meaning, and axe cannot know that.
    a11y: { test: 'off' },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
const SCALES = ['primary', 'success', 'danger', 'warning', 'neutral'] as const;

/** Resolved value of a custom property on :root, once the stylesheet is live. */
function useToken(name: string): string {
  const [value, setValue] = useState('');

  useEffect(() => {
    setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
  }, [name]);

  return value;
}

/* ── WCAG, computed live so a token change cannot leave a stale number ──── */

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));

  return 0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
}

function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function Swatch({ token, label }: { token: string; label: string }): JSX.Element {
  const value = useToken(token);
  const onWhite = value.startsWith('#') ? contrast(value, '#ffffff') : 0;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-14 rounded-md border border-line"
        style={{ backgroundColor: `var(${token})` }}
      />
      <span className="text-xs font-medium text-ink">{label}</span>
      <span className="font-mono text-[11px] text-ink-muted" dir="ltr">
        {value || '—'}
      </span>
      {onWhite > 0 && (
        <span className="text-[11px] text-ink-subtle" dir="ltr">
          {onWhite.toFixed(2)}:1 on white
        </span>
      )}
    </div>
  );
}

export const Scales: Story = {
  render: () => (
    <div className="flex flex-col gap-8 bg-canvas p-6" dir="ltr">
      <header>
        <h1 className="text-xl font-semibold text-ink">Scales</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Five families on one shared OKLCH lightness ramp, so the same step in any two of them
          carries the same weight. Step 600 is the logo blue itself. Use 600 and 700 for text and
          buttons on white (AA needs 4.5:1), 500 for large text and edges (3.0:1), and 400 and below
          for backgrounds only.
        </p>
      </header>

      {SCALES.map((scale) => (
        <section key={scale} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold capitalize text-ink">{scale}</h2>
          <div className="grid grid-cols-5 gap-3 md:grid-cols-10">
            {STEPS.map((step) => (
              <Swatch key={step} token={`--color-${scale}-${step}`} label={step} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

export const Semantic: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-canvas p-6" dir="ltr">
      <header>
        <h1 className="text-xl font-semibold text-ink">Semantic tokens</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          What components actually reference. A component names what a colour is for, never which
          step it happens to be, so a palette change lands in theme.css and nowhere else.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          '--color-surface',
          '--color-canvas',
          '--color-inset',
          '--color-sunken',
          '--color-selected',
          '--color-line',
          '--color-line-strong',
          '--color-ink',
          '--color-ink-muted',
          '--color-ink-subtle',
          '--color-ink-inverse',
        ].map((token) => (
          <Swatch key={token} token={token} label={token.replace('--color-', '')} />
        ))}
      </div>
    </div>
  ),
};

export const ToothChartStates: Story = {
  name: 'Tooth chart states',
  render: () => (
    <div className="flex flex-col gap-6 bg-canvas p-6" dir="ltr">
      <header>
        <h1 className="text-xl font-semibold text-ink">Tooth chart</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Re-derived from the scales above, so the chart reads as part of the brand rather than a
          stock rainbow. Only five hues exist and seven states need filling, so primary and warning
          each carry two — separated by lightness. Colour is never the only channel: each tooth
          announces its state in words and the legend pairs every swatch with a label.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Object.entries(TOOTH_STATE_STYLES).map(([state, style]) => (
          <div key={state} className="flex flex-col gap-2">
            <div
              className="flex h-16 items-center justify-center rounded-md border-2"
              style={{
                backgroundColor: style.fill,
                borderColor: style.stroke,
                borderStyle: style.dashed ? 'dashed' : 'solid',
              }}
            >
              <span className="text-sm font-semibold" style={{ color: style.ink }}>
                46
              </span>
            </div>
            <span className="text-xs text-ink">{state}</span>
            <span className="font-mono text-[11px] text-ink-subtle">
              {toothStateLabelKey(state as keyof typeof TOOTH_STATE_STYLES)}
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
};
