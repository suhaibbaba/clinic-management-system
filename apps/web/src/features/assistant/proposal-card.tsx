import {
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_STATUS,
  type AiProposal,
  type AiProposalStatus,
} from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Icon, type BadgeTone } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { cn } from "@clinic/ui/lib/cn";
import { useSession } from "@web/features/auth/session";
import { outboundErrorKey } from "@web/features/assistant/messages";
import { useProposal, useProposalAction } from "@web/features/assistant/queries";
import { formatClinicTime } from "@web/lib/format";

export const SEND_CAPABILITY = "ai-outbound.send";

const STATUS_TONES: Record<AiProposalStatus, BadgeTone> = {
  [AI_PROPOSAL_STATUS.DRAFT]: "info",
  [AI_PROPOSAL_STATUS.SENDING]: "info",
  [AI_PROPOSAL_STATUS.SENT]: "success",
  [AI_PROPOSAL_STATUS.CANCELLED]: "neutral",
  [AI_PROPOSAL_STATUS.EXPIRED]: "warning",
  [AI_PROPOSAL_STATUS.DONE]: "success",
  [AI_PROPOSAL_STATUS.FAILED]: "danger",
};

export interface ProposalCardProps {
  readonly id: string;
  /** The frame's copy, so a card the turn just drafted draws without a request. */
  readonly initial?: AiProposal | undefined;
}

// The second phase of the two: the model drafted this, and nothing leaves until a person reads it
// here and presses send. The server checks author, expiry and permission again on the click.
export function ProposalCard({ id, initial }: ProposalCardProps): JSX.Element {
  const { t } = useTranslation();
  const { can } = useSession();
  const proposal = useProposal(id, initial);
  const action = useProposalAction();
  const [expanded, setExpanded] = useState(false);

  if (!proposal.data) {
    return (
      <Skeleton
        data-testid={`proposal-card-${id}`}
        aria-hidden="true"
        className="h-40 w-full rounded-card"
      />
    );
  }

  const { data } = proposal;
  const pending = data.status === AI_PROPOSAL_STATUS.DRAFT;
  const [first] = data.recipients;
  const panelId = `proposal-recipients-${id}`;

  return (
    <section
      data-testid={`proposal-card-${id}`}
      data-part="proposal-card"
      aria-label={t("assistant.proposal.title")}
      className="rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <header data-part="proposal-header" className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-field bg-primary-100 text-primary-600">
          <Icon name="message" />
        </span>
        <h3 className="text-label font-semibold text-ink">{t("assistant.proposal.title")}</h3>
        <Badge tone="neutral" data-part="proposal-count">
          {t("assistant.proposal.recipients", { count: data.recipients.length })}
        </Badge>
        <Badge tone={STATUS_TONES[data.status]} data-part="proposal-status" className="ms-auto">
          {t(`assistant.proposal.status.${data.status}`)}
        </Badge>
      </header>

      {data.trigger === AI_OUTBOUND_TRIGGER.CRON && (
        <p className="mt-2 text-label text-ink-muted">
          {t(`assistant.proposal.rules.${data.target}`)}
        </p>
      )}

      {first && (
        <blockquote
          data-part="proposal-preview"
          className="mt-3 whitespace-pre-wrap rounded-field border-s-2 border-primary-600 bg-inset px-3 py-2 text-value text-ink [unicode-bidi:plaintext]"
        >
          {first.text}
        </blockquote>
      )}

      <Button
        variant="quiet"
        size="sm"
        className="mt-2"
        data-part="proposal-toggle"
        icon={<Icon name={expanded ? "chevron-up" : "chevron-down"} />}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        {t(expanded ? "assistant.proposal.hideRecipients" : "assistant.proposal.showRecipients")}
      </Button>

      {expanded && (
        <ul
          id={panelId}
          data-part="proposal-recipients"
          className="mt-2 flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-field border border-line"
        >
          {data.recipients.map((recipient) => (
            <li
              key={recipient.patientId}
              data-testid={`proposal-recipient-${recipient.patientId}`}
              className="px-3 py-2"
            >
              <p className="text-label font-medium text-ink">{recipient.name}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-label text-ink-muted [unicode-bidi:plaintext]">
                {recipient.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      <footer
        data-part="proposal-footer"
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3"
      >
        {pending ? (
          <>
            <Button
              data-part="proposal-send"
              size="sm"
              icon={<Icon name="send" />}
              disabled={!can(SEND_CAPABILITY) || action.isPending}
              onClick={() => action.mutate({ id, action: "send" })}
            >
              {t("assistant.proposal.send")}
            </Button>
            <Button
              data-part="proposal-cancel"
              variant="secondary"
              size="sm"
              disabled={action.isPending}
              onClick={() => action.mutate({ id, action: "cancel" })}
            >
              {t("assistant.proposal.cancel")}
            </Button>
            <span className="ms-auto text-label text-ink-subtle">
              {t("assistant.proposal.expiresAt", { time: formatClinicTime(data.expiresAt) })}
            </span>
          </>
        ) : (
          <span
            data-part="proposal-outcome"
            className={cn(
              "text-label",
              data.failedCount > 0 ? "text-warning-700" : "text-ink-muted",
            )}
          >
            {data.status === AI_PROPOSAL_STATUS.SENT
              ? t("assistant.proposal.sentSummary", {
                  sent: data.sentCount,
                  failed: data.failedCount,
                })
              : t(`assistant.proposal.status.${data.status}`)}
          </span>
        )}
      </footer>

      {action.error && (
        <p role="alert" data-part="proposal-error" className="mt-2 text-label text-danger-600">
          {t(outboundErrorKey(action.error))}
        </p>
      )}
    </section>
  );
}
