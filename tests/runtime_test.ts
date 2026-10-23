import { describe, expect, mock, test } from "bun:test";
import type { Logger, Output, RuntimeContext } from "@flowscripter/plugin-api";
import { createRuntime } from "../index.ts";

function makeLogger() {
  return {
    debug: mock((_m: string | (() => string), _f?: unknown) => {}),
    info: mock((_m: string, _f?: unknown) => {}),
    warn: mock((_m: string, _f?: unknown) => {}),
    error: mock((_m: string, _f?: unknown, _c?: unknown) => {}),
  } satisfies Logger;
}

describe("defaults", () => {
  test("no options: empty frozen config, silent logger and output", () => {
    const runtime = createRuntime();
    expect(runtime.getConfig()).toEqual({});
    expect(Object.isFrozen(runtime.getConfig())).toBe(true);
    runtime.logger.error("x", undefined, new Error("e"));
    runtime.output.write("x");
    runtime.reportProgress({ id: "1", operation: "op", state: "start" });
    runtime.reportMetric({ name: "m", value: 1 });
    expect(runtime.getComponentConfig("a")).toBeUndefined();
  });
});

describe("logging", () => {
  test("default level is info", () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger });
    runtime.logger.debug("d");
    runtime.logger.info("i", { a: 1 });
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("i", { a: 1 });
  });

  test("filters by configured level", () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger, config: { logLevel: "warn" } });
    runtime.logger.info("i");
    runtime.logger.warn("w");
    runtime.logger.error("e");
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test("silent drops everything", () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger, config: { logLevel: "silent" } });
    runtime.logger.error("e");
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("error passes fields and cause through unchanged", () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger });
    const cause = new Error("boom");
    runtime.logger.error("e", { k: "v" }, cause);
    expect(logger.error).toHaveBeenCalledWith("e", { k: "v" }, cause);
  });

  test("lazy debug is passed through only when enabled", () => {
    const logger = makeLogger();
    const lazy = mock(() => "msg");
    const runtime = createRuntime({ logger });
    runtime.logger.debug(lazy);
    expect(logger.debug).not.toHaveBeenCalled();
    expect(lazy).not.toHaveBeenCalled();
    runtime.updateConfig({ logLevel: "debug" });
    runtime.logger.debug(lazy);
    expect(logger.debug).toHaveBeenCalledWith(lazy, undefined);
  });

  test("level change via updateConfig applies to later calls", () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger });
    runtime.updateConfig({ logLevel: "error" });
    runtime.logger.warn("w");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("throwing host logger and output do not propagate", () => {
    const logger = makeLogger();
    logger.info.mockImplementation(() => {
      throw new Error("x");
    });
    const output: Output = {
      write: () => {
        throw new Error("y");
      },
    };
    const runtime = createRuntime({ logger, output });
    expect(() => runtime.logger.info("i")).not.toThrow();
    expect(() => runtime.output.write("o")).not.toThrow();
  });
});

describe("output", () => {
  test("forwards strings and structured values", () => {
    const write = mock((_v: unknown) => {});
    const runtime = createRuntime({ output: { write } });
    runtime.output.write("text");
    runtime.output.write({ a: [1, null] });
    expect(write.mock.calls).toEqual([["text"], [{ a: [1, null] }]]);
  });
});

describe("progress and metrics", () => {
  test("forwarded to callbacks", () => {
    const onProgress = mock((_e: unknown) => {});
    const onMetric = mock((_e: unknown) => {});
    const runtime = createRuntime({ onProgress, onMetric });
    const p = { id: "1", operation: "op", state: "update", current: 1, total: 2 } as const;
    const m = { name: "n", value: 3, unit: "ms", tags: { a: "b" } };
    runtime.reportProgress(p);
    runtime.reportMetric(m);
    expect(onProgress).toHaveBeenCalledWith(p);
    expect(onMetric).toHaveBeenCalledWith(m);
  });

  test("throwing callbacks are reported via logger.error", () => {
    const logger = makeLogger();
    const err = new Error("cb");
    const throwing = () => {
      throw err;
    };
    const runtime = createRuntime({ logger, onProgress: throwing, onMetric: throwing });
    expect(() => runtime.reportProgress({ id: "1", operation: "o", state: "end" })).not.toThrow();
    expect(() => runtime.reportMetric({ name: "n", value: 1 })).not.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error.mock.calls[0]![2]).toBe(err);
  });
});

