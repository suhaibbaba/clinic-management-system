const PREFIX = "clinic.notifications.seen.";

export type NotificationCounts = Readonly<Record<string, number | undefined>>;

export type SeenCounts = Readonly<Record<string, number>>;

const known = (counts: NotificationCounts): [string, number][] =>
  Object.entries(counts).filter((entry): entry is [string, number] => entry[1] !== undefined);

export function unseenCount(counts: NotificationCounts, seen: SeenCounts): number {
  return known(counts).reduce(
    (sum, [key, count]) => sum + count - Math.min(seen[key] ?? 0, count),
    0,
  );
}

export function settleSeen(counts: NotificationCounts, seen: SeenCounts): SeenCounts {
  const lowered = known(counts).filter(([key, count]) => (seen[key] ?? 0) > count);

  return lowered.length === 0 ? seen : { ...seen, ...Object.fromEntries(lowered) };
}

export function markAllSeen(counts: NotificationCounts, seen: SeenCounts): SeenCounts {
  return { ...seen, ...Object.fromEntries(known(counts)) };
}

export function readSeen(userId: string): SeenCounts {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFIX + userId) ?? "null");

    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isInteger(entry[1]) && entry[1] >= 0,
      ),
    );
  } catch {
    return {};
  }
}

export function writeSeen(userId: string, seen: SeenCounts): void {
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(seen));
  } catch {}
}
