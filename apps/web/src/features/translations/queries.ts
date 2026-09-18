import type {
  SaveTranslationOverridesInput,
  TranslationBundle,
  TranslationOverride,
} from "@clinic/shared";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { translationsApi } from "@web/features/translations/api";

const TRANSLATIONS_KEY = "translations";

export const translationBundleKey = () => [TRANSLATIONS_KEY, "bundle"] as const;
export const translationOverridesKey = () => [TRANSLATIONS_KEY, "overrides"] as const;

// Every signed-in role reads it: it is the wording of their own screens, not an admin setting they
// are being shown. One entry, invalidated as a unit, so two screens cannot disagree on a word.
export function useTranslationBundle(enabled: boolean): UseQueryResult<TranslationBundle> {
  return useQuery({
    queryKey: translationBundleKey(),
    queryFn: translationsApi.bundle,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTranslationOverrides(): UseQueryResult<TranslationOverride[]> {
  return useQuery({
    queryKey: translationOverridesKey(),
    queryFn: translationsApi.overrides,
  });
}

export function useSaveTranslations(): UseMutationResult<
  void,
  Error,
  SaveTranslationOverridesInput
> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: translationsApi.save,
    onSuccess: () => invalidate(client),
  });
}

function invalidate(client: ReturnType<typeof useQueryClient>): void {
  void client.invalidateQueries({ queryKey: [TRANSLATIONS_KEY] });
}
