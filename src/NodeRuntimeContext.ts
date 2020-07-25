/**
 * @module @flowscripter/runtime
 */

import debug from 'debug';
import {
    RuntimeContext,
    Registry,
    DatastoreManager,
    SessionManager
} from '@flowscripter/plugin-api';
import InMemoryDatastoreManager from './InMemoryDatastoreManager';
import InMemoryRegistry from './InMemoryRegistry';
import InMemorySessionManager from './InMemorySessionManager';

/**
 * Implementation of a [[RuntimeContext]] suitable for a Node based [[Runtime]] instance.
 */
export default class NodeRuntimeContext implements RuntimeContext {

    protected readonly log: debug.Debugger = debug('NodeRuntimeContext');

    public readonly registry: Registry;

    public readonly datastoreManager: DatastoreManager;

    public readonly sessionManager: SessionManager;

    /**
     * Constructor.
     *
     * @param registry an optional [[Registry]] implementation to use. Default is to use [[InMemoryRegistry]].
     * @param datastoreManager an optional [[DatastoreManager]] implementation to use. Default is to use
     * [[InMemoryDatastoreManager]].
     * @param sessionManager an optional [[SessionManager]] implementation to use. Default is to use
     * [[InMemorySessionManager]].
     */
    public constructor(registry?: Registry, datastoreManager?: DatastoreManager, sessionManager?: SessionManager) {
        this.registry = registry || new InMemoryRegistry();
        this.datastoreManager = datastoreManager || new InMemoryDatastoreManager();
        this.sessionManager = sessionManager || new InMemorySessionManager();
    }
}
