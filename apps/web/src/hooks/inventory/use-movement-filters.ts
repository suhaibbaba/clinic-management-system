import { MOVEMENT_TYPES, type MovementType } from "@clinic/shared";
import { subMonths } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { MOVEMENTS_DEFAULT_MONTHS } from "@web/constants/inventory";
import { toIsoDate } from "@web/lib/appointments/calendar-time";

export interface MovementFilters {
  readonly type: MovementType | undefined;
  readonly from: string;
  readonly to: string;
  readonly isNarrowed: boolean;
  readonly setType: (value: string) => void;
  readonly setRange: (from: string, to: string) => void;
}

export function useMovementFilters(): MovementFilters {
  const [params, setParams] = useSearchParams();
  const rawType = params.get("type");
  const from = params.get("from") ?? toIsoDate(subMonths(new Date(), MOVEMENTS_DEFAULT_MONTHS));
  const to = params.get("to") ?? "";

  const write = (change: (next: URLSearchParams) => void): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        change(next);
        next.delete("page");

        return next;
      },
      { replace: true },
    );

  return {
    type: MOVEMENT_TYPES.find((value) => value === rawType),
    from,
    to,
    isNarrowed: from !== "" || to !== "",
    setType: (value) =>
      write((next) => {
        if (value === "") {
          next.delete("type");
        } else {
          next.set("type", value);
        }
      }),
    setRange: (nextFrom, nextTo) =>
      write((next) => {
        next.set("from", nextFrom);
        next.set("to", nextTo);
      }),
  };
}
