import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, Modal } from "@clinic/ui";
import type { SupplierGroup } from "@web/modules/inventory/lib/shopping-list";

export function SupplierSplitModal({
  groups,
  onBuy,
  onClose,
}: {
  readonly groups: readonly SupplierGroup[] | null;
  readonly onBuy: (group: SupplierGroup) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <Modal
      data-testid="supplier-split-modal"
      open={groups !== null}
      onOpenChange={(open) => !open && onClose()}
      title="inventory.shoppingList.splitTitle"
      description={t("inventory.shoppingList.splitDescription")}
      footer={
        <Button variant="secondary" data-testid="supplier-split-close" onClick={onClose}>
          {t("common.cancel")}
        </Button>
      }
    >
      <ul data-testid="supplier-split-groups" className="flex flex-col divide-y divide-line">
        {(groups ?? []).map((group) => (
          <li
            key={group.supplierId ?? "none"}
            data-testid="supplier-split-group"
            data-supplier={group.supplierId ?? "none"}
            className="flex items-center justify-between gap-3 py-3"
          >
            <span className="flex min-w-0 flex-col">
              <bdi className="truncate font-medium text-ink">
                {group.supplierName ?? t("inventory.purchase.noSupplier")}
              </bdi>
              <span className="text-label text-ink-muted">
                {t("inventory.purchase.itemCount", { count: group.lines.length })}
              </span>
            </span>
            <Button
              size="sm"
              data-testid="supplier-split-buy"
              icon={<Icon name="package" />}
              className="shrink-0"
              onClick={() => onBuy(group)}
            >
              {t("inventory.shoppingList.buyGroup")}
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
