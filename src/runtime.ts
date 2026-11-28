import type {
  FlowscripterComponent,
  LogFields,
  Logger,
  LogLevel,
  MetricEvent,
  Output,
  ProgressEvent,
  RuntimeContext,
  Session,
  StructuredValue,
} from "@flowscripter/plugin-api";
import { deepEqual, resolveConfig } from "./config.ts";
import { createMemoryDatastore } from "./data.ts";
import { createComponentRegistry } from "./registry.ts";
import type { ComponentKind } from "./registry.ts";
import { createSession, createSessionManager } from "./session.ts";
import type { RuntimeConfig } from "./config.ts";

export type ConfigChangeListener = (
  next: Readonly<RuntimeConfig>,
  prev: Readonly<RuntimeConfig>,
) => void;

export interface RuntimeOptions {
  /** Already parsed plain object; the runtime performs no I/O. */
  config?: RuntimeConfig;
  logger?: Logger;
  output?: Output;
  onProgress?: (event: ProgressEvent) => void;
  onMetric?: (event: MetricEvent) => void;
  /** Adopted as the session "default"; an empty in-memory session is created if omitted. */
  session?: Session;
}

export const MEMORY_DATASTORE_HANDLE = "memory";
export const DEFAULT_SESSION_HANDLE = "default";

