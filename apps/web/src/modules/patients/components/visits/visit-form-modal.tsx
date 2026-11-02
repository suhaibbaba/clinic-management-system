import {
  createVisitSchema,
  LOOKUP_LIST,
  type CreateVisitInput,
  type Doctor,
  type ProcedureCatalogItem,
  type Visit,
} from "@clinic/shared";
import { useEffect, type JSX } from "react";
import { Controller, useForm } from "react-hook-form";
import { revealFirstError } from "@web/shared/lib/form-errors";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Icon,
  InfoTip,
  Modal,
  Money,
  MoneyInput,
  Select,
  Textarea,
  TimePicker,
  usePersonName,
  useToast,
} from "@clinic/ui";
import {
  usePatientProcedures,
  useProcedureCatalog,
  useSaveVisit,
} from "@web/modules/patients/queries";
import { treatmentsTotal } from "@web/modules/patients/lib/treatments/treatments";
import { lastFeeProcedure, rememberFeeProcedure } from "@web/modules/patients/lib/visit-fee-memory";
import { wholePrice } from "@web/modules/patients/lib/price-list";
import { canChargeVisitFee, canSeePrices } from "@web/shared/permissions/patients";
import { canRecordPayment } from "@web/shared/permissions/billing";
import { useSession } from "@web/shared/providers/session";
import { useLocalized } from "@web/shared/hooks/use-localized";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";
import { errorToast } from "@web/shared/lib/api-error";
import { payloadResolver } from "@web/shared/lib/payload-resolver";
import { ellipsis } from "@web/i18n/ellipsis";

