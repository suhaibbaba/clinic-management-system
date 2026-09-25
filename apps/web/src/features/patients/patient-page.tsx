import { Suspense, lazy, type JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Avatar,
  Button,
  Icon,
  Ltr,
  MenuItem,
  PhoneLink,
  RowMenu,
  TabPanel,
  Tabs,
  useConfirm,
  useTabParam,
  useToast,
  WhatsAppLink,
} from "@clinic/ui";
import { Skeleton, SkeletonStatus } from "@clinic/ui/components/skeleton";
import { AppointmentFormModal } from "@web/features/appointments/appointment-form-modal";
import { canBookAppointment } from "@web/features/appointments/permissions";
import { useSession } from "@web/features/auth/session";
import { AccountTab } from "@web/features/billing/account-tab";
import { PatientBalanceCard } from "@web/features/billing/patient-balance-card";
import { canSeeBilling } from "@web/features/billing/permissions";
import { ageInYears } from "@web/features/patients/age";
import { AllergyBanner } from "@web/features/patients/allergy-banner";
import { PatientFormModal } from "@web/features/patients/patient-form-modal";
import { canDeletePatient, canEditPatient, canViewChart } from "@web/features/patients/permissions";
import { PrescriptionsTab } from "@web/features/patients/prescriptions/prescriptions-tab";
import { useDeletePatient, usePatient } from "@web/features/patients/queries";
import { TimelineTab } from "@web/features/patients/timeline/timeline-tab";
import { TreatmentPlansTab } from "@web/features/patients/treatment-plans/treatment-plans-tab";
import { VisitsTab } from "@web/features/patients/visits/visits-tab";
import { useDelayedLoading } from "@clinic/ui/lib/use-delayed-loading";
import { errorMessageKey } from "@web/lib/api-error";
import { whatsAppNumber } from "@web/lib/whatsapp";

const ChartTab = lazy(async () => ({
  default: (await import("@web/features/patients/chart/chart-tab")).ChartTab,
}));

const ImagingTab = lazy(async () => ({
  default: (await import("@web/features/patients/imaging/imaging-tab")).ImagingTab,
}));

const TABS = [
  { id: "chart", label: "patients.tabs.chart", clinical: true },
  { id: "visits", label: "patients.tabs.visits", clinical: true },
  { id: "treatmentPlans", label: "patients.tabs.treatmentPlans", clinical: true },
  { id: "attachments", label: "patients.tabs.attachments", clinical: true },
  { id: "prescriptions", label: "patients.tabs.prescriptions", clinical: true },
  { id: "timeline", label: "patients.tabs.timeline", clinical: true },
  { id: "billing", label: "patients.tabs.billing", clinical: false },
] as const;

type TabId = (typeof TABS)[number]["id"];

// A page number, a page size and a filter belong to the tab they were set in.
const TAB_OWNED_PARAMS = ["page", "perPage", "type", "plan"] as const;

