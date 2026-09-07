import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The version is `<major>.<minor>` from the root manifest plus the commit
 * count, and it is worked out in two places: `scripts/app-version.mjs`, which
 * the deploy prefers, and a few lines of `awk` in the deploy workflow for a
 * machine with no node on it. Two implementations of one rule is a chance for
 * them to disagree, so this runs both and compares.
 *
 * The script is invoked rather than imported, because invoking it is what the
 * deploy does — `APP_VERSION="$(node scripts/app-version.mjs)"` — and a test
 * that imported the functions would not notice the day it started printing
 * something extra alongside the number.
 */
const ROOT = join(__dirname, '..', '..', '..');

const run = (command: string, args: readonly string[]): string =>
  execFileSync(command, [...args], { cwd: ROOT, encoding: 'utf8' }).trim();

const fromScript = (): string => run('node', ['scripts/app-version.mjs']);

const fromShell = (): string => {
  const base = run('awk', [
    '-F"',
    '/"version"[[:space:]]*:/ { split($4, v, "."); print v[1] "." v[2]; exit }',
    'package.json',
  ]);

  return `${base || '0.0'}.${run('git', ['rev-list', '--count', 'HEAD'])}`;
};

describe('app version', () => {
  it('is the manifest major and minor, then the commit count', () => {
    const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      version: string;
    };
    const [major, minor] = version.split('.');
    const count = run('git', ['rev-list', '--count', 'HEAD']);

    expect(fromScript()).toBe(`${major}.${minor}.${count}`);
  });

  it('prints the version and nothing else', () => {
    expect(fromScript()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  /* The deploy falls back to this on a VPS with no node installed. */
  it('is the same number the deploy would work out in shell', () => {
    expect(fromShell()).toBe(fromScript());
  });
});
