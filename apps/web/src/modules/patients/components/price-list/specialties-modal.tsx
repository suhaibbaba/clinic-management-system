import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Ltr, Modal } from "@clinic/ui";
import { useSpecialties } from "@web/shared/queries/specialties";

export function SpecialtiesModal({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const specialties = useSpecialties();

  return (
    <Modal
      data-testid="specialties-modal"
      open={open}
      size="form"
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
      title={t("specialties.title")}
      description="specialties.subscription"
      footer={
        <Button variant="secondary" data-testid="specialties-modal-close" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      <ul data-testid="specialties-list" className="flex flex-col divide-y divide-line">
        {(specialties.data?.items ?? [])
          .filter((specialty) => specialty.isActive)
          .map((specialty) => (
            <li
              key={specialty.id}
              data-testid={`specialty-${specialty.id}`}
              className="flex min-w-0 flex-col py-2"
            >
              <span className="truncate text-value font-medium text-ink">{specialty.name}</span>
              <span className="text-label text-ink-subtle">
                <Ltr>{specialty.code}</Ltr> · {t(`specialties.charts.${specialty.chartType}`)}
              </span>
            </li>
          ))}
      </ul>
    </Modal>
  );
}
