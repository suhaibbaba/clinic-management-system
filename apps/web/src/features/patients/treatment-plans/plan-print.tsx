import type { Clinic, ProcedureCatalogItem, TreatmentPlan } from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { PrintLetterhead } from '@web/components/brand/print-letterhead';

import { planRemaining, planTotal } from '@web/features/patients/treatment-plans/plan-total';

interface PlanPrintProps {
  readonly plan: TreatmentPlan;
  readonly clinic: Clinic | undefined;
  readonly patientName: string;
  readonly fileNumber: string;
  readonly catalog: readonly ProcedureCatalogItem[];
  readonly doctorName: string;
}

/**
 * The plan as it goes to the patient, on paper.
 *
 * It is not a separate route or a popup: the same component is in the page,
 * hidden on screen and revealed for print by `print.css`. One source of truth
 * means the printed quote cannot drift from the one on screen, and there is no
 * second fetch to get wrong.
 *
 * The letterhead comes from clinic settings rather than being hardcoded — this
 * is a multi-clinic system, and a printed quote carries the clinic's own name,
 * contact details and currency.
 */
export function PlanPrint({
  plan,
  clinic,
  patientName,
  fileNumber,
  catalog,
  doctorName,
}: PlanPrintProps): JSX.Element {
  const { t } = useTranslation();
  const items = plan.items ?? [];
  const currency = clinic?.currency ?? '';

  const nameOf = (procedureId: string): string =>
    catalog.find((item) => item.id === procedureId)?.nameAr ?? t('chart.panel.procedure');

  return (
    <div className="print-sheet" dir="rtl" lang="ar">
      <PrintLetterhead clinic={clinic} />

      <h2 className="print-title">{t('treatmentPlans.printTitle')}</h2>

      <dl className="print-meta">
        <div>
          <dt>{t('patients.fullName')}</dt>
          <dd>{patientName}</dd>
        </div>
        <div>
          <dt>{t('patients.fileNumber')}</dt>
          <dd dir="ltr">{fileNumber}</dd>
        </div>
        <div>
          <dt>{t('treatmentPlans.plan')}</dt>
          <dd>{plan.title}</dd>
        </div>
        <div>
          <dt>{t('visits.doctor')}</dt>
          <dd>{doctorName}</dd>
        </div>
      </dl>

      <table className="print-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">{t('chart.panel.procedure')}</th>
            <th scope="col">{t('treatmentPlans.status')}</th>
            <th scope="col">{t('treatmentPlans.estimatedPrice')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id}>
              <td dir="ltr">{index + 1}</td>
              <td>{nameOf(item.procedureId)}</td>
              <td>{t(`treatmentPlans.itemStatus.${item.status}`)}</td>
              <td dir="ltr">
                {item.estimatedPrice} {currency}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3}>
              {t('treatmentPlans.total')}
            </th>
            <td dir="ltr">
              {planTotal(items)} {currency}
            </td>
          </tr>
          <tr>
            <th scope="row" colSpan={3}>
              {t('treatmentPlans.remaining')}
            </th>
            <td dir="ltr">
              {planRemaining(items)} {currency}
            </td>
          </tr>
        </tfoot>
      </table>

      {plan.notes && <p className="print-notes">{plan.notes}</p>}

      <p className="print-disclaimer">{t('treatmentPlans.printDisclaimer')}</p>

      <div className="print-signature">
        <span>{t('treatmentPlans.signatureDoctor')}</span>
        <span>{t('treatmentPlans.signaturePatient')}</span>
      </div>
    </div>
  );
}
