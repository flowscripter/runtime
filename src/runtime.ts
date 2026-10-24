import type {
  DatastoreManager,
  LogFields,
  Logger,
  LogLevel,
  MetricEvent,
  Output,
  ProgressEvent,
  Registry,
  RuntimeContext,
  Session,
  SessionManager,
  StructuredValue,
} from "@flowscripter/plugin-api";
import { deepEqual, resolveConfig } from "./config.ts";
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
  session?: Session;
  registry?: Registry;
  datastoreManager?: DatastoreManager;
  sessionManager?: SessionManager;
}

export interface Runtime {
  /** Level-filtered wrapper around the injected logger. */
  readonly logger: Logger;
  readonly output: Output;
  /**
   * The context passed to components. Throws if `session`, `registry`, `datastoreManager` or
   * `sessionManager` were not supplied in {@link RuntimeOptions}.
   */
  readonly context: RuntimeContext;
  reportProgress(event: ProgressEvent): void;
  reportMetric(event: MetricEvent): void;
  getConfig(): Readonly<RuntimeConfig>;
  getComponentConfig<T = unknown>(handle: string): T | undefined;
  /** Full replacement. Throws `TypeError` on invalid config, keeping the previous config. */
  updateConfig(next: RuntimeConfig): void;
  /** Returns an unsubscribe function. */
  onConfigChange(listener: ConfigChangeListener): () => void;
  dispose(): void;
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

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const hostLogger = options.logger;
  const hostOutput = options.output;
  let disposed = false;
  let config = Object.freeze({}) as Readonly<RuntimeConfig>;
  const listeners = new Set<ConfigChangeListener>();
  const pending: Readonly<RuntimeConfig>[] = [];
  let notifying = false;

  const enabled = (level: LogLevel): boolean =>
    !disposed &&
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
      if (!disposed && hostOutput) attempt(() => hostOutput.write(value));
    },
  };

  const forward = <E>(name: string, callback: ((event: E) => void) | undefined, event: E) => {
    if (disposed || !callback) return;
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

  let context: RuntimeContext | undefined;

  const runtime: Runtime = {
    logger,
    output,
    get context() {
      if (!context) {
        const { session, registry, datastoreManager, sessionManager } = options;
        const missing = (
          [
            ["session", session],
            ["registry", registry],
            ["datastoreManager", datastoreManager],
            ["sessionManager", sessionManager],
          ] as const
        )
          .filter(([, value]) => value === undefined)
          .map(([name]) => name);
        if (missing.length > 0) {
          throw new Error(
            `Runtime context unavailable; options not supplied: ${missing.join(", ")}`,
          );
        }
        context = {
          logger,
          output,
          reportProgress: runtime.reportProgress,
          reportMetric: runtime.reportMetric,
          registry: registry!,
          datastoreManager: datastoreManager!,
          sessionManager: sessionManager!,
          session: session!,
        };
      }
      return context;
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
      disposed = true;
      listeners.clear();
      pending.length = 0;
    },
  };
  return runtime;
}
