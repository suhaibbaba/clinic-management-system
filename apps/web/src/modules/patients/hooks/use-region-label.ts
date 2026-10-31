import { BODY_SIDE, LOOKUP_LIST, type BodyRegionLocation } from "@clinic/shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLookupLabels } from "@web/shared/queries/lookups";

export function useRegionLabel(): (location: BodyRegionLocation) => string {
  const { t } = useTranslation();
  const regionName = useLookupLabels(LOOKUP_LIST.BODY_REGION);

  return useCallback(
    (location) =>
      location.side === undefined || location.side === BODY_SIDE.MIDLINE
        ? regionName(location.region)
        : t("chart.body.regionOnSide", {
            region: regionName(location.region),
            side: t(`chart.body.side.${location.side}`),
          }),
    [regionName, t],
  );
}
