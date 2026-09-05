import { fileURLToPath, URL } from 'node:url';

import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook is the design-language reference: every token, every component
 * state, every tooth-chart colour, rendered by the real components against the
 * real theme so the catalogue cannot drift from the app.
 *
 * It is a devDependency only. CLAUDE.md's rule about heavyweight dependencies
 * is about what runs on the VPS — Storybook is never imported by the app, never
 * bundled by `vite build`, and never reaches the runtime image, which is nginx
 * plus the built `dist/`.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)', '../src/**/*.mdx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },

  // No phone-home from a clinic project's toolchain, and no telemetry noise in
  // CI logs.
  core: { disableTelemetry: true },

  // The aliases the app itself uses. Storybook loads vite.config.ts, but that
  // file resolves them relative to itself, so they are restated here rather
  // than assumed.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    resolve: {
      ...viteConfig.resolve,
      alias: {
        ...viteConfig.resolve?.alias,
        '@web': fileURLToPath(new URL('../src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../../../packages/shared/src', import.meta.url)),
        '@clinic/shared': fileURLToPath(
          new URL('../../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    },
  }),
};

export default config;
