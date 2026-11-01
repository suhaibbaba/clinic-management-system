import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BUILDS = ["/repo/packages/shared/dist", "/repo/apps/api/dist"];
const RAW_ALIAS = /require\("@(?:shared|api)\//;
const POLL_MS = 200;

const javascriptFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return javascriptFiles(path);
    return entry.name.endsWith(".js") ? [path] : [];
  });

const unresolved = () => {
  try {
    return BUILDS.flatMap(javascriptFiles).some((file) =>
      RAW_ALIAS.test(readFileSync(file, "utf8")),
    );
  } catch {
    return true;
  }
};

const start = () => {
  if (unresolved()) {
    setTimeout(start, POLL_MS);
    return;
  }

  void import("/repo/apps/api/dist/main.js");
};

start();
