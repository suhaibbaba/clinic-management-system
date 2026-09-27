import {
  LAB_ORDER_STATUS,
  labOrderStage,
  type LabOrderRow,
  type LabOrderSort,
  type LabOrderView,
} from "@clinic/shared";
import { differenceInCalendarDays } from "date-fns";
import { useEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Ltr, SearchField, Select, useToast, type Column } from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import { Money } from "@web/features/billing/money";
import { useClinic } from "@web/features/clinic/queries";
import { LAB_ORDER_FIELDS } from "@web/features/labs/fields";
import { OrderDrawer } from "@web/features/labs/order-drawer";
import { OrderFormModal } from "@web/features/labs/order-form-modal";
import { useLabOrder, useLabOrderStep, useLabs } from "@web/features/labs/queries";
import {
  availableSteps,
  LAB_ORDER_STAGE_TONES,
  LAB_ORDER_STATUS_STYLES,
} from "@web/features/labs/status";
import { errorMessageKey } from "@web/lib/api-error";
import { cn } from "@clinic/ui/lib/cn";
import { useIsMobile } from "@clinic/ui/lib/use-media-query";
import { formatDate } from "@web/lib/format";
import { useDebounced } from "@web/lib/use-debounced";

interface SortOption {
  readonly sort: LabOrderSort;
  readonly dir: "asc" | "desc";
  readonly label: string;
}

const SORT_OPTIONS: Record<LabOrderView, readonly SortOption[]> = {
  open: [
    { sort: "due", dir: "asc", label: "labs.orders.sort.dueAsc" },
    { sort: "due", dir: "desc", label: "labs.orders.sort.dueDesc" },
    { sort: "sent", dir: "desc", label: "labs.orders.sort.sentDesc" },
    { sort: "patient", dir: "asc", label: "labs.orders.sort.patientAsc" },
    { sort: "lab", dir: "asc", label: "labs.orders.sort.labAsc" },
  ],
  done: [
    { sort: "finished", dir: "desc", label: "labs.orders.sort.finishedDesc" },
    { sort: "finished", dir: "asc", label: "labs.orders.sort.finishedAsc" },
    { sort: "patient", dir: "asc", label: "labs.orders.sort.patientAsc" },
    { sort: "lab", dir: "asc", label: "labs.orders.sort.labAsc" },
  ],
};

const sortValue = (option: Pick<SortOption, "sort" | "dir">): string =>
  `${option.sort}-${option.dir}`;

export interface ListParams {
  readonly search: string;
  readonly debouncedSearch: string;
  readonly labId: string;
  readonly sort: SortOption;
  readonly isDefaultSort: boolean;
  readonly setSearch: (value: string) => void;
  /** Writes params and drops the page: a narrower list has no page seven. */
  readonly write: (change: (next: URLSearchParams) => void) => void;
}

// Everything a reader narrows the list by is in the address, so a filtered list can be sent on.
export function useListParams(view: LabOrderView, resetPage: () => void): ListParams {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const labId = params.get("lab") ?? "";
  const options = SORT_OPTIONS[view];
  const fallback = options[0] as SortOption;
  const requested = `${params.get("sort") ?? ""}-${params.get("dir") ?? ""}`;
  const sort = options.find((option) => sortValue(option) === requested) ?? fallback;

  const debouncedSearch = useDebounced(search);
  const lastSearch = useRef(debouncedSearch);

  useEffect(() => {
    if (lastSearch.current !== debouncedSearch) {
      lastSearch.current = debouncedSearch;
      resetPage();
    }
  }, [debouncedSearch]);

  const write = (change: (next: URLSearchParams) => void): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        change(next);
        next.delete("page");

        return next;
      },
      { replace: true },
    );

  return {
    search,
    debouncedSearch: debouncedSearch.trim(),
    labId,
    sort,
    isDefaultSort: sort === fallback,
    setSearch: (value) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          if (value === "") {
            next.delete("q");
          } else {
            next.set("q", value);
          }

          return next;
        },
        { replace: true },
      ),
    write,
  };
}

export const putParam = (next: URLSearchParams, key: string, value: string): void => {
  if (value === "") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
};

export function OrderSearch({ list }: { readonly list: ListParams }): JSX.Element {
  const { t } = useTranslation();

  return (
    <SearchField
      data-testid="lab-orders-search"
      className="w-full min-w-0 sm:max-w-md sm:flex-1"
      label={t("labs.orders.search")}
      shortcut="/"
      placeholder={t("labs.orders.searchPlaceholder")}
      value={list.search}
      onChange={(event) => list.setSearch(event.target.value)}
      clearLabel={t("common.clear")}
      onClear={() => list.setSearch("")}
    />
  );
}

