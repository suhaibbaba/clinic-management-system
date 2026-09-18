import { LAB_ORDER_STATUS, type LabOrderRow } from "@clinic/shared";
import { useRef, useState, type ChangeEvent, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import {
  Badge,
  Button,
  Drawer,
  Icon,
  Ltr,
  Modal,
  PersonName,
  Textarea,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { Money } from "@web/features/billing/money";
import { useClinic } from "@web/features/clinic/queries";
import { openLabOrderSheet } from "@web/features/labs/documents";
import { canCreateLabOrder } from "@web/features/labs/permissions";
import {
  useDeleteLabOrderAttachment,
  useLabOrderAttachments,
  useLabOrderStep,
  useReturnLabOrder,
  useUploadLabOrderAttachment,
} from "@web/features/labs/queries";
import { availableSteps, canReturn, LAB_ORDER_STATUS_STYLES } from "@web/features/labs/status";
import { errorMessageKey } from "@web/lib/api-error";
import { formatDate, formatDateTime } from "@web/lib/format";
import { cn } from "@clinic/ui/lib/cn";

export interface OrderDrawerProps {
  readonly "data-testid"?: string | undefined;
  readonly order: LabOrderRow | undefined;
  readonly onClose: () => void;
  readonly onEdit: (order: LabOrderRow) => void;
}

// The moves offered are the intersection of the shared transition map and who ROLES.md lets make
// each one, so a technician is never shown "fits".
export function OrderDrawer({
  order,
  onClose,
  onEdit,
  "data-testid": testId = "order-drawer",
}: OrderDrawerProps): JSX.Element | null {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const clinic = useClinic();

  const step = useLabOrderStep();
  const returnToLab = useReturnLabOrder();

  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");

  if (!order) {
    return null;
  }

  const style = LAB_ORDER_STATUS_STYLES[order.status];
  const steps = availableSteps(order.status, can);
  const busy = step.isPending || returnToLab.isPending;

  const move = async (next: (typeof steps)[number]): Promise<void> => {
    try {
      await step.mutateAsync({ id: order.id, step: next.step });
      toast.success("labs.order.moved");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const submitReturn = async (): Promise<void> => {
    try {
      await returnToLab.mutateAsync({ id: order.id, reason: reason.trim() });
      toast.success("labs.order.returned");
      setReturning(false);
      setReason("");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <>
      <Drawer
        data-testid={testId}
        open
        onOpenChange={(next) => !next && onClose()}
        descriptionKey="labs.order.description"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {order.workTypeName ?? t("labs.orders.custom")}
            <Badge tone={style.tone} data-testid={`${testId}-status`}>
              {t(style.label)}
            </Badge>
            {order.isOverdue && (
              <Badge tone="danger" data-testid={`${testId}-overdue`}>
                {t("labs.orders.overdue")}
              </Badge>
            )}
          </span>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((next) => (
              <Button
                key={next.step}
                variant={next.step === "cancel" ? "ghost" : "primary"}
                data-testid={`${testId}-step-${next.step}`}
                isLoading={busy}
                onClick={() => void move(next)}
              >
                {t(next.label)}
              </Button>
            ))}

            {canReturn(order.status, can) && (
              <Button
                variant="secondary"
                data-testid={`${testId}-return`}
                disabled={busy}
                onClick={() => setReturning(true)}
              >
                {t("labs.actions.return")}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <dl
            data-testid={`${testId}-details`}
            className="grid grid-cols-2 gap-x-4 gap-y-3 text-value"
          >
            <Field label={t("labs.order.lab")}>{order.labName}</Field>
            <Field label={t("labs.order.patient")}>
              <span className="flex flex-wrap items-baseline gap-2">
                <span>{order.patientName}</span>
                <Ltr className="tabular-nums text-ink-subtle">{order.patientFileNumber}</Ltr>
              </span>
            </Field>
            <Field label={t("labs.order.doctor")}>
              <PersonName name={order.doctorName} />
            </Field>

            {order.teeth.length > 0 && (
              <Field label={t("labs.order.teeth")}>
                <Ltr className="tabular-nums">{order.teeth.join(" · ")}</Ltr>
              </Field>
            )}

            {order.shade && <Field label={t("labs.order.shade")}>{order.shade}</Field>}
            {order.material && <Field label={t("labs.order.material")}>{order.material}</Field>}

            <Field label={t("labs.order.price")}>
              <Money amount={order.price} currency={clinic.data?.currency} />
            </Field>

            <Field label={t("labs.order.expected")}>
              {order.expectedAt ? (
                <Ltr className={order.isOverdue ? "text-danger-600" : undefined}>
                  {formatDate(order.expectedAt)}
                </Ltr>
              ) : (
                "—"
              )}
            </Field>

            {order.instructions && (
              <Field wide label={t("labs.order.instructions")}>
                {order.instructions}
              </Field>
            )}

            {order.returnReason && (
              <Field wide label={t("labs.order.returnReason")}>
                {order.returnReason}
              </Field>
            )}
          </dl>

          <OrderHistory order={order} />

          <Attachments orderId={order.id} />

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<Icon name="print" />}
              data-testid={`${testId}-print`}
              onClick={() => void openLabOrderSheet(order.id)}
            >
              {t("labs.order.print")}
            </Button>

            {order.status === LAB_ORDER_STATUS.DRAFT && canCreateLabOrder(can) && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="edit" />}
                data-testid={`${testId}-edit`}
                onClick={() => onEdit(order)}
              >
                {t("common.edit")}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="user" />}
              data-testid={`${testId}-open-file`}
              onClick={() => {
                onClose();
                void navigate(`/patients/${order.patientId}`);
              }}
            >
              {t("labs.order.openFile")}
            </Button>
          </div>
        </div>
      </Drawer>

      {/* A return says why: the reason travels to the lab on the next sheet and
          stays on the record afterwards, which is the whole point of asking. */}
      <Modal
        data-testid="lab-order-return-modal"
        open={returning}
        onOpenChange={setReturning}
        title="labs.order.returnTitle"
        description={t("labs.order.returnDescription")}
        footer={
          <>
            <Button
              variant="secondary"
              data-testid="lab-order-return-cancel"
              onClick={() => setReturning(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              data-testid="lab-order-return-confirm"
              isLoading={returnToLab.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => void submitReturn()}
            >
              {t("labs.actions.return")}
            </Button>
          </>
        }
      >
        <label htmlFor="lab-return-reason" className="mb-1.5 block text-label font-medium text-ink">
          {t("labs.order.returnReason")}
        </label>
        <Textarea
          id="lab-return-reason"
          data-testid="lab-order-return-reason"
          rows={3}
          placeholder={t("labs.order.returnReasonPlaceholder")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Modal>
    </>
  );
}

// The order's own timestamps. What was changed and by whom is the audit log's, and the audit log
// is read on the audit log screen.
function OrderHistory({ order }: { readonly order: LabOrderRow }): JSX.Element {
  const { t } = useTranslation();

  const stamps: readonly { key: string; label: string; at: string }[] = [
    { key: "created", label: "labs.order.history.created", at: order.createdAt },
    ...(order.sentAt ? [{ key: "sent", label: "labs.order.history.sent", at: order.sentAt }] : []),
    ...(order.receivedAt
      ? [{ key: "received", label: "labs.order.history.received", at: order.receivedAt }]
      : []),
    ...(order.fittedAt
      ? [{ key: "fitted", label: "labs.order.history.fitted", at: order.fittedAt }]
      : []),
  ];

  return (
    <section data-testid="lab-order-history" className="flex flex-col gap-2">
      <h3 className="text-value font-medium text-ink">{t("labs.order.history.title")}</h3>

      <ol className="flex flex-col gap-2">
        {stamps.map((stamp) => (
          <li
            key={stamp.key}
            data-testid={`lab-order-history-${stamp.key}`}
            className="flex items-baseline justify-between gap-3 text-label"
          >
            <span className="text-ink">{t(stamp.label)}</span>
            <Ltr className="tabular-nums text-ink-muted">{formatDateTime(stamp.at)}</Ltr>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Attachments({ orderId }: { readonly orderId: string }): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const attachments = useLabOrderAttachments(orderId);
  const upload = useUploadLabOrderAttachment();
  const remove = useDeleteLabOrderAttachment();

  const pick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      await upload.mutateAsync({ orderId, file });
      toast.success("labs.order.attachmentAdded");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <section data-testid="lab-order-attachments" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-value font-medium text-ink">{t("labs.order.attachments")}</h3>

        <Button
          size="sm"
          variant="secondary"
          icon={<Icon name="upload" />}
          data-testid="lab-order-attachment-add"
          isLoading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {t("labs.order.addAttachment")}
        </Button>

        <input
          ref={inputRef}
          type="file"
          data-testid="lab-order-attachment-input"
          className="sr-only"
          aria-label={t("labs.order.addAttachment")}
          onChange={(event) => void pick(event)}
        />
      </div>

      {attachments.data?.length === 0 && (
        <p data-testid="lab-order-no-attachments" className="text-label text-ink-muted">
          {t("labs.order.noAttachments")}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {attachments.data?.map((file) => (
          <li
            key={file.id}
            data-testid={`lab-order-attachment-${file.id}`}
            className="flex items-center gap-2 rounded-panel bg-inset px-3 py-2 text-label"
          >
            <Icon name="file" className="size-4 shrink-0 text-ink-subtle" />

            {file.url ? (
              <a
                href={file.url}
                data-testid="lab-order-attachment-open"
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-primary-700 hover:underline"
              >
                {file.filename}
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate text-ink">{file.filename}</span>
            )}

            <Button
              size="sm"
              variant="quiet"
              className="shrink-0 hover:text-danger-600"
              icon={<Icon name="trash" />}
              data-testid="lab-order-attachment-delete"
              aria-label={t("common.delete")}
              disabled={remove.isPending}
              onClick={() => void remove.mutateAsync({ orderId, id: file.id })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-ink">{children}</dd>
    </div>
  );
}