export interface Runtime {
  /** Level-filtered wrapper around the injected logger. */
  readonly logger: Logger;
  readonly output: Output;
  /** The context passed to components, backed by in-memory defaults owned by this runtime. */
  readonly context: RuntimeContext;
  /**
   * Registers a component under a unique handle. Throws on an empty or duplicate handle, an
   * unknown kind, or after `dispose()`.
   */
  registerComponent(handle: string, component: FlowscripterComponent, kind: ComponentKind): void;
  /**
   * Removes a component and calls its optional `dispose()`. Resolves false if the handle is
   * unknown. A throwing `dispose()` is reported via the logger.
   */
  unregisterComponent(handle: string): Promise<boolean>;
  reportProgress(event: ProgressEvent): void;
  reportMetric(event: MetricEvent): void;
  getConfig(): Readonly<RuntimeConfig>;
  getComponentConfig<T = unknown>(handle: string): T | undefined;
  /** Full replacement. Throws `TypeError` on invalid config, keeping the previous config. */
  updateConfig(next: RuntimeConfig): void;
  /** Returns an unsubscribe function. */
  onConfigChange(listener: ConfigChangeListener): () => void;
  /**
   * Stops accepting config changes and registrations, disposes registered components in reverse
   * registration order (errors are logged and do not stop the others), then silences all sinks.
   * Idempotent; the sync part runs before the first await.
   */
  dispose(): Promise<void>;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const DEFAULT_LOG_LEVEL: LogLevel = "info";

function attempt(fn: () => void): void {
  try {
    fn();
  } catch {
    // failures in host supplied sinks must never break callers
  }
}

// Returns a promise only when the component's dispose is asynchronous, so a runtime without
// async components finishes disposal synchronously.
function disposeComponent(
  handle: string,
  component: FlowscripterComponent,
  logger: Logger,
): Promise<void> | undefined {
  const report = (cause: unknown) => logger.error("Component dispose threw", { handle }, cause);
  try {
    const result = component.dispose?.();
    return result ? result.catch(report) : undefined;
  } catch (cause) {
    report(cause);
    return undefined;
  }
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const hostLogger = options.logger;
  const hostOutput = options.output;
  let disposed = false;
  let sinksClosed = false;
  let disposal: Promise<void> | undefined;
  let config = Object.freeze({}) as Readonly<RuntimeConfig>;
  const listeners = new Set<ConfigChangeListener>();
  const pending: Readonly<RuntimeConfig>[] = [];
  let notifying = false;

  const enabled = (level: LogLevel): boolean =>
    !sinksClosed &&
    hostLogger !== undefined &&
    LEVEL_RANK[level] >= LEVEL_RANK[config.logLevel ?? DEFAULT_LOG_LEVEL];

  const logger: Logger = {
    debug(message: string | (() => string), fields?: LogFields) {
      if (enabled("debug")) attempt(() => hostLogger!.debug(message, fields));
    },
    info(message: string, fields?: LogFields) {
      if (enabled("info")) attempt(() => hostLogger!.info(message, fields));
    },
    warn(message: string, fields?: LogFields) {
      if (enabled("warn")) attempt(() => hostLogger!.warn(message, fields));
    },
    error(message: string, fields?: LogFields, cause?: unknown) {
      if (enabled("error")) attempt(() => hostLogger!.error(message, fields, cause));
    },
  };

  const output: Output = {
    write(value: string | StructuredValue) {
      if (!sinksClosed && hostOutput) attempt(() => hostOutput.write(value));
    },
  };

  const forward = <E>(name: string, callback: ((event: E) => void) | undefined, event: E) => {
    if (sinksClosed || !callback) return;
    try {
      callback(event);
    } catch (cause) {
      logger.error(`${name} callback threw`, { callback: name }, cause);
    }
  };

  const warnUnknown = (unknownKeys: ReadonlyArray<string>) => {
    if (unknownKeys.length > 0) {
      logger.warn("Ignoring unknown runtime config keys", { keys: [...unknownKeys] });
    }
  };

  const apply = (next: Readonly<RuntimeConfig>) => {
    const prev = config;
    if (deepEqual(prev, next)) return;
    config = next;
    for (const listener of Array.from(listeners)) {
      try {
        listener(next, prev);
      } catch (cause) {
        logger.error("Config change listener threw", { event: "configChange" }, cause);
      }
    }
  };

  const initial = resolveConfig(options.config);
  config = initial.config;
  warnUnknown(initial.unknownKeys);

  const components = createComponentRegistry();
  const sessionManager = createSessionManager();
  components.register(MEMORY_DATASTORE_HANDLE, createMemoryDatastore(), "datastore");
  const session = options.session ?? createSession();
  sessionManager.adopt(DEFAULT_SESSION_HANDLE, session);

  const runtime: Runtime = {
    logger,
    output,
    context: {
      logger,
      output,
      reportProgress: (event) => runtime.reportProgress(event),
      reportMetric: (event) => runtime.reportMetric(event),
      registry: components.registry,
      datastoreManager: components.datastoreManager,
      sessionManager,
      session,
    },
    registerComponent(handle, component, kind) {
      if (disposed) throw new Error("Runtime is disposed");
      components.register(handle, component, kind);
    },
    async unregisterComponent(handle) {
      const component = components.unregister(handle);
      if (!component) return false;
      await disposeComponent(handle, component, logger);
      return true;
    },
    reportProgress(event) {
      forward("onProgress", options.onProgress, event);
    },
    reportMetric(event) {
      forward("onMetric", options.onMetric, event);
    },
    getConfig: () => config,
    getComponentConfig<T = unknown>(handle: string): T | undefined {
      const components = config.components;
      return components && Object.hasOwn(components, handle)
        ? (components[handle] as T)
        : undefined;
    },
    updateConfig(next) {
      if (disposed) throw new Error("Runtime is disposed");
      const resolved = resolveConfig(next);
      warnUnknown(resolved.unknownKeys);
      if (notifying) {
        pending.push(resolved.config);
        return;
      }
      notifying = true;
      try {
        apply(resolved.config);
        while (pending.length > 0 && !disposed) {
          apply(pending.shift()!);
        }
      } finally {
        pending.length = 0;
        notifying = false;
      }
    },
    onConfigChange(listener) {
      if (disposed) throw new Error("Runtime is disposed");
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposal) return disposal;
      disposed = true;
      listeners.clear();
      pending.length = 0;
      const queue = components.drain();
      const step = (from: number): Promise<void> | undefined => {
        for (let i = from; i < queue.length; i++) {
          const pending = disposeComponent(queue[i][0], queue[i][1], logger);
          if (pending) return pending.then(() => step(i + 1));
        }
        sinksClosed = true;
        return undefined;
      };
      disposal = step(0) ?? Promise.resolve();
      return disposal;
    },
  };
  return runtime;
}
