import { PURCHASE_REQUEST_STATUS, type PurchaseRequest } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  type Column,
  EmptyState,
  Icon,
  Ltr,
  MenuItem,
  PageHeader,
  RowMenu,
  SegmentedControl,
  Table,
  usePageParams,
  useTabParam,
  useToast,
} from "@clinic/ui";
import type { IconName } from "@clinic/ui/components/icon";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDate } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import {
  canManagePurchaseRequest,
  canPostPurchase,
  canRequestPurchase,
  canSeeCosts,
  canSendPurchaseRequest,
} from "@web/shared/permissions/inventory";
import {
  useCloseRequest,
  usePurchaseRequest,
  usePurchaseRequests,
} from "@web/modules/inventory/queries";
import {
  MODE_PARAM,
  ORDER_PARAM,
  REQUEST_FILTERS,
  REQUEST_PARAM,
  REQUEST_STATUS_TONES,
  SHOPPING_LIST_PATH,
  type RequestFilter,
} from "@web/modules/inventory/constants";
import { SendRequestModal } from "@web/modules/inventory/components/send-request-modal";
import { CancelRequestModal } from "@web/modules/inventory/components/cancel-request-modal";
import { RequestDrawer } from "@web/modules/inventory/components/request-drawer";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

interface RequestAction {
  readonly key: string;
  readonly icon: IconName;
  readonly label: string;
  readonly danger?: boolean;
  readonly run: () => void;
}

const isOpen = (request: PurchaseRequest): boolean =>
  request.status === PURCHASE_REQUEST_STATUS.REQUESTED ||
  request.status === PURCHASE_REQUEST_STATUS.ORDERED ||
  request.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED;

