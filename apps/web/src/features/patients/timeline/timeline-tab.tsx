import {
  LOOKUP_LIST,
  TIMELINE_ENTRY_TYPE,
  TIMELINE_ENTRY_TYPES,
  type LabOrderStatus,
  type TimelineEntry,
  type TimelineEntryType,
} from "@clinic/shared";
import { useMemo, type JSX } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Badge,
  EmptyState,
  Icon,
  Ltr,
  Select,
  Table,
  TotalBadge,
  usePageParams,
  useTabParam,
  type Column,
  type IconName,
} from "@clinic/ui";
import { useLookupLabels } from "@web/features/lookups/queries";
import { LAB_ORDER_STATUS_STYLES } from "@web/features/labs/status";
import { usePatientTimeline } from "@web/features/patients/queries";
import { shortDate } from "@web/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

const ICONS: Record<TimelineEntryType, IconName> = {
  [TIMELINE_ENTRY_TYPE.VISIT]: "stethoscope",
  [TIMELINE_ENTRY_TYPE.PROCEDURE]: "tooth",
  [TIMELINE_ENTRY_TYPE.ATTACHMENT]: "image",
  [TIMELINE_ENTRY_TYPE.PRESCRIPTION]: "file",
  [TIMELINE_ENTRY_TYPE.TREATMENT_PLAN]: "clipboard",
  [TIMELINE_ENTRY_TYPE.LAB_ORDER]: "coins",
  [TIMELINE_ENTRY_TYPE.SUPPLY]: "clipboard",
  [TIMELINE_ENTRY_TYPE.APPOINTMENT]: "calendar",
  [TIMELINE_ENTRY_TYPE.PAYMENT]: "money",
  [TIMELINE_ENTRY_TYPE.CHARGE]: "money",
};

const TYPE_FILTERS = ["all", ...TIMELINE_ENTRY_TYPES] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const DEFAULT_PER_PAGE = 10;

export function TimelineTab({ patientId }: { readonly patientId: string }): JSX.Element {
  const { t } = useTranslation();
  const { page, perPage, setPage, setPerPage } = usePageParams(DEFAULT_PER_PAGE);
  const [kind] = useTabParam<TypeFilter>("type", TYPE_FILTERS, "all");
  const [, setParams] = useSearchParams();

  // One write for the type and the page: two would each start from the same old address, and the
  // second would put the first back.
  const chooseKind = (next: TypeFilter): void =>
    setParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (next === "all") {
          params.delete("type");
        } else {
          params.set("type", next);
        }
        params.delete("page");
        return params;
      },
      { replace: true },
    );

  const timeline = usePatientTimeline(patientId, {
    page,
    limit: perPage,
    ...(kind !== "all" && { type: kind }),
  });

  const columns = useMemo<Column<TimelineEntry>[]>(
    () => [
      {
        key: "date",
        header: "patients.timeline.columns.date",
        icon: "calendar",
        render: (entry) => (
          <Ltr data-testid="timeline-row-date" className="tabular-nums text-ink-muted">
            {shortDate(entry.occurredAt)}
          </Ltr>
        ),
      },
      {
        key: "title",
        header: "patients.timeline.columns.title",
        primary: true,
        render: (entry) => (
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-field bg-primary-100 text-primary-700">
              <Icon name={ICONS[entry.type]} className="size-4" />
            </span>
            <span data-testid="timeline-row-title" className="truncate font-medium text-ink">
              {entry.title}
            </span>
          </span>
        ),
      },
      {
        key: "type",
        header: "patients.timeline.columns.type",
        icon: "list",
        render: (entry) => (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral" data-testid="timeline-row-type">
              {t(`patients.timeline.types.${entry.type}`)}
            </Badge>
            <LabOrderChips entry={entry} />
          </span>
        ),
      },
      {
        key: "detail",
        header: "patients.timeline.columns.detail",
        icon: "info",
        render: (entry) => <Detail entry={entry} />,
      },
    ],
    [t],
  );

  if (timeline.isError) {
    return (
      <EmptyState
        icon="alert"
        data-testid="timeline-error"
        title="errors.generic"
        hint="patients.timeline.loadFailed"
      />
    );
  }

  return (
    <div data-testid="timeline-tab" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-56">
          <Select
            id="timeline-kind"
            data-testid="timeline-filter-kind"
            aria-label={t("patients.timeline.filterByType")}
            value={kind === "all" ? "" : kind}
            placeholder={t("patients.timeline.allTypes")}
            onChange={(event) => chooseKind((event.target.value || "all") as TypeFilter)}
            options={TIMELINE_ENTRY_TYPES.map((type) => ({
              value: type,
              label: t(`patients.timeline.types.${type}`),
            }))}
          />
        </div>
        <TotalBadge
          data-testid="timeline-count"
          total={timeline.data?.total ?? 0}
          label="patients.timeline.count"
        />
      </div>

      <Table
        data-testid="timeline-table"
        columns={columns}
        rows={timeline.data?.items ?? []}
        rowKey={(entry) => `${entry.type}-${entry.id}`}
        isLoading={timeline.isPending}
        isRefreshing={isRefetching(timeline)}
        empty={
          <EmptyState
            icon="clipboard"
            data-testid="timeline-empty"
            title={kind === "all" ? "patients.timeline.empty" : "patients.timeline.noneOfType"}
            hint={
              kind === "all" ? "patients.timeline.emptyHint" : "patients.timeline.noneOfTypeHint"
            }
          />
        }
        pagination={{
          page,
          totalPages: timeline.data?.totalPages ?? 0,
          onPageChange: setPage,
          perPage,
          onPerPageChange: setPerPage,
        }}
      />
    </div>
  );
}

function LabOrderChips({ entry }: { readonly entry: TimelineEntry }): JSX.Element | null {
  const { t } = useTranslation();

  if (entry.type !== TIMELINE_ENTRY_TYPE.LAB_ORDER) {
    return null;
  }

  const status = entry.detail["status"] as LabOrderStatus | undefined;
  const style = status ? LAB_ORDER_STATUS_STYLES[status] : undefined;

  return style ? (
    <Badge tone={style.tone} data-testid="timeline-row-lab-status">
      {t(style.label)}
    </Badge>
  ) : null;
}

function Detail({ entry }: { readonly entry: TimelineEntry }): JSX.Element | null {
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);

  if (entry.type === TIMELINE_ENTRY_TYPE.LAB_ORDER) {
    const teeth = (entry.detail["teeth"] as number[] | undefined) ?? [];
    const labName = entry.detail["labName"] as string | undefined;

    return (
      <p
        data-testid="timeline-row-detail"
        className="flex flex-wrap items-center gap-x-2 text-label text-ink-muted"
      >
        {labName}
        {teeth.length > 0 && <Ltr className="tabular-nums">{teeth.join(" · ")}</Ltr>}
      </p>
    );
  }

  if (entry.type === TIMELINE_ENTRY_TYPE.SUPPLY) {
    // What was used, in its own unit — the ledger's minus sign is an
    // accounting detail, not part of the story.
    const quantity = entry.detail["quantity"] as string | undefined;
    const unit = entry.detail["unit"] as string | undefined;

    return (
      <p data-testid="timeline-row-detail" className="text-label text-ink-muted">
        <Ltr className="tabular-nums">{quantity}</Ltr> {unitLabel(unit ?? null)}
      </p>
    );
  }

  const complaint = entry.detail["complaint"] as string | undefined;

  return complaint ? (
    <p data-testid="timeline-row-detail" className="truncate text-label text-ink-muted">
      {complaint}
    </p>
  ) : (
    <span className="text-ink-subtle">—</span>
  );
}
