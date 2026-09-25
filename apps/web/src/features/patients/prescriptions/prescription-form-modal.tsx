import { createPrescriptionSchema, type Prescription, type Visit } from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button, FormField, Icon, Input, Modal, Select, Textarea, useToast } from "@clinic/ui";
import { useSavePrescription } from "@web/features/patients/queries";
import { errorMessageKey } from "@web/lib/api-error";
import { ellipsis } from "@web/i18n/ellipsis";
import { visitMoment } from "@web/lib/format";

interface PrescriptionFormModalProps {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly patientId: string;
  /** Newest first; the first is the default for a new prescription. */
  readonly visits: readonly Visit[];
  readonly prescription: Prescription | null;
}

interface ItemValues {
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
}

interface FormValues {
  visitId: string;
  items: ItemValues[];
  notes: string;
}

const EMPTY_ITEM: ItemValues = { drug: "", dose: "", frequency: "", duration: "" };

const orNull = (value: string): string | null => (value.trim() === "" ? null : value);

export function PrescriptionFormModal({
  open,
  onOpenChange,
  patientId,
  visits,
  prescription,
  "data-testid": testId = "prescription-form-modal",
}: PrescriptionFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useSavePrescription(patientId);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();
  const items = useFieldArray({ control, name: "items" });

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      prescription
        ? {
            visitId: prescription.visitId ?? "",
            items: prescription.items.map((item) => ({
              drug: item.drug,
              dose: item.dose ?? "",
              frequency: item.frequency ?? "",
              duration: item.duration,
            })),
            notes: prescription.notes ?? "",
          }
        : { visitId: visits[0]?.id ?? "", items: [EMPTY_ITEM], notes: "" },
    );
  }, [open, prescription, visits, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const visit = visits.find((entry) => entry.id === values.visitId);
    // The doctor is the visit's: the prescription records what was given at that visit.
    const payload = {
      patientId,
      visitId: values.visitId === "" ? undefined : values.visitId,
      doctorId: visit?.doctorId ?? prescription?.doctorId ?? "",
      items: values.items.map((item) => ({
        drug: item.drug,
        dose: orNull(item.dose),
        frequency: orNull(item.frequency),
        duration: item.duration,
      })),
      notes: orNull(values.notes),
    };

    const parsed = createPrescriptionSchema.safeParse(payload);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path.join(".") as FieldPath<FormValues>, {
          type: issue.code,
          message: issue.message,
        });
      }
      return;
    }

    try {
      await save.mutateAsync({
        ...(prescription ? { id: prescription.id } : {}),
        body: parsed.data,
      });

      toast.success(prescription ? "prescriptions.updated" : "prescriptions.created");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  });

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
                  label: visitMoment(visit.visitDate),
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
                <h3 className="text-label font-medium text-ink-muted">
                  {t("prescriptions.drugNumber", { number: index + 1 })}
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

                <FormField
                  label="prescriptions.duration"
                  htmlFor={`prescription-duration-${index}`}
                  error={errors.items?.[index]?.duration}
                  required
                >
                  <Input
                    id={`prescription-duration-${index}`}
                    data-testid={`prescription-item-${index}-duration`}
                    placeholder={t("prescriptions.durationPlaceholder")}
                    {...register(`items.${index}.duration`)}
                  />
                </FormField>

                <FormField
                  label="prescriptions.dose"
                  htmlFor={`prescription-dose-${index}`}
                  error={errors.items?.[index]?.dose}
                  optional
                >
                  <Input
                    id={`prescription-dose-${index}`}
                    data-testid={`prescription-item-${index}-dose`}
                    placeholder={t("prescriptions.dosePlaceholder")}
                    {...register(`items.${index}.dose`)}
                  />
                </FormField>

                <FormField
                  label="prescriptions.frequency"
                  htmlFor={`prescription-frequency-${index}`}
                  error={errors.items?.[index]?.frequency}
                  optional
                >
                  <Input
                    id={`prescription-frequency-${index}`}
                    data-testid={`prescription-item-${index}-frequency`}
                    placeholder={t("prescriptions.frequencyPlaceholder")}
                    {...register(`items.${index}.frequency`)}
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
