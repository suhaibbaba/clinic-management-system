import { updateTreatmentSettlementSchema, type SettlementTreatment } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Modal, MoneyInput, QuantityInput, useToast } from "@clinic/ui";
import { useSetTreatmentSettlement } from "@web/modules/doctors/queries";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { moneyText } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";

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
  const save = useSetTreatmentSettlement(doctorId);

  const [material, setMaterial] = useState("");
  const [percent, setPercent] = useState("");

  const body = {
    materialCost: material === "" ? null : material,
    clinicSharePercent: percent === "" ? null : Number(percent),
  };
  const form = useFormErrors(schemaErrors(updateTreatmentSettlementSchema, body));
  const { reset } = form;

  useEffect(() => {
    if (treatment) {
      setMaterial(treatment.materialCostSet ? whole(treatment.materialCost) : "");
      setPercent(treatment.clinicSharePercentSet ? String(treatment.clinicSharePercent) : "");
      reset();
    }
  }, [treatment, reset]);

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
      </div>
    </Modal>
  );
}
