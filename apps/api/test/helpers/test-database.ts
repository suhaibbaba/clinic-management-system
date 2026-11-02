const TEST_SUFFIX = "_test";

export function testDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

  if (!name.endsWith(TEST_SUFFIX)) {
    parsed.pathname = `/${encodeURIComponent(`${name}${TEST_SUFFIX}`)}`;
  }

  return parsed.toString();
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}
