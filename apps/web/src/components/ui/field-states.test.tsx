import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from '@web/components/ui/input';
import { Select } from '@web/components/ui/select';

const LONG = 'مختبر الشرق الأوسط للتركيبات الثابتة والمتحركة وزراعة الأسنان — فرع رام الله';

const shell = (element: HTMLElement): HTMLElement => element.closest('.group') as HTMLElement;

// jsdom lays nothing out, so the claim "the icon does not move" is asserted as the contract that
// makes it true: the adornments never shrink, the value is the only thing that can, and the order
// of the three is the same in every state.
describe('a field truncates its value, never its adornments', () => {
  const states = [
    ['rest', {}],
    ['error', { hasError: true }],
    ['disabled', { disabled: true }],
  ] as const;

  it.each(states)('input keeps the adornment contract when %s', (_name, props) => {
    render(<Input aria-label="lab" adornment="search" defaultValue={LONG} {...props} readOnly />);

    const value = screen.getByLabelText('lab');

    expect(value).toHaveClass('min-w-0');
    expect(value).toHaveClass('truncate');
    expect(value).toHaveClass('flex-1');

    const adornments = [...shell(value).children].filter((child) => child !== value);
    expect(adornments.length).toBeGreaterThan(0);

    for (const adornment of adornments) {
      expect(adornment).toHaveClass('shrink-0');
    }
  });

  it.each(states)('select keeps the adornment contract when %s', (_name, props) => {
    render(
      <Select aria-label="lab" value="a" options={[{ value: 'a', label: LONG }]} {...props} />,
    );

    const trigger = screen.getByLabelText('lab');
    const [value, ...adornments] = [...trigger.children];

    expect(value).toHaveClass('min-w-0');
    expect(value).toHaveClass('truncate');

    for (const adornment of adornments) {
      expect(adornment).toHaveClass('shrink-0');
    }
  });

  it('names a disabled field with a lock, after the value', () => {
    render(<Select aria-label="lab" value="a" options={[{ value: 'a', label: LONG }]} disabled />);

    const trigger = screen.getByLabelText('lab');
    const last = trigger.lastElementChild;

    expect(last).toHaveClass('shrink-0');
    expect(last?.tagName.toLowerCase()).toBe('svg');
    expect(trigger.firstElementChild).toHaveClass('truncate');
  });
});

// Two tokens, and the app has no third. Ad-hoc heights are how five of them appeared last time.
describe('no control declares a height of its own', () => {
  const SRC = join(__dirname, '..', '..');

  /** A control's height, written as a number instead of a token. */
  const AD_HOC =
    /(?<![\w:-])(?:lg:|md:|sm:)?(?:min-)?(?:h|size)-(?:7|8|9|10|11|12|\[\d+px\])(?![\w-])/g;

  /**
   * Boxes that are not controls: a skeleton stands in for content, an icon plate and an avatar are
   * decoration, and a panel's own height is a layout, not something anybody presses.
   */
  const NOT_A_CONTROL = new Set([
    'skeleton.tsx',
    'empty-state.tsx',
    'entity-card.tsx',
    'icon.tsx',
    'stat-card.tsx',
    'switch.tsx',
    'alert-cards.tsx',
    'booking-wizard.tsx',
    'dashboard-page.tsx',
    'imaging-tab.tsx',
    'lookup-option-modal.tsx',
    'patient-balance-card.tsx',
    'patient-page.tsx',
    'schedule-timeline.tsx',
    'timeline-tab.tsx',
    'tooth-chart.tsx',
    'tooth-panel.tsx',
    'welcome-banner.tsx',
    'when-step.tsx',
    'app-layout.tsx',
  ]);

  /** A skeleton stands in for content that is not there yet; it is never pressed. */
  const isSkeleton = (line: string): boolean => /skeleton/i.test(line);

  function sources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return sources(path);
      }

      return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
    });
  }

  const withoutComments = (source: string): string =>
    source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/.*/g, '');

  it('sizes every one of them from --control-h or --control-h-sm', () => {
    const offenders = sources(SRC).flatMap((path) => {
      const file = path.split('/').at(-1) ?? '';

      if (NOT_A_CONTROL.has(file)) {
        return [];
      }

      const found = withoutComments(readFileSync(path, 'utf8'))
        .split('\n')
        .filter((line) => !isSkeleton(line))
        .flatMap((line) => [...line.matchAll(AD_HOC)].map((match) => match[0]));

      return found.length > 0 ? [`${file}: ${[...new Set(found)].join(', ')}`] : [];
    });

    expect(offenders).toEqual([]);
  });

  it('spells both of them in the theme, once', () => {
    const theme = readFileSync(join(SRC, 'theme.css'), 'utf8');

    expect(theme).toContain('--control-h: 44px;');
    expect(theme).toContain('--control-h-sm: 32px;');
  });
});