// No label above: "All labs" says what the field is, and a row of fields sits level with the search.
export function LabFilter({
  list,
  className,
}: {
  readonly list: ListParams;
  readonly className?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const labs = useLabs({ limit: 100 });

  return (
    <Select
      data-testid="lab-orders-filter-lab"
      className={className}
      aria-label={t("labs.orders.filterLab")}
      value={list.labId}
      placeholder={t("labs.orders.allLabs")}
      onChange={(event) => list.write((next) => putParam(next, "lab", event.target.value))}
      options={(labs.data?.items ?? []).map((lab) => ({ value: lab.id, label: lab.name }))}
    />
  );
}

export function SortSelect({
  view,
  list,
  className,
}: {
  readonly view: LabOrderView;
  readonly list: ListParams;
  readonly className?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const options = SORT_OPTIONS[view];

  return (
    <Select
      data-testid="lab-orders-sort"
      className={className}
      aria-label={t("labs.orders.sortBy")}
      value={sortValue(list.sort)}
      onChange={(event) => {
        const chosen = options.find((option) => sortValue(option) === event.target.value);

        list.write((next) => {
          if (!chosen || chosen === options[0]) {
            next.delete("sort");
            next.delete("dir");
          } else {
            next.set("sort", chosen.sort);
            next.set("dir", chosen.dir);
          }
        });
      }}
      options={options.map((option) => ({ value: sortValue(option), label: t(option.label) }))}
    />
  );
}

function StageBadge({ order }: { readonly order: LabOrderRow }): JSX.Element | null {
  const { t } = useTranslation();
  const stage = labOrderStage(order.status);

  if (stage === null) {
    return null;
  }

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Badge tone={LAB_ORDER_STAGE_TONES[stage]} data-testid="lab-order-stage">
        {t(`labs.orders.stages.${stage}`)}
      </Badge>
      {order.status === LAB_ORDER_STATUS.RETURNED && (
        <Badge tone="danger" data-testid="lab-order-returned">
          {t("labs.status.returned")}
        </Badge>
      )}
    </span>
  );
}

// On a phone the card has no stage or step column: both sit on their own line under the title.
function Work({
  order,
  asCard = false,
}: {
  readonly order: LabOrderRow;
  readonly asCard?: boolean;
}): JSX.Element {
  const { t } = useTranslation();

  return (
    <span className="flex min-w-0 flex-col gap-1">
      <bdi className="whitespace-nowrap font-medium text-ink">
        {order.workTypeName ?? t("labs.orders.custom")}
      </bdi>
      {order.teeth.length > 0 && (
        <span className="flex items-baseline gap-1.5 text-label font-normal text-ink-muted">
          <span>{t("labs.orders.teeth", { count: order.teeth.length })}</span>
          <Ltr className="tabular-nums text-ink">{order.teeth.join(" · ")}</Ltr>
        </span>
      )}
      {asCard && (
        // Above the card's own open button, so the step is pressed rather than the card.
        <span className="relative z-10 mt-2 flex flex-wrap items-center gap-2">
          <StageBadge order={order} />
          {/* A narrow card wraps the step under the badges rather than squeezing it. */}
          <span className="ms-auto shrink-0">
            <NextStep order={order} />
          </span>
        </span>
      )}
    </span>
  );
}

function Patient({ order }: { readonly order: LabOrderRow }): JSX.Element {
  return (
    <span className="flex min-w-0 flex-col">
      <span>
        <bdi>{order.patientName}</bdi>
      </span>
      <Ltr className="text-label text-ink-muted">{order.patientFileNumber}</Ltr>
    </span>
  );
}

// Late is measured in calendar days, and only counts as late the way the API says: work already in
// the clinic is waiting on a chair, not on a lab.
function When({ order }: { readonly order: LabOrderRow }): JSX.Element | null {
  const { t } = useTranslation();

  if (order.status === LAB_ORDER_STATUS.RECEIVED && order.receivedAt) {
    return (
      <span className="flex flex-col whitespace-nowrap text-label">
        <span className="text-ink-muted">{t("labs.orders.when.received")}</span>
        <Ltr className="text-ink">{formatDate(order.receivedAt)}</Ltr>
      </span>
    );
  }

  if (!order.expectedAt) {
    return null;
  }

  const days = differenceInCalendarDays(new Date(order.expectedAt), new Date());
  const text =
    days < 0
      ? t("labs.orders.when.late", { count: -days })
      : days === 0
        ? t("labs.orders.when.today")
        : t("labs.orders.when.in", { count: days });

  return (
    <span data-testid="lab-order-when" className="flex flex-col whitespace-nowrap text-label">
      <span
        className={cn(
          "font-medium",
          order.isOverdue ? "text-danger-600" : days <= 0 ? "text-warning-700" : "text-ink",
        )}
      >
        {text}
      </span>
      <Ltr className="text-ink-muted">{formatDate(order.expectedAt)}</Ltr>
    </span>
  );
}

const hasWhen = (order: LabOrderRow): boolean =>
  (order.status === LAB_ORDER_STATUS.RECEIVED && order.receivedAt !== null) ||
  order.expectedAt !== null;

function NextStep({ order }: { readonly order: LabOrderRow }): JSX.Element | null {
  const { t } = useTranslation();
  const { can } = useSession();
  const toast = useToast();
  const step = useLabOrderStep();
  const [moving, setMoving] = useState(false);

  const next = availableSteps(order.status, can).find((candidate) => candidate.step !== "cancel");

  if (!next) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      data-testid={`lab-order-step-${next.step}`}
      isLoading={moving}
      onClick={async () => {
        setMoving(true);
        try {
          await step.mutateAsync({ id: order.id, step: next.step });
          toast.success("labs.order.moved");
        } catch (error) {
          toast.error(errorMessageKey(error));
        } finally {
          setMoving(false);
        }
      }}
    >
      {t(next.label)}
    </Button>
  );
}

