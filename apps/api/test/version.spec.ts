import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { APP_VERSION } from '@clinic/shared';

/**
 * The version exists in five places: the root manifest, three workspace
 * manifests, and one TypeScript constant the apps import. That is four copies
 * of one fact, and a copy is a chance to diverge.
 *
 * `scripts/sync-version.mjs` writes them all from the root. This is what makes
 * forgetting to run it a failed build rather than a screen quoting a version
 * that was current three releases ago.
 */
const ROOT = join(__dirname, '..', '..', '..');

const manifestVersion = (path: string): string =>
  (JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as { version: string }).version;

describe('version', () => {
  const root = manifestVersion('package.json');

  it('is semver', () => {
    expect(root).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
  });

  it.each(['apps/api/package.json', 'apps/web/package.json', 'packages/shared/package.json'])(
    'is the root version in %s',
    (path) => {
      expect(manifestVersion(path)).toBe(root);
    },
  );

  /* The one the apps actually display, and the one a stale copy would show. */
  it('is the root version in the constant both apps import', () => {
    expect(APP_VERSION).toBe(root);
  });
});
