#!/usr/bin/env node
/**
 * Propagates the root `package.json` version to everywhere it is copied.
 *
 * The root manifest is the product's version. Three workspace manifests and
 * one TypeScript constant repeat it, because npm wants a version per package
 * and the apps want one they can import — so this is what keeps the copies
 * from becoming four different answers to the same question.
 *
 * Run by the release automation after it bumps the root version, and by
 * `pnpm version:sync` when a version is edited by hand. `version.spec.ts`
 * fails the build if anything is out of step, so forgetting to run this is
 * caught rather than shipped.
 *
 * Usage: node scripts/sync-version.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

/** Every manifest that repeats the version, root first. */
const MANIFESTS = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
];

const CONSTANT = 'packages/shared/src/version.ts';

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const version = JSON.parse(read(MANIFESTS[0])).version;

if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
  console.error(`The root package.json version is not semver: ${version}`);
  process.exit(1);
}

const drifted = [];

for (const path of MANIFESTS.slice(1)) {
  const source = read(path);
  const current = JSON.parse(source).version;

  if (current === version) {
    continue;
  }

  drifted.push(`${path}  ${current} → ${version}`);

  if (!CHECK) {
    // A targeted replace rather than re-serialising: `JSON.stringify` would
    // reformat a file nobody asked it to reformat, and the diff of a release
    // commit should be the version and nothing else.
    writeFileSync(
      join(ROOT, path),
      source.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`),
      'utf8',
    );
  }
}

const constantSource = read(CONSTANT);
const constant = /APP_VERSION = '([^']*)'/.exec(constantSource)?.[1];

if (constant !== version) {
  drifted.push(`${CONSTANT}  ${constant} → ${version}`);

  if (!CHECK) {
    writeFileSync(
      join(ROOT, CONSTANT),
      constantSource.replace(/(APP_VERSION = ')[^']*'/, `$1${version}'`),
      'utf8',
    );
  }
}

if (drifted.length === 0) {
  console.log(`version: everything says ${version}.`);
  process.exit(0);
}

if (CHECK) {
  console.error(`The version is not the same everywhere (root says ${version}):\n`);
  console.error(drifted.map((line) => `  ${line}`).join('\n'));
  console.error('\nRun `pnpm version:sync`.');
  process.exit(1);
}

console.log(`version: wrote ${version} to ${drifted.length} file(s).`);
