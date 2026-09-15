import { personName, USER_ROLE, type Doctor } from '@clinic/shared';
import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Icon,
  PageHeader,
  PersonName,
  PhoneLink,
  SearchField,
  Table,
  usePageParams,
  type Column,
} from '@clinic/ui';
import { useSession } from '@web/features/auth/session';
import { DoctorFormModal } from '@web/features/doctors/doctor-form-modal';
import { useDoctors } from '@web/features/doctors/queries';
import { formatList } from '@web/lib/format';
import { isRefetching } from '@clinic/ui/lib/use-delayed-loading';

/** Readable by every role; only admin sees the write actions (ROLES.md). */
export function DoctorsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { hasRole } = useSession();
  const navigate = useNavigate();
  const isAdmin = hasRole(USER_ROLE.ADMIN);

  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams(10);
  const [search, setSearch] = useState('');
  const [formDoctor, setFormDoctor] = useState<Doctor | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const query = useDoctors({ page, limit: perPage, ...(search !== '' && { search }) });

  const summariseSchedule = (doctor: Doctor): string => {
    const workingDays = doctor.weeklySchedule.filter((day) => day.ranges.length > 0);

    if (workingDays.length === 0) {
      return t('schedule.off');
    }

    return formatList(workingDays.map((day) => t(`schedule.weekday.${day.weekday}`)));
  };

  const columns = useMemo<Column<Doctor>[]>(() => {
    const base: Column<Doctor>[] = [
      {
        key: 'name',
        header: 'users.name',
        primary: true,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar
              name={personName(row.user.name, i18n.language)}
              tintKey={row.user.id}
              src={row.user.photoUrl}
            />
            <PersonName name={row.user.name} showBoth />
          </span>
        ),
      },
      {
        key: 'phone',
        header: 'users.phone',
        render: (row) => <PhoneLink value={row.user.phone} />,
      },
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
        hideOnMobile: true,
        render: summariseSchedule,
      },
    ];

    base.push({
      key: 'actions',
      header: 'common.actions',
      actions: true,
      render: (row) => (
        <span className="flex items-center justify-end gap-3">
          {/* The hours and the time off live on the doctor's own page now —
              a growing list of absences was never going to fit in a modal. */}
          <Button
            size="sm"
            variant="quiet"
            icon={<Icon name="clock" />}

            onClick={() => navigate(`/doctors/${row.id}`)}
          >
            {t('doctors.openSchedule')}
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Icon name="edit" />}
              onClick={() => {
                setFormDoctor(row);
                setFormOpen(true);
              }}
            >
              {t('common.edit')}
            </Button>
          )}
        </span>
      ),
    });

    return base;
  }, [t, isAdmin, navigate]);

  const data = query.data;

  return (
    <>
      <PageHeader
        title="doctors.title"
        subtitle="doctors.subtitle"
        {...(query.data !== undefined && {
          count: t('pagination.total', { total: query.data.total }),
        })}
        primaryAction={
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
            resetPage();
          }}
        />
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
        empty={<EmptyState icon="stethoscope" title="doctors.empty" hint="doctors.emptyHint" />}
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

      <DoctorFormModal open={formOpen} onOpenChange={setFormOpen} doctor={formDoctor} />
    </>
  );
}