interface VisitFormModalProps {
  "data-testid"?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctors: readonly Doctor[];
  visit: Visit | null;
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const splitLocal = (value: string): { date: string; time: string } => {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
};

const joinLocal = (date: string, time: string): string =>
  date === "" ? "" : `${date}T${time === "" ? "09:00" : time}`;

type VisitFormValues = Omit<CreateVisitInput, "visitDate" | "fee"> & {
  visitDate: string;
  feeProcedureId: string;
  feePrice: string;
  payMethod: string;
};

const NO_FEE = "";
const ON_ACCOUNT = "";
const DEFAULT_PAYMENT_METHOD = "cash";

const priceOf = (catalog: readonly ProcedureCatalogItem[], id: string): string => {
  const item = catalog.find((entry) => entry.id === id);

  return item ? wholePrice(item.defaultPrice) : "";
};

export function VisitFormModal({
  open,
  onOpenChange,
  patientId,
  doctors,
  visit,
  "data-testid": testId = "visit-form-modal",
}: VisitFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const doctorName = usePersonName();
  const toast = useToast();
  const saveVisit = useSaveVisit(patientId);
  const { can } = useSession();
  const localized = useLocalized();
  const currency = useCurrency();
  const charges = !visit && canChargeVisitFee(can);
  const takesPayment = charges && canRecordPayment(can);
  const catalog = useProcedureCatalog();
  const feeItems = charges ? (catalog.data ?? []) : [];
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const procedures = usePatientProcedures(patientId);
  const visitProcedures = visit
    ? (procedures.data ?? []).filter((procedure) => procedure.visitId === visit.id)
    : [];
  const recordedFee =
    visit && canSeePrices(can) && visitProcedures.length > 0
      ? treatmentsTotal(visitProcedures)
      : null;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isValid },
    control,
    watch,
  } = useForm<VisitFormValues>({
    mode: "onTouched",
    resolver: payloadResolver(createVisitSchema, (values: VisitFormValues) => toPayload(values)),
  });

  function toPayload(values: VisitFormValues) {
    const { feeProcedureId, feePrice, payMethod, ...visitValues } = values;

    return {
      ...visitValues,
      patientId,
      ...(values.visitDate ? { visitDate: new Date(values.visitDate).toISOString() } : {}),
      ...(charges &&
        feeProcedureId && {
          fee: {
            procedureId: feeProcedureId,
            ...(feePrice !== "" && { price: feePrice }),
            ...(takesPayment && payMethod !== ON_ACCOUNT && { paidWith: payMethod }),
          },
        }),
    };
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    reset(
      visit
        ? {
            patientId,
            doctorId: visit.doctorId,
            visitDate: toLocalInput(visit.visitDate),
            complaint: visit.complaint,
            examination: visit.examination,
            diagnosis: visit.diagnosis,
            notes: visit.notes,
          }
        : {
            patientId,
            doctorId: doctors[0]?.id ?? "",
            visitDate: toLocalInput(new Date().toISOString()),
            complaint: "",
            examination: "",
            diagnosis: "",
            notes: "",
            feeProcedureId: NO_FEE,
            feePrice: "",
            payMethod: DEFAULT_PAYMENT_METHOD,
          },
    );
  }, [open, visit, patientId, reset]);

  useEffect(() => {
    if (!open || visit || feeItems.length === 0 || getValues("feeProcedureId") !== NO_FEE) {
      return;
    }

    const remembered = lastFeeProcedure();

    if (remembered && feeItems.some((item) => item.id === remembered)) {
      setValue("feeProcedureId", remembered);
      setValue("feePrice", priceOf(feeItems, remembered));
    }
  }, [open, visit, feeItems, getValues, setValue]);

  const feeProcedureId = watch("feeProcedureId");

  useEffect(() => {
    if (open && !getValues("doctorId") && doctors[0]) {
      setValue("doctorId", doctors[0].id);
    }
  }, [open, doctors, getValues, setValue]);

  const onSubmit = handleSubmit(
    async (values) => {
      const parsed = createVisitSchema.parse(toPayload(values));

      try {
        await saveVisit.mutateAsync({
          ...(visit ? { id: visit.id } : {}),
          body: parsed,
        });

        if (parsed.fee) {
          rememberFeeProcedure(parsed.fee.procedureId);
        }

        toast.success(visit ? "visits.updated" : "visits.created");
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
      title={visit ? "visits.edit" : "visits.create"}
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
            form="visit-form"
            data-testid={`${testId}-save`}
            isLoading={isSubmitting}
          >
            {isSubmitting ? ellipsis(t("common.saving")) : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id="visit-form"
        data-testid={`${testId}-form`}
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
        noValidate
      >
        <FormField label="visits.doctor" htmlFor="visit-doctor" error={errors.doctorId}>
          <Controller
            name="doctorId"
            control={control}
            render={({ field }) => (
              <Select
                id="visit-doctor"
                data-testid="visit-field-doctor"
                options={doctors.map((doctor) => ({
                  value: doctor.id,
                  label: doctorName(doctor.user.name),
                }))}
                value={field.value ?? ""}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.value)}
              />
            )}
          />
        </FormField>

        <FormField label="visits.date" htmlFor="visit-date" error={errors.visitDate}>
          <Controller
            control={control}
            name="visitDate"
            render={({ field }) => {
              const { date, time } = splitLocal(field.value ?? "");

              return (
                <div className="flex flex-wrap gap-2">
                  <DatePicker
                    id="visit-date"
                    data-testid="visit-field-date"
                    className="min-w-40 flex-1"
                    label={t("visits.date")}
                    value={date}
                    hasError={errors.visitDate !== undefined}
                    onChange={(next) => field.onChange(joinLocal(next, time))}
                  />
                  <TimePicker
                    id="visit-time"
                    data-testid="visit-field-time"
                    className="w-36"
                    label={t("visits.time")}
                    value={time}
                    onChange={(next) => field.onChange(joinLocal(date, next))}
                  />
                </div>
              );
            }}
          />
        </FormField>

        <FormField label="visits.complaint" htmlFor="visit-complaint" error={errors.complaint}>
          <Textarea
            placeholder={t("common.placeholders.complaint")}
            id="visit-complaint"
            data-testid="visit-field-complaint"
            rows={2}
            {...register("complaint", { setValueAs: (v) => (v === "" ? null : v) })}
          />
        </FormField>

        <FormField label="visits.examination" htmlFor="visit-exam" error={errors.examination}>
          <Textarea
            placeholder={ellipsis(t("common.placeholders.examination"))}
            id="visit-exam"
            data-testid="visit-field-examination"
            rows={3}
            {...register("examination", { setValueAs: (v) => (v === "" ? null : v) })}
          />
        </FormField>

        <FormField label="visits.diagnosis" htmlFor="visit-diagnosis" error={errors.diagnosis}>
          <Textarea
            placeholder={ellipsis(t("common.placeholders.diagnosis"))}
            id="visit-diagnosis"
            data-testid="visit-field-diagnosis"
            rows={2}
            {...register("diagnosis", { setValueAs: (v) => (v === "" ? null : v) })}
          />
        </FormField>

        <FormField label="visits.notes" htmlFor="visit-notes" error={errors.notes} optional>
          <Textarea
            placeholder={ellipsis(t("common.placeholders.visitNotes"))}
            id="visit-notes"
            data-testid="visit-field-notes"
            rows={2}
            {...register("notes", { setValueAs: (v) => (v === "" ? null : v) })}
          />
        </FormField>

        {charges && (
          <div
            data-testid={`${testId}-fee`}
            className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_8rem_10rem]"
          >
            <FormField
              label="visits.fee.title"
              htmlFor="visit-fee-item"
              hint="visits.fee.itemHint"
              optional
            >
              <Controller
                name="feeProcedureId"
                control={control}
                render={({ field }) => (
                  <Select
                    id="visit-fee-item"
                    data-testid="visit-field-fee-item"
                    options={[
                      { value: NO_FEE, label: t("visits.fee.none") },
                      ...feeItems.map((item) => ({ value: item.id, label: localized(item.name) })),
                    ]}
                    value={field.value ?? NO_FEE}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                      setValue("feePrice", priceOf(feeItems, event.target.value));
                    }}
                  />
                )}
              />
            </FormField>

            {feeProcedureId !== NO_FEE && (
              <FormField label="visits.fee.amount" htmlFor="visit-fee-amount">
                <MoneyInput
                  id="visit-fee-amount"
                  data-testid="visit-field-fee-amount"
                  currency={currency}
                  {...register("feePrice")}
                />
              </FormField>
            )}

            {feeProcedureId !== NO_FEE && takesPayment && (
              <FormField label="visits.fee.payment" htmlFor="visit-pay-method">
                <Controller
                  name="payMethod"
                  control={control}
                  render={({ field }) => (
                    <Select
                      id="visit-pay-method"
                      data-testid="visit-field-pay-method"
                      options={[
                        ...methods,
                        { value: ON_ACCOUNT, label: t("visits.fee.onAccount") },
                      ]}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(event) => field.onChange(event.target.value)}
                    />
                  )}
                />
              </FormField>
            )}
          </div>
        )}

        {recordedFee !== null && (
          <div
            data-testid={`${testId}-recorded-fee`}
            className="flex items-center justify-between gap-3 border-t border-line pt-4"
          >
            <span className="flex items-center gap-1 text-label font-medium text-ink">
              {t("visits.fee.title")}
              <InfoTip label={t("common.moreInfo")} data-testid={`${testId}-recorded-fee-tip`}>
                {t("visits.fee.recordedHint")}
              </InfoTip>
            </span>
            <Money amount={recordedFee} currency={currency} className="text-value text-ink" />
          </div>
        )}
      </form>
    </Modal>
  );
}
