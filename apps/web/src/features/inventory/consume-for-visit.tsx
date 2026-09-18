import type { PatientClinicalView } from "@clinic/shared";
import { LOOKUP_LIST, MOVEMENT_TYPE } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button, FormField, Modal, Select } from "@clinic/ui";
import { useLookupLabels } from "@web/features/lookups/queries";
import { MovementModal } from "@web/features/inventory/movement-modal";
import { useInventoryItems } from "@web/features/inventory/queries";

export function ConsumeForVisit({
  open,
  onClose,
  patient,
  "data-testid": testId = "consume-for-visit",
}: {
  readonly "data-testid"?: string | undefined;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly patient: PatientClinicalView | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const [itemId, setItemId] = useState("");

  const items = useInventoryItems({ limit: 100 });

  useEffect(() => {
    if (open) {
      setItemId("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const chosen = items.data?.items.find((item) => item.id === itemId);

  if (chosen) {
    return (
      <MovementModal
        data-testid={`${testId}-movement`}
        type={MOVEMENT_TYPE.CONSUME}
        item={chosen}
        onClose={onClose}
        {...(patient && {
          patient: {
            id: patient.id,
            fullName: patient.fullName,
            phone: patient.phone,
            fileNumber: patient.fileNumber,
          },
        })}
      />
    );
  }

  return (
    <Modal
      data-testid={testId}
      open
      onOpenChange={(next) => !next && onClose()}
      title={t("inventory.movement.consumeFromVisit")}
      description={t("inventory.movement.consumeFromVisitDescription")}
      footer={
        <Button variant="secondary" data-testid={`${testId}-cancel`} onClick={onClose}>
          {t("common.cancel")}
        </Button>
      }
    >
      <FormField label="inventory.movement.item" htmlFor="consume-item" required>
        <Select
          id="consume-item"
          data-testid="consume-field-item"
          value={itemId}
          placeholder={t("inventory.movement.selectItem")}
          onChange={(event) => setItemId(event.target.value)}
          options={(items.data?.items ?? []).map((item) => ({
            value: item.id,
            label: `${item.nameAr} — ${item.quantity} ${unitLabel(item.unit)}`,
          }))}
        />
      </FormField>
    </Modal>
  );
}
