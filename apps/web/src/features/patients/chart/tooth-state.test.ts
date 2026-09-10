import {
  LOOKUP_LIST,
  PERFORMED_PROCEDURE_STATUS,
  PROCEDURE_OUTCOME,
  TOOTH_STATE,
  type ToothState,
} from '@clinic/shared';
import { describe, expect, it } from 'vitest';

import {
  areaState,
  buildToothStates,
  deriveToothSummaries,
  procedureToothState,
  type OutcomeLookup,
  type ToothStates,
  type ToothSummary,
} from '@web/features/patients/chart/tooth-state';
import { makeCatalogItem, makeLookupBundle, makeProcedure } from '@test/helpers/fixtures';

const STATES: ToothStates = buildToothStates(
  makeLookupBundle()[LOOKUP_LIST.TOOTH_STATE] ?? [],
  'ar',
);

const VENEER = 'veneer';
const WITH_CUSTOM: ToothStates = buildToothStates(
  makeLookupBundle({
    [LOOKUP_LIST.TOOTH_STATE]: [
      { code: VENEER, nameAr: 'وجه تجميلي', nameEn: 'Veneer', color: '#7c3aed' },
    ],
  })[LOOKUP_LIST.TOOTH_STATE] ?? [],
  'ar',
);

const dominantState = (states: readonly string[]): string => STATES.dominant(states);

const CATALOG = {
  filling: 'catalog-filling',
  rootCanal: 'catalog-root-canal',
  crown: 'catalog-crown',
  implant: 'catalog-implant',
  bridge: 'catalog-bridge',
  extraction: 'catalog-extraction',
  cleaning: 'catalog-cleaning',
};

const OUTCOMES: OutcomeLookup = new Map([
  [CATALOG.filling, PROCEDURE_OUTCOME.FILLING],
  [CATALOG.rootCanal, PROCEDURE_OUTCOME.ROOT_CANAL],
  [CATALOG.crown, PROCEDURE_OUTCOME.CROWN],
  [CATALOG.implant, PROCEDURE_OUTCOME.IMPLANT],
  [CATALOG.bridge, PROCEDURE_OUTCOME.BRIDGE],
  [CATALOG.extraction, PROCEDURE_OUTCOME.MISSING],
  [CATALOG.cleaning, null],
]);

