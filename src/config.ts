import type { LogLevel } from "@flowscripter/plugin-api";

export const LOG_LEVELS: ReadonlyArray<LogLevel> = ["debug", "info", "warn", "error", "silent"];

const KNOWN_KEYS = ["logLevel", "components"];

export interface RuntimeConfig {
  readonly logLevel?: LogLevel;
  /** Opaque per-component config keyed by component handle; validated by each component. */
  readonly components?: Readonly<Record<string, unknown>>;
}

export interface ResolvedConfig {
  readonly config: Readonly<RuntimeConfig>;
  readonly unknownKeys: ReadonlyArray<string>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function copyAndFreeze(value: unknown, path: string, ancestors: unknown[]): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Config value at ${path} must be a finite number`);
    }
    return value;
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    if (ancestors.includes(value)) {
      throw new TypeError(`Config value at ${path} is circular`);
    }
    ancestors.push(value);
    let copy: unknown;
    if (Array.isArray(value)) {
      copy = value.map((item, i) => copyAndFreeze(item, `${path}[${i}]`, ancestors));
    } else {
      const obj: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        obj[key] = copyAndFreeze(value[key], `${path}.${key}`, ancestors);
      }
      copy = obj;
    }
    ancestors.pop();
    return Object.freeze(copy);
  }
  throw new TypeError(`Config value at ${path} must be plain data (got ${typeof value})`);
}

/**
 * Validate and deep-copy a host supplied config into a deep-frozen snapshot.
 * The input object is never retained or mutated.
 */
export function resolveConfig(input: unknown): ResolvedConfig {
  if (input === undefined) {
    return { config: Object.freeze({}), unknownKeys: [] };
  }
  if (!isPlainObject(input)) {
    throw new TypeError("Runtime config must be a plain object");
  }
  const { logLevel, components } = input;
  if (logLevel !== undefined && !LOG_LEVELS.includes(logLevel as LogLevel)) {
    throw new TypeError(
      `Invalid logLevel ${JSON.stringify(logLevel)}; allowed values: ${LOG_LEVELS.join(", ")}`,
    );
  }
  if (components !== undefined && !isPlainObject(components)) {
    throw new TypeError("Runtime config 'components' must be a plain object keyed by handle");
  }
  const config: { logLevel?: LogLevel; components?: Readonly<Record<string, unknown>> } = {};
  if (logLevel !== undefined) {
    config.logLevel = logLevel as LogLevel;
  }
  if (components !== undefined) {
    config.components = copyAndFreeze(components, "components", []) as Record<string, unknown>;
  }
  const unknownKeys = Object.keys(input).filter((key) => !KNOWN_KEYS.includes(key));
  return { config: Object.freeze(config), unknownKeys };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => key in b && deepEqual(a[key], b[key]))
    );
  }
  return false;
}
