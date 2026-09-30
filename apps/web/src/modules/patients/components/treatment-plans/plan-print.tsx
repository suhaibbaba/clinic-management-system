import type { Clinic, PerformedProcedure, ProcedureCatalogItem } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { PrintLetterhead } from "@web/shared/components/brand/print-letterhead";
import {
  netPrice,
  newestTreatmentsFirst,
  treatmentTeeth,
  treatmentsTotal,
} from "@web/modules/patients/lib/treatments/treatments";

interface PlanPrintProps {
  readonly treatments: readonly PerformedProcedure[];
  readonly clinic: Clinic | undefined;
  readonly patientName: string;
  readonly fileNumber: string;
  readonly catalog: readonly ProcedureCatalogItem[];
}

export function PlanPrint({
  treatments,
  clinic,
  patientName,
  fileNumber,
  catalog,
}: PlanPrintProps): JSX.Element {
  const { t } = useTranslation();
  const items = newestTreatmentsFirst(treatments);
  const currency = clinic?.currency ?? "";

  const nameOf = (procedureId: string): string =>
    catalog.find((item) => item.id === procedureId)?.name ?? t("chart.panel.procedure");

  return (
    <div data-testid="plan-print" className="print-sheet" dir="rtl" lang="ar">
      <PrintLetterhead clinic={clinic} />

      <h2 data-testid="plan-print-title" className="print-title">
        {t("treatmentPlans.printTitle")}
      </h2>

      <dl data-testid="plan-print-meta" className="print-meta">
        <div>
          <dt>{t("patients.fullName")}</dt>
          <dd>{patientName}</dd>
        </div>
        <div>
          <dt>{t("patients.fileNumber")}</dt>
          <dd dir="ltr">{fileNumber}</dd>
        </div>
      </dl>

      <table data-testid="plan-print-table" className="print-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t("chart.panel.procedure")}</th>
            <th scope="col">{t("treatmentPlans.status")}</th>
            <th scope="col">{t("treatmentPlans.estimatedPrice")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} data-testid={`plan-print-item-${item.id}`}>
              <td dir="ltr">{index + 1}</td>
              <td>
                {nameOf(item.procedureId)}
                {treatmentTeeth(item).length > 0 && (
                  <span dir="ltr"> · {treatmentTeeth(item).join(", ")}</span>
                )}
              </td>
              <td>{t(`chart.procedureStatus.${item.status}`)}</td>
              <td dir="ltr">
                {netPrice(item)} {currency}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              {t("treatmentPlans.total")}
            </th>
            <td dir="ltr">
              {treatmentsTotal(items)} {currency}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className="print-disclaimer">{t("treatmentPlans.printDisclaimer")}</p>

      <div data-testid="plan-print-signature" className="print-signature">
        <span>{t("treatmentPlans.signatureDoctor")}</span>
        <span>{t("treatmentPlans.signaturePatient")}</span>
      </div>
    </div>
  );
}
