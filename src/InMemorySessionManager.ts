/**
 * @module @flowscripter/runtime
 */

import { SessionManager, Session } from '@flowscripter/plugin-api';

/**
 * Simple implementation of a [[SessionManager]] using an in-memory map.
 */
export default class InMemorySessionManager implements SessionManager {

    private readonly sessionsByHandle: Map<string, [string, Session]> = new Map();

    /**
     * @inheritdoc
     */
    public getAll(): Iterable<[string, Session]> {
        return this.sessionsByHandle.values();
    }
}
