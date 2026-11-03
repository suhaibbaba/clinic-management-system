import { LAB_ORDER_STATUS, type LabOrderRow, type PerformedProcedure } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Badge, ConfirmDialog, MenuItem, Money, RowMenu, useToast } from "@clinic/ui";
import { OrderFormModal } from "@web/modules/labs/components/order-form-modal";
import { treatmentTeeth } from "@web/modules/patients/lib/treatments/treatments";
import { LAB_ORDER_STATUS_STYLES } from "@web/shared/lib/lab-order-status";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import {
  canDeleteLabOrder,
  canEditLabOrder,
  canOpenLabOrders,
  canPriceLabWork,
} from "@web/shared/permissions/labs";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import { useDeleteLabOrder } from "@web/shared/queries/lab-orders";

export interface ToothLabOrdersProps {
  readonly orders: readonly LabOrderRow[];
  readonly treatments: readonly PerformedProcedure[];
  readonly procedureName: (treatment: PerformedProcedure) => string;
}

export function ToothLabOrders({
  orders,
  treatments,
  procedureName,
}: ToothLabOrdersProps): JSX.Element | null {
  const { t } = useTranslation();
  const { can } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = useCurrency();
  const remove = useDeleteLabOrder();

  const [editing, setEditing] = useState<LabOrderRow | undefined>();
  const [deleting, setDeleting] = useState<LabOrderRow | null>(null);

  const mayEdit = canEditLabOrder(can);
  const mayDelete = canDeleteLabOrder(can);
  const mayOpen = canOpenLabOrders(can);
  const showPrice = canPriceLabWork(can);

  const workOf = (order: LabOrderRow): string => order.workTypeName ?? order.labName;
  const linkedName = (order: LabOrderRow): string | null => {
    const linked = treatments.find((treatment) => treatment.id === order.performedProcedureId);
    return linked ? procedureName(linked) : null;
  };
  const choices = (order: LabOrderRow | undefined) =>
    treatments
      .filter((treatment) =>
        treatmentTeeth(treatment).some((tooth) => order?.teeth.includes(tooth)),
      )
      .map((treatment) => ({
        value: treatment.id,
        label: `${procedureName(treatment)} · ${treatmentTeeth(treatment).join(" · ")} · ${formatDate(treatment.performedAt)}`,
      }));

  if (orders.length === 0) {
    return null;
  }

  return (
    <section data-testid="tooth-panel-lab-orders" className="flex flex-col gap-2">
      <h3 className="text-label font-semibold text-ink">{t("chart.panel.labOrders")}</h3>

      <ol className="flex flex-col gap-2">
        {orders.map((order) => {
          const status = LAB_ORDER_STATUS_STYLES[order.status];
          const linkedTo = linkedName(order);
          const editable = mayEdit && order.status !== LAB_ORDER_STATUS.CANCELLED;

          return (
            <li
              key={order.id}
              data-testid={`tooth-panel-lab-order-${order.id}`}
              className="flex flex-col gap-1.5 rounded-panel border border-line bg-surface p-3"
            >
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 truncate text-value font-medium text-ink">
                  {workOf(order)}
                </p>
                <Badge tone={status.tone} className="shrink-0">
                  {t(status.label)}
                </Badge>
                {(editable || mayOpen || mayDelete) && (
                  <RowMenu
                    label={t("labs.order.editTitle")}
                    data-testid={`tooth-panel-lab-order-${order.id}-menu`}
                  >
                    {editable && (
                      <MenuItem
                        icon="edit"
                        data-testid="tooth-panel-lab-order-edit"
                        onSelect={() => setEditing(order)}
                      >
                        {t("common.edit")}
                      </MenuItem>
                    )}
                    {mayOpen && (
                      <MenuItem
                        icon="clipboard"
                        data-testid="tooth-panel-lab-order-open"
                        onSelect={() => navigate(`/labs?tab=orders&order=${order.id}`)}
                      >
                        {t("labs.order.open")}
                      </MenuItem>
                    )}
                    {mayDelete && (
                      <MenuItem
                        icon="trash"
                        tone="danger"
                        data-testid="tooth-panel-lab-order-delete"
                        onSelect={() => setDeleting(order)}
                      >
                        {t("labs.order.delete")}
                      </MenuItem>
                    )}
                  </RowMenu>
                )}
              </div>

              <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-meta text-ink-muted">
                <div className="flex gap-1">
                  <dt>{t("labs.order.lab")}:</dt>
                  <dd>{order.labName}</dd>
                </div>
                {showPrice && (
                  <div className="flex gap-1">
                    <dt>{t("labs.order.price")}:</dt>
                    <dd>
                      <Money amount={order.price} currency={currency} />
                    </dd>
                  </div>
                )}
                <div className="flex gap-1">
                  <dt>{t("labs.order.procedure")}:</dt>
                  <dd
                    data-testid="tooth-panel-lab-order-link"
                    className={linkedTo ? "text-ink" : "text-warning-700"}
                  >
                    {linkedTo ?? t("labs.order.noProcedure")}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>

      <OrderFormModal
        data-testid="tooth-panel-lab-order-modal"
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        order={editing}
        procedures={choices(editing)}
      />

      <ConfirmDialog
        data-testid="tooth-panel-lab-order-confirm-delete"
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="labs.order.confirmDelete.title"
        titleValues={{ work: deleting ? workOf(deleting) : "" }}
        consequences={[t("labs.order.confirmDelete.hidden"), t("labs.order.confirmDelete.kept")]}
        onConfirm={async () => {
          if (!deleting) {
            return;
          }

          try {
            await remove.mutateAsync(deleting.id);
            toast.success("labs.order.deleted");
          } catch (error) {
            toast.error(...errorToast(error));
            throw error;
          }
        }}
      />
    </section>
  );
}
