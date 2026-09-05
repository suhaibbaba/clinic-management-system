import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge } from '@web/components/ui/badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'مدير' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'success', 'warning', 'danger', 'info'] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = { args: { tone: 'neutral' } };
export const Info: Story = { args: { tone: 'info', children: 'قيد المعالجة' } };
export const Success: Story = { args: { tone: 'success', children: 'مكتمل' } };
export const Warning: Story = { args: { tone: 'warning', children: 'متأخر' } };
export const Danger: Story = { args: { tone: 'danger', children: 'ملغى' } };

/**
 * Success is the only place the logo green appears in the component set, and
 * it appears small — the rule the whole palette is built around.
 */
export const AllTones: Story = {
  name: 'All tones',
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge tone="neutral">محايد</Badge>
      <Badge tone="info">معلومة</Badge>
      <Badge tone="success">نجاح</Badge>
      <Badge tone="warning">تحذير</Badge>
      <Badge tone="danger">خطأ</Badge>
    </div>
  ),
};
