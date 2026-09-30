import {
  USER_ROLE,
  VALIDATION_CODE,
  createLabOrderSchema,
  updateLabOrderSchema,
  type CreateLabOrderInput,
  type LabOrderRow,
} from "@clinic/shared";
import { useEffect, useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Input,
  Modal,
  MoneyInput,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { PatientPicker } from "@web/shared/components/patient-picker";
import {
  patientPhoneClash,
  toPatientRef,
  type PatientChoice,
  type PickedPatient,
} from "@web/shared/lib/patient-draft";
import { useDoctors } from "@web/shared/queries/doctors";
import { isIsoDate, todayIso } from "@web/shared/lib/dates";
import {
  useCreateLabOrder,
  useLabWorkTypes,
  useLabs,
  useUpdateLabOrder,
} from "@web/modules/labs/queries";
import { TeethField } from "@web/modules/labs/components/teeth-field";
import { errorToast } from "@web/shared/lib/api-error";
import {
  FORM_ROOT,
  REQUIRED,
  nestedErrors,
  schemaErrors,
  type FieldErrors,
} from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { useCurrency } from "@web/shared/queries/clinic";

export interface LabOrderDefaults {
  readonly patient?: PickedPatient | undefined;
  readonly teeth?: readonly number[] | undefined;
  readonly performedProcedureId?: string | undefined;
  readonly doctorId?: string | undefined;
}

export interface OrderFormModalProps {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly order?: LabOrderRow | undefined;
  readonly defaults?: LabOrderDefaults | undefined;
}

export function OrderFormModal({
  open,
  onOpenChange,
  order,
  defaults,
  "data-testid": testId = "order-form-modal",
}: OrderFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const doctorName = usePersonName();
  const toast = useToast();
  const { user } = useSession();

  const create = useCreateLabOrder();
  const update = useUpdateLabOrder();

  const labs = useLabs({ limit: 100 }, open);
  const doctors = useDoctors({ limit: 100 });

  const [patient, setPatient] = useState<PatientChoice | null>(null);
  const [clash, setClash] = useState<PickedPatient | null>(null);
  const [labId, setLabId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [teeth, setTeeth] = useState<readonly number[]>([]);
  const [shade, setShade] = useState("");
  const [material, setMaterial] = useState("");
  const [instructions, setInstructions] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [price, setPrice] = useState("");

  const workTypes = useLabWorkTypes(labId);
  const mayPrice = user?.role === USER_ROLE.ADMIN;

  const body: Omit<CreateLabOrderInput, "patientId" | "newPatient"> = {
    labId,
    doctorId,
    teeth: [...teeth],
    ...(workTypeId !== "" && { workTypeId }),
    ...(shade.trim() !== "" && { shade: shade.trim() }),
    ...(material.trim() !== "" && { material: material.trim() }),
    ...(instructions.trim() !== "" && { instructions: instructions.trim() }),
    ...(expectedAt !== "" && { expectedAt }),
    ...(defaults?.performedProcedureId && {
      performedProcedureId: defaults.performedProcedureId,
    }),
    ...(mayPrice && price.trim() !== "" && { price: price.trim() }),
  };
  const { doctorId: _doctorId, ...editable } = body;
  const expectedChanged = expectedAt !== (order?.expectedAt ? order.expectedAt.slice(0, 10) : "");

  const validate = (): FieldErrors => ({
    ...(order
      ? schemaErrors(updateLabOrderSchema, editable)
      : schemaErrors(createLabOrderSchema, { ...body, ...(patient ? toPatientRef(patient) : {}) })),
    ...(!order && !patient && { [FORM_ROOT]: REQUIRED }),
    ...(!labId && { labId: REQUIRED }),
    ...(!doctorId && { doctorId: REQUIRED }),
    ...(expectedChanged &&
      isIsoDate(expectedAt) &&
      expectedAt < todayIso() && {
        expectedAt: { type: "custom", message: VALIDATION_CODE.DATE_IN_PAST },
      }),
  });

  const form = useFormErrors(validate());
  const { reset } = form;
  const isPending = create.isPending || update.isPending;

  const ownDoctorId = useMemo(
    () => doctors.data?.items.find((doctor) => doctor.userId === user?.id)?.id ?? "",
    [doctors.data, user?.id],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setClash(null);
    reset();

    if (order) {
      setPatient({
        kind: "existing",
        patient: {
          id: order.patientId,
          fullName: order.patientName,
          phone: "",
          fileNumber: order.patientFileNumber,
        },
      });
      setLabId(order.labId);
      setDoctorId(order.doctorId);
      setWorkTypeId(order.workTypeId ?? "");
      setTeeth(order.teeth);
      setShade(order.shade ?? "");
      setMaterial(order.material ?? "");
      setInstructions(order.instructions ?? "");
      setExpectedAt(order.expectedAt ? order.expectedAt.slice(0, 10) : "");
      setPrice(order.price);
      return;
    }

    setPatient(defaults?.patient ? { kind: "existing", patient: defaults.patient } : null);
    setLabId("");
    setDoctorId(defaults?.doctorId ?? ownDoctorId);
    setWorkTypeId("");
    setTeeth(defaults?.teeth ?? []);
    setShade("");
    setMaterial("");
    setInstructions("");
    setExpectedAt("");
    setPrice("");
  }, [open, order, defaults, ownDoctorId, reset]);

  const chooseWorkType = (id: string): void => {
    setWorkTypeId(id);

    const listed = workTypes.data?.find((type) => type.id === id);
    if (listed) {
      setPrice(listed.defaultPrice);
    }
  };

  const submit = async (): Promise<void> => {
    if (!form.check()) {
      return;
    }

    try {
      if (order) {
        await update.mutateAsync({
          id: order.id,
          body: { ...editable, workTypeId: workTypeId === "" ? null : workTypeId },
        });
      } else if (patient) {
        await create.mutateAsync({ ...body, ...toPatientRef(patient) });
      }

      toast.success(order ? "labs.order.updated" : "labs.order.created");
      onOpenChange(false);
    } catch (error) {
      const existing = patientPhoneClash(error);

      if (existing) {
        setClash(existing);
        return;
      }

      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={onOpenChange}
      title={t(order ? "labs.order.editTitle" : "labs.order.newTitle")}
      description={t("labs.order.description")}
      footer={
        <>
          <Button
            variant="secondary"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            data-testid={`${testId}-save`}
            aria-disabled={!form.isValid || isPending || undefined}
            isLoading={isPending}
            onClick={() => void submit()}
          >
            {t(order ? "common.save" : "labs.order.submit")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid={`${testId}-form`} className="flex flex-col gap-4">
        {order ? (
          <FormField label="labs.order.patient" htmlFor="lab-order-patient">
            <p
              id="lab-order-patient"
              data-testid="lab-order-field-patient"
              className="text-value text-ink"
            >
              {order.patientName}
            </p>
          </FormField>
        ) : (
          <div onBlur={form.leave(FORM_ROOT)}>
            <FormField
              label="labs.order.patient"
              htmlFor="lab-order-patient"
              error={patient?.kind === "new" ? undefined : form.errors[FORM_ROOT]}
              required
            >
              <PatientPicker
                errors={nestedErrors(form.errors, "newPatient")}
                onLeave={(field) => form.leave(`newPatient.${field}`)}
                id="lab-order-patient"
                value={patient}
                clash={clash}
                onChange={(next) => {
                  setPatient(next);
                  setClash(null);
                }}
              />
            </FormField>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("labId")}>
            <FormField
              error={form.errors["labId"]}
              label="labs.order.lab"
              htmlFor="lab-order-lab"
              required
            >
              <Select
                id="lab-order-lab"
                data-testid="lab-order-field-lab"
                value={labId}
                placeholder={t("labs.order.selectLab")}
                onChange={(event) => {
                  setLabId(event.target.value);
                  setWorkTypeId("");
                }}
                options={(labs.data?.items ?? [])
                  .filter((lab) => lab.isActive)
                  .map((lab) => ({ value: lab.id, label: lab.name }))}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("workTypeId")}>
            <FormField
              error={form.errors["workTypeId"]}
              label="labs.order.workType"
              htmlFor="lab-order-work-type"
              hint={t("labs.order.workTypeHint")}
            >
              <Select
                id="lab-order-work-type"
                data-testid="lab-order-field-work-type"
                value={workTypeId}
                disabled={labId === ""}
                placeholder={t("labs.order.selectWorkType")}
                onChange={(event) => chooseWorkType(event.target.value)}
                options={(workTypes.data ?? []).map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("doctorId")}>
            <FormField
              error={form.errors["doctorId"]}
              label="labs.order.doctor"
              htmlFor="lab-order-doctor"
              required
            >
              <Select
                id="lab-order-doctor"
                data-testid="lab-order-field-doctor"
                value={doctorId}
                disabled={Boolean(order)}
                placeholder={t("labs.order.selectDoctor")}
                onChange={(event) => setDoctorId(event.target.value)}
                options={(doctors.data?.items ?? []).map((doctor) => ({
                  value: doctor.id,
                  label: doctorName(doctor.user.name),
                }))}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("expectedAt")}>
            <FormField
              error={form.errors["expectedAt"]}
              label="labs.order.expected"
              htmlFor="lab-order-expected"
              optional
            >
              <DatePicker
                id="lab-order-expected"
                data-testid="lab-order-field-expected"
                label={t("labs.order.expected")}
                value={expectedAt}
                min={todayIso()}
                onChange={setExpectedAt}
              />
            </FormField>
          </div>
        </div>

        <div onBlur={form.leave("teeth")}>
          <FormField
            error={form.errors["teeth"]}
            label="labs.order.teeth"
            htmlFor="lab-order-teeth"
            optional
          >
            <TeethField id="lab-order-teeth" value={teeth} onChange={setTeeth} />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("shade")}>
            <FormField
              error={form.errors["shade"]}
              label="labs.order.shade"
              htmlFor="lab-order-shade"
              optional
            >
              <Input
                id="lab-order-shade"
                data-testid="lab-order-field-shade"
                placeholder="A2"
                value={shade}
                onChange={(event) => setShade(event.target.value)}
              />
            </FormField>
          </div>

          <div onBlur={form.leave("material")}>
            <FormField
              error={form.errors["material"]}
              label="labs.order.material"
              htmlFor="lab-order-material"
              optional
            >
              <Input
                id="lab-order-material"
                data-testid="lab-order-field-material"
                value={material}
                onChange={(event) => setMaterial(event.target.value)}
              />
            </FormField>
          </div>
        </div>

        {mayPrice && (
          <div onBlur={form.leave("price")}>
            <FormField
              error={form.errors["price"]}
              label="labs.order.price"
              htmlFor="lab-order-price"
              hint={t("labs.prices.snapshotNote")}
            >
              <MoneyInput
                id="lab-order-price"
                data-testid="lab-order-field-price"
                currency={currency}
                placeholder="0"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </FormField>
          </div>
        )}

        <div onBlur={form.leave("instructions")}>
          <FormField
            error={form.errors["instructions"]}
            label="labs.order.instructions"
            htmlFor="lab-order-instructions"
            optional
          >
            <Textarea
              id="lab-order-instructions"
              data-testid="lab-order-field-instructions"
              rows={3}
              placeholder={t("labs.order.instructionsPlaceholder")}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
