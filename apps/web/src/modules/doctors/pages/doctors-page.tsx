import { personName, type Doctor } from "@clinic/shared";
import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  MenuItem,
  PageHeader,
  PersonName,
  PhoneLink,
  RowMenu,
  SearchField,
  Table,
  TotalBadge,
  usePageParams,
  useToast,
  type Column,
} from "@clinic/ui";
import { useSession } from "@web/shared/providers/session";
import { canDeleteDoctor, canManageDoctors } from "@web/shared/permissions/doctors";
import { DoctorFormModal } from "@web/modules/doctors/components/doctor-form-modal";
import { useDeleteDoctor } from "@web/modules/doctors/queries";
import { useDoctors } from "@web/shared/queries/doctors";
import { errorToast } from "@web/shared/lib/api-error";
import { formatList } from "@web/shared/lib/format";
import { isRefetching } from "@clinic/ui/lib/use-delayed-loading";

export function DoctorsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { can, user: currentUser } = useSession();
  const toast = useToast();
  const removeDoctor = useDeleteDoctor();
  const navigate = useNavigate();
  const mayEdit = canManageDoctors(can);
  const mayDelete = canDeleteDoctor(can);
  const mayCreate = can("doctors.create");

  const { page, perPage, setPage, setPerPage, resetPage } = usePageParams();
  const [search, setSearch] = useState("");
  const [formDoctor, setFormDoctor] = useState<Doctor | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Doctor | null>(null);

  const query = useDoctors({ page, limit: perPage, ...(search !== "" && { search }) });

  const summariseSchedule = (doctor: Doctor): string => {
    const workingDays = doctor.weeklySchedule.filter((day) => day.ranges.length > 0);

    if (workingDays.length === 0) {
      return t("schedule.off");
    }

    return formatList(workingDays.map((day) => t(`schedule.weekday.${day.weekday}`)));
  };

  const columns = useMemo<Column<Doctor>[]>(() => {
    const base: Column<Doctor>[] = [
      {
        key: "name",
        header: "users.name",
        primary: true,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar
              data-testid="doctor-avatar"
              name={personName(row.user.name, i18n.language)}
              tintKey={row.user.id}
              src={row.user.photoUrl}
            />
            <PersonName name={row.user.name} showBoth data-testid="doctor-name" />
            {row.isVisiting && (
              <Badge tone="neutral" data-testid="doctor-visiting">
                {t("roles.visiting_doctor")}
              </Badge>
            )}
          </span>
        ),
      },
      {
        key: "phone",
        header: "users.phone",
        render: (row) => <PhoneLink value={row.user.phone} />,
      },
      {
        key: "specialty",
        header: "doctors.specialty",
        render: (row) => (
          <Badge tone="info" data-testid="doctor-specialty">
            {row.specialty.name}
          </Badge>
        ),
      },
      {
        key: "duration",
        header: "doctors.duration",
        render: (row) => `${row.defaultAppointmentDurationMinutes} ${t("doctors.durationUnit")}`,
      },
      {
        key: "schedule",
        header: "doctors.schedule",
        hideOnMobile: true,
        render: summariseSchedule,
      },
    ];

    base.push({
      key: "actions",
      header: "common.actions",
      actions: true,
      render: (row) => (
        <RowMenu label={t("doctors.rowMenu")} data-testid={`doctor-${row.id}-menu`}>
          <MenuItem
            icon="clock"
            data-testid="doctor-open-schedule"
            onSelect={() => navigate(`/doctors/${row.id}`)}
          >
            {t("doctors.openSchedule")}
          </MenuItem>

          {mayEdit && (
            <MenuItem
              icon="edit"
              data-testid="doctor-edit"
              onSelect={() => {
                setFormDoctor(row);
                setFormOpen(true);
              }}
            >
              {t("common.edit")}
            </MenuItem>
          )}

          {mayDelete && row.userId !== currentUser?.id && (
            <MenuItem
              icon="trash"
              tone="danger"
              data-testid="doctor-delete"
              onSelect={() => setDeleting(row)}
            >
              {t("doctors.delete")}
            </MenuItem>
          )}
        </RowMenu>
      ),
    });

    return base;
  }, [t, mayEdit, mayDelete, navigate, currentUser?.id]);

  const data = query.data;

  return (
    <div data-testid="doctors-page" className="flex flex-col gap-5">
      <PageHeader
        data-testid="doctors-header"
        title="doctors.title"
        subtitle="doctors.subtitle"
        primaryAction={
          mayCreate ? (
            <Button
              icon={<Icon name="user-plus" />}
              data-testid="doctors-create"
              onClick={() => {
                setFormDoctor(null);
                setFormOpen(true);
              }}
            >
              {t("doctors.create")}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          data-testid="doctors-search"
          className="w-full min-w-0 sm:max-w-md"
          label={t("common.search")}
          shortcut="/"
          placeholder={t("doctors.searchPlaceholder")}
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

        {query.data !== undefined && (
          <TotalBadge data-testid="doctors-count" className="ms-auto" total={query.data.total} />
        )}
      </div>

      <Table
        data-testid="doctors-table"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isPending}
        isRefreshing={isRefetching(query)}
        empty={
          <EmptyState
            icon="stethoscope"
            data-testid="doctors-empty"
            title="doctors.empty"
            hint="doctors.emptyHint"
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

      <DoctorFormModal
        data-testid="doctor-form-modal"
        open={formOpen}
        onOpenChange={setFormOpen}
        doctor={formDoctor}
        onVisitingCreated={(doctor) => navigate(`/doctors/${doctor.id}`)}
      />

      <ConfirmDialog
        data-testid="doctor-delete-confirm"
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="doctors.deleteTitle"
        titleValues={{ name: deleting ? personName(deleting.user.name, i18n.language) : "" }}
        consequences={[
          t("doctors.deleteSignIn"),
          t("doctors.deleteBooking"),
          t("doctors.deleteKeeps"),
        ]}
        confirmLabel="doctors.delete"
        onConfirm={async () => {
          if (!deleting) {
            return;
          }

          try {
            await removeDoctor.mutateAsync(deleting.id);
            toast.success("doctors.deleted");
          } catch (error) {
            toast.error(...errorToast(error));
            throw error;
          }
        }}
      />
    </div>
  );
}
