import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BUILDS = ["/repo/packages/shared/dist", "/repo/apps/api/dist"];
const RAW_ALIAS = /require\("@(?:shared|api)\//;
const POLL_MS = 200;
const SETTLE_MS = 1500;

const javascriptFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return javascriptFiles(path);
    return entry.name.endsWith(".js") ? [path] : [];
  });

const latestWrite = (files) => Math.max(0, ...files.map((file) => statSync(file).mtimeMs));

const ready = () => {
  try {
    const files = BUILDS.flatMap(javascriptFiles);

    return (
      Date.now() - latestWrite(files) >= SETTLE_MS &&
      !files.some((file) => RAW_ALIAS.test(readFileSync(file, "utf8")))
    );
  } catch {
    return false;
  }
};

const start = () => {
  if (!ready()) {
    setTimeout(start, POLL_MS);
    return;
  }

  void import("/repo/apps/api/dist/main.js");
};

start();
