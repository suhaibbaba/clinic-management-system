import { useEffect, useRef, useState, type ChangeEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Icon,
  Input,
  Modal,
  MoneyInput,
  Select,
  Textarea,
} from "@clinic/ui";
import { useLabWorkTypes, useLabs } from "@web/modules/labs/queries";
import { useSession } from "@web/shared/providers/session";
import { useToothChart } from "@web/shared/hooks/use-tooth-chart";
import { useCurrency } from "@web/shared/queries/clinic";
import { canPriceLabWork } from "@web/shared/permissions/labs";
import { REQUIRED } from "@web/shared/lib/form-errors";
import { todayIso } from "@web/shared/lib/dates";
import { emptyLabWork, wholeAmount, type LabWorkDraft } from "@web/shared/lib/lab-work";

export interface LabWorkModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly draft?: LabWorkDraft | undefined;
  readonly onSave: (draft: LabWorkDraft) => void;
}

export function LabWorkModal({
  open,
  onOpenChange,
  draft,
  onSave,
}: LabWorkModalProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const toothChart = useToothChart();
  const { can } = useSession();
  const mayPrice = canPriceLabWork(can);
  const fileInput = useRef<HTMLInputElement>(null);

  const [line, setLine] = useState<LabWorkDraft>(() => emptyLabWork(""));
  const [labLeft, setLabLeft] = useState(false);

  const labs = useLabs({ limit: 100 }, open);
  const workTypes = useLabWorkTypes(line.labId);

  useEffect(() => {
    if (open) {
      setLine(draft ?? emptyLabWork(crypto.randomUUID()));
      setLabLeft(false);
    }
  }, [open, draft]);

  const change = (patch: Partial<LabWorkDraft>): void =>
    setLine((current) => ({ ...current, ...patch }));

  const labOptions = (labs.data?.items ?? [])
    .filter((lab) => lab.isActive || lab.id === line.labId)
    .map((lab) => ({ value: lab.id, label: lab.name }));

  const chooseLab = (labId: string): void =>
    change({
      labId,
      labName: labOptions.find((option) => option.value === labId)?.label ?? "",
      workTypeId: "",
      workTypeName: "",
      price: "",
    });

  const chooseWorkType = (workTypeId: string): void => {
    const listed = workTypes.data?.find((type) => type.id === workTypeId);
    change({
      workTypeId,
      workTypeName: listed?.name ?? "",
      ...(listed && { price: wholeAmount(listed.defaultPrice) }),
    });
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    change({ files: [...line.files, ...picked] });
  };

  const ready = line.labId !== "";

  const save = (): void => {
    if (!ready) {
      setLabLeft(true);
      return;
    }

    onSave(line);
    onOpenChange(false);
  };

  return (
    <Modal
      data-testid="lab-work-modal"
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t(draft ? "labs.work.edit" : "labs.work.add")}
      description={t("labs.work.description")}
      footer={
        <>
          <Button
            variant="secondary"
            icon={<Icon name="x" />}
            data-testid="lab-work-modal-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="check" />}
            data-testid="lab-work-modal-save"
            aria-disabled={!ready || undefined}
            onClick={save}
          >
            {t("labs.work.save")}
          </Button>
        </>
      }
    >
      <div className="@container flex flex-col gap-4">
        <div className="grid gap-4 @lg:grid-cols-2">
          <div onBlur={() => setLabLeft(true)}>
            <FormField
              label="labs.order.lab"
              htmlFor="lab-work-lab"
              required
              error={labLeft && !ready ? REQUIRED : undefined}
            >
              <Select
                id="lab-work-lab"
                data-testid="lab-work-field-lab"
                value={line.labId}
                placeholder={t("labs.order.selectLab")}
                onChange={(event) => chooseLab(event.target.value)}
                options={labOptions}
              />
            </FormField>
          </div>

          <FormField
            label="labs.order.workType"
            htmlFor="lab-work-type"
            hint={t("labs.order.workTypeHint")}
          >
            <Select
              id="lab-work-type"
              data-testid="lab-work-field-work-type"
              value={line.workTypeId}
              disabled={line.labId === ""}
              placeholder={t("labs.order.selectWorkType")}
              onChange={(event) => chooseWorkType(event.target.value)}
              options={(workTypes.data ?? []).map((type) => ({
                value: type.id,
                label: type.name,
              }))}
            />
          </FormField>

          {mayPrice && (
            <FormField
              label="treatments.labCost"
              htmlFor="lab-work-price"
              hint={t("labs.prices.snapshotNote")}
            >
              <MoneyInput
                id="lab-work-price"
                data-testid="lab-work-field-price"
                currency={currency}
                placeholder="0"
                value={line.price}
                onChange={(event) => change({ price: event.target.value })}
              />
            </FormField>
          )}

          <FormField label="labs.order.expected" htmlFor="lab-work-expected">
            <DatePicker
              id="lab-work-expected"
              data-testid="lab-work-field-expected"
              label={t("labs.order.expected")}
              value={line.expectedAt}
              min={todayIso()}
              onChange={(expectedAt) => change({ expectedAt })}
            />
          </FormField>

          {toothChart && (
            <FormField label="labs.order.shade" htmlFor="lab-work-shade">
              <Input
                id="lab-work-shade"
                data-testid="lab-work-field-shade"
                placeholder="A2"
                value={line.shade}
                onChange={(event) => change({ shade: event.target.value })}
              />
            </FormField>
          )}
        </div>

        <FormField label="labs.order.instructions" htmlFor="lab-work-instructions">
          <Textarea
            id="lab-work-instructions"
            data-testid="lab-work-field-instructions"
            rows={3}
            placeholder={t("labs.order.instructionsPlaceholder")}
            value={line.instructions}
            onChange={(event) => change({ instructions: event.target.value })}
          />
        </FormField>

        <section data-testid="lab-work-files" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-label font-semibold text-ink">{t("labs.order.attachments")}</h3>
            <Button
              size="sm"
              variant="secondary"
              icon={<Icon name="upload" />}
              data-testid="lab-work-files-add"
              onClick={() => fileInput.current?.click()}
            >
              {t("labs.order.addAttachment")}
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              data-testid="lab-work-files-input"
              className="sr-only"
              aria-label={t("labs.order.addAttachment")}
              onChange={addFiles}
            />
          </div>

          {line.files.length === 0 ? (
            <p className="text-label text-ink-muted">{t("labs.order.noAttachments")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
              {line.files.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  data-testid={`lab-work-file-${index}`}
                  className="flex items-center gap-2 px-3 py-1.5 text-label"
                >
                  <Icon name="file" className="size-4 shrink-0 text-ink-subtle" />
                  <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                  <Button
                    size="sm"
                    variant="quiet"
                    icon={<Icon name="trash" />}
                    data-testid={`lab-work-file-${index}-remove`}
                    aria-label={t("labs.work.removeFile", { name: file.name })}
                    onClick={() =>
                      change({ files: line.files.filter((_, other) => other !== index) })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