describe("config", () => {
  test("snapshot is a deep frozen copy", () => {
    const input = { components: { a: { n: [1, { x: 1 }] } } };
    const runtime = createRuntime({ config: input });
    input.components.a.n.push(2);
    const a = runtime.getComponentConfig<{ n: unknown[] }>("a")!;
    expect(a.n).toEqual([1, { x: 1 }]);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.n)).toBe(true);
    expect(Object.isFrozen(a.n[1])).toBe(true);
  });

  test("getComponentConfig ignores inherited properties", () => {
    const runtime = createRuntime({ config: { components: {} } });
    expect(runtime.getComponentConfig("toString")).toBeUndefined();
  });

  test("invalid logLevel throws TypeError naming allowed values", () => {
    expect(() => createRuntime({ config: { logLevel: "loud" as never } })).toThrow(TypeError);
    expect(() => createRuntime({ config: { logLevel: "loud" as never } })).toThrow(/silent/);
  });

  test("non-plain component values are rejected", () => {
    class C {}
    for (const bad of [() => {}, new C(), new Date(), undefined, Number.NaN, 1n]) {
      expect(() => createRuntime({ config: { components: { a: bad } } })).toThrow(TypeError);
    }
  });

  test("circular component values are rejected", () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => createRuntime({ config: { components: { a } } })).toThrow(/circular/);
  });

  test("non-object config is rejected", () => {
    expect(() => createRuntime({ config: [] as never })).toThrow(TypeError);
    expect(() => createRuntime({ config: { components: [] as never } })).toThrow(TypeError);
  });

  test("unknown keys produce exactly one warning and are dropped", () => {
    const logger = makeLogger();
    const runtime = createRuntime({
      logger,
      config: { a: 1, b: 2, logLevel: "info" } as never,
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]![1]).toEqual({ keys: ["a", "b"] });
    expect(runtime.getConfig()).toEqual({ logLevel: "info" });
    runtime.updateConfig({ c: 1 } as never);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});

describe("updateConfig", () => {
  test("full replacement; listeners receive next and prev", () => {
    const runtime = createRuntime({ config: { logLevel: "debug", components: { a: 1 } } });
    const listener = mock((_n: unknown, _p: unknown) => {});
    runtime.onConfigChange(listener);
    runtime.updateConfig({ components: { b: 2 } });
    expect(runtime.getConfig()).toEqual({ components: { b: 2 } });
    expect(listener).toHaveBeenCalledWith(
      { components: { b: 2 } },
      { logLevel: "debug", components: { a: 1 } },
    );
    expect(runtime.getComponentConfig("a")).toBeUndefined();
  });

  test("no notification when nothing changed", () => {
    const runtime = createRuntime({ config: { components: { a: { x: [1] } } } });
    const listener = mock(() => {});
    runtime.onConfigChange(listener);
    runtime.updateConfig({ components: { a: { x: [1] } } });
    expect(listener).not.toHaveBeenCalled();
  });

  test("invalid update throws and keeps the previous snapshot", () => {
    const runtime = createRuntime({ config: { logLevel: "warn" } });
    const listener = mock(() => {});
    runtime.onConfigChange(listener);
    expect(() => runtime.updateConfig({ logLevel: "nope" as never })).toThrow(TypeError);
    expect(runtime.getConfig()).toEqual({ logLevel: "warn" });
    expect(listener).not.toHaveBeenCalled();
  });

  test("listeners run in registration order and can unsubscribe", () => {
    const runtime = createRuntime();
    const order: string[] = [];
    runtime.onConfigChange(() => order.push("1"));
    const off = runtime.onConfigChange(() => order.push("2"));
    runtime.onConfigChange(() => order.push("3"));
    runtime.updateConfig({ logLevel: "warn" });
    off();
    runtime.updateConfig({ logLevel: "error" });
    expect(order).toEqual(["1", "2", "3", "1", "3"]);
  });

  test("throwing listener is reported and others still run", () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger });
    const err = new Error("l");
    const second = mock(() => {});
    runtime.onConfigChange(() => {
      throw err;
    });
    runtime.onConfigChange(second);
    runtime.updateConfig({ logLevel: "warn" });
    expect(second).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]![2]).toBe(err);
  });

  test("re-entrant update is queued until the current pass completes", () => {
    const runtime = createRuntime();
    const seen: Array<[unknown, unknown]> = [];
    let first = true;
    runtime.onConfigChange((next, prev) => {
      seen.push([next.logLevel, prev.logLevel]);
      if (first) {
        first = false;
        runtime.updateConfig({ logLevel: "error" });
        expect(runtime.getConfig().logLevel).toBe("warn");
      }
    });
    const late = mock((_n: unknown, _p: unknown) => {});
    runtime.onConfigChange(late);
    runtime.updateConfig({ logLevel: "warn" });
    expect(seen).toEqual([
      ["warn", undefined],
      ["error", "warn"],
    ]);
    expect(late.mock.calls.map((c) => c[0])).toEqual([{ logLevel: "warn" }, { logLevel: "error" }]);
  });
});

