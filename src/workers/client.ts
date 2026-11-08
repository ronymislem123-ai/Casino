/** Promise-based client for the engine worker (one shared instance). */
import type { Rules } from '../engine/rules';
import type { StrategyTable } from '../engine/strategy';
import type { HandContext, HandEvaluation } from '../engine/ev';
import type { ChartComparison } from '../engine/chartCompare';
import type { MCActionResult } from '../engine/validation';
import type { Action } from '../engine/ev';

type Progress = (done: number, total: number, partial?: unknown) => void;
interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  progress?: Progress;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') p.progress?.(m.done, m.total, m.partial);
      else if (m.type === 'result') {
        pending.delete(m.id);
        p.resolve(m.data);
      } else if (m.type === 'error') {
        pending.delete(m.id);
        p.reject(new Error(m.error));
      }
    };
  }
  return worker;
}

function call<T>(msg: Record<string, unknown>, progress?: Progress): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, progress });
    getWorker().postMessage({ ...msg, id });
  });
}

export interface LiveEvaluation extends HandEvaluation {
  insurance: { ev: number; pTen: number } | null;
  /** dealer final distribution 17,18,19,20,21,bust,BJ (unconditional) */
  dealer: number[];
  ms: number;
}

export const engineClient = {
  table: (rules: Rules, progress?: Progress, deckModel: 'finite' | 'infinite' = 'finite') =>
    call<StrategyTable>({ type: 'table', rules, deckModel }, progress),
  primeTable: (rules: Rules, table: StrategyTable) => call<boolean>({ type: 'table', rules, table }),
  evaluate: (rules: Rules, ctx: HandContext) => call<LiveEvaluation>({ type: 'evaluate', rules, ctx }),
  houseEdge: (base: Rules, variants: { label: string; rules: Rules }[], progress?: Progress) =>
    call<HouseEdgeResult>({ type: 'houseEdge', base, variants }, progress),
  compareChart: (rules: Rules, chartId: string, progress?: Progress) => call<ChartComparison>({ type: 'compareChart', rules, chartId }, progress),
  dealerProbs: (rules: Rules, infinite = false) => call<{ up: number; cond: number[]; uncond: number[] }[]>({ type: 'dealerProbs', rules, infinite }),
  situationMC: (rules: Rules, up: number, hand: number[], actions: Action[], trials: number, seed: number, progress?: Progress, removed?: number[]) =>
    call<MCActionResult[]>({ type: 'situationMC', rules, up, hand, actions, trials, seed, removed }, progress),
};

export interface HouseEdgeVariant {
  label: string;
  rules: Rules;
  cd: number;
  td: number;
  changedCells: number;
  changes: string[];
}
export interface HouseEdgeResult {
  base: { cd: number; td: number };
  variants: HouseEdgeVariant[];
}
