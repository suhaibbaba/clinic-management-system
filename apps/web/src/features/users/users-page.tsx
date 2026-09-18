import { USER_ROLES, type User, type UserRole } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";

import {
  Avatar,
  Badge,
  Button,
  EmailLink,
  EmptyState,
  Icon,
  MenuItem,
  Modal,
  PageHeader,
  PersonName,
  PhoneLink,
  RowMenu,
  SearchField,
  Select,
  Switch,
  Table,
  usePageParams,
  usePersonName,
  useToast,
  type Column,
} from "@clinic/ui";
import { useSession } from "@web/features/auth/session";
import {
  useDeleteUser,
  useInviteUser,
  useSendPasswordReset,
  useUpdateUser,
  useUsers,
} from "@web/features/users/queries";
import { ResetPasswordModal } from "@web/features/users/reset-password-modal";
import { UserFormModal } from "@web/features/users/user-form-modal";
import { errorMessageKey } from "@web/lib/api-error";
import { formatDate } from "@web/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function UsersPage(): JSX.Element {
  const { t } = useTranslation();
  const displayName = usePersonName();
  const toast = useToast();
  const invite = useInviteUser();
  const sendReset = useSendPasswordReset();
  const removeUser = useDeleteUser();
  const { user: currentUser, can } = useSession();

  const send = async (
    run: Promise<unknown>,
    successKey: "users.inviteSent" | "users.resetLinkSent",
  ): Promise<void> => {
    try {
      await run;
      toast.success(successKey);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams(10);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [formUserId, setFormUserId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const query = useUsers({
    page,
    limit: perPage,
    ...(search !== "" && { search }),
    ...(role !== "" && { role }),
  });
  const updateUser = useUpdateUser();

  // Looked up in the live list rather than snapshotted when the dialog opened: the photo field
  // uploads on the spot, and a copy would show the face just replaced.
  const formUser =
    formUserId === null
      ? null
      : ((query.data?.items ?? []).find((row) => row.id === formUserId) ?? null);

  const remove = async (): Promise<void> => {
    if (!deleting) {
      return;
    }

    try {
      await removeUser.mutateAsync(deleting.id);
      toast.success("users.deleted");
      setDeleting(null);
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const toggleActive = async (row: User): Promise<void> => {
    try {
      await updateUser.mutateAsync({ id: row.id, body: { isActive: !row.isActive } });
      toast.success("users.updated");
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: "name",
        header: "users.name",
        primary: true,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar
              name={displayName(row.name)}
              tintKey={row.id}
              src={row.photoUrl}
              data-testid="user-avatar"
            />
            <span className="flex min-w-0 flex-col leading-label">
              {/* Both spellings on hover: this is the screen where somebody
                  checks how a name is written on a letterhead. */}
              <PersonName
                name={row.name}
                showBoth
                data-testid="user-name"
                className="truncate font-medium text-ink"
              />
              {/* The wide shape only: on a card the email is already its own labelled row, and since
                  it became a link that would be two identical links. */}
              {row.email !== null && row.email !== undefined && (
                <EmailLink
                  value={row.email}
                  // `break-all` rather than `truncate`: the link's 44px hit area is an `::after`,
                  // which an `overflow-hidden` ancestor cuts to the line.
                  className="hidden break-all text-label md:inline-flex"
                />
              )}
            </span>
          </span>
        ),
      },
      {
        key: "phone",
        header: "users.phone",
        render: (row) => <PhoneLink value={row.phone} />,
      },
      {
        key: "email",
        header: "users.email",
        hideOnDesktop: true,
        render: (row) => <EmailLink value={row.email} />,
      },
      {
        key: "role",
        header: "users.role",
        render: (row) => (
          <Badge tone="info" data-testid="user-role">
            {t(`roles.${row.role}`)}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "users.status",
        render: (row) => (
          <div className="flex items-center gap-2">
            <Switch
              data-testid="user-active-switch"
              checked={row.isActive}
              // Deactivating yourself is refused by the API; do not offer it.
              disabled={row.id === currentUser?.id}
              onCheckedChange={() => void toggleActive(row)}
              label={row.isActive ? t("users.deactivate") : t("users.activate")}
              hideLabel
            />
            {/* Plain text, not a badge: a switch that is on beside a green pill
                reading "Active" states the same fact twice, in the width of
                two columns. */}
            <span data-testid="user-active-label" className="text-label text-ink-muted">
              {row.isActive ? t("users.active") : t("users.inactive")}
            </span>

            {/* An account nobody has claimed yet: the switch says it is live, and it is — there is
                simply no password on it until its owner sets one. */}
            {!row.activated && (
              <Badge tone="warning" data-testid="user-pending">
                {t("users.pending")}
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "createdAt",
        header: "audit.when",
        hideOnMobile: true,
        render: (row) => formatDate(row.createdAt),
      },
      {
        key: "actions",
        header: "common.actions",
        actions: true,
        render: (row) => (
          <RowMenu label={t("users.rowMenu")} data-testid="user-menu">
            {can("users.update") && (
              <MenuItem
                icon="edit"
                data-testid="user-menu-edit"
                onSelect={() => {
                  setFormUserId(row.id);
                  setFormOpen(true);
                }}
              >
                {t("common.edit")}
              </MenuItem>
            )}

            {/* Offered only where it can do anything: an account with no address has no link to
                send, one already activated does not need this one, and a disabled account is
                refused the letter. */}
            {!row.activated && row.email && row.isActive && can("users.invite") && (
              <MenuItem
                icon="mail"
                data-testid="user-menu-resend-invite"
                onSelect={() => void send(invite.mutateAsync(row.id), "users.inviteSent")}
              >
                {t("users.resendInvite")}
              </MenuItem>
            )}

            {/* Changing a password is for somebody who has one: an account still waiting to be
                claimed gets the activation letter above instead. An address is needed to receive
                either, and a disabled account has nothing to come back to. */}
            {row.activated && row.email && row.isActive && can("users.sendPasswordReset") && (
              <MenuItem
                icon="key"
                data-testid="user-menu-send-reset"
                onSelect={() => void send(sendReset.mutateAsync(row.id), "users.resetLinkSent")}
              >
                {t("users.sendResetLink")}
              </MenuItem>
            )}

            {!row.email && can("users.resetPassword") && (
              <MenuItem
                icon="key"
                data-testid="user-menu-reset-password"
                onSelect={() => setResetUser(row)}
              >
                {t("users.resetPassword")}
              </MenuItem>
            )}

            {/* Deleting your own account is refused by the API; do not offer it. */}
            {row.id !== currentUser?.id && can("users.remove") && (
              <MenuItem
                icon="trash"
                tone="danger"
                data-testid="user-menu-delete"
                onSelect={() => setDeleting(row)}
              >
                {t("users.delete")}
              </MenuItem>
            )}
          </RowMenu>
        ),
      },
    ],
    [t, currentUser?.id, can, displayName],
  );

  const data = query.data;

  return (
    <div data-testid="users-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="users-header"
        title="users.title"
        subtitle="users.subtitle"
        {...(query.data !== undefined && {
          count: t("pagination.total", { total: query.data.total }),
        })}
        primaryAction={
          <Button
            icon={<Icon name="user-plus" />}
            data-testid="users-create"
            onClick={() => {
              setFormUserId(null);
              setFormOpen(true);
            }}
          >
            {t("users.create")}
          </Button>
        }
      />

      {/* The same toolbar shape as every other list: the app's search field,
          then the filters, on their own line at 390px. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchField
          data-testid="users-search"
          className="w-full min-w-0 sm:max-w-md sm:flex-1"
          label={t("common.search")}
          shortcut="/"
          placeholder={t("users.searchPlaceholder")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
          clearLabel={t("common.clear")}
          onClear={() => {
            setSearch("");
            resetPage();
          }}
        />

        <Select
          data-testid="users-filter-role"
          className="w-full sm:ms-auto sm:w-48"
          aria-label={t("users.filterRole")}
          placeholder={t("common.all")}
          options={USER_ROLES.map((value) => ({ value, label: t(`roles.${value}`) }))}
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserRole | "");
            resetPage();
          }}
        />
      </div>

      <Table
        data-testid="users-table"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
        empty={
          <EmptyState
            data-testid="users-empty"
            title="users.empty"
            hint="users.emptyHint"
            action={
              <Button
                icon={<Icon name="user-plus" />}
                data-testid="users-empty-create"
                onClick={() => {
                  setFormUserId(null);
                  setFormOpen(true);
                }}
              >
                {t("users.create")}
              </Button>
            }
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

      <UserFormModal
        data-testid="user-form-modal"
        open={formOpen}
        onOpenChange={setFormOpen}
        user={formUser}
      />
      <ResetPasswordModal
        data-testid="reset-password-modal"
        open={resetUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetUser(null);
          }
        }}
        user={resetUser}
      />

      {/* A soft delete, and one the API refuses for your own account. Named in the question, because
          a row menu closes over the row it belonged to. */}
      <Modal
        data-testid="user-delete-modal"
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="users.deleteTitle"
        footer={
          <>
            <Button
              variant="secondary"
              data-testid="user-delete-cancel"
              onClick={() => setDeleting(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              icon={<Icon name="trash" />}
              data-testid="user-delete-confirm"
              isLoading={removeUser.isPending}
              onClick={() => void remove()}
            >
              {t("users.delete")}
            </Button>
          </>
        }
      >
        <p data-testid="user-delete-question" className="text-value text-ink">
          {t("users.deleteQuestion", { name: displayName(deleting?.name) })}
        </p>
      </Modal>
    </div>
  );
}
