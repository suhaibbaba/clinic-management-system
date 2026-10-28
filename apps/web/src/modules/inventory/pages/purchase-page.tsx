import {
  DEFAULT_TIME_ZONE,
  DISCOUNT_KIND,
  LOOKUP_LIST,
  localDate,
  toMinorUnits,
  type DiscountKind,
} from "@clinic/shared";
import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  DatePicker,
  FormField,
  Icon,
  Input,
  Money,
  MoneyInput,
  PageHeader,
  QuantityInput,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { useLookupLabels, useLookupOptions } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";
import { errorToast } from "@web/shared/lib/api-error";
import {
  useInventoryItems,
  usePostPurchase,
  usePurchaseRequest,
  useSuppliers,
} from "@web/modules/inventory/queries";
import { useSession } from "@web/shared/providers/session";
import { canPaySupplier, canSeeCosts } from "@web/shared/permissions/inventory";
import {
  blankLine,
  invoices,
  linesFromRequest,
  previewTotals,
  toPostPurchase,
  type PurchaseDraft,
  type PurchaseLineDraft,
} from "@web/modules/inventory/lib/purchase-form";

const newKey = (): string => crypto.randomUUID();

export function PurchasePage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const currency = useCurrency();
  const [params] = useSearchParams();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const items = useInventoryItems({ limit: 100 });
  const suppliers = useSuppliers({ limit: 100 });
  const post = usePostPurchase();
  const { confirm, dialog } = useConfirm("purchase-confirm");
  const [requestId] = useState(() => crypto.randomUUID());
  const request = usePurchaseRequest(params.get("request") ?? "");
  const prefilled = useRef(false);
  const { can } = useSession();
  const seesCosts = canSeeCosts(can);
  const mayPay = seesCosts && canPaySupplier(can);

  const [draft, setDraft] = useState<PurchaseDraft>(() => ({
    supplierId: params.get("supplier") ?? "",
    date: localDate(new Date(), DEFAULT_TIME_ZONE),
    withInvoice: seesCosts,
    supplierRef: "",
    discountKind: DISCOUNT_KIND.PERCENT,
    discountValue: "",
    charges: "",
    taxRate: "",
    taxAmount: "",
    paidNow: "",
    paymentMethod: "",
    note: "",
    lines: [blankLine(newKey(), params.get("item") ?? "")],
  }));

  useEffect(() => {
    if (!request.data || prefilled.current) {
      return;
    }

    prefilled.current = true;
    const lines = linesFromRequest(request.data);

    setDraft((current) => ({
      ...current,
      supplierId: request.data.supplierId ?? current.supplierId,
      lines: lines.length > 0 ? lines : current.lines,
    }));
  }, [request.data]);

  const change = (patch: Partial<PurchaseDraft>): void =>
    setDraft((current) => ({ ...current, ...patch }));
  const changeLine = (key: string, patch: Partial<PurchaseLineDraft>): void =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));

  const withInvoice = invoices(draft);
  const totals = withInvoice ? previewTotals(draft) : null;
  const method = draft.paymentMethod || (methods[0]?.value ?? "");
  const paid = draft.paidNow.trim() === "" ? 0 : toMinorUnits(draft.paidNow.trim());
  const overpaid = totals !== null && paid > toMinorUnits(totals.total);
  const linesReady = draft.lines.every(
    (line) =>
      line.itemId !== "" &&
      Number(line.quantity || "0") + Number(line.freeQuantity || "0") > 0 &&
      (!withInvoice || line.gift || line.unitPrice.trim() !== ""),
  );
  const ready = linesReady && (!withInvoice || totals !== null) && !overpaid && !post.isPending;

  const itemOptions = (items.data?.items ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} — ${unitLabel(item.unit)}`,
  }));

  const submit = (): void => {
    if (!ready) {
      return;
    }

    confirm({
      title: withInvoice
        ? "inventory.purchase.confirmInvoice"
        : "inventory.purchase.confirmReceipt",
      titleValues: {
        total: totals?.total ?? "0",
        lines: draft.lines.length,
      },
      consequences: [
        t("inventory.purchase.consequenceStock"),
        ...(withInvoice ? [t("inventory.purchase.consequenceOwed")] : []),
      ],
      onConfirm: async () => {
        try {
          const result = await post.mutateAsync(
            toPostPurchase({ ...draft, paymentMethod: method }, requestId),
          );
          toast.success("inventory.purchase.posted");
          void navigate(
            draft.supplierId ? `/inventory/suppliers/${draft.supplierId}` : "/inventory",
            { state: { posted: result.receiptNumber } },
          );
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });
  };

  return (
    <div data-testid="purchase-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="purchase-header"
        title="inventory.purchase.title"
        subtitle="inventory.purchase.subtitle"
      />

      {dialog}

      <Card data-testid="purchase-details">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="inventory.movement.supplier" htmlFor="purchase-supplier" optional>
            <Select
              searchable
              id="purchase-supplier"
              data-testid="purchase-field-supplier"
              value={draft.supplierId}
              placeholder={t("inventory.purchase.noSupplier")}
              onChange={(event) => change({ supplierId: event.target.value })}
              options={(suppliers.data?.items ?? []).map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              }))}
            />
          </FormField>
          <FormField label="inventory.purchase.date" htmlFor="purchase-date" required>
            <DatePicker
              id="purchase-date"
              data-testid="purchase-field-date"
              label={t("inventory.purchase.date")}
              value={draft.date}
              max={localDate(new Date(), DEFAULT_TIME_ZONE)}
              onChange={(date) => change({ date })}
            />
          </FormField>
          {seesCosts && draft.supplierId !== "" && (
            <>
              <Switch
                checked={draft.withInvoice}
                onCheckedChange={(withInvoiceNow) => change({ withInvoice: withInvoiceNow })}
                label={t("inventory.purchase.withInvoice")}
              />
              {draft.withInvoice && (
                <FormField label="inventory.purchase.supplierRef" htmlFor="purchase-ref" optional>
                  <Input
                    id="purchase-ref"
                    data-testid="purchase-field-ref"
                    dir="ltr"
                    value={draft.supplierRef}
                    onChange={(event) => change({ supplierRef: event.target.value })}
                  />
                </FormField>
              )}
            </>
          )}
        </div>
      </Card>

      <section data-testid="purchase-lines" className="flex flex-col gap-3">
        {draft.lines.map((line, index) => (
          <Card key={line.key} data-testid="purchase-line">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <FormField
                  label="inventory.movement.item"
                  htmlFor={`line-item-${line.key}`}
                  required
                >
                  <Select
                    searchable
                    id={`line-item-${line.key}`}
                    data-testid="purchase-line-item"
                    value={line.itemId}
                    placeholder={t("inventory.movement.selectItem")}
                    onChange={(event) => changeLine(line.key, { itemId: event.target.value })}
                    options={itemOptions}
                  />
                </FormField>
              </div>
              <FormField
                label="inventory.movement.quantity"
                htmlFor={`line-qty-${line.key}`}
                required
              >
                <QuantityInput
                  id={`line-qty-${line.key}`}
                  data-testid="purchase-line-quantity"
                  placeholder="0"
                  value={line.quantity}
                  onChange={(event) => changeLine(line.key, { quantity: event.target.value })}
                />
              </FormField>
              <FormField label="inventory.purchase.free" htmlFor={`line-free-${line.key}`} optional>
                <QuantityInput
                  id={`line-free-${line.key}`}
                  data-testid="purchase-line-free"
                  placeholder="0"
                  value={line.freeQuantity}
                  onChange={(event) => changeLine(line.key, { freeQuantity: event.target.value })}
                />
              </FormField>
              {seesCosts && !line.gift && (
                <FormField
                  label="inventory.movement.unitPrice"
                  htmlFor={`line-price-${line.key}`}
                  {...(withInvoice ? { required: true } : { optional: true })}
                >
                  <MoneyInput
                    cents
                    id={`line-price-${line.key}`}
                    data-testid="purchase-line-price"
                    currency={currency}
                    placeholder="0"
                    value={line.unitPrice}
                    onChange={(event) => changeLine(line.key, { unitPrice: event.target.value })}
                  />
                </FormField>
              )}
              {withInvoice && !line.gift && (
                <FormField
                  label="inventory.purchase.lineDiscount"
                  htmlFor={`line-discount-${line.key}`}
                  optional
                >
                  <div className="flex gap-2">
                    <SegmentedControl<DiscountKind>
                      label={t("inventory.purchase.discountKind")}
                      value={line.discountKind}
                      onChange={(discountKind) => changeLine(line.key, { discountKind })}
                      options={[
                        { value: DISCOUNT_KIND.PERCENT, label: "%" },
                        { value: DISCOUNT_KIND.AMOUNT, label: t("inventory.purchase.amount") },
                      ]}
                    />
                    <MoneyInput
                      cents
                      id={`line-discount-${line.key}`}
                      data-testid="purchase-line-discount"
                      placeholder="0"
                      value={line.discountValue}
                      onChange={(event) =>
                        changeLine(line.key, { discountValue: event.target.value })
                      }
                    />
                  </div>
                </FormField>
              )}
              <FormField
                label="inventory.movement.batchNo"
                htmlFor={`line-batch-${line.key}`}
                optional
              >
                <Input
                  id={`line-batch-${line.key}`}
                  data-testid="purchase-line-batch"
                  dir="ltr"
                  value={line.batchNo}
                  onChange={(event) => changeLine(line.key, { batchNo: event.target.value })}
                />
              </FormField>
              <FormField
                label="inventory.movement.expiry"
                htmlFor={`line-expiry-${line.key}`}
                optional
              >
                <DatePicker
                  id={`line-expiry-${line.key}`}
                  data-testid="purchase-line-expiry"
                  label={t("inventory.movement.expiry")}
                  value={line.expiryDate}
                  onChange={(expiryDate) => changeLine(line.key, { expiryDate })}
                />
              </FormField>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              {withInvoice ? (
                <Switch
                  checked={line.gift}
                  onCheckedChange={(gift) => changeLine(line.key, { gift })}
                  label={t("inventory.purchase.gift")}
                />
              ) : (
                <span />
              )}
              <div className="flex items-center gap-3">
                {totals?.lines[index] && (
                  <span className="text-label text-ink-muted">
                    {t("inventory.purchase.lineCost")}{" "}
                    <Money cents amount={totals.lines[index].cost} currency={currency} />
                  </span>
                )}
                {draft.lines.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Icon name="trash" />}
                    data-testid="purchase-line-remove"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        lines: current.lines.filter((other) => other.key !== line.key),
                      }))
                    }
                  >
                    {t("inventory.purchase.removeLine")}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}

        <Button
          variant="secondary"
          icon={<Icon name="plus" />}
          className="self-start"
          data-testid="purchase-add-line"
          onClick={() =>
            setDraft((current) => ({ ...current, lines: [...current.lines, blankLine(newKey())] }))
          }
        >
          {t("inventory.purchase.addLine")}
        </Button>
      </section>

      {withInvoice && (
        <Card data-testid="purchase-totals">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="inventory.purchase.invoiceDiscount"
              htmlFor="purchase-discount"
              optional
            >
              <div className="flex gap-2">
                <SegmentedControl<DiscountKind>
                  label={t("inventory.purchase.discountKind")}
                  value={draft.discountKind}
                  onChange={(discountKind) => change({ discountKind })}
                  options={[
                    { value: DISCOUNT_KIND.PERCENT, label: "%" },
                    { value: DISCOUNT_KIND.AMOUNT, label: t("inventory.purchase.amount") },
                  ]}
                />
                <MoneyInput
                  cents
                  id="purchase-discount"
                  data-testid="purchase-field-discount"
                  placeholder="0"
                  value={draft.discountValue}
                  onChange={(event) => change({ discountValue: event.target.value })}
                />
              </div>
            </FormField>
            <FormField label="inventory.purchase.charges" htmlFor="purchase-charges" optional>
              <MoneyInput
                cents
                id="purchase-charges"
                data-testid="purchase-field-charges"
                currency={currency}
                placeholder="0"
                value={draft.charges}
                onChange={(event) => change({ charges: event.target.value })}
              />
            </FormField>
            <FormField label="inventory.purchase.taxRate" htmlFor="purchase-tax-rate" optional>
              <Input
                id="purchase-tax-rate"
                data-testid="purchase-field-tax-rate"
                dir="ltr"
                inputMode="decimal"
                value={draft.taxRate}
                onChange={(event) => change({ taxRate: event.target.value })}
              />
            </FormField>
            <FormField label="inventory.purchase.taxAmount" htmlFor="purchase-tax-amount" optional>
              <MoneyInput
                cents
                id="purchase-tax-amount"
                data-testid="purchase-field-tax-amount"
                currency={currency}
                value={draft.taxAmount}
                onChange={(event) => change({ taxAmount: event.target.value })}
              />
            </FormField>
          </div>

          {totals && (
            <dl
              data-testid="purchase-summary"
              className="mt-4 flex flex-col gap-1 border-t border-line pt-3"
            >
              {(
                [
                  ["inventory.purchase.subtotal", totals.subtotal],
                  ["inventory.purchase.invoiceDiscount", `-${totals.invoiceDiscount}`],
                  ["inventory.purchase.charges", totals.charges],
                ] as const
              ).map(([label, amount]) => (
                <div key={label} className="flex items-baseline justify-between text-value">
                  <dt className="text-ink-muted">{t(label)}</dt>
                  <dd>
                    <Money cents amount={amount} currency={currency} />
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between text-value font-semibold">
                <dt>{t("inventory.purchase.total")}</dt>
                <dd>
                  <Money cents amount={totals.total} currency={currency} />
                </dd>
              </div>
            </dl>
          )}

          {mayPay && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField
                label="inventory.movement.paidNow"
                htmlFor="purchase-paid"
                optional
                error={overpaid ? { type: "too_big" } : undefined}
                {...(overpaid && { errorKey: "inventory.movement.paidTooMuch" })}
              >
                <MoneyInput
                  cents
                  id="purchase-paid"
                  data-testid="purchase-field-paid"
                  currency={currency}
                  placeholder="0"
                  value={draft.paidNow}
                  onChange={(event) => change({ paidNow: event.target.value })}
                />
              </FormField>
              {paid > 0 && (
                <FormField label="inventory.movement.paymentMethod" htmlFor="purchase-method">
                  <Select
                    id="purchase-method"
                    data-testid="purchase-field-method"
                    value={method}
                    onChange={(event) => change({ paymentMethod: event.target.value })}
                    options={methods}
                  />
                </FormField>
              )}
            </div>
          )}
        </Card>
      )}

      <FormField label="inventory.notes" htmlFor="purchase-note" optional>
        <Textarea
          id="purchase-note"
          data-testid="purchase-field-note"
          rows={2}
          value={draft.note}
          onChange={(event) => change({ note: event.target.value })}
        />
      </FormField>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" data-testid="purchase-cancel" onClick={() => void navigate(-1)}>
          {t("common.cancel")}
        </Button>
        <Button
          data-testid="purchase-post"
          aria-disabled={!ready || undefined}
          isLoading={post.isPending}
          onClick={submit}
        >
          {t(withInvoice ? "inventory.purchase.postInvoice" : "inventory.purchase.postReceipt")}
        </Button>
      </div>
    </div>
  );
}
