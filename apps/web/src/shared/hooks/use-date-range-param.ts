import { subMonths } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_HISTORY_MONTHS } from "@web/shared/constants/dates";
import { toIsoDate } from "@web/shared/lib/dates";

export interface DateRangeParam {
  readonly from: string;
  readonly to: string;
  readonly isNarrowed: boolean;
  readonly setRange: (from: string, to: string) => void;
}

export function useDateRangeParam(): DateRangeParam {
  const [params, setParams] = useSearchParams();
  const from = params.get("from") ?? toIsoDate(subMonths(new Date(), DEFAULT_HISTORY_MONTHS));
  const to = params.get("to") ?? "";

  return {
    from,
    to,
    isNarrowed: from !== "" || to !== "",
    setRange: (nextFrom, nextTo) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          next.set("from", nextFrom);
          next.set("to", nextTo);
          next.delete("page");

          return next;
        },
        { replace: true },
      ),
  };
}
