import {
  lookupLabel,
  type CreateLookupOptionInput,
  type LookupBundle,
  type LookupListKey,
  type LookupOption,
  type ReorderLookupOptionsInput,
  type UpdateLookupOptionInput,
} from "@clinic/shared";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { lookupsApi } from "@web/features/lookups/api";

const LOOKUPS_KEY = "lookups";

/** One key per variant, so the settings screen's inactive rows never leak into a dropdown. */
export const lookupBundleKey = (includeInactive: boolean) =>
  [LOOKUPS_KEY, { includeInactive }] as const;

// One request for the whole bundle: a single cache entry cannot leave two dropdowns disagreeing
// about what a code means. Every admin edit invalidates it by hand.
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

export function useLookupLabels(listKey: LookupListKey): (code: string | null) => string {
  const options = useLookupList(listKey, true);
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const labels = new Map(options.map((option) => [option.code, lookupLabel(option, language)]));

    return (code: string | null): string => (code ? (labels.get(code) ?? code) : "");
  }, [options, language]);
}

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
