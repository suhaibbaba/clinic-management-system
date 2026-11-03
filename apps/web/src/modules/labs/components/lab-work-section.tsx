import type { LabOrderRow } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Icon, Money } from "@clinic/ui";
import { LabWorkModal } from "@web/modules/labs/components/lab-work-modal";
import { useSession } from "@web/shared/providers/session";
import { useCurrency } from "@web/shared/queries/clinic";
import { canPriceLabWork } from "@web/shared/permissions/labs";
import { LAB_ORDER_STATUS_STYLES } from "@web/shared/lib/lab-order-status";
import { formatDate } from "@web/shared/lib/format";
import type { LabWorkDraft } from "@web/shared/lib/lab-work";

export interface LabWorkSectionProps {
  readonly value: readonly LabWorkDraft[];
  readonly onChange: (next: LabWorkDraft[]) => void;
  readonly existing?: readonly LabOrderRow[] | undefined;
  readonly startAdding?: boolean | undefined;
}

type Editing = { readonly draft: LabWorkDraft | undefined };

export function LabWorkSection({
  value,
  onChange,
  existing = [],
  startAdding = false,
}: LabWorkSectionProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const { can } = useSession();
  const mayPrice = canPriceLabWork(can);
  const [editing, setEditing] = useState<Editing | null>(startAdding ? { draft: undefined } : null);

  const save = (draft: LabWorkDraft): void =>
    onChange(
      value.some((line) => line.key === draft.key)
        ? value.map((line) => (line.key === draft.key ? draft : line))
        : [...value, draft],
    );

  return (
    <section
      data-testid="lab-work-section"
      className="flex flex-col gap-3 border-t border-line pt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-value font-medium text-ink">{t("labs.work.title")}</h3>
        <Button
          size="sm"
          variant="secondary"
          icon={<Icon name="plus" />}
          data-testid="lab-work-add"
          onClick={() => setEditing({ draft: undefined })}
        >
          {t("labs.work.add")}
        </Button>
      </div>

      {(existing.length > 0 || value.length > 0) && (
        <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
          {existing.map((order) => (
            <li
              key={order.id}
              data-testid={`lab-work-existing-${order.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-meta text-ink-muted"
            >
              <span className="font-medium text-ink">{order.workTypeName ?? order.labName}</span>
              {order.workTypeName && <span>{order.labName}</span>}
              {mayPrice && <Money amount={order.price} currency={currency} />}
              <Badge tone={LAB_ORDER_STATUS_STYLES[order.status].tone} className="ms-auto">
                {t(LAB_ORDER_STATUS_STYLES[order.status].label)}
              </Badge>
            </li>
          ))}

          {value.map((line, index) => (
            <li
              key={line.key}
              data-testid={`lab-work-line-${index}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-meta text-ink-muted"
            >
              <span className="font-medium text-ink">{line.workTypeName || line.labName}</span>
              {line.workTypeName && <span>{line.labName}</span>}
              {mayPrice && line.price !== "" && <Money amount={line.price} currency={currency} />}
              {line.expectedAt && <span>{formatDate(line.expectedAt)}</span>}
              {line.files.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="file" className="size-3.5" />
                  {line.files.length}
                </span>
              )}
              <span className="ms-auto flex items-center gap-1">
                <Badge tone="info">{t("labs.work.new")}</Badge>
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<Icon name="edit" />}
                  data-testid={`lab-work-line-${index}-edit`}
                  aria-label={t("labs.work.edit")}
                  onClick={() => setEditing({ draft: line })}
                />
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<Icon name="trash" />}
                  data-testid={`lab-work-line-${index}-remove`}
                  aria-label={t("labs.work.remove")}
                  onClick={() => onChange(value.filter((other) => other.key !== line.key))}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      <LabWorkModal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        draft={editing?.draft}
        onSave={save}
      />
    </section>
  );
}
