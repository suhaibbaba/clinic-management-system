import type { LabOrderRow } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Badge,
  Button,
  DatePicker,
  FormField,
  Icon,
  Input,
  Money,
  MoneyInput,
  Select,
} from "@clinic/ui";
import type { SelectOption } from "@clinic/ui/components/select";
import { useLabWorkTypes, useLabs } from "@web/modules/labs/queries";
import { useSession } from "@web/shared/providers/session";
import { useToothChart } from "@web/shared/hooks/use-tooth-chart";
import { useCurrency } from "@web/shared/queries/clinic";
import { canPriceLabWork } from "@web/shared/permissions/labs";
import { LAB_ORDER_STATUS_STYLES } from "@web/shared/lib/lab-order-status";
import { REQUIRED } from "@web/shared/lib/form-errors";
import { todayIso } from "@web/shared/lib/dates";
import { emptyLabWork, wholeAmount, type LabWorkDraft } from "@web/shared/lib/lab-work";

export interface LabWorkSectionProps {
  readonly idPrefix: string;
  readonly value: readonly LabWorkDraft[];
  readonly onChange: (next: LabWorkDraft[]) => void;
  readonly existing?: readonly LabOrderRow[] | undefined;
}

export function LabWorkSection({
  idPrefix,
  value,
  onChange,
  existing = [],
}: LabWorkSectionProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const { can } = useSession();
  const mayPrice = canPriceLabWork(can);
  const labs = useLabs({ limit: 100 });

  const labOptions = (labs.data?.items ?? [])
    .filter((lab) => lab.isActive)
    .map((lab) => ({ value: lab.id, label: lab.name }));

  const change = (key: string, patch: Partial<LabWorkDraft>): void =>
    onChange(value.map((line) => (line.key === key ? { ...line, ...patch } : line)));

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
          onClick={() => onChange([...value, emptyLabWork(crypto.randomUUID())])}
        >
          {t("labs.work.add")}
        </Button>
      </div>

      {existing.length > 0 && (
        <ul data-testid="lab-work-existing" className="flex flex-col gap-1.5">
          {existing.map((order) => (
            <li
              key={order.id}
              data-testid={`lab-work-existing-${order.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-panel border border-line px-3 py-2 text-meta text-ink-muted"
            >
              <span className="font-medium text-ink">{order.workTypeName ?? order.labName}</span>
              <span>{order.labName}</span>
              {mayPrice && <Money amount={order.price} currency={currency} />}
              <Badge tone={LAB_ORDER_STATUS_STYLES[order.status].tone} className="ms-auto">
                {t(LAB_ORDER_STATUS_STYLES[order.status].label)}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {value.length > 0 && (
        <ol className="flex flex-col divide-y divide-line">
          {value.map((line, index) => (
            <LabWorkLine
              key={line.key}
              id={`${idPrefix}-lab-${index}`}
              index={index}
              line={line}
              labOptions={labOptions}
              mayPrice={mayPrice}
              currency={currency}
              onChange={(patch) => change(line.key, patch)}
              onRemove={() => onChange(value.filter((other) => other.key !== line.key))}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function LabWorkLine({
  id,
  index,
  line,
  labOptions,
  mayPrice,
  currency,
  onChange,
  onRemove,
}: {
  readonly id: string;
  readonly index: number;
  readonly line: LabWorkDraft;
  readonly labOptions: readonly SelectOption[];
  readonly mayPrice: boolean;
  readonly currency: string | undefined;
  readonly onChange: (patch: Partial<LabWorkDraft>) => void;
  readonly onRemove: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toothChart = useToothChart();
  const workTypes = useLabWorkTypes(line.labId);
  const [labLeft, setLabLeft] = useState(false);

  const chooseWorkType = (workTypeId: string): void => {
    const listed = workTypes.data?.find((type) => type.id === workTypeId);
    onChange({ workTypeId, ...(listed && { price: wholeAmount(listed.defaultPrice) }) });
  };

  return (
    <li data-testid={`lab-work-line-${index}`} className="flex flex-col gap-3 py-4 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-label font-medium text-ink-muted">
          {t("labs.work.number", { number: index + 1 })}
        </h4>
        <Button
          icon={<Icon name="trash" />}
          variant="quiet"
          size="sm"
          data-testid={`lab-work-line-${index}-remove`}
          aria-label={t("labs.work.remove")}
          onClick={onRemove}
        />
      </div>

      <div className="grid gap-3 @lg:grid-cols-3">
        <div onBlur={() => setLabLeft(true)}>
          <FormField
            label="labs.order.lab"
            htmlFor={`${id}-lab`}
            required
            error={labLeft && line.labId === "" ? REQUIRED : undefined}
          >
            <Select
              id={`${id}-lab`}
              data-testid={`lab-work-line-${index}-lab`}
              value={line.labId}
              placeholder={t("labs.order.selectLab")}
              onChange={(event) =>
                onChange({ labId: event.target.value, workTypeId: "", price: "" })
              }
              options={labOptions}
            />
          </FormField>
        </div>

        <FormField
          label="labs.order.workType"
          htmlFor={`${id}-work-type`}
          hint={t("labs.order.workTypeHint")}
        >
          <Select
            id={`${id}-work-type`}
            data-testid={`lab-work-line-${index}-work-type`}
            value={line.workTypeId}
            disabled={line.labId === ""}
            placeholder={t("labs.order.selectWorkType")}
            onChange={(event) => chooseWorkType(event.target.value)}
            options={(workTypes.data ?? []).map((type) => ({ value: type.id, label: type.name }))}
          />
        </FormField>

        {mayPrice && (
          <FormField
            label="treatments.labCost"
            htmlFor={`${id}-price`}
            hint={t("labs.prices.snapshotNote")}
          >
            <MoneyInput
              id={`${id}-price`}
              data-testid={`lab-work-line-${index}-price`}
              currency={currency}
              placeholder="0"
              value={line.price}
              onChange={(event) => onChange({ price: event.target.value })}
            />
          </FormField>
        )}

        <FormField label="labs.order.expected" htmlFor={`${id}-expected`}>
          <DatePicker
            id={`${id}-expected`}
            data-testid={`lab-work-line-${index}-expected`}
            label={t("labs.order.expected")}
            value={line.expectedAt}
            min={todayIso()}
            onChange={(expectedAt) => onChange({ expectedAt })}
          />
        </FormField>

        {toothChart && (
          <FormField label="labs.order.shade" htmlFor={`${id}-shade`}>
            <Input
              id={`${id}-shade`}
              data-testid={`lab-work-line-${index}-shade`}
              placeholder="A2"
              value={line.shade}
              onChange={(event) => onChange({ shade: event.target.value })}
            />
          </FormField>
        )}

        <FormField label="labs.order.instructions" htmlFor={`${id}-instructions`}>
          <Input
            id={`${id}-instructions`}
            data-testid={`lab-work-line-${index}-instructions`}
            placeholder={t("labs.order.instructionsPlaceholder")}
            value={line.instructions}
            onChange={(event) => onChange({ instructions: event.target.value })}
          />
        </FormField>
      </div>
    </li>
  );
}
