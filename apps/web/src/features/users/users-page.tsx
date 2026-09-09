import { USER_ROLES, type User, type UserRole } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Avatar,
  Badge,
  Button,
  type Column,
  EmailLink,
  EmptyState,
  Icon,
  PageHeader,
  PersonName,
  PhoneLink,
  RowAction,
  SearchField,
  Select,
  Switch,
  Table,
  usePersonName,
  useToast,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { useUpdateUser, useUsers } from '@web/features/users/queries';
import { ResetPasswordModal } from '@web/features/users/reset-password-modal';
import { UserFormModal } from '@web/features/users/user-form-modal';
import { errorMessageKey } from '@web/lib/api-error';
import { formatDate } from '@web/lib/format';

const PAGE_SIZE = 10;

export function UsersPage(): JSX.Element {
  const { t } = useTranslation();
  const displayName = usePersonName();
  const toast = useToast();
  const { user: currentUser } = useSession();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [formUserId, setFormUserId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const query = useUsers({
    page,
    limit: PAGE_SIZE,
    ...(search !== '' && { search }),
    ...(role !== '' && { role }),
  });
  const updateUser = useUpdateUser();

  /*
   * The row being edited is looked up in the live list rather than held as a
   * copy taken when the dialog opened. The photo field inside it uploads on
   * the spot and refetches, and a snapshot would leave the dialog showing the
   * face that was just replaced.
   */
  const formUser =
    formUserId === null
      ? null
      : ((query.data?.items ?? []).find((row) => row.id === formUserId) ?? null);

  const toggleActive = async (row: User): Promise<void> => {
    try {
      await updateUser.mutateAsync({ id: row.id, body: { isActive: !row.isActive } });
      toast.success('users.updated');
    } catch (error) {
      toast.error(errorMessageKey(error));
    }
  };

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: 'name',
        header: 'users.name',
        primary: true,
        // Name and email in one identity cell, the way the patients list does
        // it. Two columns for one person is what pushed "Reset password" off
        // the right-hand edge of the card at 1440px.
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar name={displayName(row.name)} tintKey={row.id} src={row.photoUrl} />
            <span className="flex min-w-0 flex-col leading-snug">
              {/* Both spellings on hover: this is the screen where somebody
                  checks how a name is written on a letterhead. */}
              <PersonName name={row.name} showBoth className="truncate font-semibold text-ink" />
              {/*
                The wide shape only. On a card the email is already its own
                labelled row (the `email` column below, which exists for
                exactly that) — the caption and the row are the same address
                twice, which since it became a link is two identical links.
              */}
              {row.email !== null && row.email !== undefined && (
                <EmailLink
                  value={row.email}
                  className="hidden truncate text-label md:inline-flex"
                />
              )}
            </span>
          </span>
        ),
      },
      {
        key: 'phone',
        header: 'users.phone',
        render: (row) => <PhoneLink value={row.phone} />,
      },
      // Dropped from the wide shape — it is the caption under the name there —
      // but kept as its own labelled row on a card, where there is no caption.
      {
        key: 'email',
        header: 'users.email',
        hideOnDesktop: true,
        render: (row) => <EmailLink value={row.email} />,
      },
      {
        key: 'role',
        header: 'users.role',
        render: (row) => <Badge tone="info">{t(`roles.${row.role}`)}</Badge>,
      },
      {
        key: 'status',
        header: 'users.status',
        render: (row) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.isActive}
              // Deactivating yourself is refused by the API; do not offer it.
              disabled={row.id === currentUser?.id}
              onCheckedChange={() => void toggleActive(row)}
              label={row.isActive ? t('users.deactivate') : t('users.activate')}
            />
            {/* Plain text, not a badge: a switch that is on beside a green pill
                reading "Active" states the same fact twice, in the width of
                two columns. */}
            <span className="text-label text-ink-muted">
              {row.isActive ? t('users.active') : t('users.inactive')}
            </span>
          </div>
        ),
      },
      {
        key: 'createdAt',
        header: 'audit.when',
        // Housekeeping detail; the account itself is what a phone is for.
        hideOnMobile: true,
        render: (row) => formatDate(row.createdAt),
      },
      {
        key: 'actions',
        header: 'common.actions',
        actions: true,
        render: (row) => (
          <div className="flex items-center gap-4">
            <RowAction
              icon={<Icon name="edit" />}
              onClick={() => {
                setFormUserId(row.id);
                setFormOpen(true);
              }}
            >
              {t('common.edit')}
            </RowAction>
            {/* The second action on the row, so grey until it is pointed at:
                two blues in one cell and neither is the one to press. */}
            <RowAction icon={<Icon name="key" />} tone="quiet" onClick={() => setResetUser(row)}>
              {t('users.resetPassword')}
            </RowAction>
          </div>
        ),
      },
    ],
    [t, currentUser?.id],
  );

  const data = query.data;

  return (
    <>
      <PageHeader
        title="users.title"
        subtitle="users.subtitle"
        actions={
          <Button
            icon={<Icon name="user-plus" />}
            onClick={() => {
              setFormUserId(null);
              setFormOpen(true);
            }}
          >
            {t('users.create')}
          </Button>
        }
      />

      {/* The same toolbar shape as every other list: the app's search field,
          then the filters, on their own line at 390px. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchField
          className="w-full min-w-0 sm:max-w-md sm:flex-1"
          label={t('common.search')}
          shortcut="/"
          placeholder={t('users.searchPlaceholder')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />

        <Select
          className="w-full sm:ms-auto sm:w-48"
          aria-label={t('users.filterRole')}
          placeholder={t('common.all')}
          options={USER_ROLES.map((value) => ({ value, label: t(`roles.${value}`) }))}
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserRole | '');
            setPage(1);
          }}
        />
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        empty={
          <EmptyState
            title="users.empty"
            hint="users.emptyHint"
            action={
              <Button
                icon={<Icon name="user-plus" />}
                onClick={() => {
                  setFormUserId(null);
                  setFormOpen(true);
                }}
              >
                {t('users.create')}
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
          },
        })}
      />

      <UserFormModal open={formOpen} onOpenChange={setFormOpen} user={formUser} />
      <ResetPasswordModal
        open={resetUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResetUser(null);
          }
        }}
        user={resetUser}
      />
    </>
  );
}
