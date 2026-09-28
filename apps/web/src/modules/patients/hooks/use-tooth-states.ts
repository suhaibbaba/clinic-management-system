import { LOOKUP_LIST } from "@clinic/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildToothStates, type ToothStates } from "@web/modules/patients/lib/chart/tooth-state";
import { useLookupList } from "@web/modules/lookups/queries";

export function useToothStates(): ToothStates {
  const options = useLookupList(LOOKUP_LIST.TOOTH_STATE);
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => buildToothStates(options, language), [options, language]);
}
