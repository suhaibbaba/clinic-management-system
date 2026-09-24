import {
  AI_MESSAGE_ROLE,
  AI_OUTBOUND_TRIGGER,
  AI_PROPOSAL_KIND,
  AI_TOOL,
  personName,
  type AiMessage,
  type AiProposal,
  type AiErrorCode,
  type AiProposalStatusEvent,
} from "@clinic/shared";
import { useCallback, useEffect, useState, type JSX } from "react";
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
import { SUGGESTIONS, TOPICS } from "@web/features/assistant/suggestions";
import { useAssistantStream } from "@web/features/assistant/use-assistant-stream";
import { useWorkspaceTopBar } from "@web/components/layout/workspace-top-bar";
import { ellipsis } from "@web/i18n/ellipsis";
import { cn } from "@clinic/ui/lib/cn";
import { useDocumentTitle } from "@clinic/ui/lib/page-title";

const SETTINGS = "/settings";

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

  useEffect(() => {
    if (!railOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setRailOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [railOpen]);

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
  const topBar = useWorkspaceTopBar();

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
    // A workspace page: the shell hands over the viewport and its top bar, which sits above the
    // thread only, so the conversation list runs the full height beside the navigation.
    <div data-testid="assistant-page" className="flex min-h-0 flex-1 overflow-hidden">
      {railOpen && (
        <button
          type="button"
          data-testid="assistant-rail-backdrop"
          aria-label={t("common.close")}
          tabIndex={-1}
          className={cn(
            "fixed inset-0 z-20 cursor-default bg-ink/50 backdrop-blur-[2px] md:hidden",
            "animate-[fade-in_200ms_ease-out]",
          )}
          onClick={() => setRailOpen(false)}
        />
      )}

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
          "w-72 shrink-0 bg-surface p-3 pt-5 md:border-e md:border-line",
          "max-md:rounded-card max-md:border max-md:border-line max-md:pt-3 max-md:shadow-card",
          // Off-canvas below `md`, where the thread needs the whole width. It leaves by the edge
          // it sits against, which is the other one in Arabic — `page-rtl` rather than a bare
          // `rtl:`, which this theme does not define.
          "max-md:fixed max-md:inset-y-16 max-md:start-3 max-md:z-30 max-md:w-[17rem]",
          "max-md:transition-transform max-md:duration-200",
          !railOpen && "max-md:page-ltr:-translate-x-[120%] max-md:page-rtl:translate-x-[120%]",
        )}
      />

      <section aria-label={t("nav.assistant")} className="flex min-w-0 flex-1 flex-col bg-canvas">
        {topBar}

        <header className="flex items-center gap-2 border-y border-line px-4 py-2.5 md:hidden">
          <Button
            variant="quiet"
            size="sm"
            icon={<Icon name="menu" />}
            aria-label={t("assistant.conversations")}
            onClick={() => setRailOpen((open) => !open)}
          />
          <span className="truncate text-label text-ink-muted">{t("nav.assistant")}</span>
        </header>

        {empty ? (
          <div data-testid="assistant-thread" className="flex min-h-0 flex-1 overflow-y-auto">
            <div className="m-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
              <EmptyIntro disabled={stream.streaming} onAsk={ask} />
              {automated.map((proposal) => (
                <ProposalCard key={proposal.id} id={proposal.id} initial={proposal} />
              ))}
            </div>
          </div>
        ) : (
          <ChatThread data-testid="assistant-thread" jumpLabel={t("assistant.jumpToLatest")}>
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
        )}

        <div className="px-3 pb-3 sm:px-6 sm:pb-5">
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
                  className="justify-center max-sm:flex-nowrap max-sm:justify-start max-sm:overflow-x-auto max-sm:pb-1"
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
  const toKeys = isKeyFailure(code) && canReachNavItem(SETTINGS, user?.role);

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
              to={`${SETTINGS}?view=assistant&tab=keys`}
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

function EmptyIntro({
  disabled,
  onAsk,
}: {
  disabled: boolean;
  onAsk: (question: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const { user } = useSession();

  return (
    <div data-testid="assistant-empty" className="flex flex-col items-center text-center">
      <span className="grid size-14 place-items-center rounded-card border border-line bg-surface text-primary-600 shadow-card">
        <Icon name="sparkles" />
      </span>
      <h2 className="mt-4 text-title font-bold text-ink">
        {user
          ? t("assistant.emptyTitleNamed", { name: personName(user.name, i18n.language) })
          : t("assistant.emptyTitle")}
      </h2>
      <p className="mt-2 max-w-md text-value text-ink-muted">{t("assistant.emptyBody")}</p>

      <ul className="mt-6 grid w-full gap-2 sm:grid-cols-3 sm:gap-3">
        {TOPICS.map((topic) => (
          <li key={topic.key}>
            <button
              type="button"
              data-testid={`assistant-topic-${topic.key}`}
              disabled={disabled}
              onClick={() => onAsk(t(`${topic.prefix}.prompt`))}
              className={cn(
                "flex h-full w-full cursor-pointer items-center gap-3 rounded-card border border-line",
                "bg-surface p-3 text-start shadow-card transition-colors duration-150",
                "sm:flex-col sm:items-start sm:gap-1 sm:p-4",
                "hover:border-primary-300 hover:bg-primary-50",
                "outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <Icon name={topic.icon} className="text-primary-600" />
              <span className="text-label font-semibold text-ink sm:mt-1">
                {t(`${topic.prefix}.title`)}
              </span>
              <span className="text-label text-ink-muted max-sm:hidden">
                {t(`${topic.prefix}.body`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
