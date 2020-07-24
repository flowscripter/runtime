/** global process */

/**
 * @module @flowscripter/runtime
 */

import { Readable, Writable } from 'stream';
import debug from 'debug';
import { RuntimeContext, ConfigParameters } from '@flowscripter/plugin-api';
import { NodePluginManager, PluginManager } from '@flowscripter/esm-dynamic-plugins';
import NodeRuntimeContext from './NodeRuntimeContext';
import BaseRuntime from './BaseRuntime';

/**
 * Node implementation of a [[BaseRuntime]].
 */
export default class NodeRuntime implements BaseRuntime {

    protected readonly log: debug.Debugger = debug('NodeRuntime');

    public readonly runtimeContext: RuntimeContext;

    readonly pluginManager: PluginManager<string>;

    readonly configParameters: ConfigParameters;

    public readonly stdin: Readable;

    public readonly stdout: Writable;

    public readonly stderr: Writable;

    /**
     * Constructor.
     *
     * @param stdin an optional Readable stream to use. If not specified `process.stdin` will be used.
     * @param stdout an optional Writable stream to use. If not specified `process.stdout` will be used.
     * @param stderr an optional Writable stream to use. If not specified `process.stderr` will be used.
     * @param configParameters an optional [[ConfigParameters]] object used to provide configuration to the runtime.
     * If not specified an empty object will be used.
     * @param pluginManager an optional esm-dynamic-plugins PluginManager implementation to use.
     * If not specified a NodePluginManager instance will be used.
     * @param runtimeContext an optional [[RuntimeContext]] to use. If not specified a [[NodeRuntimeContext]] instance
     * will be used.
     */
    public constructor(stdin?: Readable, stdout?: Writable, stderr?: Writable, configParameters?: ConfigParameters,
        pluginManager?: PluginManager<string>, runtimeContext?: RuntimeContext) {
        this.stdin = stdin || process.stdin;
        this.stdout = stdout || process.stdout;
        this.stderr = stderr || process.stderr;
        this.pluginManager = pluginManager || new NodePluginManager();
        this.configParameters = configParameters || {};
        this.runtimeContext = runtimeContext || new NodeRuntimeContext();
    }
}
