#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] ?? "all";

if (!["api", "web", "all"].includes(target)) {
  console.error(`Usage: node scripts/dev.mjs [api|web|all] — got "${target}"`);
  process.exit(1);
}

const children = [];

function run(command, args, cwd = root) {
  const child = spawn(command, args, { cwd, stdio: "inherit" });

  children.push(child);
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      shutdown(code);
    }
  });
}

function shutdown(code = 0) {
  for (const child of children) {
    child.kill("SIGTERM");
  }

  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (target !== "web") {
  for (const pkg of ["@clinic/shared", "@clinic/api"]) {
    const build = spawnSync("pnpm", ["--filter", pkg, "build"], { cwd: root, stdio: "inherit" });

    if (build.status !== 0) {
      process.exit(build.status ?? 1);
    }
  }

  run("pnpm", ["--filter", "@clinic/shared", "dev"]);
  run("pnpm", ["--filter", "@clinic/api", "dev"]);
  run(
    "node",
    [
      "--watch-preserve-output",
      "--watch-path=dist",
      "--watch-path=../../packages/shared/dist",
      "dist/main.js",
    ],
    join(root, "apps/api"),
  );
}

if (target !== "api") {
  run("pnpm", ["--filter", "@clinic/web", "dev"]);
}
