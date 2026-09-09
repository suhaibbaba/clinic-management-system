import type { LabSummary } from '@clinic/shared';
import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  EmptyState,
  EntityCard,
  EntityGrid,
  Icon,
  PageHeader,
  PhoneLink,
  SearchField,
  StatCard,
  StatRow,
} from '@web/components/ui';
import { useClinic } from '@web/features/clinic/queries';
import { LabFormModal } from '@web/features/labs/lab-form-modal';
import { useLabs } from '@web/features/labs/queries';
import { canManageLabs } from '@web/features/labs/permissions';
import { useSession } from '@web/features/auth/session';
import { Money } from '@web/features/billing/money';
import { useDebounced } from '@web/lib/use-debounced';

/**
 * The labs directory.
 *
 * Cards rather than a table: a clinic deals with two or three labs, each is a
 * relationship rather than a row, and the two things anyone wants at a glance
 * — what we owe them and how much of ours they are holding — fit on a card far
 * better than in columns.
 *
 * The balance is money the clinic **owes**, so it is never celebrated in
 * green: a lab balance of zero is the good state, and anything above it is a
 * bill. It is computed on read from the orders and payments; nothing here is
 * stored (CLAUDE.md).
 */
export function LabsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const clinic = useClinic();
  const debounced = useDebounced(search);
  const labs = useLabs({ search: debounced, limit: 50, includeInactive: true });

  const rows = labs.data?.items ?? [];
  const owed = rows.reduce((sum, lab) => sum + Number(lab.balance), 0);
  const openOrders = rows.reduce((sum, lab) => sum + lab.openOrders, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="labs.title"
        subtitle="labs.subtitle"
        actions={
          canManageLabs(user?.role) ? (
            <Button icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
              {t('labs.add')}
            </Button>
          ) : undefined
        }
      />

      {rows.length > 0 && (
        <StatRow>
          <StatCard
            icon="money"
            tone={owed > 0 ? 'warning' : 'success'}
            label={t('labs.kpi.owed')}
            value={<Money amount={owed.toFixed(2)} currency={clinic.data?.currency} />}
            caption={t('labs.kpi.owedCaption')}
          />
          <StatCard
            icon="clipboard"
            tone="primary"
            label={t('labs.kpi.open')}
            value={openOrders}
            caption={t('labs.kpi.openCaption')}
          />
        </StatRow>
      )}

      <SearchField
        className="w-full min-w-0 sm:max-w-md"
        label={t('labs.search')}
        shortcut="/"
        placeholder={t('labs.searchPlaceholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {rows.length === 0 && !labs.isPending ? (
        <EmptyState icon="clipboard" title="labs.empty" hint="labs.emptyHint" />
      ) : (
        <EntityGrid>
          {rows.map((lab) => (
            <LabCard
              key={lab.id}
              lab={lab}
              currency={clinic.data?.currency}
              onOpen={() => void navigate(`/labs/${lab.id}`)}
            />
          ))}
        </EntityGrid>
      )}

      <LabFormModal open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function LabCard({
  lab,
  currency,
  onOpen,
}: {
  readonly lab: LabSummary;
  readonly currency: string | undefined;
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const balance = Number(lab.balance);

  return (
    <EntityCard
      icon="clipboard"
      title={lab.name}
      {...(lab.contactPerson && { subtitle: lab.contactPerson })}
      status={
        lab.isActive
          ? {
              label: t(balance > 0 ? 'labs.owing' : 'labs.settled'),
              tone: balance > 0 ? 'warning' : 'neutral',
            }
          : { label: t('labs.inactive'), tone: 'neutral' }
      }
      meta={[
        {
          label: t('labs.card.balance'),
          value: <Money amount={lab.balance} currency={currency} />,
          ltr: true,
        },
        { label: t('labs.card.open'), value: lab.openOrders, ltr: true },
        ...(lab.phone
          ? [{ label: t('labs.card.phone'), value: <PhoneLink value={lab.phone} /> }]
          : []),
      ]}
      action={{ label: t('labs.card.view'), onClick: onOpen }}
    />
  );
}
