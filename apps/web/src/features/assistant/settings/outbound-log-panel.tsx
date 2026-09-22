import {
  AI_OUTBOUND_TRIGGERS,
  type AiOutboundLogEntry,
  type AiOutboundTrigger,
} from "@clinic/shared";
import { useMemo, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  Card,
  EmptyState,
  PhoneLink,
  Select,
  Table,
  usePageParams,
  usePersonName,
  type Column,
} from "@clinic/ui";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { useOutboundLog } from "@web/features/assistant/queries";
import { useUsers } from "@web/features/users/queries";
import { formatDateTime } from "@web/lib/format";

const OUTCOMES = ["sent", "failed"] as const;
type Outcome = (typeof OUTCOMES)[number];

const pick = <T extends string>(options: readonly T[], raw: string | null): T | undefined =>
  options.find((option) => option === raw);

// Filters in the address like every list here: "yesterday's failed sends" is a link somebody
// forwards to whoever looks after the WhatsApp account.
export function OutboundLogPanel(): JSX.Element {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams(20);

  const trigger = pick(AI_OUTBOUND_TRIGGERS, params.get("trigger"));
  const outcome = pick(OUTCOMES, params.get("outcome"));

  const setFilter = (key: "trigger" | "outcome", value: string): void => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }

        next.delete("page");

        return next;
      },
      { replace: true },
    );
    resetPage();
  };

  const query = useOutboundLog({
    page,
    limit: perPage,
    ...(trigger && { trigger }),
    ...(outcome && { outcome }),
  });

  const users = useUsers({ limit: 100 });
  const displayName = usePersonName();
  const userNames = useMemo(
    () => new Map((users.data?.items ?? []).map((user) => [user.id, displayName(user.name)])),
    [users.data, displayName],
  );

  const columns = useMemo<Column<AiOutboundLogEntry>[]>(
    () => [
      {
        key: "when",
        header: "assistantSettings.outbound.when",
        render: (row) => formatDateTime(row.createdAt),
      },
      {
        key: "recipient",
        header: "assistantSettings.outbound.recipient",
        primary: true,
        render: (row) => (
          <span className="flex flex-col">
            <span className="text-ink">{row.patientName ?? "—"}</span>
            <PhoneLink value={row.recipient} className="text-label" />
          </span>
        ),
      },
      {
        key: "text",
        header: "assistantSettings.outbound.text",
        render: (row) => (
          <span className="line-clamp-3 whitespace-pre-wrap [unicode-bidi:plaintext]">
            {row.text}
          </span>
        ),
      },
      {
        key: "trigger",
        header: "assistantSettings.outbound.trigger",
        render: (row) => (
          <Badge tone={row.trigger === "cron" ? "info" : "neutral"}>
            {t(`assistantSettings.triggers.${row.trigger}`)}
          </Badge>
        ),
      },
      {
        key: "user",
        header: "assistantSettings.outbound.user",
        render: (row) =>
          row.userId === null
            ? t("assistantSettings.outbound.system")
            : (userNames.get(row.userId) ?? "—"),
      },
      {
        key: "outcome",
        header: "assistantSettings.outbound.outcome",
        render: (row) => (
          <Badge tone={row.outcome === "sent" ? "success" : "danger"}>
            {t(`assistantSettings.outcomes.${row.outcome === "sent" ? "sent" : "failed"}`)}
          </Badge>
        ),
      },
      {
        key: "proposal",
        header: "assistantSettings.outbound.proposal",
        render: (row) => (
          <span dir="ltr" className="font-mono text-label text-ink-subtle">
            {row.proposalId?.slice(0, 8) ?? "—"}
          </span>
        ),
      },
    ],
    [t, userNames],
  );

  const data = query.data;

  return (
    <div data-testid="assistant-outbound" className="flex flex-col gap-4">
      <Card
        data-testid="assistant-outbound-filters"
        className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end"
      >
        <Select
          data-testid="assistant-outbound-trigger"
          className="w-full sm:w-44"
          aria-label={t("assistantSettings.outbound.trigger")}
          placeholder={t("common.all")}
          options={AI_OUTBOUND_TRIGGERS.map((value: AiOutboundTrigger) => ({
            value,
            label: t(`assistantSettings.triggers.${value}`),
          }))}
          value={trigger ?? ""}
          onChange={(event) => setFilter("trigger", event.target.value)}
        />
        <Select
          data-testid="assistant-outbound-outcome"
          className="w-full sm:w-44"
          aria-label={t("assistantSettings.outbound.outcome")}
          placeholder={t("common.all")}
          options={OUTCOMES.map((value: Outcome) => ({
            value,
            label: t(`assistantSettings.outcomes.${value}`),
          }))}
          value={outcome ?? ""}
          onChange={(event) => setFilter("outcome", event.target.value)}
        />
      </Card>

      <Table
        data-testid="assistant-outbound-table"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
        empty={
          <EmptyState
            icon="message"
            data-testid="assistant-outbound-empty"
            title="assistantSettings.outbound.empty"
            hint="assistantSettings.outbound.emptyHint"
          />
        }
        {...(data && {
          pagination: {
            page: data.page,
            totalPages: data.totalPages,
            total: data.total,
            onPageChange: setPage,
            perPage,
            onPerPageChange: setPerPage,
          },
        })}
      />
    </div>
  );
}
