import {
  DEFAULT_TIME_ZONE,
  DISCOUNT_KIND,
  LOOKUP_LIST,
  addDays,
  localDate,
  toMinorUnits,
  type PurchaseRequest,
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
  InfoTip,
  Input,
  MoneyInput,
  PageHeader,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  useToast,
} from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { useLookupOptions } from "@web/shared/queries/lookups";
import { useCurrency } from "@web/shared/queries/clinic";
import { errorToast } from "@web/shared/lib/api-error";
import {
  useCreatePurchaseRequest,
  useInventoryItems,
  usePostPurchase,
  usePurchaseRequest,
  useSuppliers,
  useUpdatePurchaseRequest,
} from "@web/modules/inventory/queries";
import { useSession } from "@web/shared/providers/session";
import {
  canBackdatePurchase,
  canManageInventory,
  canPaySupplier,
  canPostPurchase,
  canRequestPurchase,
  canSeeCosts,
  canSeeItemPrices,
  canSendPurchaseRequest,
} from "@web/shared/permissions/inventory";
import { SendRequestModal } from "@web/modules/inventory/components/send-request-modal";
import { ItemFormModal } from "@web/modules/inventory/components/item-form-modal";
import {
  blankLine,
  earliestPurchaseDate,
  invoices,
  lineReady,
  linesFromLinks,
  linesFromOrder,
  linesFromRequest,
  orderReady,
  previewTotals,
  pricedTotals,
  purchaseCounts,
  purchaseMode,
  returnTarget,
  toOrderInput,
  toPostPurchase,
  type PurchaseDraft,
  type PurchaseLineDraft,
} from "@web/modules/inventory/lib/purchase-form";
import { DiscountInput } from "@web/modules/inventory/components/discount-input";
import { PurchaseLineRow } from "@web/modules/inventory/components/purchase-line-row";
import { PurchaseReviewModal } from "@web/modules/inventory/components/purchase-review-modal";
import { PurchaseTotalBar } from "@web/modules/inventory/components/purchase-total-bar";
import {
  EXPIRY_MIN_DAYS_AHEAD,
  MODE_PARAM,
  ORDER_PARAM,
  PURCHASE_LINE_GRID,
  PURCHASE_MODES,
  PURCHASE_UNIT_COLUMN,
  REQUESTS_TAB_PATH,
  RETURN_PARAM,
  type PurchaseLineLayout,
  type PurchaseMode,
} from "@web/modules/inventory/constants";

const newKey = (): string => crypto.randomUUID();

