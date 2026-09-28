import type { ListPatientsQuery, Paginated, PatientView } from "@clinic/shared";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { PATIENTS_KEY } from "@web/shared/constants/query-keys";
import { listPatients } from "@web/shared/api/patients";

export function usePatients(
  query: Partial<ListPatientsQuery>,
  options: { readonly enabled?: boolean } = {},
): UseQueryResult<Paginated<PatientView>> {
  return useQuery({
    queryKey: [PATIENTS_KEY, query],
    queryFn: () => listPatients(query),
    enabled: options.enabled ?? true,
    placeholderData: (previous) => previous,
  });
}
