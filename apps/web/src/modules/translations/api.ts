import type {
  SaveTranslationOverridesInput,
  TranslationBundle,
  TranslationOverride,
} from "@clinic/shared";
import { apiRequest } from "@web/shared/lib/api-client";

export const translationsApi = {
  bundle: (): Promise<TranslationBundle> => apiRequest("/translations"),
  overrides: (): Promise<TranslationOverride[]> => apiRequest("/translations/overrides"),
  save: (body: SaveTranslationOverridesInput): Promise<void> =>
    apiRequest("/translations/save", { method: "POST", body }),
};
