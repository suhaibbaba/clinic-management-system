import { AsyncLocalStorage } from "node:async_hooks";
import type { Database, Transaction } from "@api/database/database.module";

interface UnitOfWork {
  readonly tx: Transaction;
  readonly rehearsal: boolean;
  readonly afterCommit: (() => Promise<void>)[];
}

const current = new AsyncLocalStorage<UnitOfWork>();

class Rehearsed extends Error {}

export function joinUnitOfWork(db: Database): Database {
  return new Proxy(db, {
    get(target, property) {
      const source = current.getStore()?.tx ?? target;
      const value: unknown = Reflect.get(source, property);

      return typeof value === "function" ? (value as () => unknown).bind(source) : value;
    },
  });
}

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

export async function afterCommit(effect: () => Promise<void>): Promise<void> {
  const work = current.getStore();

  if (!work) {
    return effect();
  }

  if (!work.rehearsal) {
    work.afterCommit.push(effect);
  }
}
