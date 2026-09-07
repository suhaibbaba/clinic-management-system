#!/usr/bin/env node
/**
 * The application's version: `<major>.<minor>` from the root `package.json`,
 * plus the repository's commit count.
 *
 * So `1.0` in the manifest and 312 commits reads as **1.0.312**, and it goes
 * up on its own with every commit that reaches the deployed branch. Nothing
 * bumps a file, nothing tags, nothing commits back to the branch — which means
 * there is no release commit for a deploy to race, and no version recorded in
 * git that can disagree with the build it came from.
 *
 * The major and minor stay in `package.json` and stay a human decision: they
 * say what the software is, and the third number says which build of it this
 * is.
 *
 * **A shallow clone reports a commit count of 1 forever.** The deploy
 * unshallows before asking; anything else that calls this should know the
 * number is only meaningful over full history.
 *
 * The deploy workflow mirrors this in shell for a machine with no node on it,
 * so if the arithmetic here changes it has to change there too — `app-version`
 * in `apps/api/test` is what fails when they drift.
 *
 * Usage: node scripts/app-version.mjs
 */
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

/**
 * How many commits are behind HEAD. Zero when this is not a git checkout at
 * all — a tarball, or a Docker build whose context excludes `.git`, which is
 * the case here and the reason the deploy passes the answer in rather than
 * asking the image to work it out.
 */
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
