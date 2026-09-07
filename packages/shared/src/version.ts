/**
 * The product's version, as one string both apps read.
 *
 * The source of truth is the root `package.json`; this file is written from it
 * by `scripts/sync-version.mjs`, which the release automation runs. It is
 * checked in rather than generated at build time so a clean checkout
 * typechecks without a build step having run first — and `version.spec.ts`
 * fails the build if the two ever disagree, which is what makes a second copy
 * safe to keep.
 *
 * Not an environment variable. A version read from the environment is a
 * version somebody can forget to set, and then the number on the screen is
 * whatever the last deploy happened to export — which is worse than no number
 * at all, because it is believed.
 */
export const APP_VERSION = '1.0.0';
