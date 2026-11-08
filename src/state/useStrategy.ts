import { useEffect, useState } from 'react';
import type { Rules } from '../engine/rules';
import { rulesKey } from '../engine/rules';
import type { StrategyTable } from '../engine/strategy';
import { engineClient } from '../workers/client';
import { dbGet, dbPut } from './db';
import presetCodes from '../data/presetCodes.json';
import type { CodeGrid } from '../engine/advisor';

const memo = new Map<string, StrategyTable>();
const inflight = new Map<string, Promise<StrategyTable>>();
const TABLE_VERSION = 'v2';

export async function loadStrategyTable(rules: Rules, onProgress?: (p: number) => void): Promise<StrategyTable> {
  const key = TABLE_VERSION + '|' + rulesKey(rules);
  const m = memo.get(key);
  if (m) return m;
  const f = inflight.get(key);
  if (f) return f;
  const p = (async () => {
    const cached = await dbGet<StrategyTable>('tables', key);
    if (cached) {
      memo.set(key, cached);
      return cached;
    }
    const t = await engineClient.table(rules, (d, tot) => onProgress?.(d / tot));
    memo.set(key, t);
    void dbPut('tables', key, t);
    return t;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

/** Precomputed code grid for preset rules (instant, offline), else null. */
export function presetGrid(rules: Rules): CodeGrid | null {
  const g = (presetCodes as Record<string, CodeGrid>)[rulesKey(rules)];
  return g ?? null;
}

export function useStrategyTable(rules: Rules): { table: StrategyTable | null; grid: CodeGrid | null; progress: number; error: string | null } {
  const key = rulesKey(rules);
  const [state, setState] = useState<{ key: string; table: StrategyTable | null; progress: number; error: string | null }>({
    key,
    table: memo.get(TABLE_VERSION + '|' + key) ?? null,
    progress: 0,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => (s.key === key && s.table ? s : { key, table: memo.get(TABLE_VERSION + '|' + key) ?? null, progress: 0, error: null }));
    loadStrategyTable(rules, (p) => alive && setState((s) => ({ ...s, progress: p })))
      .then((t) => alive && setState({ key, table: t, progress: 1, error: null }))
      .catch((e) => alive && setState((s) => ({ ...s, error: (e as Error).message })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const table = state.key === key ? state.table : null;
  return { table, grid: table ?? presetGrid(rules), progress: state.progress, error: state.error };
}
