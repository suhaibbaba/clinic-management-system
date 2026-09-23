import { addDays, localDate, type AiConversation } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, ConversationItem, Icon, MenuItem, RowMenu } from "@clinic/ui";
import { Skeleton } from "@clinic/ui/components/skeleton";
import { RenameConversationModal } from "@web/features/assistant/rename-conversation-modal";
import { useDeleteConversation } from "@web/features/assistant/queries";
import { clinicTimeZone } from "@web/lib/clinic-zone";
import { formatRelativeTime } from "@web/lib/format";
import { cn } from "@clinic/ui/lib/cn";

export interface ConversationRailProps {
  readonly conversations: readonly AiConversation[];
  readonly loading: boolean;
  readonly selectedId: string | undefined;
  readonly onSelect: (id: string | undefined) => void;
  readonly onDeleted: (id: string) => void;
  readonly className?: string | undefined;
}

type Group = "today" | "yesterday" | "earlier";

// By the clinic's own day, so a conversation from 23:30 is not "today" on a laptop set to UTC.
function groupByDay(conversations: readonly AiConversation[]): [Group, AiConversation[]][] {
  const zone = clinicTimeZone();
  const today = localDate(new Date(), zone);
  const yesterday = addDays(today, -1);
  const groups: Record<Group, AiConversation[]> = { today: [], yesterday: [], earlier: [] };

  for (const conversation of conversations) {
    const day = localDate(new Date(conversation.updatedAt), zone);

    groups[day === today ? "today" : day === yesterday ? "yesterday" : "earlier"].push(
      conversation,
    );
  }

  return (["today", "yesterday", "earlier"] as const)
    .map((group): [Group, AiConversation[]] => [group, groups[group]])
    .filter(([, items]) => items.length > 0);
}

export function ConversationRail({
  conversations,
  loading,
  selectedId,
  onSelect,
  onDeleted,
  className,
}: ConversationRailProps): JSX.Element {
  const { t } = useTranslation();
  const remove = useDeleteConversation();
  const [renaming, setRenaming] = useState<AiConversation | null>(null);

  const confirmDelete = async (conversation: AiConversation): Promise<void> => {
    // The same question the lists screen asks before a row goes.
    if (!window.confirm(t("assistant.confirmDelete", { title: conversation.title }))) {
      return;
    }

    await remove.mutateAsync(conversation.id);
    onDeleted(conversation.id);
  };

  return (
    <aside
      data-testid="assistant-rail"
      aria-label={t("assistant.conversations")}
      className={cn("flex min-h-0 flex-col gap-3 border-line", className)}
    >
      <Button
        icon={<Icon name="plus" />}
        data-testid="assistant-new-conversation"
        onClick={() => onSelect(undefined)}
        className="w-full"
      >
        {t("assistant.newConversation")}
      </Button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-12 w-full rounded-nav" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupByDay(conversations).map(([group, items]) => (
              <section
                key={group}
                data-testid={`assistant-group-${group}`}
                aria-labelledby={`assistant-group-${group}-title`}
              >
                <h3
                  id={`assistant-group-${group}-title`}
                  className="px-3 pb-1 text-micro font-medium text-ink-faint"
                >
                  {t(`assistant.groups.${group}`)}
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {items.map((conversation) => (
                    <li key={conversation.id}>
                      <ConversationItem
                        data-testid={`assistant-conversation-${conversation.id}`}
                        title={conversation.title}
                        timestamp={
                          group === "earlier"
                            ? formatRelativeTime(conversation.updatedAt)
                            : undefined
                        }
                        selected={conversation.id === selectedId}
                        href={`/assistant/${conversation.id}`}
                        onSelect={() => onSelect(conversation.id)}
                        trailing={
                          <RowMenu label={t("common.actions")}>
                            <MenuItem icon="edit" onSelect={() => setRenaming(conversation)}>
                              {t("common.edit")}
                            </MenuItem>
                            <MenuItem
                              icon="trash"
                              tone="danger"
                              onSelect={() => void confirmDelete(conversation)}
                            >
                              {t("common.delete")}
                            </MenuItem>
                          </RowMenu>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <RenameConversationModal conversation={renaming} onClose={() => setRenaming(null)} />
    </aside>
  );
}
