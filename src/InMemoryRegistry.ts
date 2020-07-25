/**
 * @module @flowscripter/runtime
 */

import { Registry, Datastore, DataModel } from '@flowscripter/plugin-api';

/**
 * Simple implementation of a [[Registry]] using an in-memory map.
 */
export default class InMemoryRegistry implements Registry {

    private readonly dataModelsByHandle: Map<string, [string, DataModel]> = new Map();

    private readonly datastoresByHandle: Map<string, [string, Datastore]> = new Map();

    /**
     * @inheritdoc
     */
    public getAllDataModels(): Iterable<[string, DataModel]> {
        return this.dataModelsByHandle.values();
    }

    /**
     * @inheritdoc
     */
    public getAllDatastores(): Iterable<[string, Datastore]> {
        return this.datastoresByHandle.values();
    }
}
