import {
  AI_MESSAGE_ROLE,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_TOOL,
  type AiMessage,
  type AiProposal,
  type AiErrorCode,
  type AiProposalStatusEvent,
} from "@clinic/shared";
import { useCallback, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  ChatBubble,
  ChatComposer,
  ChatThread,
  Icon,
  SuggestionChips,
  type Suggestion,
} from "@clinic/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ActionCard } from "@web/features/assistant/action-card";
import { AssistantView } from "@web/features/assistant/assistant-view";
import { assistantApi } from "@web/features/assistant/api";
import { MarkdownMessage } from "@web/features/assistant/markdown-message";
import { ProposalCard, SEND_CAPABILITY } from "@web/features/assistant/proposal-card";
import { ConversationRail } from "@web/features/assistant/conversation-rail";
import { errorMessageKey, isKeyFailure, toolStatusKey } from "@web/features/assistant/messages";
import {
  ACTION_KEY,
  applyProposalStatus,
  CONVERSATIONS_KEY,
  MESSAGES_KEY,
  PROPOSAL_KEY,
  useConversationMessages,
  useConversations,
  usePendingProposals,
} from "@web/features/assistant/queries";
import { canReachNavItem } from "@web/app/navigation";
import { useClinic } from "@web/features/clinic/queries";
import { setClinicTimeZone } from "@web/lib/clinic-zone";
import { useSession } from "@web/features/auth/session";
import { SUGGESTIONS } from "@web/features/assistant/suggestions";
import { useAssistantStream } from "@web/features/assistant/use-assistant-stream";
import { ellipsis } from "@web/i18n/ellipsis";
import { cn } from "@clinic/ui/lib/cn";
import { useDocumentTitle } from "@clinic/ui/lib/page-title";

const KEYS_SETTINGS = "/assistant/settings";

