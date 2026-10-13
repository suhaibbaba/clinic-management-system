import {
  CONTACT_MESSAGE_STATUS,
  CONTACT_MESSAGE_STATUSES,
  type ContactMessage,
  type ContactMessageStatus,
} from "@clinic/shared";
import { useMemo, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  Badge,
  EmailLink,
  EmptyState,
  MenuItem,
  PersonName,
  PhoneLink,
  RowMenu,
  SegmentedControl,
  Table,
  useConfirm,
  usePageParams,
  useToast,
  type Column,
} from "@clinic/ui";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";
import { errorToast } from "@web/shared/lib/api-error";
import { formatDateTime } from "@web/shared/lib/format";
import { canHandleContactMessage, canRemoveContactMessage } from "@web/shared/permissions/website";
import { useSession } from "@web/shared/providers/session";
import { useContactMessages } from "@web/shared/queries/website";
import { MESSAGES_STATUS_PARAM } from "@web/modules/website/constants";
import { useRemoveContactMessage, useSetContactMessageStatus } from "@web/modules/website/queries";

const ALL = "all";

type StatusFilter = ContactMessageStatus | typeof ALL;

const isStatus = (value: string | null): value is ContactMessageStatus =>
  (CONTACT_MESSAGE_STATUSES as readonly (string | null)[]).includes(value);

export function WebsiteMessages(): JSX.Element {
  const { t } = useTranslation();
  const toast = useToast();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const { page, perPage, setPage, setPerPage } = usePageParams();
  const { confirm, dialog } = useConfirm("contact-message-confirm-remove");
  const setStatus = useSetContactMessageStatus();
  const remove = useRemoveContactMessage();

  const requested = params.get(MESSAGES_STATUS_PARAM);
  const status: StatusFilter = isStatus(requested) ? requested : ALL;
  const mayHandle = canHandleContactMessage(can);
  const mayRemove = canRemoveContactMessage(can);

  const query = useContactMessages({
    page,
    limit: perPage,
    ...(status !== ALL && { status }),
  });

  const changeStatus = async (message: ContactMessage, next: ContactMessageStatus) => {
    try {
      await setStatus.mutateAsync({ id: message.id, status: next });
      toast.success(
        next === CONTACT_MESSAGE_STATUS.HANDLED
          ? "website.messages.markedHandled"
          : "website.messages.markedOpen",
      );
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const askRemove = (message: ContactMessage): void =>
    confirm({
      title: "website.messages.confirmRemove.title",
      titleValues: { name: message.name },
      consequences: [t("website.messages.confirmRemove.consequence")],
      onConfirm: async () => {
        try {
          await remove.mutateAsync(message.id);
          toast.success("website.messages.removed");
        } catch (error) {
          toast.error(...errorToast(error));
          throw error;
        }
      },
    });

  const columns = useMemo<Column<ContactMessage>[]>(
    () => [
      {
        key: "from",
        header: "website.messages.from",
        primary: true,
        render: (row) => (
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-ink [unicode-bidi:plaintext]">{row.name}</span>
            <PhoneLink value={row.phone} className="text-label" />
            {row.email && <EmailLink value={row.email} className="text-label" />}
          </span>
        ),
      },
      {
        key: "message",
        header: "website.messages.message",
        render: (row) => (
          <span className="line-clamp-4 whitespace-pre-wrap [unicode-bidi:plaintext]">
            {row.message}
          </span>
        ),
      },
      {
        key: "received",
        header: "website.messages.received",
        render: (row) => formatDateTime(row.createdAt),
      },
      {
        key: "status",
        header: "website.messages.status",
        render: (row) =>
          row.status === CONTACT_MESSAGE_STATUS.HANDLED ? (
            <span className="flex flex-col items-start gap-0.5">
              <Badge tone="success">{t("website.messages.handled")}</Badge>
              {row.handledBy && (
                <PersonName name={row.handledBy} className="text-label text-ink-muted" />
              )}
            </span>
          ) : (
            <Badge tone="warning">{t("website.messages.open")}</Badge>
          ),
      },
      ...(mayHandle || mayRemove
        ? [
            {
              key: "actions",
              header: "common.actions",
              actions: true,
              render: (row: ContactMessage) => (
                <RowMenu label={t("common.actions")} data-testid={`contact-message-menu-${row.id}`}>
                  {mayHandle &&
                    (row.status === CONTACT_MESSAGE_STATUS.OPEN ? (
                      <MenuItem
                        icon="check"
                        data-testid={`contact-message-handle-${row.id}`}
                        onSelect={() => void changeStatus(row, CONTACT_MESSAGE_STATUS.HANDLED)}
                      >
                        {t("website.messages.markHandled")}
                      </MenuItem>
                    ) : (
                      <MenuItem
                        icon="reset"
                        data-testid={`contact-message-reopen-${row.id}`}
                        onSelect={() => void changeStatus(row, CONTACT_MESSAGE_STATUS.OPEN)}
                      >
                        {t("website.messages.markOpen")}
                      </MenuItem>
                    ))}
                  {mayRemove && (
                    <MenuItem
                      icon="trash"
                      tone="danger"
                      data-testid={`contact-message-remove-${row.id}`}
                      onSelect={() => askRemove(row)}
                    >
                      {t("common.delete")}
                    </MenuItem>
                  )}
                </RowMenu>
              ),
            },
          ]
        : []),
    ],
    [t, mayHandle, mayRemove],
  );

  const data = query.data;

  return (
    <div data-testid="website-messages" className="flex flex-col gap-4">
      {dialog}

      <SegmentedControl
        data-testid="website-messages-status"
        label={t("website.messages.filter")}
        className="self-start"
        value={status}
        options={[
          { value: ALL, label: t("website.messages.all") },
          { value: CONTACT_MESSAGE_STATUS.OPEN, label: t("website.messages.open") },
          { value: CONTACT_MESSAGE_STATUS.HANDLED, label: t("website.messages.handled") },
        ]}
        onChange={(next) =>
          setParams(
            (current) => {
              const updated = new URLSearchParams(current);

              if (next === ALL) {
                updated.delete(MESSAGES_STATUS_PARAM);
              } else {
                updated.set(MESSAGES_STATUS_PARAM, next);
              }

              updated.delete("page");

              return updated;
            },
            { replace: true },
          )
        }
      />

      <Table
        data-testid="website-messages-table"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
        empty={
          <EmptyState
            icon="message"
            data-testid="website-messages-empty"
            title="website.messages.empty"
            hint="website.messages.emptyHint"
          />
        }
        {...(data && {
          pagination: {
            page: data.page,
            totalPages: data.totalPages,
            onPageChange: setPage,
            perPage,
            onPerPageChange: setPerPage,
          },
        })}
      />
    </div>
  );
}
