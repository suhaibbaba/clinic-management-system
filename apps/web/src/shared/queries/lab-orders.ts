import type { CreateLabOrderInput, LabOrderRow } from "@clinic/shared";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LAB_ORDERS_KEY } from "@web/shared/constants/query-keys";
import { createLabOrder, deleteLabOrder, listPatientLabOrders } from "@web/shared/api/lab-orders";

export function usePatientLabOrders(
  patientId: string,
  enabled: boolean,
): UseQueryResult<readonly LabOrderRow[]> {
  return useQuery({
    queryKey: [LAB_ORDERS_KEY, "patient", patientId],
    queryFn: async () => (await listPatientLabOrders(patientId)).items,
    enabled,
  });
}

export function useCreateLabOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orders: readonly CreateLabOrderInput[]) => {
      const created: LabOrderRow[] = [];

      for (const order of orders) {
        created.push(await createLabOrder(order));
      }

      return created;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [LAB_ORDERS_KEY] }),
  });
}

export function useDeleteLabOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLabOrder,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [LAB_ORDERS_KEY] }),
  });
}
