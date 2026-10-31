import { LOOKUP_LIST, type PurchaseRequest, type PurchaseRequestLine } from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  type Column,
  Icon,
  Ltr,
  MenuItem,
  Money,
  PageHeader,
  PersonName,
  PhoneLink,
  RowMenu,
  Table,
} from "@clinic/ui";
import { cn } from "@clinic/ui/lib/cn";
import { formatDate, formatDateTime } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { usePurchaseRequest } from "@web/modules/inventory/queries";
import { REQUEST_STATUS_TONES } from "@web/modules/inventory/constants";
import { useRequestActions } from "@web/modules/inventory/hooks/use-request-actions";
import { isOpenRequest } from "@web/modules/inventory/lib/request-actions";

function Field({
  label,
  wide = false,
  children,
}: {
  readonly label: string;
  readonly wide?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("min-w-0", wide && "col-span-full")}>
      <dt className="text-meta text-ink-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-ink">{children}</dd>
    </div>
  );
}

const quantity = (value: string): JSX.Element => <Ltr>{String(Number(value))}</Ltr>;

export function RequestPage(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  const currency = useCurrency();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const request = usePurchaseRequest(id);
  const { actionsFor, dialogs } = useRequestActions();

  const data: PurchaseRequest | undefined = request.data;
  const actions = data ? actionsFor(data) : [];
  const [first, ...rest] = actions;
  const waiting = data !== undefined && isOpenRequest(data);
  const priced = (data?.lines ?? []).some((line) => line.lastPrice != null);

  const columns: readonly Column<PurchaseRequestLine>[] = [
    {
      key: "item",
      header: "inventory.requests.columns.items",
      primary: true,
      render: (line) => (
        <span className="flex flex-col items-start">
          <bdi className="font-medium text-ink">{line.itemName}</bdi>
          <span className="text-label text-ink-muted">{unitLabel(line.unit)}</span>
          {line.note && <span className="text-label text-ink-muted">{line.note}</span>}
        </span>
      ),
    },
    {
      key: "ordered",
      header: "inventory.requests.ordered",
      align: "numeric",
      render: (line) => quantity(line.quantity),
    },
    {
      key: "received",
      header: "inventory.requests.received",
      align: "numeric",
      render: (line) => quantity(line.received),
    },
    {
      key: "remaining",
      header: "inventory.requests.remaining",
      align: "numeric",
      render: (line) => (
        <span
          className={
            waiting && Number(line.open) > 0 ? "font-medium text-warning-700" : "text-ink-muted"
          }
        >
          {quantity(line.open)}
        </span>
      ),
    },
    ...(priced
      ? [
          {
            key: "lastPrice",
            header: "inventory.shoppingList.lastPrice",
            align: "numeric" as const,
            render: (line: PurchaseRequestLine) =>
              line.lastPrice ? (
                <Money cents amount={line.lastPrice} currency={currency} />
              ) : (
                <span className="text-ink-subtle">—</span>
              ),
          } satisfies Column<PurchaseRequestLine>,
        ]
      : []),
  ];

  return (
    <div data-testid="request-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="request-header"
        title="inventory.requests.detailsTitle"
        subtitle="inventory.requests.detailsSubtitle"
        actions={
          first ? (
            <div className="flex items-center gap-2">
              <Button
                icon={<Icon name={first.icon} />}
                data-testid={`request-page-${first.key}`}
                onClick={first.run}
              >
                {t(first.label)}
              </Button>
              {rest.length > 0 && (
                <RowMenu
                  size="target"
                  label={t("inventory.requests.menu")}
                  data-testid="request-page-more"
                >
                  {rest.map((action) => (
                    <MenuItem
                      key={action.key}
                      icon={action.icon}
                      {...(action.danger && { tone: "danger" as const })}
                      data-testid={`request-page-${action.key}`}
                      onSelect={action.run}
                    >
                      {t(action.label)}
                    </MenuItem>
                  ))}
                </RowMenu>
              )}
            </div>
          ) : undefined
        }
      />

      {data && (
        <div
          data-testid="request-meta"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-label text-ink-muted"
        >
          <Badge tone={REQUEST_STATUS_TONES[data.status]} data-testid="request-status">
            {t(`inventory.requests.status.${data.status}`)}
          </Badge>
          <Ltr className="font-medium text-ink">{data.number}</Ltr>
        </div>
      )}

      {data && (
        <Card data-testid="request-details">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-value lg:grid-cols-4">
            <Field label={t("inventory.movement.supplier")}>
              <span className="flex flex-col items-start gap-0.5">
                <bdi>{data.supplierName ?? t("inventory.purchase.noSupplier")}</bdi>
                {data.supplierPhone && <PhoneLink value={data.supplierPhone} />}
              </span>
            </Field>
            <Field label={t("inventory.requests.createdBy")}>
              {data.createdByName ? <PersonName name={data.createdByName} /> : "—"}
              <span className="block text-meta text-ink-muted">
                <Ltr>{formatDateTime(data.createdAt)}</Ltr>
              </span>
            </Field>
            <Field label={t("inventory.requests.neededBy")}>
              {data.neededBy ? <Ltr>{formatDate(data.neededBy)}</Ltr> : "—"}
            </Field>
            <Field label={t("inventory.requests.sentAt")}>
              {data.sentAt ? (
                <span className="flex flex-col items-start gap-0.5">
                  <Ltr>{formatDateTime(data.sentAt)}</Ltr>
                  {data.sends.length > 0 && (
                    <span data-testid="request-send-count" className="text-meta text-ink-muted">
                      {t("inventory.requests.sendCount", { count: data.sends.length })}
                    </span>
                  )}
                </span>
              ) : (
                "—"
              )}
            </Field>
            {data.note && (
              <Field wide label={t("inventory.requests.note")}>
                {data.note}
              </Field>
            )}
            {data.cancelReason && (
              <Field wide label={t("inventory.requests.cancelReason")}>
                {data.cancelReason}
              </Field>
            )}
          </dl>
        </Card>
      )}

      {data && data.sends.length > 0 && (
        <Card data-testid="request-sends">
          <h2 className="text-label font-semibold text-ink">
            {t("inventory.requests.sendsTitle")}
          </h2>
          <ol className="mt-3 flex flex-col divide-y divide-line">
            {data.sends.map((send, index) => (
              <li
                key={send.id}
                data-testid={`request-send-${send.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-value first:pt-0 last:pb-0"
              >
                <Badge tone="neutral">
                  {t("inventory.requests.sendNumber", {
                    number: String(data.sends.length - index),
                  })}
                </Badge>
                <Ltr className="text-ink">{formatDateTime(send.sentAt)}</Ltr>
                {send.sentTo ? (
                  <PhoneLink value={send.sentTo} />
                ) : (
                  <span className="text-ink-muted">{t("inventory.requests.markOrdered")}</span>
                )}
                {send.sentByName && (
                  <span className="text-meta text-ink-muted">
                    {t("inventory.requests.sentBy")} <PersonName name={send.sentByName} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Table
        data-testid="request-lines"
        columns={columns}
        rows={data?.lines ?? []}
        rowKey={(line) => line.id}
        isLoading={request.isPending}
      />

      {dialogs}
    </div>
  );
}
