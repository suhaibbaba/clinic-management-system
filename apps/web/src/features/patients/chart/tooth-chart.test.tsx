import { TOOTH_STATE } from '@clinic/shared';
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

  render(
    <ToothChart
      dentition="permanent"
      summaries={summaries}
      selectedTooth={selected}
      onSelect={onSelect}
    />,
  );

  return { onSelect };
}

const tooth = (fdi: number): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`\\b${fdi}\\b`) });

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
    const summaries = new Map<number, ToothSummary>([
      [
        18,
        {
          tooth: 18,
          state: TOOTH_STATE.MISSING,
          states: [TOOTH_STATE.MISSING],
          surfaces: [],
          procedureCount: 1,
        },
      ],
    ]);

    renderChart(summaries);

    const group = tooth(18);
    expect(group.querySelector('path')).toHaveAttribute('stroke-dasharray');
    expect(group).toHaveAccessibleName(new RegExp(ar.chart.states.missing));
  });
});
