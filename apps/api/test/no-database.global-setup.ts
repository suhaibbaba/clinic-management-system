// For suites that compile the app but never query it — the live assistant eval.
export default async function noDatabase(): Promise<void> {
  // Nothing to migrate: nothing is read or written.
}
