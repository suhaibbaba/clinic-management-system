import { AsyncLocalStorage } from "node:async_hooks";
import type { Database, Transaction } from "@api/database/database.module";

interface UnitOfWork {
  readonly tx: Transaction;
  /** A rehearsal always rolls back, so nothing leaves the process while it runs. */
  readonly rehearsal: boolean;
  readonly afterCommit: (() => Promise<void>)[];
}

const current = new AsyncLocalStorage<UnitOfWork>();

class Rehearsed extends Error {}

/**
 * The injected database, routed into the unit of work the call runs inside, if any. Services keep
 * their `this.db`; inside `rehearse` or `commitTogether` every query they make joins the one
 * transaction.
 */
export function joinUnitOfWork(db: Database): Database {
  return new Proxy(db, {
    get(target, property) {
      const source = current.getStore()?.tx ?? target;
      const value: unknown = Reflect.get(source, property);

      return typeof value === "function" ? (value as () => unknown).bind(source) : value;
    },
  });
}

/** Runs `work` against the real services and throws every change away. */
export async function rehearse<TResult>(
  db: Database,
  work: () => Promise<TResult>,
): Promise<TResult> {
  let result: TResult | undefined;

  try {
    await db.transaction(async (tx) => {
      result = await current.run({ tx, rehearsal: true, afterCommit: [] }, work);

      throw new Rehearsed();
    });
  } catch (error) {
    if (!(error instanceof Rehearsed)) {
      throw error;
    }
  }

  return result as TResult;
}

/** All of `work` or none of it; what must leave the process waits for the commit. */
export async function commitTogether<TResult>(
  db: Database,
  work: () => Promise<TResult>,
): Promise<TResult> {
  const afterCommit: (() => Promise<void>)[] = [];
  const result = await db.transaction((tx) =>
    current.run({ tx, rehearsal: false, afterCommit }, work),
  );

  for (const effect of afterCommit) {
    await effect();
  }

  return result;
}

export const inRehearsal = (): boolean => current.getStore()?.rehearsal === true;

/**
 * Runs `effect` now, or once the surrounding unit of work commits; never in a rehearsal. For what
 * cannot be rolled back — a message to a patient.
 */
export async function afterCommit(effect: () => Promise<void>): Promise<void> {
  const work = current.getStore();

  if (!work) {
    return effect();
  }

  if (!work.rehearsal) {
    work.afterCommit.push(effect);
  }
}
