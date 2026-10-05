import {
  LOOKUP_LIST,
  createPrescriptionSchema,
  lookupLabel,
  readDrugRegimen,
  regimenShorthand,
  type Prescription,
  type PrescriptionItem,
  type Visit,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Input,
  Ltr,
  Modal,
  QuantityInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import { useSavePrescription } from "@web/modules/patients/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { payloadResolver } from "@web/shared/lib/payload-resolver";
import { ellipsis } from "@web/i18n/ellipsis";
import { formatDateTime } from "@web/shared/lib/format";
import { useLookupList } from "@web/shared/queries/lookups";
import {
  EMPTY_REGIMEN_INPUT,
  toRegimen,
  toRegimenInput,
  type RegimenInput,
} from "@web/shared/lib/regimen";

interface PrescriptionFormModalProps {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly patientId: string;
  readonly visits: readonly Visit[];
  readonly prescription: Prescription | null;
}

interface ItemValues extends RegimenInput {
  frequent: string;
  drug: string;
  note: string;
  legacy: Pick<PrescriptionItem, "dose" | "frequency" | "duration">;
}

interface FormValues {
  visitId: string;
  items: ItemValues[];
  notes: string;
}

const EMPTY_ITEM: ItemValues = {
  ...EMPTY_REGIMEN_INPUT,
  frequent: "",
  drug: "",
  note: "",
  legacy: {},
};

const toItemValues = (item: PrescriptionItem): ItemValues => ({
  ...toRegimenInput(item),
  frequent: "",
  drug: item.drug,
  note: item.note ?? "",
  legacy: { dose: item.dose, frequency: item.frequency, duration: item.duration },
});

const orNull = (value: string): string | null => (value.trim() === "" ? null : value);

const legacyText = (legacy: ItemValues["legacy"] | undefined): string =>
  [legacy?.dose, legacy?.frequency, legacy?.duration].filter(Boolean).join(" · ");

export function PrescriptionFormModal({
  open,
  onOpenChange,
  patientId,
  visits,
  prescription,
  "data-testid": testId = "prescription-form-modal",
}: PrescriptionFormModalProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const save = useSavePrescription(patientId);
  const frequentDrugs = useLookupList(LOOKUP_LIST.FREQUENT_DRUG);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<FormValues>({
    mode: "onTouched",
    resolver: payloadResolver(createPrescriptionSchema, (values: FormValues) => toPayload(values)),
  });
  const items = useFieldArray({ control, name: "items" });

  function toPayload(values: FormValues) {
    const visit = visits.find((entry) => entry.id === values.visitId);
    const payload = {
      patientId,
      visitId: values.visitId === "" ? undefined : values.visitId,
      doctorId: visit?.doctorId ?? prescription?.doctorId ?? "",
      items: values.items.map((item) => {
        const regimen = toRegimen(item);

        return {
          drug: item.drug,
          ...regimen,
          dose: regimen.perDose == null ? item.legacy.dose : null,
          frequency: regimen.timesPerDay == null ? item.legacy.frequency : null,
          duration: regimen.days == null ? item.legacy.duration : null,
          note: orNull(item.note),
        };
      }),
      notes: orNull(values.notes),
    };

    return payload;
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      prescription
        ? {
            visitId: prescription.visitId ?? "",
            items: prescription.items.map(toItemValues),
            notes: prescription.notes ?? "",
          }
        : { visitId: visits[0]?.id ?? "", items: [EMPTY_ITEM], notes: "" },
    );
  }, [open, prescription, visits, reset]);

  const pickFrequent = (index: number, code: string): void => {
    const option = frequentDrugs.find((entry) => entry.code === code);

    if (!option) {
      return;
    }

    const filled = toRegimenInput(readDrugRegimen(option.meta));
    const touch = { shouldDirty: true, shouldValidate: true };

    setValue(`items.${index}.frequent`, code);
    setValue(`items.${index}.drug`, lookupLabel(option, i18n.language), touch);
    for (const key of ["perDose", "timesPerDay", "days"] as const) {
      if (filled[key] !== "") {
        setValue(`items.${index}.${key}`, filled[key], touch);
      }
    }
  };

  const watched = watch("items");

  const onSubmit = handleSubmit(
    async (values) => {
      const parsed = createPrescriptionSchema.parse(toPayload(values));

      try {
        await save.mutateAsync({
          ...(prescription ? { id: prescription.id } : {}),
          body: parsed,
        });

        toast.success(prescription ? "prescriptions.updated" : "prescriptions.created");
        onOpenChange(false);
      } catch (error) {
        toast.error(...errorToast(error));
      }
    },
    () => revealFirstError(),
  );

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={prescription ? "prescriptions.edit" : "prescriptions.create"}
      size="lg"
      footer={
        <>
          <Button
            icon={<Icon name="x" />}
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="check" />}
            type="submit"
            aria-disabled={!isValid || isSubmitting || undefined}
            form="prescription-form"
            data-testid={`${testId}-save`}
            isLoading={isSubmitting}
          >
            {isSubmitting ? ellipsis(t("common.saving")) : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="prescription-form"
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
        noValidate
      >
        <FormField
          label="prescriptions.linkedVisit"
          hint="prescriptions.linkedVisitHint"
          htmlFor="prescription-visit"
          error={errors.visitId}
          required
        >
          <Controller
            name="visitId"
            control={control}
            render={({ field }) => (
              <Select
                id="prescription-visit"
                data-testid="prescription-field-visit"
                options={visits.map((visit) => ({
                  value: visit.id,
                  label: formatDateTime(visit.visitDate),
                }))}
                value={field.value ?? ""}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormField>

        <ol className="flex flex-col gap-3">
          {items.fields.map((item, index) => (
            <li
              key={item.id}
              data-testid={`prescription-item-${index}`}
              className="rounded-panel border border-line p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-label font-medium text-ink-muted">
                  {t("prescriptions.drugNumber", { number: index + 1 })}
                  {regimenShorthand(toRegimen(watched?.[index] ?? EMPTY_ITEM)) && (
                    <Ltr
                      data-testid={`prescription-item-${index}-shorthand`}
                      className="rounded-control bg-sunken px-2 font-mono text-ink"
                    >
                      {regimenShorthand(toRegimen(watched?.[index] ?? EMPTY_ITEM))}
                    </Ltr>
                  )}
                </h3>
                {items.fields.length > 1 && (
                  <Button
                    icon={<Icon name="x" />}
                    variant="ghost"
                    size="sm"
                    data-testid={`prescription-item-${index}-remove`}
                    aria-label={t("prescriptions.removeDrug")}
                    onClick={() => items.remove(index)}
                  />
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {frequentDrugs.length > 0 && (
                  <FormField
                    label="prescriptions.frequentDrug"
                    htmlFor={`prescription-frequent-${index}`}
                    optional
                  >
                    <Controller
                      name={`items.${index}.frequent`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          id={`prescription-frequent-${index}`}
                          data-testid={`prescription-item-${index}-frequent`}
                          searchable
                          placeholder={t("prescriptions.frequentDrugPlaceholder")}
                          options={frequentDrugs.map((option) => ({
                            value: option.code,
                            label: lookupLabel(option, i18n.language),
                          }))}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(event) => pickFrequent(index, event.target.value)}
                        />
                      )}
                    />
                  </FormField>
                )}

                <FormField
                  label="prescriptions.drug"
                  htmlFor={`prescription-drug-${index}`}
                  error={errors.items?.[index]?.drug}
                  required
                >
                  <Input
                    id={`prescription-drug-${index}`}
                    data-testid={`prescription-item-${index}-drug`}
                    placeholder={t("prescriptions.drugPlaceholder")}
                    {...register(`items.${index}.drug`)}
                  />
                </FormField>
              </div>

              <div className="mt-3 grid max-w-(--form-max) grid-cols-3 gap-3">
                <FormField
                  label="prescriptions.perDose"
                  htmlFor={`prescription-per-dose-${index}`}
                  error={errors.items?.[index]?.perDose}
                  optional
                >
                  <Input
                    id={`prescription-per-dose-${index}`}
                    data-testid={`prescription-item-${index}-per-dose`}
                    dir="ltr"
                    inputMode="decimal"
                    autoComplete="off"
                    {...register(`items.${index}.perDose`)}
                  />
                </FormField>

                <FormField
                  label="prescriptions.timesPerDay"
                  htmlFor={`prescription-times-per-day-${index}`}
                  error={errors.items?.[index]?.timesPerDay}
                  optional
                >
                  <QuantityInput
                    id={`prescription-times-per-day-${index}`}
                    data-testid={`prescription-item-${index}-times-per-day`}
                    {...register(`items.${index}.timesPerDay`)}
                  />
                </FormField>

                <FormField
                  label="prescriptions.days"
                  htmlFor={`prescription-days-${index}`}
                  error={errors.items?.[index]?.days}
                  required={!watched?.[index]?.legacy.duration}
                  optional={Boolean(watched?.[index]?.legacy.duration)}
                >
                  <QuantityInput
                    id={`prescription-days-${index}`}
                    data-testid={`prescription-item-${index}-days`}
                    {...register(`items.${index}.days`)}
                  />
                </FormField>
              </div>

              {legacyText(watched?.[index]?.legacy) && (
                <p
                  data-testid={`prescription-item-${index}-legacy`}
                  className="mt-2 text-meta text-ink-muted"
                >
                  {t("prescriptions.writtenAs", { text: legacyText(watched?.[index]?.legacy) })}
                </p>
              )}

              <div className="mt-3 max-w-(--field-max)">
                <FormField
                  label="prescriptions.instructions"
                  htmlFor={`prescription-note-${index}`}
                  error={errors.items?.[index]?.note}
                  optional
                >
                  <Input
                    id={`prescription-note-${index}`}
                    data-testid={`prescription-item-${index}-note`}
                    placeholder={t("prescriptions.instructionsPlaceholder")}
                    {...register(`items.${index}.note`)}
                  />
                </FormField>
              </div>
            </li>
          ))}
        </ol>

        <Button
          icon={<Icon name="plus" />}
          variant="secondary"
          size="sm"
          className="self-start"
          data-testid="prescription-add-item"
          onClick={() => items.append(EMPTY_ITEM)}
        >
          {t("prescriptions.addDrug")}
        </Button>

        <FormField label="prescriptions.notes" htmlFor="prescription-notes" optional>
          <Textarea
            id="prescription-notes"
            data-testid="prescription-field-notes"
            rows={2}
            {...register("notes")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
