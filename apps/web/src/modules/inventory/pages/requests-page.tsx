import { type PurchaseRequest } from "@clinic/shared";
import type { JSX } from "react";
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
} from "@clinic/ui";
import { formatDate } from "@web/shared/lib/format";
import { useSession } from "@web/shared/providers/session";
import { canRequestPurchase } from "@web/shared/permissions/inventory";
import { usePurchaseRequests } from "@web/modules/inventory/queries";
import {
  MODE_PARAM,
  REQUESTS_PATH,
  REQUEST_FILTERS,
  REQUEST_STATUS_TONES,
  SHOPPING_LIST_PATH,
  type RequestFilter,
} from "@web/modules/inventory/constants";
import { useRequestActions } from "@web/modules/inventory/hooks/use-request-actions";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function RequestsPage(): JSX.Element {
  const { t } = useTranslation();
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
  const { actionsFor, dialogs } = useRequestActions();
  const mayRequest = canRequestPurchase(can);

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
        onRowClick={(row) => void navigate(`${REQUESTS_PATH}/${row.id}`)}
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

      {dialogs}
    </div>
  );
}
