import { DEFAULT_TIME_ZONE, LOOKUP_LIST, localDate } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormField,
  Input,
  Modal,
  MoneyInput,
  QuantityInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useInventoryItems, useReturnToSupplier } from "@web/modules/inventory/queries";

export function SupplierReturnModal({
  supplierId,
  open,
  mayCredit,
  onClose,
}: {
  readonly supplierId: string;
  readonly open: boolean;
  readonly mayCredit: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const items = useInventoryItems({ limit: 100, supplierId });
  const returning = useReturnToSupplier();
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [credit, setCredit] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const ready = itemId !== "" && Number(quantity || "0") > 0 && !returning.isPending;

  const close = (): void => {
    setItemId("");
    setQuantity("");
    setBatchNo("");
    setCredit("");
    setSupplierRef("");
    setNote("");
    setRequestId(crypto.randomUUID());
    onClose();
  };

  const submit = async (): Promise<void> => {
    if (!ready) {
      return;
    }

    try {
      const result = await returning.mutateAsync({
        supplierId,
        date: localDate(new Date(), DEFAULT_TIME_ZONE),
        requestId,
        lines: [
          {
            itemId,
            quantity: quantity.trim(),
            ...(batchNo.trim() !== "" && { batchNo: batchNo.trim() }),
          },
        ],
        ...(mayCredit &&
          Number(credit || "0") > 0 && {
            credit: {
              amount: credit.trim(),
              ...(supplierRef.trim() !== "" && { supplierRef: supplierRef.trim() }),
            },
          }),
        ...(note.trim() !== "" && { note: note.trim() }),
      });
      toast.success("inventory.supplierReturn.done", { number: result.returnNumber });
      close();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="supplier-return-modal"
      open={open}
      onOpenChange={(next) => !next && close()}
      title="inventory.supplierReturn.title"
      description={t("inventory.supplierReturn.description")}
      footer={
        <>
          <Button variant="secondary" data-testid="supplier-return-cancel" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid="supplier-return-confirm"
            isLoading={returning.isPending}
            aria-disabled={!ready || undefined}
            onClick={() => void submit()}
          >
            {t("inventory.supplierReturn.confirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField label="inventory.movement.item" htmlFor="supplier-return-item" required>
            <Select
              searchable
              id="supplier-return-item"
              data-testid="supplier-return-item"
              value={itemId}
              placeholder={t("inventory.movement.selectItem")}
              onChange={(event) => setItemId(event.target.value)}
              options={(items.data?.items ?? []).map((item) => ({
                value: item.id,
                label: `${item.name} — ${unitLabel(item.unit)}`,
              }))}
            />
          </FormField>
        </div>
        <FormField label="inventory.movement.quantity" htmlFor="supplier-return-quantity" required>
          <QuantityInput
            id="supplier-return-quantity"
            data-testid="supplier-return-quantity"
            placeholder="0"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>
        <FormField label="inventory.movement.batchNo" htmlFor="supplier-return-batch" optional>
          <Input
            id="supplier-return-batch"
            data-testid="supplier-return-batch"
            dir="ltr"
            value={batchNo}
            onChange={(event) => setBatchNo(event.target.value)}
          />
        </FormField>
        {mayCredit && (
          <>
            <FormField
              label="inventory.supplierReturn.credit"
              htmlFor="supplier-return-credit"
              optional
            >
              <MoneyInput
                cents
                id="supplier-return-credit"
                data-testid="supplier-return-credit"
                currency={currency}
                placeholder="0"
                value={credit}
                onChange={(event) => setCredit(event.target.value)}
              />
            </FormField>
            <FormField
              label="inventory.purchase.supplierRef"
              htmlFor="supplier-return-ref"
              optional
            >
              <Input
                id="supplier-return-ref"
                data-testid="supplier-return-ref"
                dir="ltr"
                value={supplierRef}
                onChange={(event) => setSupplierRef(event.target.value)}
              />
            </FormField>
          </>
        )}
      </div>
      <FormField label="inventory.notes" htmlFor="supplier-return-note" optional>
        <Textarea
          id="supplier-return-note"
          data-testid="supplier-return-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
