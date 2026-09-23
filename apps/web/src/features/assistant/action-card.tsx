import {
  AI_PROPOSAL_KIND,
  AI_PROPOSAL_STATUS,
  AI_RISK_TIER,
  LOOKUP_LIST,
  localDate,
  type AiActionResult,
  type AiActionStepSummary,
  type AiActionSummary,
  type AiProposal,
  type AiProposalStatus,
  type TimeRange,
} from "@clinic/shared";
import { useId, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Badge,
  Button,
  Icon,
  Input,
  Money,
  PersonName,
  PhoneLink,
  type BadgeTone,
} from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { statusLabelKey } from "@web/features/appointments/status";
import { movementLabel } from "@web/features/inventory/display";
import { LAB_ORDER_STATUS_STYLES } from "@web/features/labs/status";
import { useCurrency } from "@web/features/clinic/queries";
import { actionErrorKey, actionRefusalKey } from "@web/features/assistant/messages";
import { useAction, useActionDecision } from "@web/features/assistant/queries";
import { useLookupLabels } from "@web/features/lookups/queries";
import { clinicTimeZone } from "@web/lib/clinic-zone";
import {
  formatClinicDate,
  formatClinicPeriod,
  formatClinicTime,
  formatDate,
} from "@web/lib/format";

const STATUS_TONES: Record<AiProposalStatus, BadgeTone> = {
  [AI_PROPOSAL_STATUS.DRAFT]: "info",
  [AI_PROPOSAL_STATUS.SENDING]: "info",
  [AI_PROPOSAL_STATUS.SENT]: "success",
  [AI_PROPOSAL_STATUS.DONE]: "success",
  [AI_PROPOSAL_STATUS.FAILED]: "danger",
  [AI_PROPOSAL_STATUS.CANCELLED]: "neutral",
  [AI_PROPOSAL_STATUS.EXPIRED]: "warning",
};

export interface ActionCardProps {
  readonly id: string;
  /** The frame's copy, so a card the turn just drafted draws without a request. */
  readonly initial?: AiProposal | undefined;
  /** Asks the assistant to draft the action again — a failed card is never confirmed twice. */
  readonly onRedraft?: (() => void) | undefined;
}

