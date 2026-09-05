import { Injectable, Logger } from '@nestjs/common';
import type { Money } from '@clinic/shared';

export interface ProcedureBillingEvent {
  readonly clinicId: string;
  readonly patientId: string;
  readonly performedProcedureId: string;
  readonly procedureId: string;
  readonly price: Money;
  readonly discount: Money;
  readonly discountReason: string | null;
  readonly actorId: string;
}

/**
 * Seam between performed procedures and billing.
 *
 * TODO(billing): a performed procedure is what makes a patient owe money, so
 * each of these calls becomes an append-only `charges` row — and a reversing
 * entry rather than an edit when a procedure is amended or soft-deleted
 * (CLAUDE.md architecture decision 2). The patient balance is then
 * sum(charges) − sum(payments) and is never stored.
 *
 * Kept as an explicit collaborator rather than an inline comment so the call
 * sites are already in the right places and the billing module only has to
 * replace this implementation.
 */
@Injectable()
export class BillingEventsService {
  private readonly logger = new Logger(BillingEventsService.name);

  /** TODO(billing): create the charge for a newly recorded procedure. */
  onProcedureRecorded(event: ProcedureBillingEvent): void {
    this.logger.debug(
      `TODO(billing): charge ${event.price} (discount ${event.discount}) for procedure ${event.performedProcedureId}`,
    );
  }

  /** TODO(billing): post a correcting entry when price or discount changes. */
  onProcedureAmended(event: ProcedureBillingEvent): void {
    this.logger.debug(
      `TODO(billing): adjust charge for procedure ${event.performedProcedureId} to ${event.price}`,
    );
  }

  /** TODO(billing): post a reversing entry; charges are never deleted. */
  onProcedureReversed(
    event: Pick<ProcedureBillingEvent, 'clinicId' | 'performedProcedureId' | 'actorId'>,
  ): void {
    this.logger.debug(`TODO(billing): reverse charge for procedure ${event.performedProcedureId}`);
  }
}
