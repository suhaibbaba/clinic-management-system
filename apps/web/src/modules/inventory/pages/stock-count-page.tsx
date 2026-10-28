import { LOOKUP_LIST, STOCK_COUNT_STATUS, type StockCountLine } from "@clinic/shared";
import { useEffect, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  type Column,
  Ltr,
  PageHeader,
  QuantityInput,
  Table,
  useConfirm,
  useToast,
} from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDateTime } from "@web/shared/lib/format";
import { useCurrency } from "@web/shared/queries/clinic";
import { useLookupLabels } from "@web/shared/queries/lookups";
import { useSession } from "@web/shared/providers/session";
import { Money } from "@web/shared/components/money";
import { canCountStock, canPostStockCount } from "@web/shared/permissions/inventory";
import {
  useCancelStockCount,
  usePostStockCount,
  useRecordCounts,
  useStockCount,
} from "@web/modules/inventory/queries";
import { countChanges, countDifference } from "@web/modules/inventory/lib/stock-count";

export function StockCountPage(): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const currency = useCurrency();
  const { can } = useSession();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const count = useStockCount(id);
  const record = useRecordCounts();
  const post = usePostStockCount();
  const cancel = useCancelStockCount();
  const { confirm, dialog } = useConfirm("stock-count-confirm");
  const [typed, setTyped] = useState<Record<string, string>>({});

  const data = count.data;
  const open = data?.status === STOCK_COUNT_STATUS.OPEN;
  const mayCount = open && canCountStock(can);
  const mayPost = open && canPostStockCount(can);

  useEffect(() => {
    if (data) {
      setTyped(Object.fromEntries(data.lines.map((line) => [line.itemId, line.counted ?? ""])));
    }
  }, [data]);

  const changes = data ? countChanges(data.lines, typed) : [];
  const missing = data ? data.lines.filter((line) => (typed[line.itemId] ?? "") === "").length : 0;
  const pending = record.isPending || post.isPending || cancel.isPending;

  const save = async (): Promise<boolean> => {
    if (changes.length === 0) {
      return true;
    }

    try {
      await record.mutateAsync({ id, body: { lines: changes } });
      return true;
    } catch (error) {
      toast.error(...errorToast(error));
      return false;
    }
  };

  const askPost = (): void => {
    if (!data || missing > 0 || pending) {
      return;
    }

    confirm({
      title: "inventory.counts.confirmPost.title",
      titleValues: { number: data.number },
      consequences: [t("inventory.counts.confirmPost.adjustments")],
      onConfirm: async () => {
        if (!(await save())) {
          throw new Error("save failed");
        }
        try {
          await post.mutateAsync(id);
          toast.success("inventory.counts.posted");
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });
  };

  const askCancel = (): void => {
    if (!data || pending) {
      return;
    }

    confirm({
      title: "inventory.counts.confirmCancel.title",
      titleValues: { number: data.number },
      consequences: [t("inventory.counts.confirmCancel.nothing")],
      onConfirm: async () => {
        try {
          await cancel.mutateAsync(id);
          void navigate("/inventory", { replace: true });
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });
  };

  const columns: readonly Column<StockCountLine>[] = [
    {
      key: "item",
      header: "inventory.counts.columns.item",
      primary: true,
      render: (line) => (
        <span className="flex flex-col items-start">
          <bdi className="font-medium text-ink">{line.itemName}</bdi>
          <span className="text-label text-ink-muted">{unitLabel(line.unit)}</span>
        </span>
      ),
    },
    {
      key: "expected",
      header: "inventory.counts.columns.expected",
      align: "numeric",
      render: (line) => <Ltr>{open ? line.current : line.expected}</Ltr>,
    },
    {
      key: "counted",
      header: "inventory.counts.columns.counted",
      render: (line) =>
        mayCount ? (
          <QuantityInput
            aria-label={t("inventory.counts.columns.counted")}
            data-testid="stock-count-counted"
            placeholder="—"
            className="max-w-28"
            value={typed[line.itemId] ?? ""}
            onChange={(event) =>
              setTyped((current) => ({ ...current, [line.itemId]: event.target.value }))
            }
          />
        ) : (
          <Ltr>{line.counted ?? "—"}</Ltr>
        ),
    },
    {
      key: "difference",
      header: "inventory.counts.columns.difference",
      align: "numeric",
      render: (line) => {
        const difference = open
          ? countDifference(typed[line.itemId] ?? "", line.current)
          : line.difference;

        return difference === null ? (
          "—"
        ) : (
          <Ltr
            className={
              Number(difference) < 0
                ? "text-danger-600"
                : Number(difference) > 0
                  ? "text-success-700"
                  : "text-ink-muted"
            }
          >
            {difference}
          </Ltr>
        );
      },
    },
    ...(data?.lines.some((line) => line.value !== undefined) && !open
      ? [
          {
            key: "value",
            header: "inventory.counts.columns.value",
            align: "numeric" as const,
            render: (line: StockCountLine) =>
              line.value ? <Money amount={line.value} currency={currency} /> : "—",
          } satisfies Column<StockCountLine>,
        ]
      : []),
  ];

  return (
    <div data-testid="stock-count-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="stock-count-header"
        title="inventory.counts.title"
        subtitle="inventory.counts.subtitle"
        primaryAction={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  open
                    ? "warning"
                    : data.status === STOCK_COUNT_STATUS.POSTED
                      ? "success"
                      : "neutral"
                }
              >
                {t(`inventory.counts.status.${data.status}`)}
              </Badge>
              {mayCount && (
                <Button
                  variant="secondary"
                  data-testid="stock-count-save"
                  isLoading={record.isPending}
                  aria-disabled={changes.length === 0 || pending || undefined}
                  onClick={() =>
                    void save().then((saved) => saved && toast.success("inventory.counts.saved"))
                  }
                >
                  {t("inventory.counts.save")}
                </Button>
              )}
              {mayCount && (
                <Button
                  variant="ghost"
                  data-testid="stock-count-cancel"
                  aria-disabled={pending || undefined}
                  onClick={askCancel}
                >
                  {t("inventory.counts.cancel")}
                </Button>
              )}
              {mayPost && (
                <Button
                  data-testid="stock-count-post"
                  isLoading={post.isPending}
                  aria-disabled={missing > 0 || pending || undefined}
                  onClick={askPost}
                >
                  {t("inventory.counts.post")}
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {data && (
        <p className="text-label text-ink-muted">
          <Ltr>{data.number}</Ltr> ·{" "}
          {t("inventory.counts.snapshot", { at: formatDateTime(data.snapshotAt) })}
          {open && missing > 0 && ` · ${t("inventory.counts.missing", { count: missing })}`}
        </p>
      )}

      {dialog}

      <Table
        data-testid="stock-count-table"
        columns={columns}
        rows={data?.lines ?? []}
        rowKey={(line) => line.itemId}
        isLoading={count.isPending}
      />
    </div>
  );
}
