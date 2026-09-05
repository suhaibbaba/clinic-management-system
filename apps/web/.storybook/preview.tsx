import type { Preview } from '@storybook/react-vite';
import { StrictMode } from 'react';

import '@web/i18n';
import '@web/index.css';

/**
 * Every story renders inside the app's own shell conditions: the real
 * stylesheet, the real i18n instance, Arabic and right-to-left by default.
 *
 * A component that is only ever checked left-to-right is a component whose RTL
 * bugs ship, so the direction toolbar starts on `rtl` and English is the
 * deliberate exception rather than the default.
 */
const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|colou?r)$/i, date: /Date$/i } },
    a11y: { test: 'error' },
    backgrounds: {
      options: {
        canvas: { name: 'Canvas', value: 'var(--color-canvas)' },
        surface: { name: 'Surface', value: 'var(--color-surface)' },
      },
    },
  },

  initialGlobals: { backgrounds: { value: 'canvas' } },

  globalTypes: {
    direction: {
      description: 'Text direction',
      toolbar: {
        title: 'Direction',
        items: [
          { value: 'rtl', title: 'RTL (Arabic)' },
          { value: 'ltr', title: 'LTR' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      const dir = (context.globals['direction'] as string) ?? 'rtl';

      return (
        <StrictMode>
          <div dir={dir} lang={dir === 'rtl' ? 'ar' : 'en'} className="p-6 text-ink">
            <Story />
          </div>
        </StrictMode>
      );
    },
  ],
};

export default preview;
