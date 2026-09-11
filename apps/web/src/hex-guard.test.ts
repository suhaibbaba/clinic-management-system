import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const repoRoot = resolve(__dirname, '../../..');
const checker = join(repoRoot, 'scripts/check-hex.mjs');

// A lint nobody has watched fail is a lint that may not be running. This plants a literal, proves
// the checker rejects it, and takes it away again.
describe('the hex-literal check', () => {
  let planted: string | null = null;

  afterEach(async () => {
    if (planted) {
      await rm(planted, { force: true });
      planted = null;
    }
  });

  it('passes on the repository as it stands', async () => {
    const { stdout } = await run('node', [checker], { cwd: repoRoot });

    expect(stdout).toContain('no colour literal outside the token file');
  });

  it('fails on a colour named outside the token file', async () => {
    planted = join(repoRoot, 'apps/web/src/hex-guard-fixture.tsx');
    await writeFile(planted, "export const shade = 'text-[#ff00ff]';\n");

    await expect(run('node', [checker], { cwd: repoRoot })).rejects.toMatchObject({ code: 1 });
  });

  it('fails when an entry document drifts off the brand token', async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'hex-'));

    try {
      await mkdir(join(scratch, 'apps/web/src'), { recursive: true });
      await mkdir(join(scratch, 'apps/web/public'), { recursive: true });
      await mkdir(join(scratch, 'scripts'), { recursive: true });
      await cp(checker, join(scratch, 'scripts/check-hex.mjs'));
      await writeFile(
        join(scratch, 'apps/web/src/theme.css'),
        '@theme static {\n  --color-primary-600: #1b6f97;\n}\n',
      );
      await writeFile(
        join(scratch, 'apps/web/index.html'),
        '<meta name="theme-color" content="#316c9c" />\n',
      );
      await writeFile(join(scratch, 'apps/web/booking.html'), '<html></html>\n');
      await writeFile(join(scratch, 'apps/web/public/favicon.svg'), '<svg></svg>\n');

      await expect(
        run('node', [join(scratch, 'scripts/check-hex.mjs')], { cwd: scratch }),
      ).rejects.toMatchObject({ code: 1 });
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  });
});
