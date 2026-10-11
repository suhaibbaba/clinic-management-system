import {
  SHARE_SPLIT_TOTAL,
  updateTreatmentSettlementSchema,
  type SettlementTreatment,
  type UpdateTreatmentSettlementInput,
} from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Modal,
  MoneyInput,
  QuantityInput,
  Select,
  Switch,
  Textarea,
  usePersonName,
  useToast,
} from "@clinic/ui";
import { useSetTreatmentSettlement } from "@web/modules/doctors/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { moneyText } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { useDoctors } from "@web/shared/queries/doctors";

const whole = (amount: string): string => String(Math.round(Number(amount)));

export function SettlementTreatmentModal({
  doctorId,
  treatment,
  defaultPercent,
  onClose,
}: {
  readonly doctorId: string;
  readonly treatment: SettlementTreatment | null;
  readonly defaultPercent: number;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const nameOf = usePersonName();
  const save = useSetTreatmentSettlement(doctorId);
  const doctors = useDoctors({ limit: 100 });

  const [material, setMaterial] = useState("");
  const [percent, setPercent] = useState("");
  const [shared, setShared] = useState(false);
  const [partner, setPartner] = useState("");
  const [work, setWork] = useState("50");
  const [waived, setWaived] = useState(false);
  const [reason, setReason] = useState("");

  const partners = (doctors.data?.items ?? []).filter((doctor) => doctor.id !== doctorId);

  const body: UpdateTreatmentSettlementInput = {
    materialCost: material === "" ? null : material,
    clinicSharePercent: percent === "" ? null : Number(percent),
    shareSplit: shared
      ? [
          { doctorId, workPercent: Number(work) },
          { doctorId: partner, workPercent: SHARE_SPLIT_TOTAL - Number(work) },
        ]
      : null,
    shareWaivedReason: waived ? reason : null,
  };
  const form = useFormErrors(schemaErrors(updateTreatmentSettlementSchema, body));
  const { reset } = form;

  useEffect(() => {
    if (treatment) {
      const other = treatment.split?.find((entry) => entry.doctorId !== doctorId);

      setMaterial(treatment.materialCostSet ? whole(treatment.materialCost) : "");
      setPercent(treatment.clinicSharePercentSet ? String(treatment.clinicSharePercent) : "");
      setShared(Boolean(other));
      setPartner(other?.doctorId ?? "");
      setWork(String(treatment.split ? treatment.workPercent : 50));
      setWaived(treatment.waivedReason !== null);
      setReason(treatment.waivedReason ?? "");
      reset();
    }
  }, [treatment, doctorId, reset]);

  const submit = async (): Promise<void> => {
    if (!treatment || !form.check()) {
      return;
    }

    try {
      await save.mutateAsync({ treatmentId: treatment.id, body });
      toast.success("doctors.settlement.treatmentUpdated");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="settlement-treatment-modal"
      open={treatment !== null}
      onOpenChange={(open) => !open && onClose()}
      title="doctors.settlement.editTreatment"
      titleValues={{ name: treatment?.procedureName ?? "" }}
      footer={
        <>
          <Button variant="secondary" data-testid="settlement-treatment-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            isLoading={save.isPending}
            aria-disabled={!form.isValid || save.isPending || undefined}
            data-testid="settlement-treatment-save"
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} className="flex flex-col gap-4">
        <div onBlur={form.leave("materialCost")}>
          <FormField
            label="doctors.settlement.materials"
            htmlFor="settlement-material"
            hint="doctors.settlement.materialHint"
            hintValues={{
              suggested: moneyText(treatment?.suggestedMaterialCost ?? "0.00", currency),
            }}
            error={form.errors["materialCost"]}
            optional
          >
            <MoneyInput
              id="settlement-material"
              data-testid="settlement-field-material"
              currency={currency}
              placeholder={treatment ? whole(treatment.suggestedMaterialCost) : "0"}
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
            />
          </FormField>
        </div>

        <div onBlur={form.leave("clinicSharePercent")}>
          <FormField
            label="doctors.settlement.clinicPercent"
            htmlFor="settlement-percent"
            hint="doctors.settlement.percentHint"
            hintValues={{ percent: defaultPercent }}
            error={form.errors["clinicSharePercent"]}
            optional
          >
            <QuantityInput
              id="settlement-percent"
              data-testid="settlement-field-percent"
              placeholder={String(defaultPercent)}
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
            />
          </FormField>
        </div>

        <Switch
          data-testid="settlement-field-shared"
          checked={shared}
          onCheckedChange={setShared}
          label={t("doctors.settlement.sharedWork")}
        />

        {shared && (
          <div onBlur={form.leave("shareSplit")} className="flex flex-col gap-3">
            <FormField
              label="doctors.settlement.partner"
              htmlFor="settlement-partner"
              error={form.errors["shareSplit"]}
              required
            >
              <Select
                id="settlement-partner"
                data-testid="settlement-field-partner"
                value={partner}
                onChange={(event) => setPartner(event.target.value)}
                placeholder={t("doctors.settlement.choosePartner")}
                options={partners.map((doctor) => ({
                  value: doctor.id,
                  label: nameOf(doctor.user.name),
                }))}
              />
            </FormField>

            <FormField
              label="doctors.settlement.thisDoctorsWork"
              htmlFor="settlement-work"
              hint="doctors.settlement.partnerWork"
              hintValues={{ percent: SHARE_SPLIT_TOTAL - Number(work || 0) }}
              required
            >
              <QuantityInput
                id="settlement-work"
                data-testid="settlement-field-work"
                value={work}
                onChange={(event) => setWork(event.target.value)}
              />
            </FormField>
          </div>
        )}

        <Switch
          data-testid="settlement-field-waived"
          checked={waived}
          onCheckedChange={setWaived}
          label={t("doctors.settlement.waive")}
        />

        {waived && (
          <div onBlur={form.leave("shareWaivedReason")}>
            <FormField
              label="doctors.settlement.waiveReason"
              htmlFor="settlement-waive-reason"
              error={form.errors["shareWaivedReason"]}
              required
            >
              <Textarea
                id="settlement-waive-reason"
                data-testid="settlement-field-waive-reason"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
          </div>
        )}
      </div>
    </Modal>
  );
}
