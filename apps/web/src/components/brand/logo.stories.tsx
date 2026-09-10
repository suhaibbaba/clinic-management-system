import type { Meta, StoryObj } from '@storybook/react-vite';

import { Logo } from '@web/components/brand/logo';

const meta = {
  title: 'Design language/Logo',
  component: Logo,
  parameters: {
    docs: {
      description: {
        component:
          'One import of apps/web/src/assets/logo.svg, at three sizes named for where they ' +
          'are used: chrome across the rail and the drawer, print on the letterhead, login ' +
          'on the sign-in card. Replacing the asset file changes every placement at once.',
      },
    },
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-8">
      {(['chrome', 'print', 'login'] as const).map((size) => (
        <div key={size} className="flex w-56 flex-col items-center gap-2">
          <Logo size={size} />
          <span className="font-mono text-xs text-ink-subtle">{size}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * How it reads in the rail: the mark alone, across the full width of the band,
 * with the hairline that separates the clinic's own header from the app's list.
 */
export const InTheRail: Story = {
  name: 'In the rail',
  render: () => (
    <div className="w-[236px] bg-canvas">
      <div className="border-b border-line px-3 py-3">
        <Logo size="chrome" />
      </div>
    </div>
  ),
};
