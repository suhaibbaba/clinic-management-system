import { TOOTH_STATE, type ToothState } from '@clinic/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToothChart } from '@web/features/patients/chart/tooth-chart';
import { deriveToothSummaries, type ToothSummary } from '@web/features/patients/chart/tooth-state';
import ar from '@web/i18n/locales/ar.json';
import '@web/i18n';
import { makeProcedure } from '@test/helpers/fixtures';

const CATALOG_ID = makeProcedure(11).procedureId;

function renderChart(
  summaries: ReadonlyMap<number, ToothSummary> = new Map(),
  { selected = null as number | null } = {},
) {
  const onSelect = vi.fn();

  const view = render(
    <ToothChart
      dentition="permanent"
      summaries={summaries}
      selectedTooth={selected}
      onSelect={onSelect}
    />,
  );

  return { onSelect, container: view.container };
}

const tooth = (fdi: number): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`\\b${fdi}\\b`) });

/** The CSS variables the chart paints with, so a test names a token not a hue. */
const TOKEN = {
  crown: 'var(--color-tooth-crown)',
  rootCanal: 'var(--color-tooth-root-canal)',
};

/** A summary map with one tooth carrying the given states, most significant first. */
const charted = (fdi: number, states: readonly ToothState[]): Map<number, ToothSummary> =>
  new Map([
    [
      fdi,
      {
        tooth: fdi,
        state: states[0]!,
        states,
        surfaces: [],
        procedureCount: states.length,
      },
    ],
  ]);

