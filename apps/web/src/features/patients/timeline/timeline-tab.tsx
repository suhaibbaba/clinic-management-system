import {
  LOOKUP_LIST,
  TIMELINE_ENTRY_TYPE,
  type LabOrderStatus,
  type TimelineEntry,
  type TimelineEntryType,
} from '@clinic/shared';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge, EmptyState, Icon, Ltr, type IconName } from '@web/components/ui';
import { SkeletonTimeline } from '@web/components/ui/skeleton';
import { useLookupLabels } from '@web/features/lookups/queries';
import { LAB_ORDER_STATUS_STYLES } from '@web/features/labs/status';
import { usePatientTimeline } from '@web/features/patients/queries';
import { formatDate } from '@web/lib/format';
import { useDelayedLoading } from '@web/lib/use-delayed-loading';

const ICONS: Record<TimelineEntryType, IconName> = {
  [TIMELINE_ENTRY_TYPE.VISIT]: 'stethoscope',
  [TIMELINE_ENTRY_TYPE.PROCEDURE]: 'tooth',
  [TIMELINE_ENTRY_TYPE.ATTACHMENT]: 'image',
  [TIMELINE_ENTRY_TYPE.PRESCRIPTION]: 'file',
  [TIMELINE_ENTRY_TYPE.TREATMENT_PLAN]: 'clipboard',
  [TIMELINE_ENTRY_TYPE.LAB_ORDER]: 'coins',
  [TIMELINE_ENTRY_TYPE.SUPPLY]: 'clipboard',
  [TIMELINE_ENTRY_TYPE.APPOINTMENT]: 'calendar',
  [TIMELINE_ENTRY_TYPE.PAYMENT]: 'money',
  [TIMELINE_ENTRY_TYPE.CHARGE]: 'money',
};

// The API merges the streams and decides which this role may see, so a receptionist's timeline is
// simply shorter rather than filtered here.
export function TimelineTab({ patientId }: { readonly patientId: string }): JSX.Element {
  const timeline = usePatientTimeline(patientId);

  const entries = timeline.data?.items ?? [];
  const showSkeleton = useDelayedLoading(timeline.isPending);

  if (showSkeleton) {
    return <SkeletonTimeline />;
  }

  if (timeline.isPending) {
    return <></>;
  }

  if (timeline.isError) {
    return <EmptyState icon="alert" title="errors.generic" hint="patients.timeline.loadFailed" />;
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="clipboard"
        title="patients.timeline.empty"
        hint="patients.timeline.emptyHint"
      />
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={`${entry.type}-${entry.id}`}>
          <Row entry={entry} />
        </li>
      ))}
    </ol>
  );
}

function Row({ entry }: { readonly entry: TimelineEntry }): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 rounded-card bg-surface p-3 shadow-card">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-panel bg-inset">
        <Icon name={ICONS[entry.type]} className="size-4 text-ink-muted" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-value font-medium text-ink">{entry.title}</span>
          <Badge tone="neutral">{t(`patients.timeline.types.${entry.type}`)}</Badge>
          <LabOrderChips entry={entry} />
        </div>

        <Detail entry={entry} />
      </div>

      <Ltr className="shrink-0 text-label tabular-nums text-ink-subtle">
        {formatDate(entry.occurredAt)}
      </Ltr>
    </div>
  );
}

function LabOrderChips({ entry }: { readonly entry: TimelineEntry }): JSX.Element | null {
  const { t } = useTranslation();

  if (entry.type !== TIMELINE_ENTRY_TYPE.LAB_ORDER) {
    return null;
  }

  const status = entry.detail['status'] as LabOrderStatus | undefined;
  const style = status ? LAB_ORDER_STATUS_STYLES[status] : undefined;

  return style ? <Badge tone={style.tone}>{t(style.label)}</Badge> : null;
}

function Detail({ entry }: { readonly entry: TimelineEntry }): JSX.Element | null {
  const { t } = useTranslation();
  const unitLabel = useLookupLabels(LOOKUP_LIST.ITEM_UNIT);

  if (entry.type === TIMELINE_ENTRY_TYPE.LAB_ORDER) {
    const teeth = (entry.detail['teeth'] as number[] | undefined) ?? [];
    const labName = entry.detail['labName'] as string | undefined;

    return (
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-label text-ink-muted">
        {labName}
        {teeth.length > 0 && <Ltr className="tabular-nums">{teeth.join(' · ')}</Ltr>}
      </p>
    );
  }

  if (entry.type === TIMELINE_ENTRY_TYPE.SUPPLY) {
    // What was used, in its own unit — the ledger's minus sign is an
    // accounting detail, not part of the story.
    const quantity = entry.detail['quantity'] as string | undefined;
    const unit = entry.detail['unit'] as string | undefined;

    return (
      <p className="mt-0.5 text-label text-ink-muted">
        <Ltr className="tabular-nums">{quantity}</Ltr> {unitLabel(unit ?? null)}
      </p>
    );
  }

  const complaint = entry.detail['complaint'] as string | undefined;

  return complaint ? (
    <p className="mt-0.5 truncate text-label text-ink-muted">{complaint}</p>
  ) : (
    <p className="sr-only">{t(`patients.timeline.types.${entry.type}`)}</p>
  );
}
