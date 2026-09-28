#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function baseVersion() {
  const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const [major, minor] = String(version).split(".");

  return /^\d+$/.test(major ?? "") && /^\d+$/.test(minor ?? "") ? `${major}.${minor}` : "0.0";
}

export function commitCount() {
  try {
    return Number(
      execFileSync("git", ["rev-list", "--count", "HEAD"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    return 0;
  }
}

export function appVersion() {
  return `${baseVersion()}.${commitCount()}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(appVersion());
}
