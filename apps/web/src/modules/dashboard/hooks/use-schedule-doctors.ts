import type { CalendarAppointment } from "@clinic/shared";
import { useMemo } from "react";
import { usePersonName } from "@clinic/ui";

export function useScheduleDoctors(
  rows: readonly CalendarAppointment[],
): readonly { readonly id: string; readonly label: string }[] {
  const displayName = usePersonName();

  return useMemo(() => {
    const byId = new Map<string, string>();

    for (const row of rows) {
      byId.set(row.doctorId, displayName(row.doctorName));
    }

    return [...byId.entries()].map(([id, label]) => ({ id, label }));
  }, [rows, displayName]);
}
