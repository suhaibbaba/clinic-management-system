import { DEFAULT_TIME_ZONE, LOOKUP_LIST, localDate, type UninvoicedLine } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Card,
  DatePicker,
  FormField,
  Input,
  MoneyInput,
  Switch,
  useToast,
} from "@clinic/ui";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { useInvoiceReceipts, useUninvoiced } from "@web/modules/inventory/queries";
import { earliestPurchaseDate } from "@web/modules/inventory/lib/purchase-form";
import { useSession } from "@web/shared/providers/session";
import { canBackdatePurchase } from "@web/shared/permissions/inventory";
import { Quantity } from "@web/modules/inventory/components/quantity";

interface Picked {
  readonly include: boolean;
  readonly unitPrice: string;
}

export function UninvoicedLines({
  supplierId,
}: {
  readonly supplierId: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const toast = useToast();
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const lines = useUninvoiced(supplierId);
  const invoice = useInvoiceReceipts();
  const { can } = useSession();
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);

  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const [date, setDate] = useState(today);
  const [supplierRef, setSupplierRef] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const rows = lines.data ?? [];

  if (rows.length === 0) {
    return null;
  }

  const pickOf = (line: UninvoicedLine): Picked =>
    picked[line.receiptLineId] ?? { include: false, unitPrice: line.unitPrice ?? "" };
  const change = (line: UninvoicedLine, patch: Partial<Picked>): void =>
    setPicked((current) => ({ ...current, [line.receiptLineId]: { ...pickOf(line), ...patch } }));

  const chosen = rows.filter((line) => pickOf(line).include);
  const ready =
    chosen.length > 0 &&
    chosen.every((line) => pickOf(line).unitPrice.trim() !== "") &&
    !invoice.isPending;

  const submit = async (): Promise<void> => {
    if (!ready) {
      return;
    }

    try {
      await invoice.mutateAsync({
        supplierId,
        date,
        requestId,
        ...(supplierRef.trim() !== "" && { supplierRef: supplierRef.trim() }),
        lines: chosen.map((line) => ({
          receiptLineId: line.receiptLineId,
          unitPrice: pickOf(line).unitPrice.trim(),
        })),
      });
      toast.success("inventory.uninvoiced.invoiced");
      setPicked({});
      setSupplierRef("");
      setRequestId(crypto.randomUUID());
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <Card data-testid="uninvoiced-lines">
      <h2 className="text-heading font-medium text-primary-900">
        {t("inventory.uninvoiced.title")}
      </h2>
      <p className="mt-1 text-label text-ink-muted">{t("inventory.uninvoiced.hint")}</p>

      <ul className="mt-3 flex flex-col divide-y divide-line">
        {rows.map((line) => {
          const pick = pickOf(line);

          return (
            <li
              key={line.receiptLineId}
              data-testid="uninvoiced-line"
              data-id={line.receiptLineId}
              className="grid items-center gap-3 py-3 sm:grid-cols-[1fr_auto_12rem]"
            >
              <div className="min-w-0">
                <p className="truncate text-value">
                  <bdi>{line.itemName}</bdi>
                </p>
                <div className="flex flex-wrap items-baseline gap-x-2 text-label text-ink-muted">
                  <bdi>{line.receiptNumber}</bdi>
                  <span>{formatDate(line.receivedOn)}</span>
                  <Quantity value={line.quantity} unit={unitLabel(line.unit)} />
                </div>
              </div>
              <Switch
                checked={pick.include}
                onCheckedChange={(include) => change(line, { include })}
                label={t("inventory.uninvoiced.include")}
              />
              <MoneyInput
                cents
                aria-label={t("inventory.movement.unitPrice")}
                data-testid="uninvoiced-price"
                currency={currency}
                placeholder="0"
                value={pick.unitPrice}
                onChange={(event) => change(line, { unitPrice: event.target.value })}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid gap-4 border-t border-line pt-3 sm:grid-cols-2">
        <FormField label="inventory.purchase.date" htmlFor="uninvoiced-date" required>
          <DatePicker
            id="uninvoiced-date"
            data-testid="uninvoiced-date"
            label={t("inventory.purchase.date")}
            value={date}
            min={earliestPurchaseDate(today, canBackdatePurchase(can))}
            max={today}
            onChange={setDate}
          />
        </FormField>
        <FormField label="inventory.purchase.supplierRef" htmlFor="uninvoiced-ref" optional>
          <Input
            id="uninvoiced-ref"
            data-testid="uninvoiced-ref"
            dir="ltr"
            value={supplierRef}
            onChange={(event) => setSupplierRef(event.target.value)}
          />
        </FormField>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          data-testid="uninvoiced-submit"
          aria-disabled={!ready || undefined}
          isLoading={invoice.isPending}
          onClick={() => void submit()}
        >
          {t("inventory.uninvoiced.submit", { count: chosen.length })}
        </Button>
      </div>
    </Card>
  );
}
