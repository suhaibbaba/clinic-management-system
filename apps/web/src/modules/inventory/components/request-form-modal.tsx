import { LOOKUP_LIST, type PurchaseRequest } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  DatePicker,
  FormField,
  Icon,
  Modal,
  QuantityInput,
  Select,
  Textarea,
  useToast,
} from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useLookupLabels } from "@web/shared/queries/lookups";
import {
  useCreatePurchaseRequest,
  useInventoryItems,
  useSuppliers,
  useUpdatePurchaseRequest,
} from "@web/modules/inventory/queries";

interface LineDraft {
  readonly key: string;
  readonly itemId: string;
  readonly quantity: string;
}

const blank = (): LineDraft => ({ key: crypto.randomUUID(), itemId: "", quantity: "" });

export function RequestFormModal({
  open,
  request,
  onClose,
}: {
  readonly open: boolean;
  readonly request: PurchaseRequest | null;
  readonly onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const items = useInventoryItems({ limit: 100 });
  const suppliers = useSuppliers({ limit: 100 });
  const create = useCreatePurchaseRequest();
  const update = useUpdatePurchaseRequest();
  const [supplierId, setSupplierId] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blank()]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    setSupplierId(request?.supplierId ?? "");
    setNeededBy(request?.neededBy ?? "");
    setNote(request?.note ?? "");
    setLines(
      request
        ? request.lines.map((line) => ({
            key: line.id,
            itemId: line.itemId,
            quantity: line.quantity,
          }))
        : [blank()],
    );
    setRequestId(crypto.randomUUID());
  }, [open, request]);

  const filled = lines.filter((line) => line.itemId !== "" && Number(line.quantity || "0") > 0);
  const unique = new Set(filled.map((line) => line.itemId)).size === filled.length;
  const ready = filled.length > 0 && filled.length === lines.length && unique && !pending;

  const change = (key: string, patch: Partial<LineDraft>): void =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const submit = async (): Promise<void> => {
    if (!ready) {
      return;
    }

    const body = {
      supplierId: supplierId === "" ? null : supplierId,
      neededBy: neededBy === "" ? null : neededBy,
      note: note.trim() === "" ? null : note.trim(),
      lines: filled.map((line) => ({ itemId: line.itemId, quantity: line.quantity.trim() })),
    };

    try {
      if (request) {
        await update.mutateAsync({ id: request.id, body });
      } else {
        await create.mutateAsync({ ...body, requestId });
      }
      toast.success(request ? "inventory.requests.updated" : "inventory.requests.created");
      onClose();
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Modal
      data-testid="request-form-modal"
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={request ? "inventory.requests.editTitle" : "inventory.requests.newTitle"}
      footer={
        <>
          <Button variant="secondary" data-testid="request-form-cancel" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid="request-form-save"
            isLoading={pending}
            aria-disabled={!ready || undefined}
            onClick={() => void submit()}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="inventory.movement.supplier" htmlFor="request-supplier" optional>
          <Select
            searchable
            id="request-supplier"
            data-testid="request-supplier"
            value={supplierId}
            placeholder={t("inventory.purchase.noSupplier")}
            onChange={(event) => setSupplierId(event.target.value)}
            options={(suppliers.data?.items ?? []).map((supplier) => ({
              value: supplier.id,
              label: supplier.name,
            }))}
          />
        </FormField>
        <FormField label="inventory.requests.neededBy" htmlFor="request-needed-by" optional>
          <DatePicker
            id="request-needed-by"
            data-testid="request-needed-by"
            label={t("inventory.requests.neededBy")}
            value={neededBy}
            onChange={setNeededBy}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-3" data-testid="request-lines">
        {lines.map((line) => (
          <div
            key={line.key}
            data-testid="request-line"
            className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_auto]"
          >
            <FormField
              label="inventory.movement.item"
              htmlFor={`request-item-${line.key}`}
              required
            >
              <Select
                searchable
                id={`request-item-${line.key}`}
                data-testid="request-line-item"
                value={line.itemId}
                placeholder={t("inventory.movement.selectItem")}
                onChange={(event) => change(line.key, { itemId: event.target.value })}
                options={(items.data?.items ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.name} — ${unitLabel(item.unit)}`,
                }))}
              />
            </FormField>
            <FormField
              label="inventory.movement.quantity"
              htmlFor={`request-qty-${line.key}`}
              required
            >
              <QuantityInput
                id={`request-qty-${line.key}`}
                data-testid="request-line-quantity"
                placeholder="0"
                value={line.quantity}
                onChange={(event) => change(line.key, { quantity: event.target.value })}
              />
            </FormField>
            <Button
              variant="ghost"
              icon={<Icon name="trash" />}
              data-testid="request-line-remove"
              aria-disabled={lines.length === 1 || undefined}
              onClick={() =>
                lines.length > 1 &&
                setLines((current) => current.filter((other) => other.key !== line.key))
              }
            >
              {t("inventory.purchase.removeLine")}
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          icon={<Icon name="plus" />}
          className="self-start"
          data-testid="request-add-line"
          onClick={() => setLines((current) => [...current, blank()])}
        >
          {t("inventory.purchase.addLine")}
        </Button>
      </div>

      <FormField label="inventory.notes" htmlFor="request-note" optional>
        <Textarea
          id="request-note"
          data-testid="request-note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
