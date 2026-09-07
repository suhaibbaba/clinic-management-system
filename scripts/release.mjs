#!/usr/bin/env node
/**
 * Decides what the next release is, and writes it.
 *
 * The rule is one line: **every merge to main is a minor release.** No
 * conventional-commit parsing, no bump levels to argue about at merge time —
 * the number goes up by one in the middle position and the release notes say
 * what changed.
 *
 * With one deliberate exception, which is also what bootstraps it: if the
 * version currently in `package.json` has **no tag yet**, that version is the
 * release and nothing is bumped. So the first run releases whatever the
 * manifest says (1.0.0), and — more usefully — anyone who needs a major can
 * simply set the version in their pull request and have that released as
 * written, instead of this script overruling them a minute after the merge.
 *
 * Prints `version=X.Y.Z` and `bumped=true|false` to `$GITHUB_OUTPUT` when the
 * workflow is running it, and to stdout either way.
 *
 * Usage: node scripts/release.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'package.json');
const DRY_RUN = process.argv.includes('--dry-run');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** True when `v<version>` is already a tag in this repository. */
function released(version) {
  try {
    git('rev-parse', '-q', '--verify', `refs/tags/v${version}`);
    return true;
  } catch {
    return false;
  }
}

function nextMinor(version) {
  const [major, minor] = version.split('.').map(Number);

  if (!Number.isInteger(major) || !Number.isInteger(minor)) {
    throw new Error(`Cannot bump a version that is not semver: ${version}`);
  }

  return `${major}.${minor + 1}.0`;
}

const source = readFileSync(MANIFEST, 'utf8');
const current = JSON.parse(source).version;

const bumped = released(current);
const version = bumped ? nextMinor(current) : current;

if (bumped && !DRY_RUN) {
  // A targeted replace rather than re-serialising: the diff of a release
  // commit should be the version and nothing else.
  writeFileSync(MANIFEST, source.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`), 'utf8');
  execFileSync('node', [join(ROOT, 'scripts', 'sync-version.mjs')], { stdio: 'inherit' });
}

console.log(
  bumped
    ? `release: v${current} is already tagged — releasing v${version}.`
    : `release: v${current} has no tag yet — releasing it as it stands.`,
);

const output = process.env['GITHUB_OUTPUT'];

if (output) {
  appendFileSync(output, `version=${version}\nbumped=${bumped}\n`);
}
