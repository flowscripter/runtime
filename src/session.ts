import type { Session, SessionManager } from "@flowscripter/plugin-api";
import { createDataCollection } from "./data.ts";

export interface InternalSessionManager extends SessionManager {
  /** Adopts an existing session under a handle. */
  adopt(handle: string, session: Session): void;
}

export function assertHandle(handle: unknown): asserts handle is string {
  if (typeof handle !== "string" || handle.length === 0) {
    throw new TypeError("Handle must be a non-empty string");
  }
}

export function createSession(): Session {
  return { inputs: createDataCollection(), results: createDataCollection() };
}

export function createSessionManager(): InternalSessionManager {
  const sessions = new Map<string, Session>();
  const adopt = (handle: string, session: Session) => {
    assertHandle(handle);
    if (sessions.has(handle)) {
      throw new Error(`Session already exists: ${handle}`);
    }
    sessions.set(handle, session);
  };
  return {
    adopt,
    getAll: () => Array.from(sessions),
    async create(handle) {
      const session = createSession();
      adopt(handle, session);
      return session;
    },
    async remove(handle) {
      return sessions.delete(handle);
    },
  };
}
