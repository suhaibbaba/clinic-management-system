#!/usr/bin/env node
// `<major>.<minor>` from the root manifest plus the commit count, so nothing bumps a file or tags.
// A shallow clone reports 1 forever, and the deploy mirrors this arithmetic in shell.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** `1.4.2` → `1.4`. The patch in the manifest is ignored; the count is it. */
export function baseVersion() {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const [major, minor] = String(version).split('.');

  return /^\d+$/.test(major ?? '') && /^\d+$/.test(minor ?? '') ? `${major}.${minor}` : '0.0';
}

// Zero when this is not a git checkout — a tarball, or a Docker build whose context excludes
// `.git`, which is why the deploy passes the answer in.
export function commitCount() {
  try {
    return Number(
      execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim(),
    );
  } catch {
    return 0;
  }
}

export function appVersion() {
  return `${baseVersion()}.${commitCount()}`;
}

/* Run directly: print it and nothing else, so `$(node …)` is the version. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(appVersion());
}
