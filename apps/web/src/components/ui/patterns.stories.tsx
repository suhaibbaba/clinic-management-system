import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Card, CardHeader } from '@web/components/ui/card';
import { EntityCard, EntityGrid } from '@web/components/ui/entity-card';
import { ProgressBar } from '@web/components/ui/progress-bar';
import { SegmentedControl } from '@web/components/ui/segmented-control';
import { StatCard, StatRow } from '@web/components/ui/stat-card';

/**
 * The layout patterns the screens are built from.
 *
 * These are the pieces that repeat: the KPI row at the top of a dashboard, the
 * filter pills above a list, the card that stands for one entity in a grid.
 * Seeing them together is the point — they have to look like one family, and
 * a new one has to be checked against these rather than against a screenshot.
 */
const meta = {
  title: 'Patterns/Layout',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Four numbers across the top of a screen.
 *
 * A delta's colour comes from whether the news is good, never from the arrow's
 * direction: overdue debt falling is green while pointing down.
 */
export const KpiRow: Story = {
  name: 'KPI row',
  render: () => (
    <StatRow>
      <StatCard
        icon="calendar"
        label="مواعيد اليوم"
        value="24"
        tone="primary"
        caption="٦ في الانتظار"
      />
      <StatCard
        icon="money"
        label="إيراد اليوم"
        value="1,840.00 USD"
        tone="success"
        delta={{ text: '12%', direction: 'up', isGood: true }}
      />
      <StatCard
        icon="alert"
        label="أرصدة متأخرة"
        value="3,120.00 USD"
        tone="danger"
        delta={{ text: '8%', direction: 'down', isGood: true }}
        caption="عن الشهر الماضي"
      />
      <StatCard
        icon="activity"
        label="نسبة الحضور"
        value="92%"
        tone="warning"
        caption="آخر ٣٠ يوماً"
      />
    </StatRow>
  ),
};

/** Pill tabs that filter a list. A radio group, so arrow keys move between them. */
export const Filters: Story = {
  render: function Filters() {
    const [value, setValue] = useState('all');

    return (
      <SegmentedControl
        label="تصفية حسب الحالة"
        value={value}
        onChange={setValue}
        options={[
          { value: 'all', label: 'الكل', count: 18 },
          { value: 'active', label: 'فعّالة', count: 7 },
          { value: 'completed', label: 'مكتملة', count: 9 },
          { value: 'cancelled', label: 'ملغاة', count: 2 },
        ]}
      />
    );
  },
};

/**
 * One card shape for everything with a name, a state and a sense of progress.
 *
 * What "progress" means differs per grid — carried-out items on a plan, stage
 * reached on a lab order, stock against its minimum — which is why the caller
 * supplies both the numbers and the caption. Stock below its minimum uses the
 * danger tone because it is a problem, not because it is a small number.
 */
export const EntityCards: Story = {
  name: 'Entity cards',
  render: () => (
    <EntityGrid>
      <EntityCard
        icon="clipboard"
        title="خطة معالجة لثوية وترميمية"
        subtitle="الطبيب: د. ليلى حداد"
        status={{ label: 'فعّالة', tone: 'info' }}
        progress={{ value: 2, total: 5, label: 'تقدّم الخطة', caption: 'نُفّذ ٢ من ٥' }}
        meta={[
          { label: 'الإجمالي التقديري', value: '335.00 USD', ltr: true },
          { label: 'المتبقّي', value: '250.00 USD', ltr: true },
        ]}
        action={{ label: 'طباعة', icon: 'file', onClick: () => {} }}
      />

      <EntityCard
        icon="tooth"
        title="جسر خزفي — ٤ وحدات"
        subtitle="مخبر الشام للتعويضات"
        status={{ label: 'جاهز', tone: 'success' }}
        progress={{
          value: 3,
          total: 5,
          label: 'مرحلة الطلب',
          caption: 'المرحلة ٣ من ٥ — جاهز للاستلام',
          tone: 'success',
        }}
        meta={[
          { label: 'التسليم', value: '12/09/2026', ltr: true },
          { label: 'التكلفة', value: '180.00 USD', ltr: true },
        ]}
        action={{ label: 'فتح الطلب', onClick: () => {} }}
      />

      <EntityCard
        icon="coins"
        title="قفازات نيتريل — قياس M"
        subtitle="مستودع العيادة"
        status={{ label: 'مخزون منخفض', tone: 'danger' }}
        progress={{
          value: 12,
          total: 50,
          label: 'المخزون مقابل الحد الأدنى',
          caption: '١٢ علبة — الحد الأدنى ٥٠',
          tone: 'danger',
        }}
        meta={[
          { label: 'آخر توريد', value: '02/08/2026', ltr: true },
          { label: 'المورّد', value: 'الشام الطبية' },
        ]}
        action={{ label: 'طلب توريد', icon: 'plus', onClick: () => {} }}
      />
    </EntityGrid>
  ),
};

/**
 * The selection state, which is the same everywhere: a soft primary tint and a
 * 1.5px primary edge. It is drawn as an outline rather than a border so a card
 * does not shift by 1.5px — and nudge its neighbours — when it is picked.
 */
export const Selection: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader title="غير محدّد" subtitle="بطاقة عادية على الأرضية" />
        <p className="text-value text-ink-muted">المحتوى هنا.</p>
      </Card>
      <Card tone="selected">
        <CardHeader title="محدّد" subtitle="الحالة نفسها في كل مكان" />
        <p className="text-value text-ink-muted">المحتوى هنا.</p>
      </Card>
    </div>
  ),
};

/** The bar on its own, at each tone. */
export const Progress: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-5">
      {(
        [
          ['primary', 3, 8, 'تقدّم الخطة'],
          ['success', 5, 5, 'مكتمل'],
          ['warning', 2, 9, 'قارب على النفاد'],
          ['danger', 1, 12, 'تحت الحد الأدنى'],
        ] as const
      ).map(([tone, value, total, label]) => (
        <div key={tone}>
          <p className="mb-2 text-label text-ink-muted">{label}</p>
          <ProgressBar tone={tone} value={value} total={total} label={label} />
        </div>
      ))}
    </div>
  ),
};
