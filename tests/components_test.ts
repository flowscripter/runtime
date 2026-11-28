import { describe, expect, mock, test } from "bun:test";
import type { DataEntry, FlowscripterComponent } from "@flowscripter/plugin-api";
import {
  createDataCollection,
  createMemoryDatastore,
  createRuntime,
  DEFAULT_SESSION_HANDLE,
  MEMORY_DATASTORE_HANDLE,
} from "../index.ts";

const entry = (): DataEntry => ({ model: { config: undefined } });

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

function makeLogger() {
  return {
    debug: mock((_m: string | (() => string), _f?: unknown) => {}),
    info: mock((_m: string, _f?: unknown) => {}),
    warn: mock((_m: string, _f?: unknown) => {}),
    error: mock((_m: string, _f?: unknown, _c?: unknown) => {}),
  };
}

describe("DataCollection", () => {
  test("add is idempotent, remove reports presence, order is insertion order", async () => {
    const collection = createDataCollection();
    const a = entry();
    const b = entry();
    await collection.add(a);
    await collection.add(b);
    await collection.add(a);
    expect(await collect(collection.getAll())).toEqual([a, b]);
    expect(await collection.remove(a)).toBe(true);
    expect(await collection.remove(a)).toBe(false);
    expect(await collect(collection.getAll())).toEqual([b]);
  });

  test("iteration uses a snapshot taken when iteration starts", async () => {
    const collection = createDataCollection();
    await collection.add(entry());
    const seen: DataEntry[] = [];
    for await (const item of collection.getAll()) {
      seen.push(item);
      await collection.add(entry());
      await collection.remove(item);
    }
    expect(seen).toHaveLength(1);
    expect(await collect(collection.getAll())).toHaveLength(1);
  });
});

describe("memory datastore", () => {
  test("snapshot iteration survives adds during iteration", async () => {
    const store = createMemoryDatastore();
    store.add(entry());
    store.add(entry());
    let count = 0;
    for await (const _ of store.getAllDataEntries()) {
      store.add(entry());
      count++;
    }
    expect(count).toBe(2);
    expect(await collect(store.getAllDataEntries())).toHaveLength(4);
  });

  test("add is idempotent and remove reports presence", async () => {
    const store = createMemoryDatastore();
    const e = entry();
    store.add(e);
    store.add(e);
    expect(await collect(store.getAllDataEntries())).toEqual([e]);
    expect(store.remove(e)).toBe(true);
    expect(store.remove(e)).toBe(false);
  });
});

describe("SessionManager", () => {
  test("default session and built-in datastore handles", () => {
    const { registry, datastoreManager, sessionManager } = createRuntime().context;
    expect(Array.from(sessionManager.getAll()).map(([h]) => h)).toEqual([DEFAULT_SESSION_HANDLE]);
    expect(Array.from(registry.getAllDatastores()).map(([h]) => h)).toEqual([
      MEMORY_DATASTORE_HANDLE,
    ]);
    expect(Array.from(datastoreManager.getAll()).map(([h]) => h)).toEqual([
      MEMORY_DATASTORE_HANDLE,
    ]);
    expect(Array.from(registry.getAllDataModels())).toEqual([]);
  });

  test("create, duplicate rejection, remove, snapshot", async () => {
    const { sessionManager } = createRuntime().context;
    const snapshot = Array.from(sessionManager.getAll());
    const s = await sessionManager.create("a");
    expect(Array.from(sessionManager.getAll())).toHaveLength(2);
    expect(snapshot).toHaveLength(1);
    await expect(sessionManager.create("a")).rejects.toThrow(/already exists/);
    await expect(sessionManager.create("")).rejects.toThrow(TypeError);
    await s.inputs.add(entry());
    expect(await collect((await sessionManager.create("b")).inputs.getAll())).toEqual([]);
    expect(await sessionManager.remove("a")).toBe(true);
    expect(await sessionManager.remove("a")).toBe(false);
  });

  test("getAll returns a snapshot", async () => {
    const { sessionManager } = createRuntime().context;
    const before = sessionManager.getAll();
    await sessionManager.create("x");
    expect(Array.from(before)).toHaveLength(1);
  });
});

