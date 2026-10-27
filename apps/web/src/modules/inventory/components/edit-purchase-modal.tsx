import { correctPurchaseSchema, LOOKUP_LIST, type SupplierStatementEntry } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Modal,
  MoneyInput,
  QuantityInput,
  Textarea,
  useToast,
} from "@clinic/ui";
import { Money } from "@web/shared/components/money";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useCorrectPurchase } from "@web/modules/inventory/queries";
import { purchaseTotal } from "@web/modules/inventory/lib/purchase-payment";
import { errorToast } from "@web/shared/lib/api-error";
import { schemaErrors } from "@web/shared/lib/form-errors";
import { useFormErrors } from "@web/shared/hooks/use-form-errors";

export function EditPurchaseModal({
  purchase,
  currency,
  onClose,
}: {
  readonly purchase: SupplierStatementEntry | null;
  readonly currency: string | undefined;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const correct = useCorrectPurchase();

  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [reason, setReason] = useState("");

  const body = {
    quantity: quantity.trim(),
    ...(unitPrice.trim() !== "" && { unitPrice: unitPrice.trim() }),
    reason: reason.trim(),
  };
  const form = useFormErrors(schemaErrors(correctPurchaseSchema, body));
  const { reset } = form;
  const total = purchaseTotal(quantity, unitPrice);

  useEffect(() => {
    if (purchase) {
      setQuantity(purchase.quantity ?? "");
      setUnitPrice(purchase.unitPrice?.split(".")[0] ?? "");
      setReason("");
      reset();
    }
  }, [purchase, reset]);

  const submit = async (): Promise<void> => {
    if (!purchase || !form.check()) {
      return;
    }

    try {
      await correct.mutateAsync({ id: purchase.id, body });
      toast.success("inventory.suppliers.purchase.updated");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="purchase-edit-modal"
      open={purchase !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("inventory.suppliers.purchase.editTitle", { item: purchase?.itemName ?? "" })}
      description={t("inventory.suppliers.purchase.editDescription")}
      footer={
        <>
          <Button variant="secondary" data-testid="purchase-edit-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid="purchase-edit-save"
            aria-disabled={!form.isValid || correct.isPending || undefined}
            isLoading={correct.isPending}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div ref={form.formRef} data-testid="purchase-edit-form" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div onBlur={form.leave("quantity")}>
            <FormField
              error={form.errors["quantity"]}
              label="inventory.movement.quantity"
              htmlFor="purchase-edit-quantity"
              {...(purchase?.unit && { hint: unitLabel(purchase.unit) })}
              required
            >
              <QuantityInput
                id="purchase-edit-quantity"
                data-testid="purchase-edit-quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </FormField>
          </div>
          <div onBlur={form.leave("unitPrice")}>
            <FormField
              error={form.errors["unitPrice"]}
              label="inventory.movement.unitPrice"
              htmlFor="purchase-edit-price"
              optional
            >
              <MoneyInput
                id="purchase-edit-price"
                data-testid="purchase-edit-price"
                currency={currency}
                placeholder="0"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
              />
            </FormField>
          </div>
        </div>

        {total !== null && (
          <div className="flex items-baseline justify-between rounded-panel bg-inset px-3 py-2">
            <span className="text-label text-ink-muted">
              {t("inventory.movement.purchaseTotal")}
            </span>
            <Money amount={total} currency={currency} className="font-medium" />
          </div>
        )}

        <div onBlur={form.leave("reason")}>
          <FormField
            error={form.errors["reason"]}
            label="inventory.movement.reason"
            htmlFor="purchase-edit-reason"
            required
          >
            <Textarea
              id="purchase-edit-reason"
              data-testid="purchase-edit-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
