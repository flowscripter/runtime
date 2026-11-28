import type { DataCollection, DataEntry, Datastore } from "@flowscripter/plugin-api";

export interface MemoryDatastore extends Datastore {
  add(entry: DataEntry): void;
  remove(entry: DataEntry): boolean;
}

async function* iterate(entries: Set<DataEntry>): AsyncGenerator<DataEntry> {
  // the snapshot is taken when iteration starts, so mutation during iteration is safe
  const snapshot = Array.from(entries);
  for (const entry of snapshot) {
    yield entry;
  }
}

/** In-memory collection: `add` is idempotent per entry object; iteration is in insertion order. */
export function createDataCollection(): DataCollection {
  const entries = new Set<DataEntry>();
  return {
    getAll: () => iterate(entries),
    async add(entry) {
      entries.add(entry);
    },
    async remove(entry) {
      return entries.delete(entry);
    },
  };
}

export function createMemoryDatastore(): MemoryDatastore {
  const entries = new Set<DataEntry>();
  return {
    config: undefined,
    getAllDataEntries: () => iterate(entries),
    add(entry) {
      entries.add(entry);
    },
    remove: (entry) => entries.delete(entry),
  };
}
