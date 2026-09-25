import type { PatientClinicalView } from "@clinic/shared";
import { MOVEMENT_TYPE } from "@clinic/shared";
import { useMemo, type JSX } from "react";
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
  const items = useInventoryItems({ limit: 100 });

  const picked = useMemo(
    () =>
      patient && {
        id: patient.id,
        fullName: patient.fullName,
        phone: patient.phone,
        fileNumber: patient.fileNumber,
      },
    [patient],
  );

  if (!open) {
    return null;
  }

  return (
    <MovementModal
      data-testid={testId}
      type={MOVEMENT_TYPE.CONSUME}
      item={undefined}
      choices={items.data?.items ?? []}
      onClose={onClose}
      {...(picked && { patient: picked })}
    />
  );
}
