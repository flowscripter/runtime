/**
 * @module @flowscripter/runtime
 */

import { DatastoreManager, Datastore } from '@flowscripter/plugin-api';

/**
 * Simple implementation of a [[DatastoreManager]] using an in-memory map.
 */
export default class InMemoryDatastoreManager implements DatastoreManager {

    private readonly dataStoresByHandle: Map<string, [string, Datastore]> = new Map();

    /**
     * @inheritdoc
     */
    public getAll(): Iterable<[string, Datastore]> {
        return this.dataStoresByHandle.values();
    }
}