export function useOrderColumns(view: LabOrderView): readonly Column<LabOrderRow>[] {
  const { t } = useTranslation();
  const clinic = useClinic();
  const isMobile = useIsMobile();

  const work: Column<LabOrderRow> = {
    key: "work",
    header: LAB_ORDER_FIELDS.work.label,
    primary: true,
    render: (row) => <Work order={row} asCard={view === "open" && isMobile} />,
  };
  const patient: Column<LabOrderRow> = {
    key: "patient",
    header: LAB_ORDER_FIELDS.patient.label,
    hideOnMobile: true,
    render: (row) => <Patient order={row} />,
  };
  const lab: Column<LabOrderRow> = {
    key: "lab",
    header: LAB_ORDER_FIELDS.lab.label,
    hideOnMobile: true,
    render: (row) => <span className="whitespace-nowrap">{row.labName}</span>,
  };
  // A phone reads the patient and the lab as one line rather than two labelled rows.
  const who: Column<LabOrderRow> = {
    key: "who",
    header: LAB_ORDER_FIELDS.patient.label,
    hideOnDesktop: true,
    render: (row) => (
      <span className="flex min-w-0 flex-col">
        <span>
          <bdi>{row.patientName}</bdi>
        </span>
        <span className="truncate text-label text-ink-muted">{row.labName}</span>
      </span>
    ),
  };

  if (view === "open") {
    return [
      work,
      patient,
      lab,
      who,
      {
        key: "stage",
        header: "labs.orders.stages.label",
        hideOnMobile: true,
        render: (row) => <StageBadge order={row} />,
      },
      {
        key: "when",
        header: "labs.orders.columns.when",
        render: (row) => (hasWhen(row) ? <When order={row} /> : null),
      },
      {
        key: "step",
        header: "labs.orders.columns.next",
        actions: true,
        hideOnMobile: true,
        render: (row) => <NextStep order={row} />,
      },
    ];
  }

  return [
    work,
    patient,
    lab,
    who,
    {
      key: "status",
      header: LAB_ORDER_FIELDS.status.label,
      render: (row) => (
        <Badge tone={LAB_ORDER_STATUS_STYLES[row.status].tone} data-testid="lab-order-status">
          {t(LAB_ORDER_STATUS_STYLES[row.status].label)}
        </Badge>
      ),
    },
    {
      key: "finished",
      header: "labs.orders.columns.finished",
      render: (row) => <Ltr>{formatDate(row.fittedAt ?? row.updatedAt)}</Ltr>,
    },
    {
      key: "price",
      header: LAB_ORDER_FIELDS.price.label,
      align: "numeric",
      render: (row) => <Money amount={row.price} currency={clinic.data?.currency} />,
    },
  ];
}

/** Opens an order's drawer by putting it in the address, so an open order can be linked. */
export function useOpenOrder(): (id: string) => void {
  const [, setParams] = useSearchParams();

  return (id) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.set("order", id);

        return next;
      },
      { replace: true },
    );
}

// Fetched by id rather than found in the list: a step can move the order out of the filtered page,
// and the drawer stays on it. The list's row shows at once while the fetch is in flight.
export function OrderDetails({ rows }: { readonly rows: readonly LabOrderRow[] }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<LabOrderRow | undefined>();
  const id = params.get("order") ?? "";
  const fetched = useLabOrder(id);
  const order = id === "" ? undefined : (fetched.data ?? rows.find((row) => row.id === id));

  const close = (): void =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.delete("order");

        return next;
      },
      { replace: true },
    );

  return (
    <>
      <OrderDrawer
        data-testid="lab-order-drawer"
        order={order}
        onClose={close}
        onEdit={(row) => {
          close();
          setEditing(row);
        }}
      />
      <OrderFormModal
        data-testid="lab-order-edit-modal"
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        order={editing}
      />
    </>
  );
}
