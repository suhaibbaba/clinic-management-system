import { AUDIT_ACTIONS, type AuditAction, type AuditLogEntry } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  type BadgeTone,
  type Column,
} from '@web/components/ui';
import { useAuditLog } from '@web/features/audit/queries';
import { ValueDiff } from '@web/features/audit/value-diff';
import { useUsers } from '@web/features/users/queries';
import { endOfNextDayIso, formatDateTime, startOfDayIso } from '@web/lib/format';

const PAGE_SIZE = 10;

/** Entities the trail can currently contain; each maps to an i18n label. */
const ENTITIES = ['users', 'doctors', 'clinics'] as const;

const ACTION_TONES: Record<AuditAction, BadgeTone> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
};

export function AuditPage(): JSX.Element {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  // Admin-only screen, so listing users to resolve names is permitted.
  const users = useUsers({ limit: 100 });
  const userNames = useMemo(
    () => new Map((users.data?.items ?? []).map((user) => [user.id, user.name])),
    [users.data],
  );

  const query = useAuditLog({
    page,
    limit: PAGE_SIZE,
    ...(entity !== '' && { entity }),
    ...(action !== '' && { action: action as AuditAction }),
    ...(userId !== '' && { userId }),
    ...(startOfDayIso(from) && { from: startOfDayIso(from) }),
    ...(endOfNextDayIso(to) && { to: endOfNextDayIso(to) }),
  });

  const resetPage = (): void => setPage(1);

  const columns = useMemo<Column<AuditLogEntry>[]>(
    () => [
      { key: 'when', header: 'audit.when', render: (row) => formatDateTime(row.createdAt) },
      {
        key: 'user',
        header: 'audit.user',
        render: (row) =>
          row.userId === null ? t('audit.systemUser') : (userNames.get(row.userId) ?? row.userId),
      },
      {
        key: 'action',
        header: 'audit.action',
        render: (row) => (
          <Badge tone={ACTION_TONES[row.action]}>{t(`audit.actions.${row.action}`)}</Badge>
        ),
      },
      {
        key: 'entity',
        header: 'audit.entity',
        render: (row) => t(`audit.entities.${row.entity}`, { defaultValue: row.entity }),
      },
      {
        key: 'changes',
        header: 'audit.changes',
        render: (row) => (
          <Button
            icon={<Icon name="file" />}
            size="sm"
            variant="ghost"
            onClick={() => setSelected(row)}
          >
            {t('audit.viewChanges')}
          </Button>
        ),
      },
    ],
    [t, userNames],
  );

  const data = query.data;

  return (
    <>
      <PageHeader title="audit.title" subtitle="audit.subtitle" />

      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          className="w-44"
          aria-label={t('audit.filterEntity')}
          placeholder={t('common.all')}
          options={ENTITIES.map((value) => ({
            value,
            label: t(`audit.entities.${value}`, { defaultValue: value }),
          }))}
          value={entity}
          onChange={(event) => {
            setEntity(event.target.value);
            resetPage();
          }}
        />

        <Select
          className="w-40"
          aria-label={t('audit.filterAction')}
          placeholder={t('common.all')}
          options={AUDIT_ACTIONS.map((value) => ({
            value,
            label: t(`audit.actions.${value}`),
          }))}
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            resetPage();
          }}
        />

        <Select
          className="w-52"
          aria-label={t('audit.filterUser')}
          placeholder={t('common.all')}
          options={(users.data?.items ?? []).map((user) => ({
            value: user.id,
            label: user.name,
          }))}
          value={userId}
          onChange={(event) => {
            setUserId(event.target.value);
            resetPage();
          }}
        />

        <label className="flex flex-col gap-1 text-label text-ink-muted">
          {t('audit.fromDate')}
          <Input
            adornment="calendar"
            type="date"
            className="w-44"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              resetPage();
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-label text-ink-muted">
          {t('audit.toDate')}
          <Input
            adornment="calendar"
            type="date"
            className="w-44"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              resetPage();
            }}
          />
        </label>
      </Card>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        empty={<EmptyState icon="clipboard" title="audit.empty" hint="audit.emptyHint" />}
        {...(data && {
          pagination: {
            page: data.page,
            totalPages: data.totalPages,
            total: data.total,
            onPageChange: setPage,
          },
        })}
      />

      <Modal
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
        size="lg"
        title="audit.changesFor"
        titleValues={{
          entity: selected
            ? t(`audit.entities.${selected.entity}`, { defaultValue: selected.entity })
            : '',
        }}
      >
        {selected && <ValueDiff oldValue={selected.oldValue} newValue={selected.newValue} />}
      </Modal>
    </>
  );
}