// The model proposed this; nothing happens until the person who asked presses confirm here. The
// server checks author, expiry, permission, tier and the typed phrase again on the click.
export function ActionCard({ id, initial, onRedraft }: ActionCardProps): JSX.Element {
  const { t } = useTranslation();
  const action = useAction(id, initial);
  const decide = useActionDecision();
  const [phrase, setPhrase] = useState("");
  const phraseId = useId();

  if (!action.data) {
    return (
      <Skeleton
        data-testid={`action-card-${id}`}
        aria-hidden="true"
        className="h-40 w-full rounded-card"
      />
    );
  }

  const { data } = action;
  const pending = data.status === AI_PROPOSAL_STATUS.DRAFT;
  const typed = data.tier === AI_RISK_TIER.TYPED && data.typedPhrase !== null;
  const phraseMatches = !typed || phrase.trim() === data.typedPhrase;
  const href = data.result ? resultHref(data.result, data.summary) : null;

  return (
    <section
      data-testid={`action-card-${id}`}
      data-part="action-card"
      data-kind={data.kind}
      aria-label={t(`assistant.action.kinds.${data.kind}`)}
      className="rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <header data-part="action-header" className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-field bg-primary-100 text-primary-600">
          <Icon name="sparkles" />
        </span>
        <h3 className="text-label font-semibold text-ink">
          {t(`assistant.action.kinds.${data.kind}`)}
        </h3>
        {data.tier && (
          <span data-part="action-tier" className="text-label text-ink-subtle">
            {t(`assistant.action.tiers.${data.tier}`)}
          </span>
        )}
        <Badge tone={STATUS_TONES[data.status]} data-part="action-status" className="ms-auto">
          {t(`assistant.action.status.${data.status}`)}
        </Badge>
      </header>

      {data.summary && <ActionSummaryList summary={data.summary} />}

      <footer
        data-part="action-footer"
        className="mt-4 flex flex-col gap-3 border-t border-line pt-3"
      >
        {pending && typed && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={phraseId} className="text-label font-medium text-ink">
              {t("assistant.action.typeToConfirm", { phrase: data.typedPhrase })}
            </label>
            <Input
              id={phraseId}
              data-part="action-phrase"
              autoComplete="off"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
            />
          </div>
        )}

        {pending && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-part="action-confirm"
              size="sm"
              icon={<Icon name="check" />}
              disabled={!phraseMatches || decide.isPending}
              onClick={() =>
                decide.mutate({
                  id,
                  decision: "confirm",
                  ...(typed && { typedPhrase: phrase }),
                })
              }
            >
              {t("assistant.action.confirm")}
            </Button>
            <Button
              data-part="action-cancel"
              variant="secondary"
              size="sm"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id, decision: "cancel" })}
            >
              {t("assistant.action.cancel")}
            </Button>
            <span className="ms-auto text-label text-ink-subtle">
              {t("assistant.proposal.expiresAt", { time: formatClinicTime(data.expiresAt) })}
            </span>
          </div>
        )}

        {data.status === AI_PROPOSAL_STATUS.DONE && (
          <p data-part="action-outcome" className="flex flex-wrap items-center gap-2 text-label">
            <span className="text-ink">{t(`assistant.action.done.${data.kind}`)}</span>
            {href && (
              <Link
                to={href}
                data-part="action-link"
                className="font-medium text-primary-600 hover:underline"
              >
                {t("assistant.action.open")}
              </Link>
            )}
          </p>
        )}

        {data.status === AI_PROPOSAL_STATUS.FAILED && (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" data-part="action-failure" className="text-label text-danger-600">
              {t(actionErrorKey(data.error ?? "action_failed"))}
              {data.kind === AI_PROPOSAL_KIND.PLAN && ` ${t("assistant.action.planRolledBack")}`}
            </p>
            {onRedraft && (
              <Button
                data-part="action-redraft"
                variant="secondary"
                size="sm"
                icon={<Icon name="reset" />}
                onClick={onRedraft}
              >
                {t("common.retry")}
              </Button>
            )}
          </div>
        )}

        {!pending &&
          data.status !== AI_PROPOSAL_STATUS.DONE &&
          data.status !== AI_PROPOSAL_STATUS.FAILED && (
            <span data-part="action-outcome" className="text-label text-ink-muted">
              {t(`assistant.action.status.${data.status}`)}
            </span>
          )}
      </footer>

      {decide.error && (
        <p role="alert" data-part="action-error" className="mt-2 text-label text-danger-600">
          {t(actionRefusalKey(decide.error))}
        </p>
      )}
    </section>
  );
}

function ActionSummaryList({ summary }: { summary: AiActionSummary }): JSX.Element {
  return summary.steps ? <PlanSteps steps={summary.steps} /> : <StepSummary summary={summary} />;
}

// Each step drawn the way its own card would draw it, numbered in the order they run.
function PlanSteps({ steps }: { steps: NonNullable<AiActionSummary["steps"]> }): JSX.Element {
  const { t } = useTranslation();

  return (
    <ol data-part="action-steps" className="mt-3 flex flex-col gap-3">
      {steps.map((step, index) => (
        <li
          key={index}
          data-testid={`action-step-${index}`}
          className="rounded-field border border-line p-3"
        >
          <p className="text-label font-semibold text-ink">
            {t("assistant.action.step", { number: index + 1 })}
            <span className="text-ink-muted"> · {t(`assistant.action.kinds.${step.kind}`)}</span>
          </p>
          <StepSummary summary={step.summary} />
        </li>
      ))}
    </ol>
  );
}

