import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Two implementations of one rule — the script and the deploy's `awk` — so this runs both and
// compares. Invoked, not imported, because invoking is what the deploy does.
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
