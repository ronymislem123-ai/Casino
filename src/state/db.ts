/**
 * Minimal IndexedDB persistence with graceful fallback (private mode, blocked storage).
 * Stores: 'tables' (computed strategy tables), 'sims' (saved simulation results), 'kv' (misc).
 */
const DB_NAME = 'omega-blackjack';
const VERSION = 1;
const STORES = ['tables', 'sims', 'kv'] as const;
type Store = (typeof STORES)[number];

let dbp: Promise<IDBDatabase | null> | null = null;
const memory: Record<Store, Map<string, unknown>> = { tables: new Map(), sims: new Map(), kv: new Map() };

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

export async function dbGet<T>(store: Store, key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory[store].get(key) as T | undefined;
  return new Promise((resolve) => {
    try {
      const r = db.transaction(store, 'readonly').objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => resolve(memory[store].get(key) as T | undefined);
    } catch {
      resolve(memory[store].get(key) as T | undefined);
    }
  });
}

export async function dbPut(store: Store, key: string, value: unknown): Promise<void> {
  memory[store].set(key, value);
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function dbDelete(store: Store, key: string): Promise<void> {
  memory[store].delete(key);
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function dbAll<T>(store: Store): Promise<T[]> {
  const db = await open();
  if (!db) return [...memory[store].values()] as T[];
  return new Promise((resolve) => {
    try {
      const r = db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result as T[]);
      r.onerror = () => resolve([...memory[store].values()] as T[]);
    } catch {
      resolve([...memory[store].values()] as T[]);
    }
  });
}

export async function dbClear(store: Store): Promise<void> {
  memory[store].clear();
  const db = await open();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** localStorage helpers wrapped in try/catch (may throw in private mode). */
export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
