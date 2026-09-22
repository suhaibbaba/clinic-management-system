import {
  APPOINTMENT_STATUSES,
  personNameSchema,
  type AiTableView,
  type AiView,
  type AiViewColumn,
  type AppointmentStatus,
} from "@clinic/shared";
import type { JSX, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Badge,
  Card,
  Ltr,
  Money,
  PersonName,
  PhoneLink,
  StatCard,
  StatRow,
  Table,
  type Column,
} from "@clinic/ui";
import { activeNavItem, canReachNavItem } from "@web/app/navigation";
import { APPOINTMENT_STATUS_STYLES, statusLabelKey } from "@web/features/appointments/status";
import { useSession } from "@web/features/auth/session";
import { useCurrency } from "@web/features/clinic/queries";
import { formatClinicDate, formatClinicTime } from "@web/lib/format";

type Row = Record<string, unknown>;

// A tool's result drawn as data: the server named the columns and sent raw values; the words, the
// money, the dates and the names are this side's. The model is told the user already sees it.
export function AssistantView({
  view,
  "data-testid": testId,
}: {
  readonly view: AiView;
  readonly "data-testid"?: string;
}): JSX.Element {
  switch (view.type) {
    case "table":
      return <ViewTable view={view} data-testid={testId} />;
    case "stats":
      return <ViewStats view={view} data-testid={testId} />;
    case "patient":
      return <ViewPatient view={view} data-testid={testId} />;
    case "list":
      return <ViewList view={view} data-testid={testId} />;
  }
}

/** Whether the reader may open an address — a link somebody would be bounced off is text. */
function useReachable(): (href: string) => boolean {
  const { user } = useSession();

  return (href) => {
    const item = activeNavItem(href.split("?")[0] ?? href);

    return item !== undefined && canReachNavItem(item.to, user?.role);
  };
}

function Block({
  children,
  testId,
  kind,
}: {
  readonly children: ReactNode;
  readonly testId: string | undefined;
  readonly kind: AiView["type"];
}): JSX.Element {
  return (
    <section
      data-testid={testId}
      data-part="assistant-view"
      data-view={kind}
      className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
    >
      {children}
    </section>
  );
}

function ViewTable({
  view,
  "data-testid": testId,
}: {
  readonly view: AiTableView;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  return (
    <Block testId={testId} kind="table">
      <TableBody view={view} testId={testId} />
    </Block>
  );
}

function TableBody({
  view,
  testId,
}: {
  readonly view: AiTableView;
  readonly testId: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const cell = useCell();

  if (view.rows.length === 0) {
    return (
      <p data-part="assistant-view-empty" className="px-4 py-3 text-label text-ink-muted">
        {t("assistant.view.empty")}
      </p>
    );
  }

  const columns: Column<Row>[] = view.columns.map((column) => ({
    key: column.key,
    header: column.label,
    render: (row) => cell(column, row[column.key]),
    ...(column.kind === "money" || column.kind === "number" ? { align: "numeric" } : {}),
  }));

  return (
    <>
      <div className="max-h-96 overflow-y-auto">
        <Table
          density="compact"
          columns={columns}
          rows={view.rows}
          rowKey={(row) => String(row["id"] ?? JSON.stringify(row))}
          {...(testId && { "data-testid": `${testId}-table` })}
        />
      </div>
      <Footer shown={view.rows.length} view={view} />
    </>
  );
}

function Footer({
  shown,
  view,
}: {
  readonly shown: number;
  readonly view: { truncated: boolean; total?: number | undefined; href?: string | undefined };
}): JSX.Element | null {
  const { t } = useTranslation();
  const reachable = useReachable();

  if (!view.truncated) {
    return null;
  }

  return (
    <p
      data-part="assistant-view-truncated"
      className="flex flex-wrap items-center gap-x-2 border-t border-line px-4 py-2 text-label text-ink-muted"
    >
      <span>{t("assistant.view.truncated", { shown, total: view.total ?? `${shown}+` })}</span>
      {view.href && reachable(view.href) && (
        <>
          <span aria-hidden="true">·</span>
          <Link to={view.href} className="font-medium text-primary-600 hover:underline">
            {t("assistant.view.openFull")}
          </Link>
        </>
      )}
    </p>
  );
}

function useCell(): (column: AiViewColumn, value: unknown) => ReactNode {
  const { t } = useTranslation();
  const currency = useCurrency();
  const reachable = useReachable();

  return (column, value) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-ink-subtle">—</span>;
    }

    switch (column.kind) {
      case "date":
        return <Ltr>{formatClinicDate(String(value))}</Ltr>;
      case "time":
        return <Ltr>{formatClinicTime(String(value))}</Ltr>;
      case "money":
        return <Money amount={String(value)} currency={currency} />;
      case "number":
        return <Ltr>{String(value)}</Ltr>;
      case "phone":
        return <PhoneLink value={String(value)} />;
      case "status":
        return isAppointmentStatus(value) ? (
          <Badge tone={APPOINTMENT_STATUS_STYLES[value].tone}>{t(statusLabelKey(value))}</Badge>
        ) : (
          String(value)
        );
      case "code":
        return t(`${column.prefix ?? ""}.${String(value)}`);
      case "person": {
        const name = personNameSchema.safeParse(value);

        return name.success ? <PersonName name={name.data} /> : String(value);
      }
      case "link": {
        const target = value as { href?: unknown; label?: unknown };
        const label = String(target.label ?? "");

        return typeof target.href === "string" && reachable(target.href) ? (
          <Link to={target.href} className="text-primary-600 hover:underline">
            {label}
          </Link>
        ) : (
          label
        );
      }
      case "text":
        return <span className="[unicode-bidi:plaintext]">{String(value)}</span>;
    }
  };
}