describe('tooth state derivation', () => {
  describe('one procedure', () => {
    it.each([
      [CATALOG.filling, TOOTH_STATE.FILLING],
      [CATALOG.rootCanal, TOOTH_STATE.ROOT_CANAL],
      [CATALOG.crown, TOOTH_STATE.CROWN],
      [CATALOG.implant, TOOTH_STATE.IMPLANT],
      [CATALOG.bridge, TOOTH_STATE.BRIDGE],
      [CATALOG.extraction, TOOTH_STATE.MISSING],
    ])('a finished %s charts as its catalog outcome', (procedureId, expected) => {
      const state = procedureToothState(
        { status: PERFORMED_PROCEDURE_STATUS.DONE, procedureId },
        OUTCOMES,
      );

      expect(state).toBe(expected);
    });

    it('charts nothing for a finished procedure with no outcome', () => {
      expect(
        procedureToothState(
          { status: PERFORMED_PROCEDURE_STATUS.DONE, procedureId: CATALOG.cleaning },
          OUTCOMES,
        ),
      ).toBeNull();
    });

    it('charts nothing for a procedure the catalog does not know', () => {
      expect(
        procedureToothState(
          { status: PERFORMED_PROCEDURE_STATUS.DONE, procedureId: 'unknown' },
          OUTCOMES,
        ),
      ).toBeNull();
    });

    it('reports the status while the work is not finished, whatever it will become', () => {
      expect(
        procedureToothState(
          { status: PERFORMED_PROCEDURE_STATUS.PLANNED, procedureId: CATALOG.crown },
          OUTCOMES,
        ),
      ).toBe(TOOTH_STATE.PLANNED);

      expect(
        procedureToothState(
          { status: PERFORMED_PROCEDURE_STATUS.IN_PROGRESS, procedureId: CATALOG.crown },
          OUTCOMES,
        ),
      ).toBe(TOOTH_STATE.IN_PROGRESS);
    });
  });

  describe('precedence', () => {
    it("covers every state on the clinic's list, exactly once", () => {
      expect([...STATES.precedence].sort()).toEqual(Object.values(TOOTH_STATE).sort());
    });

    /* A clinic's own state is a restoration: below active work, above healthy. */
    it('ranks a state the clinic added below work under way and above healthy', () => {
      expect(WITH_CUSTOM.dominant([VENEER, TOOTH_STATE.IN_PROGRESS])).toBe(TOOTH_STATE.IN_PROGRESS);
      expect(WITH_CUSTOM.dominant([VENEER, TOOTH_STATE.HEALTHY])).toBe(VENEER);
    });

    it('falls back to healthy when nothing is recorded', () => {
      expect(dominantState([])).toBe(TOOTH_STATE.HEALTHY);
    });

    it('reads an extracted-then-implanted site as an implant, not a gap', () => {
      expect(dominantState([TOOTH_STATE.MISSING, TOOTH_STATE.IMPLANT])).toBe(TOOTH_STATE.IMPLANT);
    });

    it('shows active work over a finished restoration', () => {
      expect(dominantState([TOOTH_STATE.FILLING, TOOTH_STATE.IN_PROGRESS])).toBe(
        TOOTH_STATE.IN_PROGRESS,
      );
      expect(dominantState([TOOTH_STATE.CROWN, TOOTH_STATE.PLANNED])).toBe(TOOTH_STATE.PLANNED);
    });

    it('shows the more significant of two restorations', () => {
      expect(dominantState([TOOTH_STATE.FILLING, TOOTH_STATE.CROWN])).toBe(TOOTH_STATE.CROWN);
      expect(dominantState([TOOTH_STATE.FILLING, TOOTH_STATE.ROOT_CANAL])).toBe(
        TOOTH_STATE.ROOT_CANAL,
      );
    });

    it('is order-independent', () => {
      const states = [TOOTH_STATE.FILLING, TOOTH_STATE.CROWN, TOOTH_STATE.IN_PROGRESS];

      expect(dominantState(states)).toBe(dominantState([...states].reverse()));
    });
  });

  describe('colour map', () => {
    it('has an entry for every state', () => {
      for (const state of Object.values(TOOTH_STATE)) {
        expect(STATES.info(state).style).toBeDefined();
      }
    });

    it('marks only a missing tooth with a dashed outline', () => {
      const dashed = Object.values(TOOTH_STATE).filter((state) => STATES.info(state).style.dashed);

      expect(dashed).toEqual([TOOTH_STATE.MISSING]);
    });

    it('gives every state a distinct fill', () => {
      const fills = Object.values(TOOTH_STATE).map((state) => STATES.info(state).style.fill);

      expect(new Set(fills).size).toBe(fills.length);
    });

    it('paints a state the clinic added in the colour they chose', () => {
      expect(WITH_CUSTOM.info(VENEER).style).toMatchObject({
        fill: '#7c3aed',
        stroke: '#7c3aed',
        dashed: false,
      });
    });

    it('picks readable ink for it, so the tooth number does not vanish', () => {
      const light = buildToothStates(
        makeLookupBundle({
          [LOOKUP_LIST.TOOTH_STATE]: [{ code: 'pale', nameAr: 'فاتح', color: '#fef9c3' }],
        })[LOOKUP_LIST.TOOTH_STATE] ?? [],
        'ar',
      );

      expect(light.info('pale').style.ink).toBe('var(--color-tooth-ink-dark)');
      expect(WITH_CUSTOM.info(VENEER).style.ink).toBe('var(--color-tooth-ink)');
    });

    it('gives a custom state no special shape, and paints the whole tooth', () => {
      expect(WITH_CUSTOM.info(VENEER)).toMatchObject({ area: 'whole', shape: undefined });
    });

    it("names it in the reader's language", () => {
      const english = buildToothStates(
        makeLookupBundle({
          [LOOKUP_LIST.TOOTH_STATE]: [
            { code: VENEER, nameAr: 'وجه تجميلي', nameEn: 'Veneer', color: '#7c3aed' },
          ],
        })[LOOKUP_LIST.TOOTH_STATE] ?? [],
        'en',
      );

      expect(english.info(VENEER).label).toBe('Veneer');
      expect(WITH_CUSTOM.info(VENEER).label).toBe('وجه تجميلي');
    });
  });

  describe('summaries', () => {
    it('summarises one tooth from its procedures', () => {
      const summaries = deriveToothSummaries(
        [
          makeProcedure(46, { id: 'a', procedureId: CATALOG.filling }),
          makeProcedure(46, { id: 'b', procedureId: CATALOG.crown }),
        ],
        OUTCOMES,
        STATES,
      );

      const tooth = summaries.get(46);
      expect(tooth?.state).toBe(TOOTH_STATE.CROWN);
      expect(tooth?.procedureCount).toBe(2);
      expect(tooth?.states).toEqual([TOOTH_STATE.CROWN, TOOTH_STATE.FILLING]);
    });

    it('collects the surfaces every procedure touched, without duplicates', () => {
      const withSurfaces = makeProcedure(46, { id: 'a', procedureId: CATALOG.filling });
      const other = makeProcedure(46, { id: 'b', procedureId: CATALOG.filling });
      other.chartMarks = [
        { ...other.chartMarks![0]!, location: { tooth: 46, surfaces: ['M', 'O'] } },
      ];

      const tooth = deriveToothSummaries([withSurfaces, other], OUTCOMES, STATES).get(46);

      expect([...(tooth?.surfaces ?? [])].sort()).toEqual(['M', 'O']);
    });

    it('leaves a tooth out entirely when nothing touched it', () => {
      const summaries = deriveToothSummaries([makeProcedure(46)], OUTCOMES, STATES);

      expect(summaries.has(11)).toBe(false);
    });

    it('counts a procedure that charts nothing but still records it on the tooth', () => {
      const summaries = deriveToothSummaries(
        [makeProcedure(46, { procedureId: CATALOG.cleaning })],
        OUTCOMES,
        STATES,
      );

      // The tooth is not coloured, but the panel must still show the cleaning.
      expect(summaries.get(46)).toMatchObject({
        state: TOOTH_STATE.HEALTHY,
        procedureCount: 1,
      });
    });

    it('ignores a procedure with no chart mark at all', () => {
      const wholeMouth = makeProcedure(46, { chartMarks: [] });

      expect(deriveToothSummaries([wholeMouth], OUTCOMES, STATES).size).toBe(0);
    });

    it('reads the outcome straight off a catalog item', () => {
      const item = makeCatalogItem();
      const summaries = deriveToothSummaries(
        [makeProcedure(46, { procedureId: item.id })],
        new Map([[item.id, item.chartOutcome]]),
        STATES,
      );

      expect(summaries.get(46)?.state).toBe(TOOTH_STATE.FILLING);
    });
  });

  describe('areaState', () => {
    const summary = (states: readonly ToothState[]): ToothSummary => ({
      tooth: 16,
      state: states[0]!,
      states,
      surfaces: [],
      procedureCount: states.length,
    });

    it('gives the root and the crown their own states', () => {
      // The pair the single-fill chart could not draw: precedence put the
      // crown on top and the canal underneath it disappeared.
      const both = summary([TOOTH_STATE.CROWN, TOOTH_STATE.ROOT_CANAL]);

      expect(areaState(both, 'root', STATES)).toBe(TOOTH_STATE.ROOT_CANAL);
      expect(areaState(both, 'crown', STATES)).toBe(TOOTH_STATE.CROWN);
    });

    it('leaves the other half healthy rather than unpainted', () => {
      const crownOnly = summary([TOOTH_STATE.CROWN]);

      expect(areaState(crownOnly, 'root', STATES)).toBe(TOOTH_STATE.HEALTHY);
    });

    it('paints both halves for a state that is about the whole tooth', () => {
      const planned = summary([TOOTH_STATE.PLANNED]);

      expect(areaState(planned, 'root', STATES)).toBe(TOOTH_STATE.PLANNED);
      expect(areaState(planned, 'crown', STATES)).toBe(TOOTH_STATE.PLANNED);
    });

    it('lets a whole-tooth state outrank a half-tooth one, in precedence order', () => {
      // Work under way on a crowned tooth: the tooth is in progress, and
      // saying so on the crown matters more than the crown that is there.
      const working = summary([TOOTH_STATE.IN_PROGRESS, TOOTH_STATE.CROWN]);

      expect(areaState(working, 'crown', STATES)).toBe(TOOTH_STATE.IN_PROGRESS);
    });
  });
});
