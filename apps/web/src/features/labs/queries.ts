import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  USER_ROLE,
  type AuditLogEntry,
  type CreateLabInput,
  type CreateLabOrderInput,
  type CreateLabPaymentInput,
  type CreateLabWorkTypeInput,
  type LabBalance,
  type LabOrderAttachment,
  type LabOrderRow,
  type LabPayment,
  type LabStatement,
  type LabSummary,
  type ListLabOrdersQuery,
  type ListLabsQuery,
  type Paginated,
  type StatementQuery,
  type UpdateLabInput,
  type UpdateLabOrderInput,
  type UpdateLabWorkTypeInput,
  type UserRole,
} from '@clinic/shared';

import { auditApi } from '@web/features/audit/api';
import { labOrdersApi, labsApi } from '@web/features/labs/api';
import { uploadToStorage } from '@web/features/patients/api';

export const LABS_KEY = 'labs';
export const LAB_ORDERS_KEY = 'lab-orders';
export const LAB_BALANCE_KEY = 'lab-balance';
export const LAB_STATEMENT_KEY = 'lab-statement';
export const LAB_PAYMENTS_KEY = 'lab-payments';
export const LAB_WORK_TYPES_KEY = 'lab-work-types';

/** The audit log's `entity` for an order — the table name, as the API writes it. */
export const LAB_ORDERS_ENTITY = 'lab_orders';

/**
 * Who sees the labs module at all (ROLES.md labs matrix).
 *
 * A receptionist appears in none of its rows, so they get no nav entry and no
 * route. That is presentation — the API refuses them either way.
 */
export const seesLabs = (role: UserRole | undefined): boolean =>
  role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.TECHNICIAN;

/**
 * Everything a write to this module can invalidate.
 *
 * A transition changes the board *and* the lab's balance *and* the statement —
 * an order that has just been sent is money owed — so every mutation
 * invalidates all of them rather than trying to be clever about which. Getting
 * that wrong leaves a balance chip disagreeing with the statement beside it.
 */
const LAB_KEYS = [LABS_KEY, LAB_ORDERS_KEY, LAB_BALANCE_KEY, LAB_STATEMENT_KEY, LAB_PAYMENTS_KEY];

function useLabMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of LAB_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export function useLabs(
  query: Partial<ListLabsQuery> = {},
  enabled = true,
): UseQueryResult<Paginated<LabSummary>> {
  return useQuery({
    queryKey: [LABS_KEY, query],
    queryFn: () => labsApi.list(query),
    enabled,
  });
}

export function useLab(id: string): UseQueryResult<LabSummary> {
  return useQuery({
    queryKey: [LABS_KEY, id],
    queryFn: () => labsApi.findOne(id),
    enabled: id !== '',
  });
}

export function useLabWorkTypes(labId: string, includeInactive = false) {
  return useQuery({
    queryKey: [LAB_WORK_TYPES_KEY, labId, includeInactive],
    queryFn: () => labsApi.workTypes(labId, includeInactive),
    enabled: labId !== '',
  });
}

export function useLabBalance(labId: string): UseQueryResult<LabBalance> {
  return useQuery({
    queryKey: [LAB_BALANCE_KEY, labId],
    queryFn: () => labsApi.balance(labId),
    enabled: labId !== '',
  });
}

export function useLabStatement(
  labId: string,
  query: StatementQuery,
): UseQueryResult<LabStatement> {
  return useQuery({
    queryKey: [LAB_STATEMENT_KEY, labId, query],
    queryFn: () => labsApi.statement(labId, query),
    enabled: labId !== '',
  });
}

export function useLabPayments(labId: string): UseQueryResult<Paginated<LabPayment>> {
  return useQuery({
    queryKey: [LAB_PAYMENTS_KEY, labId],
    queryFn: () => labsApi.payments(labId, { limit: 50 }),
    enabled: labId !== '',
  });
}

export function useLabOrders(
  query: Partial<ListLabOrdersQuery> = {},
  enabled = true,
): UseQueryResult<Paginated<LabOrderRow>> {
  return useQuery({
    queryKey: [LAB_ORDERS_KEY, query],
    queryFn: () => labOrdersApi.list(query),
    enabled,
    placeholderData: (previous) => previous,
  });
}

