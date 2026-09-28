import { MOVEMENT_TYPES, type MovementType } from "@clinic/shared";
import { useSearchParams } from "react-router-dom";
import { useDateRangeParam, type DateRangeParam } from "@web/shared/hooks/use-date-range-param";
import { putParam } from "@web/shared/lib/url-params";

export interface MovementFilters extends DateRangeParam {
  readonly type: MovementType | undefined;
  readonly setType: (value: string) => void;
}

export function useMovementFilters(): MovementFilters {
  const [params, setParams] = useSearchParams();
  const range = useDateRangeParam();
  const rawType = params.get("type");

  return {
    ...range,
    type: MOVEMENT_TYPES.find((value) => value === rawType),
    setType: (value) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          putParam(next, "type", value);
          next.delete("page");

          return next;
        },
        { replace: true },
      ),
  };
}