function ViewStats({
  view,
  "data-testid": testId,
}: {
  readonly view: Extract<AiView, { type: "stats" }>;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();

  return (
    <div data-testid={testId} data-part="assistant-view" data-view="stats">
      <StatRow cards={view.tiles.length}>
        {view.tiles.map((tile, index) => (
          <StatCard
            key={tile.label}
            label={t(tile.label)}
            tone={index === 0 ? "primary" : "neutral"}
            value={
              tile.kind === "money" ? <Money amount={tile.value} currency={currency} /> : tile.value
            }
          />
        ))}
      </StatRow>
      {view.table && (
        <Block testId={testId && `${testId}-detail`} kind="table">
          <TableBody view={view.table} testId={testId && `${testId}-detail`} />
        </Block>
      )}
    </div>
  );
}

function ViewPatient({
  view,
  "data-testid": testId,
}: {
  readonly view: Extract<AiView, { type: "patient" }>;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const reachable = useReachable();
  const href = `/patients/${view.patient.id}`;

  return (
    <Block testId={testId} kind="patient">
      <Card flush className="border-0 shadow-none">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3">
          <h3 className="text-value font-semibold text-ink">
            {reachable(href) ? (
              <Link to={href} className="hover:underline">
                {view.patient.fullName}
              </Link>
            ) : (
              view.patient.fullName
            )}
          </h3>
          <Ltr className="text-label text-ink-subtle">#{view.patient.fileNumber}</Ltr>
          <Ltr className="text-label text-ink-muted">{view.patient.phone}</Ltr>
          {view.balance !== undefined && (
            <span className="ms-auto text-label text-ink-muted">
              {t("assistant.view.balance")}{" "}
              <Money amount={view.balance} currency={currency} signed />
            </span>
          )}
        </div>
      </Card>
      <div className="mt-3 border-t border-line">
        <TableBody view={view.table} testId={testId} />
      </div>
    </Block>
  );
}

function ViewList({
  view,
  "data-testid": testId,
}: {
  readonly view: Extract<AiView, { type: "list" }>;
  readonly "data-testid"?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const reachable = useReachable();

  return (
    <Block testId={testId} kind="list">
      {view.items.length === 0 ? (
        <p data-part="assistant-view-empty" className="px-4 py-3 text-label text-ink-muted">
          {t("assistant.view.empty")}
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col divide-y divide-line overflow-y-auto">
          {view.items.map((item, index) => (
            <li
              key={`${item.title}-${String(index)}`}
              className="flex flex-wrap items-baseline gap-x-3 px-4 py-2 hover:bg-row-hover"
            >
              <span className="text-value font-medium text-ink">
                {item.href && reachable(item.href) ? (
                  <Link to={item.href} className="hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  item.title
                )}
              </span>
              {item.subtitle && (
                <span className="text-label text-ink-muted [unicode-bidi:plaintext]">
                  {item.subtitle}
                </span>
              )}
              {item.date && (
                <Ltr className="ms-auto text-label text-ink-subtle">
                  {formatClinicDate(item.date)}
                </Ltr>
              )}
            </li>
          ))}
        </ul>
      )}
      <Footer shown={view.items.length} view={view} />
    </Block>
  );
}

const isAppointmentStatus = (value: unknown): value is AppointmentStatus =>
  (APPOINTMENT_STATUSES as readonly unknown[]).includes(value);