export function AssistantPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useQueryClient();
  // The open conversation is an address, not a piece of state: it is linkable, and the back button
  // walks the thread somebody was reading (CLAUDE.md).
  const { conversationId } = useParams<{ conversationId: string }>();

  const [draft, setDraft] = useState("");
  const [railOpen, setRailOpen] = useState(false);

  useDocumentTitle(t("nav.assistant"));

  // Times on cards and tables are the clinic's, not the browser's.
  const clinic = useClinic();
  setClinicTimeZone(clinic.data);

  const conversations = useConversations();
  const messages = useConversationMessages(conversationId);

  const onConversationStarted = useCallback(
    (id: string) => {
      // `replace`: the empty conversation this turn began in is not a place to go back to.
      void navigate(`/assistant/${id}`, { replace: true });
    },
    [navigate],
  );

  // Written into the cache rather than invalidated, so the stored thread and the end of the live
  // turn land in one render: an invalidation repaints on its own clock, and for a frame the
  // question was on screen twice.
  const onFinished = useCallback(
    async (id: string) => {
      client.setQueryData([MESSAGES_KEY, id], await assistantApi.messages(id));
      void client.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
    },
    [client],
  );

  const onProposal = useCallback(
    (proposal: AiProposal) =>
      client.setQueryData(
        [proposal.kind === AI_PROPOSAL_KIND.MESSAGE ? PROPOSAL_KEY : ACTION_KEY, proposal.id],
        proposal,
      ),
    [client],
  );

  const onProposalStatus = useCallback(
    (event: AiProposalStatusEvent) => applyProposalStatus(client, event),
    [client],
  );

  const stream = useAssistantStream({
    conversationId,
    onConversationStarted,
    onFinished,
    onProposal,
    onProposalStatus,
  });

  const { can } = useSession();

  const ask = (text: string): void => {
    const question = text.trim();

    if (question.length === 0 || stream.streaming) {
      return;
    }

    setDraft("");
    stream.send(question);
  };

  // A failed action is drafted again, never confirmed again: the model re-reads the record first.
  const redraft = (): void => ask(t("assistant.action.redraft"));

  const stored = messages.data ?? [];
  const empty = stored.length === 0 && stream.turn === null;

  // The automation's drafts belong to nobody's conversation, so a fresh one is where they wait.
  const pending = usePendingProposals(conversationId === undefined && can(SEND_CAPABILITY));
  const automated = (pending.data?.items ?? []).filter(
    (proposal) => proposal.trigger === AI_OUTBOUND_TRIGGER.CRON,
  );

  const suggestions: Suggestion[] = SUGGESTIONS.map((suggestion) => ({
    key: suggestion.key,
    label: t(suggestion.labelKey),
  }));

  return (
    // The shell scrolls the document, so a pane that scrolls its own thread has to be told how
    // tall it is: the viewport less the top bar and the main region's bottom padding.
    <div data-testid="assistant-page" className="flex h-[calc(100dvh-8rem)] gap-4">
      <ConversationRail
        conversations={conversations.data?.items ?? []}
        loading={conversations.isPending}
        selectedId={conversationId}
        onSelect={(id) => {
          setRailOpen(false);
          void navigate(id === undefined ? "/assistant" : `/assistant/${id}`);
        }}
        onDeleted={(id) => {
          if (id === conversationId) {
            void navigate("/assistant", { replace: true });
          }
        }}
        className={cn(
          "w-72 shrink-0 rounded-card border border-line bg-surface p-3 shadow-card",
          // Off-canvas below `md`, where the thread needs the whole width. It leaves by the edge
          // it sits against, which is the other one in Arabic — `page-rtl` rather than a bare
          // `rtl:`, which this theme does not define.
          "max-md:fixed max-md:inset-y-16 max-md:start-3 max-md:z-30 max-md:w-[17rem]",
          "max-md:transition-transform max-md:duration-200",
          !railOpen && "max-md:page-ltr:-translate-x-[120%] max-md:page-rtl:translate-x-[120%]",
        )}
      />

      <section
        aria-label={t("nav.assistant")}
        className="flex min-w-0 flex-1 flex-col rounded-card border border-line bg-canvas"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-2.5 md:hidden">
          <Button
            variant="quiet"
            size="sm"
            icon={<Icon name="menu" />}
            aria-label={t("assistant.conversations")}
            onClick={() => setRailOpen((open) => !open)}
          />
          <span className="truncate text-label text-ink-muted">{t("nav.assistant")}</span>
        </header>

        <ChatThread data-testid="assistant-thread" jumpLabel={t("assistant.jumpToLatest")}>
          {empty && <EmptyIntro />}

          {empty &&
            automated.map((proposal) => (
              <ProposalCard key={proposal.id} id={proposal.id} initial={proposal} />
            ))}

          {stored.map((message: AiMessage) =>
            message.view && !message.proposalId ? (
              <AssistantView
                key={message.id}
                view={message.view}
                data-testid={`assistant-view-${message.id}`}
              />
            ) : message.proposalId ? (
              message.toolName === AI_TOOL.DRAFT_BULK_MESSAGE ? (
                <ProposalCard key={message.id} id={message.proposalId} />
              ) : (
                <ActionCard key={message.id} id={message.proposalId} onRedraft={redraft} />
              )
            ) : (
              <ChatBubble
                key={message.id}
                data-testid={`assistant-message-${message.id}`}
                author={message.role === AI_MESSAGE_ROLE.USER ? "user" : "assistant"}
              >
                {message.role === AI_MESSAGE_ROLE.USER ? (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                ) : (
                  <MarkdownMessage content={message.content} />
                )}
              </ChatBubble>
            ),
          )}

          {stream.turn && (
            <>
              <ChatBubble author="user" data-testid="assistant-live-question">
                <span className="whitespace-pre-wrap">{stream.turn.question}</span>
              </ChatBubble>

              {stream.turn.proposals.map((proposal) =>
                proposal.kind === AI_PROPOSAL_KIND.MESSAGE ? (
                  <ProposalCard key={proposal.id} id={proposal.id} initial={proposal} />
                ) : (
                  <ActionCard
                    key={proposal.id}
                    id={proposal.id}
                    initial={proposal}
                    onRedraft={redraft}
                  />
                ),
              )}

              {stream.turn.views.map(({ toolCallId, view }) => (
                <AssistantView
                  key={toolCallId}
                  view={view}
                  data-testid={`assistant-live-view-${toolCallId}`}
                />
              ))}

              {(stream.turn.error === null || stream.turn.answer.length > 0) && (
                <ChatBubble
                  author="assistant"
                  data-testid="assistant-live-answer"
                  streaming={stream.turn.streaming && stream.turn.answer.length > 0}
                  status={
                    stream.turn.answer.length === 0
                      ? ellipsis(
                          stream.turn.tool
                            ? t(toolStatusKey(stream.turn.tool))
                            : t("assistant.thinking"),
                        )
                      : undefined
                  }
                >
                  {stream.turn.answer.length > 0 ? (
                    <MarkdownMessage content={stream.turn.answer} />
                  ) : undefined}
                </ChatBubble>
              )}

              {stream.turn.error && <TurnError code={stream.turn.error} onRetry={stream.retry} />}
            </>
          )}
        </ChatThread>

        <div className="border-t border-line bg-surface p-3 sm:px-6 sm:py-4">
          <div className="mx-auto max-w-3xl">
            <ChatComposer
              data-testid="assistant-composer"
              value={draft}
              onValueChange={setDraft}
              onSend={() => ask(draft)}
              onStop={stream.stop}
              streaming={stream.streaming}
              placeholder={t("assistant.placeholder")}
              sendLabel={t("assistant.send")}
              stopLabel={t("assistant.stop")}
            >
              {empty && (
                <SuggestionChips
                  data-testid="assistant-suggestions"
                  suggestions={suggestions}
                  disabled={stream.streaming}
                  onPick={(suggestion) => ask(suggestion.label)}
                />
              )}
            </ChatComposer>
          </div>
        </div>
      </section>
    </div>
  );
}

// Never silent: the code's own words, a retry, and for a key the clinic has to fix, the way there
// for whoever may follow it.
function TurnError({ code, onRetry }: { code: AiErrorCode; onRetry: () => void }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const toKeys = isKeyFailure(code) && canReachNavItem(KEYS_SETTINGS, user?.role);

  return (
    <ChatBubble
      author="assistant"
      tone="danger"
      data-testid="assistant-turn-error"
      data-code={code}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon name="reset" />}
            data-testid="assistant-retry"
            onClick={onRetry}
          >
            {t("common.retry")}
          </Button>
          {toKeys && (
            <Link
              to={`${KEYS_SETTINGS}?tab=keys`}
              data-testid="assistant-check-keys"
              className="text-label font-medium text-primary-600 hover:underline"
            >
              {t("assistant.checkKeys")}
            </Link>
          )}
        </div>
      }
    >
      <span role="alert">{t(errorMessageKey(code))}</span>
    </ChatBubble>
  );
}

function EmptyIntro(): JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      data-testid="assistant-empty"
      className="rounded-card border border-line bg-surface p-5 text-center shadow-card"
    >
      <span className="mx-auto grid size-11 place-items-center rounded-field bg-primary-100 text-primary-600">
        <Icon name="sparkles" />
      </span>
      <h2 className="mt-3 text-heading text-ink">{t("assistant.emptyTitle")}</h2>
      <p className="mt-1.5 text-value text-ink-muted">{t("assistant.emptyBody")}</p>
    </div>
  );
}