export function RequestsPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const [filter, setFilter] = useTabParam<RequestFilter>("status", REQUEST_FILTERS, "all", [
    "page",
  ]);
  const requests = usePurchaseRequests({
    page,
    limit: perPage,
    ...(filter !== "all" && { status: filter }),
  });
  const close = useCloseRequest();
  const [sending, setSending] = useState<PurchaseRequest | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const mayRequest = canRequestPurchase(can);
  const maySend = canSendPurchaseRequest(can);
  const mayManage = canManagePurchaseRequest(can);
  const mayReceive = canPostPurchase(can);

  const closeRemainder = async (id: string): Promise<void> => {
    try {
      await close.mutateAsync(id);
      toast.success("inventory.requests.closed");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const actionsFor = (row: PurchaseRequest): readonly RequestAction[] =>
    isOpen(row)
      ? [
          ...(mayReceive
            ? [
                {
                  key: "receive",
                  icon: "package" as const,
                  label: "inventory.requests.receive",
                  run: () => void navigate(`/inventory/purchases/new?request=${row.id}`),
                },
              ]
            : []),
          ...(maySend && row.supplierId
            ? [
                {
                  key: "send",
                  icon: "whatsapp" as const,
                  label: row.sentAt ? "inventory.requests.sendUpdate" : "inventory.requests.send",
                  run: () => setSending(row),
                },
              ]
            : []),
          ...(mayRequest && row.status !== PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED
            ? [
                {
                  key: "edit",
                  icon: "edit" as const,
                  label: "common.edit",
                  run: () => void navigate(`/inventory/purchases/new?${ORDER_PARAM}=${row.id}`),
                },
              ]
            : []),
          ...(mayManage && row.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED
            ? [
                {
                  key: "close",
                  icon: "check" as const,
                  label: "inventory.requests.closeRemainder",
                  run: () => void closeRemainder(row.id),
                },
              ]
            : []),
          ...(mayManage
            ? [
                {
                  key: "cancel",
                  icon: "x" as const,
                  label: "inventory.requests.cancel",
                  danger: true,
                  run: () => setCancelling(row.id),
                },
              ]
            : []),
        ]
      : [];

  const openedId = params.get(REQUEST_PARAM) ?? "";
  const fetched = usePurchaseRequest(openedId);
  const opened =
    openedId === ""
      ? undefined
      : (fetched.data ?? requests.data?.items.find((row) => row.id === openedId));
  const setOpened = (id: string | null): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (id === null) {
          next.delete(REQUEST_PARAM);
        } else {
          next.set(REQUEST_PARAM, id);
        }

        return next;
      },
      { replace: id === null },
    );
  const openedActions = opened ? actionsFor(opened) : [];

  const columns: readonly Column<PurchaseRequest>[] = [
    {
      key: "number",
      header: "inventory.requests.columns.number",
      primary: true,
      render: (row) => (
        <span className="flex flex-col items-start">
          <Ltr className="font-medium text-ink">{row.number}</Ltr>
          <span className="text-label text-ink-muted">
            {row.supplierName ? <bdi>{row.supplierName}</bdi> : t("inventory.purchase.noSupplier")}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "inventory.requests.columns.status",
      render: (row) => (
        <Badge tone={REQUEST_STATUS_TONES[row.status]} data-testid="request-status">
          {t(`inventory.requests.status.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: "items",
      header: "inventory.requests.columns.items",
      render: (row) => (
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-ink-muted">
          {row.lines.slice(0, 3).map((line) => (
            <span key={line.id}>
              <bdi>{line.itemName}</bdi> × <Ltr>{line.quantity}</Ltr>
            </span>
          ))}
          {row.lines.length > 3 && <Ltr>+{row.lines.length - 3}</Ltr>}
        </span>
      ),
    },
    {
      key: "created",
      header: "inventory.requests.columns.created",
      hideOnMobile: true,
      render: (row) => <Ltr>{formatDate(row.createdAt)}</Ltr>,
    },
    {
      key: "actions",
      header: "common.actions",
      actions: true,
      render: (row) => {
        const actions = actionsFor(row);

        return actions.length > 0 ? (
          <RowMenu label={t("inventory.requests.menu")} data-testid="request-actions">
            {actions.map((action) => (
              <MenuItem
                key={action.key}
                icon={action.icon}
                {...(action.danger && { tone: "danger" as const })}
                data-testid={`request-${action.key}`}
                onSelect={action.run}
              >
                {t(action.label)}
              </MenuItem>
            ))}
          </RowMenu>
        ) : null;
      },
    },
  ];

  const data = requests.data;

  return (
    <div data-testid="requests-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="requests-header"
        title="inventory.requests.title"
        subtitle="inventory.requests.subtitle"
        primaryAction={
          mayRequest ? (
            <div className="flex flex-wrap items-center gap-2">
              {can("inventory.shoppingList") && (
                <Button
                  variant="secondary"
                  icon={<Icon name="clipboard" />}
                  data-testid="requests-shopping-list"
                  onClick={() => void navigate(SHOPPING_LIST_PATH)}
                >
                  {t("inventory.shoppingList.action")}
                </Button>
              )}
              <Button
                icon={<Icon name="plus" />}
                data-testid="requests-new"
                onClick={() => void navigate(`/inventory/purchases/new?${MODE_PARAM}=order`)}
              >
                {t("inventory.requests.new")}
              </Button>
            </div>
          ) : undefined
        }
      />

      <SegmentedControl<RequestFilter>
        data-testid="requests-filter"
        label={t("inventory.requests.filter")}
        value={filter}
        onChange={(value) => {
          resetPage();
          setFilter(value);
        }}
        options={REQUEST_FILTERS.map((value) => ({
          value,
          label: t(
            value === "all" ? "inventory.requests.all" : `inventory.requests.status.${value}`,
          ),
        }))}
      />

      <Table
        data-testid="requests-table"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => setOpened(row.id)}
        isLoading={requests.isPending}
        isRefreshing={isRefetching(requests)}
        pagination={{
          page,
          totalPages: data?.totalPages ?? 1,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="requests-empty"
            title="inventory.requests.empty"
            hint="inventory.requests.emptyHint"
          />
        }
      />

      <RequestDrawer
        request={opened}
        onClose={() => setOpened(null)}
        footer={
          openedActions.length > 0 ? (
            <div className="flex items-center gap-2">
              {openedActions.slice(0, 1).map((action) => (
                <Button
                  key={action.key}
                  icon={<Icon name={action.icon} />}
                  data-testid={`request-drawer-${action.key}`}
                  onClick={action.run}
                >
                  {t(action.label)}
                </Button>
              ))}
              {openedActions.length > 1 && (
                <RowMenu
                  size="target"
                  label={t("inventory.requests.menu")}
                  data-testid="request-drawer-more"
                >
                  {openedActions.slice(1).map((action) => (
                    <MenuItem
                      key={action.key}
                      icon={action.icon}
                      {...(action.danger && { tone: "danger" as const })}
                      data-testid={`request-drawer-${action.key}`}
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

      <SendRequestModal
        request={sending}
        mayShowPrices={canSeeCosts(can)}
        onClose={() => setSending(null)}
      />
      <CancelRequestModal requestId={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}
