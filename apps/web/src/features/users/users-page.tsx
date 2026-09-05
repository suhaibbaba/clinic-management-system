import { USER_ROLES, type User, type UserRole } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  Select,
  Switch,
  Table,
  type Column,
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
  const toast = useToast();
  const { user: currentUser } = useSession();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [formUser, setFormUser] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);

  const query = useUsers({
    page,
    limit: PAGE_SIZE,
    ...(search !== '' && { search }),
    ...(role !== '' && { role }),
  });
  const updateUser = useUpdateUser();

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
      { key: 'name', header: 'users.name', render: (row) => row.name },
      { key: 'phone', header: 'users.phone', render: (row) => row.phone },
      { key: 'email', header: 'users.email', render: (row) => row.email ?? '—' },
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
            <Badge tone={row.isActive ? 'success' : 'neutral'}>
              {row.isActive ? t('users.active') : t('users.inactive')}
            </Badge>
          </div>
        ),
      },
      { key: 'createdAt', header: 'audit.when', render: (row) => formatDate(row.createdAt) },
      {
        key: 'actions',
        header: 'common.actions',
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button
              icon={<Icon name="edit" />}
              size="sm"
              variant="secondary"
              onClick={() => {
                setFormUser(row);
                setFormOpen(true);
              }}
            >
              {t('common.edit')}
            </Button>
            <Button
              icon={<Icon name="key" />}
              size="sm"
              variant="ghost"
              onClick={() => setResetUser(row)}
            >
              {t('users.resetPassword')}
            </Button>
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
              setFormUser(null);
              setFormOpen(true);
            }}
          >
            {t('users.create')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="w-64"
          placeholder={t('users.searchPlaceholder')}
          aria-label={t('common.search')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />

        <Select
          className="w-48"
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
                  setFormUser(null);
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