describe("registerComponent", () => {
  test("registers by kind as [handle, component] snapshots", () => {
    const runtime = createRuntime();
    const store = createMemoryDatastore();
    const model: FlowscripterComponent = { config: {} };
    runtime.registerComponent("ds", store, "datastore");
    runtime.registerComponent("dm", model, "dataModel");
    const { registry, datastoreManager } = runtime.context;
    const snapshot = registry.getAllDatastores();
    runtime.registerComponent("ds2", createMemoryDatastore(), "datastore");
    expect(Array.from(snapshot).map(([h]) => h)).toEqual(["memory", "ds"]);
    expect(Array.from(datastoreManager.getAll()).map(([h]) => h)).toEqual(["memory", "ds", "ds2"]);
    expect(Array.from(registry.getAllDataModels())).toEqual([["dm", model]]);
  });

  test("rejects duplicate, empty handles and unknown kinds", () => {
    const runtime = createRuntime();
    runtime.registerComponent("a", { config: 1 }, "dataModel");
    expect(() => runtime.registerComponent("a", { config: 1 }, "dataModel")).toThrow(/already/);
    expect(() => runtime.registerComponent("memory", { config: 1 }, "dataModel")).toThrow(
      /already/,
    );
    expect(() => runtime.registerComponent("", { config: 1 }, "dataModel")).toThrow(TypeError);
    expect(() => runtime.registerComponent("b", { config: 1 }, "registry" as never)).toThrow(
      /Unknown component kind/,
    );
  });

  test("unregister calls dispose and reports unknown handles", async () => {
    const runtime = createRuntime();
    const dispose = mock(() => {});
    runtime.registerComponent("a", { config: 1, dispose }, "dataModel");
    expect(await runtime.unregisterComponent("a")).toBe(true);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(await runtime.unregisterComponent("a")).toBe(false);
    expect(Array.from(runtime.context.registry.getAllDataModels())).toEqual([]);
    runtime.registerComponent("a", { config: 1 }, "dataModel");
  });

  test("unregister logs a throwing dispose", async () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger });
    const boom = new Error("boom");
    runtime.registerComponent(
      "a",
      {
        config: 1,
        dispose: () => {
          throw boom;
        },
      },
      "dataModel",
    );
    expect(await runtime.unregisterComponent("a")).toBe(true);
    expect(logger.error).toHaveBeenCalledWith("Component dispose threw", { handle: "a" }, boom);
  });
});

describe("dispose with components", () => {
  test("disposes in reverse registration order and isolates errors", async () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger });
    const order: string[] = [];
    const boom = new Error("boom");
    runtime.registerComponent("a", { config: 1, dispose: () => void order.push("a") }, "dataModel");
    runtime.registerComponent(
      "b",
      {
        config: 1,
        dispose: () => {
          order.push("b");
          throw boom;
        },
      },
      "dataModel",
    );
    runtime.registerComponent(
      "c",
      {
        config: 1,
        dispose: async () => {
          await Promise.resolve();
          order.push("c");
          throw boom;
        },
      },
      "dataModel",
    );
    await runtime.dispose();
    expect(order).toEqual(["c", "b", "a"]);
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith("Component dispose threw", { handle: "b" }, boom);
    expect(logger.error).toHaveBeenCalledWith("Component dispose threw", { handle: "c" }, boom);
  });

  test("further registration throws, dispose is idempotent", async () => {
    const dispose = mock(() => {});
    const runtime = createRuntime();
    runtime.registerComponent("a", { config: 1, dispose }, "dataModel");
    const first = runtime.dispose();
    expect(runtime.dispose()).toBe(first);
    await first;
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(() => runtime.registerComponent("b", { config: 1 }, "dataModel")).toThrow(/disposed/);
    expect(await runtime.unregisterComponent("a")).toBe(false);
  });

  test("sinks stay open until async component disposal completes, then close", async () => {
    const logger = makeLogger();
    const runtime = createRuntime({ logger });
    runtime.registerComponent("a", { config: 1, dispose: async () => {} }, "dataModel");
    const done = runtime.dispose();
    runtime.logger.error("during");
    await done;
    runtime.logger.error("after");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});

describe("isolation of components", () => {
  test("two runtimes do not share registry, sessions or datastores", async () => {
    const a = createRuntime();
    const b = createRuntime();
    a.registerComponent("x", { config: 1 }, "dataModel");
    await a.context.sessionManager.create("only-a");
    await a.context.session.inputs.add(entry());
    expect(Array.from(b.context.registry.getAllDataModels())).toEqual([]);
    expect(Array.from(b.context.sessionManager.getAll())).toHaveLength(1);
    expect(await collect(b.context.session.inputs.getAll())).toEqual([]);
    expect(b.context.session).not.toBe(a.context.session);
    b.registerComponent("x", { config: 1 }, "dataModel");
  });
});
