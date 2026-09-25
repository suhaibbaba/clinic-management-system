import {
  TREATMENT_PLAN_STATUSES,
  type Doctor,
  type TreatmentPlan,
  type TreatmentPlanStatus,
} from "@clinic/shared";
import { useEffect, useState, type FormEvent, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Icon,
  Input,
  Modal,
  Select,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { doctorOptionLabel } from "@web/features/doctors/doctor-label";
import { useCreateTreatmentPlan, useUpdateTreatmentPlan } from "@web/features/patients/queries";
import { ellipsis } from "@web/i18n/ellipsis";
import { errorMessageKey } from "@web/lib/api-error";

interface PlanFormModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly patientId: string;
  readonly doctors: readonly Doctor[];
  readonly plan: TreatmentPlan | null;
}

const FORM_ID = "treatment-plan-form";

export function PlanFormModal({
  open,
  onOpenChange,
  patientId,
  doctors,
  plan,
}: PlanFormModalProps): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toast = useToast();
  const displayName = usePersonName();
  const create = useCreateTreatmentPlan(patientId);
  const update = useUpdateTreatmentPlan(patientId);

  const [title, setTitle] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState<TreatmentPlanStatus>("draft");
  const [notes, setNotes] = useState("");
  const [titleMissing, setTitleMissing] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const own = doctors.find((doctor) => doctor.userId === user?.id);
    setTitle(plan?.title ?? t("treatmentPlans.defaultTitle"));
    setDoctorId(plan?.doctorId ?? own?.id ?? doctors[0]?.id ?? "");
    setStatus(plan?.status ?? "draft");
    setNotes(plan?.notes ?? "");
    setTitleMissing(false);
  }, [open, plan, doctors, user?.id, t]);

  const submitting = create.isPending || update.isPending;

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    if (title.trim().length < 2) {
      setTitleMissing(true);
      return;
    }
    if (!doctorId) {
      toast.error("treatmentPlans.needsDoctor");
      return;
    }

    const body = {
      title: title.trim(),
      doctorId,
      status,
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    try {
      if (plan) {
        await update.mutateAsync({ id: plan.id, body });
        toast.success("treatmentPlans.updated");
      } else {
        await create.mutateAsync({ ...body, patientId, items: [] });
        toast.success("treatmentPlans.created");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  return (
    <Modal
      data-testid="treatment-plan-form-modal"
      open={open}
      onOpenChange={onOpenChange}
      title={plan ? "treatmentPlans.edit" : "treatmentPlans.create"}
      description={plan ? undefined : "treatmentPlans.about"}
      footer={
        <>
          <Button
            icon={<Icon name="x" />}
            variant="secondary"
            data-testid="treatment-plan-form-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            icon={<Icon name="check" />}
            type="submit"
            form={FORM_ID}
            data-testid="treatment-plan-form-save"
            isLoading={submitting}
          >
            {submitting ? ellipsis(t("common.saving")) : t("common.save")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-4"
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
      >
        <FormField
          label="treatmentPlans.title"
          htmlFor="treatment-plan-title"
          hint="treatmentPlans.titleHint"
          {...(titleMissing && { error: { type: "invalid_type" } })}
          required
        >
          <Input
            id="treatment-plan-title"
            data-testid="treatment-plan-field-title"
            value={title}
            maxLength={160}
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="treatmentPlans.responsibleDoctor"
            htmlFor="treatment-plan-doctor"
            required
          >
            <Select
              id="treatment-plan-doctor"
              data-testid="treatment-plan-field-doctor"
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              options={doctors.map((doctor) => ({
                value: doctor.id,
                label: doctorOptionLabel(doctor, displayName(doctor.user.name), t),
              }))}
            />
          </FormField>

          <FormField label="treatmentPlans.status" htmlFor="treatment-plan-status" required>
            <Select
              id="treatment-plan-status"
              data-testid="treatment-plan-field-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as TreatmentPlanStatus)}
              options={TREATMENT_PLAN_STATUSES.map((value) => ({
                value,
                label: t(`treatmentPlans.planStatus.${value}`),
              }))}
            />
          </FormField>
        </div>

        <FormField label="treatmentPlans.notes" htmlFor="treatment-plan-notes" optional>
          <Textarea
            id="treatment-plan-notes"
            data-testid="treatment-plan-field-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
