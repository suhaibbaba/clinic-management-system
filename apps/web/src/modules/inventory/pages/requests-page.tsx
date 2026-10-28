import { PURCHASE_REQUEST_STATUS, type PurchaseRequest } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
  usePurchaseRequests,
  useRequestBelowMinimum,
} from "@web/modules/inventory/queries";
import {
  REQUEST_FILTERS,
  REQUEST_STATUS_TONES,
  type RequestFilter,
} from "@web/modules/inventory/constants";
import { RequestFormModal } from "@web/modules/inventory/components/request-form-modal";
import { SendRequestModal } from "@web/modules/inventory/components/send-request-modal";
import { CancelRequestModal } from "@web/modules/inventory/components/cancel-request-modal";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

const isOpen = (request: PurchaseRequest): boolean =>
  request.status === PURCHASE_REQUEST_STATUS.REQUESTED ||
  request.status === PURCHASE_REQUEST_STATUS.ORDERED ||
  request.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED;

export function RequestsPage(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useSession();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const [filter, setFilter] = useTabParam<RequestFilter>("status", REQUEST_FILTERS, "all", [
    "page",
  ]);
  const requests = usePurchaseRequests({
    page,
    limit: perPage,
    ...(filter !== "all" && { status: filter }),
  });
  const belowMinimum = useRequestBelowMinimum();
  const close = useCloseRequest();
  const [editing, setEditing] = useState<PurchaseRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState<PurchaseRequest | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const mayRequest = canRequestPurchase(can);
  const maySend = canSendPurchaseRequest(can);
  const mayManage = canManagePurchaseRequest(can);
  const mayReceive = canPostPurchase(can);

  const requestBelowMinimum = async (): Promise<void> => {
    try {
      const created = await belowMinimum.mutateAsync();
      toast.success("inventory.requests.fromMinimum", { count: created.length });
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const closeRemainder = async (id: string): Promise<void> => {
    try {
      await close.mutateAsync(id);
      toast.success("inventory.requests.closed");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

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
      render: (row) =>
        isOpen(row) && (maySend || mayReceive || mayManage || mayRequest) ? (
          <RowMenu label={t("inventory.requests.menu")} data-testid="request-actions">
            {mayReceive && (
              <MenuItem
                icon="package"
                data-testid="request-receive"
                onSelect={() => void navigate(`/inventory/purchases/new?request=${row.id}`)}
              >
                {t("inventory.requests.receive")}
              </MenuItem>
            )}
            {maySend && row.supplierId && (
              <MenuItem icon="whatsapp" data-testid="request-send" onSelect={() => setSending(row)}>
                {t(row.sentAt ? "inventory.requests.sendUpdate" : "inventory.requests.send")}
              </MenuItem>
            )}
            {mayRequest && row.status !== PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED && (
              <MenuItem icon="edit" data-testid="request-edit" onSelect={() => setEditing(row)}>
                {t("common.edit")}
              </MenuItem>
            )}
            {mayManage && row.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED && (
              <MenuItem
                icon="check"
                data-testid="request-close"
                onSelect={() => void closeRemainder(row.id)}
              >
                {t("inventory.requests.closeRemainder")}
              </MenuItem>
            )}
            {mayManage && (
              <MenuItem
                icon="x"
                tone="danger"
                data-testid="request-cancel"
                onSelect={() => setCancelling(row.id)}
              >
                {t("inventory.requests.cancel")}
              </MenuItem>
            )}
          </RowMenu>
        ) : null,
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
              <Button
                variant="secondary"
                icon={<Icon name="alert" />}
                data-testid="requests-below-minimum"
                isLoading={belowMinimum.isPending}
                onClick={() => void requestBelowMinimum()}
              >
                {t("inventory.requests.belowMinimum")}
              </Button>
              <Button
                icon={<Icon name="plus" />}
                data-testid="requests-new"
                onClick={() => setCreating(true)}
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

      <RequestFormModal
        open={creating || editing !== null}
        request={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
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
