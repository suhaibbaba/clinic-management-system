import type { ListDoctorsQuery, Paginated, Doctor } from "@clinic/shared";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { DOCTORS_KEY } from "@web/shared/constants/query-keys";
import { listDoctors } from "@web/shared/api/doctors";

export function useDoctors(query: Partial<ListDoctorsQuery>): UseQueryResult<Paginated<Doctor>> {
  return useQuery({
    queryKey: [DOCTORS_KEY, query],
    queryFn: () => listDoctors(query),
    placeholderData: (previous) => previous,
  });
}
