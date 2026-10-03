import { subtractMoney, type Clinic, type DoctorSettlement } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { PrintLetterhead } from "@web/shared/components/brand/print-letterhead";
import { formatDate, moneyText } from "@web/shared/lib/format";

export function SettlementPrint({
  settlement,
  clinic,
  doctorName,
}: {
  readonly settlement: DoctorSettlement;
  readonly clinic: Clinic | undefined;
  readonly doctorName: string;
}): JSX.Element {
  const { t } = useTranslation();
  const currency = clinic?.currency;
  const money = (amount: string): string => moneyText(amount, currency);

  return (
    <div data-testid="settlement-print" className="print-sheet" dir="rtl" lang="ar">
      <PrintLetterhead clinic={clinic} title={t("doctors.settlement.printTitle")} />

      <dl className="print-meta">
        <div>
          <dt>{t("visits.doctor")}</dt>
          <dd>{doctorName}</dd>
        </div>
        <div>
          <dt>{t("doctors.settlement.period")}</dt>
          <dd dir="ltr">
            {formatDate(`${settlement.from}T12:00:00Z`)} —{" "}
            {formatDate(`${settlement.to}T12:00:00Z`)}
          </dd>
        </div>
      </dl>

      <table className="print-table">
        <thead>
          <tr>
            <th scope="col">{t("chart.panel.date")}</th>
            <th scope="col">{t("appointments.patient")}</th>
            <th scope="col">{t("chart.panel.procedure")}</th>
            <th scope="col">{t("doctors.settlement.amount")}</th>
            <th scope="col">{t("doctors.settlement.materials")}</th>
            <th scope="col">{t("doctors.settlement.clinicShare")}</th>
            <th scope="col">{t("doctors.settlement.doctorShare")}</th>
          </tr>
        </thead>
        <tbody>
          {settlement.treatments.map((row) => (
            <tr key={row.id}>
              <td dir="ltr">{formatDate(row.performedAt)}</td>
              <td>{row.patientName}</td>
              <td>{row.procedureName}</td>
              <td>{money(subtractMoney(row.price, row.discount))}</td>
              <td>{money(row.materialCost)}</td>
              <td>
                {money(row.clinicShare)} ({row.clinicSharePercent}%)
              </td>
              <td>{money(row.doctorShare)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              {t("doctors.settlement.total")}
            </th>
            <td>{money(settlement.totals.revenue)}</td>
            <td>{money(settlement.totals.materials)}</td>
            <td>{money(settlement.totals.clinicShare)}</td>
            <td>{money(settlement.totals.doctorShare)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={6}>
              {t("doctors.settlement.balance")}
            </th>
            <td>{money(settlement.balance)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="print-signature">
        <span>{t("doctors.settlement.signatureClinic")}</span>
        <span>{t("doctors.settlement.signatureDoctor")}</span>
      </div>
    </div>
  );
}
