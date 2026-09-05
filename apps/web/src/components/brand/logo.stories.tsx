import type { Meta, StoryObj } from '@storybook/react-vite';

import { Logo } from '@web/components/brand/logo';

const meta = {
  title: 'Design language/Logo',
  component: Logo,
  parameters: {
    docs: {
      description: {
        component:
          'One import of apps/web/src/assets/logo.svg, used at three named sizes: sm in the ' +
          'sidebar header, md on the print letterhead, lg on the login page. Replacing the ' +
          'asset file changes every placement at once.',
      },
    },
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-8">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Logo size={size} />
          <span className="font-mono text-xs text-ink-subtle">{size}</span>
        </div>
      ))}
    </div>
  ),
};

/** How it reads in the sidebar, beside the app name. */
export const InSidebarHeader: Story = {
  name: 'In the sidebar header',
  render: () => (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3">
      <Logo size="sm" />
      <span className="text-sm font-semibold text-ink">نظام إدارة العيادة</span>
    </div>
  ),
};
