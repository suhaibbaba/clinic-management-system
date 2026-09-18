import type {
  DeleteTranslationOverrideInput,
  TranslationBundle,
  TranslationOverride,
  UpsertTranslationOverrideInput,
} from "@clinic/shared";

import { apiRequest } from "@web/lib/api-client";

export const translationsApi = {
  bundle: (): Promise<TranslationBundle> => apiRequest("/translations"),
  overrides: (): Promise<TranslationOverride[]> => apiRequest("/translations/overrides"),
  upsert: (body: UpsertTranslationOverrideInput): Promise<TranslationOverride> =>
    apiRequest("/translations", { method: "POST", body }),
  reset: (body: DeleteTranslationOverrideInput): Promise<void> =>
    apiRequest("/translations/reset", { method: "POST", body }),
};
