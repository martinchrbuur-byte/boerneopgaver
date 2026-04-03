export const createEntityId = (prefix) => `${prefix}_${
  globalThis.crypto?.randomUUID?.() ?? `${Math.random().toString(36).slice(2, 10)}_${Date.now()}`
}`;