function StepSummary({ summary }: { summary: AiActionStepSummary }): JSX.Element {
  const { t } = useTranslation();
  const currency = useCurrency();
  const methodLabel = useLookupLabels(LOOKUP_LIST.PAYMENT_METHOD);
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);
  const when = (iso: string): string => `${formatClinicDate(iso)} ${formatClinicTime(iso)}`;

  return (
    <dl
      data-part="action-summary"
      className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-value"
    >
      {summary.patient && (
        <Row label={t("assistant.action.fields.patient")}>
          {summary.patient.fullName}{" "}
          <span className="text-ink-subtle" dir="ltr">
            #{summary.patient.fileNumber}
          </span>
        </Row>
      )}
      {summary.newPatient && (
        <>
          <Row label={t("assistant.action.fields.patient")}>{summary.newPatient.fullName}</Row>
          <Row label={t("assistant.action.fields.phone")}>
            <PhoneLink value={summary.newPatient.phone} />
          </Row>
        </>
      )}
      {summary.lab && <Row label={t("assistant.action.fields.lab")}>{summary.lab.name}</Row>}
      {summary.doctor && (
        <Row label={t("assistant.action.fields.doctor")}>
          <PersonName name={summary.doctor.name} />
        </Row>
      )}
      {summary.previousStartsAt && summary.previousEndsAt && (
        <Row label={t("assistant.action.fields.previousPeriod")}>
          <span dir="ltr">
            {formatClinicPeriod(summary.previousStartsAt, summary.previousEndsAt)}
          </span>
        </Row>
      )}
      {summary.previousStartsAt && !summary.previousEndsAt && (
        <Row label={t("assistant.action.fields.from")}>
          <span dir="ltr">{when(summary.previousStartsAt)}</span>
        </Row>
      )}
      {summary.startsAt && summary.endsAt && (
        <Row label={t("assistant.action.fields.period")}>
          <span dir="ltr">{formatClinicPeriod(summary.startsAt, summary.endsAt)}</span>
        </Row>
      )}
      {summary.startsOn && summary.endsOn && (
        <Row label={t("assistant.action.fields.period")}>
          <span dir="ltr">
            {summary.startsOn === summary.endsOn
              ? formatDate(summary.startsOn)
              : `${formatDate(summary.startsOn)} — ${formatDate(summary.endsOn)}`}
          </span>
        </Row>
      )}
      {summary.startsAt && !summary.endsAt && (
        <Row
          label={t(
            summary.previousStartsAt
              ? "assistant.action.fields.to"
              : "assistant.action.fields.when",
          )}
        >
          <span dir="ltr">{when(summary.startsAt)}</span>
        </Row>
      )}
      {summary.status && (
        <Row label={t("assistant.action.fields.status")}>{t(statusLabelKey(summary.status))}</Row>
      )}
      {summary.labOrder && (
        <Row label={t("assistant.action.fields.labOrder")}>
          {summary.labOrder.labName}
          {summary.labOrder.workTypeName && (
            <span className="text-ink-muted"> · {summary.labOrder.workTypeName}</span>
          )}
        </Row>
      )}
      {summary.labOrder && summary.labStatus && (
        <Row label={t("assistant.action.fields.status")}>
          <span className="text-ink-muted">
            {t(LAB_ORDER_STATUS_STYLES[summary.labOrder.status].label)}
          </span>
          <Icon name="chevron-end" className="mx-1 inline-block align-middle text-ink-subtle" />
          {t(LAB_ORDER_STATUS_STYLES[summary.labStatus].label)}
        </Row>
      )}
      {summary.stockItem && (
        <Row label={t("assistant.action.fields.item")}>{summary.stockItem.name}</Row>
      )}
      {summary.movementType && (
        <Row label={t("assistant.action.fields.movement")}>
          {t(movementLabel(summary.movementType))}
        </Row>
      )}
      {summary.quantity && summary.stockItem && (
        <Row label={t("assistant.action.fields.quantity")}>
          <span dir="ltr">{summary.quantity}</span> {unitLabel(summary.stockItem.unit)}
        </Row>
      )}
      {summary.amount && (
        <Row
          label={t(
            summary.movementType
              ? "assistant.action.fields.unitPrice"
              : "assistant.action.fields.amount",
          )}
        >
          <Money amount={summary.amount} currency={currency} />
        </Row>
      )}
      {summary.method && (
        <Row label={t("assistant.action.fields.method")}>{methodLabel(summary.method)}</Row>
      )}
      {summary.scheduleChanges?.map((change) => (
        <Row key={change.weekday} label={t(`schedule.weekday.${change.weekday}`)}>
          <span data-testid={`action-schedule-${change.weekday}`}>
            <span className="text-ink-muted">
              <Hours ranges={change.before} />
            </span>
            <Icon name="chevron-end" className="mx-1 inline-block align-middle text-ink-subtle" />
            <Hours ranges={change.after} />
          </span>
        </Row>
      ))}
      {summary.extraHours && (
        <Row label={t("assistant.action.fields.extraHours")}>
          <span data-part="action-extra-hours">
            <span dir="ltr">{formatDate(summary.extraHours.date)}</span>{" "}
            <Hours ranges={summary.extraHours.ranges} />
          </span>
        </Row>
      )}
      {summary.recordedAt && (
        <Row label={t("assistant.action.fields.recordedAt")}>
          <span dir="ltr">{when(summary.recordedAt)}</span>
        </Row>
      )}
      {summary.reason && <Row label={t("assistant.action.fields.reason")}>{summary.reason}</Row>}
      {summary.outsideHours && (
        <p data-part="action-outside-hours" className="col-span-2 text-label text-warning-700">
          {t("assistant.action.fields.outsideHours")}
        </p>
      )}
      {summary.onConflict && (
        <Row label={t("assistant.action.fields.onConflict")}>
          <span data-part="action-on-conflict">
            {t(`assistant.action.onConflict.${summary.onConflict}`)}
          </span>
        </Row>
      )}
      {summary.note && (
        <Row label={t("assistant.action.fields.note")}>
          <span className="whitespace-pre-wrap [unicode-bidi:plaintext]">{summary.note}</span>
        </Row>
      )}
      {summary.appointments && (
        <div className="col-span-2 mt-1">
          <p className="text-label text-ink-muted">
            {t("assistant.action.fields.appointments", { count: summary.appointments.length })}
          </p>
          <ul className="mt-1 flex flex-col divide-y divide-line rounded-field border border-line">
            {summary.appointments.map((appointment) => (
              <li
                key={appointment.id}
                data-testid={`action-appointment-${appointment.id}`}
                className="flex flex-wrap items-center gap-x-3 px-3 py-1.5 text-label"
              >
                <span className="font-medium text-ink">{appointment.patientName}</span>
                <span className="text-ink-subtle" dir="ltr">
                  #{appointment.patientFileNumber}
                </span>
                <PersonName name={appointment.doctorName} className="text-ink-muted" />
                <span className="ms-auto text-ink-muted" dir="ltr">
                  {when(appointment.startsAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </dl>
  );
}

function Hours({ ranges }: { ranges: readonly TimeRange[] }): JSX.Element {
  const { t } = useTranslation();

  return ranges.length === 0 ? (
    <>{t("assistant.action.fields.dayOff")}</>
  ) : (
    <span dir="ltr">{ranges.map((range) => `${range.start}–${range.end}`).join(", ")}</span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <>
      <dt className="text-label text-ink-muted">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </>
  );
}

// Every result is an address, so the card links to exactly the screen that shows the row.
export function resultHref(result: AiActionResult, summary: AiActionSummary | null): string {
  switch (result.entity) {
    case "patient":
      return `/patients/${result.id}`;
    case "payment":
      return `/patients/${result.patientId ?? ""}?tab=billing`;
    case "appointment": {
      const startsAt = summary?.startsAt;

      return startsAt
        ? `/appointments?view=day&date=${localDate(new Date(startsAt), clinicTimeZone())}`
        : "/appointments";
    }
  }
}
