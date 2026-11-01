import { clinicLocale, type LanguageCode } from "@clinic/shared";
import { useSession } from "@web/shared/providers/session";

export function useClinicLanguages(): readonly LanguageCode[] {
  const clinic = useSession().user?.clinic;

  return clinic?.locale.languages ?? clinicLocale(clinic ?? null).languages;
}
