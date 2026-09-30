import { personName, type Clinic, type Payroll } from "@clinic/shared";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { PrintLetterhead } from "@web/shared/components/brand/print-letterhead";
import { formatMonth, moneyText } from "@web/shared/lib/format";

export function PayrollPrint({
  payroll,
  clinic,
}: {
  readonly payroll: Payroll;
  readonly clinic: Clinic | undefined;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const money = (amount: string): string => moneyText(amount, clinic?.currency);

  return (
    <div data-testid="payroll-print" className="print-sheet" dir="rtl" lang="ar">
      <PrintLetterhead clinic={clinic} />

      <h2 className="print-title">
        {t("payroll.printTitle")} — {formatMonth(payroll.month)}
      </h2>

      <table className="print-table">
        <thead>
          <tr>
            <th scope="col">{t("payroll.employee")}</th>
            <th scope="col">{t("payroll.monthlySalary")}</th>
            <th scope="col">{t("payroll.extras")}</th>
            <th scope="col">{t("payroll.cuts")}</th>
            <th scope="col">{t("payroll.due")}</th>
            <th scope="col">{t("payroll.paidAmount")}</th>
            <th scope="col">{t("payroll.remaining")}</th>
          </tr>
        </thead>
        <tbody>
          {payroll.lines.map((line) => (
            <tr key={line.userId}>
              <td>{personName(line.name, i18n.language)}</td>
              <td>{money(line.base)}</td>
              <td>{money(line.extras)}</td>
              <td>{money(line.cuts)}</td>
              <td>{money(line.due)}</td>
              <td>{money(line.paid)}</td>
              <td>{money(line.remaining)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t("payroll.total")}</th>
            <td>{money(payroll.totals.base)}</td>
            <td>{money(payroll.totals.extras)}</td>
            <td>{money(payroll.totals.cuts)}</td>
            <td>{money(payroll.totals.due)}</td>
            <td>{money(payroll.totals.paid)}</td>
            <td>{money(payroll.totals.remaining)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={6}>
              {t("payroll.visitingShares")}
            </th>
            <td>{money(payroll.visitingShares)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={6}>
              {t("payroll.staffCost")}
            </th>
            <td>{money(payroll.staffCost)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="print-signature">
        <span>{t("payroll.signature")}</span>
      </div>
    </div>
  );
}