export function PatientPage(): JSX.Element {
  const { t } = useTranslation();
  const { user, can } = useSession();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const deletePatient = useDeletePatient();

  const role = user?.role;
  const tabs = TABS.filter((tab) =>
    tab.clinical ? role && canViewChart(role) : role && canSeeBilling(role),
  );

  // `?tab=` like every other section: in `useState` nobody could link into a patient's X-rays. The
  // list is filtered by role first, so a pasted `?tab=chart` resolves to what the reader may see.
  const [activeTab, setActiveTab] = useTabParam<TabId>(
    "tab",
    tabs.map((tab) => tab.id),
    tabs[0]?.id ?? "billing",
    TAB_OWNED_PARAMS,
  );

  const patient = usePatient(id);
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const showSkeleton = useDelayedLoading(patient.isPending);
  const mayEdit = canEditPatient(can);
  const mayDelete = canDeletePatient(can);

  const { confirm, dialog } = useConfirm("patient-confirm-delete");

  const destroy = (): void => {
    const file = patient.data;

    if (!file) {
      return;
    }

    confirm({
      title: "patients.confirmDelete.title",
      titleValues: { name: file.fullName },
      consequences: [t("patients.confirmDelete.consequence")],
      onConfirm: async () => {
        try {
          await deletePatient.mutateAsync(file.id);
          toast.success("patients.deleted");
          navigate("/patients", { replace: true });
        } catch (error) {
          toast.error(errorMessageKey(error));
          throw error;
        }
      },
    });
  };

  return (
    <div data-testid="patient-page" className="flex flex-col gap-5">
      {dialog}
      {/* The labels are drawn rather than `sr-only`: a file number, an age and a phone read as a
          dot-separated run only if you know the order, and reception reads this aloud. */}
      <header
        data-testid="patient-header"
        className="border border-line rounded-card bg-surface p-4 shadow-card"
      >
        {showSkeleton && <PatientHeaderSkeleton />}

        {patient.isError && (
          <p data-testid="patient-not-found" className="text-value text-danger-600">
            {t("errors.notFound")}
          </p>
        )}

        {patient.data && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={patient.data.fullName}
                  tintKey={id}
                  size={40}
                  data-testid="patient-avatar"
                  className="text-value"
                />

                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <h1
                    data-testid="patient-name"
                    className="truncate text-title font-medium text-primary-900"
                  >
                    {patient.data.fullName}
                  </h1>
                  {/* Beside the name it qualifies, and it appears the moment
                      its own query lands rather than waiting on the record. */}
                  <AllergyBanner patientId={id} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                {canBookAppointment(can) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Icon name="calendar" />}
                    data-testid="patient-book"
                    onClick={() => setBooking(true)}
                  >
                    {t("appointments.create")}
                  </Button>
                )}

                {(mayEdit || mayDelete) && (
                  <RowMenu label={t("patients.rowMenu")} data-testid="patient-menu">
                    {mayEdit && (
                      <MenuItem
                        icon="edit"
                        data-testid="patient-edit"
                        onSelect={() => setEditing(true)}
                      >
                        {t("patients.edit")}
                      </MenuItem>
                    )}
                    {mayDelete && (
                      <MenuItem
                        icon="trash"
                        tone="danger"
                        data-testid="patient-delete"
                        onSelect={destroy}
                      >
                        {t("common.delete")}
                      </MenuItem>
                    )}
                  </RowMenu>
                )}
              </div>
            </div>

            <dl
              data-testid="patient-summary"
              className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 lg:grid-cols-4"
            >
              <div className="min-w-0">
                <dt className="text-value text-ink-muted">{t("patients.fileNumber")}</dt>
                <Ltr
                  as="dd"
                  data-testid="patient-file-number"
                  className="mt-0.5 truncate text-value text-ink tabular-nums"
                >
                  {patient.data.fileNumber}
                </Ltr>
              </div>

              <div className="min-w-0">
                <dt className="text-value text-ink-muted">{t("patients.age")}</dt>
                <dd data-testid="patient-age" className="mt-0.5 truncate text-value text-ink">
                  {patient.data.dateOfBirth
                    ? t("patients.years", { count: ageInYears(patient.data.dateOfBirth) })
                    : "—"}
                </dd>
              </div>

              <div className="min-w-0">
                <dt className="text-value text-ink-muted">{t("patients.phone")}</dt>
                {/* The 44px band is an absolutely positioned `::after`, and an `overflow-hidden`
                    ancestor cuts it down to the line box. */}
                <dd className="mt-0.5 flex min-w-0 flex-col items-start gap-1 text-value text-ink">
                  <PhoneLink value={patient.data.phone} data-testid="patient-phone" />
                  <WhatsAppLink
                    value={whatsAppNumber(patient.data)}
                    label={t("patients.chatOnWhatsapp")}
                    data-testid="patient-whatsapp"
                  />
                </dd>
              </div>

              {role && canSeeBilling(role) && <PatientBalanceCard patientId={id} />}
            </dl>
          </>
        )}
      </header>

      {patient.data && (
        <PatientFormModal
          data-testid="patient-edit-modal"
          open={editing}
          onOpenChange={setEditing}
          patient={patient.data}
        />
      )}

      {patient.data && (
        <AppointmentFormModal
          data-testid="patient-book-modal"
          open={booking}
          onOpenChange={setBooking}
          forPatient={{
            id: patient.data.id,
            fullName: patient.data.fullName,
            phone: patient.data.phone,
            fileNumber: patient.data.fileNumber,
          }}
        />
      )}

      <Tabs
        data-testid="patient-tabs"
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        value={activeTab}
        onChange={setActiveTab}
        label="patients.tabs.label"
      />

      <TabPanel id={activeTab} data-testid="patient-tab-panel">
        {/* The chart and the imaging grid are the two heaviest things in the app — an SVG of 52
            teeth and a lightbox — and most visits to a file never open either. */}
        <Suspense fallback={<TabFallback />}>
          {activeTab === "chart" && (
            <ChartTab
              patientId={id}
              dateOfBirth={patient.data?.dateOfBirth}
              patient={patient.data}
            />
          )}
          {activeTab === "attachments" && <ImagingTab patientId={id} />}
        </Suspense>

        {activeTab === "visits" && <VisitsTab patientId={id} patient={patient.data} />}
        {activeTab === "treatmentPlans" && (
          <TreatmentPlansTab patientId={id} patient={patient.data} />
        )}
        {activeTab === "prescriptions" && <PrescriptionsTab patientId={id} />}
        {activeTab === "timeline" && <TimelineTab patientId={id} />}
        {activeTab === "billing" && <AccountTab patientId={id} patient={patient.data} />}
      </TabPanel>
    </div>
  );
}

function TabFallback(): JSX.Element {
  return <Skeleton aria-hidden="true" className="h-[420px] w-full rounded-card" />;
}

function PatientHeaderSkeleton(): JSX.Element {
  return (
    <>
      <SkeletonStatus />

      <div aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>

          <Skeleton className="h-12 w-32 rounded-panel" />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 lg:grid-cols-3">
          {[0, 1, 2].map((field) => (
            <div key={field} className="min-w-0">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1.5 h-4 w-24" />
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
