/** Client for the simulation worker (one run at a time). */
import type { SimSummary, PairedComparison } from '../engine/stats';
import type { SimRunConfig, BettingRunConfig } from '../workers/protocol';
import type { SystemResult, KellyModel } from '../engine/betting';

export interface StrategyResult {
  name: string;
  description: string;
  kind: string;
  note?: string;
  summary: SimSummary;
  checkpoints: [number, number, number][];
}
export interface SimProgress {
  type: 'progress' | 'done';
  runId: string;
  elapsedMs: number;
  roundsDone: number;
  roundsPlanned: number;
  rate: number;
  results: StrategyResult[];
  comparisons: (PairedComparison | null)[];
  cancelled: boolean;
}
export interface BettingResult {
  streamSummary: SimSummary;
  kelly: KellyModel;
  systems: SystemResult[];
  ms: number;
  strategyName: string;
}

let worker: Worker | null = null;
let bworker: Worker | null = null;
function w(): Worker {
  if (!worker) worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}
/** separate worker so that a running strategy simulation is not interrupted */
function bw(): Worker {
  if (!bworker) bworker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' });
  return bworker;
}

export function startSimulation(
  runId: string,
  config: SimRunConfig,
  on: { progress: (p: SimProgress) => void; status?: (t: string) => void; error: (e: string) => void },
) {
  const wk = w();
  wk.onmessage = (ev: MessageEvent) => {
    const m = ev.data;
    if (m.runId !== runId) return;
    if (m.type === 'progress' || m.type === 'done') on.progress(m as SimProgress);
    else if (m.type === 'status') on.status?.(m.text);
    else if (m.type === 'error') on.error(m.error);
  };
  wk.postMessage({ type: 'start', runId, config });
}
export const pauseSimulation = () => w().postMessage({ type: 'pause' });
export const resumeSimulation = () => w().postMessage({ type: 'resume' });
export const cancelSimulation = () => w().postMessage({ type: 'cancel' });

export function runBetting(runId: string, config: BettingRunConfig, on: { progress: (d: number, t: number) => void; done: (r: BettingResult) => void; error: (e: string) => void }) {
  const wk = bw();
  wk.onmessage = (ev: MessageEvent) => {
    const m = ev.data;
    if (m.runId !== runId) return;
    if (m.type === 'betting-progress') on.progress(m.done, m.total);
    else if (m.type === 'betting-done') on.done(m as BettingResult);
    else if (m.type === 'error') on.error(m.error);
  };
  wk.postMessage({ type: 'betting', runId, config });
}
