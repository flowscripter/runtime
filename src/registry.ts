import type {
  DataModel,
  Datastore,
  DatastoreManager,
  FlowscripterComponent,
  Registry,
} from "@flowscripter/plugin-api";
import { assertHandle } from "./session.ts";

export type ComponentKind = "datastore" | "dataModel";

const KINDS: ReadonlyArray<ComponentKind> = ["datastore", "dataModel"];

export interface ComponentRegistry {
  readonly registry: Registry;
  readonly datastoreManager: DatastoreManager;
  register(handle: string, component: FlowscripterComponent, kind: ComponentKind): void;
  /** Removes and returns the component, or undefined if the handle is unknown. */
  unregister(handle: string): FlowscripterComponent | undefined;
  /** Removes and returns all components in reverse registration order. */
  drain(): Array<[string, FlowscripterComponent]>;
}

export function createComponentRegistry(): ComponentRegistry {
  // Map preserves registration order; handles are unique across kinds
  const components = new Map<string, { kind: ComponentKind; component: FlowscripterComponent }>();

  const select = <T>(kind: ComponentKind): Array<[string, T]> =>
    Array.from(components, ([handle, entry]) => [handle, entry] as const)
      .filter(([, entry]) => entry.kind === kind)
      .map(([handle, entry]) => [handle, entry.component as T]);

  return {
    registry: {
      getAllDatastores: () => select<Datastore>("datastore"),
      getAllDataModels: () => select<DataModel>("dataModel"),
    },
    datastoreManager: { getAll: () => select<Datastore>("datastore") },
    register(handle, component, kind) {
      assertHandle(handle);
      if (!KINDS.includes(kind)) {
        throw new TypeError(
          `Unknown component kind: ${String(kind)} (expected ${KINDS.join(", ")})`,
        );
      }
      if (typeof component !== "object" || component === null) {
        throw new TypeError("Component must be an object");
      }
      if (components.has(handle)) {
        throw new Error(`Component already registered: ${handle}`);
      }
      components.set(handle, { kind, component });
    },
    unregister(handle) {
      const entry = components.get(handle);
      components.delete(handle);
      return entry?.component;
    },
    drain() {
      const all = Array.from(components, ([handle, entry]): [string, FlowscripterComponent] => [
        handle,
        entry.component,
      ]).reverse();
      components.clear();
      return all;
    },
  };
}