export function PurchasePage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const currency = useCurrency();
  const [params, setParams] = useSearchParams();
  const methods = useLookupOptions(LOOKUP_LIST.PAYMENT_METHOD);
  const items = useInventoryItems({ limit: 100 });
  const suppliers = useSuppliers({ limit: 100 });
  const post = usePostPurchase();
  const [reviewing, setReviewing] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const request = usePurchaseRequest(params.get("request") ?? "");
  const orderId = params.get(ORDER_PARAM) ?? "";
  const order = usePurchaseRequest(orderId);
  const createOrder = useCreatePurchaseRequest();
  const updateOrder = useUpdatePurchaseRequest();
  const [neededBy, setNeededBy] = useState("");
  const [sending, setSending] = useState<PurchaseRequest | null>(null);
  const prefilled = useRef(false);
  const { can } = useSession();
  const mayReceive = canPostPurchase(can);
  const mayOrder = canRequestPurchase(can);
  const mode = purchaseMode(
    orderId === "" ? params.get(MODE_PARAM) : "order",
    mayReceive && orderId === "",
    mayOrder,
  );
  const ordering = mode === "order";
  const seesCosts = canSeeCosts(can);
  const mayPay = seesCosts && canPaySupplier(can);
  const mayAddItem = canManageInventory(can);
  const [newItem, setNewItem] = useState<{ readonly key: string; readonly name: string } | null>(
    null,
  );

  const [draft, setDraft] = useState<PurchaseDraft>(() => {
    const linked = linesFromLinks(params.getAll("item"), newKey);

    return {
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
      lines: linked.length > 0 ? linked : [blankLine(newKey())],
    };
  });

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

  useEffect(() => {
    if (!order.data || prefilled.current) {
      return;
    }

    prefilled.current = true;
    const lines = linesFromOrder(order.data);

    setNeededBy(order.data.neededBy ?? "");
    setDraft((current) => ({
      ...current,
      supplierId: order.data.supplierId ?? "",
      note: order.data.note ?? "",
      lines: lines.length > 0 ? lines : current.lines,
    }));
  }, [order.data]);

  const switchMode = (next: PurchaseMode): void =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set(MODE_PARAM, next);
        return updated;
      },
      { replace: true },
    );

  const change = (patch: Partial<PurchaseDraft>): void =>
    setDraft((current) => ({ ...current, ...patch }));
  const changeLine = (key: string, patch: Partial<PurchaseLineDraft>): void =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));

  const withInvoice = !ordering && invoices(draft);
  const totals = withInvoice ? previewTotals(draft) : null;
  const costs = withInvoice ? totals : seesCosts && !ordering ? pricedTotals(draft) : null;
  const method = draft.paymentMethod || (methods[0]?.value ?? "");
  const paid = draft.paidNow.trim() === "" ? 0 : toMinorUnits(draft.paidNow.trim());
  const overpaid = totals !== null && paid > toMinorUnits(totals.total);
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);
  const minExpiry = addDays(today, EXPIRY_MIN_DAYS_AHEAD);
  const ready = ordering
    ? orderReady(draft.lines)
    : draft.lines.every((line) => lineReady(line, withInvoice, minExpiry)) &&
      (!withInvoice || totals !== null);
  const savingOrder = createOrder.isPending || updateOrder.isPending;
  const counts = purchaseCounts(draft.lines);

  const layout: PurchaseLineLayout = withInvoice ? "invoice" : seesCosts ? "priced" : "plain";
  const priced = layout === "invoice" || layout === "priced";
  const columns = [
    { label: "inventory.movement.item", end: false },
    { label: "inventory.purchase.unitShort", end: false, wide: true },
    { label: "inventory.movement.quantity", end: false },
    {
      label: "inventory.purchase.freeShort",
      end: false,
      hint: ordering ? "inventory.purchase.orderFieldHint" : "inventory.purchase.freeHint",
    },
    ...(priced
      ? [
          {
            label: "inventory.movement.unitPrice",
            end: false,
            ...(ordering && { hint: "inventory.purchase.orderPriceHint" }),
          },
        ]
      : []),
    ...(!priced
      ? []
      : [
          {
            label: "inventory.purchase.lineDiscount",
            end: false,
            ...(layout === "priced" && {
              hint: ordering
                ? "inventory.purchase.orderFieldHint"
                : "inventory.purchase.discountNeedsInvoice",
            }),
          },
        ]),
    ...(priced ? [{ label: "inventory.purchase.lineTotal", end: true }] : []),
  ];

  const unitOf = (itemId: string): string =>
    items.data?.items.find((item) => item.id === itemId)?.unit ?? "";

  const itemOptions = (items.data?.items ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const submit = async (): Promise<void> => {
    if (!ready || overpaid || post.isPending) {
      return;
    }

    try {
      const result = await post.mutateAsync(
        toPostPurchase({ ...draft, paymentMethod: method }, requestId),
      );
      toast.success("inventory.purchase.posted");
      const back =
        returnTarget(params.get(RETURN_PARAM)) ??
        (draft.supplierId ? `/inventory/suppliers/${draft.supplierId}` : "/inventory");

      void navigate(back, { state: { posted: result.receiptNumber } });
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const saveOrder = async (): Promise<void> => {
    if (!ready || savingOrder) {
      return;
    }

    const body = toOrderInput(draft, neededBy);

    try {
      if (orderId !== "") {
        await updateOrder.mutateAsync({ id: orderId, body });
        toast.success("inventory.requests.updated");
        void navigate(REQUESTS_TAB_PATH);
        return;
      }

      const created = await createOrder.mutateAsync({ ...body, requestId });
      toast.success("inventory.requests.created");

      if (created.supplierId && canSendPurchaseRequest(can)) {
        setSending(created);
      } else {
        void navigate(REQUESTS_TAB_PATH);
      }
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  return (
    <div data-testid="purchase-page" className="@container flex flex-col gap-5">
      <PageHeader
        data-testid="purchase-header"
        title={
          ordering
            ? orderId === ""
              ? "inventory.requests.newTitle"
              : "inventory.requests.editTitle"
            : "inventory.purchase.title"
        }
        subtitle={ordering ? "inventory.purchase.orderSubtitle" : "inventory.purchase.subtitle"}
      />

      {mayReceive && mayOrder && orderId === "" && params.get("request") === null && (
        <SegmentedControl<PurchaseMode>
          data-testid="purchase-mode"
          label={t("inventory.purchase.modeLabel")}
          value={mode}
          onChange={switchMode}
          options={PURCHASE_MODES.map((value) => ({
            value,
            label: t(`inventory.purchase.mode.${value}`),
          }))}
        />
      )}

      <Card data-testid="purchase-details">
        <div
          className={cn(
            "grid gap-4 @xl:grid-cols-2",
            "@min-[44rem]:grid-cols-[minmax(12rem,360px)_13rem_13rem_max-content] @min-[44rem]:items-end",
          )}
        >
          <div className="@xl:col-span-2 @min-[44rem]:col-span-1">
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
          </div>
          {ordering ? (
            <FormField label="inventory.requests.neededBy" htmlFor="purchase-needed-by" optional>
              <DatePicker
                id="purchase-needed-by"
                data-testid="purchase-field-needed-by"
                label={t("inventory.requests.neededBy")}
                value={neededBy}
                min={today}
                onChange={setNeededBy}
              />
            </FormField>
          ) : (
            <FormField label="inventory.purchase.date" htmlFor="purchase-date" required>
              <DatePicker
                id="purchase-date"
                data-testid="purchase-field-date"
                label={t("inventory.purchase.date")}
                value={draft.date}
                min={earliestPurchaseDate(today, canBackdatePurchase(can))}
                max={today}
                onChange={(date) => change({ date })}
              />
            </FormField>
          )}
          {withInvoice && (
            <FormField label="inventory.purchase.supplierRef" htmlFor="purchase-ref" optional>
              <Input
                id="purchase-ref"
                data-testid="purchase-field-ref"
                dir="ltr"
                placeholder={t("inventory.purchase.refPlaceholder")}
                value={draft.supplierRef}
                onChange={(event) => change({ supplierRef: event.target.value })}
              />
            </FormField>
          )}
          {seesCosts && !ordering && draft.supplierId !== "" && (
            <div className="flex items-center @xl:col-span-2 @min-[44rem]:col-span-1 @min-[44rem]:col-start-4 @min-[44rem]:h-(--control-h)">
              <Switch
                checked={draft.withInvoice}
                onCheckedChange={(withInvoiceNow) => change({ withInvoice: withInvoiceNow })}
                label={t("inventory.purchase.withInvoice")}
              />
            </div>
          )}
        </div>
      </Card>

      <Card data-testid="purchase-lines" className="@container">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-section font-semibold text-ink">
            {t("inventory.purchase.lines")}{" "}
            <span className="font-medium text-ink-muted">({draft.lines.length})</span>
          </h2>
          <Button
            variant="secondary"
            icon={<Icon name="plus" />}
            data-testid="purchase-add-line"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                lines: [...current.lines, blankLine(newKey())],
              }))
            }
          >
            {t("inventory.purchase.addLine")}
          </Button>
        </div>

        <div
          className={cn(
            "mt-3 hidden border-b border-line pb-2 text-label font-medium text-ink-muted",
            "@min-[40rem]:grid @min-[40rem]:gap-2 @min-[56rem]:gap-3",
            PURCHASE_LINE_GRID[layout],
          )}
        >
          {columns.map((column) => (
            <span
              key={column.label}
              className={cn(
                "flex min-w-0 items-center gap-1",
                column.end && "justify-end",
                "wide" in column && PURCHASE_UNIT_COLUMN[layout].column,
              )}
            >
              <span aria-hidden="true" className="truncate">
                {t(column.label)}
              </span>
              {"hint" in column && <InfoTip label={t("common.moreInfo")}>{t(column.hint)}</InfoTip>}
            </span>
          ))}
        </div>

        <ol className="flex flex-col divide-y divide-line">
          {draft.lines.map((line, index) => (
            <PurchaseLineRow
              key={line.key}
              line={line}
              layout={layout}
              itemOptions={itemOptions}
              baseUnit={unitOf(line.itemId)}
              minExpiry={minExpiry}
              currency={currency}
              cost={costs?.lines[index]?.cost}
              removable={draft.lines.length > 1}
              ordering={ordering}
              supplierId={draft.supplierId}
              mayPrice={canSeeItemPrices(can)}
              onChange={(patch) => changeLine(line.key, patch)}
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  lines: current.lines.filter((other) => other.key !== line.key),
                }))
              }
              onCreateItem={mayAddItem ? (name) => setNewItem({ key: line.key, name }) : undefined}
            />
          ))}
        </ol>
      </Card>

      {withInvoice && (
        <Card data-testid="purchase-adjustments">
          <div className="grid items-end gap-4 @xl:grid-cols-2 @min-[56rem]:grid-cols-4">
            <FormField
              label="inventory.purchase.invoiceDiscount"
              htmlFor="purchase-discount"
              optional
            >
              <DiscountInput
                id="purchase-discount"
                data-testid="purchase-field-discount"
                kind={draft.discountKind}
                value={draft.discountValue}
                currency={currency}
                onKindChange={(discountKind) => change({ discountKind })}
                onValueChange={(discountValue) => change({ discountValue })}
              />
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
                autoComplete="off"
                placeholder="0"
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
                placeholder="0"
                value={draft.taxAmount}
                onChange={(event) => change({ taxAmount: event.target.value })}
              />
            </FormField>
          </div>
        </Card>
      )}

      <div className="max-w-(--form-max)">
        <FormField label="inventory.notes" htmlFor="purchase-note" optional>
          <Textarea
            id="purchase-note"
            data-testid="purchase-field-note"
            rows={2}
            placeholder={t("common.placeholders.note")}
            value={draft.note}
            onChange={(event) => change({ note: event.target.value })}
          />
        </FormField>
      </div>

      <PurchaseTotalBar
        lines={counts.lines}
        total={totals?.total ?? null}
        currency={currency}
        reviewLabel={t(
          ordering
            ? "inventory.purchase.saveOrder"
            : withInvoice
              ? "inventory.purchase.review"
              : "inventory.purchase.reviewReceipt",
        )}
        ready={ready && !savingOrder}
        onReview={() => {
          if (ordering) {
            void saveOrder();
          } else if (ready) {
            setReviewing(true);
          }
        }}
        onCancel={() => void navigate(-1)}
      />

      <PurchaseReviewModal
        open={reviewing}
        onOpenChange={setReviewing}
        withInvoice={withInvoice}
        counts={counts}
        totals={totals}
        currency={currency}
        mayPay={mayPay}
        paidNow={draft.paidNow}
        paidMinor={paid}
        overpaid={overpaid}
        method={method}
        methods={methods}
        postLabel={t(
          withInvoice ? "inventory.purchase.postInvoice" : "inventory.purchase.postReceipt",
        )}
        posting={post.isPending}
        onPaidNowChange={(paidNow) => change({ paidNow })}
        onMethodChange={(paymentMethod) => change({ paymentMethod })}
        onPost={() => void submit()}
      />

      <SendRequestModal
        request={sending}
        mayShowPrices={seesCosts}
        onClose={() => {
          setSending(null);
          void navigate(REQUESTS_TAB_PATH);
        }}
      />

      <ItemFormModal
        data-testid="purchase-new-item"
        open={newItem !== null}
        onOpenChange={(open) => !open && setNewItem(null)}
        initialName={newItem?.name ?? ""}
        onCreated={(item) =>
          newItem && changeLine(newItem.key, { itemId: item.id, packSizeId: "" })
        }
      />
    </div>
  );
}
