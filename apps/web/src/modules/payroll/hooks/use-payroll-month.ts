import { useSearchParams } from "react-router-dom";
import { todayIso } from "@web/shared/lib/dates";
import { currentMonth, isMonth } from "@web/shared/lib/months";

export interface PayrollMonthState {
  readonly month: string;
  readonly thisMonth: string;
  readonly goTo: (month: string) => void;
}

export function usePayrollMonth(): PayrollMonthState {
  const [params, setParams] = useSearchParams();
  const thisMonth = currentMonth(todayIso());
  const requested = params.get("month") ?? thisMonth;
  const month = isMonth(requested) ? requested : thisMonth;

  const goTo = (next: string): void =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);

        if (next === thisMonth) {
          updated.delete("month");
        } else {
          updated.set("month", next);
        }

        return updated;
      },
      { replace: true },
    );

  return { month, thisMonth, goTo };
}
