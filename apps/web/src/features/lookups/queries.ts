import {
  LOOKUP_LIST_KEYS,
  lookupLabel,
  type CreateLookupOptionInput,
  type LookupBundle,
  type LookupListKey,
  type LookupOption,
  type ReorderLookupOptionsInput,
  type UpdateLookupOptionInput,
} from '@clinic/shared';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { lookupsApi } from '@web/features/lookups/api';

const LOOKUPS_KEY = 'lookups';

/** One key per variant, so the settings screen's inactive rows never leak into a dropdown. */
export const lookupBundleKey = (includeInactive: boolean) =>
  [LOOKUPS_KEY, { includeInactive }] as const;

/**
 * Every editable list, fetched once and read by every dropdown in the app.
 *
 * One request for the whole bundle rather than one per dropdown: it is a few
 * kilobytes, most screens need several of these lists, and a single cache entry
 * cannot leave two dropdowns on the same screen disagreeing about what a code
 * means. Held for five minutes without a refetch — these change when an admin
 * edits them, which is rare, and every such edit invalidates this by hand.
 */
export function useLookups(includeInactive = false): UseQueryResult<LookupBundle> {
  return useQuery({
    queryKey: lookupBundleKey(includeInactive),
    queryFn: () => lookupsApi.bundle(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

/** One list, ready to render: empty while it loads rather than undefined. */
export function useLookupList(listKey: LookupListKey, includeInactive = false): LookupOption[] {
  const { data } = useLookups(includeInactive);

  return useMemo(() => data?.[listKey] ?? [], [data, listKey]);
}

export interface LookupChoice {
  readonly value: string;
  readonly label: string;
  readonly color: string | null;
}

/**
 * A list as `<Select>` options, labelled in the interface language.
 *
 * The label follows the reader, not the clinic: a locum with the interface in
 * English sees "Cash" where the receipt they print still says "نقداً", because
 * the receipt is the clinic's document and the screen is theirs.
 */
export function useLookupOptions(listKey: LookupListKey): LookupChoice[] {
  const options = useLookupList(listKey);
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(
    () =>
      options.map((option) => ({
        value: option.code,
        label: lookupLabel(option, language),
        color: option.color,
      })),
    [options, language],
  );
}

/**
 * Code → label, for the many places that display a stored code: a table cell,
 * a badge, a printed line in a drawer.
 *
 * Falls back to the code itself rather than to an empty cell — a row referring
 * to an option that has since been deleted should still say something.
 */
export function useLookupLabels(listKey: LookupListKey): (code: string | null) => string {
  const options = useLookupList(listKey, true);
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const labels = new Map(options.map((option) => [option.code, lookupLabel(option, language)]));

    return (code: string | null): string => (code ? (labels.get(code) ?? code) : '');
  }, [options, language]);
}

/**
 * Invalidates both bundle variants after an edit.
 *
 * Both, because the settings screen reads the one with inactive rows and every
 * other screen reads the one without; refreshing only the list you are looking
 * at is how a renamed option stays renamed on one screen and not the next.
 */
function useInvalidateLookups(): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries({ queryKey: [LOOKUPS_KEY] });
  };
}

export function useCreateLookupOption() {
  const invalidate = useInvalidateLookups();

  return useMutation({
    mutationFn: (body: CreateLookupOptionInput) => lookupsApi.create(body),
    onSuccess: invalidate,
  });
}

export function useUpdateLookupOption() {
  const invalidate = useInvalidateLookups();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateLookupOptionInput }) =>
      lookupsApi.update(id, body),
    onSuccess: invalidate,
  });
}

export function useReorderLookupOptions() {
  const invalidate = useInvalidateLookups();

  return useMutation({
    mutationFn: (body: ReorderLookupOptionsInput) => lookupsApi.reorder(body),
    onSuccess: invalidate,
  });
}

export function useDeleteLookupOption() {
  const invalidate = useInvalidateLookups();

  return useMutation({
    mutationFn: (id: string) => lookupsApi.remove(id),
    onSuccess: invalidate,
  });
}

export { LOOKUP_LIST_KEYS };
