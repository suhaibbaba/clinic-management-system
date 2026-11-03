import type { LabOrderRow } from "@clinic/shared";
import type { LabWorkOrder } from "@web/shared/lib/lab-work";
import { type UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LAB_ORDERS_KEY } from "@web/shared/constants/query-keys";
import {
  createLabOrder,
  deleteLabOrder,
  listPatientLabOrders,
  uploadLabOrderAttachment,
} from "@web/shared/api/lab-orders";

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

export interface CreatedLabOrders {
  readonly orders: readonly LabOrderRow[];
  readonly failedUploads: number;
}

export function useCreateLabOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (work: readonly LabWorkOrder[]): Promise<CreatedLabOrders> => {
      const orders: LabOrderRow[] = [];
      let failedUploads = 0;

      for (const item of work) {
        const created = await createLabOrder(item.order);
        orders.push(created);

        for (const file of item.files) {
          try {
            await uploadLabOrderAttachment(created.id, file);
          } catch {
            failedUploads += 1;
          }
        }
      }

      return { orders, failedUploads };
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
