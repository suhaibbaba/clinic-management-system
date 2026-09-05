import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@web/components/ui/button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'حفظ' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'حذف' } };
export const Loading: Story = { args: { isLoading: true } };
export const Disabled: Story = { args: { disabled: true } };

/**
 * Every variant and size at once — the view that catches a variant drifting
 * away from the others after a token change.
 */
export const AllVariants: Story = {
  name: 'All variants',
  render: () => (
    <div className="flex flex-col gap-4">
      {(['sm', 'md'] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          <span className="w-8 font-mono text-xs text-ink-subtle">{size}</span>
          <Button size={size} variant="primary">
            حفظ
          </Button>
          <Button size={size} variant="secondary">
            إلغاء
          </Button>
          <Button size={size} variant="ghost">
            تعديل
          </Button>
          <Button size={size} variant="danger">
            حذف
          </Button>
          <Button size={size} isLoading>
            جارٍ الحفظ
          </Button>
          <Button size={size} disabled>
            معطّل
          </Button>
        </div>
      ))}
    </div>
  ),
};
