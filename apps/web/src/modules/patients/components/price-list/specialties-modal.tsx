import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, Ltr, Modal } from "@clinic/ui";
import { SpecialtyNameForm } from "@web/modules/patients/components/price-list/specialty-name-form";
import { useLocalized } from "@web/shared/hooks/use-localized";
import { useSession } from "@web/shared/providers/session";
import { useSpecialties } from "@web/shared/queries/specialties";

export function SpecialtiesModal({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const text = useLocalized();
  const { can } = useSession();
  const specialties = useSpecialties();
  const mayRename = can("specialties.update");
  const [renaming, setRenaming] = useState<string | null>(null);

  const close = (): void => {
    setRenaming(null);
    onClose();
  };

  return (
    <Modal
      data-testid="specialties-modal"
      open={open}
      size="form"
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
      title={t("specialties.title")}
      description="specialties.subscription"
      footer={
        <Button variant="secondary" data-testid="specialties-modal-close" onClick={close}>
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
              className="flex min-w-0 flex-col gap-2 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span dir="auto" className="truncate text-value font-medium text-ink">
                    {text(specialty.name)}
                  </span>
                  <span className="text-label text-ink-subtle">
                    <Ltr>{specialty.code}</Ltr> · {t(`specialties.charts.${specialty.chartType}`)}
                  </span>
                </span>
                {mayRename && renaming !== specialty.id && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="edit" />}
                    data-testid={`specialty-${specialty.id}-rename`}
                    aria-label={t("specialties.renameOne", { name: text(specialty.name) })}
                    onClick={() => setRenaming(specialty.id)}
                  >
                    {t("specialties.rename")}
                  </Button>
                )}
              </div>
              {renaming === specialty.id && (
                <SpecialtyNameForm
                  data-testid={`specialty-${specialty.id}-name-form`}
                  specialty={specialty}
                  onDone={() => setRenaming(null)}
                />
              )}
            </li>
          ))}
      </ul>
    </Modal>
  );
}
