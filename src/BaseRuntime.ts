/**
 * @module @flowscripter/runtime-api
 */

import { ConfigParameters, Runtime } from '@flowscripter/plugin-api';
import { PluginManager } from '@flowscripter/esm-dynamic-plugins';
import { Writable, Readable } from 'stream';

/**
 * Interface specifying common configuration for a Flowscripter [[Runtime]].
 */
export default interface BaseRuntime extends Runtime {

    /**
     * Readable to use for stdin.
     */
    readonly stdin: Readable;

    /**
     * Writable to use for stdout.
     */
    readonly stdout: Writable;

    /**
     * Writable to use for stderr.
     */
    readonly stderr: Writable;

    /**
     * Generic configuration parameters to use.
     */
    readonly configParameters: ConfigParameters;

    /**
     * Implementation of an esm-dynamic-plugins PluginManager.
     */
    readonly pluginManager: PluginManager<string>;
}