describe('ToothChart', () => {
  it('renders every tooth as a button', () => {
    renderChart();

    expect(screen.getAllByRole('button')).toHaveLength(32);
  });

  it('names each tooth by its number and its condition, not by colour alone', () => {
    const summaries = deriveToothSummaries(
      [makeProcedure(46, { procedureId: CATALOG_ID })],
      new Map([[CATALOG_ID, 'filling' as const]]),
    );

    renderChart(summaries);

    expect(screen.getByRole('button', { name: `السن 46 — حشوة، 1 معالجة` })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `السن 11 — ${ar.chart.states.healthy}` }),
    ).toBeInTheDocument();
  });

  it('marks the selected tooth as current', () => {
    renderChart(new Map(), { selected: 24 });

    expect(tooth(24)).toHaveAttribute('aria-current', 'true');
    expect(tooth(25)).not.toHaveAttribute('aria-current');
  });

  it('opens a tooth when it is clicked', async () => {
    const { onSelect } = renderChart();

    await userEvent.click(tooth(36));

    expect(onSelect).toHaveBeenCalledWith(36);
  });

  describe('keyboard navigation', () => {
    it('puts exactly one tooth in the tab order', () => {
      renderChart();

      const focusable = screen
        .getAllByRole('button')
        .filter((element) => element.getAttribute('tabindex') === '0');

      expect(focusable).toHaveLength(1);
      // The first tooth of the upper arch, as the viewer reads it.
      expect(focusable[0]).toHaveAccessibleName(new RegExp('\\b18\\b'));
    });

    it('starts the tab order on the selected tooth once there is one', () => {
      renderChart(new Map(), { selected: 33 });

      expect(tooth(33)).toHaveAttribute('tabindex', '0');
    });

    it('moves along the arch with the arrow keys, visually left to right', async () => {
      renderChart();
      tooth(18).focus();

      // 18 is the viewer's far left, so "right" walks towards the midline.
      await userEvent.keyboard('{ArrowRight}');
      expect(tooth(17)).toHaveFocus();

      await userEvent.keyboard('{ArrowRight}');
      expect(tooth(16)).toHaveFocus();

      await userEvent.keyboard('{ArrowLeft}');
      expect(tooth(17)).toHaveFocus();
    });

    it('crosses the midline rather than stopping at it', async () => {
      renderChart();
      tooth(11).focus();

      await userEvent.keyboard('{ArrowRight}');

      expect(tooth(21)).toHaveFocus();
    });

    it('stops at the ends of the arch', async () => {
      renderChart();
      tooth(18).focus();

      await userEvent.keyboard('{ArrowLeft}');

      expect(tooth(18)).toHaveFocus();
    });

    it('crosses between the arches, keeping the same position', async () => {
      renderChart();
      tooth(16).focus();

      await userEvent.keyboard('{ArrowDown}');
      expect(tooth(46)).toHaveFocus();

      await userEvent.keyboard('{ArrowUp}');
      expect(tooth(16)).toHaveFocus();
    });

    it('does not leave the chart at the top or the bottom', async () => {
      renderChart();
      tooth(16).focus();

      await userEvent.keyboard('{ArrowUp}');
      expect(tooth(16)).toHaveFocus();

      tooth(46).focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(tooth(46)).toHaveFocus();
    });

    it('jumps to the ends of the arch with Home and End', async () => {
      renderChart();
      tooth(13).focus();

      await userEvent.keyboard('{Home}');
      expect(tooth(18)).toHaveFocus();

      await userEvent.keyboard('{End}');
      expect(tooth(28)).toHaveFocus();
    });

    it.each(['{Enter}', ' '])('opens the focused tooth with %s', async (key) => {
      const { onSelect } = renderChart();
      tooth(26).focus();

      await userEvent.keyboard(key);

      expect(onSelect).toHaveBeenCalledWith(26);
    });
  });

  describe('deciduous mode', () => {
    it('shows 20 teeth instead of 32', () => {
      render(
        <ToothChart
          dentition="deciduous"
          summaries={new Map()}
          selectedTooth={null}
          onSelect={vi.fn()}
        />,
      );

      expect(screen.getAllByRole('button')).toHaveLength(20);
      expect(screen.getByRole('button', { name: new RegExp('\\b55\\b') })).toBeInTheDocument();
    });
  });

  it('shows a missing tooth with a dashed outline, not colour alone', () => {
    renderChart(charted(18, [TOOTH_STATE.MISSING]));

    const button = tooth(18);
    expect(button.querySelector('[stroke-dasharray]')).not.toBeNull();
    expect(button).toHaveAccessibleName(new RegExp(ar.chart.states.missing));
  });

  describe('anatomy', () => {
    it('draws the midline the quadrants are read against', () => {
      const { container } = renderChart();

      // Left of it is the patient's right (quadrants 1 and 4), right of it the
      // patient's left. Without it "the fifth one" has two answers.
      expect(container.querySelector('[data-chart-midline]')).not.toBeNull();
    });

    it('draws an upper molar with three roots and a lower one with two', () => {
      renderChart();

      // Four paths for an upper molar: three roots and a crown.
      expect(tooth(16).querySelectorAll('path')).toHaveLength(4);
      // Three for a lower one: two roots and a crown.
      expect(tooth(46).querySelectorAll('path')).toHaveLength(3);
      // Two for an incisor.
      expect(tooth(11).querySelectorAll('path')).toHaveLength(2);
    });

    it('paints the root and the crown of one tooth differently', () => {
      // The case the old single-fill chart could not show: a canal *under* a
      // crown. Precedence used to pick one and drop the other.
      renderChart(charted(16, [TOOTH_STATE.CROWN, TOOTH_STATE.ROOT_CANAL]));

      const paths = [...tooth(16).querySelectorAll('path')];
      const fills = paths.map((path) => path.getAttribute('fill'));

      // Three roots in the canal colour, then the crown in its own.
      expect(fills.slice(0, 3)).toEqual(Array.from({ length: 3 }, () => TOKEN.rootCanal));
      expect(fills[3]).toBe(TOKEN.crown);
    });

    it('replaces the root of an implant with a post rather than colouring it', () => {
      renderChart(charted(36, [TOOTH_STATE.IMPLANT, TOOTH_STATE.CROWN]));

      const button = tooth(36);
      // The threads are the tell: no other tooth draws lines inside itself.
      expect(button.querySelectorAll('line').length).toBeGreaterThan(0);
      // ...and the crown above it is still painted as a crown.
      const crown = [...button.querySelectorAll('path')].at(-1);
      expect(crown).toHaveAttribute('fill', TOKEN.crown);
    });

    it('joins adjacent bridged teeth with one bar', () => {
      const summaries = new Map<number, ToothSummary>([
        ...charted(24, [TOOTH_STATE.BRIDGE]),
        ...charted(25, [TOOTH_STATE.BRIDGE]),
        ...charted(26, [TOOTH_STATE.BRIDGE]),
      ]);

      renderChart(summaries);

      const bar = (fdi: number) => {
        const rect = tooth(fdi).querySelector('rect');
        return {
          from: Number(rect?.getAttribute('x')),
          to: Number(rect?.getAttribute('x')) + Number(rect?.getAttribute('width')),
        };
      };

      // Every bar but the first starts before its own tooth's box (x < 0) so
      // it overlaps the one reaching towards it. Getting that wrong drew the
      // appliance with a hairline gap between two of the teeth it joins, which
      // is exactly what a bridge is not.
      expect(bar(24)).toEqual({ from: 8, to: 54 });
      expect(bar(25)).toEqual({ from: -6, to: 54 });
      expect(bar(26)).toEqual({ from: -6, to: 40 });

      // The box is 48 wide, so each pair overlaps rather than meeting.
      expect(bar(24).to).toBeGreaterThan(48);
      expect(bar(25).from).toBeLessThan(0);

      // A bridged tooth on its own is not a bridge span.
      expect(tooth(34).querySelector('rect')).toBeNull();
    });
  });
});