export function useOverdueLabOrders(enabled = true): UseQueryResult<LabOrderRow[]> {
  return useQuery({
    queryKey: [LAB_ORDERS_KEY, 'overdue'],
    queryFn: () => labOrdersApi.overdue(),
    enabled,
  });
}

export function useLabOrder(id: string): UseQueryResult<LabOrderRow> {
  return useQuery({
    queryKey: [LAB_ORDERS_KEY, 'one', id],
    queryFn: () => labOrdersApi.findOne(id),
    enabled: id !== '',
  });
}

/**
 * The order's own history, read back out of the audit log.
 *
 * The audit trail is the record of who moved this order and when — it is
 * written by the interceptor on every transition, so there is no second
 * history table to keep in step. It is admin-only (ROLES.md core matrix), so
 * this query is only enabled for an admin and the drawer falls back to the
 * order's own timestamps for everybody else.
 */
export function useLabOrderHistory(
  orderId: string,
  role: UserRole | undefined,
): UseQueryResult<Paginated<AuditLogEntry>> {
  return useQuery({
    queryKey: ['audit-log', LAB_ORDERS_ENTITY, orderId],
    queryFn: () => auditApi.list({ entity: LAB_ORDERS_ENTITY, entityId: orderId, limit: 50 }),
    enabled: orderId !== '' && role === USER_ROLE.ADMIN,
  });
}

export function useLabOrderAttachments(orderId: string): UseQueryResult<LabOrderAttachment[]> {
  return useQuery({
    queryKey: [LAB_ORDERS_KEY, orderId, 'attachments'],
    queryFn: () => labOrdersApi.attachments(orderId),
    enabled: orderId !== '',
  });
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export function useCreateLab() {
  return useLabMutation((input: CreateLabInput) => labsApi.create(input));
}

export function useUpdateLab() {
  return useLabMutation(({ id, body }: { id: string; body: UpdateLabInput }) =>
    labsApi.update(id, body),
  );
}

export function useCreateWorkType() {
  return useLabMutation(({ labId, body }: { labId: string; body: CreateLabWorkTypeInput }) =>
    labsApi.createWorkType(labId, body),
  );
}

export function useUpdateWorkType() {
  return useLabMutation(({ id, body }: { id: string; body: UpdateLabWorkTypeInput }) =>
    labsApi.updateWorkType(id, body),
  );
}

export function useCreateLabOrder() {
  return useLabMutation((input: CreateLabOrderInput) => labOrdersApi.create(input));
}

/** Only a draft may be edited; the API is what enforces that. */
export function useUpdateLabOrder() {
  return useLabMutation(({ id, body }: { id: string; body: UpdateLabOrderInput }) =>
    labOrdersApi.update(id, body),
  );
}

/** Every transition, through one mutation, so the invalidation is written once. */
export type LabOrderStep = 'send' | 'ready' | 'receive' | 'fit' | 'cancel';

export function useLabOrderStep() {
  return useLabMutation(({ id, step }: { id: string; step: LabOrderStep }) =>
    labOrdersApi[step === 'cancel' ? 'cancel' : step](id),
  );
}

export function useReturnLabOrder() {
  return useLabMutation(({ id, reason }: { id: string; reason: string }) =>
    labOrdersApi.returnToLab(id, reason),
  );
}

/** Presign → PUT to storage → confirm, the same three steps as an X-ray. */
export function useUploadLabOrderAttachment() {
  return useLabMutation(async ({ orderId, file }: { orderId: string; file: File }) => {
    const presigned = await labOrdersApi.presignAttachment(orderId, {
      filename: file.name,
      mime: file.type,
    });

    await uploadToStorage(presigned.uploadUrl, file);

    return labOrdersApi.confirmAttachment(orderId, {
      key: presigned.key,
      filename: file.name,
    });
  });
}

export function useDeleteLabOrderAttachment() {
  return useLabMutation(({ orderId, id }: { orderId: string; id: string }) =>
    labOrdersApi.deleteAttachment(orderId, id),
  );
}

export function usePayLab() {
  return useLabMutation((input: CreateLabPaymentInput) => labsApi.pay(input));
}

export function useReverseLabPayment() {
  return useLabMutation(({ id, reason }: { id: string; reason: string }) =>
    labsApi.reversePayment(id, { reason }),
  );
}
