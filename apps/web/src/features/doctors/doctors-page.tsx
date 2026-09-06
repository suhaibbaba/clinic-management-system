import { USER_ROLE, type Doctor } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Badge,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  RowAction,
  SearchField,
  Table,
  type Column,
} from '@web/components/ui';
import { useSession } from '@web/features/auth/session';
import { DoctorFormModal } from '@web/features/doctors/doctor-form-modal';
import { useDoctors } from '@web/features/doctors/queries';

const PAGE_SIZE = 10;

/** Readable by every role; only admin sees the write actions (ROLES.md). */
export function DoctorsPage(): JSX.Element {
  const { t } = useTranslation();
  const { user, hasRole } = useSession();
  const isAdmin = hasRole(USER_ROLE.ADMIN);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [formDoctor, setFormDoctor] = useState<Doctor | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const query = useDoctors({ page, limit: PAGE_SIZE, ...(search !== '' && { search }) });

  const summariseSchedule = (doctor: Doctor): string => {
    const workingDays = doctor.weeklySchedule.filter((day) => day.ranges.length > 0);

    if (workingDays.length === 0) {
      return t('schedule.off');
    }

    return workingDays.map((day) => t(`schedule.weekday.${day.weekday}`)).join('، ');
  };

  const columns = useMemo<Column<Doctor>[]>(() => {
    const base: Column<Doctor>[] = [
      { key: 'name', header: 'users.name', primary: true, render: (row) => row.user.name },
      { key: 'phone', header: 'users.phone', render: (row) => row.user.phone },
      {
        key: 'specialty',
        header: 'doctors.specialty',
        render: (row) => <Badge tone="info">{row.specialty.name}</Badge>,
      },
      {
        key: 'duration',
        header: 'doctors.duration',
        render: (row) => `${row.defaultAppointmentDurationMinutes} ${t('doctors.durationUnit')}`,
      },
      {
        key: 'schedule',
        header: 'doctors.schedule',
        // A week of opening hours on one line is unreadable at 375px.
        hideOnMobile: true,
        render: summariseSchedule,
      },
    ];

    // A doctor may edit their own schedule; an admin may edit anyone's.
    base.push({
      key: 'actions',
      header: 'common.actions',
      actions: true,
      render: (row) =>
        isAdmin || row.userId === user?.id ? (
          <RowAction
            icon={<Icon name="edit" />}
            onClick={() => {
              setFormDoctor(row);
              setFormOpen(true);
            }}
          >
            {isAdmin ? t('common.edit') : t('doctors.editSchedule')}
          </RowAction>
        ) : null,
    });

    return base;
  }, [t, isAdmin, user?.id]);

  const data = query.data;

  return (
    <>
      <PageHeader
        title="doctors.title"
        subtitle="doctors.subtitle"
        actions={
          isAdmin ? (
            <Button
              icon={<Icon name="user-plus" />}
              onClick={() => {
                setFormDoctor(null);
                setFormOpen(true);
              }}
            >
              {t('doctors.create')}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5">
        <SearchField
          className="w-full min-w-0 sm:max-w-md"
          label={t('common.search')}
          shortcut="/"
          placeholder={t('doctors.searchPlaceholder')}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        empty={<EmptyState icon="stethoscope" title="doctors.empty" hint="doctors.emptyHint" />}
        {...(data && {
          pagination: {
            page: data.page,
            totalPages: data.totalPages,
            total: data.total,
            onPageChange: setPage,
          },
        })}
      />

      <DoctorFormModal open={formOpen} onOpenChange={setFormOpen} doctor={formDoctor} />
    </>
  );
}
