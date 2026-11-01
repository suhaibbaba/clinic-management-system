import { useCallback, useEffect, useState } from "react";
import {
  markAllSeen,
  readSeen,
  settleSeen,
  unseenCount,
  writeSeen,
  type NotificationCounts,
  type SeenCounts,
} from "@web/shared/lib/seen-notifications";

export interface SeenNotifications {
  readonly unseen: number;
  readonly markAllRead: () => void;
}

export function useSeenNotifications(
  userId: string | null,
  counts: NotificationCounts,
): SeenNotifications {
  const [seen, setSeen] = useState<SeenCounts>(() => (userId ? readSeen(userId) : {}));

  useEffect(() => {
    setSeen(userId ? readSeen(userId) : {});
  }, [userId]);

  const settled = settleSeen(counts, seen);

  useEffect(() => {
    if (userId && settled !== seen) {
      writeSeen(userId, settled);
      setSeen(settled);
    }
  }, [userId, settled, seen]);

  const markAllRead = useCallback(() => {
    const next = markAllSeen(counts, settled);

    if (userId) {
      writeSeen(userId, next);
    }

    setSeen(next);
  }, [userId, counts, settled]);

  return { unseen: unseenCount(counts, settled), markAllRead };
}