describe("dispose", () => {
  test("silences logging, output, progress and metrics", () => {
    const logger = makeLogger();
    const write = mock((_v: unknown) => {});
    const onProgress = mock((_e: unknown) => {});
    const onMetric = mock((_e: unknown) => {});
    const runtime = createRuntime({ logger, output: { write }, onProgress, onMetric });
    runtime.dispose();
    runtime.logger.error("e");
    runtime.output.write("o");
    runtime.reportProgress({ id: "1", operation: "o", state: "start" });
    runtime.reportMetric({ name: "n", value: 1 });
    expect(logger.error).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(onMetric).not.toHaveBeenCalled();
  });

  test("updateConfig and onConfigChange throw; getConfig still works", () => {
    const runtime = createRuntime({ config: { logLevel: "warn" } });
    runtime.dispose();
    expect(() => runtime.updateConfig({})).toThrow();
    expect(() => runtime.onConfigChange(() => {})).toThrow();
    expect(runtime.getConfig()).toEqual({ logLevel: "warn" });
  });

  test("listener disposing the runtime stops queued updates", () => {
    const runtime = createRuntime();
    const later = mock(() => {});
    runtime.onConfigChange(() => {
      runtime.updateConfig({ logLevel: "error" });
      runtime.dispose();
    });
    runtime.updateConfig({ logLevel: "warn" });
    expect(later).not.toHaveBeenCalled();
    expect(runtime.getConfig()).toEqual({ logLevel: "warn" });
  });
});

describe("isolation", () => {
  test("two runtimes do not share state", () => {
    const la = makeLogger();
    const lb = makeLogger();
    const a = createRuntime({ logger: la, config: { logLevel: "debug", components: { x: 1 } } });
    const b = createRuntime({ logger: lb });
    a.updateConfig({ logLevel: "silent" });
    b.logger.info("b");
    expect(lb.info).toHaveBeenCalledTimes(1);
    expect(b.getConfig()).toEqual({});
    b.dispose();
    a.logger.error("a");
    expect(a.getConfig()).toEqual({ logLevel: "silent" });
  });
});

describe("context", () => {
  const registry = { getAllDatastores: () => [], getAllDataModels: () => [] };
  const datastoreManager = { getAll: () => [] };
  const sessionManager = {
    getAll: () => [],
    create: async () => session,
    remove: async () => false,
  };
  const session = {
    inputs: { getAll: async function* () {}, add: async () => {}, remove: async () => false },
    results: { getAll: async function* () {}, add: async () => {}, remove: async () => false },
  };

  test("exposes the supplied services and runtime logger/output/reporting", () => {
    const onProgress = mock((_e: unknown) => {});
    const runtime = createRuntime({
      session,
      registry,
      datastoreManager,
      sessionManager,
      onProgress,
    });
    const context: RuntimeContext = runtime.context;
    expect(context.session).toBe(session);
    expect(context.registry).toBe(registry);
    expect(context.datastoreManager).toBe(datastoreManager);
    expect(context.sessionManager).toBe(sessionManager);
    expect(context.logger).toBe(runtime.logger);
    expect(context.output).toBe(runtime.output);
    context.reportProgress({ id: "1", operation: "o", state: "start" });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(runtime.context).toBe(context);
  });

  test("throws naming the missing options", () => {
    const runtime = createRuntime({ session });
    expect(() => runtime.context).toThrow(/registry, datastoreManager, sessionManager/);
  });
});

describe("runtime-agnostic source", () => {
  test("src/ has no Bun, node: or process references", async () => {
    const forbidden = /\bBun\b|node:|\bprocess\b|\brequire\(/;
    const files = [...new Bun.Glob("src/**/*.ts").scanSync({ cwd: `${import.meta.dir}/..` })];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = await Bun.file(`${import.meta.dir}/../${file}`).text();
      expect(forbidden.test(text)).toBe(false);
    }
  });
});
