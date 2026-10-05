import {
  LOOKUP_LIST,
  createPrescriptionSchema,
  lookupLabel,
  readDrugRegimen,
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
  Modal,
  QuantityInput,
  Select,
  SuggestionChips,
  Textarea,
  useToast,
} from "@clinic/ui";
import { useSavePrescription } from "@web/modules/patients/queries";
import { errorToast } from "@web/shared/lib/api-error";
import { payloadResolver } from "@web/shared/lib/payload-resolver";
import { ellipsis } from "@web/i18n/ellipsis";
import { formatDateTime } from "@web/shared/lib/format";
import { useLookupList } from "@web/shared/queries/lookups";
import { drugSuggestions } from "@web/modules/patients/lib/prescriptions";
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
  drug: "",
  note: "",
  legacy: {},
};

const toItemValues = (item: PrescriptionItem): ItemValues => ({
  ...toRegimenInput(item),
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

    setValue(`items.${index}.drug`, lookupLabel(option, i18n.language), touch);
    for (const key of ["perDose", "timesPerDay", "days"] as const) {
      if (filled[key] !== "") {
        setValue(`items.${index}.${key}`, filled[key], touch);
      }
    }
  };

  const watched = watch("items");
  const frequentChoices = frequentDrugs.map((option) => ({
    key: option.code,
    label: lookupLabel(option, i18n.language),
  }));

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
              {items.fields.length > 1 && (
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-label font-medium text-ink-muted">
                    {t("prescriptions.drugNumber", { number: index + 1 })}
                  </h3>
                  <Button
                    icon={<Icon name="x" />}
                    variant="ghost"
                    size="sm"
                    data-testid={`prescription-item-${index}-remove`}
                    aria-label={t("prescriptions.removeDrug")}
                    onClick={() => items.remove(index)}
                  />
                </div>
              )}

              <div className="flex max-w-(--field-max) flex-col gap-4">
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
                    autoComplete="off"
                    {...register(`items.${index}.drug`)}
                  />
                </FormField>

                {drugSuggestions(frequentChoices, watched?.[index]?.drug ?? "").length > 0 && (
                  <SuggestionChips
                    data-testid={`prescription-item-${index}-frequent`}
                    className="-mt-2 flex-nowrap overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
                    suggestions={drugSuggestions(frequentChoices, watched?.[index]?.drug ?? "")}
                    onPick={(suggestion) => pickFrequent(index, suggestion.key)}
                  />
                )}

                <FormField
                  label="prescriptions.regimen"
                  htmlFor={`prescription-per-dose-${index}`}
                  error={
                    errors.items?.[index]?.days ??
                    errors.items?.[index]?.perDose ??
                    errors.items?.[index]?.timesPerDay
                  }
                  required={!watched?.[index]?.legacy.duration}
                >
                  <div
                    dir="ltr"
                    data-testid={`prescription-item-${index}-regimen`}
                    className="flex items-start justify-end gap-2"
                  >
                    <label className="flex flex-col items-center gap-1">
                      <Input
                        id={`prescription-per-dose-${index}`}
                        data-testid={`prescription-item-${index}-per-dose`}
                        aria-label={t("prescriptions.perDose")}
                        inputMode="decimal"
                        autoComplete="off"
                        className="w-18 [&_[data-part=input-control]]:text-center"
                        {...register(`items.${index}.perDose`)}
                      />
                      <span className="text-meta text-ink-muted">
                        {t("prescriptions.perDoseShort")}
                      </span>
                    </label>
                    <span
                      aria-hidden="true"
                      className="flex h-(--control-h) items-center text-ink-subtle"
                    >
                      ×
                    </span>
                    <label className="flex flex-col items-center gap-1">
                      <QuantityInput
                        data-testid={`prescription-item-${index}-times-per-day`}
                        aria-label={t("prescriptions.timesPerDay")}
                        className="w-18 [&_[data-part=input-control]]:text-center"
                        {...register(`items.${index}.timesPerDay`)}
                      />
                      <span className="text-meta text-ink-muted">
                        {t("prescriptions.timesPerDayShort")}
                      </span>
                    </label>
                    <span
                      aria-hidden="true"
                      className="flex h-(--control-h) items-center text-ink-subtle"
                    >
                      ×
                    </span>
                    <label className="flex flex-col items-center gap-1">
                      <QuantityInput
                        data-testid={`prescription-item-${index}-days`}
                        aria-label={t("prescriptions.days")}
                        className="w-18 [&_[data-part=input-control]]:text-center"
                        {...register(`items.${index}.days`)}
                      />
                      <span className="text-meta text-ink-muted">
                        {t("prescriptions.daysShort")}
                      </span>
                    </label>
                  </div>
                </FormField>

                {legacyText(watched?.[index]?.legacy) && (
                  <p
                    data-testid={`prescription-item-${index}-legacy`}
                    className="-mt-2 text-meta text-ink-muted"
                  >
                    {t("prescriptions.writtenAs", { text: legacyText(watched?.[index]?.legacy) })}
                  </p>
                )}

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
