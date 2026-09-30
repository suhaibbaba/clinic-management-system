import type { Doctor, PerformedProcedure, PerformedProcedureStatus } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Ltr, MenuItem, Money, PersonName, RowMenu, type IconName } from "@clinic/ui";
import {
  netPrice,
  nextStatuses,
  statusTone,
  treatmentSurfaces,
  treatmentTeeth,
} from "@web/modules/patients/lib/treatments/treatments";
import { formatDate, formatList } from "@web/shared/lib/format";

const MOVE_ICONS: Record<PerformedProcedureStatus, IconName> = {
  planned: "reset",
  in_progress: "clock",
  done: "check",
  cancelled: "x",
};

export interface TreatmentItemProps {
  readonly treatment: PerformedProcedure;
  readonly name: string;
  readonly doctor: Doctor | undefined;
  readonly currency: string | undefined;
  readonly showPrice: boolean;
  readonly mayChange: boolean;
  readonly mayDelete: boolean;
  readonly onMove: (status: PerformedProcedureStatus) => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onSendToLab?: (() => void) | undefined;
}

export function TreatmentItem({
  treatment,
  name,
  doctor,
  currency,
  showPrice,
  mayChange,
  mayDelete,
  onMove,
  onEdit,
  onDelete,
  onSendToLab,
}: TreatmentItemProps): JSX.Element {
  const { t } = useTranslation();
  const teeth = treatmentTeeth(treatment);
  const surfaces = treatmentSurfaces(treatment);
  const cancelled = treatment.status === "cancelled";
  const hasMenu = mayChange || mayDelete || onSendToLab !== undefined;

  return (
    <li
      data-testid={`treatment-${treatment.id}`}
      className="flex flex-col gap-1.5 rounded-panel border border-line bg-surface p-3"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={
              cancelled
                ? "truncate text-value font-medium text-ink-muted line-through"
                : "truncate text-value font-medium text-ink"
            }
          >
            {name}
          </p>
        </div>

        <Badge
          tone={statusTone(treatment.status)}
          data-testid="treatment-status"
          className="shrink-0"
        >
          {t(`chart.procedureStatus.${treatment.status}`)}
        </Badge>

        {hasMenu && (
          <RowMenu label={t("treatments.menu")} data-testid={`treatment-${treatment.id}-menu`}>
            {mayChange &&
              nextStatuses(treatment.status).map((status) => (
                <MenuItem
                  key={status}
                  icon={MOVE_ICONS[status]}
                  data-testid={`treatment-move-${status}`}
                  onSelect={() => onMove(status)}
                >
                  {t(`treatments.moveTo.${status}`)}
                </MenuItem>
              ))}
            {mayChange && (
              <MenuItem icon="edit" data-testid="treatment-edit" onSelect={onEdit}>
                {t("common.edit")}
              </MenuItem>
            )}
            {onSendToLab && (
              <MenuItem icon="clipboard" data-testid="treatment-send-to-lab" onSelect={onSendToLab}>
                {t("labs.sendToLab")}
              </MenuItem>
            )}
            {mayDelete && (
              <MenuItem
                icon="trash"
                tone="danger"
                data-testid="treatment-delete"
                onSelect={onDelete}
              >
                {t("common.delete")}
              </MenuItem>
            )}
          </RowMenu>
        )}
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-meta text-ink-muted">
        {teeth.length > 0 && (
          <div className="flex gap-1">
            <dt>{t("visits.teeth")}:</dt>
            <dd>
              <Ltr>{teeth.join(" · ")}</Ltr>
              {surfaces.length > 0 &&
                ` (${formatList(surfaces.map((surface) => t(`chart.surfaces.${surface}`)))})`}
            </dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt>{t("chart.panel.date")}:</dt>
          <Ltr as="dd">{formatDate(treatment.performedAt)}</Ltr>
        </div>
        <div className="flex gap-1">
          <dt>{t("chart.panel.doctor")}:</dt>
          <dd>
            <PersonName name={doctor?.user.name} />
          </dd>
        </div>
        {showPrice && (
          <div className="flex gap-1">
            <dt>{t("chart.panel.price")}:</dt>
            <dd>
              <Money amount={netPrice(treatment)} currency={currency} />
              {Number(treatment.discount) !== 0 && treatment.discountReason && (
                <span> · {treatment.discountReason}</span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {treatment.notes && (
        <p className="whitespace-pre-wrap text-meta text-ink">{treatment.notes}</p>
      )}
    </li>
  );
}
